<script setup>
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { api } from '../api/autService.js'

const route = useRoute()

const step = ref('email')
const email = ref('')
const code = ref('')
const password = ref('')
const confirmPassword = ref('')
const resetToken = ref('')

const busy = ref(false)
const error = ref('')
const notice = ref('')
const resendAvailableAt = ref(0)

const loginRoute = computed(() => ({
  name: 'login',
  params: route.params.lang ? { lang: route.params.lang } : {},
}))

const title = computed(() => ({
  email: 'Forgot password?',
  code: 'Enter verification code',
  password: 'Set a new password',
  done: 'Password updated',
})[step.value])

const inputClass =
  'w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400'

async function sendCode() {
  if (busy.value) return

  error.value = ''

  if (Date.now() < resendAvailableAt.value) {
    const seconds = Math.ceil(
      (resendAvailableAt.value - Date.now()) / 1000,
    )
    error.value = `Wait ${seconds} seconds before resending.`
    return
  }

  busy.value = true

  try {
    const data = await api('/auth/forgot-password', 'POST', {
      email: email.value.trim().toLowerCase(),
    })

    email.value = email.value.trim().toLowerCase()
    code.value = ''
    resetToken.value = ''
    notice.value = data.message
    resendAvailableAt.value = Date.now() + 60000
    step.value = 'code'
  } catch (failure) {
    error.value = failure.message || 'Could not request a reset code.'
  } finally {
    busy.value = false
  }
}

async function verifyCode() {
  if (busy.value) return

  error.value = ''

  if (!/^\d{6}$/.test(code.value.trim())) {
    error.value = 'Enter the six-digit code.'
    return
  }

  busy.value = true

  try {
    const data = await api('/auth/verify-reset-code', 'POST', {
      email: email.value,
      code: code.value.trim(),
    })

    if (!data.resetToken) {
      throw new Error('The server did not return a reset token.')
    }

    resetToken.value = data.resetToken
    code.value = ''
    notice.value = data.message
    step.value = 'password'
  } catch (failure) {
    error.value = failure.message || 'Could not verify the code.'
  } finally {
    busy.value = false
  }
}

async function savePassword() {
  if (busy.value) return

  error.value = ''

  if (
    password.value.length < 12 ||
    new TextEncoder().encode(password.value).length > 72
  ) {
    error.value =
      'Use at least 12 characters and at most 72 UTF-8 bytes.'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  busy.value = true

  try {
    const data = await api('/auth/reset-password', 'POST', {
      resetToken: resetToken.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
    })

    resetToken.value = ''
    password.value = ''
    confirmPassword.value = ''
    notice.value = data.message
    step.value = 'done'
  } catch (failure) {
    error.value = failure.message || 'Could not reset your password.'
  } finally {
    busy.value = false
  }
}
const showPassword = ref(false)
function startAgain() {
  if (busy.value) return

  step.value = 'email'
  code.value = ''
  resetToken.value = ''
  password.value = ''
  confirmPassword.value = ''
  error.value = ''
  notice.value = ''
}
</script>

<template>
  <main
    class="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-16 text-white"
  >
    <section
      class="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl sm:p-10"
    >
      <h1 class="text-center text-2xl font-bold">
        {{ title }}
      </h1>

      <p
        v-if="notice"
        role="status"
        class="mt-5 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-300"
      >
        {{ notice }}
      </p>

      <p
        v-if="error"
        role="alert"
        class="mt-5 rounded-xl bg-red-500/10 p-4 text-sm text-red-300"
      >
        {{ error }}
      </p>

      <!-- Step 1: enter email -->
      <form
        v-if="step === 'email'"
        class="mt-6"
        @submit.prevent="sendCode"
      >
        <fieldset :disabled="busy" class="space-y-5">
          <div>
            <label for="reset-email" class="mb-2 block text-sm">
              Email address
            </label>

            <input
              id="reset-email"
              v-model.trim="email"
              type="email"
              autocomplete="email"
              maxlength="254"
              placeholder="you@example.com"
              required
              :class="inputClass"
            />
          </div>

          <button
            type="submit"
            class="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold disabled:opacity-60"
          >
            {{ busy ? 'Sending…' : 'Send code' }}
          </button>
        </fieldset>

        <p class="mt-4 text-sm text-slate-400">
          If you signed up only with Google, use Continue with Google.
        </p>
      </form>

      <!-- Step 2: verify code -->
      <form
        v-else-if="step === 'code'"
        class="mt-6"
        @submit.prevent="verifyCode"
      >
        <p class="mb-5 break-all text-sm text-slate-400">
          Check the inbox for {{ email }}.
        </p>

        <fieldset :disabled="busy" class="space-y-5">
          <div>
            <label for="reset-code" class="mb-2 block text-sm">
              Six-digit code
            </label>

            <input
              id="reset-code"
              v-model.trim="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              pattern="[0-9]{6}"
              minlength="6"
              maxlength="6"
              placeholder="000000"
              required
              :class="[inputClass, 'text-center text-xl tracking-widest']"
            />
          </div>

          <button
            type="submit"
            class="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold disabled:opacity-60"
          >
            {{ busy ? 'Verifying…' : 'Verify code' }}
          </button>

          <button
            type="button"
            class="w-full text-sm text-indigo-300"
            @click="sendCode"
          >
            Resend code
          </button>

          <button
            type="button"
            class="w-full text-sm text-slate-400"
            @click="startAgain"
          >
            Change email
          </button>
        </fieldset>
      </form>

      <!-- Step 3: set new password -->
      <form
        v-else-if="step === 'password'"
        class="mt-6"
        @submit.prevent="savePassword"
      >
        <fieldset :disabled="busy" class="space-y-5">
          <div>
  <label for="new-password" class="mb-2 block text-sm">
    New password
  </label>

  <div class="relative">
    <input
      id="new-password"
      v-model="password"
      :type="showPassword ? 'text' : 'password'"
      autocomplete="new-password"
      minlength="12"
      required
      :class="[inputClass, 'pr-20']"
    />

    <button
      type="button"
      @click="showPassword = !showPassword"
      :aria-label="showPassword ? 'Hide passwords' : 'Show passwords'"
      :aria-pressed="showPassword"
      class="absolute inset-y-0 right-0 px-4 text-sm font-semibold text-indigo-300 hover:text-white"
    >
      {{ showPassword ? 'Hide' : 'Show' }}
    </button>
  </div>

  <p class="mt-2 text-xs text-slate-400">
    At least 12 characters.
  </p>
</div>

          <div>
            <label for="confirm-password" class="mb-2 block text-sm">
              Confirm new password
            </label>

            <input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              minlength="12"
              required
              :class="inputClass"
            />
          </div>

          <button
            type="submit"
            class="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold disabled:opacity-60"
          >
            {{ busy ? 'Saving…' : 'Reset password' }}
          </button>

          <button
            type="button"
            class="w-full text-sm text-slate-400"
            @click="startAgain"
          >
            Request a new code
          </button>
        </fieldset>
      </form>

      <RouterLink
        v-if="step === 'done'"
        :to="loginRoute"
        class="mt-6 block rounded-xl bg-indigo-600 px-4 py-3 text-center font-semibold"
      >
        Log in with new password
      </RouterLink>

      <RouterLink
        v-else
        :to="loginRoute"
        class="mt-6 block text-center text-sm text-slate-400 hover:text-white"
      >
        Back to login
      </RouterLink>
    </section>
  </main>
</template>