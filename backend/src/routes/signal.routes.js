import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import mongoose from 'mongoose'

import Signal from '../models/signal.model.js'
import { sendSignalReleasedAlert } from '../services/telegram.service.js'
import NewsSignalGrant from '../models/newsSignalGrant.model.js'
import User from '../models/user.model.js'

import requireAdmin from '../middleware/requireAdmin.js'
import { requireUser } from '../controllers/auth.controller.js'

import {
  getSessionUserId,
  hasSignalAccess,
} from '../services/signalAccess.service.js'

import {
  getNewsSubscription,
} from '../services/newsSignalAccess.service.js'

import {
  NEWS_PRODUCT_ID,
  NEWS_AMOUNT_CENTS,
  addNewsCalendarMonth,
} from '../services/newsSignalTerms.js'

import {
  archiveSignal,
  parseResultFields,
} from '../services/signalHistory.service.js'

import {
  signalLifecycleMiddleware,
  startSignalLifecycle,
} from '../services/signalLifecycle.service.js'

const router = Router()

// Start the periodic rollover check.
// Repeated calls from other routers do not create duplicate timers.
startSignalLifecycle()

// Archive overdue cards before returning active signals.
router.use(signalLifecycleMiddleware)

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
    fields: 15,
    fieldSize: 20000,
  },

  fileFilter(req, file, callback) {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowed.includes(file.mimetype)) {
      const error = new Error(
        'Use a JPG, PNG, or WebP image.',
      )

      error.status = 400
      return callback(error)
    }

    callback(null, true)
  },
})

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

function parseConfirmed(value) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false

  throw badRequest('confirmed must be true or false.')
}

function parseDate(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(
      'A valid date and time are required.',
    )
  }

  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    throw badRequest('Invalid date and time.')
  }

  return date
}

function parseFields(body = {}) {
  const allowed = [
    'pair',
    'title',
    'scheduledAt',
    'newsType',
    'direction',
    'confirmed',
    'details',
    'news',
    'previewText',
    'outcome',
    'closedAt',
    'resultNotes',
  ]

  const unknown = Object.keys(body).filter(
    key => !allowed.includes(key),
  )

  if (unknown.length) {
    throw badRequest(
      `Unknown fields: ${unknown.join(', ')}`,
    )
  }

  const fields = {}

  for (const key of allowed) {
    if (!Object.hasOwn(body, key)) continue

    if (
      ['outcome', 'closedAt', 'resultNotes'].includes(key)
    ) {
      Object.assign(
        fields,
        parseResultFields({ [key]: body[key] }),
      )
    } else if (key === 'confirmed') {
      fields.confirmed = parseConfirmed(body[key])
    } else if (key === 'scheduledAt') {
      fields.scheduledAt = parseDate(body[key])
    } else {
      if (typeof body[key] !== 'string') {
        throw badRequest(`${key} must be text.`)
      }

      fields[key] = body[key].trim()
    }
  }

  if (fields.direction) {
    fields.direction = fields.direction.toLowerCase()
  }

  return fields
}

function validateConfirmation(direction, confirmed) {
  if (
    confirmed &&
    !['buy', 'sell'].includes(direction)
  ) {
    throw badRequest(
      'A confirmed signal must have direction buy or sell.',
    )
  }
}

// Supports Mongoose Buffers and BSON Binary from lean queries.
function imageByteLength(value) {
  if (!value) return 0

  if (Buffer.isBuffer(value)) {
    return value.length
  }

  if (ArrayBuffer.isView(value)) {
    return value.byteLength
  }

  if (
    value._bsontype === 'Binary' &&
    typeof value.length === 'function'
  ) {
    return value.length()
  }

  return 0
}

function isSignalReleased(signal) {
  return (
    imageByteLength(signal.image) > 0 &&
    typeof signal.details === 'string' &&
    signal.details.trim().length > 0
  )
}

