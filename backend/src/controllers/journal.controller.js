import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

import {
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'

import Journal from '../models/journal.model.js'

import {
  getR2,
  getR2Bucket,
  deleteR2File,
} from '../config/r2.js'

// ─── Validation helpers ──────────────────────────────────────

function getUserId(req) {
  const id =
    req.user?._id ||
    req.user?.id ||
    req.session?.userId

  return mongoose.isObjectIdOrHexString(id)
    ? String(id)
    : null
}

function validId(value) {
  return (
    typeof value === 'string' &&
    /^[a-f\d]{24}$/i.test(value)
  )
}

function journalError(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

function readTrade(body = {}) {
  const pair = String(body.pair || '')
    .trim()
    .toUpperCase()

  const direction = String(body.direction || '')
  const result = String(body.result || '')
  const currency = String(body.currency || 'USD')
  const notes = String(body.notes || '').trim()
  const rawAmount = String(body.amount ?? '').trim()

  if (!pair || pair.length > 30) {
    throw journalError(
      'Enter a trading pair up to 30 characters.',
    )
  }

  if (!['buy', 'sell'].includes(direction)) {
    throw journalError('Choose Buy or Sell.')
  }

  if (!['profit', 'loss', 'breakeven'].includes(result)) {
    throw journalError(
      'Choose Profit, Loss, or Breakeven.',
    )
  }

  if (
    !['USD', 'KHR', 'EUR', 'GBP', 'INR'].includes(currency)
  ) {
    throw journalError('Unsupported currency.')
  }

  if (notes.length > 2000) {
    throw journalError(
      'Notes must not exceed 2,000 characters.',
    )
  }

  let amount = 0

  if (result !== 'breakeven') {
    if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount)) {
      throw journalError(
        'Enter a positive amount with up to two decimal places.',
      )
    }

    amount = Number(rawAmount)

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 999999999
    ) {
      throw journalError(
        'Amount must be greater than zero and no more than 999,999,999.',
      )
    }

    amount = Math.round(amount * 100) / 100
  }

  return {
    pair,
    direction,
    result,
    amount,
    currency,
    notes,
  }
}

// ─── R2 screenshots ──────────────────────────────────────────

async function uploadScreenshot(file, ownerId) {
  if (!file) return null

  if (file.size > 5 * 1024 * 1024) {
    throw journalError(
      'Screenshot must be smaller than 5 MB.',
    )
  }

  let buffer

  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 25000000,
      animated: false,
    })

    const metadata = await image.metadata()

    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format)
    ) {
      throw new Error('Unsupported image format.')
    }

    buffer = await image
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    throw journalError(
      'Upload a valid JPG, PNG, or WebP screenshot.',
    )
  }

  const key =
    `journals/${ownerId}/${randomUUID()}.webp`

  await getR2().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      Body: buffer,
      ContentType: 'image/webp',
      ContentLength: buffer.length,
      CacheControl: 'private, no-store',
    }),
  )

  return {
    imageKey: key,
    imageMimeType: 'image/webp',
  }
}

async function cleanupScreenshot(key) {
  if (!key) return

  try {
    await deleteR2File(key)
  } catch (error) {
    // The database operation may already have succeeded.
    // Log the key so failed cleanup can be retried later.
    console.error(
      'Journal screenshot cleanup failed:',
      key,
      error.message,
    )
  }
}

// ─── Response helpers ────────────────────────────────────────

function serializeJournal(post) {
  return {
    _id: String(post._id),

    author: {
  id: post.userId?._id
    ? String(post.userId._id)
    : '',
  username: post.userId?.username || 'Trader',
  role: post.userId?.role === 'admin' ? 'admin' : 'user',
},

    pair: post.pair,
    direction: post.direction,
    result: post.result,
    amount: post.amount,
    currency: post.currency,
    notes: post.notes,

    imageUrl: post.imageKey
      ? `/api/journals/${post._id}/image`
      : '',

    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  }
}

function handleError(res, error) {
  if (error.status) {
    return res.status(error.status).json({
      message: error.message,
    })
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Check your trade details.',
    })
  }

  console.error('Journal request failed:', error)

  return res.status(500).json({
    message:
      'Unable to process this journal request. Please try again.',
  })
}

// ─── GET /api/journals ───────────────────────────────────────

export async function listJournals(req, res) {
  try {
    const ownerId = getUserId(req)

    if (!ownerId) {
      return res.status(401).json({
        message: 'Please sign in.',
      })
    }

    const scope = req.query.scope || 'all'
    const result = req.query.result
    const cursor = req.query.cursor

    if (!['all', 'mine'].includes(scope)) {
      throw journalError('Invalid journal filter.')
    }

    const filter = {}

    if (scope === 'mine') {
      filter.userId = ownerId
    }

    if (result) {
      if (
        !['profit', 'loss', 'breakeven'].includes(result)
      ) {
        throw journalError('Invalid result filter.')
      }

      filter.result = result
    }

    if (cursor) {
      if (!validId(cursor)) {
        throw journalError('Invalid page cursor.')
      }

      filter._id = {
        $lt: new mongoose.Types.ObjectId(cursor),
      }
    }

    const requestedLimit = Number(
      req.query.limit || 12,
    )

    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 24)
      : 12

    const rows = await Journal.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('userId', 'username role')
      .lean()

    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)

    res.set('Cache-Control', 'private, no-store')

    return res.json({
      posts: page.map(serializeJournal),

      nextCursor: hasMore
        ? String(page[page.length - 1]._id)
        : null,
    })
  } catch (error) {
    return handleError(res, error)
  }
}

