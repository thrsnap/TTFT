import Signal from '../models/signal.model.js'
import DailySignal from '../models/dailySignal.model.js'
import { historyError } from './signalHistory.service.js'
import { signalTimeZone } from './signalReleaseTime.js'
import { getSessionUserId } from './signalAccess.service.js'
import { getNewsSubscription } from './newsSignalAccess.service.js'
import { getDailySubscription } from './dailySignalAccess.service.js'

// Existing subscription services also include valid manual admin grants.
export async function getHistorySubscriptions(req) {
  const userId = await getSessionUserId(req)
  const [news, daily] = await Promise.all([
    getNewsSubscription(userId),
    getDailySubscription(userId),
  ])
  return { news, daily }
}

// Build the projection on the server. Locked content is never sent to Vue.
export function historyContentProjection(type, subscriptions, admin = false) {
  const hasAccess = admin || subscriptions?.[type]?.active === true
  return {
    hasAccess: { $literal: hasAccess },
    publicHistory: { $literal: false },
    subscriptionHistory: { $literal: true },
    ...(hasAccess ? { details: 1, news: 1, direction: 1, confirmed: 1 } : {}),
  }
}

// Convert a calendar date to the start of that day in the website timezone.
export function historyDateStart(value, zone) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw historyError('Use YYYY-MM-DD for history dates.')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getUTCFullYear() < 1900) throw historyError('Enter a valid history date from year 1900 onwards.')
  const target = date.getTime()
  let guess = target
  for (let i = 0; i < 5; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guess)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]))
    const delta = target - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    if (!delta) return new Date(guess)
    guess += delta
  }
  throw historyError('Unable to resolve this date in the configured timezone.')
}

export function historyDateRange(from, to, zone) {
  if (from !== undefined && typeof from !== 'string' || to !== undefined && typeof to !== 'string') throw historyError('Invalid date range.')
  from = from || ''; to = to || ''
  const start = from ? historyDateStart(from, zone) : null
  let end = null
  if (to) {
    historyDateStart(to, zone)
    const tomorrow = new Date(`${to}T00:00:00.000Z`)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    end = historyDateStart(tomorrow.toISOString().slice(0, 10), zone)
  }
  if (from && to && from > to) throw historyError('From date must not be after To date.')
  return { from, to, start, end }
}

export function historyStats(counts = []) {
  const values = { pending: 0, win: 0, loss: 0, breakeven: 0, cancelled: 0 }
  for (const item of counts) if (Object.hasOwn(values, item._id)) values[item._id] += item.count
  const decided = values.win + values.loss
  return {
    total: Object.values(values).reduce((sum, count) => sum + count, 0),
    wins: values.win, losses: values.loss, pending: values.pending,
    breakeven: values.breakeven, cancelled: values.cancelled,
    winRate: decided ? Math.round(values.win / decided * 10000) / 100 : null,
  }
}

// Public history must never include an active/unarchived, future or draft card.
export function publicHistoryFilter(type, id, now = new Date()) {
  return {
    ...(id ? { _id: id } : {}),
    archivedAt: { $type: 'date' },
    ...(type === 'daily' ? { status: 'published' } : {}),
    $or: [{ releasedAt: { $lte: now } }, { releasedAt: null, scheduledAt: { $lte: now } }],
  }
}

function weekPipeline(type, zone, now, content = false, options = {}) {
  const groupBy = options.groupBy || 'week'
  return [
    { $match: publicHistoryFilter(type, null, now) },
    { $project: {
      _id: 1, type: { $literal: type }, pair: 1, title: 1, newsType: 1,
      scheduledAt: 1, releasedAt: 1, archivedAt: 1, updatedAt: 1, imageUpdatedAt: 1,
      previewText: 1, outcome: { $ifNull: ['$outcome', 'pending'] }, closedAt: 1,
      historyDate: { $ifNull: ['$releasedAt', '$scheduledAt'] },
      ...(content ? {
        ...historyContentProjection(type, options.subscriptions),
        hasImage: { $cond: [{ $eq: [{ $type: '$image' }, 'binData'] }, { $gt: [{ $binarySize: '$image' }, 0] }, false] },
        // Chart bytes and internal admin notes stay excluded for everyone.
      } : {}),
    } },
    { $match: { historyDate: { $type: 'date', ...(options.range?.start ? { $gte: options.range.start } : {}), ...(options.range?.end ? { $lt: options.range.end } : {}) } } },
    { $set: { weekStart: { $dateTrunc: { date: '$historyDate', unit: groupBy, ...(groupBy === 'week' ? { startOfWeek: 'monday' } : {}), timezone: zone } } } },
  ]
}

