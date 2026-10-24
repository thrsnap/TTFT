import mongoose from 'mongoose'
import Entry from '../models/tradeJournalEntry.model.js'
import { makeTradeJournalHandlers } from './tradeJournal.handlers.js'

export const { overview, list, create, update, remove } = makeTradeJournalHandlers({
  Entry,
  // Mongoose does not cast aggregate pipeline IDs automatically.
  objectId: (value) => new mongoose.Types.ObjectId(value),
})
