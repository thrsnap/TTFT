import { Router } from 'express'

import multer from 'multer'

import sharp from 'sharp'

import DailySignal from '../models/dailySignal.model.js'

import { sendSignalReleasedAlert } from '../services/telegram.service.js'
import {
  queueSignalPushAlert,
  signalPushState,
  startSignalPushDelivery,
} from '../services/signalPush.service.js'

import { requireUser } from '../controllers/auth.controller.js'

import requireAdmin from '../middleware/requireAdmin.js'

import {

  getSessionUserId,
} from '../services/signalAccess.service.js'

import {

  getDailySubscription,
} from '../services/dailySignalAccess.service.js'

import {

  DAILY_AMOUNT_CENTS,

  DAILY_PRODUCT_ID,
} from '../services/dailySignalTerms.js'

import {

  archiveSignal,

  parseResultFields,
} from '../services/signalHistory.service.js'

import {

  signalLifecycleMiddleware,

  startSignalLifecycle,
} from '../services/signalLifecycle.service.js'

const router = Router()

startSignalLifecycle()
startSignalPushDelivery()
// Move overdue cards into history before returning active cards.
router.use(signalLifecycleMiddleware)

const run = fn => (req, res, next) =>

  Promise.resolve()
    .then(() => fn(req, res, next))
    .catch(next)

function fail(message, status = 400) {

  const error = new Error(message)

  error.status = status

  throw error
}

const upload = multer({

  storage: multer.memoryStorage(),

  limits: {

    fileSize: 2 * 1024 * 1024,

    files: 1,

    fields: 15,

    fieldSize: 22000,
  },

  fileFilter(req, file, callback) {

    const allowed = [

      'image/jpeg',

      'image/png',

      'image/webp',

    ]

    if (!allowed.includes(file.mimetype)) {

      const error = new Error(

        'Use a JPG, PNG or WebP image.',
      )

      error.status = 400

      return callback(error)
    }

    callback(null, true)
  },
})

router.use((req, res, next) => {

  res.set('Cache-Control', 'private, no-store')

  next()
})

function hasBytes(value) {

  return Boolean(value && value.length > 0)
}

function released(signal) {

  return (

    hasBytes(signal.image) &&

    typeof signal.details === 'string' &&

    signal.details.trim().length > 0
  )
}
// Match the same release rule used by the website's isReleased field.
function isPublishedRelease(signal) {

  return Boolean(

    signal &&

    signal.status === 'published' &&

    !signal.archivedAt &&

    released(signal)
  )
}

async function alertDailyRelease(signal, wasReleased = false) {
  if (process.env.TELEGRAM_ALERT_DEBUG === '1') {
    console.log('Daily Signal release check:', {
      signalId: String(signal._id),
      status: signal.status,
      wasReleased,
      hasImage: hasBytes(signal.image),
      hasDetails: Boolean(signal.details?.trim()),
      archived: Boolean(signal.archivedAt),
      releasedAt: signal.releasedAt || null,
      tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
      channelConfigured: Boolean(process.env.TELEGRAM_CHANNEL_ID?.trim()),
    })
  }
  if (wasReleased || !isPublishedRelease(signal)) return

  // Delivery errors must not fail an already saved signal.
  try {
    const messageId = await sendSignalReleasedAlert(signal, 'Daily Signal')
    if (process.env.TELEGRAM_ALERT_DEBUG === '1') {
      console.log('Daily Signal Telegram result:', {
        signalId: String(signal._id),
        messageId,
      })
    }
  } catch (error) {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const message = String(error?.message || 'Unknown notification error')
    console.error('Telegram Daily Signal notification failed:',
      token ? message.split(token).join('[redacted]') : message)
  }
}

function result(signal, access = false) {

  const data = {

    _id: String(signal._id),

    pair: signal.pair,

    title: signal.title,

    scheduledAt: signal.scheduledAt,

    previewText: signal.previewText,

    hasAccess: access,

    hasImage: hasBytes(signal.image),

    isReleased: released(signal),

    imageUpdatedAt: signal.imageUpdatedAt,

    updatedAt: signal.updatedAt,

    releasedAt: signal.releasedAt || null,

    autoArchiveAt: signal.autoArchiveAt || null,
  }

  if (access) {

    Object.assign(data, {

      details: signal.details || '',

      direction: signal.direction,

      confirmed: signal.confirmed,
    })
  }

  return data
}

