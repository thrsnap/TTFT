<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../../store/user/authStore.js'
import { api } from '../../api/autService.js'

const auth = useAuthStore()
const route = useRoute()

const loading = ref(true)
const message = ref('')
const error = ref('')

const username = computed(() => auth.user?.username || 'Member')

function localizedPath(path) {
  return route.params.lang === 'km' ? `/km${path}` : path
}

const sections = [
  {
    title: 'My Courses',
    description:
      'Access your purchased courses and continue learning.',
    path: '/dashboard/courses',
    button: 'View my courses',
    icon: '📚',
    color: 'bg-indigo-500/10',
  },
  {
    title: 'My News Signals',
    description:
      'Manage your subscription and access premium News Signals.',
    path: '/dashboard/news-signals',
    button: 'View my news signals',
    icon: '📊',
    color: 'bg-amber-500/10',
  },
  {
    title: 'My Challenges',
    description:
      'View your enrolled challenges and track their status.',
    path: '/dashboard/challenges',
    button: 'View my challenges',
    icon: '🏆',
    color: 'bg-emerald-500/10',
  },
]

async function loadDashboard() {
  if (loading.value && message.value) return

  loading.value = true
  error.value = ''
  message.value = ''

  try {
    const data = await api('/dashboard')
    message.value = data?.message || ''
  } catch (failure) {
    error.value = failure.message || 'Unable to load your dashboard.'
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <main
    class="mx-auto min-h-[70vh] max-w-7xl px-6 py-12
           text-(--text-color)
           max-[768px]:px-5 max-[768px]:py-10
           max-[600px]:px-4
           max-[480px]:py-8
           max-[414px]:px-3
           max-[320px]:px-2"
  >
    <header
      class="flex flex-wrap items-center justify-between gap-4"
    >
      <div class="min-w-0">
        <h1
          class="text-3xl font-bold max-[768px]:text-2xl"
        >
          My Dashboard
        </h1>

        <p class="mt-3 break-words text-sm opacity-70">
          Welcome back, {{ username }}.
        </p>
      </div>

      <RouterLink
        :to="localizedPath('/profile')"
        class="inline-flex items-center justify-center rounded-xl
               border border-(--border-color)
               bg-(--surface-bg) px-4 py-3
               text-sm font-semibold transition
               hover:border-indigo-500
               focus-visible:outline-2
               focus-visible:outline-offset-2
               focus-visible:outline-indigo-500"
      >
        My profile
      </RouterLink>
    </header>

    <div class="mt-6" aria-live="polite">
      <p v-if="loading" role="status" class="text-sm opacity-70">
        Loading dashboard…
      </p>

      <div
        v-else-if="error"
        role="alert"
        class="rounded-xl border border-red-500/20
               bg-red-500/10 p-4 text-sm text-red-500"
      >
        <p>{{ error }}</p>

        <button
          type="button"
          @click="loadDashboard"
          class="mt-3 cursor-pointer font-semibold underline"
        >
          Try again
        </button>
      </div>

      <p v-else-if="message" class="text-sm opacity-70">
        {{ message }}
      </p>
    </div>

    <section
      v-if="!loading && !error"
      aria-label="My courses, subscriptions, and challenges"
      class="mt-8 grid grid-cols-3 gap-6
             max-[1024px]:grid-cols-2
             max-[768px]:grid-cols-1
             max-[600px]:gap-5
             max-[480px]:gap-4"
    >
      <article
        v-for="section in sections"
        :key="section.path"
        class="flex min-w-0 flex-col rounded-2xl
               border border-(--border-color)
               bg-(--surface-bg) p-6
               max-[480px]:p-5
               max-[320px]:p-4"
      >
        <span
          aria-hidden="true"
          :class="section.color"
          class="flex h-14 w-14 items-center justify-center
                 rounded-2xl text-2xl"
        >
          {{ section.icon }}
        </span>

        <h2 class="mt-5 text-xl font-bold">
          {{ section.title }}
        </h2>

        <p class="mt-3 text-sm leading-6 opacity-70">
          {{ section.description }}
        </p>

        <div class="mt-auto pt-6">
          <RouterLink
            :to="localizedPath(section.path)"
            class="inline-flex w-full items-center justify-center
                   rounded-xl bg-gray-600 px-4 py-3
                   text-center text-sm font-semibold text-white
                   transition hover:bg-red-300
                   focus-visible:outline-2
                   focus-visible:outline-offset-2
                   focus-visible:outline-indigo-500"
          >
            {{ section.button }}
          </RouterLink>
        </div>
      </article>
    </section>

    <section
      v-if="!loading && !error"
      aria-label="Account status"
      class="mt-8 rounded-2xl border border-(--border-color)
             bg-(--surface-bg) p-6
             max-[480px]:p-5 max-[320px]:p-4"
    >
      <h2 class="text-lg font-semibold">Account status</h2>

      <p
        class="mt-3 text-sm font-medium"
        :class="
          auth.user?.emailVerified
            ? 'text-emerald-500'
            : 'text-amber-500'
        "
      >
        {{
          auth.user?.emailVerified
            ? 'Email verified'
            : 'Email not verified'
        }}
      </p>
    </section>
  </main>
</template>