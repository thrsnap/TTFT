<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { courseApi } from '../../api/courseApi.js'
import {
  createPayment,
  checkPayment,
} from '../../api/paymentApi.js'

const route = useRoute()
const router = useRouter()

const course = ref(null)
const loadingProduct = ref(false)
const order = ref(null)
const qrImage = ref('')
const busy = ref(false)
const checking = ref(false)
const errorMessage = ref('')
const currentTime = ref(Date.now())

let pollTimer
let disposed = false
let requestVersion = 0

const clockTimer = setInterval(() => {
  currentTime.value = Date.now()
}, 1000)

const productId = computed(() =>
  typeof route.query.product === 'string'
    ? route.query.product
    : '',
)

const courseId = computed(() =>
  productId.value.startsWith('course:')
    ? productId.value.slice('course:'.length)
    : '',
)

const productName = computed(() => {
  if (productId.value === 'news-signals-monthly') {
    return 'News Signals — Monthly'
  }

  if (courseId.value) {
    return course.value?.title || ''
  }

  return ''
})

const secondsRemaining = computed(() => {
  if (!order.value) return 0

  const expiresAt = new Date(order.value.expiresAt).getTime()

  if (!Number.isFinite(expiresAt)) return 0

  return Math.max(
    0,
    Math.ceil((expiresAt - currentTime.value) / 1000),
  )
})

