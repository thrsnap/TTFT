import { rateLimit } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis } from '../config/redis.js'

function createStore(prefix) {
  return new RedisStore({
    prefix,
    sendCommand: (...args) => redis.sendCommand(args),
  })
}

export function createApiLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 100,

    standardHeaders: 'draft-7',
    legacyHeaders: false,
    requestPropertyName: 'apiRateLimit',

    // Mounted at /api, so req.path starts with /auth.
    // Registration uses its own limiter.
    skip: req =>
      req.method === 'OPTIONS' ||
      (
        req.method === 'POST' &&
        /^\/auth\/register\/?$/i.test(req.path)
      ),

    store: createStore('cmm:limit:api:'),

    message: {
      message: 'Too many requests. Please try again shortly.',
      code: 'API_RATE_LIMIT',
    },
  })
}

export function createRegisterLimiter() {
  return rateLimit({
    // 20 registration requests per IP in 10 minutes.
    windowMs: 10 * 60 * 1000,
    limit: 20,

    standardHeaders: 'draft-7',
    legacyHeaders: false,
    requestPropertyName: 'registerRateLimit',

    store: createStore('cmm:limit:register:'),

    message: {
      message:
        'Too many registration attempts from this network. Please try again later.',
      code: 'REGISTER_RATE_LIMIT',
    },
  })
}

export function createLoginLimiter() {
  return rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,

    standardHeaders: 'draft-7',
    legacyHeaders: false,
    requestPropertyName: 'loginRateLimit',

    // Count only responses with status 401.
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) =>
      res.statusCode !== 401,

    store: createStore('cmm:limit:login:'),

    message: {
      message:
        'Too many failed login attempts. Please try again later.',
      code: 'LOGIN_RATE_LIMIT',
    },
  })
}