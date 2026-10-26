import { createECDH, createHash, ECDH } from 'node:crypto'
import { isIP } from 'node:net'
import webpush from 'web-push'

const providerRoots = [
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
]

export function pushError(status, message, code) {
  const error = new Error(message)
  error.status = status
  error.code = code || 'PUSH_ERROR'
  return error
}

export function getPushConfiguration() {
  const subject = process.env.VAPID_SUBJECT?.trim()
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()

  if (!subject || !publicKey || !privateKey) {
    throw pushError(503, 'Push notifications are not configured on the server.')
  }

  try {
    const contact = new URL(subject)
    if (
      !['mailto:', 'https:'].includes(contact.protocol) ||
      (contact.protocol === 'mailto:' && !contact.pathname.includes('@')) ||
      contact.username ||
      contact.password
    ) {
      throw new Error('Invalid subject')
    }

    const publicBytes = decodeKey(publicKey, 65)
    const privateBytes = decodeKey(privateKey, 32)
    const curve = createECDH('prime256v1')
    curve.setPrivateKey(privateBytes)
    if (!curve.getPublicKey().equals(publicBytes)) {
      throw new Error('The VAPID keys do not match')
    }
  } catch {
    throw pushError(503, 'The server push notification configuration is invalid.')
  }

  return { subject, publicKey, privateKey }
}

function decodeKey(value, expectedLength) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid key')
  }
  const bytes = Buffer.from(value, 'base64url')
  if (
    bytes.length !== expectedLength ||
    bytes.toString('base64url') !== value
  ) {
    throw new Error('Invalid key')
  }
  return bytes
}

export function normalizePushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 4096) {
    throw pushError(400, 'Provide a valid push subscription endpoint.')
  }

  let url
  try {
    url = new URL(value)
  } catch {
    throw pushError(400, 'Provide a valid push subscription endpoint.')
  }

  const hostname = url.hostname.toLowerCase()
  const additionalHosts = (process.env.PUSH_ALLOWED_HOSTS || '')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean)

  // Additional hosts are exact server-configured names, never client input.
  const allowed =
    hostname === 'fcm.googleapis.com' ||
    providerRoots.some(root => hostname === root || hostname.endsWith('.' + root)) ||
    additionalHosts.includes(hostname)

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== '443') ||
    url.pathname.length < 2 ||
    isIP(hostname.replace(/^\[|\]$/g, '')) ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    !allowed
  ) {
    throw pushError(400, 'Unsupported or invalid push service endpoint.')
  }

  return url.href
}

export function getEndpointHash(value) {
  return createHash('sha256')
    .update(normalizePushEndpoint(value))
    .digest('hex')
}

function normalizeKeys(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Missing keys')
    }
    const p256dh = decodeKey(value.p256dh, 65)
    decodeKey(value.auth, 16)
    if (p256dh[0] !== 4) throw new Error('Invalid public key')
    ECDH.convertKey(p256dh, 'prime256v1')
    return { p256dh: value.p256dh, auth: value.auth }
  } catch {
    throw pushError(400, 'Provide the browser subscription encryption keys.')
  }
}

export function normalizePushSubscription(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw pushError(400, 'Provide a browser push subscription.')
  }
  const endpoint = normalizePushEndpoint(value.endpoint)
  const keys = normalizeKeys(value.keys)
  let expirationTime = null

  if (value.expirationTime !== null && value.expirationTime !== undefined) {
    if (
      !Number.isSafeInteger(value.expirationTime) ||
      value.expirationTime <= Date.now() ||
      value.expirationTime > 8640000000000000
    ) {
      throw pushError(400, 'The subscription expiry is invalid. Enable notifications again.')
    }
    expirationTime = new Date(value.expirationTime)
  }

  return {
    endpoint,
    endpointHash: getEndpointHash(endpoint),
    keys,
    expirationTime,
  }
}

// Internal helper for test sends and future signal publishing integration.
// The caller chooses recipients using server-side access checks.
export async function sendPushNotification(subscription, notification) {
  const configuration = getPushConfiguration()

  if (subscription.vapidPublicKey !== configuration.publicKey) {
    throw pushError(
      409,
      'The server push key changed. Disable notifications and enable them again.',
    )
  }

  if (
    subscription.expirationTime &&
    new Date(subscription.expirationTime).getTime() <= Date.now()
  ) {
    throw pushError(410, 'This push subscription expired. Enable notifications again.', 'PUSH_EXPIRED')
  }

  const endpoint = normalizePushEndpoint(subscription.endpoint)
  const keys = normalizeKeys(subscription.keys)
  const title = notification?.title
  const body = notification?.body
  const tag = notification?.tag || 'cmm-ft'

  if (
    typeof title !== 'string' || !title.trim() || title.length > 100 ||
    typeof body !== 'string' || body.length > 240 ||
    typeof tag !== 'string' || tag.length > 100
  ) {
    throw pushError(400, 'Invalid notification content.')
  }

  let destination
  try {
    const frontend = new URL(process.env.FRONTEND_URL)
    destination = new URL(notification.url || '/', frontend.origin + '/')
    if (
      destination.origin !== frontend.origin ||
      destination.username ||
      destination.password ||
      !['http:', 'https:'].includes(destination.protocol)
    ) {
      throw new Error('Invalid destination')
    }
  } catch {
    throw pushError(400, 'Notification links must open the configured frontend.')
  }

  const payload = JSON.stringify({
    title: title.trim(),
    body,
    tag,
    url: destination.href,
  })

  try {
    await webpush.sendNotification(
      { endpoint, keys },
      payload,
      {
        vapidDetails: configuration,
        TTL: 120,
        urgency: 'normal',
        timeout: 10000,
      },
    )
  } catch (error) {
    if ([404, 410].includes(error.statusCode)) {
      throw pushError(
        410,
        'This push subscription expired. Enable notifications again.',
        'PUSH_EXPIRED',
      )
    }
    // Provider response bodies and endpoints can contain subscription secrets.
    console.error('Push service request failed:', {
      name: error.name,
      statusCode: error.statusCode,
    })
    throw pushError(
      502,
      'The push service could not accept the notification. Try again later.',
    )
  }
}
