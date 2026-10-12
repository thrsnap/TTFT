<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { courseApi, coursePrice } from '../api/courseApi.js'

const route = useRoute()
const router = useRouter()

const course = ref(null)
const loading = ref(false)
const continuing = ref(false)
const error = ref('')

// Prevent older requests from updating a different course.
let requestVersion = 0

function localized(path) {
  return route.params.lang === 'km' ? `/km${path}` : path
}

function paymentLocation(courseId) {
  return {
    path: localized('/payment'),
    query: {
      product: `course:${courseId}`,
    },
  }
}

function login(courseId) {
  return router.replace({
    path: localized('/login'),
    query: {
      redirect: router.resolve(paymentLocation(courseId)).fullPath,
    },
  })
}

async function load() {
  const version = ++requestVersion
  const courseId = String(route.params.courseId || '')

  course.value = null
  error.value = ''
  loading.value = true

  try {
    if (!courseId) {
      throw new Error('Invalid course ID.')
    }

    const access = await courseApi('/my/access')

    if (version !== requestVersion) return

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

    if (version !== requestVersion) return

    if (!data.course) {
      throw new Error('Course not found.')
    }

    course.value = data.course
  } catch (err) {
    if (version !== requestVersion) return

    if (err.status === 401) {
      await login(courseId)
    } else {
      error.value = err.message || 'Unable to load this course.'
    }
  } finally {
    if (version === requestVersion) {
      loading.value = false
    }
  }
}

async function continueToPayment() {
  if (!course.value || loading.value || continuing.value) return

  continuing.value = true
  error.value = ''

  try {
    await router.push(
      paymentLocation(String(route.params.courseId)),
    )
  } catch (err) {
    error.value = err.message || 'Unable to open payment.'
  } finally {
    continuing.value = false
  }
}

watch(
  () => [route.params.courseId, route.params.lang],
  load,
  { immediate: true },
)
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
    <div class="mx-auto max-w-2xl">
      <h1
        class="mb-6 text-3xl font-bold
               max-[768px]:text-[28px]
               max-[600px]:text-2xl
               max-[480px]:mb-5
               max-[414px]:text-xl
               max-[320px]:mb-4"
      >
        Purchase course
      </h1>

      <p
        v-if="loading"
        role="status"
        class="text-sm text-(--muted-color)"
      >
        Checking course access…
      </p>

      <div
        v-if="error"
        role="alert"
        class="mb-4 rounded-xl bg-red-500/10 p-4
               text-sm text-red-500"
      >
        <p>{{ error }}</p>

        <button
          v-if="!course && !loading"
          type="button"
          @click="load"
          class="mt-3 min-h-11 cursor-pointer
                 font-semibold underline"
        >
          Try again
        </button>
      </div>

      <section
        v-if="course && !loading"
        class="rounded-2xl border border-(--border-color)
               bg-(--surface-bg) p-6
               max-[600px]:p-5
               max-[480px]:p-4
               max-[414px]:p-3.5
               max-[320px]:p-3"
      >
        <h2
          class="break-words text-xl font-bold
                 max-[414px]:text-lg
                 max-[320px]:text-base"
        >
          {{ course.title }}
        </h2>

        <p
          class="mt-2 text-sm text-(--muted-color)
                 max-[414px]:text-xs"
        >
          {{ course.mentor }} · {{ course.videoCount }} videos
        </p>

        <p
          v-if="course.description"
          class="mt-4 whitespace-pre-line break-words
                 text-sm leading-7 text-(--muted-color)"
        >
          {{ course.description }}
        </p>

        <p
          class="my-5 text-3xl font-bold
                 max-[480px]:text-2xl
                 max-[320px]:text-xl"
        >
          {{ coursePrice(course) }}
        </p>

        <div
          class="rounded-xl bg-indigo-500/10 p-4
                 max-[320px]:p-3"
        >
          <h3 class="font-semibold">
            Pay with Bakong KHQR
          </h3>

          <p
            class="mt-2 text-sm leading-6 text-(--muted-color)"
          >
            Continue to the payment page to generate your QR.
            Course access is granted after payment verification.
          </p>
        </div>

        <button
          type="button"
          :disabled="continuing"
          :aria-busy="continuing"
          @click="continueToPayment"
          class="mt-6 inline-flex min-h-12 w-full
                 cursor-pointer items-center justify-center
                 rounded-xl bg-indigo-600 px-4 py-3
                 text-sm font-semibold text-white
                 transition hover:bg-indigo-500
                 disabled:cursor-wait disabled:opacity-50
                 focus-visible:outline-2
                 focus-visible:outline-offset-4
                 focus-visible:outline-indigo-500"
        >
          {{ continuing ? 'Opening payment…' : 'Continue to payment' }}
        </button>

        <button
          type="button"
          :disabled="continuing"
          @click="load"
          class="mt-4 min-h-11 cursor-pointer
                 text-sm font-semibold text-indigo-500
                 underline disabled:opacity-50"
        >
          Check course access
        </button>
      </section>
    </div>
  </main>
</template>