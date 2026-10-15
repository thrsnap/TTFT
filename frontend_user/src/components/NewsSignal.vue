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

const signals = ref([])
const loading = ref(true)
const error = ref('')
const checkingPurchase = ref(false)
const purchasingSignalId = ref('')
const purchaseError = ref('')

const abortController = new AbortController()
const imageUrls = new Set()

let loadingRequest = false
let refreshPending = false
let refreshTimer

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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatTime(value) {
  const date = validDate(value)

  if (!date) return 'Time not announced'

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'shortOffset',
  }).format(date)
}

function formatSignalPrice(signal) {
  const price = 25

  if (price === undefined || price === null || price === '') {
    return 'Price not available'
  }

  const amount = Number(price)

  if (!Number.isFinite(amount) || amount < 0) {
    return 'Price not available'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: signal.currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

async function goToPurchase(signal) {
  if (
    checkingPurchase.value ||
    abortController.signal.aborted
  ) {
    return
  }

  checkingPurchase.value = true
  purchaseError.value = ''

  const signalId = String(signal?._id || '')

  if (!/^[a-fA-F0-9]{24}$/.test(signalId)) {
    checkingPurchase.value = false
    purchaseError.value =
      'This signal is unavailable. Please refresh the page.'
    return
  }

  purchasingSignalId.value = signalId

  const paymentLocation = {
    path: localizedPath('/payment'),
    query: {
      product: 'news-signal',
      signalId,
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
  imageUrls.forEach((url) => URL.revokeObjectURL(url))
  imageUrls.clear()
}

function hasConfirmedDirection(signal) {
  return (
    signal.hasAccess &&
    signal.confirmed === true &&
    ['buy', 'sell'].includes(signal.direction)
  )
}

function handleImageError(signal) {
  if (signal.imageSrc) {
    URL.revokeObjectURL(signal.imageSrc)
    imageUrls.delete(signal.imageSrc)
  }

  signal.imageError = true
  signal.imageSrc = ''
}

async function loadImage(signal) {
  if (signal.hasImage === false) return

  const endpoint = signal.hasAccess ? 'image' : 'preview'

  try {
    const response = await fetch(
      `${BASE}/api/signals/${encodeURIComponent(signal._id)}/${endpoint}`,
      {
        credentials: 'include',
        cache: 'no-store',
        signal: abortController.signal,
      },
    )

    if (!response.ok) {
      if (
        signal.hasAccess &&
        [401, 403].includes(response.status)
      ) {
        signal.hasAccess = false
        signal.details = ''
        signal.news = ''
        signal.direction = ''
        signal.confirmed = false
      }

      throw new Error('Image unavailable')
    }

    const blob = await response.blob()

    if (!blob.type.startsWith('image/')) {
      throw new Error('Invalid image response')
    }

    if (abortController.signal.aborted) return

    const url = URL.createObjectURL(blob)

    imageUrls.add(url)
    signal.imageSrc = url
  } catch (err) {
    if (err.name !== 'AbortError') {
      signal.imageError = true
    }
  }
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
    const response = await fetch(`${BASE}/api/signals`, {
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
      }))

    error.value = ''
    loading.value = false

    await Promise.all(signals.value.map(loadImage))
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

  refreshPending = false
  abortController.abort()
  clearImages()
})
</script>

<template>
  <section
    class="bg-slate-50 px-4 py-12 text-slate-900
           dark:bg-slate-950 dark:text-white
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
          NEWS TECHNICAL ANALYSIS
        </span>

        <h2
          class="mt-4 text-4xl font-bold
                 max-[768px]:text-3xl max-[480px]:text-2xl"
        >
          News Signals
        </h2>

        <p
          class="mt-3 max-w-2xl text-sm leading-6
                 text-slate-600 dark:text-slate-400"
        >
          Technical chart analysis and trading setups around
          economic news, including CPI, NFP, and FOMC.
        </p>
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
        class="rounded-2xl border border-slate-200
               py-12 text-center text-slate-500
               dark:border-slate-800 dark:text-slate-400"
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

      <div
        v-else-if="signals.length === 0"
        class="rounded-2xl border border-dashed
               border-slate-300 py-12 text-center text-slate-500
               dark:border-slate-700 dark:text-slate-400"
      >
        No signals published yet.
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
                 border border-slate-200 bg-white shadow-sm
                 dark:border-slate-800 dark:bg-slate-900"
        >
          <header
            class="border-b border-slate-200 p-5
                   dark:border-slate-800
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
                     text-slate-500 dark:text-slate-400"
            >
              by Thun Tula
            </p>

            <div
              class="mt-4 rounded-xl border border-slate-200
                     bg-slate-50 p-3 dark:border-slate-700
                     dark:bg-slate-800/60"
            >
              <p
                class="mb-2 text-xs font-semibold
                       text-slate-500 dark:text-slate-400"
              >
                News date and time
              </p>

              <time
                v-if="signal.scheduledAt"
                :datetime="signal.scheduledAt"
                class="block break-words text-sm font-semibold
                       text-slate-900 dark:text-white"
              >
                {{ formatDate(signal.scheduledAt) }},
                {{ formatTime(signal.scheduledAt) }}
              </time>

              <p
                v-else
                class="text-sm text-slate-500 dark:text-slate-400"
              >
                Date and time not announced.
              </p>

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
                       bg-slate-100 dark:bg-slate-800"
              >
                <img
                  v-if="signal.imageSrc"
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
                         from-slate-200 via-slate-100 to-slate-300
                         dark:from-slate-800 dark:via-slate-700
                         dark:to-slate-900"
                >
                  <p
                    v-if="signal.hasAccess"
                    class="px-4 text-center text-sm
                           text-slate-500 dark:text-slate-400"
                  >
                    {{
                      signal.imageError
                        ? 'Image unavailable'
                        : signal.hasImage === false
                          ? 'Chart will be added soon.'
                          : 'Loading chart…'
                    }}
                  </p>
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
                <h4 class="text-sm font-bold">
                  Technical analysis
                </h4>

                <p
                  class="mt-2 whitespace-pre-line break-words
                         text-sm leading-6 text-slate-600
                         dark:text-slate-300"
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
                           text-sm leading-6 text-slate-600
                           dark:text-slate-300"
                  >
                    {{ signal.news }}
                  </p>
                </template>
              </div>
            </div>

            <div
              v-if="!signal.hasAccess"
              class="absolute inset-0 flex items-center
                     justify-center bg-white/45 p-4
                     dark:bg-slate-950/55
                     max-[414px]:p-3 max-[320px]:p-2"
            >
              <div
                class="w-full max-w-xs rounded-2xl
                       border border-slate-200 bg-white/95
                       p-5 text-center shadow-xl
                       dark:border-slate-700 dark:bg-slate-900/95
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
                  {{ formatSignalPrice(signal) }}
                </h4>

                <p
                  class="mt-2 text-sm leading-6
                         text-slate-600 dark:text-slate-400"
                >
                  Pay once to unlock this signal’s chart,
                  confirmed direction, and full technical
                  analysis. Each new signal requires a
                  separate purchase.
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
                      : 'Buy this signal'
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