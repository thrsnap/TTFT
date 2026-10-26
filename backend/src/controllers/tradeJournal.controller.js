import mongoose from 'mongoose'
import Entry from '../models/tradeJournalEntry.model.js'
import Journal from '../models/tradeJournalBook.model.js'
import { makeTradeJournalHandlers } from './tradeJournal.handlers.js'

export const { overview, list, create, update, remove, listJournals, createJournal, updateJournal } = makeTradeJournalHandlers({
  Entry,
  Journal,
  // Mongoose does not cast aggregate pipeline IDs automatically.
  objectId: (value) => new mongoose.Types.ObjectId(value),
})
