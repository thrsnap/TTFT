import YoutubeConnection, { YoutubeOAuthAttempt } from '../models/youtubeConnection.model.js'
import { createYoutubeOAuthService } from './youtubeOAuth.service.js'

const repository = {
  readConnection: () => YoutubeConnection.findById('primary').lean(),
  createAttempt: data => YoutubeOAuthAttempt.create(data),
  claimInvite: (inviteHash, now, updates) => YoutubeOAuthAttempt.findOneAndUpdate(
    { inviteHash, phase: 'issued', expiresAt: { $gt: now } }, { $set: updates }, { returnDocument: 'after' },
  ).lean(),
  takeState: (stateHash, browserHash, now) => YoutubeOAuthAttempt.findOneAndUpdate(
    { stateHash, browserHash, phase: 'authorizing', expiresAt: { $gt: now }, authExpiresAt: { $gt: now } },
    { $set: { phase: 'processing' } }, { returnDocument: 'after' },
  ).lean(),
  saveConnection: data => YoutubeConnection.findOneAndUpdate(
    { _id: 'primary' }, { $set: data }, { upsert: true, returnDocument: 'after', runValidators: true },
  ),
  markAttempt: (_id, phase) => YoutubeOAuthAttempt.updateOne({ _id }, {
    $set: { phase }, $unset: { verifierEncrypted: 1, browserHash: 1 },
  }),
}

export const youtubeOAuth = createYoutubeOAuthService({ repository })