// News cards have no draft status in this route; active image + details
// is the same release rule used in the public API.
async function alertNewsRelease(signal, wasReleased = false) {
  if (process.env.TELEGRAM_ALERT_DEBUG === '1') {
    console.log('News Signal release check:', {
      signalId: String(signal._id),
      wasReleased,
      hasImage: imageByteLength(signal.image) > 0,
      hasDetails: Boolean(signal.details?.trim()),
      archived: Boolean(signal.archivedAt),
      releasedAt: signal.releasedAt || null,
      tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
      channelConfigured: Boolean(process.env.TELEGRAM_CHANNEL_ID?.trim()),
    })
  }
  if (wasReleased || signal.archivedAt || !isSignalReleased(signal)) return

  try {
    const messageId = await sendSignalReleasedAlert(signal, 'News Signal')
    if (process.env.TELEGRAM_ALERT_DEBUG === '1') {
      console.log('News Signal Telegram result:', { signalId: String(signal._id), messageId })
    }
  } catch (error) {
    // Print diagnostic text without exposing a token in a nested error message.
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const message = String(error?.message || 'Unknown notification error')
    console.error('Telegram News Signal notification failed:',
      token ? message.split(token).join('[redacted]') : message)
  }
}

async function processSignalImage(file) {
  try {
    const options = {
      limitInputPixels: 20000000,
    }

    const metadata = await sharp(
      file.buffer,
      options,
    ).metadata()

    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format) ||
      (metadata.pages || 1) > 1
    ) {
      throw new Error('Unsupported image')
    }

    const image = await sharp(file.buffer, options)
      .rotate()
      .resize({
        width: 1600,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer()

    if (image.length > 5 * 1024 * 1024) {
      throw new Error('Processed image is too large')
    }

    const preview = await sharp(image)
      .resize({ width: 64 })
      .blur(10)
      .webp({ quality: 40 })
      .toBuffer()

    return { image, preview }
  } catch {
    throw badRequest(
      'Invalid or unsupported image file.',
    )
  }
}

router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store')
  next()
})

// Create an upcoming or released News Signal.
router.post(
  '/',
  requireUser,
  requireAdmin,
  upload.single('image'),
  async (req, res, next) => {
    try {
      const fields = parseFields(req.body)

      validateConfirmation(
        fields.direction || 'pending',
        fields.confirmed || false,
      )

      const images = req.file
        ? await processSignalImage(req.file)
        : {}

      const signal = await Signal.create({
        ...fields,
        ...images,
      })

      await alertNewsRelease(signal)

      res.status(201).json({
        message: 'Signal created successfully.',
        signalId: signal._id,
        isReleased: isSignalReleased(signal),
      })
    } catch (error) {
      next(error)
    }
  },
)

// Public subscription status and monthly price.
router.get('/subscription', async (req, res, next) => {
  try {
    const userId = await getSessionUserId(req)
    const subscription = await getNewsSubscription(userId)

    res.json({
      subscription,
      plan: {
        productId: NEWS_PRODUCT_ID,
        amount: NEWS_AMOUNT_CENTS / 100,
        currency: 'USD',
        interval: 'month',
      },
    })
  } catch (error) {
    next(error)
  }
})

async function registeredUser(body = {}) {
  let user

  if (body.userId != null && body.userId !== '') {
    if (!mongoose.isObjectIdOrHexString(body.userId)) {
      throw badRequest('Invalid registered user ID.')
    }

    user = await User.findById(body.userId)
      .select('_id email')
      .lean()
  } else {
    const email = typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : ''

    if (!email) {
      throw badRequest(
        'A registered user email is required.',
      )
    }

    user = await User.findOne({ email })
      .select('_id email')
      .lean()
  }

  if (!user) {
    throw badRequest('No matching registered account.')
  }

  return user
}

// Admin: grant one calendar month of access to all News Signals.
router.post(
  '/subscription',
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (req.get('X-CMM-Request') !== '1') {
        return res.status(403).json({
          message: 'Request not allowed.',
        })
      }

      const user = await registeredUser(req.body)
      const startsAt = new Date()

      await NewsSignalGrant.updateOne(
        { userId: user._id },
        {
          $set: {
            userId: user._id,
            grantedBy:
              req.user?._id ?? req.session?.userId,
            startsAt,
            expiresAt: addNewsCalendarMonth(startsAt),
          },
        },
        {
          upsert: true,
          runValidators: true,
        },
      )

      res.json({
        message:
          'One month of access to all News Signals granted.',
        userId: user._id,
        subscription: await getNewsSubscription(user._id),
      })
    } catch (error) {
      next(error)
    }
  },
)

