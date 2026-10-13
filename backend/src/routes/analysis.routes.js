import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import sharp from 'sharp'
import { pipeline } from 'node:stream/promises'
import { AnalysisPost, AnalysisDocument, AnalysisImage } from '../models/analysis.model.js'
import { requireUser } from '../controllers/auth.controller.js'
import requireAdmin from '../middleware/requireAdmin.js'
import { deleteR2File } from '../config/r2.js'
import { uploadAnalysisBuffer, readAnalysisObject } from '../config/analysisR2.js'

const router = Router()
function badRequest(message) { const error = new Error(message); error.status = 400; return error }
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 6, fieldSize: 20000 },
})
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 10, fields: 10, fieldSize: 20000 },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(badRequest('Use JPG, PNG or WebP images.'))
    }
    callback(null, true)
  },
})

router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  try {
    const origins = [process.env.FRONTEND_URL, process.env.ADMIN_FRONTEND_URL]
      .filter(Boolean).map(value => new URL(value.trim()).origin)
    const origin = req.get('Origin')
    if (req.get('X-CMM-Request') !== '1' || (origin && !origins.includes(origin))) {
      return res.status(403).json({ message: 'Request not allowed.' })
    }
    next()
  } catch (error) { next(error) }
})

function pick(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Send a JSON object or multipart form.')
  const unknown = Object.keys(body).filter(key => !allowed.includes(key))
  if (unknown.length) throw badRequest(`Unknown fields: ${unknown.join(', ')}`)
  return Object.fromEntries(allowed.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]))
}
function validId(id, label) {
  if (!mongoose.isObjectIdOrHexString(id)) throw badRequest(`Invalid ${label} ID.`)
}
function formatPost(post) {
  return {
    id: String(post._id), title: post.title, category: post.category,
    symbol: post.symbol, timeframe: post.timeframe, date: post.date.toISOString(),
    pictures: [...(post.pictures || []), ...(post.imageIds || []).map(id => `/api/analysis/images/${id}`)],
    details: post.details, status: post.status, pendingDelete: Boolean(post.pendingDelete),
  }
}
function formatDocument(doc) {
  return {
    id: String(doc._id), title: doc.title, description: doc.description, type: doc.type,
    url: doc.hasFile ? `/api/analysis/documents/${doc._id}/download` : doc.url,
    status: doc.status, pendingDelete: Boolean(doc.pendingDelete),
  }
}
async function listContent(res, filter) {
  const [posts, documents] = await Promise.all([
    AnalysisPost.find(filter).sort({ date: -1, _id: -1 }).limit(200).lean(),
    AnalysisDocument.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
  ])
  res.set('Cache-Control', 'no-store')
  res.json({ posts: posts.map(formatPost), documents: documents.map(formatDocument) })
}

// Fetch from R2 only after the parent record's access checks succeed.
async function sendR2(res, key, contentType, filename) {
  const object = await readAnalysisObject(key)
  if (!object.Body) throw new Error('R2 returned an empty object body.')
  res.set('Cache-Control', 'private, no-store')
  res.set('X-Content-Type-Options', 'nosniff')
  if (filename) res.attachment(filename)
  res.type(contentType)
  if (object.ContentLength !== undefined) res.set('Content-Length', String(object.ContentLength))
  await pipeline(object.Body, res)
}
function serveWithAccess(req, res, next, record, send) {
  const run = () => Promise.resolve().then(send).catch(next)
  if (record.status === 'published') return run()
  return requireUser(req, res, error => {
    if (error) return next(error)
    return requireAdmin(req, res, error => error ? next(error) : run())
  })
}

// R2 and MongoDB cannot share a transaction. Keep object keys until R2 deletion
// succeeds, and hide the parent while deletion is pending. Repeated DELETE is safe.
async function removePost(post) {
  await AnalysisPost.updateOne({ _id: post._id }, { $set: { pendingDelete: true } })
  const images = await AnalysisImage.find({ postId: post._id }).lean()
  for (const image of images) {
    if (image.storage === 'r2' && image.key) await deleteR2File(image.key)
  }
  await AnalysisImage.deleteMany({ postId: post._id })
  await AnalysisPost.deleteOne({ _id: post._id })
}
async function removeDocument(doc) {
  await AnalysisDocument.updateOne({ _id: doc._id }, { $set: { pendingDelete: true } })
  if (doc.hasFile && doc.fileStorage === 'r2' && doc.fileKey) await deleteR2File(doc.fileKey)
  await AnalysisDocument.deleteOne({ _id: doc._id })
}

