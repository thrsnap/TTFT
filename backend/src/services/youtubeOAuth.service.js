import { createHash, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'
const CALLBACK_PATH = '/api/youtube/oauth/callback'
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const CHANNEL = /^UC[A-Za-z0-9_-]{22}$/
const digest = value => createHash('sha256').update(value).digest('hex')
const randomToken = () => randomBytes(32).toString('base64url')

export class YoutubeConnectError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

export function isYoutubeAdmin(authorization, expectedKey) {
  const match = typeof authorization === 'string' && authorization.match(/^Bearer (.+)$/i)
  if (!match || !expectedKey?.trim()) return false
  return timingSafeEqual(Buffer.from(digest(match[1])), Buffer.from(digest(expectedKey.trim())))
}

function seal(value, key, purpose) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(`cmm-ft/youtube/${purpose}/v1`))
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

function unseal(value, key, purpose) {
  const [version, iv, tag, encrypted, extra] = String(value).split('.')
  if (version !== 'v1' || !iv || !tag || !encrypted || extra) throw new Error('Invalid encrypted YouTube credential')
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  cipher.setAAD(Buffer.from(`cmm-ft/youtube/${purpose}/v1`))
  cipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([cipher.update(Buffer.from(encrypted, 'base64url')), cipher.final()]).toString('utf8')
}

export function youtubeBrowserCookieName(state) {
  return `cmm_yt_${String(state).slice(0, 16)}`
}

