import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import sharp from 'sharp'
import { AnalysisPost, AnalysisDocument, AnalysisImage } from '../models/analysis.model.js'
import { requireUser } from '../controllers/auth.controller.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 6, fieldSize: 20000 },
})
function badRequest(message) { const error = new Error(message); error.status = 400; return error }
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
// This router handles both JSON and multipart mutations.
router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origins = [process.env.FRONTEND_URL, process.env.ADMIN_FRONTEND_URL]
    .filter(Boolean).map(value => new URL(value.trim()).origin)
  const origin = req.get('Origin')
  if (req.get('X-CMM-Request') !== '1' || (origin && !origins.includes(origin))) {
    return res.status(403).json({ message: 'Request not allowed.' })
  }
  next()
})
function pick(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Send a JSON object or multipart form.')
  const unknown = Object.keys(body).filter(key => !allowed.includes(key))
  if (unknown.length) throw badRequest(`Unknown fields: ${unknown.join(', ')}`)
  return Object.fromEntries(allowed.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]))
}
function formatPost(post) {
  return { id: String(post._id), title: post.title, category: post.category,
    symbol: post.symbol, timeframe: post.timeframe, date: post.date.toISOString(),
    pictures: [...(post.pictures || []), ...(post.imageIds || []).map(id => `/api/analysis/images/${id}`)],
    details: post.details, status: post.status }
}
function formatDocument(doc) {
  return { id: String(doc._id), title: doc.title, description: doc.description,
    type: doc.type, url: doc.hasFile ? `/api/analysis/documents/${doc._id}/download` : doc.url, status: doc.status }
}
async function listContent(res, filter) {
  const [posts, documents] = await Promise.all([
    AnalysisPost.find(filter).sort({ date: -1, _id: -1 }).limit(200).lean(),
    AnalysisDocument.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
  ])
  res.set('Cache-Control', 'no-store')
  res.json({ posts: posts.map(formatPost), documents: documents.map(formatDocument) })
}
router.get('/', async (req, res, next) => {
  try { await listContent(res, { status: 'published' }) } catch (error) { next(error) }
})
router.get('/admin', requireUser, requireAdmin, async (req, res, next) => {
  try { await listContent(res, {}) } catch (error) { next(error) }
})
router.get('/images/:id', async (req, res, next) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw badRequest('Invalid image ID.')
    const image = await AnalysisImage.findById(req.params.id).select('+data')
    if (!image) return res.status(404).json({ message: 'Image not found.' })
    const post = await AnalysisPost.findById(image.postId)
    if (!post || !(post.imageIds || []).some(id => String(id) === String(image._id))) {
      return res.status(404).json({ message: 'Image not found.' })
    }
    const sendImage = () => {
      res.set('Cache-Control', 'private, no-store')
      res.set('X-Content-Type-Options', 'nosniff')
      res.type('image/webp').send(image.data)
    }
    if (post.status === 'published') return sendImage()
    // Draft charts are visible only to an authenticated administrator.
    return requireUser(req, res, (authError) => {
      if (authError) return next(authError)
      return requireAdmin(req, res, sendImage)
    })
  } catch (error) { next(error) }
})
router.post('/posts', requireUser, requireAdmin, upload.array('images', 10), async (req, res, next) => {
  let savedPostId
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
        if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
          throw new Error('Unsupported image')
        }
        buffer = await sharp(file.buffer, options).rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 }).toBuffer()
      } catch { throw badRequest('Invalid image. Use a non-animated JPG, PNG or WebP.') }
      if (buffer.length > 5 * 1024 * 1024) throw badRequest('Processed image is too large.')
      processed.push({ _id: new mongoose.Types.ObjectId(), postId: post._id, data: buffer, contentType: 'image/webp' })
    }
    // Save privately until all images are present, then publish if requested.
    const requestedStatus = post.status
    post.status = 'draft'
    await post.save()
    savedPostId = post._id
    if (processed.length) await AnalysisImage.insertMany(processed)
    post.imageIds = processed.map(image => image._id)
    post.status = requestedStatus
    await post.save()
    savedPostId = undefined
    res.status(201).json({ message: 'Analysis saved.', post: formatPost(post) })
  } catch (error) {
    if (savedPostId) {
      try {
        await AnalysisImage.deleteMany({ postId: savedPostId })
        await AnalysisPost.deleteOne({ _id: savedPostId })
      } catch (cleanupError) { console.error('Analysis cleanup failed:', cleanupError.name) }
    }
    next(error)
  }
})
router.get('/documents/:id/download', async (req, res, next) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw badRequest('Invalid document ID.')
    const doc = await AnalysisDocument.findById(req.params.id).select('+fileData')
    if (!doc?.hasFile || !doc.fileData) return res.status(404).json({ message: 'File not found.' })
    const sendFile = () => {
      res.set('Cache-Control', 'private, no-store')
      res.set('X-Content-Type-Options', 'nosniff')
      res.attachment(doc.filename).type(doc.contentType).send(doc.fileData)
    }
    if (doc.status === 'published') return sendFile()
    return requireUser(req, res, authError => {
      if (authError) return next(authError)
      return requireAdmin(req, res, sendFile)
    })
  } catch (error) { next(error) }
})
router.post('/documents', requireUser, requireAdmin, documentUpload.single('file'), async (req, res, next) => {
  try {
    const data = pick(req.body, ['title', 'description', 'type', 'url', 'status'])
    if (req.file) {
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
      data.type = format[0]
      data.hasFile = true
      data.fileData = buffer
      data.contentType = format[1]
      data.filename = `reference-${new mongoose.Types.ObjectId()}.${extension}`
      delete data.url
    } else if (!data.url) {
      throw badRequest('Select a file or provide a hosted document URL.')
    }
    const document = await AnalysisDocument.create(data)
    res.status(201).json({ message: 'Reference document saved.', document: formatDocument(document) })
  } catch (error) { next(error) }
})
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof multer.MulterError || error.status === 400 || ['ValidationError', 'CastError'].includes(error.name)) {
    return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? (req.path === '/documents' ? 'The document must be 10 MB or smaller.' : 'Each image must be 2 MB or smaller.') : error.message })
  }
  next(error)
})
export default router
