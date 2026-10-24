import {
  daysPipeline, entryFilter, journalError, queryOptions, readCursor,
  readEntry, readVersion, serializeEntry, summarizeDays,
} from '../services/tradeJournal.domain.js'

// Dependency injection keeps owner isolation testable without a live database.
export function makeTradeJournalHandlers({ Entry, objectId, log = console.error }) {
  const validId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
  function owner(req) {
    const id = String(req.user?._id ?? req.user?.id ?? req.session?.userId ?? '')
    if (!validId(id)) throw journalError('Please sign in.', 401)
    return objectId(id)
  }
  function tradeId(req) {
    if (!validId(req.params.id)) throw journalError('Invalid trade ID.')
    return objectId(req.params.id)
  }
  const protect = (handler) => async (req, res) => {
    res.set('Cache-Control', 'private, no-store')
    try { return await handler(req, res) }
    catch (error) {
      if (!error.status) log('Private trade journal failed:', error.message)
      const status = error.status || (error.name === 'ValidationError' ? 400 : 500)
      return res.status(status).json({ message: error.status ? error.message : status === 400 ? 'Check your trade details.' : 'Unable to process your journal. Please retry.' })
    }
  }
  async function conflictOrMissing(userId, id) {
    if (await Entry.exists({ _id: id, userId })) throw journalError('This trade changed. Refresh the journal before editing it again.', 409)
    throw journalError('Trade not found.', 404)
  }

  return {
    overview: protect(async (req, res) => {
      const userId = owner(req)
      const options = queryOptions(req.query)
      const filter = entryFilter(userId, options)
      const calendarFilter = entryFilter(userId, { ...options.calendarRange, q: options.q })
      const rangePromise = Entry.aggregate(daysPipeline(filter)).option({ maxTimeMS: 8000 }).exec()
      const calendarPromise = options.from === options.calendarRange.from && options.to === options.calendarRange.to
        ? rangePromise
        : Entry.aggregate(daysPipeline(calendarFilter)).option({ maxTimeMS: 8000 }).exec()
      const [days, calendar] = await Promise.all([rangePromise, calendarPromise])
      return res.json({ currency: 'USD', range: { from: options.from, to: options.to }, month: options.month, summary: summarizeDays(days, options.today), calendar })
    }),

    list: protect(async (req, res) => {
      const userId = owner(req)
      const options = queryOptions(req.query)
      const filter = entryFilter(userId, options)
      const cursor = readCursor(req.query.cursor)
      const requested = Number(req.query.limit ?? 20)
      if (!Number.isInteger(requested) || requested < 1 || requested > 50) throw journalError('Use a page size between 1 and 50.')
      const after = cursor ? { $or: [
        { tradeDate: { $lt: cursor.date } },
        { tradeDate: cursor.date, _id: { $lt: objectId(cursor.id) } },
      ] } : null
      const query = after ? { $and: [filter, after] } : filter
      const rows = await Entry.find(query).sort({ tradeDate: -1, _id: -1 }).limit(requested + 1).lean()
      const page = rows.slice(0, requested)
      const last = page.at(-1)
      return res.json({
        trades: page.map(serializeEntry),
        nextCursor: rows.length > requested ? Buffer.from(JSON.stringify({ date: last.tradeDate, id: String(last._id) })).toString('base64url') : null,
      })
    }),

    create: protect(async (req, res) => {
      const userId = owner(req)
      const entry = await Entry.create({ ...readEntry(req.body), userId })
      return res.status(201).json({ trade: serializeEntry(entry), message: 'Trade saved.' })
    }),

    update: protect(async (req, res) => {
      const userId = owner(req)
      const id = tradeId(req)
      const version = readVersion(req.body?.version)
      const entry = await Entry.findOneAndUpdate(
        { _id: id, userId, __v: version },
        { $set: readEntry(req.body), $inc: { __v: 1 } },
        { new: true, runValidators: true },
      ).lean()
      if (!entry) await conflictOrMissing(userId, id)
      return res.json({ trade: serializeEntry(entry), message: 'Trade updated.' })
    }),

    remove: protect(async (req, res) => {
      const userId = owner(req)
      const id = tradeId(req)
      const version = readVersion(req.query.version)
      const entry = await Entry.findOneAndDelete({ _id: id, userId, __v: version }).lean()
      if (!entry) await conflictOrMissing(userId, id)
      return res.json({ message: 'Trade deleted.' })
    }),
  }
}
