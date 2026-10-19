import mongoose from 'mongoose'
import { SIGNAL_OUTCOMES } from '../models/signalHistoryFields.js'

export function historyError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

export function parseResultFields(body = {}) {
  const data = {}
  if (Object.hasOwn(body, 'outcome')) {
    if (!SIGNAL_OUTCOMES.includes(body.outcome)) {
      throw historyError('Result must be pending, win, loss, breakeven or cancelled.')
    }
    data.outcome = body.outcome
  }
  if (Object.hasOwn(body, 'closedAt')) {
    if (body.closedAt === null || body.closedAt === '') {
      data.closedAt = null
    } else {
      if (typeof body.closedAt !== 'string' || !Number.isFinite(new Date(body.closedAt).getTime())) {
        throw historyError('Enter a valid result date.')
      }
      data.closedAt = new Date(body.closedAt)
    }
  }
  if (Object.hasOwn(body, 'resultNotes')) {
    if (typeof body.resultNotes !== 'string' || body.resultNotes.length > 2000) {
      throw historyError('Result notes must be text up to 2000 characters.')
    }
    data.resultNotes = body.resultNotes.trim()
  }
  return data
}

// One atomic update keeps the original ID, chart and access references intact.
// A repeated archive request does not change the original archive timestamp.
export async function archiveSignal(Model, id, actorId) {
  const archivedBy = mongoose.isObjectIdOrHexString(actorId) ? actorId : null
  const signal = await Model.findOneAndUpdate(
    { _id: id, archivedAt: null },
    { $set: { archivedAt: new Date(), archivedBy } },
    { new: true, runValidators: true },
  ).select('_id archivedAt outcome')

  if (signal) return signal

  const existing = await Model.findById(id).select('_id archivedAt outcome')
  if (!existing) throw historyError('Signal not found.', 404)
  return existing
}
