
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

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next)
}

// Require authentication for all profile photo routes.
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

  res.locals.profilePhotoUserId = String(userId)

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

function setPhotoCacheHeaders(res) {
  res.set({
    'Cache-Control': 'private, no-store',
    Vary: 'Cookie',
  })
}

function sendMissingPhoto(res, message) {
  res.set('Cache-Control', 'private, no-store')

  return res.status(404).json({
    code: 'PROFILE_PHOTO_NOT_SET',
    message,
  })
}

function sendPhotoError(res, error) {
  const status = Number(error?.statusCode ?? error?.status) || 500
  const code = error?.code || 'PROFILE_PHOTO_READ_FAILED'

  console.error('[PROFILE PHOTO ROUTE]', {
    code,
    message: error?.message,
  })

  res.set('Cache-Control', 'private, no-store')

  return res.status(
    status >= 400 && status < 600 ? status : 500,
  ).json({
    code,
    message:
      status >= 500
        ? 'Unable to load the profile photo. Please try again.'
        : error.message,
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
      return sendMissingPhoto(
        res,
        'You have not added a profile photo yet.',
      )
    }

    setPhotoCacheHeaders(res)

    return res.type('image/webp').send(body)
  }),
)

// Get another community member's profile photo.
// This route allows any authenticated member to view it.
router.get(
  '/photo/:userId',
  asyncRoute(async (req, res) => {
    const userId = req.params.userId

    if (!mongoose.isObjectIdOrHexString(userId)) {
      return res.status(400).json({
        code: 'PROFILE_PHOTO_INVALID_USER_ID',
        message: 'Invalid profile photo user ID.',
      })
    }

    const body = await readProfilePhoto(userId)

    if (!body) {
      return sendMissingPhoto(
        res,
        'This member has not added a profile photo yet.',
      )
    }

    setPhotoCacheHeaders(res)

    return res.type('image/webp').send(body)
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

    res.set('Cache-Control', 'private, no-store')

    return res.type('image/webp').send(body)
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

    return res.json({
      message: 'Profile photo removed.',
    })
  }),
)

// Handle upload, image-validation and storage errors.
router.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE'

    return res.status(tooLarge ? 413 : 400).json({
      code: tooLarge
        ? 'PROFILE_PHOTO_TOO_LARGE'
        : 'PROFILE_PHOTO_UPLOAD_ERROR',
      message: tooLarge
        ? 'Choose a photo smaller than 2 MB.'
        : 'Upload one photo in the photo field.',
    })
  }

  if (error instanceof ProfilePhotoError) {
    return res.status(error.status).json({
      code: error.code || 'PROFILE_PHOTO_INVALID',
      message: error.message,
    })
  }

  return sendPhotoError(res, error)
})

export default router
