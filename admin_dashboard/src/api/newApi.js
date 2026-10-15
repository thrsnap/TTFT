const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CMM-Request', '1')
  }

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
  })

  if (response.ok && response.status === 204) {
    return { success: true }
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(
      data?.message || `Request failed (${response.status})`,
    )
    error.status = response.status
    throw error
  }

  if (!data) {
    throw new Error('The backend did not return JSON')
  }

  return data
}

function jsonOptions(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function capitalize(value) {
  const text = String(value || '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function scheduledAt(value) {
  if (!value) {
    throw new Error('Select the news date and time.')
  }

  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    throw new Error('Select a valid news date and time.')
  }

  return date.toISOString()
}

function objectId(value, label) {
  const id = String(value || '').trim()

  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    throw new Error(`Enter a valid ${label}.`)
  }

  return id
}

export async function getNewsRecords() {
  const [calendar, signals] = await Promise.all([
    request('/api/calendar'),
    request('/api/signals/admin'),
  ])

  return [
    ...calendar.events.map(event => ({
      ...event,
      id: String(event._id),
      kind: 'events',
      impact: capitalize(event.impact),
      status: capitalize(event.status),
    })),

    ...signals.signals.map(signal => ({
      ...signal,
      id: String(signal._id),
      kind: 'signals',
      status: signal.confirmed ? 'Confirmed' : 'Pending',
      audience: 'One payment per signal',
    })),
  ]
}

export async function saveCalendarEvent(draft) {
  const body = {
    title: draft.title,
    country: draft.country,
    currency: draft.currency,
    scheduledAt: scheduledAt(draft.scheduledAt),
    impact: String(draft.impact).toLowerCase(),
    forecast: draft.forecast || null,
    previous: draft.previous || null,
    actual: draft.actual || null,
    status: String(draft.status).toLowerCase(),
    sourceUrl: draft.sourceUrl || '',
  }

  return request(
    draft.id
      ? `/api/calendar/${encodeURIComponent(draft.id)}`
      : '/api/calendar',
    jsonOptions(draft.id ? 'PATCH' : 'POST', body),
  )
}

export async function saveNewsSignal(draft, imageFile = null) {
  const fields = {
    title: String(draft.title || '').trim(),
    pair: String(draft.pair || '').trim().toUpperCase(),
    scheduledAt: scheduledAt(draft.scheduledAt),
    newsType: String(draft.newsType || '').trim(),
    direction: String(draft.direction || 'pending')
      .trim()
      .toLowerCase(),
    confirmed:
      draft.confirmed === true || draft.confirmed === 'true',
    details: String(draft.details || '').trim(),
    news: String(draft.news || '').trim(),
    previewText: String(
      draft.previewText ??
        'Purchase this signal to unlock the chart and technical analysis.',
    ).trim(),
  }

  if (!fields.title || !fields.pair || !fields.newsType) {
    throw new Error('Complete the title, pair and news type.')
  }

  if (!['pending', 'buy', 'sell'].includes(fields.direction)) {
    throw new Error('Select a valid signal direction.')
  }

  if (fields.confirmed && fields.direction === 'pending') {
    throw new Error(
      'A confirmed signal must have direction buy or sell.',
    )
  }

  const id = draft.id || draft._id

  const path = id
    ? `/api/signals/${encodeURIComponent(id)}`
    : '/api/signals'

  const method = id ? 'PATCH' : 'POST'

  // Create or edit without an image.
  if (!imageFile) {
    return request(path, jsonOptions(method, fields))
  }

  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(
      imageFile.type,
    )
  ) {
    throw new Error('Use a JPG, PNG or WebP image.')
  }

  if (imageFile.size > 2 * 1024 * 1024) {
    throw new Error('The signal image must be 2 MB or smaller.')
  }

  const body = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    body.append(key, String(value))
  }

  body.append('image', imageFile)

  // The browser sets the multipart Content-Type.
  return request(path, {
    method,
    body,
  })
}

// Admin approval after confirming payment.
// Unlocks only the selected signal.
export function grantSignalAccess({ userId, signalId }) {
  return request(
    '/api/signals/access',
    jsonOptions('POST', {
      userId: objectId(userId, 'user MongoDB ID'),
      signalId: objectId(signalId, 'signal ID'),
    }),
  )
}

export function deleteNewsRecord(record) {
  const recordId = record.id || record._id

  if (!recordId) {
    throw new Error('Missing record ID.')
  }

  const id = encodeURIComponent(recordId)

  const path = record.kind === 'events'
    ? `/api/calendar/${id}`
    : `/api/signals/${id}`

  return request(path, { method: 'DELETE' })
}