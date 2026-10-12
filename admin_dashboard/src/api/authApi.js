import { getLoginTurnstileToken } from './turnstile.js'

const BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000'
)
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

async function request(path, options = {}) {
  const headers = new Headers(options.headers)
  const method = (options.method || 'GET').toUpperCase()

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

  if (response.status === 204 && response.ok) {
    return { success: true }
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(
      data?.message || `Request failed (${response.status})`,
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

export async function getCurrentUser() {
  try {
    const data = await request('/api/auth/me')
    return data.user || data
  } catch (error) {
    if (error.status === 401) return null
    throw error
  }
}

export function isAdmin(user) {
  return user?.role === 'admin'
}

export async function loginAdmin(email, password) {
  const turnstileToken = getLoginTurnstileToken()

  if (!turnstileToken) {
    throw new Error(
      'Complete the security verification before logging in.',
    )
  }

  const data = await request('/api/auth/login', {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
    },

    body: JSON.stringify({
      identifier: email.trim().toLowerCase(),
      password,
      turnstileToken,
    }),
  })

  if (!data?.user) {
    throw new Error(
      'The backend did not return login user details.',
    )
  }

  if (!isAdmin(data.user)) {
    throw new Error(
      'This account does not have admin access.',
    )
  }

  try {
    const session = await request('/api/auth/me')

    if (!isAdmin(session.user)) {
      throw new Error(
        'This account does not have admin access.',
      )
    }

    return session.user
  } catch (error) {
    if (error.status === 401) {
      throw new Error(
        'Login accepted, but the session could not be verified. ' +
        'Open https://panel.cmm-ft.com and try again.',
      )
    }

    throw error
  }
}