import { onMounted, onUnmounted, watch } from 'vue'

export function useAutoLogout({
  isLoggedIn,
  logout,
  timeoutMs = 10 * 60 * 1000,
  storageKey = 'cmm-last-account-activity',
}) {
  let timer
  let lastActivity = 0
  let loggingOut = false
  let mounted = false
  let stopWatching

  const events = [
    'pointerdown',
    'pointermove',
    'keydown',
    'scroll',
    'touchstart',
    'touchmove',
    'wheel',
  ]

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function saveActivity() {
    try {
      sessionStorage.setItem(storageKey, String(lastActivity))
    } catch {
      // Continue using the in-memory timestamp.
    }
  }

  function restoreActivity() {
    try {
      const saved = Number(sessionStorage.getItem(storageKey))

      if (Number.isFinite(saved) && saved > 0) {
        return saved
      }
    } catch {
      // Storage may be unavailable.
    }

    return Date.now()
  }

  function stop() {
    clearTimer()
    lastActivity = 0

    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      // Storage may be unavailable.
    }
  }

  function schedule(delay) {
    clearTimer()

    if (mounted) {
      timer = setTimeout(() => {
        void checkTimeout()
      }, delay)
    }
  }

  async function checkTimeout() {
    clearTimer()

    if (!mounted || loggingOut) return

    if (!isLoggedIn()) {
      stop()
      return
    }

    if (!lastActivity) {
      lastActivity = restoreActivity()
      saveActivity()
    }

    const remaining = timeoutMs - (Date.now() - lastActivity)

    if (remaining > 0) {
      schedule(remaining)
      return
    }

    loggingOut = true

    try {
      await logout()
    } catch (error) {
      console.error('Automatic logout failed:', error)
    } finally {
      loggingOut = false

      if (mounted) {
        if (isLoggedIn()) {
          // Keep the session expired and retry if logout failed.
          schedule(5000)
        } else {
          stop()
        }
      }
    }
  }

  function recordActivity(event) {
    if (
      !mounted ||
      document.hidden ||
      !document.hasFocus() ||
      !event.isTrusted ||
      !isLoggedIn() ||
      loggingOut
    ) {
      return
    }

    // Activity after expiry must not extend the session.
    if (!lastActivity || Date.now() - lastActivity >= timeoutMs) {
      void checkTimeout()
      return
    }

    lastActivity = Date.now()
    saveActivity()

    // The existing timer will check the updated timestamp.
    if (!timer) {
      schedule(timeoutMs)
    }
  }

  function handleResume() {
    if (!document.hidden) {
      void checkTimeout()
    }
  }

  // Call after a successful NEW login.
  function start() {
    if (!isLoggedIn() || loggingOut) return

    lastActivity = Date.now()
    saveActivity()

    if (mounted) {
      void checkTimeout()
    }
  }

  onMounted(() => {
    mounted = true

    events.forEach(event => {
      window.addEventListener(event, recordActivity, {
        passive: true,
        capture: true,
      })
    })

    document.addEventListener('visibilitychange', handleResume)
    window.addEventListener('focus', handleResume)
    window.addEventListener('pageshow', handleResume)

    stopWatching = watch(
      () => Boolean(isLoggedIn()),
      loggedIn => {
        if (loggedIn) {
          lastActivity = restoreActivity()
          saveActivity()
          void checkTimeout()
        } else {
          stop()
        }
      },
      { immediate: true },
    )
  })

  onUnmounted(() => {
    mounted = false
    clearTimer()
    stopWatching?.()

    events.forEach(event => {
      window.removeEventListener(event, recordActivity, true)
    })

    document.removeEventListener('visibilitychange', handleResume)
    window.removeEventListener('focus', handleResume)
    window.removeEventListener('pageshow', handleResume)
  })

  return { start, stop }
}