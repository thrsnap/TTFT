import { Router } from 'express'
import { requireUser } from '../controllers/auth.controller.js'
import { overview, list, create, update, remove } from '../controllers/tradeJournal.controller.js'

const router = Router()

router.use(requireUser)
router.get('/overview', overview)
router.get('/', list)
router.post('/', create)
router.patch('/:id', update)
router.delete('/:id', remove)

export default router
