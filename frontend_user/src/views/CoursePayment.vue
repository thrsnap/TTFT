<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { courseApi, coursePrice } from '../api/courseApi.js'

const route = useRoute()
const router = useRouter()

const telegramUrl = 'https://t.me/ThunTulaFT'

const course = ref(null)
const loading = ref(false)
const error = ref('')

let requestVersion = 0
let disposed = false

function localized(path) {
  return route.params.lang === 'km' ? `/km${path}` : path
}

const dashboardPath = computed(() => localized('/dashboard'))

function isCurrent(version) {
  return !disposed && version === requestVersion
}

async function load() {
  const version = ++requestVersion
  const courseId = String(route.params.courseId || '')
  const returnPath = route.fullPath

  course.value = null
  error.value = ''
  loading.value = true

  try {
    if (!courseId) {
      throw new Error('Invalid course ID.')
    }

    const access = await courseApi('/my/access')

    if (!isCurrent(version)) return

    const hasAccess =
      access.isAdmin === true ||
      (
        Array.isArray(access.courseIds) &&
        access.courseIds.some((id) => String(id) === courseId)
      )

    if (hasAccess) {
      await router.replace(
        localized(
          `/academy/course/${encodeURIComponent(courseId)}/lessons`,
        ),
      )
      return
    }

    const data = await courseApi(
      `/${encodeURIComponent(courseId)}`,
    )

    if (!isCurrent(version)) return

    if (!data.course) {
      throw new Error('Course not found.')
    }

    course.value = data.course
  } catch (err) {
    if (!isCurrent(version)) return

    if (err.status === 401) {
      await router.replace({
        path: localized('/login'),
        query: {
          redirect: returnPath,
        },
      })
    } else {
      error.value = err.message || 'Unable to load this course.'
    }
  } finally {
    if (isCurrent(version)) {
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
  disposed = true
  requestVersion++
})
</script>

<template>
  <main
    class="flex min-h-[70vh] items-center justify-center
           bg-(--page-bg) px-6 py-10 text-(--text-color)
           max-[768px]:px-5 max-[768px]:py-8
           max-[600px]:px-4 max-[600px]:py-7
           max-[480px]:px-3 max-[480px]:py-6
           max-[320px]:px-2 max-[320px]:py-4"
  >
    <section
      aria-labelledby="payment-heading"
      class="w-full min-w-0 max-w-md rounded-2xl
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
        v-if="loading"
        role="status"
        class="mt-4 text-sm text-(--muted-color)"
      >
        Checking course access…
      </p>

      <div
        v-if="error"
        role="alert"
        class="mt-4 rounded-lg bg-red-500/10 p-3
               text-sm leading-6 text-red-500
               [overflow-wrap:anywhere]"
      >
        <p>{{ error }}</p>

        <button
          v-if="!loading"
          type="button"
          @click="load"
          class="mt-2 min-h-11 cursor-pointer
                 font-semibold underline"
        >
          Try again
        </button>
      </div>

      <div
        v-if="course && !loading"
        class="mt-5 rounded-xl
               border border-(--border-color) p-4
               max-[320px]:p-3"
      >
        <h2
          class="text-base font-bold leading-6
                 [overflow-wrap:anywhere]"
        >
          {{ course.title }}
        </h2>

        <p
          class="mt-2 text-xs leading-5
                 text-(--muted-color)"
        >
          {{ course.mentor }} · {{ course.videoCount }} videos
        </p>

        <p
          class="mt-3 text-2xl font-bold
                 max-[320px]:text-xl"
        >
          {{ coursePrice(course) }}
        </p>
      </div>

      <p
        class="mt-4 text-sm leading-6
               text-(--muted-color)"
      >
        Please contact the admin on
        <strong class="font-semibold text-(--text-color)">
          Telegram
        </strong>
        to purchase this course.
      </p>

      <p
        class="mt-2 text-sm leading-6
               text-(--muted-color)"
      >
        Send the course name and your registered email.
        The admin will arrange payment and grant your course access.
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

      <button
        v-if="course && !loading"
        type="button"
        @click="load"
        class="mt-3 inline-flex min-h-11 w-full
               cursor-pointer items-center justify-center
               rounded-lg bg-indigo-600 px-4 py-3
               text-sm font-semibold text-white
               transition hover:bg-indigo-500
               focus-visible:outline-2
               focus-visible:outline-offset-2
               focus-visible:outline-indigo-500"
      >
        Check course access
      </button>

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

      <p
        v-if="course && !loading"
        class="mt-3 text-xs leading-5
               text-(--muted-color)"
      >
        After the admin grants access, click “Check course access”
        to open your lessons.
      </p>
    </section>
  </main>
</template>