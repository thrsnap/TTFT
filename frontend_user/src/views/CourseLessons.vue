<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { courseApi, courseFileUrl, coursePrice } from '../api/courseApi.js'

const route = useRoute()

const course = ref(null)
const lessons = ref([])
const hasAccess = ref(false)
const selectedId = ref('')
const error = ref('')
const videoError = ref('')
const loading = ref(false)
const lessonList = ref(null)

let requestVersion = 0
let controller

function descriptionLines(value) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n')
  // Also display legacy one-line Details / Time / Date text as separate rows.
  // Keep any emoji prefix with its label and preserve existing line breaks.
  return text.replace(
    /[^\S\r\n]+((?:[^\p{L}\p{N}\s]+[^\S\r\n]*)?(?:Details|Time|Date)[^\S\r\n]*[:៖])/giu,
    (match, label, offset) => {
      const prefix = text.slice(text.lastIndexOf('\n', offset - 1) + 1, offset).trim()
      // Do not separate a line's leading emoji from its own label.
      return !prefix || /^[^\p{L}\p{N}\s]+$/u.test(prefix) ? match : `\n${label}`
    },
  ).split('\n')
}

const selectedIndex = computed(() =>
  lessons.value.findIndex(lesson => String(lesson.id) === selectedId.value),
)
const selected = computed(() => lessons.value[selectedIndex.value])
const nextLesson = computed(() =>
  selectedIndex.value >= 0 ? lessons.value[selectedIndex.value + 1] : undefined,
)
const previewLesson = computed(() =>
  lessons.value.find(lesson => lesson.isPreview === true && !isLocked(lesson)),
)
const selectedLocked = computed(() => isLocked(selected.value))
const videoUrl = computed(() =>
  selectedLocked.value ? '' : courseFileUrl(selected.value?.videoUrl),
)
const paymentPath = computed(() => localized(
  `/payment/course/${encodeURIComponent(String(route.params.courseId || ''))}`,
))

function localized(path) {
  return route.params.lang === 'km' ? `/km${path}` : path
}

function lessonTitle(lesson) {
  const title = String(lesson?.title || 'Video lesson')
  return title.replace(/^day\s*\d+\s*(?:[-–—:.]\s*|$)/i, '').trim() || title
}

function isLocked(lesson) {
  // Only explicit permission from the API enables playback.
  return lesson?.locked !== false
}

