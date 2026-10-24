
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

// Require a signed-in user for every photo route.
router.use(requireUser)

// Validate the signed-in user's ID and protect mutations.
router.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff')

  const userId =
    req.user?._id ??
    req.user?.id ??
    req.session?.userId

  if (!mongoose.isObjectIdOrHexString(userId)) {
    return res.status(401).json({
      message: 'Please sign in to manage your profile photo.',
    })
  }

  res.locals.profilePhotoUserId = userId

  if (
    req.method !== 'GET' &&
    req.method !== 'HEAD' &&
    req.get('X-CMM-Request') !== '1'
  ) {
    return res.status(403).json({
      message: 'Request not allowed.',
    })
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
      return callback(
        new ProfilePhotoError(
          400,
          'Choose a JPG, PNG or WebP image.',
          'PROFILE_PHOTO_INVALID_TYPE',
        ),
      )
    }

    callback(null, true)
  },
})

// Apply private caching only to successful photo responses.
// Missing-photo responses should not be cached.
function setPhotoCacheHeaders(res) {
  res.set({
    'Cache-Control': 'private, max-age=300, must-revalidate',
    Vary: 'Cookie',
  })
}

// Get the signed-in user's profile photo.
router.get(
  '/photo',
  asyncRoute(async (req, res) => {
    const body = await readProfilePhoto(
      res.locals.profilePhotoUserId,
    )

    if (!body) {
      res.set('Cache-Control', 'private, no-store')

      return res.status(404).json({
        code: 'PROFILE_PHOTO_NOT_SET',
        message: 'You have not added a profile photo yet.',
      })
    }

    setPhotoCacheHeaders(res)
    res.type('image/webp').send(body)
  }),
)

// Get a community member's profile photo.
router.get(
  '/photo/:userId',
  asyncRoute(async (req, res) => {
    const userId = req.params.userId

    if (!mongoose.isObjectIdOrHexString(userId)) {
      return res.status(400).json({
        message: 'Invalid profile photo user ID.',
      })
    }

    const body = await readProfilePhoto(userId)

    if (!body) {
      res.set('Cache-Control', 'private, no-store')

      return res.status(404).json({
        code: 'PROFILE_PHOTO_NOT_SET',
        message: 'This member has not added a profile photo yet.',
      })
    }

    setPhotoCacheHeaders(res)
    res.type('image/webp').send(body)
  }),
)

// Upload or replace the signed-in user's photo.
router.post(
  '/photo',
  upload.single('photo'),
  asyncRoute(async (req, res) => {
    const body = await saveProfilePhoto(
      res.locals.profilePhotoUserId,
      req.file,
    )

    // Do not cache upload responses.
    res.set('Cache-Control', 'private, no-store')
    res.type('image/webp').send(body)
  }),
)

// Remove the signed-in user's photo.
router.delete(
  '/photo',
  asyncRoute(async (req, res) => {
    await removeProfilePhoto(
      res.locals.profilePhotoUserId,
    )

    res.set('Cache-Control', 'private, no-store')

    res.json({
      message: 'Profile photo removed.',
    })
  }),
)

// Handle photo and upload errors.
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error)

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE'

    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? 'Choose a photo smaller than 2 MB.'
        : 'Upload one photo in the photo field.',
    })
  }

  if (error instanceof ProfilePhotoError) {
    return res.status(error.status).json({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    })
  }

  console.error(
    'Profile photo request failed:',
    error?.name,
    error?.message,
  )

  res.set('Cache-Control', 'private, no-store')

  res.status(500).json({
    message: 'Unable to update your profile photo. Please try again.',
  })
})

export default router