const countdown = computed(() => {
  const minutes = Math.floor(secondsRemaining.value / 60)
  const seconds = secondsRemaining.value % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

const isPaid = computed(() => order.value?.status === 'paid')

const qrExpired = computed(() =>
  Boolean(
    order.value &&
    !isPaid.value &&
    (
      order.value.status === 'expired' ||
      secondsRemaining.value === 0
    ),
  ),
)

const dashboardPath = computed(() =>
  route.params.lang === 'km' ? '/km/dashboard' : '/dashboard',
)

function stopPolling() {
  clearTimeout(pollTimer)
}

function isCurrent(version) {
  return !disposed && version === requestVersion
}

function handleError(error) {
  if (disposed) return

  if (error.status === 401) {
    stopPolling()

    router.replace({
      path: route.params.lang === 'km' ? '/km/login' : '/login',
      query: {
        redirect: route.fullPath,
      },
    })

    return
  }

  errorMessage.value = error.message || 'Please try again.'
}

async function loadProduct() {
  const version = ++requestVersion
  const selectedCourseId = courseId.value

  stopPolling()

  course.value = null
  order.value = null
  qrImage.value = ''
  errorMessage.value = ''
  busy.value = false
  checking.value = false
  loadingProduct.value = false

  if (!selectedCourseId) return

  loadingProduct.value = true

  try {
    const data = await courseApi(
      `/${encodeURIComponent(selectedCourseId)}`,
    )

    if (!isCurrent(version)) return

    if (!data.course?.title) {
      throw new Error('Course not found.')
    }

    course.value = data.course
  } catch (error) {
    if (isCurrent(version)) {
      handleError(error)
    }
  } finally {
    if (isCurrent(version)) {
      loadingProduct.value = false
    }
  }
}

async function startPayment() {
  if (
    disposed ||
    busy.value ||
    loadingProduct.value ||
    order.value ||
    !productName.value
  ) {
    return
  }

  const version = requestVersion
  const selectedProductId = productId.value

  busy.value = true
  errorMessage.value = ''

  try {
    const payment = await createPayment(selectedProductId)

    if (!isCurrent(version)) return

    if (!payment?.orderId || !payment?.qrCode) {
      throw new Error('The backend returned an invalid payment.')
    }

    // Save the order before rendering its QR.
    order.value = payment
    currentTime.value = Date.now()

    const image = await QRCode.toDataURL(payment.qrCode, {
      width: 360,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })

    if (!isCurrent(version)) return

    qrImage.value = image
    scheduleCheck()
  } catch (error) {
    if (isCurrent(version)) {
      handleError(error)
    }
  } finally {
    if (isCurrent(version)) {
      busy.value = false
    }
  }
}

function scheduleCheck() {
  stopPolling()

  if (
    disposed ||
    !order.value ||
    order.value.status !== 'pending' ||
    order.value.verificationAvailable === false ||
    secondsRemaining.value === 0
  ) {
    return
  }

  pollTimer = setTimeout(verifyPayment, 5000)
}
async function verifyPayment() {
  if (
    disposed ||
    !order.value ||
    checking.value ||
    busy.value ||
    isPaid.value
  ) {
    return
  }

  const version = requestVersion
  const orderId = order.value.orderId

  stopPolling()
  checking.value = true
  errorMessage.value = ''

  try {
    const result = await checkPayment(orderId)

    if (!isCurrent(version)) return

    if (
      !result ||
      !['pending', 'paid', 'expired'].includes(result.status)
    ) {
      throw new Error('The backend returned an invalid payment status.')
    }

    order.value = {
      ...order.value,
      ...result,
    }

    currentTime.value = Date.now()

    // Stop automatic checks at expiry.
    // Manual checking remains available.
    if (
      result.status === 'pending' &&
      secondsRemaining.value > 0
    ) {
      scheduleCheck()
    }
  } catch (error) {
    if (isCurrent(version)) {
      handleError(error)
    }
  } finally {
    if (isCurrent(version)) {
      checking.value = false
    }
  }
}

// Also handles changing products while using the same page.
watch(productId, loadProduct, { immediate: true })

onBeforeUnmount(() => {
  disposed = true
  requestVersion++
  stopPolling()
  clearInterval(clockTimer)
})
</script>

<template>
  <main
    class="min-h-[70vh] px-6 py-10 text-(--text-color)
           max-[768px]:px-5 max-[768px]:py-8
           max-[600px]:px-4 max-[600px]:py-7
           max-[480px]:px-3 max-[480px]:py-6
           max-[414px]:px-3 max-[414px]:py-5
           max-[320px]:px-2 max-[320px]:py-4"
  >
    <section
      class="mx-auto w-full min-w-0 max-w-[360px]
             rounded-2xl border border-(--border-color)
             bg-(--surface-bg) p-5
             max-[768px]:p-5
             max-[600px]:p-4
             max-[480px]:rounded-xl
             max-[414px]:p-3.5
             max-[320px]:p-3"
    >
      <h1
        class="text-center text-xl font-bold leading-snug
               max-[480px]:text-lg
               max-[320px]:text-base"
      >
        Pay with Bakong KHQR
      </h1>

      <p
        class="mt-2 text-center text-sm leading-6
               text-(--muted-color) [overflow-wrap:anywhere]
               max-[414px]:text-xs max-[414px]:leading-5"
        :role="loadingProduct ? 'status' : undefined"
      >
        {{
          loadingProduct
            ? 'Loading course…'
            : productName || 'Please select a valid product'
        }}
      </p>

      <p
        v-if="course"
        class="mt-1 text-center text-xs leading-5
               text-(--muted-color) [overflow-wrap:anywhere]"
      >
        {{ course.mentor }} · {{ course.videoCount }} videos
      </p>

      <p
        v-if="errorMessage"
        role="alert"
        class="mt-4 rounded-lg bg-red-500/10 p-3
               text-xs leading-5 text-red-500
               [overflow-wrap:anywhere]"
      >
        {{ errorMessage }}
      </p>

      <button
        v-if="!order && productName && !loadingProduct"
        type="button"
        :disabled="busy"
        @click="startPayment"
        class="mt-4 min-h-11 w-full cursor-pointer rounded-lg
               bg-indigo-600 px-4 py-2.5 text-sm
               font-semibold text-white transition
               hover:bg-indigo-500
               disabled:cursor-not-allowed disabled:opacity-50
               focus-visible:outline-2
               focus-visible:outline-offset-2
               focus-visible:outline-indigo-500
               max-[414px]:px-3 max-[414px]:text-xs"
      >
        {{ busy ? 'Creating QR…' : 'Generate payment QR' }}
      </button>

      <button
        v-if="
          courseId &&
          !loadingProduct &&
          !productName &&
          errorMessage
        "
        type="button"
        @click="loadProduct"
        class="mt-3 min-h-11 w-full cursor-pointer
               text-sm font-semibold text-indigo-500 underline
               max-[414px]:text-xs"
      >
        Retry loading course
      </button>

      <template v-if="order">
        <div
          class="mt-4 border-t border-(--border-color)
                 pt-4 text-center
                 max-[320px]:mt-3 max-[320px]:pt-3"
        >
          <p
            class="text-2xl font-bold tabular-nums
                   [overflow-wrap:anywhere]
                   max-[480px]:text-xl
                   max-[320px]:text-lg"
          >
            {{ order.amount }} {{ order.currency }}
          </p>

          <p
            class="mt-1 text-xs leading-5 text-(--muted-color)
                   [overflow-wrap:anywhere]"
          >
            Receiver: {{ order.merchantName }}
          </p>
        </div>

        <template v-if="!isPaid && !qrExpired">
          <div
            v-if="qrImage"
            class="mx-auto mt-4 w-full max-w-48
                   rounded-lg bg-white p-1
                   max-[768px]:max-w-48
                   max-[600px]:max-w-44
                   max-[480px]:max-w-44
                   max-[414px]:max-w-40
                   max-[320px]:max-w-36"
          >
            <img
              :src="qrImage"
              alt="Bakong KHQR payment code"
              class="block h-auto w-full"
            />
          </div>

          <p
            v-if="qrImage"
            class="mt-3 text-center text-xs leading-5
                   text-(--muted-color)"
          >
            Scan with your banking app to pay.
          </p>

          <p
            class="mt-2 text-center text-sm
                   font-semibold tabular-nums
                   max-[414px]:text-xs"
          >
            QR expires in {{ countdown }}
          </p>
        </template>

        <div
          v-if="isPaid"
          role="status"
          class="mt-4 rounded-lg bg-emerald-500/10
                 p-4 text-center max-[320px]:p-3"
        >
          <p class="text-sm font-bold text-emerald-500">
            Payment confirmed!
          </p>

          <RouterLink
            :to="dashboardPath"
            class="mt-3 inline-flex min-h-11 w-full
                   items-center justify-center rounded-lg
                   bg-emerald-600 px-3 py-2.5 text-sm
                   font-semibold text-white
                   transition hover:bg-emerald-500
                   max-[414px]:text-xs"
          >
            Go to dashboard
          </RouterLink>
        </div>

        <p
          v-else-if="qrExpired"
          class="mt-4 text-center text-xs
                 leading-5 text-amber-500"
        >
          This QR has expired. If you already paid,
          check payment below.
        </p>

        <button
          v-if="!isPaid"
          type="button"
          :disabled="checking || busy"
          @click="verifyPayment"
          class="mt-4 min-h-11 w-full cursor-pointer rounded-lg
                 border border-(--border-color)
                 px-4 py-2.5 text-sm font-semibold
                 transition hover:bg-(--hover-bg)
                 disabled:cursor-not-allowed disabled:opacity-50
                 focus-visible:outline-2
                 focus-visible:outline-offset-2
                 focus-visible:outline-indigo-500
                 max-[414px]:px-3 max-[414px]:text-xs"
        >
          {{ checking ? 'Checking…' : 'Check payment' }}
        </button>
      </template>
    </section>
  </main>
</template>