import { setTimeout as delay } from 'node:timers/promises'
import mongoose from 'mongoose'
import DailySignalSubscription from '../models/dailySignalSubscription.model.js'
import NewsSignalSubscription from '../models/newsSignalSubscription.model.js'
import Payment from '../models/payment.model.js'
import SignalExpiryEmail from '../models/signalExpiryEmail.model.js'
import User from '../models/user.model.js'
import { getDailySubscription } from './dailySignalAccess.service.js'
import { addCalendarMonth, DAILY_PRODUCT_ID } from './dailySignalTerms.js'
import { requestResendEmail } from './email.server.js'
import {
  findLatestPaidNewsReceipt,
  getNewsSubscription,
  paidNewsReceiptExpiry,
  paidNewsReceiptFilter,
} from './newsSignalAccess.service.js'
import { NEWS_PRODUCT_ID } from './newsSignalTerms.js'

const DAY_MS = 24 * 60 * 60_000
const POLL_MS = 5 * 60_000
// Keep retries inside Resend's 24-hour idempotency window.
const RETRY_WINDOW_MS = 23 * 60 * 60_000
const EMAIL_ADDRESS = /^[^\s,<>@]+@[^\s,<>@]+\.[^\s,<>@]+$/
const EXPIRY_DATE = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Phnom_Penh',
})

const products = {
  [NEWS_PRODUCT_ID]: {
    model: NewsSignalSubscription,
    getAccess: getNewsSubscription,
    name: 'News Signal pass',
  },
  [DAILY_PRODUCT_ID]: {
    model: DailySignalSubscription,
    getAccess: getDailySubscription,
    name: 'Daily Signal subscription',
  },
}

let timer

function endedNaturally(productId, period) {
  // Admin revocation shortens a Daily paid period to the time of removal.
  return productId !== DAILY_PRODUCT_ID ||
    (period.startsAt && +period.expiresAt === +addCalendarMonth(period.startsAt))
}

async function queueExpiry(productId, userId, expiresAt, now) {
  if (!mongoose.isObjectIdOrHexString(userId)) return
  const _id = `signal-expiry/${productId}/${String(userId).toLowerCase()}/${+expiresAt}`
  try {
    await SignalExpiryEmail.updateOne(
      { _id },
      { $setOnInsert: { productId, userId, expiresAt, status: 'pending', nextAttemptAt: now } },
      { upsert: true },
    )
  } catch (error) {
    if (error.code !== 11000) throw error
  }
}

async function queueExpiries(from, now) {
  for (const [productId, product] of Object.entries(products)) {
    const periods = product.model.find({ expiresAt: { $gte: from, $lte: now } })
      .select('userId startsAt expiresAt').lean().cursor()
    for await (const period of periods) {
      if (endedNaturally(productId, period)) {
        await queueExpiry(productId, period.userId, period.expiresAt, now)
      }
    }
  }

  // Some older News customers have only a verified payment receipt.
  // A UTC calendar month is between 28 and 31 days.
  const receipts = Payment.find(paidNewsReceiptFilter({
    $gte: new Date(+from - 31 * DAY_MS),
    $lte: new Date(+now - 28 * DAY_MS),
  })).select('userId paidAt amountCents').lean().cursor()
  for await (const receipt of receipts) {
    const expiresAt = paidNewsReceiptExpiry(receipt)
    if (expiresAt && expiresAt >= from && expiresAt <= now) {
      await queueExpiry(NEWS_PRODUCT_ID, receipt.userId, expiresAt, now)
    }
  }
}

async function stillLatestPaidExpiry(job, product, now) {
  const period = await product.model.findOne({ userId: job.userId, startsAt: { $lte: now } })
    .select('startsAt expiresAt')
    .sort({ expiresAt: -1 })
    .lean()
  if (job.productId === DAILY_PRODUCT_ID) {
    if (!period || +period.expiresAt !== +job.expiresAt || !endedNaturally(job.productId, period)) {
      return false
    }
    // Payment verification can finish before the new access period is saved.
    const renewal = await Payment.exists({
      userId: String(job.userId),
      productId: DAILY_PRODUCT_ID,
      status: 'paid',
      currency: 'USD',
      paidAt: { $gt: period.startsAt, $lte: now },
    })
    return !renewal
  }

  const receipt = await findLatestPaidNewsReceipt(job.userId, now)
  const expiresAt = Math.max(+(period?.expiresAt ?? 0), +(paidNewsReceiptExpiry(receipt) ?? 0))
  return expiresAt === +job.expiresAt
}

