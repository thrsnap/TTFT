<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'

const route = useRoute()
const router = useRouter()

const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')

const order = ref(null)
const qrImage = ref('')
const generating = ref(false)
const checking = ref(false)
const creationUncertain = ref(false)
const error = ref('')
const message = ref('')
const now = ref(Date.now())

let timer
let version = 0
let disposed = false

const productId = computed(() => {
  const courseId = route.params.courseId

  if (
    typeof courseId === 'string' &&
    /^[a-f0-9]{24}$/i.test(courseId)
  ) {
    return `course:${courseId}`
  }

  const signalId = route.query.signalId

  if (
    typeof signalId === 'string' &&
    /^[a-f0-9]{24}$/i.test(signalId)
  ) {
    return `signal:${signalId}`
  }

  const value =
    route.params.productId ||
    route.query.productId ||
    route.query.product

  return (
    typeof value === 'string' &&
    /^(signal|course):[a-f0-9]{24}$/i.test(value)
  ) ? value : ''
})

const paid = computed(() =>
  order.value?.status === 'paid',
)

const unlocked = computed(() =>
  paid.value && order.value?.accessGranted === true,
)

const expired = computed(() => {
  if (!order.value || paid.value) return false

  const expiresAt = new Date(order.value.expiresAt).getTime()

  return (
    order.value.status === 'expired' ||
    (Number.isFinite(expiresAt) && now.value >= expiresAt)
  )
})

const countdown = computed(() => {
  if (!order.value) return ''

  const expiresAt = new Date(order.value.expiresAt).getTime()

  if (!Number.isFinite(expiresAt)) return ''

  const seconds = Math.max(
    0,
    Math.ceil((expiresAt - now.value) / 1000),
  )

  return `${Math.floor(seconds / 60)}:${String(
    seconds % 60,
  ).padStart(2, '0')}`
})

const price = computed(() => {
  if (!order.value) return ''

  const amount = Number(order.value.amount)

  if (!Number.isFinite(amount)) return ''

  return `${order.value.currency || 'USD'} ${amount.toLocaleString(
    'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  )}`
})

const buttonLabel = computed(() => {
  if (generating.value) return 'Generating QR…'
  if (checking.value) return 'Checking payment…'
  if (unlocked.value) return 'Return to signals'
  if (creationUncertain.value && !order.value) {
    return 'Order status uncertain'
  }
  if (!order.value) return 'Generate QR'
  if (paid.value) return 'Retry unlock'

  return 'Check payment'
})

const buttonDisabled = computed(() => {
  if (generating.value || checking.value) return true

  if (!order.value) {
    return !productId.value || creationUncertain.value
  }

  if (unlocked.value) return false

  return (
    !order.value.orderId ||
    order.value.verificationAvailable === false ||
    order.value.signalDeleted === true
  )
})

function returnToPurchase() {
  const prefix = route.params.lang === 'km' ? '/km' : ''
  const isSignal = productId.value.startsWith('signal:')

  return router.replace({
    path: `${prefix}${isSignal ? '/signal' : '/dashboard'}`,
    query: {
      paymentReturn: String(Date.now()),
    },
  })
}

