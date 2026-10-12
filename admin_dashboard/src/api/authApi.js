const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')

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

export async function loginAdmin(identifier, password) {
  await request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: identifier.trim(),
      password,
    }),
  })

  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Could not verify your login')
  }

  if (!isAdmin(user)) {
    throw new Error('This account does not have admin access')
  }

  return user
}