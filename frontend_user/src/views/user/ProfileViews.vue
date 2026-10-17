<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../../store/user/authStore.js'

const auth = useAuthStore()
const route = useRoute()

const username = computed(() => auth.user?.username || 'Member')
const initial = computed(() => username.value.slice(0, 1).toUpperCase())
const email = computed(() => auth.user?.email || '—')
const verified = computed(() => Boolean(auth.user?.emailVerified))

const dashboardLink = computed(() => ({
  name: 'dashboard',
  params: route.params.lang === 'km' ? { lang: 'km' } : {},
}))
</script>

<template>
  <main class="w-full min-w-0 p-4 sm:p-6 lg:p-8">
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100">
        Personal information
      </h2>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Your profile and account details.
      </p>
    </div>

    <section
      aria-label="My information"
      class="w-full overflow-hidden rounded-3xl
             border border-slate-200 bg-white shadow-sm
             dark:border-white/10 dark:bg-[#111c2d]"
    >
      <div
        aria-hidden="true"
        class="relative h-28 overflow-hidden bg-[#123d35] sm:h-36"
      >
        <div
          class="absolute -top-24 right-12 size-64 rounded-full
                 border-[30px] border-white/5"
        />
        <div
          class="absolute -right-16 -bottom-36 size-80 rounded-full
                 border-[35px] border-emerald-300/10"
        />
      </div>

      <div class="px-5 pb-6 sm:px-8 sm:pb-8">
        <div
          class="relative -mt-10 flex flex-wrap items-end
                 justify-between gap-3"
        >
          <div
            aria-hidden="true"
            class="flex size-24 shrink-0 items-center justify-center
                   rounded-2xl border-[5px] border-white
                   bg-emerald-100 text-3xl font-bold text-emerald-800
                   shadow-sm dark:border-[#111c2d]"
          >
            {{ initial }}
          </div>

          <span
            class="mb-1 inline-flex items-center gap-2 rounded-full
                   px-3 py-1.5 text-xs font-semibold"
            :class="
              verified
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
            "
          >
            <span aria-hidden="true" class="size-1.5 rounded-full bg-current" />
            {{ verified ? 'Email verified' : 'Email not verified' }}
          </span>
        </div>

        <h3
          class="mt-4 break-words text-2xl font-semibold
                 text-slate-800 dark:text-slate-100"
        >
          {{ username }}
        </h3>

        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          CMM-FT member account
        </p>

        <dl
          class="mt-7 grid gap-5 border-t border-slate-100
                 pt-6 md:grid-cols-2 dark:border-white/10"
        >
          <div
            class="min-w-0 rounded-2xl border border-slate-100
                   bg-slate-50 p-5 dark:border-white/5 dark:bg-white/[0.03]"
          >
            <dt class="text-xs text-slate-500 dark:text-slate-400">
              Username
            </dt>
            <dd
              class="mt-2 break-all text-base font-semibold
                     text-slate-800 dark:text-slate-100"
            >
              {{ auth.user?.username || '—' }}
            </dd>
          </div>

          <div
            class="min-w-0 rounded-2xl border border-slate-100
                   bg-slate-50 p-5 dark:border-white/5 dark:bg-white/[0.03]"
          >
            <dt class="text-xs text-slate-500 dark:text-slate-400">
              Email address
            </dt>
            <dd
              class="mt-2 break-all text-base font-semibold
                     text-slate-800 dark:text-slate-100"
            >
              {{ email }}
            </dd>
          </div>
        </dl>

        <div
          class="mt-6 flex flex-wrap items-center justify-between
                 gap-4 border-t border-slate-100 pt-5 dark:border-white/10"
        >
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Your personal account information.
          </p>

          <RouterLink
            :to="dashboardLink"
            class="inline-flex items-center justify-center gap-2
                   rounded-xl bg-emerald-600 px-5 py-3 text-sm
                   font-semibold text-white transition hover:bg-emerald-700
                   focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-emerald-500"
          >
            Back to Overview
            <span aria-hidden="true">→</span>
          </RouterLink>
        </div>
      </div>
    </section>
  </main>
</template>