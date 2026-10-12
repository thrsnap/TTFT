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
      audience: 'Subscribers only',
    })),
  ]
}

function capitalize(value) {
  const text = String(value || '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export async function saveCalendarEvent(draft) {
  const body = {
    title: draft.title,
    country: draft.country,
    currency: draft.currency,
    scheduledAt: new Date(draft.scheduledAt).toISOString(),
    impact: String(draft.impact).toLowerCase(),
    forecast: draft.forecast || null,
    previous: draft.previous || null,
    actual: draft.actual || null,
    status: String(draft.status).toLowerCase(),
    sourceUrl: draft.sourceUrl || '',
  }

  return request(
    draft.id ? `/api/calendar/${draft.id}` : '/api/calendar',
    jsonOptions(draft.id ? 'PATCH' : 'POST', body),
  )
}

export async function saveNewsSignal(draft, imageFile) {
  const fields = {
    title: draft.title,
    pair: draft.pair,
    scheduledAt: new Date(draft.scheduledAt).toISOString(),
    direction: draft.direction || 'pending',
    confirmed: draft.confirmed === true || draft.confirmed === 'true',
    details: draft.details || '',
    news: draft.news || '',
    previewText: draft.previewText || '',
  }

  // Leave newsType at its model default when no value is supplied.
  if (draft.newsType?.trim()) {
    fields.newsType = draft.newsType.trim()
  }

  if (draft.id) {
    return request(
      `/api/signals/${draft.id}`,
      jsonOptions('PATCH', fields),
    )
  }

  if (!imageFile) {
    throw new Error('Select a signal image')
  }

  const body = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    body.append(key, String(value))
  }

  body.append('image', imageFile)

  return request('/api/signals', {
    method: 'POST',
    body,
  })
}

export function deleteNewsRecord(record) {
  const path = record.kind === 'events'
    ? `/api/calendar/${record.id}`
    : `/api/signals/${record.id}`

  return request(path, { method: 'DELETE' })
}