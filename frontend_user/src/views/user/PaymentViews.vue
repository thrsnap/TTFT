<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const telegramUrl = 'https://t.me/ThunTulaFT'

const dashboardPath = computed(() =>
  route.params.lang === 'km' ? '/km/dashboard' : '/dashboard',
)
</script>

<template>
  <main
    class="flex min-h-[70vh] items-center justify-center
           px-4 py-8 text-(--text-color)
           sm:px-6 sm:py-10"
  >
    <section
      aria-labelledby="payment-heading"
      class="w-full max-w-md rounded-2xl
             border border-(--border-color)
             bg-(--surface-bg) p-5 text-center
             sm:p-8"
    >
      <div
        class="mx-auto flex h-14 w-14 items-center
               justify-center rounded-full bg-amber-500/10
               text-amber-600 dark:text-amber-400"
      >
        <svg
          class="h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6" />
          <path d="M12 16h.01" stroke-linecap="round" />
        </svg>
      </div>

      <h1
        id="payment-heading"
        class="mt-5 text-xl font-bold sm:text-2xl"
      >
        Payment under maintenance!!!
      </h1>

      <p class="mt-3 text-sm leading-7 text-(--muted-color)">
        Please contact the admin on Telegram for payment
        instructions and access to your selected signal or course.
      </p>

      <a
        :href="telegramUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-6 inline-flex min-h-12 w-full
               items-center justify-center rounded-xl
               bg-sky-600 px-5 py-3 text-sm font-semibold
               text-white transition hover:bg-sky-500
               focus-visible:outline-2
               focus-visible:outline-offset-2
               focus-visible:outline-sky-500"
      >
        Contact admin on Telegram
      </a>

      <RouterLink
        :to="dashboardPath"
        class="mt-3 inline-flex min-h-12 w-full
               items-center justify-center rounded-xl
               border border-(--border-color)
               px-5 py-3 text-sm font-semibold
               transition hover:bg-(--hover-bg)"
      >
        Back to dashboard
      </RouterLink>
    </section>
  </main>
</template>