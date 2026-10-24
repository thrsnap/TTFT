import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import { requireUser } from '../controllers/auth.controller.js'
import {
  MAX_PROFILE_PHOTO_SIZE,
  PROFILE_PHOTO_TYPES,
  ProfilePhotoError,
  readProfilePhoto,
  saveProfilePhoto,
  removeProfilePhoto,
} from '../services/profilePhoto.service.js'

const router = Router()
const asyncRoute = handler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next)
}

router.use(requireUser)

router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store')
  res.set('X-Content-Type-Options', 'nosniff')

  const userId = req.user?._id ?? req.user?.id ?? req.session?.userId
  if (!mongoose.isObjectIdOrHexString(userId)) {
    return res.status(401).json({ message: 'Please sign in to manage your profile photo.' })
  }
  res.locals.profilePhotoUserId = userId

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('X-CMM-Request') !== '1') {
    return res.status(403).json({ message: 'Request not allowed.' })
  }
  next()
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_PHOTO_SIZE,
    files: 1,
    fields: 0,
    parts: 2,
  },
  fileFilter(req, file, callback) {
    if (!PROFILE_PHOTO_TYPES.includes(file.mimetype)) {
      return callback(new ProfilePhotoError(400, 'Choose a JPG, PNG or WebP image.'))
    }
    callback(null, true)
  },
})

router.get('/photo', asyncRoute(async (req, res) => {
  const body = await readProfilePhoto(res.locals.profilePhotoUserId)
  if (!body) {
    return res.status(404).json({
      code: 'PROFILE_PHOTO_NOT_SET',
      message: 'You have not added a profile photo yet.',
    })
  }
  res.type('image/webp').send(body)
}))

router.post('/photo', upload.single('photo'), asyncRoute(async (req, res) => {
  const body = await saveProfilePhoto(res.locals.profilePhotoUserId, req.file)
  res.type('image/webp').send(body)
}))

router.delete('/photo', asyncRoute(async (req, res) => {
  await removeProfilePhoto(res.locals.profilePhotoUserId)
  res.json({ message: 'Profile photo removed.' })
}))

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE'
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge ? 'Choose a photo smaller than 2 MB.' : 'Upload one photo in the photo field.',
    })
  }
  if (error instanceof ProfilePhotoError) {
    return res.status(error.status).json({ message: error.message, ...(error.code ? { code: error.code } : {}) })
  }
  console.error('Profile photo request failed:', error)
  res.status(500).json({ message: 'Unable to update your profile photo. Please try again.' })
})

export default router