function fields(body = {}) {

  const allowed = [

    'pair',

    'title',

    'scheduledAt',

    'direction',

    'confirmed',

    'details',

    'previewText',

    'status',

    'outcome',

    'closedAt',

    'resultNotes',

  ]

  if (

    Object.keys(body).some(

      key => !allowed.includes(key),
    )
  ) {

    fail('Unsupported Daily Signal fields.')
  }

  const data = {}

  for (const key of allowed) {

    if (!Object.hasOwn(body, key)) continue

    if (

      ['outcome', 'closedAt', 'resultNotes'].includes(key)
    ) {

      Object.assign(

        data,

        parseResultFields({ [key]: body[key] }),
      )
    } else if (key === 'confirmed') {

      if (

        ![true, false, 'true', 'false'].includes(body[key])
      ) {

        fail('Invalid confirmation value.')
      }

      data[key] =

        body[key] === true ||

        body[key] === 'true'
    } else {

      if (typeof body[key] !== 'string') {

        fail(`${key} must be text.`)
      }

      data[key] = body[key].trim()
    }
  }

  if (data.scheduledAt !== undefined) {

    if (

      !data.scheduledAt ||

      !Number.isFinite(

        new Date(data.scheduledAt).getTime(),
      )
    ) {

      fail('Enter a valid signal date.')
    }

    data.scheduledAt = new Date(data.scheduledAt)
  }

  return data
}

