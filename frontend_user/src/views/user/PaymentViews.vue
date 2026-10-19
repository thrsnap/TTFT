<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'

const route = useRoute()
const router = useRouter()
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .trim().replace(/\/+$/, '')

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

const productId = computed(() => {
  const courseId = route.params.courseId
  if (typeof courseId === 'string' && /^[a-f0-9]{24}$/i.test(courseId)) {
    return `course:${courseId}`
  }
  const signalId = route.query.signalId
  if (typeof signalId === 'string' && /^[a-f0-9]{24}$/i.test(signalId)) {
    return `signal:${signalId}`
  }
  const value = route.params.productId || route.query.productId || route.query.product
  if (value === 'daily-signal-monthly') return value
  return typeof value === 'string' && /^(signal|course):[a-f0-9]{24}$/i.test(value)
    ? value : ''
})

const isDaily = computed(() => productId.value === 'daily-signal-monthly')
const isSignalPurchase = computed(() => isDaily.value || productId.value.startsWith('signal:'))
const productLabel = computed(() => isDaily.value ? 'Daily Signals — monthly subscription' : productId.value.startsWith('signal:') ? 'News Signal — selected signal only' : 'Course payment')

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
  if (generating.value) return 'Generating QR…'
  if (checking.value) return 'Checking payment…'
  if (unlocked.value) return isSignalPurchase.value ? 'Continue to signals' : 'Continue to dashboard'
  if (order.value?.signalDeleted) return 'Contact admin'
  if (verificationBlocked.value) return 'Verification unavailable'
  if (!order.value) return creationUncertain.value ? 'Order status uncertain' : 'Generate QR'
  if (cooldown.value) return `Check again in ${cooldown.value}s`
  return paid.value ? 'Retry access unlock' : 'I have paid — check now'
})
const buttonDisabled = computed(() => {
  if (generating.value || checking.value) return true
  if (!order.value) return !productId.value || creationUncertain.value
  if (unlocked.value) return false
  return verificationBlocked.value || order.value.verificationAvailable === false ||
    order.value.signalDeleted === true || cooldown.value > 0
})

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
    message.value = order.value.signalDeleted
      ? 'Payment verified. This signal is unavailable; contact admin.'
      : unlocked.value ? (isDaily.value ? 'Payment verified. Your Daily Signal subscription is active.' : 'Payment verified. Your access is unlocked.')
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
    if (data.orderId !== orderId) throw new Error('Order mismatch. Contact admin.')
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
  if (unlocked.value) {
    const prefix = route.params.lang === 'km' ? '/km' : ''
    try {
      await router.replace({
        path: `${prefix}${isSignalPurchase.value ? '/signal' : '/dashboard'}`,
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
  order.value = null
  qrImage.value = ''
  generating.value = false
  checking.value = false
  creationUncertain.value = false
  verificationBlocked.value = false
  autoChecks.value = 0
  nextCheckAt.value = 0
  error.value = ''
  message.value = ''
}, { flush: 'sync' })

onMounted(() => { clockTimer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => {
  disposed = true
  version++
  stopPolling()
  activeRequest?.abort()
  clearInterval(clockTimer)
})
</script>

<template>
  <main class="flex min-h-[70vh] items-center justify-center px-4 py-8 text-(--text-color)">
    <section class="w-full max-w-sm rounded-2xl border border-(--border-color) bg-(--surface-bg) p-5 text-center sm:p-6">
      <h1 class="text-xl font-bold">Bakong QR Payment</h1>
      <p v-if="productId" class="mt-2 text-sm font-semibold">{{ productLabel }}</p>
      <p v-else role="alert" class="mt-3 text-sm text-red-600 dark:text-red-400">Please select a signal or course before generating a QR.</p>
      <template v-if="order">
        <p class="mt-4 text-3xl font-bold">{{ price }}<span v-if="isDaily" class="text-base"> / month</span></p>
        <p class="mt-2 break-words text-sm text-(--muted-color)">Receiver: {{ order.merchantName || 'Merchant' }}</p>
        <div v-if="paid" role="status" aria-live="polite" class="mt-6 rounded-xl bg-emerald-500/10 p-5 text-emerald-600 dark:text-emerald-400">
          <svg class="mx-auto h-20 w-20" viewBox="0 0 80 80" fill="none" aria-hidden="true">
            <circle cx="40" cy="40" r="35" stroke="currentColor" stroke-width="4" />
            <path d="m23 40 12 12 23-25" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <h2 class="mt-3 text-xl font-bold">Payment verified</h2>
          <p class="mt-2 text-sm">Your payment has been confirmed.</p>
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
      <button type="button" :disabled="buttonDisabled" @click="handlePayment" class="mt-5 min-h-11 w-full rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50">{{ buttonLabel }}</button>
      <a v-if="verificationBlocked || order?.signalDeleted || (paid && !unlocked)" href="https://t.me/makara_baya" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block py-2 text-sm font-semibold text-sky-600 underline dark:text-sky-400">Contact admin on Telegram</a>
      <p v-if="order?.orderId" class="mt-4 break-all text-xs text-(--muted-color)">Order: {{ order.orderId }}</p>
    </section>
  </main>
</template>
