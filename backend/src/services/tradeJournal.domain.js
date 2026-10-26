export const EMOTIONS = ['', 'calm', 'confident', 'focused', 'neutral', 'anxious', 'frustrated', 'impulsive']
export const POSITIVE_EMOTIONS = ['calm', 'confident', 'focused']
export const MAX_PNL_CENTS = 1_000_000_000

export function journalError(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() >= 1900 && date.toISOString().slice(0, 10) === value
}

export function monthRange(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || !validDate(`${value}-01`)) {
    throw journalError('Use YYYY-MM for the calendar month.')
  }
  const [year, month] = value.split('-').map(Number)
  return { from: `${value}-01`, to: `${value}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` }
}

function shortText(value, name, max, required = false) {
  if (value == null && !required) return ''
  if (typeof value !== 'string') throw journalError(`${name} must be text.`)
  const text = value.trim()
  if ((required && !text) || text.length > max) throw journalError(`${name} must contain ${required ? '1' : '0'}–${max} characters.`)
  return text
}

export function parsePnl(value) {
  if (!['string', 'number'].includes(typeof value)) throw journalError('Enter net P&L with up to two decimal places.')
  const text = String(value).trim()
  if (!/^[+-]?(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(text)) throw journalError('Enter net P&L with up to two decimal places.')
  const [whole, fraction = ''] = text.replace(/^[+-]/, '').split('.')
  const cents = (text.startsWith('-') ? -1 : 1) * (Number(whole) * 100 + Number(fraction.padEnd(2, '0')))
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_PNL_CENTS) throw journalError('Net P&L must be between −10,000,000 and 10,000,000 USD.')
  return cents === 0 ? 0 : cents
}

export function readEntry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw journalError('Send a trade object.')
  if (!validDate(body.tradeDate)) throw journalError('Enter a valid trade date as YYYY-MM-DD.')
  if (!['buy', 'sell'].includes(body.side)) throw journalError('Choose Buy or Sell.')
  const emotion = body.emotion ?? ''
  if (!EMOTIONS.includes(emotion)) throw journalError('Choose a supported emotion.')
  return {
    tradeDate: body.tradeDate,
    symbol: shortText(body.symbol, 'Trading pair', 30, true).toUpperCase(),
    side: body.side,
    pnlCents: parsePnl(body.pnl),
    currency: 'USD',
    emotion,
    strategy: shortText(body.strategy, 'Setup', 120),
    notes: shortText(body.notes, 'Notes', 3000),
  }
}

export function readJournalDetails(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw journalError('Send a journal object.')
  return {
    name: shortText(body.name, 'Journal name', 80, true),
    broker: shortText(body.broker, 'Broker', 80),
    accountLabel: shortText(body.accountLabel, 'Account label', 80),
  }
}

export function serializeJournal(journal) {
  return {
    _id: journal.isDefault ? 'default' : String(journal._id),
    name: journal.name,
    broker: journal.broker || '',
    accountLabel: journal.accountLabel || '',
    isDefault: Boolean(journal.isDefault),
    version: journal.__v ?? 0,
  }
}

export function readVersion(value) {
  const text = String(value ?? '')
  if (!/^\d{1,10}$/.test(text) || !Number.isSafeInteger(Number(text))) throw journalError('Refresh the journal before editing this trade.')
  return Number(text)
}

export function queryOptions(query, defaultMonth = new Date().toISOString().slice(0, 7)) {
  const month = query.month ?? defaultMonth
  const calendarRange = monthRange(month)
  const all = query.all === '1'
  const from = all ? null : (query.from ?? calendarRange.from)
  const to = all ? null : (query.to ?? calendarRange.to)
  if ((from !== null && !validDate(from)) || (to !== null && !validDate(to)) || (from && to && from > to)) {
    throw journalError('Enter a valid date range.')
  }
  const q = shortText(query.q ?? '', 'Search', 80)
  const today = query.today ?? new Date().toISOString().slice(0, 10)
  if (!validDate(today)) throw journalError('Enter a valid local date.')
  return { month, calendarRange, from, to, q, today }
}

export function entryFilter(userId, { from, to, q }) {
  const filter = { userId }
  if (from || to) filter.tradeDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) }
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = ['symbol', 'strategy', 'notes'].map((key) => ({ [key]: { $regex: escaped, $options: 'i' } }))
  }
  return filter
}

export function daysPipeline(filter) {
  const countIf = (condition) => ({ $sum: { $cond: [condition, 1, 0] } })
  return [
    { $match: filter },
    { $group: {
      _id: '$tradeDate',
      pnlCents: { $sum: '$pnlCents' },
      tradeCount: { $sum: 1 },
      wins: countIf({ $gt: ['$pnlCents', 0] }),
      losses: countIf({ $lt: ['$pnlCents', 0] }),
      breakeven: countIf({ $eq: ['$pnlCents', 0] }),
      tagged: countIf({ $ne: ['$emotion', ''] }),
      positive: countIf({ $in: ['$emotion', POSITIVE_EMOTIONS] }),
      grossProfitCents: { $sum: { $cond: [{ $gt: ['$pnlCents', 0] }, '$pnlCents', 0] } },
      grossLossCents: { $sum: { $cond: [{ $lt: ['$pnlCents', 0] }, { $abs: '$pnlCents' }, 0] } },
    } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', pnlCents: 1, tradeCount: 1, wins: 1, losses: 1, breakeven: 1, tagged: 1, positive: 1, grossProfitCents: 1, grossLossCents: 1 } },
  ]
}

function previousDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export function summarizeDays(days, today) {
  const summary = { pnlCents: 0, tradeCount: 0, wins: 0, losses: 0, breakeven: 0, tagged: 0, positive: 0, grossProfitCents: 0, grossLossCents: 0 }
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date))
  let run = 0
  let longestStreak = 0
  let previous = null
  for (const day of ordered) {
    for (const key of Object.keys(summary)) summary[key] += Number(day[key]) || 0
    run = previous && previousDate(day.date) === previous ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    previous = day.date
  }
  const dates = new Set(ordered.map((day) => day.date))
  let cursor = dates.has(today) ? today : previousDate(today)
  let currentStreak = 0
  while (dates.has(cursor)) { currentStreak++; cursor = previousDate(cursor) }
  const decided = summary.wins + summary.losses
  return {
    ...summary,
    activeDays: ordered.length,
    currentStreak,
    longestStreak,
    winRate: decided ? summary.wins / decided * 100 : null,
    positiveRate: summary.tagged ? summary.positive / summary.tagged * 100 : null,
    averageCents: summary.tradeCount ? Math.sign(summary.pnlCents) * Math.round(Math.abs(summary.pnlCents) / summary.tradeCount) : 0,
    days: ordered,
  }
}

export function readCursor(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || value.length > 160 || !/^[A-Za-z0-9_-]+$/.test(value)) throw journalError('Invalid page cursor.')
  try {
    const data = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!validDate(data.date) || typeof data.id !== 'string' || !/^[a-f\d]{24}$/i.test(data.id)) throw new Error()
    return data
  } catch { throw journalError('Invalid page cursor.') }
}

export function serializeEntry(entry) {
  return {
    _id: String(entry._id),
    journalId: entry.journalId == null ? 'default' : String(entry.journalId),
    tradeDate: entry.tradeDate,
    symbol: entry.symbol,
    side: entry.side,
    pnlCents: entry.pnlCents,
    currency: 'USD',
    emotion: entry.emotion,
    strategy: entry.strategy,
    notes: entry.notes,
    version: entry.__v ?? 0,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}
