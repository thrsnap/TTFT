import mongoose from 'mongoose'
import { DAILY_PRODUCT_ID } from '../services/dailySignalTerms.js'
import { NEWS_PRODUCT_ID } from '../services/newsSignalTerms.js'

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: String, enum: [NEWS_PRODUCT_ID, DAILY_PRODUCT_ID], required: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'sent', 'skipped', 'failed'], required: true },
  nextAttemptAt: Date,
  firstAttemptAt: Date,
  message: mongoose.Schema.Types.Mixed,
  finishedAt: Date,
  providerId: String,
})

schema.index({ status: 1, nextAttemptAt: 1 })

export default mongoose.models.SignalExpiryEmail || mongoose.model('SignalExpiryEmail', schema)
