<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import QRCode from 'qrcode'
const route = useRoute()
const telegramUrl = 'https://t.me/ThunTulaFT'
const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .trim().replace(/\/+$/, '')
const productId = computed(() => {
  const courseId = route.params.courseId
  if (typeof courseId === 'string' && courseId) return `course:${courseId}`
  const selectedId = route.query.signalId
  if (typeof selectedId === 'string' && /^[a-fA-F0-9]{24}$/.test(selectedId)) {
    return `signal:${selectedId.toLowerCase()}`
  }
  const explicit = route.params.productId || route.query.productId || route.query.product
  return typeof explicit === 'string' && /^(signal|course):[a-fA-F0-9]{24}$/.test(explicit)
    ? explicit
    : ''
})
const isSignalPurchase = computed(() => productId.value.startsWith('signal:'))
const validProduct = computed(() => /^(signal|course):[a-fA-F0-9]{24}$/.test(productId.value))
const dashboardPath = computed(() => route.params.lang === 'km' ? '/km/dashboard' : '/dashboard')
const signalsPath = computed(() => route.params.lang === 'km' ? '/km/signal' : '/signal')
const productLabel = computed(() => isSignalPurchase.value ? 'One payment for this news signal' : 'Course purchase')
const order = ref(null)
const qrImage = ref('')
const creating = ref(false)
const creationUncertain = ref(false)
const checking = ref(false)
const error = ref('')
const notice = ref('')
const now = ref(Date.now())
let ticker
let disposed = false
let version = 0
const paid = computed(() => order.value?.status === 'paid')
const expired = computed(() => Boolean(order.value) && !paid.value && (
  order.value.status === 'expired' || now.value >= new Date(order.value.expiresAt).getTime()
))
const countdown = computed(() => {
  if (!order.value) return ''
  const seconds = Math.max(0, Math.ceil((new Date(order.value.expiresAt).getTime() - now.value) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
const accessReady = computed(() => paid.value && order.value?.accessGranted === true)
const canCheck = computed(() => Boolean(order.value?.orderId) && order.value.verificationAvailable !== false && (
  !paid.value || (!accessReady.value && !order.value.signalDeleted)
))
function formatAmount(value, currency) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'KHR' ? 0 : 2,
  })
}

async function request(path, body = {}) {
  let response
  try {
    response = await fetch(`${baseURL}/api/payments${path}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CMM-Request': '1' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
    })
  } catch (cause) {
    const failure = new Error(['TimeoutError', 'AbortError'].includes(cause.name)
      ? 'The request timed out. Contact admin to check this order before making another payment.'
      : 'Cannot reach the backend. Please check your connection.')
    failure.uncertain = true
    throw failure
  }
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const failure = new Error(result?.message || `Payment request failed (${response.status})`)
    failure.status = response.status
    failure.uncertain = response.status >= 500
    throw failure
  }
  if (result?.success !== true || !result.data || typeof result.data !== 'object') {
    const failure = new Error('The backend returned an invalid payment response. Check with admin before creating another order.')
    failure.uncertain = true
    throw failure
  }
  return result.data
}
async function renderQR() {
  if (!order.value?.qrCode) return
  const current = version
  try {
    const image = await QRCode.toDataURL(order.value.qrCode, {
      width: 420, margin: 4, errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
    if (!disposed && current === version) qrImage.value = image
  } catch {
    if (!disposed && current === version) error.value = 'Could not display the saved QR. Contact admin with the order ID.'
  }
}
async function generatePayment() {
  if (creating.value || creationUncertain.value || order.value) return
  if (!validProduct.value) {
    error.value = 'Select a specific signal or course before creating a payment.'
    return
  }
  const current = version
  creating.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await request('/orders', { productId: productId.value })
    if (disposed || current !== version) return
    // Retain a created order even if QR rendering fails; do not create a replacement automatically.
    order.value = data
    now.value = Date.now()
    if (data.status === 'paid') {
      notice.value = data.accessGranted
        ? 'Payment confirmed. Your purchase is unlocked.'
        : 'Payment confirmed. Contact admin with your order ID.'
      return
    }
    if (!data.orderId || typeof data.qrCode !== 'string' || !data.qrCode.trim() || !Number.isFinite(new Date(data.expiresAt).getTime())) {
      throw new Error('The order was created but its QR details are incomplete. Contact admin before paying.')
    }
    await renderQR()
    if (data.verificationAvailable === false) {
      notice.value = 'Online confirmation is unavailable. Contact admin to confirm your payment.'
    }
  } catch (cause) {
    if (!disposed && current === version) {
      error.value = cause.message
      if (cause.uncertain) creationUncertain.value = true
    }
  } finally {
    if (!disposed && current === version) creating.value = false
  }
}
async function verifyPayment() {
  if (!canCheck.value || checking.value || creating.value) return
  const current = version
  const orderId = order.value.orderId
  checking.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await request(`/orders/${encodeURIComponent(orderId)}/check`)
    if (disposed || current !== version) return
    if (data.orderId !== orderId) throw new Error('The backend returned a different order. Contact admin.')
    order.value = { ...order.value, ...data }
    now.value = Date.now()
    notice.value = data.status === 'paid'
      ? data.signalDeleted
        ? 'Payment confirmed, but this signal was deleted. Contact admin with your order ID.'
        : data.accessGranted
          ? 'Payment confirmed. Your purchase is unlocked.'
          : 'Payment confirmed. Contact admin if your access is not available yet.'
      : data.status === 'expired'
        ? 'This order has expired and no payment was found. If you already paid, contact admin.'
        : 'Payment has not been found yet. If you already paid, wait a moment and check again.'
  } catch (cause) {
    if (!disposed && current === version) {
      error.value = cause.message
      notice.value = 'Payment status is unconfirmed. If you already paid, do not pay again; contact admin with this order ID.'
    }
  } finally {
    if (!disposed && current === version) checking.value = false
  }
}
watch(productId, () => {
  version++
  order.value = null
  qrImage.value = ''
  error.value = ''
  notice.value = ''
  creating.value = false
  creationUncertain.value = false
  checking.value = false
})
onMounted(() => { ticker = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { disposed = true; version++; clearInterval(ticker) })
</script>
<template>
  <main class="flex min-h-[70vh] items-center justify-center px-4 py-8 text-(--text-color) sm:px-6 sm:py-10">
    <section aria-labelledby="payment-heading" class="w-full max-w-md rounded-2xl border border-(--border-color) bg-(--surface-bg) p-4 text-center sm:p-6">
      <h1 id="payment-heading" class="text-xl font-bold sm:text-2xl">Bakong QR Payment</h1>
      <p class="mt-2 text-sm text-(--muted-color)">{{ validProduct ? productLabel : 'Select a signal or course first' }}</p>
      <p v-if="isSignalPurchase" class="mt-2 text-sm leading-6 text-(--muted-color)">This payment unlocks only the selected signal until it is deleted. Each new signal requires a separate purchase.</p>
      <div v-if="error" role="alert" class="mt-4 break-words rounded-lg bg-red-500/10 p-3 text-sm leading-6 text-red-600 dark:text-red-400">{{ error }}</div>
      <p v-if="notice" role="status" aria-live="polite" class="mt-4 rounded-lg bg-sky-500/10 p-3 text-sm leading-6">{{ notice }}</p>
      <template v-if="!order">
        <p class="mt-5 text-sm leading-6 text-(--muted-color)">Generate your payment QR, review the amount and recipient, then scan it using Bakong or a supported banking app.</p>
        <p class="mt-2 text-sm leading-6 text-(--muted-color)">If you have already paid, contact admin before creating another order.</p>
        <button type="button" :disabled="creating || creationUncertain || !validProduct" @click="generatePayment" class="mt-5 min-h-11 w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500">
          {{ creating ? 'Generating QR…' : creationUncertain ? 'Contact admin to check the order' : 'Generate payment QR' }}
        </button>
      </template>
      <template v-else>
        <p class="mt-5 text-3xl font-bold">{{ order.currency }} {{ formatAmount(order.amount, order.currency) }}</p>
        <p class="mt-2 break-words text-sm text-(--muted-color)">Recipient: {{ order.merchantName || 'Merchant' }}</p>
        <div v-if="paid" role="status" class="mt-5 rounded-xl bg-green-500/10 p-5 font-semibold text-green-600 dark:text-green-400">Payment confirmed</div>
        <div v-else-if="expired" role="status" class="mt-5 rounded-xl bg-amber-500/10 p-4 text-sm leading-6">QR expired. Do not scan it. You can still check this order if you already paid.</div>
        <template v-else-if="qrImage">
          <div class="mx-auto mt-5 w-full max-w-[300px] rounded-xl bg-white p-2">
            <img :src="qrImage" alt="Scan this Bakong QR to pay the displayed amount" width="420" height="420" class="block h-auto w-full" />
          </div>
          <p class="mt-3 text-sm text-(--muted-color)">QR expires in {{ countdown }}</p>
          <a :href="qrImage" :download="`bakong-${order.orderId}.png`" class="mt-2 inline-flex min-h-11 items-center px-3 text-sm font-semibold text-sky-600 hover:underline">Download QR</a>
        </template>
        <button v-if="!paid && !expired && !qrImage && order.qrCode" type="button" @click="renderQR" class="mt-4 min-h-11 w-full rounded-lg border border-(--border-color) px-4 py-3 text-sm">Retry displaying QR</button>
        <p class="mt-4 text-xs leading-5 text-(--muted-color)">Order ID: <span class="break-all select-all">{{ order.orderId }}</span></p>
        <button v-if="canCheck" type="button" :disabled="checking || !canCheck" @click="verifyPayment" class="mt-4 min-h-11 w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500">
          {{ checking ? 'Checking payment…' : paid ? 'Retry unlocking purchase' : 'Check payment' }}
        </button>
        <p v-if="!paid" class="mt-3 text-xs leading-5 text-(--muted-color)">Keep this page open and save the order ID. If money was deducted, check this order or contact admin before paying again.</p>
      </template>
      <a :href="telegramUrl" target="_blank" rel="noopener noreferrer" class="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-(--border-color) px-4 py-3 text-sm font-semibold hover:bg-(--hover-bg)">Contact admin on Telegram</a>
      <RouterLink v-if="isSignalPurchase" :to="signalsPath" class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white">{{ accessReady ? 'View unlocked signal' : 'Back to News Signals' }}</RouterLink>
      <RouterLink :to="dashboardPath" class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-(--border-color) px-4 py-3 text-sm font-semibold hover:bg-(--hover-bg)">Back to dashboard</RouterLink>
    </section>
  </main>
</template>
