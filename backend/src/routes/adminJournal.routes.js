import { Router } from 'express'

import { requireUser } from '../controllers/auth.controller.js'
import requireAdmin from '../middleware/requireAdmin.js'

import {
  listJournals,
  adminDeleteJournal,
} from '../controllers/journal.controller.js'

const router = Router()

// Every endpoint below requires a signed-in admin.
router.use(requireUser, requireAdmin)

// View posts for moderation.
router.get('/', listJournals)

// Delete any user's post.
router.delete('/:id', adminDeleteJournal)

export default router