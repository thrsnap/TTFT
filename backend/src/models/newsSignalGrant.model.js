import mongoose from 'mongoose'

// Manual admin access is separate from paid subscription receipts.
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  // Revoking a legacy grant must not allow its old timestamp to unlock again.
  legacyRevokedAt: { type: Date, default: null },
}, { timestamps: true })

export default mongoose.models.NewsSignalGrant || mongoose.model('NewsSignalGrant', schema)
