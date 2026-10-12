import 'dotenv/config'

import mongoose from 'mongoose'

import User from './src/models/user.model.js'
import Payment from './src/models/payment.model.js'
import { connectMySQL } from './src/config/mysql.js'

async function startServer() {
  try {
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

    const port = Number(process.env.PORT || 5000)

    if (
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new Error('PORT must be between 1 and 65535')
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    })

    await User.init()
    await Payment.init()

    console.log('MongoDB connected')

    await connectMySQL()

    // Keep existing app initialization, including Redis setup.
    const { default: app } = await import('./src/app.js')

    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`API listening on port ${port}`)
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

startServer()