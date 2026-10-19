import mongoose from 'mongoose'
import addSignalHistoryFields from './signalHistoryFields.js'

const schema = new mongoose.Schema({
  pair: { type: String, required: true, uppercase: true, trim: true, maxlength: 30 },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  scheduledAt: { type: Date, required: true },
  direction: { type: String, enum: ['pending', 'buy', 'sell'], default: 'pending' },
  confirmed: { type: Boolean, default: false },
  details: { type: String, default: '', maxlength: 20000, select: false },
  previewText: {
    type: String,
    default: 'Subscribe to view the daily chart and trading analysis.',
    maxlength: 500,
  },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  image: { type: Buffer, select: false },
  preview: { type: Buffer, select: false },
  imageUpdatedAt: Date,
}, { timestamps: true })

addSignalHistoryFields(schema)
schema.index({ status: 1, scheduledAt: -1 })

export default mongoose.models.DailySignal || mongoose.model('DailySignal', schema)