async function request(path, body = {}) {
  let response

  try {
    response = await fetch(`${BASE}/api/payments${path}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CMM-Request': '1',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    })
  } catch {
    const failure = new Error(
      'Connection interrupted. Check your order before paying again.',
    )

    failure.uncertain = true
    throw failure
  }

  const result = await response.json().catch(() => null)

  if (!response.ok) {
    const failure = new Error(
      result?.message || `Request failed (${response.status}).`,
    )

    failure.uncertain = response.status >= 500
    throw failure
  }

  if (
    result?.success !== true ||
    !result.data ||
    typeof result.data !== 'object' ||
    !result.data.orderId
  ) {
    const failure = new Error(
      'Invalid payment response. Contact admin before paying again.',
    )

    failure.uncertain = true
    throw failure
  }

  return result.data
}

async function generateQR() {
  if (
    generating.value ||
    order.value ||
    creationUncertain.value ||
    !productId.value
  ) {
    return
  }

  const current = version

  generating.value = true
  error.value = ''
  message.value = ''

  try {
    const data = await request('/orders', {
      productId: productId.value,
    })

    if (disposed || current !== version) return

    order.value = data
    now.value = Date.now()

    if (unlocked.value) {
      message.value = 'Payment confirmed. Returning…'
      await returnToPurchase()
      return
    }

    if (paid.value) {
      message.value = 'Payment confirmed. Click Retry unlock.'
      return
    }

    if (
      typeof data.qrCode !== 'string' ||
      !data.qrCode.trim() ||
      !Number.isFinite(new Date(data.expiresAt).getTime())
    ) {
      throw new Error(
        'QR unavailable. Keep your order ID and contact admin.',
      )
    }

    const image = await QRCode.toDataURL(data.qrCode, {
      width: 420,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })

    if (disposed || current !== version) return

    qrImage.value = image

    if (data.verificationAvailable === false) {
      message.value =
        'Payment checking is unavailable. Contact admin.'
    }
  } catch (cause) {
    if (disposed || current !== version) return

    error.value = cause.message

    if (cause.uncertain) {
      creationUncertain.value = true
    }
  } finally {
    if (!disposed && current === version) {
      generating.value = false
    }
  }
}

async function checkPayment() {
  if (
    !order.value?.orderId ||
    checking.value ||
    generating.value
  ) {
    return
  }

  const current = version
  const orderId = order.value.orderId

  checking.value = true
  error.value = ''
  message.value = ''

  try {
    const data = await request(
      `/orders/${encodeURIComponent(orderId)}/check`,
    )

    if (disposed || current !== version) return

    if (data.orderId !== orderId) {
      throw new Error('Order mismatch. Contact admin.')
    }

    order.value = {
      ...order.value,
      ...data,
    }

    now.value = Date.now()

    if (unlocked.value) {
      message.value = 'Payment confirmed. Returning…'
      await returnToPurchase()
    } else if (paid.value) {
      message.value = data.signalDeleted
        ? 'Signal unavailable. Contact admin.'
        : 'Payment confirmed. Access pending — retry unlock.'
    } else {
      message.value = expired.value
        ? 'QR expired. If you paid, contact admin.'
        : 'Payment not found yet. Please check again.'
    }
  } catch (cause) {
    if (!disposed && current === version) {
      error.value = cause.message
    }
  } finally {
    if (!disposed && current === version) {
      checking.value = false
    }
  }
}

async function handlePayment() {
  if (buttonDisabled.value) return

  if (unlocked.value) {
    try {
      await returnToPurchase()
    } catch {
      error.value = 'Unable to return. Please try again.'
    }
    return
  }

  if (order.value) {
    await checkPayment()
  } else {
    await generateQR()
  }
}

watch(productId, () => {
  version++
  order.value = null
  qrImage.value = ''
  generating.value = false
  checking.value = false
  creationUncertain.value = false
  error.value = ''
  message.value = ''
})

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  disposed = true
  version++
  window.clearInterval(timer)
})
</script>

<template>
  <main
    class="flex min-h-[70vh] items-center justify-center
           px-4 py-8 text-(--text-color)"
  >
    <section
      class="w-full max-w-sm rounded-2xl
             border border-(--border-color)
             bg-(--surface-bg) p-5 text-center sm:p-6"
    >
      <h1 class="text-xl font-bold">
        Bakong QR Payment
      </h1>

      <template v-if="order">
        <p class="mt-4 text-3xl font-bold">
          {{ price }}
        </p>

        <p class="mt-2 break-words text-sm text-(--muted-color)">
          Receiver: {{ order.merchantName || 'Merchant' }}
        </p>

        <div
          v-if="qrImage && !paid && !expired"
          class="mx-auto mt-5 max-w-[280px]
                 rounded-xl bg-white p-2"
        >
          <img
            :src="qrImage"
            alt="Scan to pay with Bakong"
            width="420"
            height="420"
            class="block h-auto w-full"
          />
        </div>

        <p
          v-if="!paid && !expired && countdown"
          class="mt-3 text-sm text-(--muted-color)"
        >
          QR expires in
          <span class="font-semibold">{{ countdown }}</span>
        </p>

        <p
          v-if="expired"
          class="mt-4 text-sm font-semibold
                 text-amber-600 dark:text-amber-400"
        >
          QR expired. Do not scan it.
        </p>

        <p
          v-if="paid"
          class="mt-4 text-sm font-semibold
                 text-emerald-600 dark:text-emerald-400"
        >
          {{ unlocked ? 'Payment confirmed' : 'Paid — access pending' }}
        </p>
      </template>

      <p
        v-else
        class="mt-3 text-sm text-(--muted-color)"
      >
        Generate a QR to view the amount and receiver.
      </p>

      <p
        v-if="error"
        role="alert"
        class="mt-4 text-sm text-red-600 dark:text-red-400"
      >
        {{ error }}
      </p>

      <p
        v-if="message"
        role="status"
        aria-live="polite"
        class="mt-4 text-sm"
      >
        {{ message }}
      </p>

      <button
        type="button"
        :disabled="buttonDisabled"
        class="mt-5 min-h-11 w-full rounded-xl
               bg-sky-600 px-4 py-3 font-semibold text-white
               hover:bg-sky-500
               disabled:cursor-not-allowed disabled:opacity-50"
        @click="handlePayment"
      >
        {{ buttonLabel }}
      </button>

      <p
        v-if="order?.orderId"
        class="mt-4 break-all text-xs text-(--muted-color)"
      >
        Order: {{ order.orderId }}
      </p>
    </section>
  </main>
</template>