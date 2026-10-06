import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../../api/autService'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const ready = ref(false)

  const isAuthenticated = computed(
    () => Boolean(user.value?.emailVerified),
  )

  let restorePromise = null

  async function restoreSession(force = false) {
    if (restorePromise) return restorePromise
    if (ready.value && !force) return

    restorePromise = (async () => {
      try {
        const data = await api('/auth/me')
        user.value = data.user
        ready.value = true
      } catch (error) {
        if (error.status === 401) {
          user.value = null
          ready.value = true
        } else {
          throw error
        }
      } finally {
        restorePromise = null
      }
    })()

    return restorePromise
  }

  async function login(identifier, password) {
    const data = await api('/auth/login', 'POST', {
      identifier,
      password,
    })

    user.value = data.user
    ready.value = true
  }

  async function googleLogin(credential) {
    if (typeof credential !== 'string' || !credential.trim()) {
      throw new Error('Missing Google sign-in token. Please try again.')
    }

    const data = await api('/auth/google', 'POST', {
      credential,
    })

    if (!data?.user?.emailVerified) {
      throw new Error(
        'Google login did not return a verified user.',
      )
    }

    user.value = data.user
    ready.value = true

    return data
  }

  function register(values) {
    return api('/auth/register', 'POST', values)
  }

  async function verifyEmail(email, code) {
    const data = await api('/auth/verify-email', 'POST', {
      email,
      code,
    })

    user.value = data.user
    ready.value = true
  }

  function resendCode(email) {
    return api('/auth/resend-verification', 'POST', {
      email,
    })
  }

  async function logout() {
    await api('/auth/logout', 'POST', {})
    user.value = null
    ready.value = true
  }

  return {
    user,
    ready,
    isAuthenticated,
    restoreSession,
    login,
    googleLogin,
    register,
    verifyEmail,
    resendCode,
    logout,
  }
})