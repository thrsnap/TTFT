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
           px-4 py-8 text-(--text-color)"
  >
    <section
      class="w-full max-w-md rounded-2xl
             border border-(--border-color)
             bg-(--surface-bg) p-6 text-center sm:p-8"
    >
      <div
        class="mx-auto flex h-16 w-16 items-center justify-center
               rounded-full bg-amber-500/10 text-amber-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-8 w-8"
          aria-hidden="true"
        >
          <path d="m10.3 3.9-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </div>

      <h1 class="mt-5 text-2xl font-bold">
        Payment Under Maintenance
      </h1>

      <p class="mt-3 text-sm leading-7 text-(--muted-color)">
        Online payments are temporarily unavailable.
        Please contact our admin via Telegram to purchase
        a course or signal.
      </p>

      <a
        :href="telegramUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-6 flex min-h-11 w-full items-center
               justify-center rounded-xl bg-sky-600
               px-5 py-3 font-semibold text-white
               transition-colors hover:bg-sky-500"
      >
        Contact Admin on Telegram
      </a>

      <RouterLink
        :to="dashboardPath"
        class="mt-3 flex min-h-11 w-full items-center
               justify-center rounded-xl
               border border-(--border-color)
               px-5 py-3 font-medium
               transition-colors hover:bg-sky-500/10"
      >
        Back to Dashboard
      </RouterLink>
    </section>
  </main>
</template>