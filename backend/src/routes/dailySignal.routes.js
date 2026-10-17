import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import sharp from 'sharp'
import DailySignal from '../models/dailySignal.model.js'
import { requireUser } from '../controllers/auth.controller.js'
import requireAdmin from '../middleware/requireAdmin.js'
import { getSessionUserId } from '../services/signalAccess.service.js'
import { getDailySubscription } from '../services/dailySignalAccess.service.js'
import { DAILY_AMOUNT_CENTS, DAILY_PRODUCT_ID } from '../services/dailySignalTerms.js'

const router = Router()
const run = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next)
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error }
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 12, fieldSize: 22000 },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      const error = new Error('Use a JPG, PNG or WebP image.'); error.status = 400
      return callback(error)
    }
    callback(null, true)
  },
})
router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })

function hasBytes(value) { return Boolean(value && value.length > 0) }
function released(signal) { return hasBytes(signal.image) && Boolean(signal.details?.trim()) }
function result(signal, access = false) {
  const data = {
    _id: String(signal._id), pair: signal.pair, title: signal.title,
    scheduledAt: signal.scheduledAt, previewText: signal.previewText,
    hasAccess: access, hasImage: hasBytes(signal.image), isReleased: released(signal),
    imageUpdatedAt: signal.imageUpdatedAt,
    updatedAt: signal.updatedAt,
  }
  if (access) Object.assign(data, {
    details: signal.details || '', direction: signal.direction, confirmed: signal.confirmed,
  })
  return data
}
function fields(body) {
  const allowed = ['pair', 'title', 'scheduledAt', 'direction', 'confirmed', 'details', 'previewText', 'status']
  if (Object.keys(body).some(key => !allowed.includes(key))) fail('Unsupported Daily Signal fields.')
  const data = {}
  for (const key of allowed) {
    if (!Object.hasOwn(body, key)) continue
    if (key === 'confirmed') {
      if (![true, false, 'true', 'false'].includes(body[key])) fail('Invalid confirmation value.')
      data[key] = body[key] === true || body[key] === 'true'
    } else {
      if (typeof body[key] !== 'string') fail(`${key} must be text.`)
      data[key] = body[key].trim()
    }
  }
  if (data.scheduledAt !== undefined) {
    if (!data.scheduledAt || !Number.isFinite(new Date(data.scheduledAt).getTime())) fail('Enter a valid signal date.')
    data.scheduledAt = new Date(data.scheduledAt)
  }
  return data
}
async function imageFields(file) {
  if (!file) return {}
  try {
    const pipeline = sharp(file.buffer, { limitInputPixels: 20000000 })
    const meta = await pipeline.metadata()
    if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) > 1) fail('Unsupported image.')
    const image = await pipeline.rotate().resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 }).toBuffer()
    const preview = await sharp(image).resize({ width: 64 }).blur(10).webp({ quality: 40 }).toBuffer()
    return { image, preview, imageUpdatedAt: new Date() }
  } catch { fail('Invalid image. Use a JPG, PNG or WebP under 2 MB.') }
}
function validateConfirmation(signal) {
  if (signal.confirmed && !['buy', 'sell'].includes(signal.direction)) fail('Choose BUY or SELL before confirming.')
}
function validId(value) { if (!/^[a-f0-9]{24}$/i.test(value)) fail('Invalid Daily Signal ID.'); return value }

// Public metadata only; protected details never leave the backend without access.
router.get('/', run(async (req, res) => {
  const subscription = await getDailySubscription(await getSessionUserId(req))
  const signals = await DailySignal.find({ status: 'published' }).select('+image +details')
    .sort({ scheduledAt: -1, _id: -1 }).limit(50)
  res.json({
    signals: signals.map(signal => result(signal, subscription.active)), subscription,
    plan: { productId: DAILY_PRODUCT_ID, amount: DAILY_AMOUNT_CENTS / 100, currency: 'USD', interval: 'month' },
  })
}))

router.use('/admin', requireUser, requireAdmin)
router.use('/admin', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-CMM-Request') !== '1') {
    return res.status(403).json({ message: 'Request not allowed.' })
  }
  next()
})
router.get('/admin', run(async (req, res) => {
  const signals = await DailySignal.find().select('+image +details').sort({ scheduledAt: -1 }).limit(200)
  res.json({ signals: signals.map(signal => ({ ...result(signal, true), status: signal.status })) })
}))
router.post('/admin', upload.single('image'), run(async (req, res) => {
  const data = fields(req.body)
  validateConfirmation(data)
  const signal = await DailySignal.create({ ...data, ...await imageFields(req.file) })
  res.status(201).json({ message: 'Daily Signal created.', signalId: String(signal._id) })
}))
router.patch('/admin/:id', upload.single('image'), run(async (req, res) => {
  const signal = await DailySignal.findById(validId(req.params.id))
  if (!signal) fail('Daily Signal not found.', 404)
  Object.assign(signal, fields(req.body), await imageFields(req.file))
  validateConfirmation(signal)
  await signal.save()
  res.json({ message: 'Daily Signal updated.' })
}))
router.delete('/admin/:id', run(async (req, res) => {
  if (!(await DailySignal.findByIdAndDelete(validId(req.params.id)))) fail('Daily Signal not found.', 404)
  res.json({ message: 'Daily Signal deleted. Subscriptions remain active.' })
}))
router.get('/admin/:id/image', run(async (req, res) => {
  const signal = await DailySignal.findById(validId(req.params.id)).select('+image')
  if (!hasBytes(signal?.image)) fail('Chart unavailable.', 404)
  res.set('X-Content-Type-Options', 'nosniff').type('image/webp').send(signal.image)
}))
router.get('/:id/preview', run(async (req, res) => {
  const signal = await DailySignal.findOne({ _id: validId(req.params.id), status: 'published' }).select('+preview')
  if (!hasBytes(signal?.preview)) fail('Preview unavailable.', 404)
  res.set('X-Content-Type-Options', 'nosniff').type('image/webp').send(signal.preview)
}))
router.get('/:id/image', run(async (req, res) => {
  const subscription = await getDailySubscription(await getSessionUserId(req))
  if (!subscription.active) fail('An active Daily Signal subscription is required.', 403)
  const signal = await DailySignal.findOne({ _id: validId(req.params.id), status: 'published' }).select('+image')
  if (!hasBytes(signal?.image)) fail('Chart unavailable.', 404)
  res.set('X-Content-Type-Options', 'nosniff').type('image/webp').send(signal.image)
}))
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof multer.MulterError || error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: error.message })
  }
  if (error.status >= 400 && error.status < 500) return res.status(error.status).json({ message: error.message })
  next(error)
})
export default router
