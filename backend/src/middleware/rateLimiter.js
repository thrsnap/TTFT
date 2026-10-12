import { rateLimit } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis } from '../config/redis.js'

export function createApiLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    store: new RedisStore({
      prefix: 'cmm:limit:api:',
      sendCommand: (...args) => redis.sendCommand(args),
    }),

    message: {
      message: 'Too many requests. Please try again shortly.',
    },
  })
}
export function createLoginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,

    standardHeaders: 'draft-8',
    legacyHeaders: false,
    requestPropertyName: 'loginRateLimit',

    // Only count responses with status 401.
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode !== 401,

    store: new RedisStore({
      prefix: 'cmm:limit:login:',
      sendCommand: (...args) => redis.sendCommand(args),
    }),

    message: {
      message: 'Too many failed login attempts. Please try again later.',
    },
  })
}