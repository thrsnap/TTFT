const API_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '')

export async function api(path, method = 'GET', body) {
  const endpoint = path.startsWith('/') ? path : `/${path}`

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    credentials: 'include',

    headers: {
      'Content-Type': 'application/json',
      'X-CMM-Request': '1',
    },

    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(
      data.message || `Request failed (${response.status})`
    )

    error.status = response.status
    error.data = data

    throw error
  }

  return data
}