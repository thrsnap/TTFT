import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import mongoose from 'mongoose'

import Signal from '../models/signal.model.js'
import SignalAccess from '../models/signalAccess.model.js'
import User from '../models/user.model.js'
import requireAdmin from '../middleware/requireAdmin.js'
import { requireUser } from '../controllers/auth.controller.js'

import {
  getSessionUserId,
  hasSignalAccess,
} from '../services/signalAccess.service.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
    fields: 12,
    fieldSize: 20000,
  },

  fileFilter(req, file, callback) {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowed.includes(file.mimetype)) {
      const error = new Error('Use a JPG, PNG, or WebP image.')
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
    throw badRequest('A valid date and time are required.')
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
  ]

  const unknown = Object.keys(body).filter(
    key => !allowed.includes(key),
  )

  if (unknown.length) {
    throw badRequest(`Unknown fields: ${unknown.join(', ')}`)
  }

  const fields = {}

  for (const key of allowed) {
    if (!Object.hasOwn(body, key)) continue

    if (key === 'confirmed') {
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
  if (confirmed && !['buy', 'sell'].includes(direction)) {
    throw badRequest(
      'A confirmed signal must have direction buy or sell.',
    )
  }
}

// Handles Mongoose Buffers and BSON Binary from lean queries.
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
    throw badRequest('Invalid or unsupported image file.')
  }
}

router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store')
  next()
})

// Create a signal. Image and details are optional.
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

// Grant subscription or individual signal access.
router.post(
  '/access',
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const {
        userId,
        signalId = null,
        expiresAt,
      } = req.body || {}

      if (!mongoose.isObjectIdOrHexString(userId)) {
        throw badRequest('Invalid user ID.')
      }

      if (
        signalId !== null &&
        !mongoose.isObjectIdOrHexString(signalId)
      ) {
        throw badRequest('Invalid signal ID.')
      }

      const expiry = parseDate(expiresAt)

      if (expiry <= new Date()) {
        throw badRequest('Expiry must be in the future.')
      }

      if (!(await User.exists({ _id: userId }))) {
        throw badRequest('User does not exist.')
      }

      if (
        signalId !== null &&
        !(await Signal.exists({ _id: signalId }))
      ) {
        throw badRequest('Signal does not exist.')
      }

      await SignalAccess.updateOne(
        { userId, signalId },
        { $set: { expiresAt: expiry } },
        { upsert: true, runValidators: true },
      )

      res.json({
        message: 'Signal access approved.',
      })
    } catch (error) {
      next(error)
    }
  },
)

// Public listing with protected details.
router.get('/', async (req, res, next) => {
  try {
    const userId = await getSessionUserId(req)

    const records = await Signal.find()
      .select('+image +details')
      .sort({ scheduledAt: -1 })
      .limit(50)
      .lean()

    const grants = userId
      ? await SignalAccess.find({
          userId,
          expiresAt: { $gt: new Date() },
        }).lean()
      : []

    const subscribed = grants.some(
      grant => grant.signalId === null,
    )

    const purchasedIds = new Set(
      grants
        .filter(grant => grant.signalId)
        .map(grant => String(grant.signalId)),
    )

    const signals = records.map(record => {
      const hasAccess =
        subscribed || purchasedIds.has(String(record._id))

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
      }

      if (hasAccess) {
        result.direction = record.direction
        result.confirmed = record.confirmed
        result.details = record.details || ''
        result.news = record.news || ''
      }

      return result
    })

    res.json({ signals })
  } catch (error) {
    next(error)
  }
})

// Admin listing; image bytes are not included in the response.
router.get(
  '/admin',
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const records = await Signal.find()
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

// Validate individual signal IDs.
router.use('/:id', (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({
      message: 'Invalid signal ID.',
    })
  }

  next()
})

// Public blurred preview.
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

// Full image requires subscription or individual access.
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
        message: 'Subscription or purchase required.',
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

// Edit details and optionally upload or replace an image.
// Accepts JSON for text-only edits and multipart for image uploads.
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

      const signal = await Signal.findById(req.params.id)
        .select('+image')

      if (!signal) {
        return res.status(404).json({
          message: 'Signal not found.',
        })
      }

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

      res.json({
        message: 'Signal updated successfully.',
        isReleased: isSignalReleased(signal),
      })
    } catch (error) {
      next(error)
    }
  },
)

// Delete a signal and its access records.
router.delete(
  '/:id',
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const signal = await Signal.findByIdAndDelete(
        req.params.id,
      )

      if (!signal) {
        return res.status(404).json({
          message: 'Signal not found.',
        })
      }

      await SignalAccess.deleteMany({
        signalId: req.params.id,
      })

      res.json({
        message: 'Signal deleted successfully.',
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
    console.error('Signal API failed:', error.message)
  }

  res.status(status).json({
    message:
      status === 500
        ? 'Unable to process signal request.'
        : error.message,
  })
})

export default router