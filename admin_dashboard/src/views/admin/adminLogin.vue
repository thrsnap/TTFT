<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { loginAdmin } from '../../api/authApi.js'
import TurnstileWidget from '../../components/TurnstileWidget.vue'

const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

const turnstileToken = ref('')
const turnstileWidget = ref(null)

const dark = ref(
  localStorage.getItem('admin-theme') === 'dark',
)

let disposed = false

onBeforeUnmount(() => {
  disposed = true
})

async function submitLogin() {
  if (loading.value || disposed) return

  error.value = ''

  if (!turnstileToken.value) {
    error.value = 'Complete the security verification first.'
    return
  }

  loading.value = true

  try {
    // authApi.js reads the token supplied by TurnstileWidget.
    await loginAdmin(
      email.value.trim(),
      password.value,
    )

    if (!disposed) {
      await router.replace('/admin')
    }
  } catch (failure) {
    if (!disposed) {
      error.value = failure.message || 'Unable to log in.'
    }
  } finally {
    if (!disposed) {
      loading.value = false
      turnstileWidget.value?.reset()
    }
  }
}
</script>

<template>
  <main
    :class="{ dark }"
    class="flex min-h-screen items-center justify-center
           bg-slate-50 px-6 py-10 text-slate-800
           dark:bg-slate-950 dark:text-slate-100
           max-[768px]:px-5
           max-[600px]:px-4
           max-[480px]:py-6
           max-[414px]:px-3
           max-[320px]:px-2"
  >
    <section
      class="w-full max-w-md rounded-2xl border
             border-slate-200 bg-white p-8 shadow-sm
             dark:border-slate-700 dark:bg-slate-900
             max-[600px]:p-6
             max-[480px]:p-5
             max-[414px]:p-4
             max-[320px]:p-3"
    >
      <p
        class="text-sm font-semibold tracking-widest
               text-emerald-700 dark:text-emerald-400"
      >
        CMM-FT
      </p>

      <h1 class="mt-3 text-2xl font-semibold">
        Admin login
      </h1>

      <p
        class="mt-2 text-sm leading-relaxed
               text-slate-500 dark:text-slate-400"
      >
        Sign in with your administrator account.
      </p>

      <form
        class="mt-7 space-y-5"
        :aria-busy="loading"
        @submit.prevent="submitLogin"
      >
        <div>
          <label
            for="admin-email"
            class="mb-2 block text-sm font-medium"
          >
            Email address
          </label>

          <input
            id="admin-email"
            v-model="email"
            name="email"
            type="email"
            autocomplete="username"
            maxlength="254"
            required
            :disabled="loading"
            class="w-full min-w-0 rounded-lg border
                   border-slate-300 bg-transparent px-4 py-3
                   outline-none focus:border-emerald-500
                   focus:ring-2 focus:ring-emerald-500/20
                   dark:border-slate-600"
          />
        </div>

        <div>
          <label
            for="admin-password"
            class="mb-2 block text-sm font-medium"
          >
            Password
          </label>

          <input
            id="admin-password"
            v-model="password"
            name="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
            :disabled="loading"
            class="w-full min-w-0 rounded-lg border
                   border-slate-300 bg-transparent px-4 py-3
                   outline-none focus:border-emerald-500
                   focus:ring-2 focus:ring-emerald-500/20
                   dark:border-slate-600"
          />

          <label
            class="mt-3 inline-flex cursor-pointer
                   items-center gap-2 text-sm"
          >
            <input
              v-model="showPassword"
              type="checkbox"
              :disabled="loading"
              class="size-4 accent-emerald-600"
            />
            Show password
          </label>
        </div>

        <TurnstileWidget
          ref="turnstileWidget"
          v-model="turnstileToken"
        />

        <p
          v-if="error"
          role="alert"
          class="rounded-lg border border-red-200
                 bg-red-50 p-3 text-sm text-red-700
                 dark:border-red-900 dark:bg-red-950/40
                 dark:text-red-300"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading || !turnstileToken"
          class="min-h-11 w-full rounded-lg bg-emerald-700
                 px-4 py-3 font-medium text-white
                 transition hover:bg-emerald-800
                 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </section>
  </main>
</template>