<script setup>
import {
  onMounted,
  onUnmounted,
  onActivated,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')

const subscription = ref({ active: false, expiresAt: null })
const monthlyAmount = ref(25)
let expiryTimer
const signals = ref([])
const loading = ref(true)
const error = ref('')
const checkingPurchase = ref(false)
const purchasingSignalId = ref('')
const purchaseError = ref('')

const abortController = new AbortController()
const imageTimers = new Map()

let loadingRequest = false
let refreshPending = false
let refreshTimer
const currentTime = ref(Date.now())
let updateTimer

function isSignalReleased(signal) {
  if (typeof signal.isReleased === 'boolean') {
    return signal.isReleased
  }

  const hasDetails =
    signal.hasDetails === true ||
    (
      typeof signal.details === 'string' &&
      signal.details.trim().length > 0
    )

  const hasImage =
    signal.hasImage === true || Boolean(signal.imageSrc)

  return hasDetails && hasImage
}

function localizedPath(path) {
  return route.params.lang === 'km' ? `/km${path}` : path
}

function validDate(value) {
  if (!value) return null

  const date = new Date(value)

  return Number.isFinite(date.getTime()) ? date : null
}

function dateTimeValue(value) {
  return validDate(value)?.toISOString()
}

function formatDate(value) {
  const date = validDate(value)
  if (!date) return 'Date not announced'

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function timeAgo(value) {
  const date = validDate(value)
  if (!date) return ''
  const seconds = Math.max(0, Math.floor((currentTime.value - date.getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

function formatSignalPrice(signal) {
  const price = monthlyAmount.value

  if (price === undefined || price === null || price === '') {
    return 'Price not available'
  }

  const amount = Number(price)

  if (!Number.isFinite(amount) || amount < 0) {
    return 'Price not available'
  }

 return new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: signal?.currency || 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(amount)
}

async function goToPurchase(signal = {}) {
  if (
    checkingPurchase.value ||
    abortController.signal.aborted
  ) {
    return
  }

  checkingPurchase.value = true
  purchaseError.value = ''

  const signalId = String(signal?._id || 'daily-plan')

  purchasingSignalId.value = signalId

  const paymentLocation = {
    path: localizedPath('/payment'),
    query: {
      productId: 'daily-signal-monthly',
    },
  }

  const paymentDestination =
    router.resolve(paymentLocation).fullPath

  try {
    const response = await fetch(`${BASE}/api/auth/me`, {
      credentials: 'include',
      cache: 'no-store',
      signal: abortController.signal,
    })

    if (response.status === 401) {
      await router.push({
        path: localizedPath('/login'),
        query: {
          redirect: paymentDestination,
        },
      })
      return
    }

    if (!response.ok) {
      throw new Error(
        'Unable to check your account. Please try again.',
      )
    }

    await router.push(paymentLocation)
  } catch (err) {
    if (err.name !== 'AbortError') {
      purchaseError.value =
        err.message || 'Unable to continue. Please try again.'
    }
  } finally {
    checkingPurchase.value = false
    purchasingSignalId.value = ''
  }
}

function clearImages() {
  imageTimers.forEach((timer) => window.clearTimeout(timer))
  imageTimers.clear()
}

function finishImageLoading(signal) {
  const timer = imageTimers.get(signal)
  if (timer !== undefined) window.clearTimeout(timer)
  imageTimers.delete(signal)
  signal.imageLoading = false
}

function handleImageLoaded(signal) {
  finishImageLoading(signal)
  signal.imageError = false
  signal.imageErrorMessage = ''
}

function hasConfirmedDirection(signal) {
  return (
    signal.hasAccess &&
    signal.confirmed === true &&
    ['buy', 'sell'].includes(signal.direction)
  )
}

function handleImageError(signal) {
  finishImageLoading(signal)
  signal.imageError = true
  signal.imageErrorMessage = 'Unable to display the chart. Please retry.'
  signal.imageSrc = ''
}

function loadImage(signal) {
  if (signal.hasImage === false || abortController.signal.aborted) return

  finishImageLoading(signal)
  signal.imageError = false
  signal.imageErrorMessage = ''
  signal.imageLoading = true

  const endpoint = signal.hasAccess ? 'image' : 'preview'
  signal.imageSrc = `${BASE}/api/daily-signals/${encodeURIComponent(signal._id)}/${endpoint}?v=${Date.now()}`

  imageTimers.set(signal, window.setTimeout(() => {
    imageTimers.delete(signal)
    signal.imageLoading = false
    signal.imageError = true
    signal.imageErrorMessage = 'Chart loading timed out. Please retry.'
    signal.imageSrc = ''
  }, 20_000))
}

async function loadSignals(background = false) {
  if (abortController.signal.aborted) return

  if (loadingRequest) {
    refreshPending = true
    return
  }

  loadingRequest = true

  if (!background) {
    loading.value = true
    error.value = ''
  }

  try {
    const response = await fetch(`${BASE}/api/daily-signals`, {
      credentials: 'include',
      cache: 'no-store',
      signal: abortController.signal,
    })

    if (!response.ok) {
      throw new Error(
        'Unable to load signals. Please try again.',
      )
    }

    const data = await response.json()

    if (!Array.isArray(data.signals)) {
      throw new Error('Invalid signal response.')
    }

    if (abortController.signal.aborted) return

    subscription.value = {
      active: data.subscription?.active === true,
      expiresAt: data.subscription?.expiresAt || null,
    }
    if (Number.isFinite(data.plan?.amount)) monthlyAmount.value = data.plan.amount
    window.clearTimeout(expiryTimer)
    if (subscription.value.active && subscription.value.expiresAt) {
      const remaining = new Date(subscription.value.expiresAt).getTime() - Date.now()
      // Re-evaluate long subscriptions daily to stay below browser timer limits.
      expiryTimer = window.setTimeout(() => {
        if (Date.now() >= new Date(subscription.value.expiresAt).getTime()) {
          subscription.value.active = false
          signals.value.forEach(signal => {
            signal.hasAccess = false
            signal.details = ''
            signal.news = ''
            signal.direction = ''
            signal.confirmed = false
            signal.imageSrc = ''
          })
          clearImages()
        }
        void loadSignals(true)
      }, Math.max(0, Math.min(remaining, 86400000)))
    }
    clearImages()

    signals.value = data.signals
      .filter(
        (signal) =>
          signal &&
          typeof signal === 'object' &&
          /^[a-fA-F0-9]{24}$/.test(
            String(signal._id || ''),
          ),
      )
      .map((signal) => ({
        ...signal,
        scheduledAt:
          dateTimeValue(signal.scheduledAt) || null,
        hasAccess: signal.hasAccess === true,
        details:
          signal.hasAccess === true
            ? String(signal.details || '')
            : '',
        news:
          signal.hasAccess === true
            ? String(signal.news || '')
            : '',
        direction:
          signal.hasAccess === true &&
          typeof signal.direction === 'string'
            ? signal.direction.trim().toLowerCase()
            : '',
        confirmed:
          signal.hasAccess === true &&
          signal.confirmed === true,
        imageSrc: '',
        imageError: false,
        imageLoading: false,
        imageErrorMessage: '',
      }))

    error.value = ''
    loading.value = false

    signals.value.forEach(loadImage)
  } catch (err) {
    if (err.name !== 'AbortError' && !background) {
      error.value =
        err.message || 'Unable to load signals.'
    }
  } finally {
    loadingRequest = false

    if (!abortController.signal.aborted) {
      loading.value = false

      if (refreshPending) {
        refreshPending = false
        void loadSignals(true)
      }
    }
  }
}

function refreshVisibleSignals() {
  if (document.visibilityState === 'visible') {
    void loadSignals(true)
  }
}

// Reload access when Vue restores a cached Signal page.
onActivated(() => {
  void loadSignals(true)
})

// This query only triggers a refresh.
// Access is always determined by the backend response.
watch(
  () => route.query.paymentReturn,
  (value, previous) => {
    if (value && value !== previous) {
      void loadSignals(true)
    }
  },
)

onMounted(() => {
  currentTime.value = Date.now()
  updateTimer = window.setInterval(() => { currentTime.value = Date.now() }, 15000)
  window.addEventListener('focus', refreshVisibleSignals)

  document.addEventListener(
    'visibilitychange',
    refreshVisibleSignals,
  )

  void loadSignals()

  refreshTimer = window.setInterval(() => {
    refreshVisibleSignals()
  }, 60_000)
})

onUnmounted(() => {
  window.removeEventListener(
    'focus',
    refreshVisibleSignals,
  )

  document.removeEventListener(
    'visibilitychange',
    refreshVisibleSignals,
  )

  window.clearInterval(refreshTimer)
  window.clearInterval(updateTimer)

  refreshPending = false
  window.clearTimeout(expiryTimer)
  abortController.abort()
  clearImages()
})
</script>

<template>
  <section
    class="bg-(--page-bg) px-4 py-12 text-(--text-color)

           max-[768px]:py-10 max-[600px]:px-4
           max-[480px]:py-8 max-[414px]:px-3
           max-[320px]:px-2"
  >
    <div class="mx-auto max-w-7xl">
      <div class="mb-8">
        <span
          class="inline-flex rounded-full bg-amber-100
                 px-3 py-1 text-xs font-semibold text-amber-800
                 dark:bg-amber-400/10 dark:text-amber-300"
        >
          DAILY TECHNICAL ANALYSIS
        </span>

        <h2
          class="mt-4 text-4xl font-bold
                 max-[768px]:text-3xl max-[480px]:text-2xl"
        >
          Daily Signals
        </h2>

        <p
          class="mt-3 max-w-2xl text-sm leading-6
                 text-(--muted-color) "
        >
         In Daily Signal have only Daily day signal , no include News Siganl and weekend.
        </p>
      </div>

      <div v-if="subscription.active" class="mb-6 rounded-xl border border-emerald-300 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
        <p class="font-bold">Daily Signal subscription active</p>
        <p class="mt-1">Access until {{ formatDate(subscription.expiresAt) }}.</p>
      </div>
      <p
        v-if="purchaseError"
        role="alert"
        class="mb-6 rounded-xl bg-red-50 p-4 text-sm
               text-red-700 dark:bg-red-950/30 dark:text-red-300"
      >
        {{ purchaseError }}
      </p>

      <div
        v-if="loading"
        role="status"
        class="rounded-2xl border border-(--border-color)
               py-12 text-center text-(--muted-color)
                "
      >
        Loading signals…
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="rounded-xl bg-red-50 p-6 text-red-700
               dark:bg-red-950/30 dark:text-red-300"
      >
        <p>{{ error }}</p>

        <button
          type="button"
          class="mt-3 cursor-pointer font-semibold underline"
          @click="loadSignals()"
        >
          Try again
        </button>
      </div>

      <div v-else-if="signals.length === 0" class="max-w-md rounded-2xl border border-(--border-color) bg-(--surface-bg) p-6 text-center">
        <h3 class="text-xl font-bold">Daily Signals</h3>
        <p class="mt-3 text-2xl font-bold text-amber-600 dark:text-amber-300">{{ formatSignalPrice() }} / month</p>
        <p class="mt-3 text-sm leading-6 text-(--muted-color)">No Daily Signals published yet. Admin updates will appear here.</p>
        <button v-if="!subscription.active" type="button" :disabled="checkingPurchase" @click="goToPurchase()" class="mt-5 min-h-11 w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60">{{ checkingPurchase ? 'Please wait…' : 'Subscribe to Daily Signals' }}</button>
      </div>

      <div
        v-else
        class="grid grid-cols-3 gap-6
               max-[1024px]:grid-cols-2
               max-[768px]:grid-cols-1
               max-[600px]:gap-5 max-[480px]:gap-4"
      >
        <article
          v-for="signal in signals"
          :key="signal._id"
          class="min-w-0 overflow-hidden rounded-2xl
                 border border-(--border-color) bg-(--surface-bg) shadow-sm
                  "
        >
          <header
            class="border-b border-(--border-color) p-5

                   max-[480px]:p-4 max-[320px]:p-3"
          >
            <div
              class="flex flex-wrap items-center
                     justify-between gap-3"
            >
              <span
                class="rounded-lg bg-amber-100 px-3 py-1
                       text-sm font-bold text-amber-800
                       dark:bg-amber-400/10 dark:text-amber-300"
              >
                {{ signal.pair }}
              </span>

              <span
                role="status"
                class="inline-flex max-w-full items-center gap-2
                       rounded-full px-3 py-1.5 text-xs font-semibold"
                :class="
                  isSignalReleased(signal)
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300'
                "
              >
                <span
                  class="relative flex h-2.5 w-2.5 shrink-0"
                  aria-hidden="true"
                >
                  <span
                    v-if="!isSignalReleased(signal)"
                    class="absolute inline-flex h-full w-full
                           animate-ping rounded-full bg-red-500
                           opacity-60 motion-reduce:animate-none"
                  ></span>

                  <span
                    class="relative inline-flex h-2.5 w-2.5 rounded-full"
                    :class="
                      isSignalReleased(signal)
                        ? 'bg-emerald-500'
                        : 'bg-red-500'
                    "
                  ></span>
                </span>

                <span>
                  {{
                    isSignalReleased(signal)
                      ? 'Signal Released'
                      : 'Coming soon'
                  }}
                </span>
              </span>
            </div>

            <h3 class="mt-4 break-words text-lg font-bold">
              {{ signal.title }}
            </h3>

            <p
              class="mt-2 text-xs font-medium
                     text-(--muted-color) "
            >
              by Thun Tula
            </p>

            <div
              class="mt-4 rounded-xl border border-(--border-color)
                     bg-(--page-bg) p-3&#x20;
                     "
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs font-semibold text-(--muted-color)">Signal date For</p>
                <time
                  v-if="validDate(signal.updatedAt)"
                  :datetime="signal.updatedAt"
                  class="ml-auto text-right text-xs text-(--muted-color)"
                >Updated {{ timeAgo(signal.updatedAt) }}</time>
              </div>
              <time
                v-if="signal.scheduledAt"
                :datetime="signal.scheduledAt"
                class="mt-2 block break-words text-sm font-semibold text-(--text-color)"
              >{{ formatDate(signal.scheduledAt) }}</time>
              <p v-else class="mt-2 text-sm text-(--muted-color)">Date not announced.</p>

              <span
                v-if="signal.newsType"
                class="mt-3 inline-flex max-w-full break-words
                       rounded-md bg-blue-100 px-2 py-1
                       text-xs font-semibold text-blue-700
                       dark:bg-blue-400/10 dark:text-blue-300"
              >
                {{ signal.newsType }}
              </span>
            </div>
          </header>

          <div class="relative overflow-hidden">
            <div
              :class="
                !signal.hasAccess
                  ? 'pointer-events-none select-none'
                  : ''
              "
              :aria-hidden="!signal.hasAccess ? 'true' : undefined"
              :inert="!signal.hasAccess"
            >
              <div
                class="relative flex aspect-video items-center
                       justify-center overflow-hidden
                       bg-(--input-bg) "
              >
                <img
                  v-if="signal.imageSrc"
                  crossorigin="use-credentials"
                  @load="handleImageLoaded(signal)"
                  :src="signal.imageSrc"
                  :alt="
                    signal.hasAccess
                      ? `${signal.pair} technical analysis chart`
                      : ''
                  "
                  class="h-full w-full object-contain"
                  :class="
                    !signal.hasAccess
                      ? 'scale-105 blur-sm'
                      : ''
                  "
                  @error="handleImageError(signal)"
                />

                <div
                  v-else
                  class="flex h-full w-full items-center
                         justify-center bg-gradient-to-br
                         from-(--input-bg) via-(--surface-bg) to-(--hover-bg)

                         "
                >
                  <div
                    v-if="signal.hasAccess"
                    class="px-4 text-center text-sm text-(--muted-color)"
                  >
                    <p role="status">
                      {{
                        signal.imageError
                          ? signal.imageErrorMessage || 'Image unavailable.'
                          : signal.hasImage === false
                            ? 'Chart will be added soon.'
                            : 'Loading chart…'
                      }}
                    </p>
                    <button
                      v-if="signal.imageError"
                      type="button"
                      :disabled="signal.imageLoading"
                      class="mt-3 min-h-11 rounded-lg border border-(--border-color) px-4 py-2 font-semibold text-(--text-color) disabled:opacity-50"
                      @click="loadImage(signal)"
                    >
                      Retry chart
                    </button>
                  </div>
                </div>

                <span
                  v-if="hasConfirmedDirection(signal)"
                  class="absolute right-3 top-3 z-10 rounded-lg
                         px-3 py-2 text-xs font-bold shadow-sm"
                  :class="
                    signal.direction === 'buy'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  "
                >
                  Confirmed {{ signal.direction.toUpperCase() }}
                </span>
              </div>

              <div
                class="min-h-64 p-5
                       max-[480px]:p-4 max-[320px]:p-3"
                :class="!signal.hasAccess ? 'blur-sm' : ''"
              >
                <h4 class="text-sm font-bold underline">
                   Note:
                </h4>

                <p
  class="mt-3 whitespace-pre-line break-words
         text-sm font-bold leading-6
         text-slate-900 dark:text-slate-100"
>
  {{
    signal.hasAccess
      ? signal.details
      : signal.previewText
  }}
</p>

                <template v-if="signal.hasAccess && signal.news">
                  <h4 class="mt-5 text-sm font-bold">
                    Related news
                  </h4>

                  <p
                    class="mt-2 whitespace-pre-line break-words
                           text-sm leading-6 text-(--muted-color)
                           "
                  >
                    {{ signal.news }}
                  </p>
                </template>
              </div>
            </div>

            <div
              v-if="!signal.hasAccess"
              class="absolute inset-0 flex items-center
                     justify-center bg-(--surface-bg)/45 p-4

                     max-[414px]:p-3 max-[320px]:p-2"
            >
              <div
                class="w-full max-w-xs rounded-2xl
                       border border-(--border-color) bg-(--surface-bg)/95
                       p-5 text-center shadow-xl

                       max-[480px]:p-4 max-[320px]:p-3"
              >
                <svg
                  class="mx-auto h-9 w-9 text-amber-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  aria-hidden="true"
                >
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="11"
                    rx="2"
                  />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  <path d="M12 14v3" />
                </svg>

                <h4
  class="mt-3 text-2xl font-bold
         text-amber-600 dark:text-amber-300"
>
  {{ formatSignalPrice(signal) }} /month
</h4>

                <p
                  class="mt-2 text-sm leading-6
                         text-(--muted-color) "
                >
                  Subscribe to unlock every Daily Signal’s chart,
                  confirmed direction, and full analysis for one calendar month.
                  Access starts when payment is confirmed.
                </p>

                <button
                  type="button"
                  :disabled="checkingPurchase"
                  :aria-busy="
                    checkingPurchase &&
                    purchasingSignalId === signal._id
                  "
                  class="mt-5 w-full cursor-pointer rounded-xl
                         bg-amber-400 px-5 py-3 text-sm font-bold
                         text-slate-950 transition
                         hover:bg-amber-300
                         disabled:cursor-wait disabled:opacity-60
                         focus-visible:outline-2
                         focus-visible:outline-offset-2
                         focus-visible:outline-amber-500"
                  @click="goToPurchase(signal)"
                >
                  {{
                    checkingPurchase &&
                    purchasingSignalId === signal._id
                      ? 'Please wait…'
                      : 'Subscribe — $25 / month'
                  }}
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>