<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  BASE,
  courseApi,
  jsonRequest,
  coursePrice,
  courseFileUrl,
} from '../../api/courseApi.js'
const courses = ref([])
const payments = ref([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const paymentError = ref('')
const message = ref('')
const editingId = ref('')
const courseId = ref('')
const lessonTitle = ref('')
const video = ref(null)
const coverFile = ref(null)
const videoInput = ref(null)
const coverInput = ref(null)
const detailsForm = ref(null)
const titleInput = ref(null)
const verified = ref({})
function emptyDraft() {
  return {
    title: '',
    mentor: '',
    description: '',
    price: '',
    thumbnail: '',
  }
}
const draft = ref(emptyDraft())
function getId(item) {
  const id = item?.id ?? item?._id
  return id == null ? '' : String(id)
}
function normalizeCourse(course) {
  const id = getId(course)
  if (!id) {
    throw new Error('A course is missing its ID.')
  }
  return {
    ...course,
    id,
    status: String(course.status || 'draft').toLowerCase(),
    lessons: Array.isArray(course.lessons) ? course.lessons : [],
  }
}
function videoCount(course) {
  const count = Number(course.videoCount)
  return course.videoCount != null &&
    Number.isInteger(count) &&
    count >= 0
    ? count
    : course.lessons.length
}
function paymentAmount(payment) {
  const value = payment.amount
  if (value == null || String(value).trim() === '') {
    return 'Amount unavailable'
  }
  const amount = Number(value)
  return Number.isFinite(amount)
    ? amount.toFixed(2)
    : 'Amount unavailable'
}
function requestError(err) {
  if (err?.status === 401) {
    return 'Your session expired. Sign in again.'
  }
  if (err?.status === 403) {
    return 'Admin access is required.'
  }
  return err?.message || 'The request failed. Please try again.'
}
function clearFeedback() {
  error.value = ''
  message.value = ''
}
function thumbnailUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const isUploadPath = text.startsWith('/uploads/')
  const isCourseCover = /^\/api\/courses\/(?:admin\/)?[a-fA-F0-9]{24}\/cover(?:\?|$)/.test(text)
  if (!isUploadPath && !isCourseCover && !/^https?:\/\//i.test(text)) {
    throw new Error(
      'Use an HTTP/HTTPS cover URL or an uploaded course cover path.',
    )
  }
  let url
  try {
    const backend = new URL(`${BASE}/`, window.location.origin)
    url = new URL(text, backend)
  } catch {
    throw new Error('Enter a valid cover URL.')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('The cover URL must use HTTP or HTTPS.')
  }
  if (url.username || url.password) {
    throw new Error('The cover URL cannot contain login credentials.')
  }
  if (isUploadPath && !url.pathname.startsWith('/uploads/')) {
    throw new Error('Invalid uploaded cover path.')
  }
  return url.href
}
async function refreshCourses() {
  const data = await courseApi('/admin')
  if (!Array.isArray(data?.courses)) {
    throw new Error('The course API must return a courses array.')
  }
  courses.value = data.courses.map(normalizeCourse)
  if (!courses.value.some((course) => course.id === courseId.value)) {
    courseId.value = courses.value[0]?.id || ''
  }
}
async function refreshPayments() {
  const data = await courseApi('/admin/payments')
  if (!Array.isArray(data?.payments)) {
    throw new Error('The payment API must return a payments array.')
  }
  const normalized = data.payments.map((payment) => {
    const id = getId(payment)
    if (!id) {
      throw new Error('A payment is missing its ID.')
    }
    return { ...payment, id }
  })
  payments.value = normalized
  const pendingIds = new Set(normalized.map((payment) => payment.id))
  for (const id of Object.keys(verified.value)) {
    if (!pendingIds.has(id)) {
      delete verified.value[id]
    }
  }
}
async function load() {
  if (loading.value || busy.value) return
  loading.value = true
  clearFeedback()
  paymentError.value = ''
  try {
    const [catalog, pending] = await Promise.allSettled([
      refreshCourses(),
      refreshPayments(),
    ])
    if (catalog.status === 'rejected') {
      error.value = requestError(catalog.reason)
    }
    if (pending.status === 'rejected') {
      paymentError.value = requestError(pending.reason)
    }
  } finally {
    loading.value = false
  }
}
function cancelEdit() {
  editingId.value = ''
  draft.value = emptyDraft()
}
async function editCourse(course) {
  if (busy.value || loading.value) return
  clearFeedback()
  editingId.value = course.id
  courseId.value = course.id
  draft.value = {
    title: course.title || '',
    mentor: course.mentor || '',
    description: course.description || '',
    price: course.price ?? '',
    thumbnail: course.externalThumbnail ?? course.thumbnail ?? '',
  }
  await nextTick()
  detailsForm.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
  titleInput.value?.focus({ preventScroll: true })
}
function coursePayload() {
  const title = String(draft.value.title || '').trim()
  const mentor = String(draft.value.mentor || '').trim()
  const rawPrice = String(draft.value.price ?? '').trim()
  const price = Number(rawPrice)
  if (!title) throw new Error('Enter a course title.')
  if (!mentor) throw new Error('Enter the mentor name.')
  if (
    !rawPrice ||
    !Number.isFinite(price) ||
    price < 0.01 ||
    price > 100000
  ) {
    throw new Error('Enter a price between $0.01 and $100,000.')
  }
  if (Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) {
    throw new Error('The price can have at most two decimal places.')
  }
  return {
    title,
    mentor,
    description: String(draft.value.description || '').trim(),
    price: Math.round(price * 100) / 100,
    thumbnail: thumbnailUrl(draft.value.thumbnail),
  }
}
async function reloadCoursesAfterAction() {
  try {
    await refreshCourses()
  } catch (err) {
    error.value =
      `The action succeeded, but refreshing failed: ${requestError(err)}`
  }
}
async function saveCourse() {
  if (busy.value || loading.value) return
  clearFeedback()
  busy.value = true
  try {
    const payload = coursePayload()
    const id = editingId.value
    const data = await courseApi(
      id ? `/admin/${encodeURIComponent(id)}` : '/admin',
      jsonRequest(
        id ? 'PATCH' : 'POST',
        id ? payload : { ...payload, status: 'draft' },
      ),
    )
    const savedId = getId(data?.course)
    if (savedId) {
      courseId.value = savedId
    }
    cancelEdit()
    message.value = id
      ? 'Course details and price updated.'
      : 'Course created. Upload lessons, then publish it.'
    await reloadCoursesAfterAction()
  } catch (err) {
    error.value = requestError(err)
  } finally {
    busy.value = false
  }
}
async function deleteCourse(course) {
  if (busy.value || loading.value) return
  if (!window.confirm(`Delete "${course.title}"?`)) return
  clearFeedback()
  busy.value = true
  try {
    await courseApi(
      `/admin/${encodeURIComponent(course.id)}`,
      { method: 'DELETE' },
    )
    courses.value = courses.value.filter(
      (item) => item.id !== course.id,
    )
    if (editingId.value === course.id) {
      cancelEdit()
    }
    if (courseId.value === course.id) {
      courseId.value = courses.value[0]?.id || ''
    }
    message.value = 'Course deleted.'
    await reloadCoursesAfterAction()
  } catch (err) {
    error.value = requestError(err)
  } finally {
    busy.value = false
  }
}
async function publish(course) {
  if (busy.value || loading.value) return
  clearFeedback()
  const status =
    course.status === 'published' ? 'draft' : 'published'
  if (status === 'published' && !videoCount(course)) {
    error.value = 'Upload at least one lesson before publishing.'
    return
  }
  busy.value = true
  try {
    await courseApi(
      `/admin/${encodeURIComponent(course.id)}`,
      jsonRequest('PATCH', { status }),
    )
    course.status = status
    message.value = 'Course visibility updated.'
    await reloadCoursesAfterAction()
  } catch (err) {
    error.value = requestError(err)
  } finally {
    busy.value = false
  }
}
function chooseVideo(event) {
  clearFeedback()
  const file = event.target.files?.[0]
  if (
    file &&
    (
      file.size === 0 ||
      file.size > 500 * 1024 * 1024 ||
      !/\.(mp4|webm)$/i.test(file.name)
    )
  ) {
    video.value = null
    event.target.value = ''
    error.value = 'Use a nonempty MP4 or WebM file, maximum 500 MB.'
    return
  }
  video.value = file || null
}
async function uploadLesson() {
  if (busy.value || loading.value) return
  clearFeedback()
  busy.value = true
  try {
    if (!courseId.value) {
      throw new Error('Select a course.')
    }
    if (!lessonTitle.value.trim()) {
      throw new Error('Enter a lesson title.')
    }
    if (!video.value) {
      throw new Error('Choose a lesson video.')
    }
    const body = new FormData()
    body.append('title', lessonTitle.value.trim())
    body.append('video', video.value)
    await courseApi(
      `/admin/${encodeURIComponent(courseId.value)}/lessons`,
      { method: 'POST', body },
    )
    lessonTitle.value = ''
    video.value = null
    if (videoInput.value) {
      videoInput.value.value = ''
    }
    message.value = 'Lesson uploaded to R2.'
    await reloadCoursesAfterAction()
  } catch (err) {
    error.value = requestError(err)
  } finally {
    busy.value = false
  }
}
function chooseCover(event) {
  clearFeedback()
  const file = event.target.files?.[0]
  if (
    file &&
    (
      !['image/jpeg', 'image/png'].includes(file.type) ||
      file.size === 0 ||
      file.size > 2 * 1024 * 1024
    )
  ) {
    coverFile.value = null
    event.target.value = ''
    error.value = 'Use a nonempty JPG or PNG file, maximum 2 MB.'
    return
  }
  coverFile.value = file || null
}
async function uploadCover() {
  if (busy.value || loading.value) return
  clearFeedback()
  busy.value = true
  try {
    if (!courseId.value || !coverFile.value) {
      throw new Error('Select a course and choose a cover image.')
    }
    const targetId = courseId.value
    const body = new FormData()
    body.append('cover', coverFile.value)
    const data = await courseApi(
      `/admin/${encodeURIComponent(targetId)}/cover`,
      { method: 'POST', body },
    )
    coverFile.value = null
    if (coverInput.value) {
      coverInput.value.value = ''
    }
    if (
      editingId.value === targetId &&
      typeof data?.course?.thumbnail === 'string'
    ) {
      draft.value.thumbnail = data.course.externalThumbnail ?? ''
    }
    message.value = data?.message || 'Cover uploaded.'
    try {
      await refreshCourses()
      if (editingId.value === targetId) {
        const updated = courses.value.find(
          (course) => course.id === targetId,
        )
        if (updated) {
          draft.value.thumbnail = updated.externalThumbnail ?? ''
        } else {
          cancelEdit()
        }
      }
    } catch (err) {
      if (editingId.value === targetId) {
        cancelEdit()
      }
      error.value =
        `Cover uploaded, but refreshing failed: ${requestError(err)}`
    }
  } catch (err) {
    error.value = requestError(err)
  } finally {
    busy.value = false
  }
}
async function approve(payment) {
  if (
    busy.value ||
    loading.value ||
    !payment.id ||
    !verified.value[payment.id]
  ) {
    return
  }
  clearFeedback()
  busy.value = true
  try {
    await courseApi(
      `/admin/payments/${encodeURIComponent(payment.id)}/approve`,
      jsonRequest('POST', { paymentVerified: true }),
    )
    payments.value = payments.value.filter(
      (item) => item.id !== payment.id,
    )
    delete verified.value[payment.id]
    message.value = 'Course access granted.'
    paymentError.value = ''
    try {
      await refreshPayments()
    } catch (err) {
      paymentError.value =
        `Payment approved, but refreshing failed: ${requestError(err)}`
    }
  } catch (err) {
    error.value = requestError(err)
  } finally {
    busy.value = false
  }
}
onMounted(load)
</script>
<template>
  <main
    class="min-h-screen bg-(--page-bg) px-6 py-8 text-(--text-color)
           max-[768px]:px-5 max-[600px]:px-4
           max-[480px]:py-6 max-[414px]:px-3 max-[320px]:px-2
           [&_input:not([type=checkbox])]:min-h-11
           [&_input:not([type=checkbox])]:w-full
           [&_input:not([type=checkbox])]:rounded-lg
           [&_input:not([type=checkbox])]:border
           [&_input:not([type=checkbox])]:border-(--border-color)
           [&_input:not([type=checkbox])]:bg-(--input-bg)
           [&_input:not([type=checkbox])]:px-3
           [&_input:not([type=checkbox])]:py-2
           [&_label]:mb-2 [&_label]:block
           [&_label]:text-sm [&_label]:font-medium
           [&_button]:min-h-11 [&_button]:cursor-pointer
           [&_button]:rounded-lg [&_button]:px-4
           [&_button]:py-2 [&_button]:font-semibold
           [&_button:disabled]:cursor-not-allowed
           [&_button:disabled]:opacity-50"
  >
    <div class="mx-auto max-w-6xl">
      <header
        class="mb-6 flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <RouterLink to="/admin" class="text-sm text-indigo-500">
            ← Admin Panel
          </RouterLink>
          <h1
            class="mt-2 text-3xl font-bold
                   max-[600px]:text-2xl max-[320px]:text-xl"
          >
            Paid Course Management
          </h1>
        </div>
        <button
          type="button"
          :disabled="loading || busy"
          class="border border-(--border-color) bg-(--surface-bg)"
          @click="load"
        >
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
      </header>
      <p
        v-if="error"
        role="alert"
        class="mb-4 break-words rounded-lg bg-red-500/10 p-4 text-red-500"
      >
        {{ error }}
      </p>
      <p
        v-if="message"
        role="status"
        class="mb-4 rounded-lg bg-emerald-500/10 p-4 text-emerald-600"
      >
        {{ message }}
      </p>
      <p
        v-if="loading"
        role="status"
        class="mb-4 text-sm text-(--muted-color)"
      >
        Loading courses and payments…
      </p>
      <div
        class="grid grid-cols-2 gap-6
               max-[768px]:grid-cols-1 max-[600px]:gap-4"
      >
        <!-- Create or edit a course -->
        <form
          ref="detailsForm"
          class="min-w-0 scroll-mt-8 rounded-2xl
                 border border-(--border-color)
                 bg-(--surface-bg) p-6 max-[480px]:p-4"
          @submit.prevent="saveCourse"
        >
          <h2 class="mb-5 text-xl font-bold">
            {{ editingId ? 'Edit course and price' : 'Add course' }}
          </h2>
          <fieldset :disabled="busy || loading" class="min-w-0">
            <label for="course-title">Course title</label>
            <input
              id="course-title"
              ref="titleInput"
              v-model="draft.title"
              required
              maxlength="200"
              class="mb-4"
            />
            <label for="course-mentor">Mentor name</label>
            <input
              id="course-mentor"
              v-model="draft.mentor"
              required
              maxlength="120"
              class="mb-4"
            />
            <label for="course-price">Price in USD</label>
            <input
              id="course-price"
              v-model="draft.price"
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              required
              class="mb-4"
            />
            <label for="course-thumbnail">
              Thumbnail URL or backend path (optional)
            </label>
            <input
              id="course-thumbnail"
              v-model="draft.thumbnail"
              type="text"
              placeholder="https\://… or /uploads/…"
              class="mb-4"
            />
            <label for="course-description">Description</label>
            <textarea
              id="course-description"
              v-model="draft.description"
              rows="4"
              maxlength="10000"
              class="mb-4 w-full rounded-lg
                     border border-(--border-color)
                     bg-(--input-bg) p-3"
            ></textarea>
            <div class="flex flex-wrap gap-2">
              <button
                type="submit"
                class="bg-indigo-600 text-white"
              >
                {{
                  busy
                    ? 'Please wait…'
                    : editingId
                      ? 'Save changes'
                      : 'Create draft course'
                }}
              </button>
              <button
                v-if="editingId"
                type="button"
                class="border border-(--border-color)"
                @click="cancelEdit"
              >
                Cancel edit
              </button>
            </div>
          </fieldset>
        </form>
        <!-- Upload lesson -->
        <form
          class="min-w-0 rounded-2xl border border-(--border-color)
                 bg-(--surface-bg) p-6 max-[480px]:p-4"
          @submit.prevent="uploadLesson"
        >
          <h2 class="mb-5 text-xl font-bold">
            Upload lesson video
          </h2>
          <fieldset :disabled="busy || loading" class="min-w-0">
            <label for="lesson-course">Course</label>
            <select
              id="lesson-course"
              v-model="courseId"
              required
              class="mb-4 min-h-11 w-full rounded-lg
                     border border-(--border-color)
                     bg-(--input-bg) p-3"
            >
              <option value="" disabled>Select a course</option>
              <option
                v-for="course in courses"
                :key="course.id"
                :value="course.id"
              >
                {{ course.title }}
              </option>
            </select>
            <label for="lesson-title">Lesson title</label>
            <input
              id="lesson-title"
              v-model="lessonTitle"
              required
              maxlength="200"
              class="mb-4"
            />
            <label for="course-video">Video file</label>
            <input
              id="course-video"
              ref="videoInput"
              type="file"
              accept="video/mp4,video/webm,.mp4,.webm"
              required
              @change="chooseVideo"
            />
            <p class="my-3 text-sm text-(--muted-color)">
              MP4 or WebM, maximum 500 MB.
              Upload one lesson at a time.
            </p>
            <button
              type="submit"
              :disabled="!courseId || !video"
              class="bg-indigo-600 text-white"
            >
              {{ busy ? 'Please wait…' : 'Upload lesson' }}
            </button>
          </fieldset>
        </form>
        <!-- Upload cover -->
        <form
          class="min-w-0 rounded-2xl border border-(--border-color)
                 bg-(--surface-bg) p-6 max-[480px]:p-4"
          @submit.prevent="uploadCover"
        >
          <h2 class="mb-5 text-xl font-bold">
            Upload course cover
          </h2>
          <fieldset :disabled="busy || loading" class="min-w-0">
            <label for="cover-course">Course</label>
            <select
              id="cover-course"
              v-model="courseId"
              required
              class="mb-4 min-h-11 w-full rounded-lg
                     border border-(--border-color)
                     bg-(--input-bg) p-3"
            >
              <option value="" disabled>Select a course</option>
              <option
                v-for="course in courses"
                :key="course.id"
                :value="course.id"
              >
                {{ course.title }}
              </option>
            </select>
            <label for="course-cover">Cover image</label>
            <input
              id="course-cover"
              ref="coverInput"
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              required
              @change="chooseCover"
            />
            <p class="my-3 text-sm text-(--muted-color)">
              JPG or PNG, maximum 2 MB.
            </p>
            <button
              type="submit"
              :disabled="!courseId || !coverFile"
              class="bg-indigo-600 text-white"
            >
              {{ busy ? 'Please wait…' : 'Upload cover' }}
            </button>
          </fieldset>
        </form>
      </div>
      <!-- Manage courses -->
      <section class="mt-8">
        <h2 class="mb-4 text-xl font-bold">
          Manage courses
        </h2>
        <p
          v-if="!loading && !courses.length && !error"
          class="text-(--muted-color)"
        >
          No courses yet. Create your first course above.
        </p>
        <article
          v-for="course in courses"
          :key="course.id"
          class="mb-4 rounded-xl border border-(--border-color)
                 bg-(--surface-bg) p-5 max-[480px]:p-4"
        >
          <img
            v-if="courseFileUrl(course.thumbnail)"
            :src="courseFileUrl(course.thumbnail)"
            :alt="`${course.title} course cover`"
            crossorigin="use-credentials"
            loading="lazy"
            class="mb-4 max-h-48 w-full rounded-lg object-contain"
          />
          <div
            class="flex flex-wrap items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <h3 class="break-words font-bold">
                {{ course.title }}
              </h3>
              <p class="mt-1 break-words text-sm text-(--muted-color)">
                {{ course.mentor }} · {{ coursePrice(course) }} ·
                {{ videoCount(course) }} videos · {{ course.status }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                :disabled="busy || loading"
                class="bg-indigo-600 text-white"
                @click="editCourse(course)"
              >
                Edit / Price
              </button>
              <button
                type="button"
                :disabled="
                  busy ||
                  loading ||
                  (course.status !== 'published' && !videoCount(course))
                "
                class="bg-emerald-700 text-white"
                @click="publish(course)"
              >
                {{
                  course.status === 'published'
                    ? 'Make draft'
                    : 'Publish'
                }}
              </button>
              <button
                type="button"
                :disabled="busy || loading"
                class="bg-red-600 text-white"
                @click="deleteCourse(course)"
              >
                Delete
              </button>
            </div>
          </div>
          <ol
            v-if="course.lessons.length"
            class="mt-3 list-inside list-decimal
                   text-sm text-(--muted-color)"
          >
            <li
              v-for="(lesson, index) in course.lessons"
              :key="lesson.id || lesson._id || index"
              class="break-words"
            >
              {{ lesson.title }}
            </li>
          </ol>
        </article>
      </section>
      <!-- Approve payments -->
      <section class="mt-8">
        <h2 class="mb-4 text-xl font-bold">
          Verify payments and grant access
        </h2>
        <p class="mb-4 text-sm text-(--muted-color)">
          Check the amount and reference against your payment records
          before approving.
        </p>
        <p
          v-if="paymentError"
          role="alert"
          class="mb-4 break-words text-sm text-red-500"
        >
          {{ paymentError }}
        </p>
        <p
          v-if="!loading && !paymentError && !payments.length"
          class="text-(--muted-color)"
        >
          No pending payment requests.
        </p>
        <article
          v-for="payment in payments"
          :key="payment.id"
          class="mb-4 rounded-xl border border-(--border-color)
                 bg-(--surface-bg) p-5 max-[480px]:p-4"
        >
          <h3 class="break-words font-bold">
            {{ payment.courseTitle }}
          </h3>
          <p class="mt-2 break-words text-sm">
            {{ payment.user?.username || 'Unknown user' }} ·
            {{ payment.user?.email || 'Email unavailable' }}
          </p>
          <p class="mt-2 break-words">
            {{ payment.currency }} {{ paymentAmount(payment) }}
            · Reference: {{ payment.reference || 'Not provided' }}
          </p>
          <label class="mt-4 flex! items-center gap-2">
            <input
              v-model="verified[payment.id]"
              type="checkbox"
              :disabled="busy || loading"
              class="h-4 w-4 shrink-0"
            />
            I verified this payment was received.
          </label>
          <button
            type="button"
            :disabled="busy || loading || !verified[payment.id]"
            class="mt-2 bg-emerald-700 text-white"
            @click="approve(payment)"
          >
            Approve and unlock course
          </button>
        </article>
      </section>
    </div>
  </main>
</template>