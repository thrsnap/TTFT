import 'dotenv/config'

import { setServers } from 'node:dns/promises'
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
        throw new Error(
          `Missing environment variable: ${name}`,
        )
      }
    }

    // Apply before MongoDB SRV queries.
    setServers(['8.8.8.8', '1.1.1.1'])

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    })

    // Ensure unique indexes are initialized.
    await User.init()
    await Payment.init()

    console.log('MongoDB connected')

    await connectMySQL()

    // Load the app after database setup.
    const { default: app } = await import('./src/app.js')

    const port = Number(process.env.PORT || 5000)

    if (
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new Error('PORT must be between 1 and 65535')
    }

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

startServer()