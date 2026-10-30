import { createHash } from 'node:crypto'

const CACHE_MS = 60000

// One shared check per minute per Node process, regardless of visitor count.
// This uses the channel owner's read-only OAuth connection, not search.list.
export function createYoutubeLiveService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  logger = console,
  credentialProvider = null,
} = {}) {
  const loadCredentials = credentialProvider || (async () => ({
    clientId: env.YOUTUBE_CLIENT_ID?.trim(), clientSecret: env.YOUTUBE_CLIENT_SECRET?.trim(),
    refreshToken: env.YOUTUBE_REFRESH_TOKEN?.trim(), channelId: env.YOUTUBE_CHANNEL_ID?.trim(),
  }))
  let credentials
  let configured = false
  let fingerprint = ''
  let generation = 0
  let token = null
  let tokenExpiresAt = 0
  let cached = null
  let validUntil = 0
  let inFlight = null

  const hidden = (available, checkedAt = null) => ({
    configured, available, isLive: false, videoId: null, title: '', checkedAt,
  })

  async function accessToken() {
    if (token && now() < tokenExpiresAt) return token
    const { clientId, clientSecret, refreshToken } = credentials
    const response = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error(`YouTube authorization failed (HTTP ${response.status})`)
    const data = await response.json()
    const lifetime = Number(data.expires_in)
    if (!data.access_token || !Number.isFinite(lifetime) || lifetime <= 0) {
      throw new Error('YouTube authorization response was invalid')
    }
    token = data.access_token
    tokenExpiresAt = now() + Math.max(0, lifetime - 60) * 1000
    return token
  }

  async function listActive(pageToken = '', retry = true) {
    const url = new URL('https://www.googleapis.com/youtube/v3/liveBroadcasts')
    url.search = new URLSearchParams({
      part: 'snippet,status',
      broadcastStatus: 'active',
      broadcastType: 'all',
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    }).toString()
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      signal: AbortSignal.timeout(10000),
    })
    if (response.status === 401 && retry) {
      token = null
      tokenExpiresAt = 0
      return listActive(pageToken, false)
    }
    if (!response.ok) throw new Error(`YouTube live status failed (HTTP ${response.status})`)
    const data = await response.json()
    if (!Array.isArray(data.items)) throw new Error('YouTube live status response was invalid')
    return data
  }

  async function refresh() {
    const run = generation
    let result
    try {
      credentials = await loadCredentials()
      configured = Boolean(credentials?.clientId && credentials?.clientSecret && credentials?.refreshToken &&
        /^UC[A-Za-z0-9_-]{22}$/.test(credentials?.channelId || ''))
      if (!configured) { result = hidden(false); return result }
      const nextFingerprint = createHash('sha256').update(JSON.stringify(credentials)).digest('hex')
      if (fingerprint !== nextFingerprint) { token = null; tokenExpiresAt = 0; fingerprint = nextFingerprint }
      let pageToken = ''
      const seenPages = new Set()
      do {
        const data = await listActive(pageToken)
        const live = data.items.find(item =>
          item.snippet?.channelId === credentials.channelId &&
          item.status?.privacyStatus === 'public' &&
          item.status?.lifeCycleStatus === 'live' &&
          item.snippet?.actualStartTime &&
          !item.snippet?.actualEndTime &&
          /^[A-Za-z0-9_-]{11}$/.test(item.id || ''),
        )
        if (live) {
          result = {
            configured: true, available: true, isLive: true,
            videoId: live.id, title: String(live.snippet.title || '').slice(0, 200),
            checkedAt: new Date(now()).toISOString(),
          }
          return result
        }
        pageToken = data.nextPageToken || ''
        if (pageToken && seenPages.has(pageToken)) throw new Error('YouTube pagination response was invalid')
        seenPages.add(pageToken)
      } while (pageToken)
      result = hidden(true, new Date(now()).toISOString())
    } catch (error) {
      // Drop a previous LIVE state instead of advertising an unverified stream.
      result = hidden(false)
      // Never log provider bodies, request URLs, tokens, or client secrets.
      const safeMessage = /^YouTube /.test(error?.message || '')
        ? error.message : 'YouTube live status could not be checked'
      logger.warn(safeMessage)
    } finally {
      if (run === generation) { cached = result; validUntil = now() + CACHE_MS }
    }
    return result
  }

  return {
    async getStatus() {
      if (cached && now() < validUntil) return cached
      const run = generation
      if (!inFlight) inFlight = refresh().finally(() => { inFlight = null })
      const result = await inFlight
      return run === generation ? result : this.getStatus()
    },
    invalidate() { generation += 1; cached = null; validUntil = 0; token = null; tokenExpiresAt = 0; fingerprint = '' },
  }
}

const youtubeLiveService = createYoutubeLiveService({
  credentialProvider: async () => {
    const { youtubeOAuth } = await import('./youtubeOAuth.runtime.js')
    return youtubeOAuth.getCredentials()
  },
})
export const getYoutubeLiveStatus = () => youtubeLiveService.getStatus()
export const invalidateYoutubeLiveStatus = () => youtubeLiveService.invalidate()