// Admin: revoke manual and legacy access.
// Existing paid monthly periods remain unchanged.
router.delete(
  '/subscription',
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (req.get('X-CMM-Request') !== '1') {
        return res.status(403).json({
          message: 'Request not allowed.',
        })
      }

      const user = await registeredUser(req.body)
      const now = new Date()

      await NewsSignalGrant.updateOne(
        { userId: user._id },
        {
          $set: {
            userId: user._id,
            grantedBy:
              req.user?._id ?? req.session?.userId,
            startsAt: now,
            expiresAt: now,
            legacyRevokedAt: now,
          },
        },
        {
          upsert: true,
          runValidators: true,
        },
      )

      res.json({
        message:
          'Manual and legacy News access revoked. Paid monthly periods are unchanged.',
        userId: user._id,
        subscription: await getNewsSubscription(user._id),
      })
    } catch (error) {
      next(error)
    }
  },
)

// Admin: inspect a registered user's News subscription.
router.get(
  '/subscription/:userId',
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (
        !mongoose.isObjectIdOrHexString(req.params.userId)
      ) {
        throw badRequest('Invalid user ID.')
      }

      const exists = await User.exists({
        _id: req.params.userId,
      })

      if (!exists) {
        throw badRequest(
          'Registered user does not exist.',
        )
      }

      res.json({
        userId: req.params.userId,
        subscription: await getNewsSubscription(
          req.params.userId,
        ),
      })
    } catch (error) {
      next(error)
    }
  },
)

// Old per-card grant endpoints are replaced by monthly access.
router.post(
  '/access',
  requireUser,
  requireAdmin,
  (req, res) => {
    res.status(409).json({
      message:
        'Individual News grants have been replaced. Use POST /api/signals/subscription.',
    })
  },
)

router.delete(
  '/access',
  requireUser,
  requireAdmin,
  (req, res) => {
    res.status(409).json({
      message:
        'Use DELETE /api/signals/subscription to revoke manual monthly News access.',
    })
  },
)

// Compatibility response for existing admin access lookups.
router.get(
  '/access/:userId',
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const user = await registeredUser({
        userId: req.params.userId,
      })

      const subscription = await getNewsSubscription(
        user._id,
      )

      const records = await Signal.find({
        archivedAt: null,
      })
        .select('_id title pair scheduledAt newsType')
        .sort({ scheduledAt: -1 })
        .lean()

      const availableSignals = records.map(record => ({
        ...record,
        id: String(record._id),
      }))

      res.json({
        subscription,
        availableSignals,
        signals: subscription.active
          ? availableSignals
          : [],
      })
    } catch (error) {
      next(error)
    }
  },
)

// Active public cards.
// Direction and full details are only returned with active access.
router.get('/', async (req, res, next) => {
  try {
    const userId = await getSessionUserId(req)

    const records = await Signal.find({
      archivedAt: null,
    })
      .select('+image +details')
      .sort({ scheduledAt: -1 })
      .limit(50)
      .lean()

    const subscription = await getNewsSubscription(userId)

    const signals = records.map(record => {
      const hasAccess = subscription.active

      const result = {
        _id: record._id,
        pair: record.pair,
        title: record.title,
        scheduledAt: record.scheduledAt,
        newsType: record.newsType,
        previewText: record.previewText,
        hasAccess,
        hasImage: imageByteLength(record.image) > 0,
        isReleased: isSignalReleased(record),
        updatedAt: record.updatedAt,
        releasedAt: record.releasedAt || null,
        autoArchiveAt: record.autoArchiveAt || null,
      }

      if (hasAccess) {
        result.direction = record.direction
        result.confirmed = record.confirmed
        result.details = record.details || ''
        result.news = record.news || ''
      }

      return result
    })

    res.json({
      signals,
      subscription,
      plan: {
        productId: NEWS_PRODUCT_ID,
        amount: NEWS_AMOUNT_CENTS / 100,
        currency: 'USD',
        interval: 'month',
      },
    })
  } catch (error) {
    next(error)
  }
})

// Admin active-card list.
router.get(
  '/admin',
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const records = await Signal.find({
        archivedAt: null,
      })
        .select('+image +details')
        .sort({ scheduledAt: -1 })
        .limit(200)
        .lean()

      const signals = records.map(record => {
        const {
          image,
          preview,
          ...fields
        } = record

        return {
          ...fields,
          hasImage: imageByteLength(image) > 0,
          isReleased: isSignalReleased(record),
        }
      })

      res.json({ signals })
    } catch (error) {
      next(error)
    }
  },
)

