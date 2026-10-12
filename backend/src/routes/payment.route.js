import { Router } from 'express'

import {
  createPayment,
  checkPayment,
} from '../controllers/payment.controller.js'

const router = Router()

router.post('/orders', createPayment)

router.post('/orders/:orderId/check', checkPayment)

export default router