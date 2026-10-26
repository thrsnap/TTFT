import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import PushSubscription from '../models/pushSubscription.model.js'
import {
  getEndpointHash,
  getPushConfiguration,
  normalizePushSubscription,
  pushError,
  sendPushNotification,
} from '../services/push.service.js'

const router = Router()
const TEST_INTERVAL_MS = 60000

const asyncRoute = handler => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)

// app.js also applies requireUser before this router.
router.use((req, res, next) => {
  const userId = String(req.user?._id || req.user?.id || '')
  if (!/^[a-f\d]{24}$/i.test(userId)) {
    return next(pushError(401, 'Please sign in to use push notifications.'))
  }
  req.pushUserId = userId
  return next()
})

router.get('/public-key', asyncRoute(async (req, res) => {
  const { publicKey } = getPushConfiguration()
  return res.json({ publicKey })
}))

router.post('/status', asyncRoute(async (req, res) => {
  const { publicKey } = getPushConfiguration()
  const endpointHash = getEndpointHash(req.body?.endpoint)
  const record = await PushSubscription.exists({
    userId: req.pushUserId,
    endpointHash,
    vapidPublicKey: publicKey,
    $or: [
      { expirationTime: null },
      { expirationTime: { $gt: new Date() } },
    ],
  })
  return res.json({ enabled: Boolean(record) })
}))

router.post('/subscribe', asyncRoute(async (req, res) => {
  const { publicKey } = getPushConfiguration()
  const subscription = normalizePushSubscription(req.body?.subscription)
  const filter = {
    userId: req.pushUserId,
    endpointHash: subscription.endpointHash,
  }
  const update = {
    $set: {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      expirationTime: subscription.expirationTime,
      vapidPublicKey: publicKey,
      bindingVersion: randomUUID(),
    },
    $setOnInsert: {
      userId: req.pushUserId,
      endpointHash: subscription.endpointHash,
    },
  }

  try {
    await PushSubscription.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    })
  } catch (error) {
    if (error.code !== 11000) throw error

    // A simultaneous save for the same owner can race the unique index.
    const owned = await PushSubscription.findOneAndUpdate(filter, update, {
      returnDocument: 'after',
      runValidators: true,
    })
    if (!owned) {
      throw pushError(
        409,
        'This browser subscription belongs to another account. Reset this browser subscription and enable notifications again.',
      )
    }
  }

  return res.status(201).json({ enabled: true, message: 'Notifications enabled for this device.' })
}))

router.delete('/subscribe', asyncRoute(async (req, res) => {
  const endpointHash = getEndpointHash(req.body?.endpoint)
  await PushSubscription.deleteOne({
    userId: req.pushUserId,
    endpointHash,
  })
  return res.status(204).end()
}))

router.post('/test', asyncRoute(async (req, res) => {
  getPushConfiguration()
  const endpointHash = getEndpointHash(req.body?.endpoint)
  const now = new Date()

  // Claim the test atomically so simultaneous clicks cannot bypass the limit.
  const subscription = await PushSubscription.findOneAndUpdate(
    {
      userId: req.pushUserId,
      endpointHash,
      $or: [
        { lastTestAt: null },
        { lastTestAt: { $lte: new Date(now.getTime() - TEST_INTERVAL_MS) } },
      ],
    },
    { $set: { lastTestAt: now } },
    { returnDocument: 'after' },
  ).select('+endpoint +keys')

  if (!subscription) {
    const owned = await PushSubscription.exists({
      userId: req.pushUserId,
      endpointHash,
    })
    if (!owned) {
      throw pushError(404, 'Enable notifications on this device first.')
    }
    res.set('Retry-After', '60')
    throw pushError(429, 'Wait one minute before sending another test notification.')
  }

  try {
    await sendPushNotification(subscription, {
      title: 'CMM-FT',
      body: 'Push notifications are enabled on this device.',
      url: '/',
      tag: 'cmm-ft-push-test',
    })
  } catch (error) {
    if (error.code === 'PUSH_EXPIRED') {
      // Preserve a subscription that was refreshed while this send was pending.
      await PushSubscription.deleteOne({
        _id: subscription._id,
        userId: req.pushUserId,
        endpointHash,
        bindingVersion: subscription.bindingVersion,
      })
    }
    throw error
  }

  return res.status(202).json({
    message: 'Test notification accepted by the push service.',
  })
}))

export default router
