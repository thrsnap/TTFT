import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'

// Preserve the activation time across deployments so startup does not announce
// every older signal. Capture startup before new admin requests can arrive.
const backendStartedAt = new Date()
let activationPromise

function alertRecords() {
  return mongoose.connection.collection('telegram_signal_alerts')
}

export function telegramAlertsConfigured() {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
    process.env.TELEGRAM_CHANNEL_ID?.trim(),
  )
}

export function getTelegramAlertsStartAt() {
  if (!activationPromise) {
    activationPromise = (async () => {
      const records = alertRecords()
      try {
        await records.updateOne(
          { _id: 'activation' },
          { $setOnInsert: { activatedAt: backendStartedAt } },
          { upsert: true },
        )
      } catch (error) {
        if (error.code !== 11000) throw error
      }
      const record = await records.findOne({ _id: 'activation' })
      const startedAt = new Date(record?.activatedAt)
      if (!Number.isFinite(startedAt.getTime())) {
        throw new Error('Invalid Telegram alert activation record.')
      }
      return startedAt
    })().catch(error => {
      activationPromise = undefined
      throw error
    })
  }
  return activationPromise
}

// Format the release instant independently of the server's timezone.
// Set TELEGRAM_TIME_ZONE to use a different IANA timezone.
function formatReleaseTime(releasedAt, sentAt) {
  const releaseTime = new Date(releasedAt)
  let timeZone = process.env.TELEGRAM_TIME_ZONE?.trim() || 'Asia/Kolkata'
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone }).format(releaseTime)
  } catch {
    timeZone = 'Asia/Kolkata'
    console.error('Invalid TELEGRAM_TIME_ZONE; using Asia/Kolkata.')
  }

  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(releaseTime)

  const seconds = Math.max(0, Math.floor((sentAt - releaseTime) / 1000))
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'always' })
  let ago = 'Just now'
  if (seconds >= 86400) {
    ago = relative.format(-Math.floor(seconds / 86400), 'day')
  } else if (seconds >= 3600) {
    ago = relative.format(-Math.floor(seconds / 3600), 'hour')
  } else if (seconds >= 60) {
    ago = relative.format(-Math.floor(seconds / 60), 'minute')
  }

  return { date, ago }
}

function telegramDebug(signal, type, stage, extra = {}) {
  if (process.env.TELEGRAM_ALERT_DEBUG !== '1') return
  console.log('Telegram alert debug:', {
    signalId: signal?._id ? String(signal._id) : null,
    type,
    stage,
    ...extra,
  })
}

export async function sendSignalReleasedAlert(signal, type = 'News Signal') {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim()
  if (!token || !chatId) {
    console.error('Telegram alert skipped: bot token or channel ID is missing.')
    return null
  }
  if (!signal?._id) {
    console.error('Telegram alert skipped: signal ID is missing.')
    return null
  }
  telegramDebug(signal, type, 'called', {
    releasedAt: signal.releasedAt || null,
    currentTime: new Date().toISOString(),
  })
  if (signal.archivedAt) {
    telegramDebug(signal, type, 'skipped: signal is archived')
    return null
  }
  const isDaily = type === 'Daily Signal'
  if (isDaily && signal.status !== 'published') {
    telegramDebug(signal, type, 'skipped: Daily Signal is not published')
    return null
  }
  const dueAt = signal.releasedAt ? new Date(signal.releasedAt) : null
  if (dueAt && (!Number.isFinite(dueAt.getTime()) || dueAt > new Date())) {
    telegramDebug(signal, type, 'skipped: release time is invalid or in the future', {
      releasedAt: Number.isFinite(dueAt.getTime()) ? dueAt.toISOString() : 'invalid',
    })
    return null
  }

  // Shared by direct release handlers and the background lifecycle check.
  await getTelegramAlertsStartAt()
  const records = alertRecords()
  const signalId = String(signal._id)
  const alertType = isDaily ? 'Daily Signal' : 'News Signal'
  const key = `${isDaily ? 'daily' : 'news'}:${signalId}`
  const now = new Date()
  try {
    await records.updateOne(
      { _id: key },
      { $setOnInsert: {
        signalId, type: alertType, createdAt: now, sentAt: null,
        lockedUntil: new Date(0), nextAttemptAt: new Date(0), attempts: 0,
      } },
      { upsert: true },
    )
  } catch (error) {
    if (error.code !== 11000) throw error
  }

  const claimId = randomUUID()
  const claimed = await records.updateOne(
    { _id: key, sentAt: null, lockedUntil: { $lte: now }, nextAttemptAt: { $lte: now } },
    { $set: { claimId, lockedUntil: new Date(now.getTime() + 120000) }, $inc: { attempts: 1 } },
  )
  if (!claimed.modifiedCount) {
    const record = await records.findOne({ _id: key })
    telegramDebug(signal, type, record?.sentAt
      ? 'skipped: this signal ID was already sent'
      : 'skipped: delivery is in progress or waiting for retry', {
        messageId: record?.messageId || null,
        sentAt: record?.sentAt || null,
        nextAttemptAt: record?.nextAttemptAt || null,
        lockedUntil: record?.lockedUntil || null,
      })
    return record?.sentAt ? record.messageId : null
  }

  async function failed(reason, retrySeconds = 60) {
    const retryMs = Math.max(60, Number(retrySeconds) || 60) * 1000
    await records.updateOne(
      { _id: key, claimId, sentAt: null },
      { $set: {
        lockedUntil: new Date(0),
        nextAttemptAt: new Date(Date.now() + retryMs),
        lastError: String(reason).slice(0, 300),
      } },
    )
    console.error('Telegram signal alert failed:', reason)
    return null
  }

  const release = formatReleaseTime(dueAt || now, new Date())
  const text = [
    `CMM-FT — ${alertType} Released`,
    '',
    signal.pair ? `📊 Pair: ${String(signal.pair).slice(0, 30)}` : null,
    signal.title ? `📝 Title: ${String(signal.title).slice(0, 100)}` : null,
    '',
    `📅 Release date: ${release.date}`,
    `⏱ Released: ${release.ago}`,
    '',
    'Please visit to website and log in to get the signal.Thank you.',
  ].filter(line => line !== null).join('\n')

  telegramDebug(signal, type, 'sending to Telegram')
  let response
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text,
        reply_markup: { inline_keyboard: [[
          { text: 'Visit to website', url: 'https://cmm-ft.com/signal' },
        ]] },
      }),
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    // Never log a network error containing the bot-token URL.
    return failed('Network request failed or timed out.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.ok || !data?.result?.message_id) {
    return failed(
      data?.description || `Telegram returned HTTP ${response.status}.`,
      data?.parameters?.retry_after,
    )
  }
  const messageId = data.result.message_id
  await records.updateOne(
    { _id: key, claimId, sentAt: null },
    { $set: {
      sentAt: new Date(), messageId, lockedUntil: new Date(0), lastError: null,
    } },
  )
  console.log(`Telegram ${alertType} alert sent. Message ID: ${messageId}`)
  return messageId
}
