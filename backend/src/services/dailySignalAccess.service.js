import mongoose from 'mongoose'
import DailySignalSubscription from '../models/dailySignalSubscription.model.js'
import DailySignalGrant from '../models/dailySignalGrant.model.js'
import { DAILY_PRODUCT_ID, addCalendarMonth } from './dailySignalTerms.js'

export async function getDailySubscription(userId) {
  if (!mongoose.isObjectIdOrHexString(userId)) return { active: false, expiresAt: null }
  const now = new Date()
  const filter = { userId, startsAt: { $lte: now }, expiresAt: { $gt: now } }
  const periods = await Promise.all([
    DailySignalSubscription.findOne(filter).sort({ expiresAt: -1 }).lean(),
    DailySignalGrant.findOne(filter).lean(),
  ])
  const subscription = periods.filter(Boolean).sort((a, b) => new Date(b.expiresAt) - new Date(a.expiresAt))[0]
  return { active: Boolean(subscription), expiresAt: subscription?.expiresAt ?? null }
}

export async function fulfillDailyPayment(payment) {
  if (payment.productId !== DAILY_PRODUCT_ID || payment.status !== 'paid') return {}
  if (payment.currency !== 'USD' || (!Number.isSafeInteger(payment.amountCents) || payment.amountCents < 1) || !payment.paidAt) {
    throw new Error('Invalid Daily Signal payment receipt')
  }
  const filter = { paymentId: payment._id }
  try {
    await DailySignalSubscription.updateOne(filter, {
      $setOnInsert: {
        paymentId: payment._id,
        userId: payment.userId,
        startsAt: payment.paidAt,
        expiresAt: addCalendarMonth(payment.paidAt),
      },
    }, { upsert: true, runValidators: true })
  } catch (error) {
    if (error.code !== 11000 || !(await DailySignalSubscription.exists(filter))) throw error
  }
  const subscription = await getDailySubscription(payment.userId)
  return {
    accessGranted: subscription.active,
    subscriptionActive: subscription.active,
    subscriptionExpiresAt: subscription.expiresAt,
  }
}