async function imageFields(file) {

  if (!file) return {}

  try {

    const pipeline = sharp(file.buffer, {

      limitInputPixels: 20000000,
    })

    const metadata = await pipeline.metadata()

    if (

      !['jpeg', 'png', 'webp'].includes(metadata.format) ||

      (metadata.pages || 1) > 1
    ) {

      fail('Unsupported image.')
    }

    const image = await pipeline
      .rotate()
      .resize({

        width: 1600,

        height: 1200,

        fit: 'inside',

        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer()

    const preview = await sharp(image)
      .resize({ width: 64 })
      .blur(10)
      .webp({ quality: 40 })
      .toBuffer()

    return {

      image,

      preview,

      imageUpdatedAt: new Date(),
    }
  } catch {

    fail(

      'Invalid image. Use a JPG, PNG or WebP under 2 MB.',
    )
  }
}

function validateConfirmation(signal) {

  if (

    signal.confirmed &&

    !['buy', 'sell'].includes(signal.direction)
  ) {

    fail('Choose BUY or SELL before confirming.')
  }
}

function validId(value) {

  if (!/^[a-f0-9]{24}$/i.test(value)) {

    fail('Invalid Daily Signal ID.')
  }

  return value
}
// Active public cards only.// Full details require an active Daily subscription.
router.get(

  '/',

  run(async (req, res) => {

    const userId = await getSessionUserId(req)

    const subscription = await getDailySubscription(

      userId,
    )

    const signals = await DailySignal.find({

      status: 'published',

      archivedAt: null,
    })
      .select('+image +details')
      .sort({

        scheduledAt: -1,

        _id: -1,
      })
      .limit(50)

    res.json({

      signals: signals.map(signal =>

        result(signal, subscription.active),
      ),

      subscription,

      plan: {

        productId: DAILY_PRODUCT_ID,

        amount: DAILY_AMOUNT_CENTS / 100,

        currency: 'USD',

        interval: 'month',
      },
    })
  }),
)
// Protect all admin endpoints.
router.use(

  '/admin',

  requireUser,

  requireAdmin,
)

router.use('/admin', (req, res, next) => {

  if (

    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&

    req.get('X-CMM-Request') !== '1'
  ) {

    return res.status(403).json({

      message: 'Request not allowed.',
    })
  }

  next()
})
// Admin active/draft list.// Archived cards are managed in the history panel.
router.get(

  '/admin',

  run(async (req, res) => {

    const signals = await DailySignal.find({

      archivedAt: null,
    })
      .select('+image +details')
      .sort({ scheduledAt: -1 })
      .limit(200)

    res.json({

      signals: signals.map(signal => ({
        ...result(signal, true),

        status: signal.status,

        outcome: signal.outcome || 'pending',

        closedAt: signal.closedAt,

        resultNotes: signal.resultNotes || '',
      })),
    })
  }),
)
// Create a new Daily Signal.
router.post(

  '/admin',

  upload.single('image'),

  run(async (req, res) => {

    const data = fields(req.body)

    validateConfirmation(data)

    const images = await imageFields(req.file)

    const signal = await DailySignal.create({
      ...data,
      ...images,
    })

    await queueSignalPushAlert(signal, 'daily')
    await alertDailyRelease(signal)

    res.status(201).json({

      message: 'Daily Signal created.',

      signalId: String(signal._id),
    })
  }),
)
// Edit an active or draft card.// Explicitly select image/details so release tracking works.
router.patch(

  '/admin/:id',

  upload.single('image'),

  run(async (req, res) => {

    const signal = await DailySignal.findOne({

      _id: validId(req.params.id),

      archivedAt: null,
    }).select('+image +details')

    if (!signal) {

      fail('Daily Signal not found.', 404)
    }

    const data = fields(req.body)

    const images = await imageFields(req.file)

    const wasReleased = isPublishedRelease(signal)
    const previousPushState = signalPushState(signal, 'daily')

    Object.assign(signal, data, images)

    validateConfirmation(signal)

    await signal.save()

    await queueSignalPushAlert(signal, 'daily', previousPushState)
    await alertDailyRelease(signal, wasReleased)

    res.json({

      message: 'Daily Signal updated.',
    })
  }),
)
// Delete from Active means move to History.// Never permanently delete the signal document here.
router.delete(

  '/admin/:id',

  run(async (req, res) => {

    const signal = await archiveSignal(

      DailySignal,

      validId(req.params.id),

      req.user?._id ?? req.session?.userId,
    )

    res.json({

      message:

        'Daily Signal moved to history. Subscriptions remain active.',

      signalId: String(signal._id),

      archivedAt: signal.archivedAt,

      outcome: signal.outcome || 'pending',
    })
  }),
)
// Admin chart access.
router.get(

  '/admin/:id/image',

  run(async (req, res) => {

    const signal = await DailySignal.findById(

      validId(req.params.id),
    ).select('+image')

    if (!hasBytes(signal?.image)) {

      fail('Chart unavailable.', 404)
    }

    res.set('X-Content-Type-Options', 'nosniff')

    res.type('image/webp').send(signal.image)
  }),
)
// Public blurred preview for published cards.
router.get(

  '/:id/preview',

  run(async (req, res) => {

    const signal = await DailySignal.findOne({

      _id: validId(req.params.id),

      status: 'published',
    }).select('+preview')

    if (!hasBytes(signal?.preview)) {

      fail('Preview unavailable.', 404)
    }

    res.set('X-Content-Type-Options', 'nosniff')

    res.type('image/webp').send(signal.preview)
  }),
)
// Existing subscriber chart endpoint.// Public archived charts use the separate history endpoint.
router.get(

  '/:id/image',

  run(async (req, res) => {

    const userId = await getSessionUserId(req)

    const subscription = await getDailySubscription(

      userId,
    )

    if (!subscription.active) {

      fail(

        'An active Daily Signal subscription is required.',

        403,
      )
    }

    const signal = await DailySignal.findOne({

      _id: validId(req.params.id),

      status: 'published',
    }).select('+image')

    if (!hasBytes(signal?.image)) {

      fail('Chart unavailable.', 404)
    }

    res.set('X-Content-Type-Options', 'nosniff')

    res.type('image/webp').send(signal.image)
  }),
)
// Route and upload errors.
router.use((error, req, res, next) => {

  if (res.headersSent) {

    return next(error)
  }

  if (

    error instanceof multer.MulterError ||

    error.name === 'ValidationError' ||

    error.name === 'CastError'
  ) {

    return res.status(400).json({

      message: error.message,
    })
  }

  if (

    error.status >= 400 &&

    error.status < 500
  ) {

    return res.status(error.status).json({

      message: error.message,
    })
  }

  next(error)
})

export default router
