import { onMounted, onUnmounted } from 'vue'

export function useAutoLogout({
  isLoggedIn,
  logout,
  timeoutMs = 10 * 60 * 1000,
}) {
  let timer
  let lastActivity = Date.now()
  let loggingOut = false

  const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart']

  async function checkTimeout() {
    clearTimeout(timer)

    if (!isLoggedIn() || loggingOut) return

    const remaining = timeoutMs - (Date.now() - lastActivity)

    if (remaining <= 0) {
      loggingOut = true

      try {
        await logout()
      } finally {
        loggingOut = false
      }

      return
    }

    timer = setTimeout(checkTimeout, remaining)
  }

  function recordActivity() {
    if (document.hidden || !isLoggedIn() || loggingOut) return

    // Check expiry before allowing activity to reset the timer.
    if (Date.now() - lastActivity >= timeoutMs) {
      void checkTimeout()
      return
    }

    lastActivity = Date.now()
    void checkTimeout()
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      void checkTimeout()
    }
  }

  onMounted(() => {
    lastActivity = Date.now()

    events.forEach((event) => {
      window.addEventListener(event, recordActivity, { passive: true })
    })

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', checkTimeout)

    void checkTimeout()
  })

  onUnmounted(() => {
    clearTimeout(timer)

    events.forEach((event) => {
      window.removeEventListener(event, recordActivity)
    })

    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', checkTimeout)
  })

  // Call after login or after restoring a valid session.
  function start() {
    lastActivity = Date.now()
    void checkTimeout()
  }

  return { start }
}