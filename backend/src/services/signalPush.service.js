import { randomUUID } from 'node:crypto'
import Signal from '../models/signal.model.js'
import DailySignal from '../models/dailySignal.model.js'
import PushSubscription from '../models/pushSubscription.model.js'
import SignalPushEvent from '../models/signalPushEvent.model.js'
import SignalPushDelivery from '../models/signalPushDelivery.model.js'
import { getNewsSubscription } from './newsSignalAccess.service.js'
import { getDailySubscription } from './dailySignalAccess.service.js'
import { getPushConfiguration, sendPushNotification } from './push.service.js'

const POLL_MS = 15000
const LEASE_MS = 60000
const EVENT_LIFETIME_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const PAGE_SIZE = 40
const CONCURRENCY = 4
let timer
let running
let modelsReady

function logFailure(context, error) {
  // Never log provider response bodies, endpoints, encryption keys, or VAPID keys.
  console.error(context, {
    name: String(error?.name || 'Error').slice(0, 40),
    status: Number(error?.status) || undefined,
    code: error?.code === 11000 ? 11000 : undefined,
  })
}

function imageLength(value) {
  if (!value) return 0
  if (Buffer.isBuffer(value)) return value.length
  if (ArrayBuffer.isView(value)) return value.byteLength
  if (value._bsontype === 'Binary' && typeof value.length === 'function') return value.length()
  return 0
}

export function signalPushState(signal, kind) {
  const active = Boolean(signal && !signal.archivedAt &&
    (kind === 'news' || (kind === 'daily' && signal.status === 'published')))
  return {
    active,
    released: Boolean(active && imageLength(signal.image) > 0 &&
      typeof signal.details === 'string' && signal.details.trim()),
  }
}

export async function queueSignalPushAlert(signal, kind, previous = { active: false, released: false }) {
  if (!['news', 'daily'].includes(kind)) return false
  const state = signalPushState(signal, kind)
  if (!state.active) return false
  const event = state.released && !previous.released
    ? 'released'
    : !state.released && !previous.active ? 'published' : null
  if (!event) return false

  try {
    const now = new Date()
    const result = await SignalPushEvent.updateOne(
      { _id: `${kind}:${String(signal._id)}:${event}` },
      { $setOnInsert: {
        signalId: signal._id, kind, event, state: 'queued', attempts: 0,
        nextAttemptAt: now, expiresAt: new Date(now.getTime() + EVENT_LIFETIME_MS),
        createdAt: now,
      } },
      { upsert: true },
    )
    startSignalPushDelivery()
    // The database record is durable; provider delivery runs outside the publish request.
    setImmediate(() => { void processSignalPushQueue().catch(error => logFailure('Signal push worker failed:', error)) })
    if (result.upsertedCount) {
      console.info('Signal push queued:', { kind, event, signalId: String(signal._id) })
    }
    return Boolean(result.upsertedCount)
  } catch (error) {
    if (error?.code !== 11000) logFailure('Signal push could not be queued:', error)
    // A notification outage must not turn an already saved signal into an API failure.
    return false
  }
}

function notificationFor(job) {
  const label = job.kind === 'daily' ? 'Daily Signal' : 'News Signal'
  return {
    title: job.event === 'released' ? `${label} released` : `New ${label}`,
    body: job.event === 'released'
      ? `A ${label} is ready. Open CMM-FT to view it.`
      : `A new ${label} has been posted. Open CMM-FT to check the schedule.`,
    url: '/signal',
    tag: `cmm-${job.kind}-${String(job.signalId)}-${job.event}`,
  }
}