function combinedPipeline(type, zone, now, content = false, options = {}) {
  const first = type === 'daily' ? 'daily' : 'news'
  const stages = weekPipeline(first, zone, now, content, options)
  if (type === 'all') stages.push({ $unionWith: {
    coll: DailySignal.collection.name,
    pipeline: weekPipeline('daily', zone, now, content, options),
  } })
  return stages
}

export async function getWeeklyHistory(req, res) {
  const type = req.query.type ?? 'all'
  const groupBy = req.query.groupBy ?? 'week'
  if (!['week', 'day'].includes(groupBy)) throw historyError('Choose day or week grouping.')
  const zone = signalTimeZone()
  const range = historyDateRange(req.query.from, req.query.to, zone)
  const subscriptions = await getHistorySubscriptions(req)
  const options = { groupBy, range, subscriptions }
  const page = req.query.page === undefined ? 1 : Number(req.query.page)
  const requestedCardPage = req.query.cardPage === undefined ? 1 : Number(req.query.cardPage)
  if (!['all', 'news', 'daily'].includes(type)) throw historyError('Invalid signal type.')
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw historyError('Invalid week page.')
  if (!Number.isSafeInteger(requestedCardPage) || requestedCardPage < 1 || requestedCardPage > 10000) throw historyError('Invalid card page.')
  const now = new Date()
  const Model = type === 'daily' ? DailySignal : Signal
  const base = combinedPipeline(type, zone, now, false, options)
  const [data] = await Model.aggregate([...base, { $facet: {
    weeks: [
      { $group: { _id: '$weekStart', total: { $sum: 1 } } },
      { $sort: { _id: -1 } }, { $skip: page - 1 }, { $limit: 1 },
      { $set: {
        endAt: { $dateAdd: { startDate: '$_id', unit: 'day', amount: groupBy === 'week' ? 6 : 0, timezone: zone } },
      } },
    ],
    weekCount: [{ $group: { _id: '$weekStart' } }, { $count: 'total' }],
    counts: [{ $group: { _id: '$outcome', count: { $sum: 1 } } }],
  } }]).allowDiskUse(true)
  const current = data?.weeks?.[0]
  const totalWeeks = data?.weekCount?.[0]?.total || 0
  const weeks = []
  if (current) {
    const limit = 12
    const cardPage = Math.min(requestedCardPage, Math.max(1, Math.ceil(current.total / limit)))
    const stages = combinedPipeline(type, zone, now, true, options)
    stages.push({ $match: { weekStart: current._id } }, { $facet: {
      cards: [{ $sort: { historyDate: -1, _id: -1, type: 1 } }, { $skip: (cardPage - 1) * limit }, { $limit: limit }],
      counts: [{ $group: { _id: '$outcome', count: { $sum: 1 } } }],
    } })
    const [weekData] = await Model.aggregate(stages).allowDiskUse(true)
    weeks.push({
      key: current._id.toISOString(), startsAt: current._id, endsAt: current.endAt,
      cards: weekData?.cards || [], stats: historyStats(weekData?.counts),
      pagination: { page: cardPage, limit, total: current.total, hasMore: cardPage * limit < current.total },
    })
  }
  res.json({
    weeks, stats: historyStats(data?.counts), publicHistory: false,
    subscriptionRequired: true, subscriptions, timeZone: zone,
    groupBy, range: { from: range.from, to: range.to },
    pagination: { page, limit: 1, total: totalWeeks, hasMore: page < totalWeeks },
  })
}
