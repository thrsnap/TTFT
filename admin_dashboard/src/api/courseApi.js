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
  if (typeof options.onUploadProgress === 'function') {
    return uploadRequest(`${BASE}/api/courses${suffix}`, {
      ...options, method, headers,
    })
  }
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

function uploadRequest(url, options) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const signal = options.signal
    let settled = false

    function finish(callback, value) {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      callback(value)
    }

    function abort() {
      const error = new Error('Upload canceled.')
      error.name = 'AbortError'
      // Settle before abort() dispatches any synchronous request events.
      finish(reject, error)
      xhr.abort()
    }

    // Register upload listeners before opening the request. Percentages
    // describe bytes transferred; success still requires the server response.
    xhr.upload.addEventListener('progress', event => {
      if (settled) return
      const total = event.lengthComputable && event.total > 0 ? event.total : 0
      options.onUploadProgress({
        loaded: event.loaded,
        total,
        percent: total ? Math.min(100, Math.max(0, Math.floor(event.loaded / total * 100))) : null,
      })
    })
    xhr.upload.addEventListener('load', () => {
      if (!settled) options.onUploadProgress({ percent: 100 })
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 204) return finish(resolve, { success: true })
      let data = null
      try { data = JSON.parse(xhr.responseText) } catch { /* Checked below. */ }
      if (xhr.status < 200 || xhr.status >= 300 || data?.success === false) {
        const error = new Error(data?.message || `Request failed (${xhr.status})`)
        error.status = xhr.status
        return finish(reject, error)
      }
      if (data === null) {
        return finish(reject, new Error('The backend did not return JSON.'))
      }
      finish(resolve, data)
    })
    xhr.addEventListener('error', () => {
      finish(reject, new Error('Upload failed. Check your connection and try again.'))
    })
    xhr.addEventListener('abort', () => {
      const error = new Error('Upload canceled.')
      error.name = 'AbortError'
      finish(reject, error)
    })
    xhr.addEventListener('timeout', () => {
      finish(reject, new Error('The upload timed out. Please try again.'))
    })

    if (signal?.aborted) return abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      xhr.open(options.method, url, true)
      xhr.withCredentials = true
      options.headers.forEach((value, key) => xhr.setRequestHeader(key, value))
      // Leave Content-Type unset for FormData so the browser adds its boundary.
      xhr.send(options.body)
    } catch (error) {
      finish(reject, error)
    }
  })
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
