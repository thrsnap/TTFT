import 'dotenv/config'
import { createClient } from 'redis'

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is missing')
}

export const redis = createClient({
  url: process.env.REDIS_URL,
})

redis.on('error', (error) => {
  console.error('Redis error:', error.message)
})

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect()
  }

  console.log('Redis connected:', await redis.ping())
}