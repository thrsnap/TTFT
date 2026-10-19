export function signalTimeZone() {
  const zone = process.env.SIGNAL_TIME_ZONE?.trim() || 'Asia/Kolkata'
  new Intl.DateTimeFormat('en', { timeZone: zone }).format(new Date())
  return zone
}

function parts(value, timeZone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]))
}

// The next calendar midnight in the website timezone, not a 24-hour delay.
export function nextSignalMidnight(value, timeZone = signalTimeZone()) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid signal release date.')
  const p = parts(date, timeZone)
  const target = Date.UTC(p.year, p.month - 1, p.day + 1)
  let guess = target
  for (let i = 0; i < 5; i++) {
    const local = parts(guess, timeZone)
    const delta = target - Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)
    if (!delta) return new Date(guess)
    guess += delta
  }
  throw new Error('Unable to calculate signal midnight. Check SIGNAL_TIME_ZONE.')
}

export function releaseDates(signal, readyAt = new Date()) {
  const ready = new Date(readyAt).getTime()
  const scheduled = new Date(signal.scheduledAt).getTime()
  const releasedAt = signal.releasedAt ? new Date(signal.releasedAt) : new Date(Math.max(ready, Number.isFinite(scheduled) ? scheduled : ready))
  return { releasedAt, autoArchiveAt: nextSignalMidnight(releasedAt) }
}
