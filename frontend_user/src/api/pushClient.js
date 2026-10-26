const OWNER_KEY = 'cmm-ft.push.owner'
const REQUEST_TIMEOUT = 15000

function failure(message, status = 0) {
  const error = new Error(message)
  error.status = status
  return error
}

function cancelled() {
  return new DOMException('Operation cancelled.', 'AbortError')
}

function waitFor(promise, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      Promise.resolve(promise).catch(() => {})
      return reject(cancelled())
    }
    let finished = false
    const finish = (callback, value) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      callback(value)
    }
    const abort = () => finish(reject, cancelled())
    const timer = setTimeout(() => {
      finish(reject, failure('Notifications took too long to start. Reload this page and retry.'))
    }, REQUEST_TIMEOUT)
    signal?.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(
      value => finish(resolve, value),
      error => finish(reject, error),
    )
  })
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(cancelled())
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(cancelled())
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

function keyBytes(value, env) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw failure('Notifications are temporarily unavailable. Try again later.')
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const raw = env.atob(padded)
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0))
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw failure('Notifications are temporarily unavailable. Try again later.')
  }
  return bytes
}

function sameKey(value, expected) {
  if (!value) return false
  const actual = ArrayBuffer.isView(value)
    ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    : new Uint8Array(value)
  return actual.length === expected.length &&
    actual.every((byte, index) => byte === expected[index])
}

