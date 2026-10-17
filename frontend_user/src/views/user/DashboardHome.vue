<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../../store/user/authStore.js'
import { api } from '../../api/autService.js'

const auth = useAuthStore()
const route = useRoute()

const loading = ref(true)
const error = ref('')
let requestPending = false

const username = computed(
  () => auth.user?.username || 'Member',
)

function localizedPath(path) {
  if (route.params.lang !== 'km') return path

  return path === '/' ? '/km' : `/km${path}`
}

const services = [
  {
    title: 'My Courses',
    subtitle: 'Learn at your own pace',
    description: 'Access your purchased courses and continue learning.',
    path: '/dashboard/courses',
    button: 'View my courses',
    icon: 'M3 5h6a3 3 0 0 1 3 3v13a5 5 0 0 0-5-2H3z M21 5h-6a3 3 0 0 0-3 3v13a5 5 0 0 1 5-2h4z',
    color:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  },
  {
    title: 'My Signal',
    subtitle: 'Your trading access',
    description: 'Access your News Signals and Daily Signals.',
    path: '/dashboard/signals',
    button: 'View my signals',
    icon: 'M3 17l6-6 4 4 8-10 M15 5h6v6',
    color:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  {
    title: 'My Challenges',
    subtitle: 'Keep moving forward',
    description: 'Review your enrolled challenges and check their status.',
    path: '/dashboard/challenges',
    button: 'View my challenges',
    icon: 'M8 3h8v6a4 4 0 0 1-8 0z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 13v7 M8 21h8',
    color:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
]

async function loadDashboard() {
  if (requestPending) return

  requestPending = true
  loading.value = true
  error.value = ''

  try {
    await api('/dashboard')
  } catch (failure) {
    error.value =
      failure?.message || 'Unable to refresh your dashboard.'
  } finally {
    loading.value = false
    requestPending = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <main
    class="w-full min-w-0 space-y-6 p-4
           text-slate-900 sm:p-6 lg:p-8 dark:text-slate-100"
  >
    <!-- Welcome -->
    <section
      class="relative isolate overflow-hidden rounded-2xl
             border border-emerald-800 bg-[#123d35]
             p-5 text-white sm:p-7"
    >
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -top-16 -right-16
               -z-10 size-64 rounded-full border-[30px] border-white/5"
      />

      <p
        class="text-[11px] font-semibold uppercase
               tracking-[0.15em] text-emerald-200"
      >
        Your member space
      </p>

      <h2
        class="mt-3 break-words text-2xl font-semibold
               leading-tight text-white sm:text-3xl"
      >
        Welcome back, {{ username }}.
      </h2>

      <p class="mt-3 max-w-xl text-sm leading-6 text-emerald-100">
        Manage your learning, News Signals, Daily Signals, and challenges
        in one place.
      </p>

      <RouterLink
        :to="localizedPath('/dashboard/courses')"
        class="mt-5 inline-flex items-center justify-center gap-3
               rounded-xl bg-white px-4 py-2.5 text-sm
               font-semibold text-emerald-950 transition
               hover:bg-emerald-50 focus-visible:outline-2
               focus-visible:outline-offset-2
               focus-visible:outline-white"
      >
        Go to my courses
        <span aria-hidden="true">→</span>
      </RouterLink>
    </section>

    <!-- Request status -->
    <div v-if="loading || error" aria-live="polite">
      <p
        v-if="loading"
        role="status"
        class="text-sm text-slate-600 dark:text-slate-300"
      >
        Refreshing your workspace…
      </p>

      <div
        v-else-if="error"
        role="alert"
        class="flex flex-wrap items-center justify-between
               gap-3 rounded-xl border border-red-200
               bg-red-50 p-4 text-sm text-red-700
               dark:border-red-500/20 dark:bg-red-500/10
               dark:text-red-300"
      >
        <p>{{ error }}</p>

        <button
          type="button"
          class="cursor-pointer font-semibold underline
                 underline-offset-4"
          @click="loadDashboard"
        >
          Try again
        </button>
      </div>
    </div>

    <!-- Services -->
    <section aria-labelledby="dashboard-services-title">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2
          id="dashboard-services-title"
          class="text-base font-semibold text-slate-900 dark:text-white"
        >
          Your services
        </h2>

        <span class="text-xs text-slate-500 dark:text-slate-400">
          Quick access
        </span>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="service in services"
          :key="service.path"
          class="flex min-w-0 flex-col rounded-2xl
                 border border-slate-200 bg-white p-5 shadow-sm
                 transition hover:border-emerald-400
                 dark:border-slate-700 dark:bg-[#111c2d]
                 dark:hover:border-emerald-500/50"
        >
          <span
            :class="service.color"
            class="flex size-11 items-center justify-center rounded-xl"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-5"
            >
              <path :d="service.icon" />
            </svg>
          </span>

          <h3
            class="mt-4 text-lg font-semibold
                   text-slate-900 dark:text-white"
          >
            {{ service.title }}
          </h3>

          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ service.subtitle }}
          </p>

          <p
            class="mt-3 text-sm leading-6
                   text-slate-600 dark:text-slate-300"
          >
            {{ service.description }}
          </p>

          <div class="mt-auto pt-5">
            <RouterLink
              :to="localizedPath(service.path)"
              class="flex items-center justify-between gap-3
                     rounded-xl bg-slate-100 px-4 py-3
                     text-sm font-semibold text-emerald-800
                     transition hover:bg-emerald-100
                     focus-visible:outline-2
                     focus-visible:outline-emerald-500
                     dark:bg-white/5 dark:text-emerald-300
                     dark:hover:bg-emerald-500/15"
            >
              <span>{{ service.button }}</span>
              <span aria-hidden="true">→</span>
            </RouterLink>
          </div>
        </article>
      </div>
    </section>

    <!-- Account and support -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section
        class="min-w-0 rounded-2xl border border-slate-200
               bg-white p-5 dark:border-slate-700 dark:bg-[#111c2d]"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2
            class="text-base font-semibold
                   text-slate-900 dark:text-white"
          >
            Account status
          </h2>

          <span
            class="inline-flex items-center gap-2 rounded-full
                   px-3 py-1 text-xs font-semibold"
            :class="
              auth.user?.emailVerified
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
            "
          >
            <span
              aria-hidden="true"
              class="size-1.5 rounded-full bg-current"
            />
            {{ auth.user?.emailVerified ? 'Verified' : 'Unverified' }}
          </span>
        </div>

        <p
          class="mt-4 break-all text-sm font-medium
                 text-slate-700 dark:text-slate-200"
        >
          {{ auth.user?.email || '—' }}
        </p>

        <RouterLink
          :to="localizedPath('/dashboard/profile')"
          class="mt-4 inline-flex items-center gap-2 text-sm
                 font-semibold text-emerald-700 hover:underline
                 dark:text-emerald-300"
        >
          My information
          <span aria-hidden="true">→</span>
        </RouterLink>
      </section>

      <section
        class="min-w-0 rounded-2xl border border-slate-200
               bg-white p-5 dark:border-slate-700 dark:bg-[#111c2d]"
      >
        <h2
          class="text-base font-semibold
                 text-slate-900 dark:text-white"
        >
          We’re here to help
        </h2>

        <p
          class="mt-3 text-sm leading-6
                 text-slate-600 dark:text-slate-300"
        >
          Questions about your account, courses, or access?
          Visit your support inbox.
        </p>

        <RouterLink
          :to="localizedPath('/dashboard/support')"
          class="mt-4 inline-flex items-center gap-2 text-sm
                 font-semibold text-emerald-700 hover:underline
                 dark:text-emerald-300"
        >
          Open support
          <span aria-hidden="true">→</span>
        </RouterLink>
      </section>
    </div>
  </main>
</template>