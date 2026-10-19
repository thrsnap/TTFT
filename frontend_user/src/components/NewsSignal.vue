<script setup>
import {
  nextTick,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'

const IS_DAILY = false
const RESOURCE = IS_DAILY ? 'daily-signals' : 'signals'
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
const chartDialog = ref(null)
const enlargedChart = ref(null)
const subscription = ref({ active: false, expiresAt: null })
const showSubscriptionNotice = ref(false)
const monthlyAmount = ref(25)
const currentTime = ref(Date.now())

const abortController = new AbortController()
const imageTimers = new Map()
let loadingRequest = false
let refreshPending = false
let hasLoaded = false
let active = false
let lastRefreshAttempt = 0
let refreshTimer
let updateTimer
let expiryTimer
let subscriptionNoticeTimer

watch(
  () => subscription.value.active
    ? subscription.value.expiresAt || 'active'
    : '',
  value => {
    window.clearTimeout(subscriptionNoticeTimer)
    showSubscriptionNotice.value = Boolean(value)
    if (value) {
      subscriptionNoticeTimer = window.setTimeout(() => {
        showSubscriptionNotice.value = false
      }, 5000)
    }
  },
)

async function openChart(signal) {
  if (!signal.hasAccess || !signal.imageSrc || signal.imageError) return
  enlargedChart.value = {
    id: signal._id,
    src: signal.imageSrc,
    alt: `${signal.pair} technical analysis chart`,
  }
  await nextTick()
  if (enlargedChart.value && !chartDialog.value?.open) {
    chartDialog.value?.showModal()
  }
}

function closeChart() {
  chartDialog.value?.close()
  enlargedChart.value = null
}

function syncOpenChart() {
  if (!enlargedChart.value) return
  const signal = signals.value.find(
    item => item._id === enlargedChart.value.id,
  )
  if (!signal?.hasAccess || !signal.imageSrc) {
    closeChart()
    return
  }
  enlargedChart.value = {
    id: signal._id,
    src: signal.imageSrc,
    alt: `${signal.pair} technical analysis chart`,
  }
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
    ...(IS_DAILY ? { weekday: 'long' } : {}),
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

function timeAgo(value) {
  const date = validDate(value)
  if (!date) return ''
  const seconds = Math.max(
    0, Math.floor((currentTime.value - date.getTime()) / 1000),
  )
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

function isSignalReleased(signal) {
  if (typeof signal.isReleased === 'boolean') return signal.isReleased
  const hasDetails = signal.hasDetails === true || (
    typeof signal.details === 'string' && signal.details.trim().length > 0
  )
  const hasImage = signal.hasImage === true || Boolean(signal.imageSrc)
  return hasDetails && hasImage
}

function hasConfirmedDirection(signal) {
  return signal.hasAccess && signal.confirmed === true &&
    ['buy', 'sell'].includes(signal.direction)
}

function formatSignalPrice(signal) {
  const amount = Number(monthlyAmount.value)
  if (!Number.isFinite(amount) || amount < 0) return 'Price not available'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: signal?.currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

async function goToPurchase(signal = {}) {
  if (checkingPurchase.value || abortController.signal.aborted) return
  purchaseError.value = ''
  if (subscription.value.active) {
    await loadSignals(true)
    return
  }
  const signalId = String(signal?._id || 'news-plan')
  checkingPurchase.value = true
  purchasingSignalId.value = signalId
  // One News plan covers every News Signal, including new cards.
  const paymentLocation = {
    path: localizedPath('/payment'),
    query: { productId: 'news-signal-monthly' },
  }
  const paymentDestination = router.resolve(paymentLocation).fullPath
  try {
    const response = await fetch(`${BASE}/api/auth/me`, {
      credentials: 'include',
      cache: 'no-store',
      signal: abortController.signal,
    })
    if (response.status === 401) {
      await router.push({
        path: localizedPath('/login'),
        query: { redirect: paymentDestination },
      })
      return
    }
    if (!response.ok) {
      throw new Error('Unable to check your account. Please try again.')
    }
    await router.push(paymentLocation)
  } catch (err) {
    if (err.name !== 'AbortError') {
      purchaseError.value = err.message || 'Unable to continue. Please try again.'
    }
  } finally {
    checkingPurchase.value = false
    purchasingSignalId.value = ''
  }
}

function clearImages() {
  imageTimers.forEach(timer => window.clearTimeout(timer))
  imageTimers.clear()
}

function finishImageLoading(signal) {
  const id = String(signal._id)
  const timer = imageTimers.get(id)
  if (timer !== undefined) window.clearTimeout(timer)
  imageTimers.delete(id)
  signal.imageLoading = false
}

function isCurrentImage(signal, event) {
  const src = event?.target?.currentSrc
  if (!src) return true
  return Boolean(signal.imageSrc) &&
    src === new URL(signal.imageSrc, window.location.href).href
}

function handleImageLoaded(signal, event) {
  if (!isCurrentImage(signal, event)) return
  finishImageLoading(signal)
  signal.imageError = false
  signal.imageErrorMessage = ''
}

function handleImageError(signal, event) {
  if (!isCurrentImage(signal, event)) return
  finishImageLoading(signal)
  signal.imageError = true
  signal.imageErrorMessage = 'Unable to display the chart. Please retry.'
  signal.imageSrc = ''
  syncOpenChart()
}

function imageVersion(signal) {
  // The API must update one of these when an admin replaces a chart.
  return String(
    signal.imageUpdatedAt || signal.updatedAt || signal.createdAt || '1',
  )
}

function loadImage(signal, force = false) {
  if (signal.hasImage === false || abortController.signal.aborted) return
  finishImageLoading(signal)
  signal.imageError = false
  signal.imageErrorMessage = ''
  signal.imageLoading = true
  const endpoint = signal.hasAccess ? 'image' : 'preview'
  const version = encodeURIComponent(imageVersion(signal))
  // Only the manual Retry button forces a new URL for the same version.
  const retry = force ? `&retry=${Date.now()}` : ''
  const src = `${BASE}/api/${RESOURCE}/${encodeURIComponent(signal._id)}` +
    `/${endpoint}?v=${version}${retry}`
  signal.imageSrc = src
  imageTimers.set(String(signal._id), window.setTimeout(() => {
    if (signal.imageSrc !== src) return
    imageTimers.delete(String(signal._id))
    signal.imageLoading = false
    signal.imageError = true
    signal.imageErrorMessage = 'Chart loading timed out. Please retry.'
    signal.imageSrc = ''
    syncOpenChart()
  }, 20_000))
}

function syncSignals(incoming) {
  const existing = new Map(
    signals.value.map(signal => [String(signal._id), signal]),
  )
  const imagesToLoad = new Set()
  const seen = new Set()
  const nextSignals = incoming
    .filter(signal => {
      if (!signal || typeof signal !== 'object') return false
      const id = String(signal._id || '')
      if (!/^[a-fA-F0-9]{24}$/.test(id) || seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map(raw => {
      const id = String(raw._id)
      const previous = existing.get(id)
      const hasAccess = raw.hasAccess === true
      const keepImage = previous &&
        previous.hasAccess === hasAccess &&
        previous.hasImage === raw.hasImage &&
        imageVersion(previous) === imageVersion(raw)
      const normalized = {
        ...raw,
        _id: id,
        scheduledAt: dateTimeValue(raw.scheduledAt) || null,
        hasAccess,
        details: hasAccess ? String(raw.details || '') : '',
        news: hasAccess ? String(raw.news || '') : '',
        direction: hasAccess && typeof raw.direction === 'string'
          ? raw.direction.trim().toLowerCase()
          : '',
        confirmed: hasAccess && raw.confirmed === true,
      }
      // Image UI state belongs to this component, never to API response data.
      for (const key of [
        'imageSrc', 'imageLoading', 'imageError', 'imageErrorMessage',
      ]) delete normalized[key]

      if (previous) {
        if (!keepImage) finishImageLoading(previous)
        Object.assign(previous, normalized)
        // Explicitly clear optional version fields absent from the new response.
        previous.imageUpdatedAt = raw.imageUpdatedAt
        previous.updatedAt = raw.updatedAt
        previous.createdAt = raw.createdAt
        if (!keepImage) {
          Object.assign(previous, {
            imageSrc: '', imageLoading: false,
            imageError: false, imageErrorMessage: '',
          })
          imagesToLoad.add(id)
        }
        existing.delete(id)
        return previous
      }
      imagesToLoad.add(id)
      return {
        ...normalized,
        imageSrc: '', imageLoading: false,
        imageError: false, imageErrorMessage: '',
      }
    })

  existing.forEach(finishImageLoading)
  signals.value = nextSignals
  signals.value.forEach(signal => {
    if (imagesToLoad.has(signal._id)) loadImage(signal)
  })
  syncOpenChart()
}

function scheduleExpiryCheck() {
  window.clearTimeout(expiryTimer)
  if (!subscription.value.active) return
  const expiry = validDate(subscription.value.expiresAt)
  if (!expiry) return
  const remaining = expiry.getTime() - Date.now()
  if (remaining <= 0) {
    subscription.value.active = false
    clearImages()
    signals.value.forEach(signal => {
      signal.hasAccess = false
      signal.details = ''
      signal.news = ''
      signal.direction = ''
      signal.confirmed = false
      signal.imageSrc = ''
      signal.imageLoading = false
      signal.imageError = false
      signal.imageErrorMessage = ''
      if (signal.hasImage !== false) loadImage(signal)
    })
    closeChart()
    return
  }
  expiryTimer = window.setTimeout(() => {
    scheduleExpiryCheck()
    if (active) void loadSignals(true)
  }, Math.min(remaining, 86_400_000))
}

async function loadSignals(background = false) {
  if (abortController.signal.aborted) return
  if (loadingRequest) {
    refreshPending = true
    return
  }
  loadingRequest = true
  lastRefreshAttempt = Date.now()
  // A background refresh never removes the existing cards.
  if (!hasLoaded) loading.value = true
  if (!background || !hasLoaded) error.value = ''
  try {
    const response = await fetch(`${BASE}/api/${RESOURCE}`, {
      credentials: 'include',
      cache: 'no-store',
      signal: abortController.signal,
    })
    if (!response.ok) throw new Error('Unable to load signals. Please try again.')
    const data = await response.json()
    if (!Array.isArray(data.signals)) throw new Error('Invalid signal response.')
    if (abortController.signal.aborted) return

    {
      subscription.value = {
        active: data.subscription?.active === true,
        expiresAt: data.subscription?.expiresAt || null,
      }
      if (Number.isFinite(data.plan?.amount)) {
        monthlyAmount.value = data.plan.amount
      }
    }
    syncSignals(data.signals)
    scheduleExpiryCheck()
    hasLoaded = true
    error.value = ''
  } catch (err) {
    if (err.name !== 'AbortError' && (!background || !hasLoaded)) {
      error.value = err.message || 'Unable to load signals.'
    }
  } finally {
    loadingRequest = false
    if (!abortController.signal.aborted) {
      loading.value = false
      if (refreshPending && active) {
        refreshPending = false
        void loadSignals(true)
      } else {
        refreshPending = false
      }
    }
  }
}

function refreshVisibleSignals() {
  if (!active || document.visibilityState !== 'visible') return
  // Focus and visibilitychange can fire together when returning to a tab.
  if (Date.now() - lastRefreshAttempt < 1000) return
  void loadSignals(true)
}

function startRefresh() {
  if (active) return
  active = true
  currentTime.value = Date.now()
  window.addEventListener('focus', refreshVisibleSignals)
  document.addEventListener('visibilitychange', refreshVisibleSignals)
  refreshTimer = window.setInterval(refreshVisibleSignals, 60_000)
  if (IS_DAILY) {
    updateTimer = window.setInterval(() => {
      currentTime.value = Date.now()
    }, 15_000)
  }
}

function stopRefresh() {
  active = false
  window.removeEventListener('focus', refreshVisibleSignals)
  document.removeEventListener('visibilitychange', refreshVisibleSignals)
  window.clearInterval(refreshTimer)
  window.clearInterval(updateTimer)
}

watch(
  () => route.query.paymentReturn,
  (value, previous) => {
    if (value && value !== previous) void loadSignals(true)
  },
)

onMounted(() => {
  startRefresh()
  void loadSignals()
})

onActivated(() => {
  // onActivated also runs on initial mount under KeepAlive.
  if (active) return
  startRefresh()
  scheduleExpiryCheck()
  void loadSignals(true)
})

onDeactivated(() => {
  stopRefresh()
  closeChart()
})

onUnmounted(() => {
  stopRefresh()
  refreshPending = false
  abortController.abort()
  window.clearTimeout(subscriptionNoticeTimer)
  window.clearTimeout(expiryTimer)
  clearImages()
  closeChart()
})
</script>

<template>
  <section class="w-full min-w-0 text-(--text-color)">
    <div class="mx-auto w-full min-w-0 max-w-sm">
      <div class="mb-4 lg:min-h-32">
        <span class="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
          NEWS TECHNICAL ANALYSIS
        </span>
        <h2 class="mt-3 text-xl font-bold sm:text-2xl">News Signals</h2>
        <p class="mt-2 max-w-full break-words text-sm leading-6 text-(--muted-color)">
          One monthly subscription covers all CPI, NFP, FOMC, PPI and other News Signals.
        </p>
      </div>



      <div v-if="subscription.active && showSubscriptionNotice" role="status" class="mb-6 rounded-xl border border-emerald-300 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
        <p class="font-bold">News Signal subscription active</p>
        <p class="mt-1">Access to all News Signals until {{ formatDate(subscription.expiresAt) }}.</p>
      </div>

      <p v-if="purchaseError" role="alert" class="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
        {{ purchaseError }}
      </p>

      <!-- Only displayed during the initial fetch. -->
      <div v-if="loading" role="status" aria-label="Loading signals" class="grid w-full min-w-0 grid-cols-1 gap-5">
        <span class="sr-only">Loading signals…</span>
        <div aria-hidden="true" class="min-w-0 overflow-hidden rounded-2xl border border-(--border-color) bg-(--surface-bg) shadow-sm">
          <div class="animate-pulse motion-reduce:animate-none">
            <div class="border-b border-(--border-color) p-4 max-[320px]:p-3">
              <div class="flex items-center justify-between gap-3">
                <div class="h-8 w-20 rounded-lg bg-slate-400/30"></div>
                <div class="h-7 w-32 rounded-full bg-slate-400/30"></div>
              </div>
              <div class="mt-4 h-5 w-4/5 rounded bg-slate-400/30"></div>
              <div class="mt-3 h-3 w-24 rounded bg-slate-400/30"></div>
              <div class="mt-3 min-h-24 space-y-3 rounded-xl border border-(--border-color) bg-(--page-bg) p-3">
                <div class="h-3 w-28 rounded bg-slate-400/30"></div>
                <div class="h-4 w-4/5 rounded bg-slate-400/30"></div>
                <div class="h-3 w-1/2 rounded bg-slate-400/30"></div>
              </div>
            </div>
            <div class="aspect-video w-full bg-slate-400/30"></div>
            <div class="space-y-3 p-4 max-[320px]:p-3">
              <div class="h-4 w-20 rounded bg-slate-400/30"></div>
              <div class="h-3 w-full rounded bg-slate-400/30"></div>
              <div class="h-3 w-full rounded bg-slate-400/30"></div>
              <div class="h-3 w-3/4 rounded bg-slate-400/30"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="error" role="alert" class="rounded-xl bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-300">
        <p>{{ error }}</p>
        <button type="button" class="mt-3 cursor-pointer font-semibold underline" @click="loadSignals()">
          Try again
        </button>
      </div>

      <div v-else-if="signals.length === 0" class="rounded-2xl border border-(--border-color) bg-(--surface-bg) p-6 text-center">
        <h3 class="text-xl font-bold">Next News Signal — Coming soon</h3>
        <p class="mt-3 text-2xl font-bold text-amber-600 dark:text-amber-300">{{ formatSignalPrice() }} / month</p>
        <p class="mt-3 text-sm leading-6 text-(--muted-color)">Previous released signals are in history below. Admin will publish the next chart here. Your active News subscription includes new cards.</p>
        <button v-if="!subscription.active" type="button" :disabled="checkingPurchase" class="mt-5 min-h-11 w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60" @click="goToPurchase()">
          {{ checkingPurchase ? 'Please wait…' : 'Subscribe to News Signals' }}
        </button>
      </div>

      <div v-else class="grid w-full min-w-0 grid-cols-1 gap-5">
        <article v-for="signal in signals" :key="signal._id" class="min-w-0 overflow-hidden rounded-2xl border border-(--border-color) bg-(--surface-bg) shadow-sm" data-signal-card>
          <div data-signal-card-content class="min-w-0">
            <header class="border-b border-(--border-color) p-4 max-[320px]:p-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <span class="rounded-lg bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                  {{ signal.pair }}
                </span>
                <span role="status" class="inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold" :class="isSignalReleased(signal) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300'">
                  <span class="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                    <span v-if="!isSignalReleased(signal)" class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none"></span>
                    <span class="relative inline-flex h-2.5 w-2.5 rounded-full" :class="isSignalReleased(signal) ? 'bg-emerald-500' : 'bg-red-500'"></span>
                  </span>
                  <span>{{ isSignalReleased(signal) ? 'Signal Released' : 'Coming soon' }}</span>
                </span>
              </div>

              <h3 class="mt-3 min-h-7 break-words text-base font-bold">{{ signal.title }}</h3>
              <p class="mt-2 text-xs font-medium text-(--muted-color)">by Thun Tula</p>

              <div class="mt-3 min-h-24 rounded-xl border border-(--border-color) bg-(--page-bg) p-3">
                <p class="mb-2 text-xs font-semibold text-(--muted-color)">News date and time</p>
                <time v-if="signal.scheduledAt" :datetime="signal.scheduledAt" class="block break-words text-sm font-semibold text-(--text-color)">
                  {{ formatDate(signal.scheduledAt) }}, {{ formatTime(signal.scheduledAt) }}
                </time>
                <p v-else class="text-sm text-(--muted-color)">Date and time not announced.</p>
                <span v-if="signal.newsType" class="mt-1 inline-flex max-w-full break-words rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                  {{ signal.newsType }}
                </span>
              </div>
            </header>

            <div class="relative overflow-hidden" :class="!signal.hasAccess ? 'min-h-[328px]' : ''">
              <div :class="!signal.hasAccess ? 'pointer-events-none select-none' : ''" :aria-hidden="!signal.hasAccess ? 'true' : undefined" :inert="!signal.hasAccess">
                <div class="relative flex aspect-video items-center justify-center overflow-hidden bg-(--input-bg)">
                  <img
                    v-if="signal.imageSrc"
                    :src="signal.imageSrc"
                    crossorigin="use-credentials"
                    :alt="signal.hasAccess ? `${signal.pair} technical analysis chart` : ''"
                    class="h-full w-full object-contain"
                    :class="!signal.hasAccess ? 'scale-105 blur-sm' : 'cursor-zoom-in'"
                    :role="signal.hasAccess ? 'button' : undefined"
                    :tabindex="signal.hasAccess ? 0 : undefined"
                    :aria-label="signal.hasAccess ? 'Enlarge chart' : undefined"
                    @load="handleImageLoaded(signal, $event)"
                    @error="handleImageError(signal, $event)"
                    @click="openChart(signal)"
                    @keydown.enter.prevent="openChart(signal)"
                    @keydown.space.prevent="openChart(signal)"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-(--input-bg) via-(--surface-bg) to-(--hover-bg)">
                    <div v-if="signal.hasAccess" class="px-4 text-center text-sm text-(--muted-color)">
                      <p role="status">
                        {{ signal.imageError
                          ? signal.imageErrorMessage || 'Image unavailable.'
                          : signal.hasImage === false
                            ? 'Chart will be added soon.'
                            : 'Loading chart…' }}
                      </p>
                      <button v-if="signal.imageError" type="button" :disabled="signal.imageLoading" class="mt-3 min-h-11 rounded-lg border border-(--border-color) px-4 py-2 font-semibold text-(--text-color) disabled:opacity-50" @click="loadImage(signal, true)">
                        Retry chart
                      </button>
                    </div>
                  </div>

                  <span v-if="hasConfirmedDirection(signal)" class="absolute right-3 top-3 z-10 rounded-lg px-3 py-2 text-xs font-bold shadow-sm" :class="signal.direction === 'buy' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'">
                    Confirmed {{ signal.direction.toUpperCase() }}
                  </span>
                </div>

                <p v-if="signal.hasAccess && signal.imageSrc" class="px-3 pt-2 text-xs text-(--muted-color)">Click the chart to enlarge</p>
                <div class="min-h-32 p-3 max-[320px]:p-3" :class="!signal.hasAccess ? 'blur-sm' : ''">
                  <h4 class="text-sm font-bold underline">Note:</h4>
                  <p class="mt-3 whitespace-pre-line break-words text-sm font-bold leading-6 text-slate-900 dark:text-slate-100">
                    {{ signal.hasAccess ? signal.details : signal.previewText }}
                  </p>
                  <template v-if="signal.hasAccess && signal.news">
                    <h4 class="mt-5 text-sm font-bold">Related news</h4>
                    <p class="mt-2 whitespace-pre-line break-words text-sm leading-6 text-(--muted-color)">{{ signal.news }}</p>
                  </template>
                </div>
              </div>

              <div v-if="!signal.hasAccess" class="absolute inset-0 flex items-center justify-center bg-(--surface-bg)/45 p-4 max-[414px]:p-3 max-[320px]:p-2">
                <div class="flex min-h-[264px] w-full max-w-xs flex-col rounded-xl border border-(--border-color) bg-(--surface-bg)/95 p-3 text-center shadow-xl max-[480px]:p-4 max-[320px]:p-3">
                  <svg class="mx-auto h-9 w-9 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <rect x="5" y="10" width="14" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    <path d="M12 14v3" />
                  </svg>
                  <h4 class="mt-2 text-xl font-bold text-amber-600 dark:text-amber-300">{{ formatSignalPrice(signal) }} /month</h4>
                  <p class="mt-2 min-h-20 flex-1 text-xs leading-5 text-(--muted-color)">Pay once to unlock every News Signal’s chart, confirmed direction, and full analysis for one calendar month. New cards are included until your subscription expires.</p>
                  <button type="button" :disabled="checkingPurchase" :aria-busy="checkingPurchase && purchasingSignalId === signal._id" class="mt-3 min-h-11 w-full cursor-pointer rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500" @click="goToPurchase(signal)">
                    {{ checkingPurchase && purchasingSignalId === signal._id ? 'Please wait…' : 'Buy News Signal' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>

    <dialog ref="chartDialog" class="m-auto max-h-[94dvh] w-[96vw] max-w-6xl overflow-auto rounded-xl border border-slate-600 bg-slate-900 p-3 text-white backdrop:bg-black/80" @click.self="closeChart" @close="enlargedChart = null">
      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="text-sm font-semibold">{{ enlargedChart?.alt }}</p>
        <button type="button" autofocus class="min-h-11 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold" @click="closeChart">Close</button>
      </div>
      <img v-if="enlargedChart" :src="enlargedChart.src" crossorigin="use-credentials" :alt="enlargedChart.alt" class="mx-auto h-auto max-h-[80dvh] max-w-full object-contain" />
    </dialog>
  </section>
</template>
