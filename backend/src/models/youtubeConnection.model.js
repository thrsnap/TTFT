import mongoose from 'mongoose'

const connectionSchema = new mongoose.Schema({
  _id: { type: String, default: 'primary' },
  channelId: { type: String, required: true },
  channelTitle: { type: String, default: '' },
  oauthClientId: { type: String, required: true },
  refreshTokenEncrypted: { type: String, required: true },
  scope: { type: String, required: true },
  connectedAt: { type: Date, required: true },
}, { timestamps: true })

const attemptSchema = new mongoose.Schema({
  inviteHash: { type: String, required: true, unique: true },
  phase: { type: String, enum: ['issued', 'authorizing', 'processing', 'connected', 'failed'], required: true },
  oauthClientId: { type: String, required: true },
  expectedChannelId: { type: String, default: null },
  stateHash: { type: String, unique: true, sparse: true },
  browserHash: String,
  verifierEncrypted: String,
  authExpiresAt: Date,
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true })

export const YoutubeOAuthAttempt = mongoose.models.YoutubeOAuthAttempt || mongoose.model('YoutubeOAuthAttempt', attemptSchema)
export default mongoose.models.YoutubeConnection || mongoose.model('YoutubeConnection', connectionSchema)
