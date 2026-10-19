import { Router } from 'express'

import {
  createPayment,
  checkPayment,
} from '../controllers/payment.controller.js'



import {
  requireUser,
} from '../controllers/auth.controller.js'

import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()

// Admin: paid users, payment history, and totals.
router.get(
  '/admin/paid',
  requireUser,
  requireAdmin,
)

// User: create and verify a payment.
router.post('/orders', createPayment)

router.post('/orders/:orderId/check', checkPayment)

export default router