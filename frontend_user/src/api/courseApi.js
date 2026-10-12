export const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')

export async function courseApi(path = '', options = {}) {
  const headers = new Headers(options.headers)
  const method = (options.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CMM-Request', '1')
  }
  if (options.body instanceof FormData) headers.delete('Content-Type')
  const suffix = path ? `/${String(path).replace(/^\/+/, '')}` : ''
  const response = await fetch(`${BASE}/api/courses${suffix}`, {
    ...options, method, headers, credentials: 'include', cache: 'no-store',
  })
  if (response.status === 204) return { success: true }
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.message || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  if (data === null) throw new Error('The backend did not return JSON.')
  return data
}

export function jsonRequest(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export function coursePrice(course) {
  const raw = course?.price
  const price = Number(raw)
  if (raw == null || String(raw).trim() === '' || !Number.isFinite(price)) return 'Price unavailable'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: course.currency || 'USD',
    }).format(price)
  } catch { return `${price.toFixed(2)} USD` }
}

export function courseFileUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value, `${BASE}/`)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}