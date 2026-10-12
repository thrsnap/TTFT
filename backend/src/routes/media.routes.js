import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'

import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { unlink } from 'node:fs/promises'

import { fileTypeFromFile } from 'file-type'

import Media from '../models/media.model.js'

import {
  requireUser,
} from '../controllers/auth.controller.js'

import requireAdmin from '../middleware/requireAdmin.js'

import {
  uploadR2File,
  getR2ReadUrl,
  deleteR2File,
} from '../config/r2.js'

const router = Router()

const MB = 1024 * 1024

const rules = {
  'signal-image': {
    folder: 'signals',
    maxSize: 2 * MB,
    types: [
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
  },

  'course-cover': {
    folder: 'course-covers',
    maxSize: 5 * MB,
    types: [
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
  },

  'course-video': {
    folder: 'course-videos',
    maxSize: 100 * MB,
    types: [
      'video/mp4',
      'video/webm',
    ],
  },
}

const temporaryDirectory = join(
  tmpdir(),
  'cmm-r2-uploads',
)

mkdirSync(temporaryDirectory, {
  recursive: true,
})

function fail(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

async function removeTemporaryFile(filePath) {
  if (!filePath) return

  try {
    await unlink(filePath)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(
        'Temporary upload cleanup failed:',
        error.code,
      )
    }
  }
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, temporaryDirectory)
  },

  filename(req, file, callback) {
    callback(null, randomUUID())
  },
})

function validateUploadRequest(req, res, next) {
  res.set('Cache-Control', 'no-store')

  const kind = req.query.kind

  if (
    typeof kind !== 'string' ||
    !Object.hasOwn(rules, kind)
  ) {
    return next(
      fail(
        'kind must be signal-image, course-cover, or course-video.',
      ),
    )
  }

  if (!req.is('multipart/form-data')) {
    return next(
      fail('Send the file using multipart/form-data.'),
    )
  }

  req.mediaKind = kind

  const rule = rules[kind]

  const receiveFile = multer({
    storage,

    limits: {
      fileSize: rule.maxSize,
      files: 1,
      fields: 0,
      parts: 1,
    },

    fileFilter(request, file, callback) {
      if (!rule.types.includes(file.mimetype)) {
        return callback(
          fail('This file type is not allowed.'),
        )
      }

      callback(null, true)
    },
  }).single('file')

  receiveFile(req, res, next)
}

router.post(
  '/upload',

  requireUser,
  requireAdmin,
  validateUploadRequest,

  async (req, res, next) => {
    let uploadedKey

    try {
      if (!req.file) {
        throw fail(
          'Choose a file. The FormData field must be named file.',
        )
      }

      if (req.file.size < 1) {
        throw fail('The file is empty.')
      }

      const rule = rules[req.mediaKind]

      // Check the detected binary format as well as
      // the browser-supplied MIME type.
      const detected = await fileTypeFromFile(
        req.file.path,
      )

      if (
        !detected ||
        !rule.types.includes(detected.mime)
      ) {
        throw fail(
          'The file contents do not match an allowed image or video format.',
        )
      }

      const key =
        `${rule.folder}/${randomUUID()}.${detected.ext}`

      await uploadR2File({
        key,
        filePath: req.file.path,
        contentType: detected.mime,
        size: req.file.size,
      })

      uploadedKey = key

      const media = await Media.create({
        key,

        name: req.file.originalname
          .replace(/[\u0000-\u001f\u007f]/g, '')
          .slice(0, 255) || 'Uploaded file',

        type: detected.mime,
        size: req.file.size,
        kind: req.mediaKind,
        uploadedBy: req.user._id,
      })

      // A stable backend URL, not an expiring R2 URL.
      return res.status(201).json({
        id: String(media._id),
        key: media.key,
        name: media.name,
        type: media.type,
        size: media.size,
        kind: media.kind,
        url: `/api/admin/media/${media._id}/read`,
      })
    } catch (error) {
      // If metadata creation failed after uploading,
      // remove the otherwise untracked R2 object.
      if (uploadedKey) {
        try {
          await deleteR2File(uploadedKey)
        } catch {
          console.error(
            'R2 cleanup failed; an untracked object may remain.',
          )
        }
      }

      return next(error)
    } finally {
      await removeTemporaryFile(req.file?.path)
    }
  },
)

router.get(
  '/media/:id/read',

  requireUser,
  requireAdmin,

  async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')

      if (
        !mongoose.isObjectIdOrHexString(
          req.params.id,
        )
      ) {
        throw fail('Invalid media ID.')
      }

      const media = await Media.findById(
        req.params.id,
      ).lean()

      if (!media) {
        throw fail('Media not found.', 404)
      }

      const signedUrl = await getR2ReadUrl(
        media.key,
      )

      return res.redirect(302, signedUrl)
    } catch (error) {
      return next(error)
    }
  },
)

router.use((error, req, res, next) => {
  if (!(error instanceof multer.MulterError)) {
    return next(error)
  }

  const tooLarge = error.code === 'LIMIT_FILE_SIZE'

  return res.status(tooLarge ? 413 : 400).json({
    message: tooLarge
      ? 'File too large. Signal images: 2 MB; course covers: 5 MB; videos: 100 MB.'
      : 'Upload exactly one file using the field name file.',
  })
})

export default router