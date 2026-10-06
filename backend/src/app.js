import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import MongoStore from 'connect-mongo'

import economicEventRoutes from './routes/calendar.route.js'
import authRoutes from './routes/auth.routes.js'
import { requireUser } from './controllers/auth.controller.js'

const app = express()
app.set('trust proxy', 1)
const production = process.env.NODE_ENV === 'production'
const sameSite = (process.env.COOKIE_SAME_SITE || 'lax').trim()
const frontendUrl = process.env.FRONTEND_URL?.trim()

// Required configuration.
for (const name of [
  'MONGODB_URI',
  'FRONTEND_URL',
  'SESSION_SECRET',
  'OTP_SECRET',
]) {
  if (!process.env[name]?.trim()) {
    throw new Error(`${name} is missing from your backend .env`)
  }
}

for (const name of ['SESSION_SECRET', 'OTP_SECRET']) {
  if (process.env[name].length < 32) {
    throw new Error(`${name} must contain at least 32 characters`)
  }
}

if (!['lax', 'strict', 'none'].includes(sameSite)) {
  throw new Error('COOKIE_SAME_SITE must be lax, strict, or none')
}

if (sameSite === 'none' && !production) {
  throw new Error(
    'Use COOKIE_SAME_SITE=lax for local HTTP development.',
  )
}

// Temporary diagnostic: does not print secrets.
console.log('Auth configuration:', {
  nodeEnv: process.env.NODE_ENV,
  secureCookie: production,
  sameSite,
  frontendUrl,
})

app.disable('x-powered-by')

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1)
}

// Allow the frontend to send session cookies.
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
)

app.use(express.json({ limit: '20kb' }))

// Protect authentication mutation requests.
app.use('/api/auth', (req, res, next) => {
  res.set('Cache-Control', 'no-store')

  if (req.method === 'POST') {
    const origin = req.get('Origin')

    if (
      req.get('X-CMM-Request') !== '1' ||
      !req.is('application/json') ||
      (origin && origin !== frontendUrl)
    ) {
      return res.status(403).json({
        message: 'Request not allowed.',
      })
    }
  }

  next()
})

const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  collectionName: 'sessions',
})

sessionStore.on('error', error => {
  console.error('Session store error:', error.name)
})

// Sessions must run before authentication routes.
app.use(
  session({
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
  }),
)

// Temporary local diagnostic for the failing /me request.
app.use('/api/auth', (req, res, next) => {
  if (req.method === 'GET' && req.path === '/me') {
    console.log('Session check:', {
      secureRequest: req.secure,
      cookieReceived: /(?:^|;\s*)cmm\.sid=/.test(
        req.headers.cookie || '',
      ),
      sessionHasUser: Boolean(req.session?.userId),
    })
  }

  next()
})

app.use('/api/calendar', economicEventRoutes)

app.use('/api/auth', authRoutes)

app.get('/api/dashboard', requireUser, (req, res) => {
  res.set('Cache-Control', 'no-store')

  res.json({
    message: `Welcome, ${req.user.username}!`,
  })
})

// Unmatched routes.
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
  })
})

// Error handler.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error.code === 11000) {
    return res.status(409).json({
      message: 'A record with these unique details already exists.',
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

  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({
      message:
        error.type === 'entity.parse.failed'
          ? 'Invalid JSON body'
          : error.message,
    })
  }

  console.error('Server error:', error.name)

  return res.status(500).json({
    message: 'Internal server error',
  })
})

export default app