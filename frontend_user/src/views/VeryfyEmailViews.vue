<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/user/authStore.js'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref(sessionStorage.getItem('verificationEmail') || '')
const code = ref('')
const busy = ref(false)
const error = ref('')
const message = ref(
  sessionStorage.getItem('verificationNotice') ||
    'Enter the verification code sent to your email.',
)

sessionStorage.removeItem('verificationNotice')

async function verify() {
  if (busy.value) return

  busy.value = true
  error.value = ''

  try {
    await auth.verifyEmail(email.value.trim(), code.value.trim())

    sessionStorage.removeItem('verificationEmail')

    await router.replace({
      name: 'home',
      params: route.params.lang ? { lang: route.params.lang } : {},
    })
  } catch (failure) {
    error.value = failure.message || 'Verification failed.'
  } finally {
    busy.value = false
  }
}

async function resend() {
  if (busy.value) return

  busy.value = true
  error.value = ''

  try {
    const result = await auth.resendCode(email.value.trim())
    message.value = result.message
    code.value = ''
  } catch (failure) {
    error.value = failure.message || 'Unable to send the code.'
  } finally {
    busy.value = false
  }
}

const inputClass =
  'mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-500'
</script>

<template>
  <main
    class="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-16 text-white"
  >
    <section
      class="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-10"
    >
      <h1 class="mb-4 text-center text-3xl font-bold">
        Verify your email
      </h1>

      <p role="status" class="mb-6 text-sm text-slate-300">
        {{ message }}
      </p>

      <form @submit.prevent="verify">
        <fieldset :disabled="busy" class="space-y-5">
          <label class="block text-sm">
            Email address
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              required
              :class="inputClass"
            />
          </label>

          <label class="block text-sm">
            Six-digit verification code
            <input
              v-model="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              pattern="[0-9]{6}"
              placeholder="000000"
              required
              :class="[inputClass, 'tracking-widest']"
            />
          </label>

          <p
            v-if="error"
            role="alert"
            class="rounded-xl bg-red-500/10 p-3 text-sm text-red-300"
          >
            {{ error }}
          </p>

          <button
            type="submit"
            class="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 p-3 font-semibold disabled:opacity-50"
          >
            {{ busy ? 'Please wait…' : 'Verify email' }}
          </button>

          <button
            type="button"
            :disabled="!email"
            @click="resend"
            class="w-full rounded-xl border border-slate-600 p-3 disabled:opacity-50"
          >
            Resend code
          </button>
        </fieldset>
      </form>

      <p class="mt-5 text-center text-xs text-slate-400">
        Codes expire in 10 minutes. Wait 60 seconds between requests.
        Check your spam folder.
      </p>
    </section>
  </main>
</template>