// Subscriber dashboard: all active News cards.
router.get(
  '/my',
  requireUser,
  async (req, res, next) => {
    try {
      const userId = await getSessionUserId(req)
      const subscription = await getNewsSubscription(userId)

      if (!subscription.active) {
        return res.json({
          signals: [],
          subscription,
        })
      }

      const records = await Signal.find({
        archivedAt: null,
      })
        .select('+image +details')
        .sort({ scheduledAt: -1, _id: -1 })
        .limit(200)

      res.json({
        subscription,
        signals: records.map(signal => ({
          _id: String(signal._id),
          pair: signal.pair,
          title: signal.title,
          scheduledAt: signal.scheduledAt,
          newsType: signal.newsType,
          direction: signal.direction,
          confirmed: signal.confirmed,
          details: signal.details || '',
          news: signal.news || '',
          hasAccess: true,
          hasImage: imageByteLength(signal.image) > 0,
          isReleased: isSignalReleased(signal),
          updatedAt: signal.updatedAt,
        })),
      })
    } catch (error) {
      next(error)
    }
  },
)

// Validate individual signal IDs.
router.use('/:id', (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({
      message: 'Invalid signal ID.',
    })
  }

  next()
})

// Public blurred preview, including archived cards.
router.get('/:id/preview', async (req, res, next) => {
  try {
    const signal = await Signal.findById(req.params.id)
      .select('+preview')

    if (!signal) {
      return res.status(404).json({
        message: 'Signal not found.',
      })
    }

    if (imageByteLength(signal.preview) === 0) {
      return res.status(404).json({
        message: 'Preview has not been uploaded yet.',
      })
    }

    res.set('X-Content-Type-Options', 'nosniff')
    res.type('image/webp').send(signal.preview)
  } catch (error) {
    next(error)
  }
})

// Full charts, including archived cards, require monthly access.
router.get('/:id/image', async (req, res, next) => {
  try {
    const userId = await getSessionUserId(req)

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in.',
      })
    }

    const allowed = await hasSignalAccess(
      userId,
      req.params.id,
    )

    if (!allowed) {
      return res.status(403).json({
        message:
          'An active News Signal subscription is required.',
      })
    }

    const signal = await Signal.findById(req.params.id)
      .select('+image')

    if (!signal) {
      return res.status(404).json({
        message: 'Signal not found.',
      })
    }

    if (imageByteLength(signal.image) === 0) {
      return res.status(404).json({
        message: 'Chart has not been uploaded yet.',
      })
    }

    res.set('X-Content-Type-Options', 'nosniff')
    res.type('image/webp').send(signal.image)
  } catch (error) {
    next(error)
  }
})

// Edit an active signal and optionally replace its chart.
router.patch(
  '/:id',
  requireUser,
  requireAdmin,
  upload.single('image'),
  async (req, res, next) => {
    try {
      const fields = parseFields(req.body)

      if (!Object.keys(fields).length && !req.file) {
        throw badRequest('No update fields provided.')
      }

      const signal = await Signal.findOne({
        _id: req.params.id,
        archivedAt: null,
      }).select('+image +details')

      if (!signal) {
        return res.status(404).json({
          message: 'Signal not found.',
        })
      }

      const wasReleased = isSignalReleased(signal)

      Object.assign(signal, fields)

      validateConfirmation(
        signal.direction,
        signal.confirmed,
      )

      if (req.file) {
        const images = await processSignalImage(req.file)
        Object.assign(signal, images)
      }

      await signal.save()

      await alertNewsRelease(signal, wasReleased)

      res.json({
        message: 'Signal updated successfully.',
        isReleased: isSignalReleased(signal),
      })
    } catch (error) {
      next(error)
    }
  },
)

// Archive instead of permanently deleting.
router.delete(
  '/:id',
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const signal = await archiveSignal(
        Signal,
        req.params.id,
        req.user?._id ?? req.session?.userId,
      )

      res.json({
        message:
          'Signal moved to history. Existing access records were preserved.',
        signalId: String(signal._id),
        archivedAt: signal.archivedAt,
        outcome: signal.outcome || 'pending',
      })
    } catch (error) {
      next(error)
    }
  },
)

// Route and upload errors.
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error)

  const status =
    error instanceof multer.MulterError ||
    error.name === 'ValidationError' ||
    error.name === 'CastError'
      ? 400
      : error.status || 500

  if (status === 500) {
    console.error(
      'Signal API failed:',
      error.stack || error,
    )
  }

  res.status(status).json({
    message:
      status === 500
        ? 'Unable to process signal request.'
        : error.message,
  })
})

export default router