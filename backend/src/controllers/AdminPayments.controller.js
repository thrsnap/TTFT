import Payment from '../models/payment.model.js'
import User from '../models/user.model.js'
import DailySignalSubscription from '../models/dailySignalSubscription.model.js'
import NewsSignalSubscription from '../models/newsSignalSubscription.model.js'
import { DAILY_PRODUCT_ID, addCalendarMonth } from '../services/dailySignalTerms.js'
import { NEWS_PRODUCT_ID, addNewsCalendarMonth } from '../services/newsSignalTerms.js'

function fail(message) {
  return Object.assign(new Error(message), { status: 400, statusCode: 400 })
}

const legacyNewsProduct = /^signal:[a-f0-9]{24}$/i
const newsProducts = { $in: [NEWS_PRODUCT_ID, legacyNewsProduct] }

function productType(productId) {
  if (productId === DAILY_PRODUCT_ID) return 'daily-signal'
  if (productId === NEWS_PRODUCT_ID || legacyNewsProduct.test(productId)) return 'news-signal'
  return typeof productId === 'string' && productId.startsWith('course:') ? 'course' : 'other'
}

// This period describes this receipt, not the user's other paid/manual periods.
function receiptPeriod(order, subscription, type, now) {
  if (order.status !== 'paid' || !['news-signal', 'daily-signal'].includes(type)) return null
  let startsAt
  let expiresAt
  let source
  if (subscription && String(subscription.userId).toLowerCase() === String(order.userId).toLowerCase()) {
    startsAt = subscription.startsAt
    expiresAt = subscription.expiresAt
    source = 'subscription'
  } else {
    // Older News receipts may predate the subscription collection.
    // Read the original paidAt; never start a new month during history reads.
    const paidTime = order.paidAt ? new Date(order.paidAt).getTime() : NaN
    if (order.currency !== 'USD' || !Number.isSafeInteger(order.amountCents) || order.amountCents < 1 || !Number.isFinite(paidTime)) return null
    startsAt = new Date(paidTime)
    expiresAt = type === 'news-signal' ? addNewsCalendarMonth(startsAt) : addCalendarMonth(startsAt)
    source = 'payment'
  }
  const start = new Date(startsAt).getTime()
  const end = new Date(expiresAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return {
    startsAt, expiresAt, source,
    active: start <= now && end > now,
    status: start > now ? 'scheduled' : end > now ? 'active' : 'expired',
  }
}

// Keep this handler on the existing authenticated, admin-only route.
export async function getAdminPayments(req, res, next) {
  try {
    const page = req.query.page === undefined ? 1 : Number(req.query.page)
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw fail('Invalid page.')
    const status = req.query.status === undefined ? 'paid' : req.query.status
    if (!['paid', 'pending', 'expired', 'all'].includes(status)) throw fail('Invalid payment status.')
    const userId = req.query.userId === undefined ? '' : req.query.userId
    if (typeof userId !== 'string' || (userId && !/^[a-f0-9]{24}$/i.test(userId))) throw fail('Enter a valid 24-character user ID.')
    const selectedType = req.query.productType === undefined ? 'all' : req.query.productType
    if (!['all', 'course', 'news-signal', 'daily-signal'].includes(selectedType)) throw fail('Invalid product type.')
    const filter = {}
    if (selectedType === 'course') filter.productId = /^course:/
    if (selectedType === 'news-signal') filter.productId = newsProducts
    if (selectedType === 'daily-signal') filter.productId = DAILY_PRODUCT_ID
    if (status !== 'all') filter.status = status
    if (userId) filter.userId = userId.toLowerCase()
    const limit = 20
    const paid = { status: 'paid' }
    const [orders, total, paidUsers, courseUsers, signalUsers, dailyUsers, totals] = await Promise.all([
      Payment.find(filter)
        .select('_id userId productId amountCents currency status paidAt createdAt expiresAt')
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Payment.countDocuments(filter),
      Payment.distinct('userId', paid),
      Payment.distinct('userId', { ...paid, productId: /^course:/ }),
      Payment.distinct('userId', { ...paid, productId: newsProducts }),
      Payment.distinct('userId', { ...paid, productId: DAILY_PRODUCT_ID }),
      Payment.aggregate([
        { $match: paid },
        { $group: { _id: null, count: { $sum: 1 }, amountCents: { $sum: '$amountCents' } } },
      ]),
    ])
    const ids = [...new Set(orders.map(order => String(order.userId).toLowerCase()))]
      .filter(id => /^[a-f0-9]{24}$/i.test(id))
    const paymentIds = type => orders.filter(order => productType(order.productId) === type && order.status === 'paid').map(order => order._id)
    const [users, dailyPeriods, newsPeriods] = await Promise.all([
      User.find({ _id: { $in: ids } }).select('_id username email').lean(),
      DailySignalSubscription.find({ paymentId: { $in: paymentIds('daily-signal') } }).select('paymentId userId startsAt expiresAt').lean(),
      NewsSignalSubscription.find({ paymentId: { $in: paymentIds('news-signal') } }).select('paymentId userId startsAt expiresAt').lean(),
    ])
    const dailyByPayment = new Map(dailyPeriods.map(period => [String(period.paymentId), period]))
    const newsByPayment = new Map(newsPeriods.map(period => [String(period.paymentId), period]))
    const usersById = new Map(users.map(user => [String(user._id).toLowerCase(), user]))
    const now = Date.now()
    res.set('Cache-Control', 'private, no-store')
    res.json({
      success: true,
      payments: orders.map(order => {
        const user = usersById.get(String(order.userId).toLowerCase())
        const type = productType(order.productId)
        const period = receiptPeriod(order, (type === 'news-signal' ? newsByPayment : dailyByPayment).get(String(order._id)), type, now)
        return {
          subscription: period,
          newsSubscription: type === 'news-signal' ? period : null,
          dailySubscription: type === 'daily-signal' ? period : null,
          subscriptionExpiresAt: period?.expiresAt ?? null,
          subscriptionActive: period?.active ?? false,
          orderId: String(order._id), userId: String(order.userId),
          name: user?.username || '', email: user?.email || '',
          productId: order.productId, productType: type,
          amount: order.amountCents / 100, currency: order.currency, status: order.status,
          paidAt: order.paidAt ?? null, createdAt: order.createdAt,
          // Existing field stays compatible. It is the QR deadline, not access expiry.
          expiresAt: order.expiresAt, qrExpiresAt: order.expiresAt,
        }
      }),
      summary: {
        totalPaidUsers: paidUsers.length, courseBuyers: courseUsers.length,
        signalBuyers: signalUsers.length, dailySignalBuyers: dailyUsers.length,
        successfulPayments: totals[0]?.count ?? 0, totalAmount: (totals[0]?.amountCents ?? 0) / 100,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) { next(error) }
}