export function createPushClient({
  apiBase,
  basePath = '/',
  onChange = () => {},
  environment = globalThis,
}) {
  const env = environment
  const base = new URL(basePath, env.location.origin + '/')
  const scriptUrl = new URL('cmm-push-sw.js', base).href
  const scopeUrl = new URL('_cmm_push/', base).href
  const apiOrigin = String(apiBase).trim().replace(/\/+$/, '')
  const state = {
    phase: 'signed-out',
    busy: false,
    ready: false,
    permission: 'default',
    message: '',
    error: '',
    cooldownSeconds: 0,
  }

  let userId = ''
  let epoch = 0
  let disposed = false
  let registration = null
  let subscription = null
  let applicationKey = null
  let session = new AbortController()
  let transition = Promise.resolve()
  let operation = Promise.resolve()
  let testAgainAt = 0

  const publish = values => {
    Object.assign(state, values)
    if (!disposed) onChange({ ...state })
  }
  const current = token => !disposed && epoch === token
  const owner = () => {
    try { return env.localStorage.getItem(OWNER_KEY) || '' } catch { return '' }
  }
  const remember = id => {
    try {
      if (id) env.localStorage.setItem(OWNER_KEY, id)
      else env.localStorage.removeItem(OWNER_KEY)
    } catch {}
  }

  function supportMessage() {
    const nav = env.navigator
    const ios = /iPad|iPhone|iPod/.test(nav.userAgent || '') ||
      (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
    const installed = env.matchMedia?.('(display-mode: standalone)').matches ||
      nav.standalone === true

    if (ios && !installed) {
      return 'On iPhone or iPad, add CMM-FT to your Home Screen, open it there, then enable notifications.'
    }
    if (!env.isSecureContext) {
      return 'Open CMM-FT using HTTPS to enable notifications.'
    }
    if (!nav.serviceWorker || !env.PushManager || !env.Notification) {
      return 'This browser does not support push notifications on this device.'
    }
    return ''
  }

  async function api(path, method = 'GET', body, signal = session.signal) {
    const controller = new AbortController()
    let timedOut = false
    const abort = () => controller.abort()
    if (signal?.aborted) throw cancelled()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, REQUEST_TIMEOUT)

    try {
      const headers = { Accept: 'application/json' }
      if (method !== 'GET') {
        headers['Content-Type'] = 'application/json'
        headers['X-CMM-Request'] = '1'
      }
      const response = await env.fetch(apiOrigin + '/api/push' + path, {
        method,
        credentials: 'include',
        headers,
        signal: controller.signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      if (response.status === 204) return null
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const error = failure(
          data?.message || 'Notifications could not be updated. Please retry.',
          response.status,
        )
        error.retryAfter = Number(response.headers.get('Retry-After')) || 60
        throw error
      }
      if (!data || typeof data !== 'object') {
        throw failure('Notifications are temporarily unavailable. Try again later.')
      }
      return data
    } catch (error) {
      if (timedOut) throw failure('The request timed out. Please retry.')
      throw error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }

  async function getRegistration(signal) {
    const registrations = await waitFor(env.navigator.serviceWorker.getRegistrations(), signal)
    const existing = registrations.find(value => value.scope === scopeUrl)
    if (existing) {
      for (const worker of [existing.active, existing.waiting, existing.installing]) {
        if (worker && worker.scriptURL !== scriptUrl) {
          throw failure('Notifications need a website update. Please contact support.')
        }
      }
    }
    const result = await waitFor(env.navigator.serviceWorker.register(scriptUrl, {
      scope: scopeUrl,
      updateViaCache: 'none',
    }), signal)
    const until = Date.now() + REQUEST_TIMEOUT
    while (!result.active || result.active.state !== 'activated') {
      if (Date.now() >= until) {
        throw failure('Notifications could not start. Reload this page and retry.')
      }
      await delay(50, signal)
    }
    if (signal.aborted) throw cancelled()
    return result
  }

  async function closeNotifications(reg) {
    try {
      const notices = await reg?.getNotifications?.()
      for (const notice of notices || []) notice.close()
    } catch {}
  }

  async function release(sub, reg, previousUser) {
    const active = reg ? await waitFor(reg.pushManager.getSubscription(), null) : null
    const sameSubscription = !active || !sub || active.endpoint === sub.endpoint
    if (sub && sameSubscription) await sub.unsubscribe()
    if (sameSubscription) await closeNotifications(reg)
    if (!previousUser || owner() === previousUser) remember('')
    if (sub) {
      // The session may already be signed out; browser unsubscription takes effect first.
      void api('/subscribe', 'DELETE', { endpoint: sub.endpoint }, null).catch(() => {})
    }
  }

  function showError(error) {
    let message = error.message || 'Notifications could not be updated. Please retry.'
    if (error.name === 'NotAllowedError') message = 'The browser did not allow notifications. Check your site permissions and retry.'
    if (error.name === 'AbortError') message = 'The browser could not connect to its notification service. Please retry.'
    if (error.name === 'InvalidStateError') message = 'This device needs to reconnect. Press Retry, then enable notifications again.'
    if (error.name === 'TypeError') message = 'Notifications could not connect. Check your connection and retry.'
    if (error.status === 401) message = 'Your session expired. Sign in again to manage notifications.'
    if (error.status === 403) message = 'Refresh the page and sign in again to manage notifications.'
    if (error.status >= 500) {
      message = 'Notifications are temporarily unavailable. Please retry later.'
    }
    publish({
      error: message,
      message: subscription ? 'Notifications are enabled on this device.' : '',
      busy: false,
      ready: Boolean(registration && applicationKey && ![401, 403].includes(error.status)),
      phase: subscription ? 'on' : 'error',
    })
  }

  async function prepare(token) {
    const unsupported = supportMessage()
    if (unsupported) {
      publish({ phase: 'unsupported', busy: false, ready: false, message: unsupported })
      return
    }
    const permission = env.Notification.permission
    publish({ permission })
    if (permission === 'denied') {
      publish({
        phase: 'blocked', busy: false, ready: false,
        message: 'Notifications are blocked. Allow them in your browser site settings, then press Retry.',
      })
      return
    }

    const signal = session.signal
    const [config, reg] = await Promise.all([
      api('/public-key', 'GET', undefined, signal),
      getRegistration(signal),
    ])
    if (!current(token)) return
    const key = keyBytes(config.publicKey, env)
    let sub = await waitFor(reg.pushManager.getSubscription(), signal)
    if (!current(token)) return

    if (sub) {
      const invalidKey = !sameKey(sub.options?.applicationServerKey, key)
      const expired = sub.expirationTime && sub.expirationTime <= Date.now()
      const anotherOwner = owner() && owner() !== userId
      let bound = false
      if (!invalidKey && !expired && !anotherOwner) {
        const result = await api('/status', 'POST', { endpoint: sub.endpoint }, signal)
        if (!current(token)) return
        bound = result.enabled === true
      }
      if (!bound) {
        await release(sub, reg, owner())
        sub = null
      }
    }
    if (!current(token)) return
    registration = reg
    applicationKey = key
    subscription = sub
    if (sub) remember(userId)
    publish({
      phase: sub ? 'on' : 'off',
      busy: false, ready: true, error: '',
      permission: env.Notification.permission,
      message: sub ? 'Notifications are enabled on this device.' : 'Enable alerts on this device.',
    })
  }

  function connect(nextUser) {
    if (disposed) return Promise.resolve()
    const previousUser = userId
    const oldRegistration = registration
    const oldSubscription = subscription
    userId = String(nextUser || '')
    const token = ++epoch
    session.abort()
    session = new AbortController()
    registration = null
    subscription = null
    applicationKey = null
    testAgainAt = 0
    publish({
      phase: userId ? 'loading' : 'signed-out',
      busy: Boolean(userId), ready: false, error: '',
      message: userId ? 'Preparing notifications…' : '',
      cooldownSeconds: 0,
    })

    const previousOperation = operation
    transition = transition.catch(() => {}).then(async () => {
      await previousOperation.catch(() => {})
      if (previousUser && previousUser !== userId) {
        const sub = oldSubscription || await oldRegistration?.pushManager.getSubscription()
        await release(sub, oldRegistration, previousUser)
      }
      if (!current(token) || !userId) return
      await prepare(token)
    }).catch(error => {
      if (current(token) && error.name !== 'AbortError') showError(error)
    })
    return transition
  }

  // Called directly from the click handler: no awaits precede subscribe().
  function enable() {
    if (disposed || !userId || !state.ready || state.busy || !registration || !applicationKey) {
      return Promise.resolve(false)
    }
    const token = epoch
    const id = userId
    const reg = registration
    publish({ busy: true, error: '', message: 'Enabling notifications…' })
    let pending
    try {
      pending = subscription
        ? Promise.resolve(subscription)
        : reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationKey,
        })
    } catch (error) {
      showError(error)
      return Promise.resolve(false)
    }
    operation = (async () => {
      let sub
      try {
        sub = await pending
        if (!current(token)) {
          await sub.unsubscribe()
          return false
        }
        await api('/subscribe', 'POST', { subscription: sub.toJSON() })
        if (!current(token)) {
          await sub.unsubscribe()
          return false
        }
        subscription = sub
        remember(id)
        publish({
          phase: 'on', busy: false, ready: true, error: '',
          permission: env.Notification.permission,
          message: 'Notifications are enabled on this device.',
        })
        return true
      } catch (error) {
        if (sub) await sub.unsubscribe().catch(() => {})
        if (!current(token)) return false
        subscription = null
        if (env.Notification.permission === 'denied') {
          publish({
            phase: 'blocked', busy: false, ready: false, permission: 'denied',
            message: 'Notifications are blocked. Allow them in your browser site settings, then press Retry.',
          })
        } else {
          showError(error)
        }
        return false
      }
    })()
    return operation
  }

  function disable() {
    if (!userId || state.busy || !subscription) return Promise.resolve(false)
    const token = epoch
    const sub = subscription
    const reg = registration
    const id = userId
    publish({ busy: true, error: '', message: 'Disabling notifications…' })
    operation = (async () => {
      try {
        await release(sub, reg, id)
        if (!current(token)) return false
        subscription = null
        publish({
          phase: 'off', busy: false, ready: true, error: '',
          message: 'Notifications are disabled on this device.',
        })
        return true
      } catch (error) {
        if (current(token)) showError(error)
        return false
      }
    })()
    return operation
  }

  function tick() {
    const seconds = Math.max(0, Math.ceil((testAgainAt - Date.now()) / 1000))
    if (seconds !== state.cooldownSeconds) publish({ cooldownSeconds: seconds })
  }

  function test() {
    if (!userId || state.busy || !subscription || state.cooldownSeconds > 0) {
      return Promise.resolve(false)
    }
    const token = epoch
    const sub = subscription
    publish({ busy: true, error: '', message: 'Requesting a test notification…' })
    operation = (async () => {
      try {
        const result = await api('/test', 'POST', { endpoint: sub.endpoint })
        if (!current(token)) return false
        testAgainAt = Date.now() + 60000
        publish({ busy: false, message: 'Test requested. Check your device notifications.' })
        tick()
        return Boolean(result)
      } catch (error) {
        if (!current(token)) return false
        if (error.status === 429) {
          testAgainAt = Date.now() + (error.retryAfter || 60) * 1000
          tick()
        }
        if ([404, 409, 410].includes(error.status)) {
          await release(sub, registration, userId).catch(() => {})
          if (!current(token)) return false
          subscription = null
          publish({
            phase: 'off', busy: false, ready: true,
            error: '', message: 'Enable notifications again to reconnect this device.',
          })
        } else {
          showError(error)
        }
        return false
      }
    })()
    return operation
  }

  function dispose() {
    disposed = true
    epoch++
    session.abort()
    // Closing the page keeps the subscription so background pushes can arrive.
  }

  publish({})
  return {
    get state() { return { ...state } },
    connect,
    refresh: () => connect(userId),
    enable, disable, test, tick, dispose,
  }
}
