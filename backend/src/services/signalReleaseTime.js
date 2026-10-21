export function signalTimeZone() {
  const zone = process.env.SIGNAL_TIME_ZONE?.trim() || 'Asia/Kolkata'
  new Intl.DateTimeFormat('en', { timeZone: zone }).format(new Date())
  return zone
}

function parts(value, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(value))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  )
}

// The next calendar midnight in the website timezone, not a 24-hour delay.
export function nextSignalMidnight(value, timeZone = signalTimeZone()) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Invalid signal release date.')
  }

  const localDate = parts(date, timeZone)
  const target = Date.UTC(localDate.year, localDate.month - 1, localDate.day + 1)
  let guess = target

  for (let i = 0; i < 5; i++) {
    const local = parts(guess, timeZone)
    const delta = target - Date.UTC(
      local.year, local.month - 1, local.day,
      local.hour, local.minute, local.second,
    )
    if (!delta) return new Date(guess)
    guess += delta
  }

  throw new Error('Unable to calculate signal midnight. Check SIGNAL_TIME_ZONE.')
}

export function releaseDates(signal, readyAt = new Date()) {
  const now = new Date()
  const ready = new Date(readyAt)
  if (!Number.isFinite(ready.getTime())) {
    throw new Error('Invalid signal publishing date.')
  }

  const previous = signal.releasedAt ? new Date(signal.releasedAt) : null
  const preservePrevious = previous &&
    Number.isFinite(previous.getTime()) &&
    previous.getTime() <= now.getTime()

  // A ready signal is released when published. scheduledAt remains its event
  // date. Preserve its first actual release, and repair older future dates.
  const releasedAt = preservePrevious
    ? previous
    : new Date(Math.min(ready.getTime(), now.getTime()))

  return { releasedAt, autoArchiveAt: nextSignalMidnight(releasedAt) }
}
