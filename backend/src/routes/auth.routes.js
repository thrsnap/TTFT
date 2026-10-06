import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  registerUser,
  verifyEmail,
  resendVerification,
  loginUser,
  googleLogin,
  getCurrentUser,
  logoutUser,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from '../controllers/auth.controller.js'

const router = Router()

function limit(windowMs, count) {
  return rateLimit({
    windowMs,
    limit: count,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      message: 'Too many requests. Try again later.',
    },
  })
}

const emailLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: req =>
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : 'missing-email',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Email request limit reached. Try again later.',
  },
})

router.post(
  '/register',
  limit(3600000, 10),
  emailLimit,
  registerUser,
)

router.post(
  '/verify-email',
  limit(900000, 30),
  verifyEmail,
)

router.post(
  '/resend-verification',
  limit(3600000, 10),
  emailLimit,
  resendVerification,
)

router.post('/login', limit(900000, 20), loginUser)

router.post('/google', limit(900000, 20), googleLogin)

// Step 1: send reset code.
router.post(
  '/forgot-password',
  limit(3600000, 10),
  emailLimit,
  forgotPassword,
)

// Step 2: verify code.
router.post(
  '/verify-reset-code',
  limit(900000, 30),
  verifyResetCode,
)

// Step 3: save new password.
router.post(
  '/reset-password',
  limit(900000, 10),
  resetPassword,
)

router.get('/me', getCurrentUser)

router.post('/logout', logoutUser)

export default router