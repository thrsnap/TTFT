import { getLoginTurnstileToken } from './turnstile.js'

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000'
)
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

export async function api(path, method = 'GET', body) {
  const normalizedPath = path.startsWith('/')
    ? path
    : `/${path}`

  const endpoint =
    normalizedPath === '/api' ||
    normalizedPath.startsWith('/api/')
      ? normalizedPath
      : `/api${normalizedPath}`

  const requestMethod = method.toUpperCase()
  let payload = body

  if (
    requestMethod === 'POST' &&
    endpoint === '/api/auth/login'
  ) {
    const token = getLoginTurnstileToken()

    if (!token) {
      const error = new Error(
        'Complete the security verification first.',
      )
      error.status = 400
      throw error
    }

    payload = {
      ...body,
      turnstileToken: token,
    }
  }

  const headers = new Headers()

  if (payload !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(requestMethod)) {
    headers.set('X-CMM-Request', '1')
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: requestMethod,
    credentials: 'include',
    cache: 'no-store',
    headers,

    ...(payload === undefined
      ? {}
      : { body: JSON.stringify(payload) }),
  })

  if (response.status === 204 && response.ok) {
    return { success: true }
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      `Request failed (${response.status})`,
    )

    error.status = response.status
    error.data = data
    throw error
  }

  if (data === null) {
    throw new Error('The backend did not return JSON.')
  }

  return data
}