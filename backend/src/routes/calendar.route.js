import express from 'express'
import mongoose from 'mongoose'
import EconomicEvent from '../models/economicEvent.model.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = express.Router()

const editableFields = [
  'title',
  'country',
  'currency',
  'scheduledAt',
  'impact',
  'forecast',
  'previous',
  'actual',
  'status',
  'sourceUrl',
]

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

// Accept only supported event fields.
function getEventData(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Send a JSON object')
  }

  const unknownFields = Object.keys(body).filter(
    (field) => !editableFields.includes(field)
  )

  if (unknownFields.length > 0) {
    throw badRequest(`Unknown fields: ${unknownFields.join(', ')}`)
  }

  return Object.fromEntries(
    editableFields
      .filter((field) => Object.hasOwn(body, field))
      .map((field) => [field, body[field]])
  )
}

// Validate MongoDB IDs for routes containing :id.
router.param('id', (req, res, next, id) => {
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({
      message: 'Invalid event ID',
    })
  }

  next()
})

// PUBLIC: Get events.
// Example: ?from=2026-10-01&to=2026-11-01
// "from" is inclusive; "to" is exclusive.
router.get('/', async (req, res, next) => {
  try {
    const filter = {}
    const range = {}

    for (const [parameter, operator] of [
      ['from', '$gte'],
      ['to', '$lt'],
    ]) {
      const value = req.query[parameter]

      if (value !== undefined) {
        const parsed =
          typeof value === 'string'
            ? new Date(value)
            : new Date(NaN)

        if (Number.isNaN(parsed.getTime())) {
          throw badRequest(`Invalid ${parameter} date`)
        }

        range[operator] = parsed
      }
    }

    if (range.$gte && range.$lt && range.$gte >= range.$lt) {
      throw badRequest('"to" must be later than "from"')
    }

    if (Object.keys(range).length > 0) {
      filter.scheduledAt = range
    }

    const events = await EconomicEvent.find(filter)
      .sort({ scheduledAt: 1, _id: 1 })
      .limit(1000)
      .lean()

    return res.status(200).json({
      count: events.length,
      events,
    })
  } catch (error) {
    next(error)
  }
})

// PUBLIC: Get one event.
router.get('/:id', async (req, res, next) => {
  try {
    const event = await EconomicEvent.findById(req.params.id)

    if (!event) {
      return res.status(404).json({
        message: 'Event not found',
      })
    }

    return res.status(200).json({ event })
  } catch (error) {
    next(error)
  }
})

// ADMIN: Create multiple events.
// Provide a shared scheduledAt or a scheduledAt inside each event.
router.post('/bulk', requireAdmin, async (req, res, next) => {
  try {
    const body = req.body

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw badRequest(
        'Send an object containing scheduledAt and an events array'
      )
    }

    const unknownFields = Object.keys(body).filter(
      (field) => !['scheduledAt', 'events'].includes(field)
    )

    if (unknownFields.length > 0) {
      throw badRequest(
        `Unknown bulk fields: ${unknownFields.join(', ')}`
      )
    }

    const { scheduledAt, events } = body

    if (!Array.isArray(events) || events.length === 0) {
      throw badRequest('Provide a non-empty events array')
    }

    if (events.length > 100) {
      throw badRequest('Maximum 100 events per request')
    }

    const documents = []

    for (let index = 0; index < events.length; index++) {
      let data

      try {
        data = getEventData(events[index])
      } catch (error) {
        throw badRequest(`Event ${index + 1}: ${error.message}`)
      }

      // An event's own time overrides the shared time.
      data.scheduledAt = data.scheduledAt ?? scheduledAt

      if (!data.scheduledAt) {
        throw badRequest(
          `Event ${index + 1}: provide scheduledAt inside the event or at the top level`
        )
      }

      const document = new EconomicEvent(data)

      // Validate every event before starting the insert.
      try {
        await document.validate()
      } catch (error) {
        if (
          error.name === 'ValidationError' ||
          error.name === 'CastError'
        ) {
          throw badRequest(
            `Event ${index + 1}: ${error.message}`
          )
        }

        throw error
      }

      documents.push(document)
    }

    const savedEvents = await EconomicEvent.insertMany(documents, {
      ordered: true,
    })

    return res.status(201).json({
      message: 'Events created successfully',
      count: savedEvents.length,
      events: savedEvents,
    })
  } catch (error) {
    next(error)
  }
})

// ADMIN: Create one event.
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const data = getEventData(req.body)
    const event = await EconomicEvent.create(data)

    return res.status(201).json({
      message: 'Event created',
      event,
    })
  } catch (error) {
    next(error)
  }
})

// ADMIN: Update one event.
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = getEventData(req.body)

    if (Object.keys(data).length === 0) {
      throw badRequest('Provide at least one field to update')
    }

    const event = await EconomicEvent.findById(req.params.id)

    if (!event) {
      return res.status(404).json({
        message: 'Event not found',
      })
    }

    event.set(data)
    await event.save()

    return res.status(200).json({
      message: 'Event updated',
      event,
    })
  } catch (error) {
    next(error)
  }
})

// ADMIN: Delete one event.
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const event = await EconomicEvent.findByIdAndDelete(
      req.params.id
    )

    if (!event) {
      return res.status(404).json({
        message: 'Event not found',
      })
    }

    return res.status(200).json({
      message: 'Event deleted',
    })
  } catch (error) {
    next(error)
  }
})

// Return JSON for validation and input errors.
// Unexpected errors continue to your app's error handler.
router.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (
    error.status === 400 ||
    error.name === 'ValidationError' ||
    error.name === 'CastError'
  ) {
    return res.status(400).json({
      message: error.message,
    })
  }

  next(error)
})

export default router