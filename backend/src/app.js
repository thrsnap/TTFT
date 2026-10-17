import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import session from 'express-session'
import MongoStore from 'connect-mongo'

import signalRoutes from './routes/signal.routes.js'
import economicEventRoutes from './routes/calendar.route.js'
import authRoutes from './routes/auth.routes.js'
import adminRouter from './routes/admin.routes.js'
import analysisRoutes from './routes/analysis.routes.js'
import courseRoutes from './routes/course.routes.js'
import paymentRoutes from './routes/payment.route.js'
import investingNewsRouter from './routes/investingNews.routes.js'
import mediaRoutes from './routes/media.routes.js'
import {
  publicSupportRouter,
  adminSupportRouter,
} from './routes/support.routes.js'

import { requireUser } from './controllers/auth.controller.js'
import requireAdmin from './middleware/requireAdmin.js'

import { connectRedis } from './config/redis.js'
import {
  createApiLimiter,
  createLoginLimiter,
  createRegisterLimiter,
} from './middleware/rateLimiter.js'
import dailySignalRoutes from './routes/dailySignal.routes.js'
const app = express()

app.set('trust proxy', 1)
app.disable('x-powered-by')

const production = process.env.NODE_ENV === 'production'

const sameSite = (
  process.env.COOKIE_SAME_SITE || 'lax'
).trim()

for (const name of [
  'MONGODB_URI',
  'FRONTEND_URL',
  'SESSION_SECRET',
  'OTP_SECRET',
]) {
  if (!process.env[name]?.trim()) {
    throw new Error(
      `${name} is missing from your backend .env`,
    )
  }
}

for (const name of [
  'SESSION_SECRET',
  'OTP_SECRET',
]) {
  if (process.env[name].length < 32) {
    throw new Error(
      `${name} must contain at least 32 characters`,
    )
  }
}

if (!['lax', 'strict', 'none'].includes(sameSite)) {
  throw new Error(
    'COOKIE_SAME_SITE must be lax, strict, or none',
  )
}

if (sameSite === 'none' && !production) {
  throw new Error(
    'Use COOKIE_SAME_SITE=lax for local HTTP development.',
  )
}

const frontendUrls = [
  process.env.FRONTEND_URL?.trim(),
  process.env.ADMIN_FRONTEND_URL?.trim(),
].filter(Boolean)

const allowedOrigins = [
  ...new Set(
    frontendUrls.map(value => {
      const url = new URL(value)

      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(
          'Frontend URLs must use HTTP or HTTPS',
        )
      }

      return url.origin
    }),
  ),
]

console.log('Auth configuration:', {
  nodeEnv: process.env.NODE_ENV,
  secureCookie: production,
  sameSite,
  allowedOrigins,
})

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

app.use(express.json({
  limit: '20kb',
}))

const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  collectionName: 'sessions',
})

sessionStore.on('error', error => {
  console.error('Session store error:', error.name)
})

app.use(session({
  name: 'cmm.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,

  cookie: {
    httpOnly: true,
    secure: production,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  },
}))

app.use('/api/daily-signals', dailySignalRoutes)
await connectRedis()

app.use('/api', createApiLimiter())

app.post(
  '/api/auth/login',
  createLoginLimiter(),
)

function trustedMutation(req) {
  const origin = req.get('Origin')

  return (
    req.get('X-CMM-Request') === '1' &&
    (!origin || allowedOrigins.includes(origin))
  )
}

function protectJsonMutations(req, res, next) {
  res.set('Cache-Control', 'no-store')

  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    (
      !trustedMutation(req) ||
      !req.is('application/json')
    )
  ) {
    return res.status(403).json({
      message: 'Request not allowed.',
    })
  }

  next()
}

// Public news.
app.use('/api/investing-news', investingNewsRouter)

// Login, registration and password reset.
app.use(
  '/api/auth',
  protectJsonMutations,
  authRoutes,
)

// Shared admin mutation protection.
// Allows multipart uploads through to their own routes.
app.use('/api/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store')

  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    !trustedMutation(req)
  ) {
    return res.status(403).json({
      message: 'Request not allowed.',
    })
  }

  next()
})

// Payments.
app.use(
  '/api/payments',
  protectJsonMutations,
  requireUser,
  paymentRoutes,
)

// Support.
app.use('/api/support', publicSupportRouter)

app.use(
  '/api/admin/support',
  requireUser,
  requireAdmin,
  adminSupportRouter,
)

// Analysis.
app.use('/api/analysis', analysisRoutes)

// Courses and protected lesson videos.
app.use('/api/courses', courseRoutes)

// Generic uploads must precede the admin JSON router.
// Scope authentication to the upload endpoint.
app.use(
  '/api/admin/upload',
  requireUser,
  requireAdmin,
)

// Keep the original prefix expected by mediaRoutes.
app.use('/api/admin', mediaRoutes)

// Admin identity, statistics, users and permissions.
// This router checks the session and admin role itself.
app.use('/api/admin', adminRouter)

function protectNewsMutations(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  if (!trustedMutation(req)) {
    return res.status(403).json({
      message: 'Request not allowed.',
    })
  }

  return requireUser(req, res, next)
}

// Signals.
app.use(
  '/api/signals',
  protectNewsMutations,
  signalRoutes,
)

// Economic calendar.
app.use(
  '/api/calendar',
  protectNewsMutations,
  economicEventRoutes,
)

// User dashboard.
app.get('/api/dashboard', requireUser, (req, res) => {
  res.set('Cache-Control', 'no-store')

  res.json({
    message: `Welcome, ${req.user.username}!`,
  })
})

// 404: keep after all routes.
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
  })
})

// Global errors.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)

  if (error.code === 11000) {
    return res.status(409).json({
      message:
        'A record with these unique details already exists.',
    })
  }

  if (
    error.name === 'ValidationError' ||
    error.name === 'CastError'
  ) {
    return res.status(400).json({
      message: error.message,
    })
  }

  if (error.name === 'VersionError') {
    return res.status(409).json({
      message: 'The record changed. Refresh and try again.',
    })
  }

  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({
      message: error.type === 'entity.parse.failed'
        ? 'Invalid JSON body'
        : error.message,
    })
  }

  console.error('Server error:', error.name)

  res.status(500).json({
    message: 'Internal server error',
  })
})

export default app