function renewalMessage(job, product, { email, username }, settings) {
  const checkoutUrl = new URL('/payment', settings.frontendUrl)
  checkoutUrl.searchParams.set('productId', job.productId)
  const name = typeof username === 'string' ? username.replace(/\s+/g, ' ').trim() : ''
  return {
    from: settings.from,
    to: [email],
    subject: `Your CMM-FT ${product.name} has expired`,
    text: [
      name ? `Hi ${name},` : 'Hi,',
      `Your ${product.name} expired on ${EXPIRY_DATE.format(job.expiresAt)} (Cambodia time).`,
      `To continue receiving ${job.productId === NEWS_PRODUCT_ID ? 'News Signals' : 'Daily Signals'},Click here to pay`,
      checkoutUrl.href,
      'Thank you,\nThe CMM-FT team',
    ].join('\n\n'),
  }
}

function finishJob(claim, status, providerId) {
  return SignalExpiryEmail.updateOne(claim, {
    $set: { status, finishedAt: new Date(), ...(providerId ? { providerId } : {}) },
    $unset: { message: 1, nextAttemptAt: 1 },
  })
}

async function deliverExpiryEmail(job, settings) {
  const now = new Date()
  const claim = { _id: job._id, status: 'pending', nextAttemptAt: new Date(+now + POLL_MS) }
  const claimed = await SignalExpiryEmail.updateOne(
    { _id: job._id, status: 'pending', nextAttemptAt: job.nextAttemptAt },
    { $set: { nextAttemptAt: claim.nextAttemptAt } },
  )
  if (!claimed.matchedCount) return true

  const product = products[job.productId]
  const [user, isLatestExpiry, access] = await Promise.all([
    User.findOne({ _id: job.userId, emailVerified: true }).select('email username').lean(),
    stillLatestPaidExpiry(job, product, now),
    product.getAccess(job.userId, now),
  ])
  const email = user?.email?.trim()
  if (access.active || !isLatestExpiry || !email || !EMAIL_ADDRESS.test(email)) {
    await finishJob(claim, 'skipped')
    return true
  }

  if (job.message && job.message.to[0] !== email) {
    await finishJob(claim, 'skipped')
    return true
  }
  if (job.firstAttemptAt && Date.now() - +job.firstAttemptAt >= RETRY_WINDOW_MS) {
    await finishJob(claim, 'failed')
    return true
  }

  const message = job.message ?? renewalMessage(job, product, { email, username: user.username }, settings)
  if (!job.firstAttemptAt) {
    // Store the original payload before sending so a retry can reuse the key and body.
    const pinned = await SignalExpiryEmail.updateOne(claim, {
      $set: { message, firstAttemptAt: new Date() },
    })
    if (!pinned.matchedCount) return true
  }

  const response = await requestResendEmail(settings.apiKey, message, job._id).catch(() => null)
  const result = await response?.json().catch(() => null)
  if (response?.ok && typeof result?.id === 'string' && result.id) {
    await finishJob(claim, 'sent', result.id)
  } else {
    console.error('Signal expiry email request failed.', { status: response?.status })
    if (response?.status === 400 || response?.status === 422) {
      await finishJob(claim, 'failed')
    } else {
      // Leave the job available for retry and defer other sends during a provider outage.
      return false
    }
  }
  await delay(500)
  return true
}

export function createSignalExpiryEmailCheck(settings) {
  let checkedThrough = settings.startAt
  let running
  return function check() {
    if (running) return running
    const now = new Date()
    if (now < settings.startAt) return Promise.resolve()

    running = (async () => {
      const from = new Date(Math.max(+settings.startAt, +checkedThrough - POLL_MS))
      await queueExpiries(from, now)
      checkedThrough = now

      const jobs = await SignalExpiryEmail.find({
        status: 'pending',
        nextAttemptAt: { $lte: now },
        expiresAt: { $gte: settings.startAt, $lte: now },
      }).sort({ nextAttemptAt: 1 }).limit(50).lean()
      for (const job of jobs) {
        if (!await deliverExpiryEmail(job, settings)) break
      }
    })().finally(() => { running = undefined })
    return running
  }
}

export function startSignalExpiryEmails() {
  const start = process.env.SIGNAL_EXPIRY_EMAILS_START_AT?.trim()
  if (timer || !start) return
  const startAt = new Date(start)
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.SIGNAL_EXPIRY_EMAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim()
  const frontendUrl = URL.parse(process.env.FRONTEND_URL?.trim() || '')
  if (!Number.isFinite(+startAt) || !/(Z|[+-]\d{2}:\d{2})$/i.test(start) ||
    !apiKey || !from || !frontendUrl || !['https:', 'http:'].includes(frontendUrl.protocol)) {
    console.error('Signal expiry email settings are invalid. Check the backend environment.')
    return
  }

  const check = createSignalExpiryEmailCheck({ startAt, apiKey, from, frontendUrl })
  const tick = () => {
    void check().catch(error => {
      console.error('Signal expiry email check failed.', { name: error.name })
    })
  }
  timer = setInterval(tick, POLL_MS)
  timer.unref()
  tick()
}
