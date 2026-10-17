import mongoose from 'mongoose'

// Manual admin approval is access, not a paid receipt.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true })

export default mongoose.models.DailySignalGrant || mongoose.model('DailySignalGrant', schema)
