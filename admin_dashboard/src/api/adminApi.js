const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .trim().replace(/\/+$/, '')
const ADMIN_PATH = (import.meta.env.VITE_ADMIN_API_PATH || '/api/admin')
  .trim().replace(/\/+$/, '')

export async function adminApi(path = '', options = {}) {
  const cleanPath = String(path).replace(/^\/+/, '')
  const target = cleanPath === 'identity'
    ? `${BASE}/api/auth/me`
    : `${BASE}${ADMIN_PATH}/${cleanPath}`
  const headers = new Headers(options.headers)
  const method = (options.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('X-CMM-Request', '1')
  if (options.body instanceof FormData) headers.delete('Content-Type')
  const response = await fetch(target, {
    ...options, method, headers, credentials: 'include', cache: 'no-store',
  })
  if (response.status === 204) return { success: true }
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.message || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  if (data === null) throw new Error('The backend did not return JSON. Check the API route and backend URL.')
  if (cleanPath === 'identity') {
    const user = data.user || data
    if (user?.role !== 'admin') throw new Error('Admin access is required. Sign in with an admin account.')
    return { ...user, name: user.name || user.username || 'Administrator' }
  }
  return data
}
export function fileUrl(path) {
  if (!path) return ''
  try {
    const url = new URL(path, `${BASE}/`)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
export function externalUrl(path) {
  if (!path) return ''
  try {
    const url = new URL(path)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
// Compatibility with the generic admin media uploader from the earlier answer.
export async function uploadAdminMedia(file, kind) {
  const rules = {
    'signal-image': { size: 2 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
    'course-cover': { size: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
    'course-video': { size: 100 * 1024 * 1024, types: ['video/mp4', 'video/webm'] },
  }
  const rule = rules[kind]
  if (!rule || !(file instanceof File)) throw new Error('Choose a file and valid media kind.')
  if (!file.size || file.size > rule.size || !rule.types.includes(file.type)) throw new Error('Check the file format and maximum file size.')
  const body = new FormData()
  body.append('file', file)
  return adminApi(`upload?kind=${encodeURIComponent(kind)}`, { method: 'POST', body })
}