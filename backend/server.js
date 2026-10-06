import 'dotenv/config'
import { setServers } from 'node:dns/promises'
import mongoose from 'mongoose'
import User from './src/models/user.model.js'

async function startServer() {
  try {
    for (const name of [
      'MONGODB_URI',
      'ADMIN_API_KEY',
      'FRONTEND_URL',
      'SESSION_SECRET',
      'OTP_SECRET',
    ]) {
      if (!process.env[name]) {
        throw new Error(`Missing environment variable: ${name}`)
      }
    }

    // Apply before any MongoDB DNS queries begin.
    setServers(['8.8.8.8', '1.1.1.1'])

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    })

    await User.init()

    console.log('MongoDB connected')

    // Load the app after configuring DNS.
    // Its MongoDB session store also establishes a connection.
    const { default: app } = await import('./src/app.js')

    const port = Number(process.env.PORT) || 5000

    const server = app.listen(port, () => {
      console.log(`API running at http://localhost:${port}`)
    })

    server.on('error', error => {
      console.error('Server error:', error.message)
      process.exit(1)
    })
  } catch (error) {
    console.error('Startup failed:', error.message)
    process.exit(1)
  }
}

for (const name of [
  'MONGODB_URI',
  'ADMIN_API_KEY',
  'FRONTEND_URL',
  'SESSION_SECRET',
  'OTP_SECRET',
  'GOOGLE_CLIENT_ID',
]) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing environment variable: ${name}`)
  }
}

startServer()