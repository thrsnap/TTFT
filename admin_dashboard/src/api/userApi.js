const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
)
  .trim()
  .replace(/\/+$/, '')

const ADMIN_PATH = (
  import.meta.env.VITE_ADMIN_API_PATH || '/api/admin'
)
  .trim()
  .replace(/\/+$/, '')

async function request(path = '', options = {}) {
  const headers = new Headers(options.headers)
  const method = (options.method || 'GET').toUpperCase()

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CMM-Request', '1')
  }

  const response = await fetch(
    `${BASE}${ADMIN_PATH}/users${path}`,
    {
      ...options,
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
    },
  )

  if (response.status === 204 && response.ok) {
    return { success: true }
  }

  const data = await response.json().catch(() => null)

  if (!response.ok || data?.success === false) {
    const error = new Error(
      data?.message || `Request failed (${response.status})`,
    )

    error.status = response.status
    throw error
  }

  if (data === null) {
    throw new Error(
      'Backend did not return JSON. Check the API route.',
    )
  }

  return data
}

function json(method, body) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}

const encode = (value) => encodeURIComponent(String(value))

export const getUsers = (q = '', page = 1) =>
  request(
    `?${new URLSearchParams({
      q,
      page: String(page),
    })}`,
  )

export const addUser = (body) =>
  request('', json('POST', body))

export const editUser = (id, body) =>
  request(`/${encode(id)}`, json('PATCH', body))

export const deleteUser = (id) =>
  request(`/${encode(id)}`, { method: 'DELETE' })

// Access management.
// These routes must be implemented in the backend.
export const getUserAccess = (userId) =>
  request(`/${encode(userId)}/access`)

export const grantCourseAccess = (userId, courseId) =>
  request(
    `/${encode(userId)}/courses/${encode(courseId)}`,
    json('POST', {}),
  )

export const revokeCourseAccess = (userId, courseId) =>
  request(
    `/${encode(userId)}/courses/${encode(courseId)}`,
    { method: 'DELETE' },
  )

export const grantSignalAccess = (userId, expiresAt) =>
  request(
    `/${encode(userId)}/signal-access`,
    json('PATCH', { expiresAt }),
  )

export const revokeSignalAccess = (userId) =>
  request(
    `/${encode(userId)}/signal-access`,
    { method: 'DELETE' },
  )