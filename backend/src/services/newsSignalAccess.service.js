import mongoose from 'mongoose'
import NewsSignalSubscription from '../models/newsSignalSubscription.model.js'
import NewsSignalGrant from '../models/newsSignalGrant.model.js'
import SignalAccess from '../models/signalAccess.model.js'
import Payment from '../models/payment.model.js'
import { addNewsCalendarMonth, isNewsPaymentProduct } from './newsSignalTerms.js'

export async function getNewsSubscription(userId, now = new Date()) {
  if (!mongoose.isObjectIdOrHexString(userId)) return { active: false, expiresAt: null }
  const filter = { userId, startsAt: { $lte: now }, expiresAt: { $gt: now } }
  const [paid, manual, legacy, receipt] = await Promise.all([
    NewsSignalSubscription.findOne(filter).sort({ expiresAt: -1 }).lean(),
    NewsSignalGrant.findOne({ userId }).lean(),
    SignalAccess.findOne({ userId, createdAt: { $lte: now } }).sort({ createdAt: -1 }).lean(),
    // Payment.userId is a String in the existing payment model.
    // Read verified receipts independently of a card/grant that may be deleted.
    Payment.findOne({
      userId: String(userId), status: 'paid', currency: 'USD',
      paidAt: { $lte: now },
      $or: [
        { productId: 'news-signal-monthly' },
        { productId: { $regex: '^signal:[a-fA-F0-9]{24}$' } },
      ],
    }).select('paidAt amountCents').sort({ paidAt: -1 }).lean(),
  ])
  const periods = []
  if (paid) periods.push(paid)
  if (receipt?.paidAt && Number.isSafeInteger(receipt.amountCents) && receipt.amountCents > 0) {
    const expiresAt = addNewsCalendarMonth(receipt.paidAt)
    if (expiresAt > now) periods.push({ expiresAt })
  }
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
