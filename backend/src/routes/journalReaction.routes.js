import express from 'express'
import mongoose from 'mongoose'
import JournalReaction, { JOURNAL_REACTION_TYPES } from '../models/journalReaction.model.js'

const isId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
const objectId = (value) => new mongoose.Types.ObjectId(String(value))
const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res)).catch(next)
}

// Pass the SAME post model and sign-in middleware used by your journal routes.
// No changes to your existing journal schema or post responses are required.
export function createJournalReactionRouter({ Journal, requireUser, Reaction = JournalReaction }) {
  if (!Journal || typeof requireUser !== 'function') {
    throw new Error(
      'Journal reactions require the existing Journal model and requireUser middleware.',
    )
  }

  const router = express.Router()
  let indexReady
  function ensureUniqueIndex() {
    if (!indexReady) {
      indexReady = Reaction.collection
        .createIndex({ postId: 1, userId: 1 }, { unique: true, name: 'journal_reaction_per_user' })
        .catch((error) => {
          indexReady = undefined
          throw error
        })
    }
    return indexReady
  }

  function member(req, res, next) {
    const value = req.user?._id ?? req.user?.id ?? req.session?.userId
    if (!isId(String(value ?? ''))) {
      return res.status(401).json({ message: 'Please sign in to react.' })
    }
    res.locals.reactionUserId = objectId(value)
    res.set('Cache-Control', 'no-store')
    next()
  }

  async function summaries(ids, userId) {
    const rows = await Reaction.aggregate([
      { $match: { postId: { $in: ids } } },
      {
        $group: {
          _id: '$postId',
          ...Object.fromEntries(
            JOURNAL_REACTION_TYPES.map((type) => [
              `${type}Count`,
              { $sum: { $cond: [{ $eq: ['$type', type] }, 1, 0] } },
            ]),
          ),
          myReaction: {
            $max: { $cond: [{ $eq: ['$userId', userId] }, '$type', null] },
          },
        },
      },
    ])
    const byId = new Map(rows.map((row) => [String(row._id), row]))
    return ids.map((id) => {
      const row = byId.get(String(id))
      return {
        postId: String(id),
        ...Object.fromEntries(
          JOURNAL_REACTION_TYPES.map((type) => [`${type}Count`, row?.[`${type}Count`] ?? 0]),
        ),
        myReaction: row?.myReaction ?? null,
      }
    })
  }

  router.get(
    '/',
    requireUser,
    member,
    asyncRoute(async (req, res) => {
      if (typeof req.query.ids !== 'string') {
        return res.status(400).json({ message: 'Provide comma-separated journal post IDs.' })
      }
      const values = req.query.ids.split(',')
      if (!values.length || values.length > 50 || !values.every(isId)) {
        return res.status(400).json({ message: 'Provide between 1 and 50 valid journal post IDs.' })
      }
      const ids = [...new Set(values.map((value) => value.toLowerCase()))].map(objectId)
      const existing = await Journal.find({ _id: { $in: ids } })
        .select('_id')
        .lean()
      const allowed = new Set(existing.map((post) => String(post._id)))
      const visibleIds = ids.filter((id) => allowed.has(String(id)))
      res.json({ reactions: await summaries(visibleIds, res.locals.reactionUserId) })
    }),
  )

  router.put(
    '/:postId',
    requireUser,
    member,
    express.json({ limit: '2kb' }),
    asyncRoute(async (req, res) => {
      if (req.get('X-CMM-Request') !== '1') {
        return res.status(403).json({ message: 'Request not allowed.' })
      }
      if (!isId(req.params.postId)) {
        return res.status(400).json({ message: 'Invalid journal post ID.' })
      }
      const type = req.body?.type
      if (type !== null && !JOURNAL_REACTION_TYPES.includes(type)) {
        return res.status(400).json({ message: 'Choose like, love, wow, laugh, cry, or null.' })
      }
      const postId = objectId(req.params.postId)
      if (!(await Journal.exists({ _id: postId }))) {
        return res.status(404).json({ message: 'This trade no longer exists.' })
      }
      await ensureUniqueIndex()
      const filter = { postId, userId: res.locals.reactionUserId }
      if (type === null) {
        await Reaction.deleteOne(filter)
      } else {
        // Desired state rather than a toggle: replaying a request cannot add votes.
        try {
          await Reaction.updateOne(
            filter,
            { $set: { type } },
            { upsert: true, runValidators: true },
          )
        } catch (error) {
          if (error.code !== 11000) throw error
          // Two first-time requests can race; the unique index keeps one record.
          await Reaction.updateOne(filter, { $set: { type } }, { runValidators: true })
        }
      }
      const [reaction] = await summaries([postId], res.locals.reactionUserId)
      res.json({ reaction })
    }),
  )

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    const status = error.status === 400 ? 400 : error.status === 413 ? 413 : 500
    if (status === 500) console.error('Journal reaction request failed:', error.name)
    res.status(status).json({
      message:
        status === 400
          ? 'Invalid reaction JSON.'
          : status === 413
            ? 'Reaction request is too large.'
            : 'Unable to update reactions. Please try again.',
    })
  })

  return router
}
