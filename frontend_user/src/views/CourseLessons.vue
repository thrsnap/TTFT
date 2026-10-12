<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { courseApi, BASE } from '../api/courseApi.js'

const route = useRoute()
const router = useRouter()

const course = ref(null)
const lessons = ref([])
const selectedId = ref('')
const error = ref('')
const videoError = ref('')
const loading = ref(false)

let requestVersion = 0

const selected = computed(() =>
  lessons.value.find(
    (lesson) => String(lesson.id) === selectedId.value,
  ),
)

const videoUrl = computed(() => {
  if (!selected.value?.videoUrl) return ''

  try {
    const url = new URL(selected.value.videoUrl, `${BASE}/`)

    return ['http:', 'https:'].includes(url.protocol)
      ? url.href
      : ''
  } catch {
    return ''
  }
})

function localized(path) {
  return route.params.lang === 'km' ? `/km${path}` : path
}

function selectLesson(lesson) {
  selectedId.value = String(lesson.id)
  videoError.value = ''
}

async function load() {
  const version = ++requestVersion
  const courseId = String(route.params.courseId || '')

  loading.value = true
  error.value = ''
  videoError.value = ''
  course.value = null
  lessons.value = []
  selectedId.value = ''

  try {
    if (!courseId) {
      throw new Error('Invalid course ID.')
    }

    const data = await courseApi(
      `/${encodeURIComponent(courseId)}/lessons`,
    )

    if (version !== requestVersion) return

    if (!data.course || !Array.isArray(data.lessons)) {
      throw new Error('Invalid course lessons response.')
    }

    course.value = data.course
    lessons.value = data.lessons

    if (lessons.value.length > 0) {
      selectLesson(lessons.value[0])
    }
  } catch (err) {
    if (version !== requestVersion) return

    if (err.status === 401) {
      await router.replace({
        path: localized('/login'),
        query: {
          redirect: route.fullPath,
        },
      })
    } else if (err.status === 403) {
      await router.replace({
        path: localized('/payment'),
        query: {
          product: `course:${courseId}`,
        },
      })
    } else {
      error.value = err.message || 'Unable to load lessons.'
    }
  } finally {
    if (version === requestVersion) {
      loading.value = false
    }
  }
}

watch(
  () => [route.params.courseId, route.params.lang],
  load,
  { immediate: true },
)

onBeforeUnmount(() => {
  requestVersion++
})
</script>

<template>
  <main
    class="min-h-screen bg-(--page-bg) px-6 py-10
           text-(--text-color)
           max-[768px]:py-8
           max-[600px]:px-4
           max-[480px]:py-6
           max-[414px]:px-3
           max-[320px]:px-2"
  >
    <div class="mx-auto max-w-6xl">
      <!-- Loading -->
      <p
        v-if="loading"
        role="status"
        class="text-sm text-(--muted-color)"
      >
        Loading lessons…
      </p>

      <!-- Request error -->
      <div
        v-else-if="error"
        role="alert"
        class="rounded-xl bg-red-500/10 p-4
               text-sm text-red-500"
      >
        <p>{{ error }}</p>

        <button
          type="button"
          @click="load"
          class="mt-3 min-h-11 cursor-pointer
                 font-semibold underline"
        >
          Try again
        </button>
      </div>

      <!-- Course -->
      <template v-else-if="course">
        <h1
          class="mb-2 break-words text-3xl font-bold
                 max-[768px]:text-[28px]
                 max-[600px]:text-2xl
                 max-[414px]:text-xl
                 max-[320px]:text-lg"
        >
          {{ course.title }}
        </h1>

        <p
          class="mb-6 text-sm text-(--muted-color)
                 max-[480px]:mb-5
                 max-[414px]:text-xs"
        >
          Mentor: {{ course.mentor }}
        </p>

        <div
          class="grid grid-cols-[minmax(0,1fr)_280px] gap-6
                 max-[768px]:grid-cols-1 max-[768px]:gap-5
                 max-[600px]:gap-4
                 max-[414px]:gap-3"
        >
          <!-- Video player -->
          <section class="min-w-0">
            <template v-if="selected">
              <video
                v-if="videoUrl"
                :key="`${selectedId}:${videoUrl}`"
                :src="videoUrl"
                controls
                playsinline
                preload="metadata"
                crossorigin="use-credentials"
                class="aspect-video w-full rounded-xl bg-black
                       max-[320px]:rounded-lg"
                @error="
                  videoError =
                    'Unable to play this video. Please refresh or check your connection.'
                "
              >
                Your browser does not support video playback.
              </video>

              <div
                v-else
                class="flex aspect-video items-center justify-center
                       rounded-xl bg-(--surface-bg) p-4
                       text-center text-sm text-(--muted-color)"
              >
                Video unavailable for this lesson.
              </div>

              <p
                v-if="videoError"
                role="alert"
                class="mt-3 text-sm text-red-500"
              >
                {{ videoError }}
              </p>

              <h2
                class="mt-4 break-words text-xl font-semibold
                       max-[480px]:text-lg
                       max-[320px]:text-base"
              >
                {{ selected.title }}
              </h2>

              <p class="mt-2 text-sm text-(--muted-color)">
                Lesson
                {{
                  lessons.findIndex(
                    (lesson) => String(lesson.id) === selectedId,
                  ) + 1
                }}
                of {{ lessons.length }}
              </p>
            </template>

            <div
              v-else
              class="rounded-xl border border-(--border-color)
                     bg-(--surface-bg) p-6
                     text-center text-sm text-(--muted-color)"
            >
              No lessons available yet.
            </div>
          </section>

          <!-- Lesson list -->
          <nav
            aria-label="Course lessons"
            class="min-w-0 self-start rounded-xl
                   border border-(--border-color)
                   bg-(--surface-bg) p-4
                   max-[414px]:p-3"
          >
            <h2 class="mb-3 font-bold">
              Lessons · {{ lessons.length }}
            </h2>

            <div class="space-y-2">
              <button
                v-for="(lesson, index) in lessons"
                :key="lesson.id"
                type="button"
                :aria-current="
                  selectedId === String(lesson.id)
                    ? 'true'
                    : undefined
                "
                @click="selectLesson(lesson)"
                class="min-h-11 w-full cursor-pointer
                       rounded-lg px-3 py-3 text-left
                       text-sm leading-6 transition-colors
                       [overflow-wrap:anywhere]
                       focus-visible:outline-2
                       focus-visible:outline-offset-2
                       focus-visible:outline-indigo-500
                       max-[320px]:px-2 max-[320px]:text-xs"
                :class="
                  selectedId === String(lesson.id)
                    ? 'bg-indigo-600 text-white'
                    : 'text-(--text-color) hover:bg-(--hover-bg)'
                "
              >
                {{ index + 1 }}. {{ lesson.title }}
              </button>
            </div>

            <p
              v-if="lessons.length === 0"
              class="text-sm text-(--muted-color)"
            >
              Lessons will appear here once published.
            </p>
          </nav>
        </div>
      </template>
    </div>
  </main>
</template>