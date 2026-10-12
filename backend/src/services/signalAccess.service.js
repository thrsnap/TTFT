import mongoose from 'mongoose'
import User from '../models/user.model.js'
import SignalAccess from '../models/signalAccess.model.js'

export async function getSessionUserId(req) {
  // Match this field to your existing login controller.
  const userId = req.session?.userId

  if (!mongoose.isObjectIdOrHexString(userId)) {
    return null
  }

  const user = await User.findById(userId).select('_id').lean()

  return user ? user._id : null
}

export async function hasSignalAccess(userId, signalId) {
  if (!userId) return false

  const access = await SignalAccess.exists({
    userId,
    expiresAt: { $gt: new Date() },
    $or: [
      { signalId: null },
      { signalId },
    ],
  })

  return Boolean(access)
}