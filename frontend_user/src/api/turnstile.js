let loginToken = ''
let loadingPromise

export function getLoginTurnstileToken() {
  return loginToken
}

export function setLoginTurnstileToken(token) {
  loginToken = typeof token === 'string' ? token : ''
}

export function loadTurnstile() {
  if (loadingPromise) return loadingPromise

  if (window.turnstile?.render) {
    return Promise.resolve()
  }

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const callbackName = '__cmmTurnstileLoaded'

    let settled = false

    const timer = window.setTimeout(() => {
      fail('Security verification timed out. Refresh to retry.')
    }, 30000)

    function fail(message) {
      if (settled) return
      settled = true

      window.clearTimeout(timer)
      script.remove()
      loadingPromise = undefined

      // Safely ignore a delayed callback from this script.
      window[callbackName] = () => {}

      reject(new Error(message))
    }

    window[callbackName] = () => {
      if (settled) return

      if (!window.turnstile?.render) {
        fail('Security verification could not initialize.')
        return
      }

      settled = true
      window.clearTimeout(timer)
      resolve()
    }

    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js' +
      `?render=explicit&onload=${callbackName}`

    script.async = true

    script.onerror = () => {
      fail('Security verification could not load. Refresh to retry.')
    }

    document.head.appendChild(script)
  })

  return loadingPromise
}