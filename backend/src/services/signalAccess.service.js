import mongoose from 'mongoose'
import User from '../models/user.model.js'
import { getNewsSubscription } from './newsSignalAccess.service.js'

export async function getSessionUserId(req) {
  const sessionId = req.session?.userId
  const authenticatedId = req.user?._id ?? req.user?.id
  const userId = mongoose.isObjectIdOrHexString(sessionId) ? sessionId : authenticatedId
  if (!mongoose.isObjectIdOrHexString(userId)) return null
  if (mongoose.isObjectIdOrHexString(sessionId) &&
      mongoose.isObjectIdOrHexString(authenticatedId) &&
      String(sessionId) !== String(authenticatedId)) return null
  const user = await User.findById(userId).select('_id').lean()
  return user ? user._id : null
}

// Keep this function name/signature for current chart routes and imports.
export async function hasSignalAccess(userId, signalId) {
  if (!mongoose.isObjectIdOrHexString(userId) || !mongoose.isObjectIdOrHexString(signalId)) return false
  return (await getNewsSubscription(userId)).active
}
