import mongoose from 'mongoose'

// One immutable period per verified payment. Keep expired receipts for history.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true })

schema.index({ userId: 1, expiresAt: -1 })

export default mongoose.models.NewsSignalSubscription ||
  mongoose.model('NewsSignalSubscription', schema)
