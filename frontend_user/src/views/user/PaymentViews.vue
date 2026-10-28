<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { courseApi, coursePrice } from '../../api/courseApi.js'

const route = useRoute()
const router = useRouter()
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .trim().replace(/\/+$/, '')

const TELEGRAM_CHANNEL_URL = 'https://t.me/+rkSIBgQkT_xhZDdl'
const TELEGRAM_APP_URL = 'tg://join?invite=rkSIBgQkT_xhZDdl'

// Each check calls the backend. Use a limited polling schedule.
const CHECK_INTERVAL = 30000
const MAX_AUTO_CHECKS = 10
const order = ref(null)
const qrImage = ref('')
const generating = ref(false)
const checking = ref(false)
const creationUncertain = ref(false)
const error = ref('')
const message = ref('')
const now = ref(Date.now())
const autoChecks = ref(0)
const autoEnabled = ref(false)
const verificationBlocked = ref(false)
const nextCheckAt = ref(0)
let clockTimer
let pollTimer
let version = 0
let disposed = false
let activeRequest
let courseRequest
const course = ref(null)
const courseLoading = ref(false)
const courseLoadError = ref(false)
const courseAlreadyAccess = ref(false)

const productId = computed(() => {
  const courseId = route.params.courseId
  if (typeof courseId === 'string' && /^[a-f0-9]{24}$/i.test(courseId)) return `course:${courseId.toLowerCase()}`
  const value = route.params.productId || route.query.productId || route.query.product
  if (value === 'daily-signal-monthly') return value
  if (value === 'news-signal-monthly' || value === 'news-signal') return 'news-signal-monthly'
  // Existing bookmarks now open the all-News monthly plan.
  if (typeof value === 'string' && /^signal:[a-f0-9]{24}$/i.test(value)) return 'news-signal-monthly'
  if (typeof route.query.signalId === 'string' && /^[a-f0-9]{24}$/i.test(route.query.signalId)) return 'news-signal-monthly'
  return typeof value === 'string' && /^course:[a-f0-9]{24}$/i.test(value) ? value.toLowerCase() : ''
})

const isCourse = computed(() => /^course:[a-f0-9]{24}$/.test(productId.value))
const courseId = computed(() => isCourse.value ? productId.value.slice('course:'.length) : '')
const coursePath = computed(() => `${route.params.lang === 'km' ? '/km' : ''}/academy/course/${encodeURIComponent(courseId.value)}/lessons`)
const supportUrl = computed(() => isCourse.value ? 'https://t.me/ThunTulaFT' : 'https://t.me/makara_baya')
const isDaily = computed(() => productId.value === 'daily-signal-monthly')
const isNews = computed(() => productId.value === 'news-signal-monthly')
const isSignalPurchase = computed(() => isDaily.value || isNews.value)
const existingSubscription = ref(null)
const alreadyActive = computed(() => existingSubscription.value?.active === true)
const productLabel = computed(() => isDaily.value ? 'Daily Signals — monthly subscription' : isNews.value ? 'All News Signals — monthly subscription' : 'Course payment')

function formatExpiry(value) {
  const date = new Date(value)
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString() : '—'
}

