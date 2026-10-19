import Signal from '../models/signal.model.js'
import DailySignal from '../models/dailySignal.model.js'
import { releaseDates } from './signalReleaseTime.js'

let running
let initialized = false
let timer

async function initializeExisting(Model, daily) {
  let after
  while (true) {
    const rows = await Model.find({
      archivedAt: null,
      $or: [{ releasedAt: null }, { autoArchiveAt: null }],
      ...(daily ? { status: 'published' } : {}),
      details: { $regex: /\S/ }, image: { $exists: true },
      ...(after ? { _id: { $gt: after } } : {}),
    }).select('scheduledAt createdAt updatedAt status releasedAt autoArchiveAt details')
      .select('+image').sort({ _id: 1 }).limit(20)
    if (!rows.length) break
    for (const row of rows) {
      after = row._id
      if (!row.image?.length || !row.details?.trim()) continue
      // Historic documents have no first-release timestamp. Preserve the best
      // existing date; installation must not give old signals a new release day.
      const dates = releaseDates(row, row.updatedAt || row.createdAt || row.scheduledAt)
      await Model.updateOne({
        _id: row._id, archivedAt: null,
        $or: [{ releasedAt: null }, { autoArchiveAt: null }],
      }, { $set: dates }, { timestamps: false, runValidators: true })
    }
  }
}

export function archiveExpiredSignals(now = new Date()) {
  if (running) return running
  running = (async () => {
    if (!initialized) {
      await initializeExisting(Signal, false)
      await initializeExisting(DailySignal, true)
      initialized = true
    }
    // Each document moves once; chart bytes and subscription records are kept.
    await Promise.all([
      Signal.updateMany({ archivedAt: null, autoArchiveAt: { $lte: now } },
        { $set: { archivedAt: now, archivedBy: null, archiveReason: 'next-day' } }),
      DailySignal.updateMany({ archivedAt: null, status: 'published', autoArchiveAt: { $lte: now } },
        { $set: { archivedAt: now, archivedBy: null, archiveReason: 'next-day' } }),
    ])
  })().finally(() => { running = undefined })
  return running
}

export function signalLifecycleMiddleware(req, res, next) {
  archiveExpiredSignals().then(() => next(), next)
}

// Reads also catch up immediately after a sleeping backend wakes up.
export function startSignalLifecycle() {
  if (timer) return
  timer = setInterval(() => {
    archiveExpiredSignals().catch(error => console.error('Signal history rollover failed:', error.message))
  }, 60_000)
  timer.unref?.()
}
