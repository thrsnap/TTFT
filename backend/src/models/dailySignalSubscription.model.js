import mongoose from 'mongoose'

// A payment produces one immutable access period; repeated checks cannot renew it.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true })

schema.index({ userId: 1, expiresAt: -1 })
// No TTL index: retain access and payment history after expiry.
export default mongoose.models.DailySignalSubscription ||
  mongoose.model('DailySignalSubscription', schema)
