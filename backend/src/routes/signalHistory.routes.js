import {
  getWeeklyHistory, publicHistoryFilter, getHistorySubscriptions,
  historyContentProjection,
} from '../services/signalHistoryWeeks.service.js'
import { getSessionUserId } from '../services/signalAccess.service.js'
import { getNewsSubscription } from '../services/newsSignalAccess.service.js'
import { getDailySubscription } from '../services/dailySignalAccess.service.js'
import { Router } from 'express'
import mongoose from 'mongoose'
import Signal from '../models/signal.model.js'
import DailySignal from '../models/dailySignal.model.js'
import { requireUser } from '../controllers/auth.controller.js'
import requireAdmin from '../middleware/requireAdmin.js'
import { historyError, parseResultFields } from '../services/signalHistory.service.js'
import { signalLifecycleMiddleware, startSignalLifecycle } from '../services/signalLifecycle.service.js'
import { signalTimeZone } from '../services/signalReleaseTime.js'

const router = Router()
const run = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next)
startSignalLifecycle()
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })
router.use(signalLifecycleMiddleware)

function pipeline(type, admin, subscriptions) {
  return [
    { $match: { archivedAt: { $type: 'date' }, ...(type === 'daily' ? { status: 'published' } : {}),
      ...(admin ? {} : { $or: [{ releasedAt: { $lte: new Date() } }, { releasedAt: null, scheduledAt: { $lte: new Date() } }] }),
    } },
    { $project: {
      _id: 1, pair: 1, title: 1, scheduledAt: 1, newsType: 1,
      ...historyContentProjection(type, subscriptions, admin), previewText: 1,
      closedAt: 1, archivedAt: 1, releasedAt: 1,
      archiveReason: 1, type: { $literal: type },
      outcome: { $ifNull: ['$outcome', 'pending'] },
      hasImage: { $cond: [{ $eq: [{ $type: '$image' }, 'binData'] }, { $gt: [{ $binarySize: '$image' }, 0] }, false] },
      ...(admin ? { resultNotes: 1 } : {}),
    } },
  ]
}

async function list(req, res, admin = false) {
  const type = req.query.type ?? 'all'
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const limit = req.query.limit === undefined ? 12 : Number(req.query.limit)
  if (!['all', 'news', 'daily'].includes(type)) throw historyError('Invalid signal type.')
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw historyError('Invalid page.')
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw historyError('Invalid page limit.')
  const Model = type === 'daily' ? DailySignal : Signal
  const subscriptions = admin ? null : await getHistorySubscriptions(req)
  const stages = pipeline(type === 'daily' ? 'daily' : 'news', admin, subscriptions)
  if (type === 'all') stages.push({ $unionWith: { coll: DailySignal.collection.name, pipeline: pipeline('daily', admin, subscriptions) } })
  stages.push({ $facet: {
    items: [{ $sort: { archivedAt: -1, _id: -1, type: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }],
    counts: [{ $group: { _id: '$outcome', count: { $sum: 1 } } }],
  } })
  const [data] = await Model.aggregate(stages).allowDiskUse(true)
  const counts = { pending: 0, win: 0, loss: 0, breakeven: 0, cancelled: 0 }
  for (const row of data?.counts || []) if (Object.hasOwn(counts, row._id)) counts[row._id] = row.count
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const decided = counts.win + counts.loss
  res.json({
    publicHistory: false, subscriptionRequired: true, subscriptions,
    history: data?.items || [],
    pagination: { page, limit, total, hasMore: page * limit < total },
    stats: { total, wins: counts.win, losses: counts.loss, pending: counts.pending,
      breakeven: counts.breakeven, cancelled: counts.cancelled,
      winRate: decided ? Math.round(counts.win / decided * 10000) / 100 : null },
    timeZone: signalTimeZone(),
  })
}

// Dates, outcomes and statistics are public; analysis needs its matching plan.
router.get('/weekly', run(getWeeklyHistory))
router.get('/', run((req, res) => list(req, res)))
router.get('/admin', requireUser, requireAdmin, run((req, res) => list(req, res, true)))
// Direct image URLs enforce the same subscription as the JSON endpoints.
router.get('/:type/:id/image', run(async (req, res) => {
  const Model = req.params.type === 'news' ? Signal : req.params.type === 'daily' ? DailySignal : null
  if (!Model || !mongoose.isObjectIdOrHexString(req.params.id)) throw historyError('Invalid history signal.')
  const userId = await getSessionUserId(req)
  if (!userId) throw historyError('Please log in to view historical charts.', 401)
  const subscription = req.params.type === 'news'
    ? await getNewsSubscription(userId)
    : await getDailySubscription(userId)
  if (!subscription.active) throw historyError(`An active ${req.params.type === 'news' ? 'News' : 'Daily'} Signal subscription is required.`, 403)
  const record = await Model.findOne(publicHistoryFilter(req.params.type, req.params.id)).select('+image')
  if (!record || !record.image?.length) throw historyError('Historical chart unavailable.', 404)
  res.set('X-Content-Type-Options', 'nosniff').type('image/webp').send(record.image)
}))
router.patch('/:type/:id/result', requireUser, requireAdmin, run(async (req, res) => {
  if (req.get('X-CMM-Request') !== '1') throw historyError('Request not allowed.', 403)
  const Model = req.params.type === 'news' ? Signal : req.params.type === 'daily' ? DailySignal : null
  if (!Model || !mongoose.isObjectIdOrHexString(req.params.id)) throw historyError('Invalid signal.')
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['outcome', 'closedAt', 'resultNotes'].includes(key))) {
    throw historyError('Only outcome, closedAt and resultNotes can be updated.')
  }
  const fields = parseResultFields(body)
  if (!Object.keys(fields).length) throw historyError('Choose a result.')
  if (fields.outcome === 'pending') fields.closedAt = null
  else if (fields.outcome && !Object.hasOwn(fields, 'closedAt')) fields.closedAt = new Date()
  const signal = await Model.findOneAndUpdate(
    { _id: req.params.id, archivedAt: { $type: 'date' } }, { $set: fields },
    { new: true, runValidators: true },
  ).select('_id outcome closedAt resultNotes archivedAt')
  if (!signal) throw historyError('Archived signal not found.', 404)
  res.json({ message: 'Signal result saved.', signal })
}))
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  const status = ['ValidationError', 'CastError'].includes(error.name) ? 400 : error.status
  if (status >= 400 && status < 500) return res.status(status).json({ message: error.message })
  next(error)
})
export default router
