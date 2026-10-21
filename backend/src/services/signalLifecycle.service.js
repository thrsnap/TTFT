import Signal from '../models/signal.model.js'
import DailySignal from '../models/dailySignal.model.js'
import { releaseDates } from './signalReleaseTime.js'
import {
  getTelegramAlertsStartAt,
  sendSignalReleasedAlert,
  telegramAlertsConfigured,
} from './telegram.service.js'

let running
let initialized = false
let timer
let alertsRunning

async function initializeExisting(Model, daily, now) {
  let after
  while (true) {
    const rows = await Model.find({
      archivedAt: null,
      $or: [
        { releasedAt: null },
        { autoArchiveAt: null },
        { releasedAt: { $gt: now } },
      ],
      ...(daily ? { status: 'published' } : {}),
      details: { $regex: /\S/ },
      image: { $exists: true },
      ...(after ? { _id: { $gt: after } } : {}),
    })
      .select('scheduledAt createdAt updatedAt status releasedAt autoArchiveAt details')
      .select('+image')
      .sort({ _id: 1 })
      .limit(20)
    if (!rows.length) break
    for (const row of rows) {
      after = row._id
      if (!row.image?.length || !row.details?.trim()) continue
      // Preserve historic releases. Ready cards with future timestamps were
      // stamped from scheduledAt; restore their recorded publishing time.
      const dates = releaseDates(
        row,
        row.updatedAt || row.createdAt || row.scheduledAt,
      )
      await Model.updateOne({
        _id: row._id,
        archivedAt: null,
        $or: [
          { releasedAt: null },
          { autoArchiveAt: null },
          { releasedAt: { $gt: now } },
        ],
      }, { $set: dates }, { timestamps: false, runValidators: true })
    }
  }
}

export function archiveExpiredSignals(now = new Date()) {
  if (running) return running
  running = (async () => {
    if (!initialized) {
      await initializeExisting(Signal, false, now)
      await initializeExisting(DailySignal, true, now)
      initialized = true
    }
    // Preserve charts and subscriptions when moving a card into history.
    await Promise.all([
      Signal.updateMany(
        { archivedAt: null, autoArchiveAt: { $lte: now } },
        { $set: { archivedAt: now, archivedBy: null, archiveReason: 'next-day' } },
      ),
      DailySignal.updateMany(
        { archivedAt: null, status: 'published', autoArchiveAt: { $lte: now } },
        { $set: { archivedAt: now, archivedBy: null, archiveReason: 'next-day' } },
      ),
    ])
  })().finally(() => { running = undefined })
  return running
}

async function notifyModelReleases(Model, type, now, activatedAt) {
  let after
  while (true) {
    const rows = await Model.find({
      archivedAt: null,
      releasedAt: { $gte: activatedAt, $lte: now },
      ...(type === 'Daily Signal' ? { status: 'published' } : {}),
      details: { $regex: /\S/ },
      image: { $exists: true },
      ...(after ? { _id: { $gt: after } } : {}),
    })
      .select('_id pair title status releasedAt archivedAt')
      .sort({ _id: 1 })
      .limit(20)
      .lean()
    if (!rows.length) break
    for (const row of rows) {
      after = row._id
      // Do not load all chart bytes merely to check whether a chart exists.
      const ready = await Model.exists({
        _id: row._id,
        archivedAt: null,
        ...(type === 'Daily Signal' ? { status: 'published' } : {}),
        releasedAt: { $gte: activatedAt, $lte: now },
        details: { $regex: /\S/ },
        image: { $type: 'binData', $ne: Buffer.alloc(0) },
      })
      if (!ready) continue
      try {
        await sendSignalReleasedAlert(row, type)
      } catch {
        // Keep processing other cards if an alert's delivery record fails.
        console.error(`Telegram ${type} background alert failed.`)
      }
    }
  }
}

export function notifyReleasedSignals(now = new Date()) {
  if (!telegramAlertsConfigured()) return Promise.resolve()
  if (alertsRunning) return alertsRunning
  alertsRunning = (async () => {
    const activatedAt = await getTelegramAlertsStartAt()
    await notifyModelReleases(Signal, 'News Signal', now, activatedAt)
    await notifyModelReleases(DailySignal, 'Daily Signal', now, activatedAt)
  })().finally(() => { alertsRunning = undefined })
  return alertsRunning
}

export function signalLifecycleMiddleware(req, res, next) {
  // HTTP reads only wait for archiving, never for Telegram delivery.
  archiveExpiredSignals().then(() => next(), next)
}

export function startSignalLifecycle() {
  if (timer) return
  timer = setInterval(() => {
    archiveExpiredSignals()
      .then(() => notifyReleasedSignals())
      .catch(() => console.error('Signal lifecycle background check failed.'))
  }, 60_000)
  timer.unref?.()
}
