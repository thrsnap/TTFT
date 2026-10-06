<script setup>
import {
  computed,
  reactive,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
} from 'vue'

import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/user/authStore.js'
import { renderGoogleSignIn } from '../api/googleSingin.js'

const props = defineProps({
  mode: { type: String, default: 'login' },
})

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isRegister = computed(() => props.mode === 'register')
const showPassword = ref(false)
const busy = ref(false)
const error = ref('')

const googleButton = ref(null)
const googleLoading = ref(true)
const googleError = ref('')

let googleTimer
let cleanupGoogle
let googleAttempts = 0
let disposed = false

const form = reactive({
  username: '',
  email: '',
  identifier: '',
  password: '',
  confirmPassword: '',
})

const passwordMismatch = computed(
  () =>
    isRegister.value &&
    Boolean(form.confirmPassword) &&
    form.password !== form.confirmPassword,
)

const inputClass =
  'block w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60'

const brandImage = `${import.meta.env.BASE_URL}Profile.jpg`

function localizedRoute(name) {
  return {
    name,
    params: route.params.lang ? { lang: route.params.lang } : {},
  }
}

function localizedPath(path) {
  return route.params.lang ? `/${route.params.lang}${path}` : path
}

async function openVerification(email, notice) {
  sessionStorage.setItem('verificationEmail', email)
  sessionStorage.setItem('verificationNotice', notice)

  await router.push(localizedRoute('verify-email'))
}

async function handleSubmit() {
  if (busy.value || disposed) return

  error.value = ''
  googleError.value = ''

  if (isRegister.value) {
    if (!/^[a-z0-9_]{3,30}$/i.test(form.username.trim())) {
      error.value =
        'Username must contain 3–30 letters, numbers, or underscores.'
      return
    }

    if (form.password.length < 12) {
      error.value = 'Use a password with at least 12 characters.'
      return
    }

    if (form.password !== form.confirmPassword) {
      error.value = 'Passwords do not match.'
      return
    }
  }

  if (new TextEncoder().encode(form.password).length > 72) {
    error.value = 'Password is too long. Use at most 72 UTF-8 bytes.'
    return
  }

  busy.value = true
  const submittedMode = props.mode

  try {
    if (isRegister.value) {
      const result = await auth.register({
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })

      if (disposed || props.mode !== submittedMode) return

      await openVerification(
        result.email,
        result.message || 'Check your email for the verification code.',
      )
    } else {
      await auth.login(form.identifier.trim(), form.password)

      if (disposed || props.mode !== submittedMode) return

      await router.replace(localizedRoute('home'))
    }
  } catch (failure) {
    if (disposed || props.mode !== submittedMode) return

    if (failure.data?.verificationRequired && failure.data.email) {
      try {
        await openVerification(failure.data.email, failure.message)
      } catch (navigationError) {
        error.value =
          navigationError.message || 'Cannot open the verification page.'
      }
    } else {
      error.value =
        failure instanceof TypeError
          ? 'Cannot reach the server. Please check your connection and try again.'
          : failure.message ||
            'Unable to complete the request. Please try again.'
    }
  } finally {
    busy.value = false
  }
}

async function handleGoogleResponse(response) {
  if (busy.value || disposed) return

  error.value = ''
  googleError.value = ''

  if (!response?.credential) {
    googleError.value = 'Google did not return a sign-in token.'
    return
  }

  if (typeof auth.googleLogin !== 'function') {
    googleError.value =
      'Google login still needs to be connected to your auth store and backend.'
    return
  }

  busy.value = true
  const submittedMode = props.mode

  try {
    await auth.googleLogin(response.credential)

    if (disposed || props.mode !== submittedMode) return

    await router.replace(localizedRoute('home'))
  } catch (failure) {
    if (disposed || props.mode !== submittedMode) return

    googleError.value =
      failure.message || 'Google sign-in failed. Please try again.'
  } finally {
    busy.value = false
  }
}

