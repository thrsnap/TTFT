<script setup>
import {
  onActivated,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { api } from '../../api/autService.js'

const route = useRoute()

const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')

const courses = ref([])
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')

let pending = false
let disposed = false

function localizedPath(path) {
  return route.params.lang === 'km' ? `/km${path}` : path
}

function coverUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return ''
  }

  try {
    const url = new URL(value.trim(), `${BASE}/`)

    return ['http:', 'https:'].includes(url.protocol)
      ? url.href
      : ''
  } catch {
    return ''
  }
}

function coverFailed(course) {
  if (
    course.fallbackCover &&
    course.cover !== course.fallbackCover
  ) {
    course.cover = course.fallbackCover
    return
  }

  course.cover = ''
}

async function loadCourses() {
  if (pending || disposed) return

  pending = true
  refreshing.value = true
  error.value = ''

  try {
    const data = await api('/courses/my')

    if (disposed) return

    if (!Array.isArray(data?.courses)) {
      throw new Error('Invalid course response.')
    }

    courses.value = data.courses
      .filter(course => course && (course.id || course._id))
      .map(course => ({
        ...course,
        id: String(course.id || course._id),
        title: course.title || 'Untitled course',
        mentor: course.mentor || 'Not specified',
        description: course.description || '',
        videoCount: Number(course.videoCount) || 0,
        cover: coverUrl(
          course.thumbnail || course.externalThumbnail,
        ),
        fallbackCover: coverUrl(course.externalThumbnail),
      }))
  } catch (failure) {
    if (!disposed) {
      error.value =
        failure?.message || 'Unable to load your courses.'
    }
  } finally {
    pending = false

    if (!disposed) {
      loading.value = false
      refreshing.value = false
    }
  }
}

function refreshVisible() {
  if (document.visibilityState === 'visible') {
    void loadCourses()
  }
}

watch(
  () => route.query.paymentReturn,
  (value, previous) => {
    if (value && value !== previous) {
      void loadCourses()
    }
  },
)

onActivated(() => {
  void loadCourses()
})

onMounted(() => {
  void loadCourses()

  window.addEventListener('focus', refreshVisible)
  document.addEventListener('visibilitychange', refreshVisible)
})

onUnmounted(() => {
  disposed = true

  window.removeEventListener('focus', refreshVisible)
  document.removeEventListener('visibilitychange', refreshVisible)
})
</script>

<template>
  <main
    class="w-full min-w-0 space-y-6 p-4
           text-slate-900 sm:p-6 lg:p-8 dark:text-slate-100"
  >
    <header
      class="flex flex-wrap items-center justify-between gap-4"
    >
      <div>
        <h2 class="text-2xl font-semibold">
          My Courses
        </h2>

        <p
          class="mt-2 text-sm text-slate-500 dark:text-slate-400"
        >
          Your unlocked courses. Continue learning here.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          :disabled="refreshing"
          class="cursor-pointer rounded-xl
                 border border-slate-200 bg-white
                 px-4 py-2.5 text-sm font-semibold
                 hover:border-emerald-500
                 disabled:cursor-wait disabled:opacity-50
                 dark:border-white/10 dark:bg-[#111c2d]"
          @click="loadCourses"
        >
          {{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>

        <RouterLink
          :to="localizedPath('/academy')"
          class="rounded-xl bg-emerald-600 px-4 py-2.5
                 text-sm font-semibold text-white
                 hover:bg-emerald-700"
        >
          Browse courses →
        </RouterLink>
      </div>
    </header>

    <p
      v-if="loading"
      role="status"
      class="text-sm text-slate-500 dark:text-slate-400"
    >
      Loading your courses…
    </p>

    <div
      v-if="error"
      role="alert"
      class="rounded-xl border border-red-500/20
             bg-red-500/10 p-4 text-sm
             text-red-600 dark:text-red-300"
    >
      <p>{{ error }}</p>

      <button
        type="button"
        :disabled="refreshing"
        class="mt-2 cursor-pointer font-semibold underline
               disabled:opacity-50"
        @click="loadCourses"
      >
        Try again
      </button>
    </div>

    <template v-if="!loading">
      <section
        v-if="!error && !courses.length"
        class="rounded-2xl border border-slate-200
               bg-white p-6
               dark:border-white/10 dark:bg-[#111c2d]"
      >
        <h3 class="font-semibold">
          No courses yet
        </h3>

        <p
          class="mt-2 text-sm leading-6
                 text-slate-500 dark:text-slate-400"
        >
          Your courses will appear here after your payment
          is approved and course access is granted.
        </p>

        <RouterLink
          :to="localizedPath('/academy')"
          class="mt-4 inline-block text-sm font-semibold
                 text-emerald-700 hover:underline
                 dark:text-emerald-300"
        >
          Explore courses →
        </RouterLink>
      </section>

      <section
        v-if="courses.length"
        aria-label="Your courses"
        class="grid grid-cols-1 gap-5
               md:grid-cols-2 xl:grid-cols-3"
      >
        <article
          v-for="course in courses"
          :key="course.id"
          class="flex min-w-0 flex-col overflow-hidden
                 rounded-2xl border border-slate-200
                 bg-white shadow-sm
                 dark:border-white/10 dark:bg-[#111c2d]"
        >
          <div
            class="flex aspect-video items-center
                   justify-center overflow-hidden
                   bg-slate-100 dark:bg-slate-950/50"
          >
            <img
              v-if="course.cover"
              :src="course.cover"
              :alt="`${course.title} course cover`"
              loading="lazy"
              class="h-full w-full object-cover"
              @error="coverFailed(course)"
            />

            <p
              v-else
              class="px-4 text-center text-sm
                     text-slate-500 dark:text-slate-400"
            >
              No course cover available
            </p>
          </div>

          <div class="flex flex-1 flex-col p-5">
            <span
              class="w-fit rounded-full bg-emerald-500/10
                     px-3 py-1 text-xs font-semibold
                     text-emerald-700 dark:text-emerald-300"
            >
              Access granted
            </span>

            <h3
              class="mt-4 break-words text-lg font-semibold"
            >
              {{ course.title }}
            </h3>

            <p
              class="mt-2 text-sm
                     text-slate-500 dark:text-slate-400"
            >
              Mentor: {{ course.mentor }}
            </p>

            <p
              v-if="course.description"
              class="mt-3 line-clamp-3 break-words
                     text-sm leading-6
                     text-slate-600 dark:text-slate-300"
            >
              {{ course.description }}
            </p>

            <p
              class="mt-3 text-xs
                     text-slate-500 dark:text-slate-400"
            >
              {{ course.videoCount }}
              {{ course.videoCount === 1 ? 'lesson' : 'lessons' }}
            </p>

            <div class="mt-auto pt-5">
              <RouterLink
                :to="
                  localizedPath(
                    `/academy/course/${course.id}/lessons`,
                  )
                "
                class="flex min-h-11 items-center
                       justify-center rounded-xl
                       bg-emerald-600 px-4 py-3
                       text-sm font-semibold text-white
                       hover:bg-emerald-700"
              >
                Open course →
              </RouterLink>
            </div>
          </div>
        </article>
      </section>
    </template>
  </main>
</template>