<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const telegramUrl = 'https://t.me/ThunTulaFT'

const dashboardPath = computed(() =>
  route.params.lang === 'km'
    ? '/km/dashboard'
    : '/dashboard',
)
</script>

<template>
  <main
    class="flex min-h-[70vh] items-center justify-center
           px-6 py-10 text-(--text-color)
           max-[768px]:px-5 max-[768px]:py-8
           max-[600px]:px-4 max-[600px]:py-7
           max-[480px]:px-3 max-[480px]:py-6
           max-[320px]:px-2 max-[320px]:py-4"
  >
    <section
      aria-labelledby="payment-heading"
      class="w-full max-w-md rounded-2xl
             border border-(--border-color)
             bg-(--surface-bg) p-6 text-center
             max-[480px]:rounded-xl max-[480px]:p-5
             max-[320px]:p-4"
    >
      <div
        aria-hidden="true"
        class="mx-auto flex h-14 w-14 items-center
               justify-center rounded-full
               bg-amber-500/10 text-amber-500"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-7 w-7"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>

      <h1
        id="payment-heading"
        class="mt-4 text-xl font-bold leading-snug
               max-[480px]:text-lg"
      >
        Payment not available yet
      </h1>

      <p
        class="mt-3 text-sm leading-6
               text-(--muted-color)"
      >
        Please contact the admin on
        <strong class="font-semibold text-(--text-color)">
          Telegram
        </strong>
        to purchase a course or subscribe to News Signals.
      </p>

      <p
        class="mt-2 text-sm leading-6
               text-(--muted-color)"
      >
        Send your registered email and the course or subscription
        you want. The admin will arrange payment and grant access.
      </p>

      <a
        :href="telegramUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-6 inline-flex min-h-11 w-full
               items-center justify-center rounded-lg
               bg-sky-600 px-4 py-3
               text-sm font-semibold text-white
               transition hover:bg-sky-500
               focus-visible:outline-2
               focus-visible:outline-offset-2
               focus-visible:outline-sky-500"
      >
        Contact admin on Telegram
      </a>

      <RouterLink
        :to="dashboardPath"
        class="mt-3 inline-flex min-h-11 w-full
               items-center justify-center rounded-lg
               border border-(--border-color)
               px-4 py-3 text-sm font-semibold
               transition hover:bg-(--hover-bg)
               focus-visible:outline-2
               focus-visible:outline-offset-2
               focus-visible:outline-indigo-500"
      >
        Back to dashboard
      </RouterLink>
    </section>
  </main>
</template>