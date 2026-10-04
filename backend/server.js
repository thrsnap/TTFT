
import { setServers } from 'node:dns/promises'
setServers(['8.8.8.8', '1.1.1.1'])
import 'dotenv/config'
import mongoose from 'mongoose'
import app from '../backend/src/app.js'

async function startServer() {
  try {
    for (const name of [
      'MONGODB_URI',
      'ADMIN_API_KEY',
      'FRONTEND_URL',
    ]) {
      if (!process.env[name]) {
        throw new Error(`Missing environment variable: ${name}`)
      }
    }

    await mongoose.connect(process.env.MONGODB_URI)

    console.log('MongoDB connected')

    const port = Number(process.env.PORT) || 5000

    const server = app.listen(port, () => {
      console.log(`API running at http://localhost:${port}`)
    })

    server.on('error', (error) => {
      console.error('Server error:', error.message)
      process.exit(1)
    })
  } catch (error) {
    console.error('Startup failed:', error.message)
    process.exit(1)
  }
}

startServer()