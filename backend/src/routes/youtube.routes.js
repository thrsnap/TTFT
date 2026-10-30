import { Router, urlencoded, json } from 'express'
import { getYoutubeLiveStatus, invalidateYoutubeLiveStatus } from '../services/youtubeLive.service.js'
import { youtubeOAuth } from '../services/youtubeOAuth.runtime.js'
import { YoutubeConnectError, isYoutubeAdmin, youtubeBrowserCookieName } from '../services/youtubeOAuth.service.js'
import { youtubeConnectionPage } from '../services/youtubeOAuth.pages.js'

const router = Router()

function renderPage(res, status, options) {
  const page = youtubeConnectionPage(options)
  return res.status(status).set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': page.csp }).type('html').send(page.content)
}

function requireAdmin(req, res, next) {
  res.set('Cache-Control', 'no-store')
  if (!process.env.ADMIN_API_KEY?.trim()) return res.status(503).json({ message: 'Admin access is not configured.' })
  if (!isYoutubeAdmin(req.get('authorization'), process.env.ADMIN_API_KEY)) return res.status(401).json({ message: 'Admin authorization required.' })
  next()
}

router.post('/connect-links', requireAdmin, json({ limit: '2kb' }), async (req, res, next) => {
  try {
    const requested = req.body?.channelId
    if (requested !== undefined && typeof requested !== 'string') return res.status(400).json({ message: 'channelId must be a string.' })
    res.status(201).json(await youtubeOAuth.issueLink(requested))
  } catch (error) {
    if (error instanceof YoutubeConnectError) return res.status(error.status).json({ message: error.message })
    next(error)
  }
})

router.get('/connection', requireAdmin, async (_req, res, next) => {
  try { res.json(await youtubeOAuth.connectionStatus()) } catch (error) {
    if (error instanceof YoutubeConnectError) return res.status(error.status).json({ message: error.message })
    next(error)
  }
})

// The shareable link is a landing page. Only the owner's button click claims it.
router.get('/connect', (_req, res) => renderPage(res, 200, {
  title: 'Connect your YouTube channel',
  message: 'Allow CMM-FT to check when your channel is live and show a live alert on the website. Sign in with the Google account that owns your channel.',
  connect: true,
}))

router.post('/connect', urlencoded({ extended: false, limit: '2kb' }), async (req, res) => {
  try {
    const result = await youtubeOAuth.beginAuthorization(req.body?.invite)
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
    res.cookie(youtubeBrowserCookieName(result.state), result.browserToken, {
      httpOnly: true, secure: result.secureCookie, sameSite: 'lax', maxAge: 10 * 60 * 1000,
      path: '/api/youtube/oauth/callback',
    })
    res.redirect(303, result.authorizationUrl)
  } catch (error) {
    renderPage(res, error instanceof YoutubeConnectError ? error.status : 503, {
      title: 'Connection could not start',
      message: error instanceof YoutubeConnectError ? error.message : 'Please ask the site admin for a new connection link.',
    })
  }
})

router.get('/oauth/callback', async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const cookieName = youtubeBrowserCookieName(state)
  const browserToken = (req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || ''
  try {
    const result = await youtubeOAuth.completeAuthorization({ state, browserToken,
      code: typeof req.query.code === 'string' ? req.query.code : '', error: Boolean(req.query.error) })
    invalidateYoutubeLiveStatus()
    res.clearCookie(cookieName, { path: '/api/youtube/oauth/callback' })
    renderPage(res, 200, { title: 'YouTube connected', message: `${result.channelTitle || result.channelId} is now connected to CMM-FT live alerts.` })
  } catch (error) {
    if (/^[A-Za-z0-9_-]{43}$/.test(state)) res.clearCookie(cookieName, { path: '/api/youtube/oauth/callback' })
    renderPage(res, error instanceof YoutubeConnectError ? error.status : 503, {
      title: 'Connection could not finish',
      message: error instanceof YoutubeConnectError ? error.message : 'Please ask the site admin for a new connection link.',
    })
  }
})

// Public, read-only endpoint; the channel owner's credentials stay on the server.
router.get('/live', async (_req, res, next) => {
  try {
    const status = await getYoutubeLiveStatus()
    res.set('Cache-Control', 'no-store')
    res.status(status.configured && !status.available ? 503 : 200).json(status)
  } catch (error) {
    next(error)
  }
})

export default router
