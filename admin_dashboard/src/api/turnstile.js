let loginToken = ''
let loadingPromise

export function getLoginTurnstileToken() {
  return loginToken
}

export function setLoginTurnstileToken(token) {
  loginToken = typeof token === 'string' ? token : ''
}

export function loadTurnstile() {
  if (window.turnstile) {
    return new Promise(resolve => {
      window.turnstile.ready(resolve)
    })
  }

  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')

    const timer = window.setTimeout(() => {
      reject(new Error(
        'Security verification could not load. Refresh to retry.',
      ))
    }, 15000)

    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true

    script.onload = () => {
      if (!window.turnstile) {
        window.clearTimeout(timer)
        reject(new Error('Security verification could not load.'))
        return
      }

      window.turnstile.ready(() => {
        window.clearTimeout(timer)
        resolve()
      })
    }

    script.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(
        'Security verification could not load. Refresh to retry.',
      ))
    }

    document.head.appendChild(script)
  })

  return loadingPromise
}