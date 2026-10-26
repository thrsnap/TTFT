import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  // A stable event ID prevents duplicate alerts from edits or concurrent requests.
  _id: { type: String, required: true },
  signalId: { type: mongoose.Schema.Types.ObjectId, required: true },
  kind: { type: String, enum: ['news', 'daily'], required: true },
  event: { type: String, enum: ['published', 'released'], required: true },
  state: { type: String, enum: ['queued', 'processing', 'complete', 'skipped'], default: 'queued' },
  nextAttemptAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  leaseUntil: { type: Date, default: null },
  leaseToken: { type: String, default: null },
  attempts: { type: Number, default: 0 },
}, { timestamps: true })

schema.index({ state: 1, nextAttemptAt: 1, leaseUntil: 1 })

export default mongoose.models.SignalPushEvent || mongoose.model('SignalPushEvent', schema)
