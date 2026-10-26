/* CMM-FT notification worker. This worker does not cache page requests. */
const APP_BASE = new URL('./', self.location.href)
const APP_ORIGIN = APP_BASE.origin

function notificationUrl(value) {
  try {
    const url = new URL(typeof value === 'string' ? value : './', APP_BASE)
    if (url.origin === APP_ORIGIN && ['http:', 'https:'].includes(url.protocol)) {
      return url.href
    }
  } catch {}
  return APP_BASE.href
}

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch {}
  if (typeof payload !== 'object' || Array.isArray(payload)) payload = {}

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim().slice(0, 100)
    : 'CMM-FT'
  const body = typeof payload.body === 'string'
    ? payload.body.slice(0, 240)
    : 'Open CMM-FT to view the update.'
  const tag = typeof payload.tag === 'string'
    ? payload.tag.slice(0, 100)
    : 'cmm-ft-update'

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: new URL('cmm-push-192.png?v=5c6e6e55fc', APP_BASE).href,
    badge: new URL('cmm-push-badge.png?v=5c6e6e55fc', APP_BASE).href,
    data: { url: notificationUrl(payload.url) },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const destination = notificationUrl(event.notification.data?.url)

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const sameOrigin = windows.filter(client => {
      try { return new URL(client.url).origin === APP_ORIGIN } catch { return false }
    })
    const exact = sameOrigin.find(client => client.url === destination)
    if (exact) return exact.focus()

    const existing = sameOrigin[0]
    if (existing?.navigate) {
      try {
        const navigated = await existing.navigate(destination)
        if (navigated) return navigated.focus()
      } catch {}
    }
    return self.clients.openWindow(destination)
  })())
})

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) client.postMessage({ type: 'CMM_PUSH_SUBSCRIPTION_CHANGED' })
  })())
})
