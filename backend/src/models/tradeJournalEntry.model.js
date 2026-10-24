
import mongoose from 'mongoose'
import { EMOTIONS, MAX_PNL_CENTS, validDate } from '../services/tradeJournal.domain.js'

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  tradeDate: { type: String, required: true, validate: { validator: validDate, message: 'Invalid trade date.' } },
  symbol: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
  side: { type: String, enum: ['buy', 'sell'], required: true },
  pnlCents: { type: Number, required: true, min: -MAX_PNL_CENTS, max: MAX_PNL_CENTS, validate: Number.isSafeInteger },
  currency: { type: String, enum: ['USD'], default: 'USD', required: true },
  emotion: { type: String, enum: EMOTIONS, default: '' },
  strategy: { type: String, trim: true, maxlength: 120, default: '' },
  notes: { type: String, trim: true, maxlength: 3000, default: '' },
}, { timestamps: true, strict: 'throw' })

schema.index({ userId: 1, tradeDate: -1, _id: -1 })

export default mongoose.models.TradeJournalEntry || mongoose.model('TradeJournalEntry', schema)
