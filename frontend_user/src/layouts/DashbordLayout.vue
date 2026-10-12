<script setup>
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()

const menu = [
  { label: 'Overview', path: '/dashboard' },
  { label: 'My Courses', path: '/dashboard/courses' },
  { label: 'My News Signals', path: '/dashboard/news-signals' },
  { label: 'My Challenges', path: '/dashboard/challenges' },
  { label: 'My Support', path: '/dashboard/support' }
]

function localizedPath(path) {
  if (route.params.lang !== 'km') return path

  return path === '/' ? '/km' : `/km${path}`
}
</script>

<template>
  <div class="min-h-[70vh] min-w-0 text-(--text-color)">
    <nav
      aria-label="Dashboard navigation"
      class="border-b border-(--border-color) bg-(--surface-bg)"
    >
      <div
        class="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4
               max-[768px]:flex-col max-[768px]:items-stretch
               max-[768px]:gap-3 max-[768px]:px-5
               max-[600px]:px-4 max-[600px]:py-3
               max-[480px]:gap-2
               max-[414px]:px-3
               max-[320px]:px-2"
      >
        <div
          class="flex min-w-0 flex-wrap gap-2
                 max-[768px]:grid max-[768px]:grid-cols-2
                 max-[320px]:gap-1.5"
        >
          <RouterLink
            v-for="item in menu"
            :key="item.path"
            :to="localizedPath(item.path)"
            class="flex min-w-0 items-center justify-center
                   rounded-xl px-4 py-3 text-center text-sm
                   font-semibold transition-colors
                   hover:bg-gray-600 hover:text-white
                   max-[600px]:px-3 max-[600px]:py-2.5
                   max-[480px]:text-xs
                   max-[414px]:px-2
                   max-[320px]:rounded-lg max-[320px]:px-1.5
                   max-[320px]:py-2"
            :class="
              route.path.replace(/\/$/, '') === localizedPath(item.path)
                ? 'bg-gray-600 text-white'
                : 'text-(--text-color)'
            "
          >
            {{ item.label }}
          </RouterLink>
        </div>

        <RouterLink
          :to="localizedPath('/')"
          class="ml-auto inline-flex shrink-0 items-center
                 justify-center rounded-xl bg-gray-600
                 px-4 py-3 text-center text-sm font-semibold
                 text-white transition-colors hover:bg-gray-500
                 max-[768px]:ml-0 max-[768px]:w-full
                 max-[600px]:px-3 max-[600px]:py-2.5
                 max-[480px]:text-xs
                 max-[414px]:px-2
                 max-[320px]:rounded-lg max-[320px]:py-2"
        >
          ← Back to HomePage
        </RouterLink>
      </div>
    </nav>

    <RouterView />
  </div>
</template>