async function deliver(job) {
  const stats = { accepted: 0, expired: 0, skipped: 0, failed: 0 }
  if (new Date(job.expiresAt).getTime() <= Date.now()) return { ...stats, obsolete: true }
  const Model = job.kind === 'daily' ? DailySignal : Signal
  const signal = await Model.findById(job.signalId).select('+image +details').lean()
  const current = signalPushState(signal, job.kind)
  if (!current.active || current.released !== (job.event === 'released')) {
    return { ...stats, obsolete: true }
  }

  const { publicKey } = getPushConfiguration()
  const payload = notificationFor(job)
  const getAccess = job.kind === 'daily' ? getDailySubscription : getNewsSubscription
  let leaseUntil = new Date(job.leaseUntil).getTime()
  let renewing
  let lostLease = false
  async function keepLease() {
    if (lostLease || Date.now() >= new Date(job.expiresAt).getTime()) return false
    if (Date.now() < leaseUntil - 20000) return true
    if (!renewing) {
      const now = new Date()
      const nextLease = new Date(now.getTime() + LEASE_MS)
      renewing = SignalPushEvent.updateOne(
        { _id: job._id, state: 'processing', leaseToken: job.leaseToken, leaseUntil: { $gt: now } },
        { $set: { leaseUntil: nextLease } },
      ).then(result => {
        lostLease = result.matchedCount !== 1
        if (!lostLease) leaseUntil = nextLease.getTime()
        return !lostLease
      }).finally(() => { renewing = null })
    }
    return renewing
  }

  let cursor
  while (await keepLease()) {
    const now = new Date()
    const query = {
      vapidPublicKey: publicKey,
      createdAt: { $lte: job.createdAt },
      $or: [{ expirationTime: null }, { expirationTime: { $gt: now } }],
      ...(cursor ? { _id: { $gt: cursor } } : {}),
    }
    const page = await PushSubscription.find(query)
      .select('+endpoint +keys').sort({ _id: 1 }).limit(PAGE_SIZE).lean()
    if (!page.length) break
    let index = 0
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, page.length) }, async () => {
      while (index < page.length) {
        const subscription = page[index++]
        try {
          if (!await keepLease()) return
          const deliveryId = `${job._id}:${String(subscription._id)}:${subscription.bindingVersion}`
          if (await SignalPushDelivery.exists({ _id: deliveryId })) { stats.skipped++; continue }
          const access = await getAccess(subscription.userId)
          if (!access?.active) { stats.skipped++; continue }
          // Respect disabled/replaced subscriptions before contacting the provider.
          const live = await PushSubscription.exists({
            _id: subscription._id, userId: subscription.userId,
            bindingVersion: subscription.bindingVersion, vapidPublicKey: publicKey,
          })
          if (!live || !await keepLease()) { stats.skipped++; continue }
          try {
            await sendPushNotification(subscription, payload)
          } catch (error) {
            if (error?.code !== 'PUSH_EXPIRED') throw error
            await PushSubscription.deleteOne({
              _id: subscription._id, userId: subscription.userId,
              bindingVersion: subscription.bindingVersion,
            })
            stats.expired++
            continue
          }
          const acceptedAt = new Date()
          await SignalPushDelivery.updateOne({ _id: deliveryId }, { $setOnInsert: {
            eventId: job._id, subscriptionId: subscription._id,
            bindingVersion: subscription.bindingVersion, acceptedAt,
            expiresAt: new Date(acceptedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
          } }, { upsert: true })
          stats.accepted++
        } catch (error) {
          stats.failed++
          logFailure('Signal push device delivery failed:', error)
        }
      }
    }))
    cursor = page[page.length - 1]._id
    if (page.length < PAGE_SIZE) break
  }
  return { ...stats, lostLease, obsolete: Date.now() >= new Date(job.expiresAt).getTime() }
}

async function drain() {
  if (!modelsReady) {
    modelsReady = Promise.all([SignalPushEvent.init(), SignalPushDelivery.init()])
      .catch(error => { modelsReady = null; throw error })
  }
  await modelsReady
  for (let count = 0; count < 8; count++) {
    const now = new Date()
    const job = await SignalPushEvent.findOneAndUpdate({
      $or: [
        { state: 'queued', nextAttemptAt: { $lte: now } },
        { state: 'processing', leaseUntil: { $lte: now } },
      ],
    }, {
      $set: { state: 'processing', leaseToken: randomUUID(), leaseUntil: new Date(now.getTime() + LEASE_MS) },
      $inc: { attempts: 1 },
    }, { sort: { nextAttemptAt: 1, createdAt: 1 }, returnDocument: 'after' }).lean()
    if (!job) return
    let result
    try { result = await deliver(job) } catch (error) {
      logFailure('Signal push event delivery failed:', error)
      result = { failed: 1 }
    }
    if (result.lostLease) continue
    const retry = result.failed > 0 && job.attempts < MAX_ATTEMPTS &&
      Date.now() < new Date(job.expiresAt).getTime()
    await SignalPushEvent.updateOne(
      { _id: job._id, state: 'processing', leaseToken: job.leaseToken },
      { $set: {
        state: result.obsolete ? 'skipped' : retry ? 'queued' : 'complete',
        nextAttemptAt: new Date(Date.now() + POLL_MS * 2 ** Math.min(job.attempts - 1, 4)),
        leaseUntil: null, leaseToken: null,
      } },
    )
    console.info('Signal push delivery result:', { eventId: job._id, ...result, retry })
  }
}

export function processSignalPushQueue() {
  if (!running) running = drain().finally(() => { running = null })
  return running
}

export function startSignalPushDelivery() {
  if (timer) return
  const tick = () => { void processSignalPushQueue().catch(error => logFailure('Signal push worker failed:', error)) }
  timer = setInterval(tick, POLL_MS)
  timer.unref?.()
  setImmediate(tick)
}