function initializeGoogle() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  if (!clientId) {
    googleLoading.value = false
    googleError.value = 'Missing VITE_GOOGLE_CLIENT_ID in frontend .env.'
    return true
  }

  if (!window.google?.accounts?.id || !googleButton.value) {
    return false
  }

  try {
    cleanupGoogle = renderGoogleSignIn(
      googleButton.value,
      clientId,
      handleGoogleResponse,
    )
  } catch (failure) {
    googleError.value =
      failure.message || 'Could not initialize Google sign-in.'
  }

  googleLoading.value = false
  return true
}

onMounted(() => {
  if (initializeGoogle()) return

  googleTimer = window.setInterval(() => {
    googleAttempts += 1

    if (initializeGoogle()) {
      window.clearInterval(googleTimer)
    } else if (googleAttempts >= 50) {
      window.clearInterval(googleTimer)

      googleLoading.value = false
      googleError.value =
        'Google sign-in could not load. Check your connection and refresh.'
    }
  }, 200)
})

onBeforeUnmount(() => {
  disposed = true
  window.clearInterval(googleTimer)
  cleanupGoogle?.()
})

watch(
  () => props.mode,
  () => {
    Object.assign(form, {
      username: '',
      email: '',
      identifier: '',
      password: '',
      confirmPassword: '',
    })

    error.value = ''
    showPassword.value = false
  },
)
</script>

