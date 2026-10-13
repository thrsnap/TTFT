const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim().replace(/\/+$/, '')

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('X-CMM-Request', '1')
  const response = await fetch(`${BASE}/api/analysis/${path}`, {
    ...options, method, headers, credentials: 'include', cache: 'no-store',
  })
  if (response.ok && response.status === 204) return { success: true }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.message || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  if (!data) throw new Error('The backend did not return JSON.')
  return data
}
function create(path, body) {
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
export function createAnalysisPost(post, images = []) {
  if (!images.length) return create('posts', post)
  const body = new FormData()
  for (const [key, value] of Object.entries(post)) {
    if (value !== undefined && value !== null) body.append(key, key === 'pictures' ? JSON.stringify(value) : String(value))
  }
  for (const image of images) body.append('images', image)
  return request('posts', { method: 'POST', body })
}
export function createAnalysisDocument(document, file = null) {
  if (!file) return create('documents', document)
  const body = new FormData()
  for (const [key, value] of Object.entries(document)) {
    if (key !== 'url' && value !== undefined && value !== null) body.append(key, String(value))
  }
  body.append('file', file)
  return request('documents', { method: 'POST', body })
}
export function updateAnalysisPost(id, post, images = []) {
  const path = `posts/${encodeURIComponent(id)}`
  if (!images.length) return request(path, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(post),
  })
  const body = new FormData()
  for (const [key, value] of Object.entries(post)) {
    if (value !== undefined && value !== null) body.append(key, key === 'pictures' ? JSON.stringify(value) : String(value))
  }
  for (const image of images) body.append('images', image)
  return request(path, { method: 'PATCH', body })
}
export function updateAnalysisDocument(id, document, file = null) {
  const path = `documents/${encodeURIComponent(id)}`
  if (!file) return request(path, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(document),
  })
  const body = new FormData()
  for (const [key, value] of Object.entries(document)) {
    if (key !== 'url' && value !== undefined && value !== null) body.append(key, String(value))
  }
  body.append('file', file)
  return request(path, { method: 'PATCH', body })
}
export function deleteAnalysisPost(id) {
  return request(`posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export function deleteAnalysisDocument(id) {
  return request(`documents/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export function deleteAnalysisRecord(record) {
  const id = record?.id || record?._id
  if (!id) throw new Error('This record has no ID.')
  if (record.kind === 'analysis') return deleteAnalysisPost(id)
  if (record.kind === 'documents') return deleteAnalysisDocument(id)
  throw new Error('Unknown analysis record type.')
}
function fileUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value, `${BASE}/`)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}
export async function getAnalysisRecords() {
  const data = await request('admin')
  if (!Array.isArray(data.posts) || !Array.isArray(data.documents)) throw new Error('Invalid analysis response: expected posts and documents arrays.')
  const posts = data.posts.map(post => ({
    ...post, id: post.id || post._id, kind: 'analysis', pair: post.symbol,
    pictures: (post.pictures || []).map(fileUrl).filter(Boolean),
    category: post.category === 'PDArray' ? 'PD Array' : post.category,
    status: post.pendingDelete ? 'Cleanup pending' : post.status === 'published' ? 'Published' : 'Draft',
  }))
  const documents = data.documents.map(document => ({
    ...document, id: document.id || document._id, kind: 'documents', url: fileUrl(document.url),
    status: document.pendingDelete ? 'Cleanup pending' : document.status === 'published' ? 'Published' : 'Draft',
  }))
  return [...posts, ...documents]
}