router.get('/', async (req, res, next) => {
  try { await listContent(res, { status: 'published', pendingDelete: { $ne: true } }) }
  catch (error) { next(error) }
})
router.get('/admin', requireUser, requireAdmin, async (req, res, next) => {
  try { await listContent(res, {}) } catch (error) { next(error) }
})
router.get('/images/:id', async (req, res, next) => {
  try {
    validId(req.params.id, 'image')
    // First query reads metadata only; legacy bytes are read after authorization.
    const image = await AnalysisImage.findById(req.params.id)
    if (!image) return res.status(404).json({ message: 'Image not found.' })
    const post = await AnalysisPost.findById(image.postId)
    if (!post || post.pendingDelete || !(post.imageIds || []).some(id => String(id) === String(image._id))) {
      return res.status(404).json({ message: 'Image not found.' })
    }
    return serveWithAccess(req, res, next, post, async () => {
      if (image.storage === 'r2') return sendR2(res, image.key, image.contentType || 'image/webp')
      const legacy = await AnalysisImage.findById(image._id).select('+data')
      if (!legacy?.data) return res.status(404).json({ message: 'Image not found.' })
      res.set('Cache-Control', 'private, no-store')
      res.set('X-Content-Type-Options', 'nosniff')
      res.type(image.contentType || 'image/webp').send(legacy.data)
    })
  } catch (error) { next(error) }
})

router.post('/posts', requireUser, requireAdmin, upload.array('images', 10), async (req, res, next) => {
  let stagedPost
  try {
    const data = pick(req.body, ['title', 'category', 'symbol', 'timeframe', 'date', 'pictures', 'details', 'status'])
    if (typeof data.pictures === 'string') {
      try { data.pictures = JSON.parse(data.pictures) }
      catch { throw badRequest('pictures must be a JSON array.') }
    }
    if (data.pictures !== undefined && !Array.isArray(data.pictures)) throw badRequest('pictures must be an array.')
    if ((data.pictures?.length || 0) + (req.files?.length || 0) > 10) throw badRequest('Maximum 10 charts per analysis.')
    const post = new AnalysisPost(data)
    await post.validate()
    const processed = []
    for (const file of req.files || []) {
      let buffer
      try {
        const options = { limitInputPixels: 20000000 }
        const metadata = await sharp(file.buffer, options).metadata()
        if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Unsupported image')
        buffer = await sharp(file.buffer, options).rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 }).toBuffer()
      } catch { throw badRequest('Invalid image. Use a non-animated JPG, PNG or WebP.') }
      if (buffer.length > 5 * 1024 * 1024) throw badRequest('Processed image is too large.')
      const id = new mongoose.Types.ObjectId()
      processed.push({
        buffer,
        record: {
          _id: id, postId: post._id, storage: 'r2',
          key: `analysis/posts/${post._id}/${id}.webp`,
          contentType: 'image/webp', size: buffer.length,
        },
      })
    }
    const requestedStatus = post.status
    post.status = 'draft'
    post.pendingDelete = true // Hidden until all uploads and metadata are ready.
    await post.save()
    stagedPost = post
    for (const item of processed) {
      // Persist the key first so an interrupted/failed upload remains cleanable.
      await AnalysisImage.create(item.record)
      await uploadAnalysisBuffer({ key: item.record.key, buffer: item.buffer, contentType: item.record.contentType })
    }
    post.imageIds = processed.map(item => item.record._id)
    post.status = requestedStatus
    post.pendingDelete = false
    await post.save()
    stagedPost = undefined
    res.status(201).json({ message: 'Analysis saved.', post: formatPost(post) })
  } catch (error) {
    if (stagedPost) {
      try { await removePost(stagedPost) }
      catch (cleanupError) { console.error('Analysis cleanup pending:', String(stagedPost._id), cleanupError.name) }
    }
    next(error)
  }
})

router.delete('/posts/:id', requireUser, requireAdmin, async (req, res, next) => {
  try {
    validId(req.params.id, 'analysis')
    const post = await AnalysisPost.findById(req.params.id)
    if (!post) return res.json({ success: true, message: 'Analysis already deleted.', id: req.params.id })
    await removePost(post)
    res.json({ success: true, message: 'Analysis and uploaded charts deleted.', id: req.params.id })
  } catch (error) { next(error) }
})