<template>
  <main
    class="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-16 text-white"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -left-24 top-20 -z-10 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl"
    ></div>

    <div
      aria-hidden="true"
      class="pointer-events-none absolute -right-24 bottom-10 -z-10 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl"
    ></div>

    <section
      class="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl sm:p-10"
    >
      <RouterLink
        :to="localizedRoute('home')"
        class="mb-8 flex items-center justify-center gap-3"
      >
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400"
        >
          <img
            :src="brandImage"
            alt="Money Mentorship-FT logo"
            class="h-full w-full object-cover"
          />
        </span>

        <span class="text-lg font-bold">
          Money Mentorship-FT
        </span>
      </RouterLink>

      <header class="mb-8 text-center">
        <h1 class="text-3xl font-bold">
          {{ isRegister ? 'Create an account' : 'Welcome back' }}
        </h1>

        <p class="mt-3 text-sm text-slate-400">
          {{
            isRegister
              ? 'Register to access your account.'
              : 'Sign in to access your account.'
          }}
        </p>
      </header>

      <form @submit.prevent="handleSubmit" :aria-busy="busy">
        <fieldset :disabled="busy" class="min-w-0 space-y-5">
          <div v-if="isRegister">
            <label
              for="username"
              class="mb-2 block text-sm font-medium text-slate-200"
            >
              Username
            </label>

            <input
              id="username"
              v-model.trim="form.username"
              name="username"
              type="text"
              autocomplete="username"
              placeholder="Choose a username"
              minlength="3"
              maxlength="30"
              pattern="[A-Za-z0-9_]{3,30}"
              aria-describedby="username-hint"
              required
              :class="inputClass"
            />

            <p
              id="username-hint"
              class="mt-2 text-xs text-slate-400"
            >
              3–30 letters, numbers, or underscores.
            </p>
          </div>

          <div v-if="isRegister">
            <label
              for="email"
              class="mb-2 block text-sm font-medium text-slate-200"
            >
              Email address
            </label>

            <input
              id="email"
              v-model.trim="form.email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              maxlength="254"
              required
              :class="inputClass"
            />
          </div>

          <div v-else>
            <label
              for="identifier"
              class="mb-2 block text-sm font-medium text-slate-200"
            >
              Email or username
            </label>

            <input
              id="identifier"
              v-model.trim="form.identifier"
              name="identifier"
              type="text"
              autocomplete="username"
              placeholder="Enter your email or username"
              maxlength="254"
              required
              :class="inputClass"
            />
          </div>

          <div>
            <label
              for="password"
              class="mb-2 block text-sm font-medium text-slate-200"
            >
              Password
            </label>

            <div class="relative">
              <input
                id="password"
                v-model="form.password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="
                  isRegister ? 'new-password' : 'current-password'
                "
                :minlength="isRegister ? 12 : undefined"
                :aria-describedby="
                  isRegister ? 'password-hint' : undefined
                "
                placeholder="Enter your password"
                required
                :class="[inputClass, 'pr-20']"
              />

              <button
                type="button"
                @click="showPassword = !showPassword"
                :aria-label="
                  showPassword ? 'Hide password' : 'Show password'
                "
                :aria-pressed="showPassword"
                class="absolute inset-y-0 right-0 rounded-r-xl px-4 text-xs font-semibold text-indigo-300 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
              >
                {{ showPassword ? 'Hide' : 'Show' }}
              </button>
            </div>

            <p
              v-if="isRegister"
              id="password-hint"
              class="mt-2 text-xs text-slate-400"
            >
              Use at least 12 characters.
            </p>
          </div>

          <div v-if="!isRegister" class="flex justify-end">
            <RouterLink
              :to="localizedPath('/forgot-password')"
              class="text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300"
            >
              Forgot password?
            </RouterLink>
          </div>

          <div v-if="isRegister">
            <label
              for="confirm-password"
              class="mb-2 block text-sm font-medium text-slate-200"
            >
              Confirm password
            </label>

            <input
              id="confirm-password"
              v-model="form.confirmPassword"
              name="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Enter your password again"
              required
              :aria-invalid="passwordMismatch ? 'true' : undefined"
              :aria-describedby="
                passwordMismatch ? 'confirm-hint' : undefined
              "
              :class="inputClass"
            />

            <p
              v-if="passwordMismatch"
              id="confirm-hint"
              class="mt-2 text-xs text-red-300"
            >
              Passwords do not match.
            </p>
          </div>

          <p
            v-if="error"
            id="form-error"
            role="alert"
            class="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {{ error }}
          </p>

          <button
            type="submit"
            :disabled="busy"
            class="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 px-5 py-3.5 font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
          >
            {{
              busy
                ? 'Please wait…'
                : isRegister
                  ? 'Create account'
                  : 'Login'
            }}
          </button>
        </fieldset>
      </form>

      <p class="mt-7 text-center text-sm text-slate-400">
        {{
          isRegister
            ? 'Already have an account?'
            : "Don't have an account?"
        }}

        <RouterLink
          :to="localizedRoute(isRegister ? 'login' : 'register')"
          class="ml-1 font-semibold text-indigo-400 hover:text-indigo-300"
        >
          {{ isRegister ? 'Login' : 'Register' }}
        </RouterLink>
      </p>

      <p class="mt-4 text-center">
        <RouterLink
          :to="localizedRoute('verify-email')"
          class="text-sm text-indigo-400 hover:text-indigo-300"
        >
          Verify email / resend code
        </RouterLink>
      </p>

      <div class="mt-7 border-t border-white/10 pt-5 text-center">
        <RouterLink
          :to="localizedRoute('home')"
          class="text-sm text-slate-400 transition-colors hover:text-white"
        >
          ← Back to home
        </RouterLink>
      </div>

      <div class="my-6 flex items-center gap-4">
        <div class="h-px flex-1 bg-white/10"></div>
        <span class="text-xs text-slate-400">OR</span>
        <div class="h-px flex-1 bg-white/10"></div>
      </div>

      <div
        :class="{ 'pointer-events-none opacity-60': busy }"
        :aria-busy="busy || googleLoading"
      >
        <div
          ref="googleButton"
          class="flex w-full justify-center"
        ></div>
      </div>

      <p
        v-if="googleLoading"
        role="status"
        class="mt-2 text-center text-xs text-slate-400"
      >
        Loading Google sign-in…
      </p>

      <p
        v-if="googleError"
        role="alert"
        class="mt-3 text-center text-sm text-red-300"
      >
        {{ googleError }}
      </p>
    </section>
  </main>
</template>