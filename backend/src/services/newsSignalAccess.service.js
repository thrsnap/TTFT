import mongoose from 'mongoose'
import NewsSignalSubscription from '../models/newsSignalSubscription.model.js'
import NewsSignalGrant from '../models/newsSignalGrant.model.js'
import SignalAccess from '../models/signalAccess.model.js'
import Payment from '../models/payment.model.js'
import { addNewsCalendarMonth, isNewsPaymentProduct, NEWS_PRODUCT_ID } from './newsSignalTerms.js'

export function paidNewsReceiptFilter(paidAt) {
  return {
    status: 'paid',
    currency: 'USD',
    paidAt,
    $or: [
      { productId: NEWS_PRODUCT_ID },
      { productId: { $regex: '^signal:[a-fA-F0-9]{24}$' } },
    ],
  }
}

export function findLatestPaidNewsReceipt(userId, now) {
  // Payment.userId is a String in the existing payment model.
  return Payment.findOne({
    userId: String(userId),
    ...paidNewsReceiptFilter({ $lte: now }),
  }).select('paidAt amountCents').sort({ paidAt: -1 }).lean()
}

export function paidNewsReceiptExpiry(receipt) {
  return receipt?.paidAt && Number.isSafeInteger(receipt.amountCents) && receipt.amountCents > 0
    ? addNewsCalendarMonth(receipt.paidAt)
    : null
}

export async function getNewsSubscription(userId, now = new Date()) {
  if (!mongoose.isObjectIdOrHexString(userId)) return { active: false, expiresAt: null }
  const filter = { userId, startsAt: { $lte: now }, expiresAt: { $gt: now } }
  const [paid, manual, legacy, receipt] = await Promise.all([
    NewsSignalSubscription.findOne(filter).sort({ expiresAt: -1 }).lean(),
    NewsSignalGrant.findOne({ userId }).lean(),
    SignalAccess.findOne({ userId, createdAt: { $lte: now } }).sort({ createdAt: -1 }).lean(),
    // Read verified receipts independently of a card/grant that may be deleted.
    findLatestPaidNewsReceipt(userId, now),
  ])
  const periods = []
  if (paid) periods.push(paid)
  const receiptExpiresAt = paidNewsReceiptExpiry(receipt)
  if (receiptExpiresAt && receiptExpiresAt > now) periods.push({ expiresAt: receiptExpiresAt })
  if (manual && new Date(manual.startsAt) <= now && new Date(manual.expiresAt) > now) {
    periods.push(manual)
  }
  // Transition existing individual grants to monthly News coverage without
  // restarting their clock on deployment or when records are read again.
  if (legacy?.createdAt &&
      (!manual?.legacyRevokedAt || new Date(legacy.createdAt) > new Date(manual.legacyRevokedAt))) {
    const expiresAt = addNewsCalendarMonth(legacy.createdAt)
    if (expiresAt > now) periods.push({ expiresAt })
  }
  const subscription = periods.sort((a, b) => new Date(b.expiresAt) - new Date(a.expiresAt))[0]
  return { active: Boolean(subscription), expiresAt: subscription?.expiresAt ?? null }
}

export async function fulfillNewsPayment(payment) {
  if (!isNewsPaymentProduct(payment.productId) || payment.status !== 'paid') return {}
  if (payment.currency !== 'USD' || !Number.isSafeInteger(payment.amountCents) ||
      payment.amountCents < 1 || !payment.paidAt ||
      !Number.isFinite(new Date(payment.paidAt).getTime()) ||
      !mongoose.isObjectIdOrHexString(payment._id) ||
      !mongoose.isObjectIdOrHexString(payment.userId)) {
    throw new Error('Invalid News Signal payment receipt')
  }
  const filter = { paymentId: payment._id }
  try {
    await NewsSignalSubscription.updateOne(filter, {
      $setOnInsert: {
        paymentId: payment._id,
        userId: payment.userId,
        startsAt: payment.paidAt,
        expiresAt: addNewsCalendarMonth(payment.paidAt),
      },
    }, { upsert: true, runValidators: true })
  } catch (error) {
    if (error.code !== 11000 || !(await NewsSignalSubscription.exists(filter))) throw error
  }
  const subscription = await getNewsSubscription(payment.userId)
  return {
    accessGranted: subscription.active,
    subscriptionType: 'news',
    subscriptionActive: subscription.active,
    subscriptionExpiresAt: subscription.expiresAt,
  }
}
