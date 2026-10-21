import { Router } from 'express'
import multer from 'multer'

import {
  listJournals,
  createJournal,
  updateJournal,
  deleteJournal,
  getJournalImage,
} from '../controllers/journal.controller.js'

import { requireUser } from '../controllers/auth.controller.js'

const router = Router()

// Protect posts, uploads, and screenshots.
router.use(requireUser)

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 6,
    fieldSize: 16 * 1024,
    parts: 7,
  },

  fileFilter(req, file, callback) {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowed.includes(file.mimetype)) {
      return callback(
        new Error('Only JPG, PNG, and WebP screenshots are allowed.'),
      )
    }

    callback(null, true)
  },
})

function screenshotUpload(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next()

    return res.status(400).json({
      message: error.code === 'LIMIT_FILE_SIZE'
        ? 'Screenshot must be smaller than 5 MB.'
        : error.message || 'Unable to upload screenshot.',
    })
  })
}

router.get('/', listJournals)

router.post('/', screenshotUpload, createJournal)

router.patch('/:id', screenshotUpload, updateJournal)

router.delete('/:id', deleteJournal)

router.get('/:id/image', getJournalImage)

export default router