const paid = computed(() => order.value?.status === 'paid')
const unlocked = computed(() => paid.value && order.value?.accessGranted === true)
const expired = computed(() => !paid.value && order.value && (
  order.value.status === 'expired' || now.value >= new Date(order.value.expiresAt).getTime()
))
const countdown = computed(() => {
  if (!order.value) return ''
  const end = new Date(order.value.expiresAt).getTime()
  if (!Number.isFinite(end)) return ''
  const seconds = Math.max(0, Math.ceil((end - now.value) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
const price = computed(() => {
  const amount = Number(order.value?.amount)
  return Number.isFinite(amount)
    ? `${order.value?.currency || 'USD'} ${amount.toFixed(2)}` : ''
})
const cooldown = computed(() => Math.max(0, Math.ceil((nextCheckAt.value - now.value) / 1000)))
const buttonLabel = computed(() => {
  if (courseLoading.value) return 'Loading course…'
  if (generating.value) return 'Generating QR…'
  if (checking.value) return 'Checking payment…'
  if (alreadyActive.value || courseAlreadyAccess.value || unlocked.value) return isSignalPurchase.value ? 'Continue to signals' : isCourse.value ? 'Start learning' : 'Continue to dashboard'
  if (order.value?.signalDeleted || order.value?.courseDeleted || order.value?.manualReviewRequired || order.value?.accessRevoked) return 'Contact admin'
  if (verificationBlocked.value) return 'Verification unavailable'
  if (!order.value) return creationUncertain.value ? 'Order status uncertain' : 'Generate QR'
  if (cooldown.value) return `Check again in ${cooldown.value}s`
  return paid.value ? 'Retry access unlock' : 'I have paid — check now'
})
const buttonDisabled = computed(() => {
  if (generating.value || checking.value || courseLoading.value) return true
  if (alreadyActive.value || courseAlreadyAccess.value || unlocked.value) return false
  if (isCourse.value && !course.value) return true
  if (!order.value) return !productId.value || creationUncertain.value
  if (unlocked.value) return false
  return verificationBlocked.value || order.value.verificationAvailable === false ||
    order.value.signalDeleted === true || order.value.courseDeleted === true ||
    order.value.manualReviewRequired === true || order.value.accessRevoked === true || cooldown.value > 0
})

async function loadCourseContext() {
  if (!isCourse.value || disposed || courseLoading.value) return
  const current = version
  const id = courseId.value
  const request = new AbortController()
  courseRequest = request
  courseLoading.value = true
  courseLoadError.value = false
  error.value = ''
  try {
    const access = await courseApi('/my/access', { signal: request.signal })
    if (disposed || current !== version) return
    if (access.isAdmin === true || (Array.isArray(access.courseIds) && access.courseIds.some(value => String(value).toLowerCase() === id))) {
      courseAlreadyAccess.value = true
      await router.replace(coursePath.value)
      return
    }
    const data = await courseApi(`/${encodeURIComponent(id)}`, { signal: request.signal })
    if (disposed || current !== version) return
    if (!data.course) throw new Error('Course not found.')
    course.value = data.course
  } catch (cause) {
    if (disposed || current !== version) return
    if (cause.status === 401) {
      await router.replace({
        path: `${route.params.lang === 'km' ? '/km' : ''}/login`,
        query: { redirect: route.fullPath },
      })
    } else {
      courseLoadError.value = true
      error.value = cause.message || 'Unable to load the course.'
    }
  } finally {
    if (!disposed && current === version) courseLoading.value = false
    if (courseRequest === request) courseRequest = undefined
  }
}

function stopPolling() {
  clearTimeout(pollTimer)
  autoEnabled.value = false
}

function scheduleCheck() {
  clearTimeout(pollTimer)
  if (!autoEnabled.value || disposed || paid.value || !order.value || verificationBlocked.value) return
  if (autoChecks.value >= MAX_AUTO_CHECKS) {
    stopPolling()
    message.value = 'Automatic checks finished. If you paid, use the check button or contact admin.'
    return
  }
  const expectedVersion = version
  pollTimer = setTimeout(async () => {
    if (disposed || expectedVersion !== version || !autoEnabled.value) return
    // No network requests while this tab is hidden.
    if (document.hidden) {
      scheduleCheck()
      return
    }
    if (Date.now() < nextCheckAt.value) {
      scheduleCheck()
      return
    }
    await checkPayment(true)
  }, CHECK_INTERVAL)
}

async function request(path, body = {}) {
  const controller = new AbortController()
  activeRequest = controller
  const timeout = setTimeout(() => controller.abort(), 25000)
  try {
    const response = await fetch(`${BASE}/api/payments${path}`, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CMM-Request': '1' },
      body: JSON.stringify(body), signal: controller.signal,
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      const failure = new Error(result?.message || `Payment request failed (${response.status}).`)
      failure.status = response.status
      failure.code = result?.code
      failure.subscription = result?.subscription
      failure.uncertain = response.status >= 500
      throw failure
    }
    if (result?.success !== true || !result.data?.orderId) {
      const failure = new Error('Invalid payment response. Contact admin before paying again.')
      failure.uncertain = true
      throw failure
    }
    return result.data
  } catch (cause) {
    if (cause.status || cause.uncertain) throw cause
    const failure = new Error('Connection interrupted. Check the existing order before paying again.')
    failure.uncertain = true
    throw failure
  } finally {
    clearTimeout(timeout)
    if (activeRequest === controller) activeRequest = undefined
  }
}

function updatePaymentMessage() {
  if (paid.value) {
    stopPolling()
    message.value = order.value.courseDeleted
      ? 'Payment verified. This course is unavailable. Contact admin; do not pay again.'
      : order.value.manualReviewRequired
        ? 'Payment verified. This older course order needs review. Contact admin with the order ID; do not pay again.'
        : order.value.accessRevoked
          ? 'Payment verified. Course access was revoked. Contact admin; do not pay again.'
          : order.value.signalDeleted
      ? 'Payment verified. This signal is unavailable; contact admin.'
      : unlocked.value ? (isDaily.value ? 'Payment verified. Your Daily Signal subscription is active.' : isNews.value ? 'Payment verified. All News Signals are unlocked for your monthly subscription.' : 'Payment verified. Your access is unlocked.')
        : 'Payment verified. Access is pending; use Retry access unlock or contact admin.'
  }
}

async function generateQR() {
  if (buttonDisabled.value || order.value) return
  const current = version
  generating.value = true
  error.value = ''
  message.value = ''
  try {
    const data = await request('/orders', { productId: productId.value })
    if (disposed || current !== version) return
    if (data.productId !== productId.value) {
      const failure = new Error('Payment product mismatch. Contact admin before paying.')
      failure.uncertain = true
      throw failure
    }
    order.value = data
    now.value = Date.now()
    if (paid.value) { updatePaymentMessage(); return }
    if (typeof data.qrCode !== 'string' || !data.qrCode.trim() ||
      !Number.isFinite(new Date(data.expiresAt).getTime())) {
      throw new Error('QR unavailable. Keep your order ID and contact admin.')
    }
    const image = await QRCode.toDataURL(data.qrCode, {
      width: 420, margin: 4, errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
    if (disposed || current !== version) return
    qrImage.value = image
    if (data.verificationAvailable === false) {
      message.value = 'Payment verification is unavailable. Contact admin before paying.'
      return
    }
    message.value = 'Waiting for payment. This page checks automatically every 30 seconds.'
    autoEnabled.value = true
    scheduleCheck()
  } catch (cause) {
    if (disposed || current !== version) return
    if (cause.status === 409 && isSignalPurchase.value && (cause.subscription?.active === true || /subscription is already active/i.test(cause.message))) {
      existingSubscription.value = cause.subscription || { active: true, expiresAt: null }
      message.value = 'Your subscription is already active. Continue to signals.'
      return
    }
    if (cause.status === 409 && isCourse.value && cause.code === 'COURSE_ACCESS_ALREADY_GRANTED') {
      courseAlreadyAccess.value = true
      message.value = 'You already have access. Start learning.'
      return
    }
    error.value = cause.message
    if (cause.uncertain) creationUncertain.value = true
  } finally {
    if (!disposed && current === version) generating.value = false
  }
}

async function checkPayment(automatic = false) {
  if (!order.value?.orderId || checking.value || generating.value || verificationBlocked.value ||
    order.value.verificationAvailable === false || order.value.signalDeleted || Date.now() < nextCheckAt.value) {
    if (automatic) scheduleCheck()
    return
  }
  clearTimeout(pollTimer)
  const current = version
  const orderId = order.value.orderId
  if (automatic) autoChecks.value++
  checking.value = true
  error.value = ''
  try {
    const data = await request(`/orders/${encodeURIComponent(orderId)}/check`)
    if (disposed || current !== version) return
    if (data.orderId !== orderId || data.productId !== productId.value) throw new Error('Order mismatch. Contact admin.')
    order.value = { ...order.value, ...data }
    now.value = Date.now()
    if (paid.value) updatePaymentMessage()
    else {
      message.value = expired.value
        ? 'QR expired. Do not scan it. Finishing checks for any payment already made.'
        : 'Waiting for payment confirmation…'
      if (expired.value) stopPolling()
    }
  } catch (cause) {
    if (disposed || current !== version) return
    error.value = cause.message
    stopPolling()
    message.value = 'Automatic checking paused.'
    // Stop on any error; never keep calling Bakong after a quota rejection.
    if (cause.status === 429 || cause.code === 'BAKONG_DAILY_LIMIT' ||
      /daily.*limit|daily.*exceeded/i.test(cause.message)) {
      verificationBlocked.value = true
      message.value = 'Verification limit reached. Contact admin or retry after the quota resets.'
    }
  } finally {
    if (!disposed && current === version) {
      checking.value = false
      nextCheckAt.value = Date.now() + CHECK_INTERVAL
      now.value = Date.now()
      scheduleCheck()
    }
  }
}

async function handlePayment() {
  if (buttonDisabled.value) return
  if (alreadyActive.value || courseAlreadyAccess.value || unlocked.value) {
    const prefix = route.params.lang === 'km' ? '/km' : ''
    try {
      await router.replace({
        path: isCourse.value ? coursePath.value : `${prefix}${isSignalPurchase.value ? '/signal' : '/dashboard'}`,
        query: { paymentReturn: String(Date.now()) },
      })
    } catch { error.value = 'Unable to return. Please try again.' }
  } else if (order.value) await checkPayment()
  else await generateQR()
}

watch(productId, () => {
  version++
  stopPolling()
  activeRequest?.abort()
  courseRequest?.abort()
  course.value = null
  courseLoading.value = false
  courseLoadError.value = false
  courseAlreadyAccess.value = false
  order.value = null
  existingSubscription.value = null
  qrImage.value = ''
  generating.value = false
  checking.value = false
  creationUncertain.value = false
  verificationBlocked.value = false
  autoChecks.value = 0
  nextCheckAt.value = 0
  error.value = ''
  message.value = ''
  if (isCourse.value) loadCourseContext()
}, { flush: 'sync', immediate: true })

onMounted(() => { clockTimer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => {
  disposed = true
  version++
  stopPolling()
  activeRequest?.abort()
  courseRequest?.abort()
  clearInterval(clockTimer)
})
</script>

<template>
  <main :class="isCourse ? 'course-checkout bg-(--page-bg)' : ''" class="flex min-h-[70vh] items-center justify-center px-4 py-8 text-(--text-color)">
    <section class="w-full max-w-sm rounded-2xl border border-(--border-color) bg-(--surface-bg) p-5 text-center sm:p-6">
      <h1 class="text-xl font-bold">Bakong QR Payment</h1>
      <p v-if="productId" class="mt-2 text-sm font-semibold">{{ productLabel }}</p>
      <p v-else role="alert" class="mt-3 text-sm text-red-600 dark:text-red-400">Please select a signal or course before generating a QR.</p>
      <p v-if="courseLoading" role="status" class="mt-4 text-sm text-(--muted-color)">Loading course…</p>
      <div v-if="isCourse && course" class="mt-4 rounded-xl border border-(--border-color) p-4 text-left">
        <h2 class="break-words font-bold">{{ course.title }}</h2>
        <p class="mt-2 text-xs leading-5 text-(--muted-color)">Mentor: {{ course.mentor }} · {{ course.videoCount }} videos</p>
        <p v-if="!order" class="mt-3 text-2xl font-bold">{{ coursePrice(course) }}</p>
        <p class="mt-2 text-xs leading-5 text-(--muted-color)">Pay once to unlock every day in this course.</p>
      </div>
      <button v-if="isCourse && courseLoadError && !courseLoading" type="button" @click="loadCourseContext" class="mt-3 min-h-11 font-semibold underline">Retry course</button>
      <div v-if="alreadyActive" role="status" class="mt-4 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
        Your {{ isNews ? 'News' : 'Daily' }} Signal subscription is active.
        <p v-if="existingSubscription.expiresAt" class="mt-2">Access until {{ formatExpiry(existingSubscription.expiresAt) }}.</p>
      </div>
      <template v-else-if="order">
        <p class="mt-4 text-3xl font-bold">{{ price }}<span v-if="isSignalPurchase" class="text-base"> / month</span></p>
        <p class="mt-2 break-words text-sm text-(--muted-color)">Receiver: {{ order.merchantName || 'Merchant' }}</p>
        <div v-if="paid" role="status" aria-live="polite" class="mt-6 rounded-xl bg-emerald-500/10 p-5 text-emerald-600 dark:text-emerald-400">
          <svg class="mx-auto h-20 w-20" viewBox="0 0 80 80" fill="none" aria-hidden="true">
            <circle cx="40" cy="40" r="35" stroke="currentColor" stroke-width="4" />
            <path d="m23 40 12 12 23-25" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <h2 class="mt-3 text-xl font-bold">Payment verified</h2>
          <p class="mt-2 text-sm">Your payment has been confirmed.</p>
          <p v-if="order.subscriptionExpiresAt" class="mt-2 text-sm">Access until {{ formatExpiry(order.subscriptionExpiresAt) }}.</p>
          <div v-if="isSignalPurchase" class="mt-5 border-t border-emerald-500/20 pt-4">
            <p class="text-sm font-medium leading-6 text-(--text-color)">
              Please join our Telegram channel to receive signal alerts.
            </p>
            <a
              :href="TELEGRAM_APP_URL"
              class="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2
                     rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white
                     transition-colors hover:bg-sky-500
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-sky-500"
            >
              <svg class="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m22 2-7 20-4-9-9-4 20-7Z" />
                <path d="M22 2 11 13" />
              </svg>
              Join Telegram Channel
            </a>
            <p class="mt-2 text-xs leading-5 text-(--muted-color)">
              Opens the Telegram app on your device.
            </p>

          </div>
        </div>
        <div v-else-if="qrImage && !expired" class="mx-auto mt-5 max-w-[280px] rounded-xl bg-white p-2">
          <img :src="qrImage" alt="Scan to pay with Bakong" width="420" height="420" class="block h-auto w-full" />
        </div>
        <p v-if="!paid && !expired && countdown" class="mt-3 text-sm text-(--muted-color)">QR expires in <span class="font-semibold">{{ countdown }}</span></p>
        <p v-if="expired" class="mt-4 text-sm font-semibold text-amber-600 dark:text-amber-400">QR expired. Do not scan it. If you already paid, check this order or contact admin.</p>
        <p v-if="autoEnabled && !paid" class="mt-4 flex items-center justify-center gap-2 text-sm text-(--muted-color)">
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent motion-reduce:animate-none" aria-hidden="true"></span>
          {{ checking ? 'Verifying payment…' : 'Waiting for payment…' }}
        </p>
      </template>
      <p v-else class="mt-3 text-sm text-(--muted-color)">Generate a QR to view the amount and receiver.</p>
      <p v-if="error" role="alert" class="mt-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <p v-if="message" role="status" aria-live="polite" class="mt-4 text-sm">{{ message }}</p>
      <button type="button" :disabled="buttonDisabled" @click="handlePayment"
              :class="isCourse ? 'border border-(--border-color) bg-(--input-bg) hover:bg-(--hover-bg)' : 'bg-sky-600 hover:bg-sky-500'"
              class="mt-5 min-h-11 w-full rounded-xl px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{{ buttonLabel }}</button>
      <a v-if="verificationBlocked || (isCourse && creationUncertain) || order?.signalDeleted || order?.courseDeleted || order?.manualReviewRequired || order?.accessRevoked || (paid && !unlocked)" :href="supportUrl" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block py-2 text-sm font-semibold text-(--muted-color) underline">Contact admin on Telegram</a>
      <RouterLink v-if="isCourse" :to="coursePath" class="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-(--muted-color) underline">Back to free preview</RouterLink>
      <p v-if="order?.orderId" class="mt-4 break-all text-xs text-(--muted-color)">Order: {{ order.orderId }}</p>
    </section>
  </main>
</template>

<style scoped>
.course-checkout {
  --page-bg: #0f172a;
  --surface-bg: #0f172a;
  --input-bg: #050b17;
  --hover-bg: #1e293b;
  --border-color: #283345;
  --text-color: #e2e8f0;
  --muted-color: #94a3b8;
  color-scheme: dark;
}
</style>