async function selectLesson(lesson, { reveal = false } = {}) {
  if (!lesson) return
  selectedId.value = String(lesson.id)
  videoError.value = ''

  if (!reveal) return
  const version = requestVersion
  await nextTick()
  if (version !== requestVersion || selectedId.value !== String(lesson.id)) return
  const button = lessonList.value?.querySelector('[aria-expanded="true"]')
  button?.focus({ preventScroll: true })
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  button?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

function toggleLesson(lesson) {
  if (selectedId.value === String(lesson.id)) {
    selectedId.value = ''
    videoError.value = ''
    return
  }
  selectLesson(lesson, { reveal: true })
}

function selectNextLesson() {
  selectLesson(nextLesson.value, { reveal: true })
}

async function load() {
  const version = ++requestVersion
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  const courseId = String(route.params.courseId || '')

  loading.value = true
  error.value = ''
  videoError.value = ''
  course.value = null
  lessons.value = []
  hasAccess.value = false
  selectedId.value = ''

  try {
    if (!courseId) throw new Error('Invalid course ID.')

    const path = `/${encodeURIComponent(courseId)}`
    // The public response contains only the preview URL. The protected
    // response supplies all lesson URLs after the backend verifies access.
    const [previewResult, accessResult] = await Promise.allSettled([
      courseApi(`${path}/preview`, { signal }),
      courseApi(`${path}/lessons`, { signal }),
    ])

    if (version !== requestVersion) return

    let data
    if (accessResult.status === 'fulfilled') {
      data = accessResult.value
      if (data?.hasAccess !== true) {
        throw new Error('Invalid course access response.')
      }
    } else {
      // Missing sessions and missing enrollment both allow the free preview.
      // Unexpected server failures remain visible and can be retried.
      if (![401, 403].includes(accessResult.reason?.status)) {
        throw accessResult.reason
      }
      if (previewResult.status === 'rejected') throw previewResult.reason
      data = previewResult.value
      if (data?.hasAccess !== false) {
        throw new Error('Invalid course preview response.')
      }
    }

    if (!data.course || !Array.isArray(data.lessons)) {
      throw new Error('Invalid course lessons response.')
    }
    if (data.lessons.some(lesson => !lesson?.id || typeof lesson.locked !== 'boolean')) {
      throw new Error('Invalid lesson access information.')
    }

    course.value = data.course
    hasAccess.value = data.hasAccess === true
    lessons.value = data.lessons
    selectLesson(lessons.value[0])
  } catch (err) {
    if (version !== requestVersion) return
    error.value = err?.message || 'Unable to load lessons.'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(
  () => [route.params.courseId, route.params.lang],
  load,
  { immediate: true },
)

onBeforeUnmount(() => {
  requestVersion++
  controller?.abort()
})
</script>

<template>
  <main class="course-lesson-page">
    <div class="lesson-container">
      <RouterLink :to="localized('/academy')" class="academy-back">← Back to academy</RouterLink>

      <p v-if="loading" role="status" class="page-message">Loading course…</p>
      <div v-else-if="error" role="alert" class="course-error">
        <p>{{ error }}</p>
        <button type="button" @click="load" class="text-button">Try again</button>
      </div>

      <template v-else-if="course">
        <header class="course-header">
          <h1>{{ course.title }}</h1>
          <div class="course-meta">
            <p>Mentor: <strong>{{ course.mentor }}</strong></p>
            <p>{{ lessons.length }} day{{ lessons.length === 1 ? '' : 's' }} · {{ lessons.length }} video{{ lessons.length === 1 ? '' : 's' }}</p>
          </div>
          <p class="course-price">Full course <strong>{{ coursePrice(course) }}</strong></p>
        </header>

        <section v-if="course.description" aria-labelledby="course-details-heading" class="course-details">
          <h2 id="course-details-heading">Course details</h2>
          <div class="description-lines">
            <p v-for="(line, lineIndex) in descriptionLines(course.description)" :key="lineIndex">{{ line || '\u00A0' }}</p>
          </div>
        </section>

        <section id="course-content" aria-labelledby="course-content-heading" class="content-panel">
          <div class="content-heading">
            <h2 id="course-content-heading">Course content</h2>
            <p v-if="hasAccess">All days unlocked. Tap a day to watch.</p>
            <p v-else-if="previewLesson">Watch Day 1 free. Purchase the course to unlock the other days.</p>
            <p v-else>Tap a day to see its video.</p>
          </div>

          <nav ref="lessonList" aria-label="Course lessons">
            <ol v-if="lessons.length" class="lesson-list">
              <li v-for="(lesson, index) in lessons" :key="lesson.id" class="lesson-item">
                <h3 class="lesson-heading">
                  <button
                    :id="`day-${index + 1}-button`"
                    type="button"
                    :aria-label="`Day ${index + 1}: ${lessonTitle(lesson)} — ${isLocked(lesson) ? 'Purchase required' : lesson.isPreview ? 'Free preview' : 'Watch video'}`"
                    :aria-controls="`day-${index + 1}-panel`"
                    :aria-expanded="selectedId === String(lesson.id)"
                    :aria-current="selectedId === String(lesson.id) ? 'true' : undefined"
                    class="lesson-toggle"
                    @click="toggleLesson(lesson)"
                  >
                    <span class="lesson-icon" aria-hidden="true">
                      <svg v-if="isLocked(lesson)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="10" width="14" height="11" rx="2" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      </svg>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <path d="m10 8 6 4-6 4V8Z" />
                      </svg>
                    </span>
                    <span class="lesson-copy">
                      <span class="day-meta">
                        <span class="day-label">Day {{ index + 1 }}</span>
                        <span v-if="isLocked(lesson)" class="lesson-status">Locked</span>
                        <span v-else-if="lesson.isPreview && !hasAccess" class="lesson-status preview-status">Free preview</span>
                        <span v-else class="lesson-status">Watch</span>
                      </span>
                      <span class="lesson-title">{{ lessonTitle(lesson) }}</span>
                    </span>
                    <svg class="lesson-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </h3>

                <div
                  v-show="selectedId === String(lesson.id)"
                  :id="`day-${index + 1}-panel`"
                  role="region"
                  :aria-labelledby="`day-${index + 1}-button`"
                  class="lesson-panel"
                >
                  <template v-if="selectedId === String(lesson.id)">
                    <div v-if="selectedLocked" class="locked-panel">
                      <h4 id="locked-lesson-heading">Unlock Day {{ index + 1 }}</h4>
                      <p>Purchase this course to watch this video and the other paid lessons.</p>
                      <RouterLink :to="paymentPath" class="payment-button">Go to payment · {{ coursePrice(course) }}</RouterLink>
                      <button v-if="previewLesson" type="button" class="text-button" @click="selectLesson(previewLesson, { reveal: true })">Back to free preview</button>
                    </div>
                    <template v-else>
                      <video
                        v-if="videoUrl"
                        :key="`${selectedId}:${videoUrl}`"
                        :src="videoUrl"
                        :aria-label="`Day ${index + 1}: ${lessonTitle(lesson)}`"
                        controls playsinline preload="metadata" crossorigin="use-credentials"
                        class="lesson-video"
                        @ended="selectNextLesson"
                        @error="videoError = 'Unable to play this video. Please refresh or check your connection.'"
                      >Your browser does not support video playback.</video>
                      <div v-else class="video-unavailable">Video unavailable for this day.</div>
                      <p v-if="videoError" role="alert" class="video-error">{{ videoError }}</p>
                      <div class="lesson-footer">
                        <p>Day {{ index + 1 }} of {{ lessons.length }}</p>
                        <button v-if="nextLesson" type="button" class="next-button" @click="selectNextLesson">Next day →</button>
                      </div>
                    </template>
                  </template>
                </div>
              </li>
            </ol>
            <p v-else class="page-message">No lessons available yet.</p>
          </nav>
        </section>

      </template>
    </div>
  </main>
</template>

<style scoped>
.course-lesson-page {
  --page-bg: #0f172a;
  --surface-bg: #0f172a;
  --input-bg: #050b17;
  --hover-bg: #1e293b;
  --border-color: #283345;
  --text-color: #e2e8f0;
  --muted-color: #94a3b8;
  min-height: 100vh;
  padding: 20px clamp(12px, 4vw, 24px) 40px;
  background: var(--page-bg);
  color: var(--text-color);
  color-scheme: dark;
}
.lesson-container { width: 100%; max-width: 960px; min-width: 0; margin: 0 auto; }
.course-lesson-page, .course-lesson-page * { box-sizing: border-box; }
.course-lesson-page :is(button, a) { -webkit-tap-highlight-color: transparent; }
.course-lesson-page :is(button, a):focus-visible { outline: 2px solid #94a3b8; outline-offset: 3px; }
.academy-back { display: inline-flex; align-items: center; min-height: 44px; color: #cbd5e1; font-size: 14px; text-decoration: none; }
.academy-back:hover { text-decoration: underline; }
.course-header { margin: 12px 0 24px; overflow-wrap: anywhere; }
.course-header h1 { margin: 0; font-size: clamp(24px, 4vw, 34px); line-height: 1.25; font-weight: 700; }
.course-meta { display: flex; flex-wrap: wrap; gap: 6px 24px; margin-top: 12px; color: var(--muted-color); font-size: 14px; line-height: 1.65; }
.course-meta p, .course-price { margin: 0; }
.course-meta strong { color: var(--text-color); font-weight: 600; }
.course-price { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-top: 12px; color: var(--muted-color); font-size: 14px; }
.course-price strong { color: var(--text-color); font-size: 20px; font-weight: 700; }
.content-panel { min-width: 0; border: 1px solid var(--border-color); border-radius: 14px; background: var(--surface-bg); }
.content-heading { padding: 20px; }
.course-lesson-page h2 { margin: 0; font-size: 20px; line-height: 1.4; font-weight: 700; }
.content-heading p { margin: 6px 0 0; color: var(--muted-color); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.lesson-list { margin: 0; padding: 0; list-style: none; }
.lesson-item { min-width: 0; border-top: 1px solid var(--border-color); }
.lesson-item:last-child { border-radius: 0 0 14px 14px; }
.lesson-heading { margin: 0; font-size: inherit; }
.lesson-toggle { display: grid; grid-template-columns: 36px minmax(0, 1fr) 20px; align-items: center; gap: 12px; width: 100%; min-height: 84px; padding: 16px 20px; border: 0; border-radius: inherit; background: transparent; color: inherit; text-align: left; cursor: pointer; scroll-margin-top: 90px; }
.lesson-toggle:hover { background: var(--hover-bg); }
.lesson-toggle[aria-expanded="true"] { background: rgb(255 255 255 / 4%); }
.course-lesson-page .lesson-toggle:focus-visible { outline-offset: -3px; }
.lesson-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--border-color); border-radius: 9px; color: #cbd5e1; }
.lesson-icon svg { width: 20px; height: 20px; }
.lesson-copy { min-width: 0; }
.day-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
.day-label { font-size: 13px; line-height: 1.5; font-weight: 700; }
.lesson-status { color: var(--muted-color); font-size: 12px; line-height: 1.5; font-weight: 400; }
.preview-status { color: #cbd5e1; }
.lesson-title { display: block; margin-top: 4px; overflow-wrap: anywhere; font-size: 15px; line-height: 1.5; font-weight: 500; }
.lesson-chevron { width: 20px; height: 20px; color: var(--muted-color); }
.lesson-toggle[aria-expanded="true"] .lesson-chevron { transform: rotate(180deg); }
.lesson-panel { min-width: 0; padding: 0 20px 16px; }
.lesson-video, .video-unavailable { display: block; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; border-radius: 9px; background: var(--input-bg); }
.lesson-video { height: auto; object-fit: contain; }
.video-unavailable { display: flex; align-items: center; justify-content: center; padding: 16px; color: var(--muted-color); text-align: center; font-size: 14px; }
.lesson-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; margin-top: 10px; }
.lesson-footer p { margin: 0; color: var(--muted-color); font-size: 13px; }
.next-button, .payment-button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 16px; border: 1px solid #475569; border-radius: 8px; background: var(--input-bg); color: var(--text-color); font-size: 14px; line-height: 1.5; font-weight: 600; text-decoration: none; text-align: center; cursor: pointer; overflow-wrap: anywhere; }
.next-button:hover, .payment-button:hover { background: var(--hover-bg); }
.locked-panel { padding: 24px 16px 12px; border: 1px solid var(--border-color); border-radius: 9px; background: var(--input-bg); text-align: center; }
.locked-panel h4 { margin: 0; font-size: 18px; line-height: 1.5; font-weight: 700; }
.locked-panel p { max-width: 420px; margin: 8px auto 18px; color: var(--muted-color); font-size: 14px; line-height: 1.65; }
.locked-panel .payment-button { width: 100%; max-width: 360px; }
.text-button { display: block; min-height: 44px; margin: 8px auto 0; padding: 10px 4px; border: 0; background: transparent; color: #cbd5e1; font-size: 14px; line-height: 1.5; text-decoration: underline; cursor: pointer; }
.course-details { min-width: 0; margin-bottom: 24px; padding: 20px; border: 1px solid var(--border-color); border-radius: 14px; background: var(--surface-bg); }
.description-lines { margin-top: 12px; color: var(--muted-color); font-size: 14px; line-height: 1.85; }
.description-lines p { min-height: 1.5em; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.page-message { margin: 0; padding: 24px 20px; color: var(--muted-color); font-size: 14px; line-height: 1.6; }
.course-error, .video-error { padding: 14px; border-radius: 9px; background: rgb(239 68 68 / 10%); color: #fca5a5; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.course-error p { margin: 0; }
.course-error .text-button { margin-left: 0; }
.video-error { margin: 12px 0 0; }
@media (max-width: 600px) {
  .course-lesson-page { padding-top: 12px; }
  .course-header { margin-bottom: 20px; }
  .course-meta { display: block; }
  .course-meta p + p { margin-top: 4px; }
  .content-heading, .course-details { padding: 16px; }
  .lesson-toggle { gap: 10px; padding: 14px 12px; }
  .lesson-panel { padding: 0 10px 12px; }
  .locked-panel { padding: 20px 12px 8px; }
  .lesson-footer { padding: 0 2px; }
}
@media (max-width: 359px) {
  .lesson-toggle { grid-template-columns: 30px minmax(0, 1fr) 16px; gap: 8px; }
  .lesson-icon { width: 30px; height: 30px; }
  .lesson-chevron { width: 16px; height: 16px; }
  .lesson-title { font-size: 14px; }
  .next-button { padding-right: 12px; padding-left: 12px; }
}
</style>
