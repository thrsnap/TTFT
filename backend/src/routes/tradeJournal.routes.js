import { Router } from 'express'
import { requireUser } from '../controllers/auth.controller.js'
import {
  overview, list, create, update, remove,
  listJournals, createJournal, updateJournal,
} from '../controllers/tradeJournal.controller.js'

const router = Router()

router.use(requireUser)
router.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-CMM-Request') !== '1') {
    return res.status(403).json({ message: 'Request not allowed.' })
  }
  next()
})
router.get('/journals', listJournals)
router.post('/journals', createJournal)
router.patch('/journals/:journalId', updateJournal)
router.get('/overview', overview)
router.get('/', list)
router.post('/', create)
router.patch('/:id', update)
router.delete('/:id', remove)

export default router