// ─── POST /api/journals ──────────────────────────────────────

export async function createJournal(req, res) {
  let uploaded = null
  let saved = false

  try {
    const ownerId = getUserId(req)

    if (!ownerId) {
      return res.status(401).json({
        message: 'Please sign in.',
      })
    }

    const trade = readTrade(req.body)

    uploaded = await uploadScreenshot(
      req.file,
      ownerId,
    )

    const post = await Journal.create({
      ...trade,
      userId: ownerId,
      ...(uploaded || {}),
    })

    saved = true

    return res.status(201).json({
      message: 'Trade posted.',
      id: String(post._id),
    })
  } catch (error) {
    if (uploaded && !saved) {
      await cleanupScreenshot(uploaded.imageKey)
    }

    return handleError(res, error)
  }
}

// ─── PATCH /api/journals/:id ─────────────────────────────────

export async function updateJournal(req, res) {
  let uploaded = null
  let saved = false

  try {
    const ownerId = getUserId(req)

    if (!ownerId) {
      return res.status(401).json({
        message: 'Please sign in.',
      })
    }

    if (!validId(req.params.id)) {
      throw journalError('Invalid trade ID.')
    }

    const trade = readTrade(req.body)

    const existing = await Journal.findOne({
      _id: req.params.id,
      userId: ownerId,
    }).lean()

    if (!existing) {
      throw journalError(
        'Trade not found or you cannot edit it.',
        404,
      )
    }

    uploaded = await uploadScreenshot(
      req.file,
      ownerId,
    )

    const updated = await Journal.findOneAndUpdate(
      {
        _id: existing._id,
        userId: ownerId,
        __v: existing.__v,
      },
      {
        $set: {
          ...trade,
          ...(uploaded || {}),
        },
        $inc: {
          __v: 1,
        },
      },
      {
         returnDocument: 'after', runValidators: true,
      },
    )

    if (!updated) {
      throw journalError(
        'This trade changed. Refresh the journal and try again.',
        409,
      )
    }

    saved = true

    if (uploaded && existing.imageKey) {
      await cleanupScreenshot(existing.imageKey)
    }

    return res.json({
      message: 'Trade updated.',
    })
  } catch (error) {
    if (uploaded && !saved) {
      await cleanupScreenshot(uploaded.imageKey)
    }

    return handleError(res, error)
  }
}

// ─── DELETE /api/journals/:id ────────────────────────────────

export async function deleteJournal(req, res) {
  try {
    const ownerId = getUserId(req)

    if (!ownerId) {
      return res.status(401).json({
        message: 'Please sign in.',
      })
    }

    if (!validId(req.params.id)) {
      throw journalError('Invalid trade ID.')
    }

    const post = await Journal.findOneAndDelete({
      _id: req.params.id,
      userId: ownerId,
    })

    if (!post) {
      throw journalError(
        'Trade not found or you cannot delete it.',
        404,
      )
    }

    await cleanupScreenshot(post.imageKey)

    return res.json({
      message: 'Trade deleted.',
    })
  } catch (error) {
    return handleError(res, error)
  }
}

// ─── GET /api/journals/:id/image ──────────────────────────────

export async function getJournalImage(req, res) {
  try {
    if (!getUserId(req)) {
      return res.status(401).json({
        message: 'Please sign in.',
      })
    }

    if (!validId(req.params.id)) {
      throw journalError('Invalid trade ID.')
    }

    const post = await Journal.findById(
      req.params.id,
    )
      .select('imageKey')
      .lean()

    if (!post?.imageKey) {
      throw journalError(
        'Screenshot not found.',
        404,
      )
    }

    const object = await getR2().send(
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: post.imageKey,
      }),
    )

    if (!object.Body) {
      throw journalError(
        'Screenshot not found.',
        404,
      )
    }

    res.set({
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    })

    if (object.ContentLength != null) {
      res.set(
        'Content-Length',
        String(object.ContentLength),
      )
    }

    object.Body.on('error', (error) => {
      console.error(
        'Journal image stream failed:',
        error.message,
      )

      res.destroy()
    })

    res.on('close', () => {
      object.Body.destroy()
    })

    object.Body.pipe(res)
  } catch (error) {
    if (res.headersSent) {
      return res.destroy()
    }

    if (
      error.name === 'NoSuchKey' ||
      error.$metadata?.httpStatusCode === 404
    ) {
      return res.status(404).json({
        message: 'Screenshot not found.',
      })
    }

    return handleError(res, error)
  }
}
export async function adminDeleteJournal(req, res) {
  try {
    if (!validId(req.params.id)) {
      throw journalError('Invalid trade ID.')
    }

    const post = await Journal.findByIdAndDelete(
      req.params.id,
    )

    if (!post) {
      throw journalError('Trade not found.', 404)
    }

    await cleanupScreenshot(post.imageKey)

    return res.json({
      message: 'Journal post deleted by admin.',
    })
  } catch (error) {
    return handleError(res, error)
  }
}