export function createYoutubeOAuthService({ repository, env = process.env, fetchImpl = globalThis.fetch, now = Date.now }) {
  function config() {
    const clientId = env.YOUTUBE_CLIENT_ID?.trim()
    const clientSecret = env.YOUTUBE_CLIENT_SECRET?.trim()
    const keyHex = env.YOUTUBE_TOKEN_ENCRYPTION_KEY?.trim()
    if (!clientId || !clientSecret || !/^[a-fA-F0-9]{64}$/.test(keyHex || '')) {
      throw new YoutubeConnectError('Configure the YouTube web client and token encryption key on the API first.', 503)
    }
    let redirect
    try { redirect = new URL(env.YOUTUBE_REDIRECT_URI || 'https://api.cmm-ft.com' + CALLBACK_PATH) } catch {
      throw new YoutubeConnectError('The YouTube redirect URI is invalid.', 503)
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname)
    if ((redirect.protocol !== 'https:' && !(local && redirect.protocol === 'http:')) ||
      redirect.pathname !== CALLBACK_PATH || redirect.username || redirect.password || redirect.search || redirect.hash) {
      throw new YoutubeConnectError('Use an HTTPS YouTube callback URL ending in ' + CALLBACK_PATH, 503)
    }
    return { clientId, clientSecret, key: Buffer.from(keyHex, 'hex'), redirectUri: redirect.href,
      apiRoot: redirect.origin + '/api/youtube', secureCookie: redirect.protocol === 'https:' }
  }

  async function issueLink(expectedChannelId) {
    const cfg = config()
    const previous = await repository.readConnection()
    const channelId = expectedChannelId || env.YOUTUBE_CHANNEL_ID?.trim() || previous?.channelId || null
    if (channelId && !CHANNEL.test(channelId)) throw new YoutubeConnectError('Provide a valid YouTube channel ID starting with UC.')
    const invite = randomToken()
    const expiresAt = new Date(now() + 30 * 60 * 1000)
    await repository.createAttempt({ inviteHash: digest(invite), phase: 'issued', oauthClientId: cfg.clientId,
      expectedChannelId: channelId, expiresAt })
    // The fragment is not sent to the server or to message-preview crawlers.
    return { connectUrl: cfg.apiRoot + '/connect#' + invite, expiresAt: expiresAt.toISOString() }
  }

  async function beginAuthorization(invite) {
    const cfg = config()
    if (typeof invite !== 'string' || !TOKEN.test(invite)) throw new YoutubeConnectError('This connection link is invalid or incomplete.', 410)
    const state = randomToken()
    const browserToken = randomToken()
    const verifier = randomBytes(48).toString('base64url')
    const authExpiresAt = new Date(now() + 10 * 60 * 1000)
    const attempt = await repository.claimInvite(digest(invite), new Date(now()), {
      phase: 'authorizing', stateHash: digest(state), browserHash: digest(browserToken),
      verifierEncrypted: seal(verifier, cfg.key, 'pkce'), authExpiresAt,
    })
    if (!attempt || attempt.oauthClientId !== cfg.clientId) throw new YoutubeConnectError('This connection link has expired or has already been used. Ask the admin for a new link.', 410)
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authorizationUrl.search = new URLSearchParams({
      client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: 'code',
      scope: YOUTUBE_SCOPE, access_type: 'offline', prompt: 'consent', state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    }).toString()
    return { authorizationUrl: authorizationUrl.href, state, browserToken, secureCookie: cfg.secureCookie }
  }

  async function completeAuthorization({ state, browserToken, code, error }) {
    const cfg = config()
    if (typeof state !== 'string' || typeof browserToken !== 'string' || !TOKEN.test(state) || !TOKEN.test(browserToken)) {
      throw new YoutubeConnectError('Please open the connection link and complete Google approval in the same browser.')
    }
    const attempt = await repository.takeState(digest(state), digest(browserToken), new Date(now()))
    if (!attempt || attempt.oauthClientId !== cfg.clientId) throw new YoutubeConnectError('This approval has expired or has already been used. Ask the admin for a new link.', 410)
    try {
      if (error) throw new YoutubeConnectError('YouTube access was not approved. Ask the admin for a new connection link.')
      if (typeof code !== 'string' || !code || code.length > 4096) throw new YoutubeConnectError('Google did not return an authorization code.')
      const tokenResponse = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri, grant_type: 'authorization_code', code,
          code_verifier: unseal(attempt.verifierEncrypted, cfg.key, 'pkce') }),
        signal: AbortSignal.timeout(15000),
      })
      if (!tokenResponse.ok) throw new YoutubeConnectError('Google could not complete this authorization. Ask the admin for a new link.', 502)
      const tokens = await tokenResponse.json()
      if (!tokens.access_token || !String(tokens.scope || '').split(' ').includes(YOUTUBE_SCOPE)) {
        throw new YoutubeConnectError('Read-only YouTube access must be approved to connect the channel.')
      }
      const channelsResponse = await fetchImpl('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true&maxResults=50', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15000),
      })
      if (!channelsResponse.ok) throw new YoutubeConnectError('The connected YouTube channel could not be identified.', 502)
      const channels = await channelsResponse.json()
      const items = Array.isArray(channels.items) ? channels.items : []
      const channel = attempt.expectedChannelId ? items.find(item => item.id === attempt.expectedChannelId) :
        items.length === 1 && !channels.nextPageToken ? items[0] : null
      if (!channel || !CHANNEL.test(channel.id || '')) throw new YoutubeConnectError('Choose the Google account and YouTube channel requested by the site admin. Ask the admin for a new link.')
      const previous = await repository.readConnection()
      let refreshToken = tokens.refresh_token
      if (!refreshToken && previous?.channelId === channel.id && previous.oauthClientId === cfg.clientId) {
        refreshToken = unseal(previous.refreshTokenEncrypted, cfg.key, 'refresh')
      }
      if (!refreshToken) throw new YoutubeConnectError('Google did not grant ongoing access. Revoke the previous app grant and connect again.')
      const connection = { channelId: channel.id, channelTitle: String(channel.snippet?.title || '').slice(0, 200),
        oauthClientId: cfg.clientId, refreshTokenEncrypted: seal(refreshToken, cfg.key, 'refresh'),
        connectedAt: new Date(now()), scope: YOUTUBE_SCOPE }
      await repository.saveConnection(connection)
      await repository.markAttempt(attempt._id, 'connected')
      return { channelId: connection.channelId, channelTitle: connection.channelTitle }
    } catch (failure) {
      await repository.markAttempt(attempt._id, 'failed').catch(() => {})
      if (failure instanceof YoutubeConnectError) throw failure
      throw new YoutubeConnectError('The connection could not be completed. Ask the admin for a new link.', 502)
    }
  }

  async function getCredentials() {
    if (!env.YOUTUBE_CLIENT_ID?.trim() || !env.YOUTUBE_CLIENT_SECRET?.trim() || !env.YOUTUBE_TOKEN_ENCRYPTION_KEY?.trim()) return null
    const cfg = config()
    const connection = await repository.readConnection()
    if (!connection || connection.oauthClientId !== cfg.clientId) return null
    return { clientId: cfg.clientId, clientSecret: cfg.clientSecret,
      refreshToken: unseal(connection.refreshTokenEncrypted, cfg.key, 'refresh'), channelId: connection.channelId }
  }

  async function connectionStatus() {
    config()
    const connection = await repository.readConnection()
    return connection ? { connected: connection.oauthClientId === env.YOUTUBE_CLIENT_ID?.trim(),
      channelId: connection.channelId, channelTitle: connection.channelTitle, connectedAt: connection.connectedAt } : { connected: false }
  }

  return { issueLink, beginAuthorization, completeAuthorization, getCredentials, connectionStatus }
}
