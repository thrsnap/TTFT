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
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-lg font-black"
        >
          <img
            class="rounded-xl object-cover"
            src="/Profile.jpg"
            alt="profile"
          />
        </span>

        <span class="text-lg font-bold">Money Mentorship-FT</span>
      </RouterLink>

      <header class="mb-8 text-center">
        <h1 class="text-3xl font-bold">Forgot password?</h1>

        <p class="mt-3 text-sm leading-6 text-slate-400">
          Enter the email address associated with your account to request
          a password reset link.
        </p>
      </header>

      <form @submit.prevent="handleForgotPassword" class="space-y-5">
        <div>
          <label
            for="reset-email"
            class="mb-2 block text-sm font-medium text-slate-200"
          >
            Email address
          </label>

          <input
            id="reset-email"
            v-model.trim="email"
            name="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
            class="block w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            @input="message = ''"
          />
        </div>

        <p
          v-if="message"
          role="status"
          class="rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm leading-6 text-indigo-200"
        >
          {{ message }}
        </p>

        <button
          type="submit"
          class="w-full cursor-pointer rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 px-5 py-3.5 font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 active:scale-[0.99]"
        >
          Send reset link
        </button>
      </form>

      <div class="mt-7 border-t border-white/10 pt-5 text-center">
        <RouterLink
          to="/login"
          class="text-sm font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
        >
          ← Back to login
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

const email = ref('')
const message = ref('')

function handleForgotPassword() {
  // Connect your backend password-reset service here.
  message.value =
    'Password reset is not connected yet. No reset email has been sent.'
}
</script>