import express from 'express'
import cors from 'cors'
import economicEventRoutes from './routes/calendar.route.js'

const app = express()

app.disable('x-powered-by')

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
  })
)

app.use(express.json({ limit: '20kb' }))

app.get('/api/health', (req, res) => {
  res.json({
    message: 'Economic API is running',
  })
})

app.use('/api/economic-events', economicEventRoutes)

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
  })
})

app.use((error, req, res, next) => {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
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

  console.error(error)

  res.status(500).json({
    message: 'Internal server error',
  })
})

export default app