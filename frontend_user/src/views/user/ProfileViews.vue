<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../../store/user/authStore.js'

const auth = useAuthStore()
const route = useRoute()
const username = computed(() => auth.user?.username || 'Member')
const initial = computed(() => username.value.slice(0, 1).toUpperCase())
const dashboardLink = computed(() => ({
  name: 'dashboard',
  params: route.params.lang === 'km' ? { lang: 'km' } : {},
}))
</script>

<template>
  <main class="mx-auto min-h-[70vh] max-w-3xl px-4 py-8 text-(--text-color) sm:px-6 sm:py-12">
    <h1 class="text-2xl font-bold sm:text-3xl">My profile</h1>
    <p class="mt-2 text-sm opacity-70">Your account information.</p>
    <section class="mt-8 rounded-2xl border border-(--border-color) bg-(--surface-bg) p-5 sm:p-8">
      <div class="flex items-center gap-4">
        <span class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white">{{ initial }}</span>
        <div class="min-w-0">
          <h2 class="break-words text-xl font-semibold">{{ username }}</h2>
          <span v-if="auth.user?.emailVerified" class="mt-2 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">Email verified</span>
        </div>
      </div>
      <dl class="mt-8 space-y-6 border-t border-(--border-color) pt-6">
        <div><dt class="text-sm opacity-65">Username</dt><dd class="mt-2 break-all font-semibold">{{ auth.user?.username || '—' }}</dd></div>
        <div><dt class="text-sm opacity-65">Email address</dt><dd class="mt-2 break-all font-semibold">{{ auth.user?.email || '—' }}</dd></div>
      </dl>
      <RouterLink :to="dashboardLink" class="mt-8 inline-block rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500">Go to my dashboard</RouterLink>
    </section>
  </main>
</template>
