<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { courseApi, coursePrice, courseFileUrl } from '../api/courseApi.js'

const route = useRoute()
const router = useRouter()
const courses = ref([])
const access = ref([])
const signedIn = ref(false)
const admin = ref(false)
const loading = ref(false)
const error = ref('')
const failedCovers = ref({})

function localizedPath(path) {
  if (route.params.lang !== 'km') return path
  return path === '/' ? '/km' : `/km${path}`
}
function hasAccess(course) {
  return admin.value || access.value.includes(String(course.id))
}
function coverUrl(course) {
  if (failedCovers.value[course.id]) return ''
  return courseFileUrl(course.thumbnail)
}
function coverFailed(course) {
  failedCovers.value[course.id] = true
}
async function loadCourses() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  failedCovers.value = {}
  access.value = []
  admin.value = false
  signedIn.value = false
  try {
    const data = await courseApi()
    if (!Array.isArray(data?.courses)) throw new Error('The course API must return a courses array.')
    courses.value = data.courses.map(course => {
      const id = course.id ?? course._id
      if (!id) throw new Error('A course is missing its ID.')
      return { ...course, id: String(id) }
    })
    try {
      const grants = await courseApi('/my/access')
      if (!Array.isArray(grants?.courseIds)) throw new Error('The access API must return a courseIds array.')
      access.value = grants.courseIds.map(String)
      admin.value = grants.isAdmin === true
      signedIn.value = true
    } catch (err) {
      if (err.status !== 401) throw err
    }
  } catch (err) {
    error.value = err.message || 'Could not load courses.'
  } finally { loading.value = false }
}
function openCourse(course) {
  const destination = localizedPath(hasAccess(course)
    ? `/academy/course/${course.id}/lessons`
    : `/payment/course/${course.id}`)
  if (!signedIn.value) {
    return router.push({ path: localizedPath('/login'), query: { redirect: destination } })
  }
  return router.push(destination)
}
onMounted(loadCourses)
</script>

<template>
  <section aria-labelledby="paid-courses"
    class="mt-7 min-w-0 max-[768px]:mt-10 max-[768px]:pt-8 max-[600px]:mt-8 max-[600px]:pt-6 max-[480px]:mt-6 max-[480px]:pt-5 max-[414px]:mt-5 max-[414px]:pt-4 max-[320px]:mt-4 max-[320px]:pt-3">
    <header class="mb-4 flex flex-wrap items-center justify-between gap-4 max-[768px]:mb-7 max-[768px]:gap-3 max-[600px]:mb-6 max-[480px]:mb-5 max-[480px]:items-start max-[414px]:mb-4 max-[414px]:gap-2 max-[320px]:mb-3">
      <div class="min-w-0 flex-1">
        <h2 id="paid-courses" class="text-3xl font-bold text-[#389bc5] in-[.ligh-mode]:text-sky-700 max-[768px]:text-[28px] max-[600px]:text-2xl max-[480px]:text-[22px] max-[414px]:text-xl max-[320px]:text-lg">Master Class</h2>
        <p class="mt-2 text-sm leading-relaxed text-(--muted-color) max-[480px]:text-xs max-[320px]:mt-1">Learn through structured video lessons.</p>
      </div>
      <button type="button" :disabled="loading" @click="loadCourses"
        class="min-h-11 shrink-0 cursor-pointer rounded-lg border border-(--border-color) bg-(--surface-bg) px-4 py-2 text-sm font-semibold text-(--text-color) transition-colors hover:bg-(--hover-bg) disabled:opacity-50 max-[600px]:px-3 max-[480px]:text-xs max-[320px]:px-2">
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
    </header>
    <p v-if="error" role="alert" class="mb-5 break-words text-sm text-red-500 max-[480px]:mb-4 max-[480px]:text-xs">{{ error }}</p>
    <p v-if="loading" role="status" class="mb-5 text-sm text-(--muted-color) max-[480px]:mb-4 max-[480px]:text-xs">Loading courses…</p>
    <div class="grid min-w-0 grid-cols-3 items-stretch gap-6 max-[768px]:grid-cols-2 max-[768px]:gap-4 max-[600px]:gap-3 max-[480px]:grid-cols-1 max-[480px]:gap-4 max-[414px]:gap-3 max-[320px]:gap-2">
      <article v-for="course in courses" :key="course.id"
        class="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-(--border-color) bg-(--surface-bg) shadow-[0_5px_15px_rgba(0,0,0,0.12)] transition duration-300 hover:shadow-[0_8px_25px_rgba(0,0,0,0.25)] motion-safe:hover:-translate-y-1 max-[480px]:rounded-xl max-[320px]:rounded-lg">
        <div class="relative aspect-[285/188] w-full shrink-0 overflow-hidden bg-(--input-bg)">
          <img v-if="coverUrl(course)" :src="coverUrl(course)"
            :alt="`${course.title} course cover`" loading="lazy" @error="coverFailed(course)"
            class="absolute inset-0 block h-full w-full object-cover" />
          <div v-else class="absolute inset-0 flex items-center justify-center bg-indigo-500/10 px-3 text-center text-base font-semibold text-indigo-400 max-[600px]:text-sm max-[320px]:text-xs">Course Cover</div>
        </div>
        <div class="flex min-w-0 flex-1 flex-col p-6 [overflow-wrap:anywhere] max-[768px]:p-5 max-[600px]:p-4 max-[480px]:p-4 max-[414px]:p-3.5 max-[320px]:p-3">
          <h3 class="text-xl font-bold leading-snug text-indigo-400 in-[.ligh-mode]:text-indigo-700 max-[768px]:text-lg max-[600px]:text-base max-[480px]:text-lg max-[414px]:text-base max-[320px]:text-sm">{{ course.title }}</h3>
          <p v-if="course.description" class="mt-3 line-clamp-3 text-sm leading-6 text-(--muted-color) max-[600px]:text-xs max-[600px]:leading-5 max-[480px]:text-sm max-[480px]:leading-6 max-[414px]:text-xs max-[414px]:leading-5 max-[320px]:mt-2">{{ course.description }}</p>
          <div class="mt-4 space-y-2 text-sm max-[600px]:text-xs max-[480px]:text-sm max-[414px]:text-xs max-[320px]:mt-3 max-[320px]:space-y-1.5">
            <p class="text-(--muted-color)">Mentor: <span class="font-semibold text-(--text-color)">{{ course.mentor }}</span></p>
            <p class="text-(--muted-color)">{{ course.videoCount ?? 0 }} video lessons</p>
          </div>
          <p class="mb-5 mt-5 text-2xl font-bold text-(--text-color) max-[768px]:text-xl max-[600px]:mb-4 max-[600px]:mt-4 max-[480px]:text-2xl max-[414px]:text-xl max-[320px]:mb-3 max-[320px]:mt-3 max-[320px]:text-lg">{{ coursePrice(course) }}</p>
          <button type="button" @click="openCourse(course)"
            class="mt-auto inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-semibold leading-snug text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500 max-[600px]:px-3 max-[600px]:text-xs max-[480px]:text-sm max-[414px]:text-xs max-[320px]:gap-1 max-[320px]:px-2">
            {{ hasAccess(course) ? 'Study now' : 'Purchase now' }} <span aria-hidden="true">→</span>
          </button>
        </div>
      </article>
    </div>
    <p v-if="!loading && !error && !courses.length" class="py-8 text-center text-sm text-(--muted-color) max-[480px]:py-6 max-[480px]:text-xs max-[320px]:py-4">No paid courses published yet.</p>
  </section>
</template>