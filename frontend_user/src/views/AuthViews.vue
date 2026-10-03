<template>
  <main
    class="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-16 text-white"
  >
    <!-- Background glow -->
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
      <!-- Brand -->
      <RouterLink
        to="/"
        class="mb-8 flex items-center justify-center gap-3"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-lg font-black"
        >
          <img class="object-cover rounded-xl " src="../../public/Profile.jpg" alt="profile">
        </span>

        <span class="text-lg font-bold">Money Mentorship-FT</span>
      </RouterLink>

      <!-- Heading -->
      <header class="mb-8 text-center">
        <h1 class="text-3xl font-bold">
          {{ isRegister ? 'Create an account' : 'Welcome back' }}
        </h1>

      </header>

      <form @submit.prevent="handleSubmit" class="space-y-5">
        <!-- Name: register only -->
        <div v-if="isRegister">
          <label
            for="full-name"
            class="mb-2 block text-sm font-medium text-slate-200"
          >
            Full name
          </label>

          <input
            id="full-name"
            v-model.trim="form.name"
            name="name"
            type="text"
            autocomplete="name"
            placeholder="Enter your full name"
            required
            :class="inputClass"
          />
        </div>

        <!-- Email -->
        <div>
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
            required
            :class="inputClass"
          />
        </div>

        <!-- Password -->
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
              :autocomplete="isRegister ? 'new-password' : 'current-password'"
              :minlength="isRegister ? 8 : undefined"
              :aria-describedby="isRegister ? 'password-hint' : undefined"
              placeholder="Enter your password"
              required
              :class="[inputClass, 'pr-20']"
            />

            <button
              type="button"
              @click="showPassword = !showPassword"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
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
            Use at least 8 characters.
          </p>
        </div>

        <!-- Forgot password: login only -->
<div v-if="!isRegister" class="flex justify-end">
  <RouterLink
    to="/forgot-password"
    class="text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300"
  >
    Forgot password?
  </RouterLink>
</div>

        <!-- Confirm password: register only -->
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
            :aria-invalid="error ? 'true' : undefined"
            :aria-describedby="error ? 'form-error' : undefined"
            :class="inputClass"
            @input="error = ''; message = ''"
          />
        </div>

        <!-- Validation error -->
        <p
          v-if="error"
          id="form-error"
          role="alert"
          class="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {{ error }}
        </p>

        <!-- Demo status -->
        <p
          v-if="message"
          role="status"
          class="rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm leading-6 text-indigo-200"
        >
          {{ message }}
        </p>

        <button
          type="submit"
          class="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 px-5 py-3.5 font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 active:scale-[0.99]"
        >
          {{ isRegister ? 'Create account' : 'Login' }}
        </button>
      </form>

      <!-- Switch page -->
      <p class="mt-7 text-center text-sm text-slate-400">
        {{ isRegister ? 'Already have an account?' : "Don't have an account?" }}

        <RouterLink
          :to="isRegister ? '/login' : '/register'"
          class="ml-1 font-semibold text-indigo-400 hover:text-indigo-300"
        >
          {{ isRegister ? 'Login' : 'Register' }}
        </RouterLink>
      </p>

      <div class="mt-7 border-t border-white/10 pt-5 text-center">
        <RouterLink
          to="/"
          class="text-sm text-slate-400 transition-colors hover:text-white"
        >
          ← Back to home
        </RouterLink>
      </div>
      <!-- Divider -->
<div class="my-6 flex items-center gap-4">
  <div class="h-px flex-1 bg-white/10"></div>
  <span class="text-xs text-slate-400">OR</span>
  <div class="h-px flex-1 bg-white/10"></div>
</div>

<!-- Google login -->
<button
  type="button"
  @click="handleGoogleLogin"
  class="cursor-pointer flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400"
>
  <svg
    aria-hidden="true"
    class="h-5 w-5 shrink-0"
    viewBox="0 0 24 24"
  >
    <path
      fill="#4285F4"
      d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
    />
    <path
      fill="#FBBC05"
      d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
    />
  </svg>

  Continue with Google
</button>
    </section>
  </main>
  
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  mode: {
    type: String,
    default: 'login',
  },
})

const isRegister = computed(() => props.mode === 'register')

const showPassword = ref(false)
const error = ref('')
const message = ref('')

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const inputClass =
  'block w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'

function handleSubmit() {
  error.value = ''
  message.value = ''

  if (isRegister.value) {
    if (!form.name.trim()) {
      error.value = 'Please enter your full name.'
      return
    }

    if (form.password !== form.confirmPassword) {
      error.value = 'Passwords do not match.'
      return
    }

    // Connect your registration service here.
    // Send name, email, and password. Do not store passwords locally.
    message.value =
      'Form validated. Registration is not connected yet; no account was created.'
  } else {
    // Connect your login service here.
    message.value =
      'Form validated. Login is not connected yet; you are not signed in.'
  }
}

// Clear fields when switching between login and register.
watch(
  () => props.mode,
  () => {
    Object.assign(form, {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    })

    error.value = ''
    message.value = ''
    showPassword.value = false
  },
)
function handleGoogleLogin() {
  error.value = ''
  message.value =
    'Google sign-in is not connected yet. Connect an authentication provider to enable it.'
}
</script>