router.get('/documents/:id/download', async (req, res, next) => {
  try {
    validId(req.params.id, 'document')
    const doc = await AnalysisDocument.findById(req.params.id)
    if (!doc?.hasFile || doc.pendingDelete) return res.status(404).json({ message: 'File not found.' })
    return serveWithAccess(req, res, next, doc, async () => {
      const filename = doc.filename || `reference-${doc._id}`
      if (doc.fileStorage === 'r2') return sendR2(res, doc.fileKey, doc.contentType || 'application/octet-stream', filename)
      const legacy = await AnalysisDocument.findById(doc._id).select('+fileData')
      if (!legacy?.fileData) return res.status(404).json({ message: 'File not found.' })
      res.set('Cache-Control', 'private, no-store')
      res.set('X-Content-Type-Options', 'nosniff')
      res.attachment(filename).type(doc.contentType || 'application/octet-stream').send(legacy.fileData)
    })
  } catch (error) { next(error) }
})

router.post('/documents', requireUser, requireAdmin, documentUpload.single('file'), async (req, res, next) => {
  let stagedDocument
  try {
    const data = pick(req.body, ['title', 'description', 'type', 'url', 'status'])
    if (!req.file) {
      if (!data.url) throw badRequest('Select a file or provide a hosted document URL.')
      const document = await AnalysisDocument.create(data)
      return res.status(201).json({ message: 'Reference document saved.', document: formatDocument(document) })
    }
    const extension = req.file.originalname.split('.').pop().toLowerCase()
    const formats = {
      pdf: ['PDF', 'application/pdf'],
      doc: ['Word Document', 'application/msword'],
      docx: ['Word Document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      zip: ['ZIP', 'application/zip'],
    }
    const format = formats[extension]
    if (!format) throw badRequest('Upload a PDF, DOC, DOCX or ZIP file.')
    const buffer = req.file.buffer
    const isPdf = buffer.subarray(0, 5).toString() === '%PDF-'
    const isZip = ['504b0304', '504b0506', '504b0708'].includes(buffer.subarray(0, 4).toString('hex'))
    const isDoc = buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1'
    if ((extension === 'pdf' && !isPdf) || (extension === 'doc' && !isDoc) || (['docx', 'zip'].includes(extension) && !isZip)) {
      throw badRequest('The file does not match its extension.')
    }
    const id = new mongoose.Types.ObjectId()
    data._id = id
    data.type = format[0]
    data.hasFile = true
    data.fileStorage = 'r2'
    data.filename = `reference-${id}.${extension}`
    data.fileKey = `analysis/documents/${id}/${data.filename}`
    data.contentType = format[1]
    data.size = buffer.length
    delete data.url
    const document = new AnalysisDocument(data)
    await document.validate()
    const requestedStatus = document.status
    document.status = 'draft'
    document.pendingDelete = true
    await document.save()
    stagedDocument = document
    await uploadAnalysisBuffer({ key: document.fileKey, buffer, contentType: document.contentType })
    document.status = requestedStatus
    document.pendingDelete = false
    await document.save()
    stagedDocument = undefined
    res.status(201).json({ message: 'Reference document saved.', document: formatDocument(document) })
  } catch (error) {
    if (stagedDocument) {
      try { await removeDocument(stagedDocument) }
      catch (cleanupError) { console.error('Document cleanup pending:', String(stagedDocument._id), cleanupError.name) }
    }
    next(error)
  }
})

router.delete('/documents/:id', requireUser, requireAdmin, async (req, res, next) => {
  try {
    validId(req.params.id, 'document')
    const doc = await AnalysisDocument.findById(req.params.id)
    if (!doc) return res.json({ success: true, message: 'Reference document already deleted.', id: req.params.id })
    await removeDocument(doc)
    res.json({ success: true, message: 'Reference document deleted.', id: req.params.id })
  } catch (error) { next(error) }
})

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof multer.MulterError || error.status === 400 || ['ValidationError', 'CastError'].includes(error.name)) {
    return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE'
      ? (req.path === '/documents' ? 'The document must be 10 MB or smaller.' : 'Each image must be 2 MB or smaller.')
      : error.message })
  }
  if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
    return res.status(404).json({ message: 'Uploaded file not found.' })
  }
  // Log only the error type; credentials and raw SDK errors stay out of responses.
  console.error('Analysis request failed:', error.name)
  res.status(500).json({ message: 'Analysis request failed. Check backend logs. If deletion failed, retry Delete.' })
})

export default router
