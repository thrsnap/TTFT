import {
  daysPipeline,
  entryFilter,
  journalError,
  queryOptions,
  readCursor,
  readEntry,
  readJournalDetails,
  readVersion,
  serializeEntry,
  serializeJournal,
  summarizeDays,
} from '../services/tradeJournal.domain.js'

export function makeTradeJournalHandlers({
  Entry,
  Journal,
  objectId,
  log = console.error,
}) {
  const validId = (id) =>
    typeof id === 'string' &&
    /^[a-f\d]{24}$/i.test(id)

  function owner(req) {
    const id = String(
      req.user?._id ??
      req.user?.id ??
      req.session?.userId ??
      '',
    )

    if (!validId(id)) {
      throw journalError('Please sign in.', 401)
    }

    return objectId(id)
  }

  function tradeId(req) {
    if (!validId(req.params.id)) {
      throw journalError('Invalid trade ID.')
    }

    return objectId(req.params.id)
  }

  const protect = (handler) => async (req, res) => {
    res.set('Cache-Control', 'private, no-store')

    try {
      return await handler(req, res)
    } catch (error) {
      if (!error.status) {
        log('Private trade journal failed:', error.message)
      }

      const status =
        error.status ||
        (error.name === 'ValidationError' ? 400 : 500)

      return res.status(status).json({
        message: error.status
          ? error.message
          : status === 400
            ? 'Check your trade details.'
            : 'Unable to process your journal. Please retry.',
      })
    }
  }

  async function journalScope(raw = 'default', userId) {
    if (raw === 'default') return null

    if (!validId(raw)) {
      throw journalError('Choose a valid journal.')
    }

    if (!Journal) {
      throw journalError(
        'Journal management is not configured.',
        503,
      )
    }

    const id = objectId(raw)

    const exists = await Journal.exists({
      _id: id,
      userId,
      isDefault: false,
    })

    if (!exists) {
      throw journalError('Journal not found.', 404)
    }

    return id
  }

  let defaultIndexReady

  async function defaultJournal(userId) {
    if (!Journal) {
      throw journalError(
        'Journal management is not configured.',
        503,
      )
    }

    const filter = {
      userId,
      isDefault: true,
    }

    const existing = await Journal.findOne(filter).lean()

    if (existing) return existing

    if (!defaultIndexReady) {
      defaultIndexReady = Journal.collection
        .createIndex(
          { userId: 1 },
          {
            unique: true,
            name: 'one_default_trade_journal_per_user',
            partialFilterExpression: {
              isDefault: true,
            },
          },
        )
        .catch((error) => {
          defaultIndexReady = undefined
          throw error
        })
    }

    await defaultIndexReady

    try {
      return await Journal.findOneAndUpdate(
        filter,
        {
          $setOnInsert: {
            userId,
            isDefault: true,
            name: 'Main journal',
            broker: '',
            accountLabel: '',
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      ).lean()
    } catch (error) {
      if (error.code !== 11000) throw error

      const created = await Journal.findOne(filter).lean()

      if (!created) throw error

      return created
    }
  }

  async function conflictOrMissing(userId, id, journalId) {
    const exists = await Entry.exists({
      _id: id,
      userId,
      journalId,
    })

    if (exists) {
      throw journalError(
        'This trade changed. Refresh the journal before editing it again.',
        409,
      )
    }

    throw journalError('Trade not found.', 404)
  }

  return {
    listJournals: protect(async (req, res) => {
      const userId = owner(req)

      await defaultJournal(userId)

      const rows = await Journal.find({ userId })
        .sort({
          isDefault: -1,
          createdAt: 1,
          _id: 1,
        })
        .lean()

      return res.json({
        journals: rows.map(serializeJournal),
      })
    }),

    createJournal: protect(async (req, res) => {
      const userId = owner(req)
      const details = readJournalDetails(req.body)

      await defaultJournal(userId)

      const journal = await Journal.create({
        ...details,
        userId,
        isDefault: false,
      })

      return res.status(201).json({
        journal: serializeJournal(journal),
        message: 'Journal created.',
      })
    }),

    updateJournal: protect(async (req, res) => {
      const userId = owner(req)
      const details = readJournalDetails(req.body)
      const version = readVersion(req.body?.version)
      const raw = req.params.journalId

      if (raw !== 'default' && !validId(raw)) {
        throw journalError('Choose a valid journal.')
      }

      if (!Journal) {
        throw journalError(
          'Journal management is not configured.',
          503,
        )
      }

      const id =
        raw === 'default'
          ? (await defaultJournal(userId))._id
          : objectId(raw)

      const journal = await Journal.findOneAndUpdate(
        {
          _id: id,
          userId,
          __v: version,
        },
        {
          $set: details,
          $inc: { __v: 1 },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      ).lean()

      if (!journal) {
        const exists = await Journal.exists({
          _id: id,
          userId,
        })

        if (exists) {
          throw journalError(
            'This journal changed. Refresh before editing it again.',
            409,
          )
        }

        throw journalError('Journal not found.', 404)
      }

      return res.json({
        journal: serializeJournal(journal),
        message: 'Journal updated.',
      })
    }),

    overview: protect(async (req, res) => {
      const userId = owner(req)

      const journalId = await journalScope(
        req.query.journalId,
        userId,
      )

      const options = queryOptions(req.query)

      const filter = {
        ...entryFilter(userId, options),
        journalId,
      }

      const calendarFilter = {
        ...entryFilter(userId, {
          ...options.calendarRange,
          q: options.q,
        }),
        journalId,
      }

      const rangePromise = Entry.aggregate(
        daysPipeline(filter),
      )
        .option({ maxTimeMS: 8000 })
        .exec()

      const calendarPromise =
        options.from === options.calendarRange.from &&
        options.to === options.calendarRange.to
          ? rangePromise
          : Entry.aggregate(daysPipeline(calendarFilter))
              .option({ maxTimeMS: 8000 })
              .exec()

      const [days, calendar] = await Promise.all([
        rangePromise,
        calendarPromise,
      ])

      return res.json({
        currency: 'USD',
        range: {
          from: options.from,
          to: options.to,
        },
        month: options.month,
        summary: summarizeDays(days, options.today),
        calendar,
      })
    }),

    list: protect(async (req, res) => {
      const userId = owner(req)

      const journalId = await journalScope(
        req.query.journalId,
        userId,
      )

      const options = queryOptions(req.query)

      const filter = {
        ...entryFilter(userId, options),
        journalId,
      }

      const cursor = readCursor(req.query.cursor)
      const requested = Number(req.query.limit ?? 20)

      if (
        !Number.isInteger(requested) ||
        requested < 1 ||
        requested > 50
      ) {
        throw journalError(
          'Use a page size between 1 and 50.',
        )
      }

      const after = cursor
        ? {
            $or: [
              {
                tradeDate: { $lt: cursor.date },
              },
              {
                tradeDate: cursor.date,
                _id: { $lt: objectId(cursor.id) },
              },
            ],
          }
        : null

      const query = after
        ? { $and: [filter, after] }
        : filter

      const rows = await Entry.find(query)
        .sort({
          tradeDate: -1,
          _id: -1,
        })
        .limit(requested + 1)
        .lean()

      const page = rows.slice(0, requested)
      const last = page.at(-1)

      return res.json({
        trades: page.map(serializeEntry),

        nextCursor:
          rows.length > requested
            ? Buffer.from(
                JSON.stringify({
                  date: last.tradeDate,
                  id: String(last._id),
                }),
              ).toString('base64url')
            : null,
      })
    }),

    create: protect(async (req, res) => {
      const userId = owner(req)
      const details = readEntry(req.body)

      const journalId = await journalScope(
        req.body.journalId,
        userId,
      )

      const entry = await Entry.create({
        ...details,
        userId,
        journalId,
      })

      return res.status(201).json({
        trade: serializeEntry(entry),
        message: 'Trade saved.',
      })
    }),

    update: protect(async (req, res) => {
      const userId = owner(req)
      const id = tradeId(req)

      const journalId = await journalScope(
        req.query.journalId,
        userId,
      )

      const version = readVersion(req.body?.version)

      const entry = await Entry.findOneAndUpdate(
        {
          _id: id,
          userId,
          journalId,
          __v: version,
        },
        {
          $set: readEntry(req.body),
          $inc: { __v: 1 },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      ).lean()

      if (!entry) {
        await conflictOrMissing(userId, id, journalId)
      }

      return res.json({
        trade: serializeEntry(entry),
        message: 'Trade updated.',
      })
    }),

    remove: protect(async (req, res) => {
      const userId = owner(req)
      const id = tradeId(req)

      const journalId = await journalScope(
        req.query.journalId,
        userId,
      )

      const version = readVersion(req.query.version)

      const entry = await Entry.findOneAndDelete({
        _id: id,
        userId,
        journalId,
        __v: version,
      }).lean()

      if (!entry) {
        await conflictOrMissing(userId, id, journalId)
      }

      return res.json({
        message: 'Trade deleted.',
      })
    }),
  }
}