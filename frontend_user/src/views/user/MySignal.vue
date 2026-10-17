<script setup>
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')

const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const newsSignals = ref([])
const dailySignals = ref([])

const subscription = ref({
  active: false,
  expiresAt: null,
})

const currentTime = ref(Date.now())
const chartDialog = ref(null)
const enlargedChart = ref(null)

const controller = new AbortController()

let pending = false
let refreshTimer
let clockTimer

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

  if (!date) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDailyDate(value) {
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

  const seconds = Math.max(
    0,
    Math.floor((currentTime.value - date.getTime()) / 1000),
  )

  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)

  if (hours < 24) return `${hours} hr ago`

  const days = Math.floor(hours / 24)

  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

const dailyActive = computed(() => {
  if (subscription.value.active !== true) return false

  if (!subscription.value.expiresAt) return true

  const expiresAt = validDate(subscription.value.expiresAt)

  return Boolean(
    expiresAt && expiresAt.getTime() > currentTime.value,
  )
})

const groups = computed(() => [
  {
    key: 'news',
    title: 'News Signals',
    signals: newsSignals.value,
    empty: 'No unlocked News Signals to display.',
  },
  {
    key: 'daily',
    title: 'Daily Signals',
    signals: dailyActive.value ? dailySignals.value : [],
    empty: dailyActive.value
      ? 'Your access is active. No Daily Signals are available yet.'
      : 'No active Daily Signal access.',
  },
])

function imageUrl(type, id, signal) {
  const endpoint = type === 'daily'
    ? 'daily-signals'
    : 'signals'

  const version = signal.imageUpdatedAt ||
    signal.updatedAt ||
    'current'

  return `${BASE}/api/${endpoint}/${encodeURIComponent(id)}/image?v=${encodeURIComponent(version)}`
}

function normalizeSignals(records, type) {
  if (!Array.isArray(records)) return []

  const previousSignals = type === 'daily'
    ? dailySignals.value
    : newsSignals.value

  const previousById = new Map(
    previousSignals.map(signal => [signal._id, signal]),
  )

  return records
    .filter(signal =>
      signal &&
      signal.hasAccess === true &&
      /^[a-fA-F0-9]{24}$/.test(
        String(signal._id || signal.id || ''),
      ),
    )
    .map(signal => {
      const id = String(signal._id || signal.id)
      const previous = previousById.get(id)

      const imageSrc = signal.hasImage === true
        ? imageUrl(type, id, signal)
        : ''

      const unchangedImage = Boolean(
        previous && previous.imageSrc === imageSrc,
      )

      return {
        ...signal,
        _id: id,
        type,
        key: `${type}:${id}`,
        scheduledAt: dateTimeValue(signal.scheduledAt) || null,
        updatedAt: dateTimeValue(signal.updatedAt) || null,
        direction: String(signal.direction || '').toLowerCase(),
        details: String(signal.details || ''),
        news: String(signal.news || ''),
        imageSrc,
        imageLoading: unchangedImage
          ? previous.imageLoading
          : Boolean(imageSrc),
        imageError: unchangedImage
          ? previous.imageError
          : false,
      }
    })
}

async function request(path) {
  const response = await fetch(`${BASE}/api${path}`, {
    credentials: 'include',
    cache: 'no-store',
    signal: controller.signal,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.message || `Unable to load ${path}.`,
    )
  }

  return data
}

async function loadSignals() {
  if (pending || controller.signal.aborted) return

  pending = true
  refreshing.value = true
  error.value = ''

  try {
    const [newsResult, dailyResult] = await Promise.allSettled([
      request('/signals/my'),
      request('/daily-signals'),
    ])

    if (controller.signal.aborted) return

    const failures = []

    if (newsResult.status === 'fulfilled') {
      newsSignals.value = normalizeSignals(
        newsResult.value.signals,
        'news',
      )
    } else {
      newsSignals.value = []

      failures.push(
        newsResult.reason?.message ||
          'Unable to load News Signals.',
      )
    }

    if (dailyResult.status === 'fulfilled') {
      subscription.value = {
        active: dailyResult.value.subscription?.active === true,
        expiresAt: dailyResult.value.subscription?.expiresAt || null,
      }

      currentTime.value = Date.now()

      dailySignals.value = dailyActive.value
        ? normalizeSignals(dailyResult.value.signals, 'daily')
        : []
    } else {
      subscription.value = {
        active: false,
        expiresAt: null,
      }

      dailySignals.value = []

      failures.push(
        dailyResult.reason?.message ||
          'Unable to load Daily Signals.',
      )
    }

    error.value = failures.join(' ')
  } catch (failure) {
    if (!controller.signal.aborted) {
      error.value = failure?.message || 'Unable to load signals.'
    }
  } finally {
    pending = false

    if (!controller.signal.aborted) {
      loading.value = false
      refreshing.value = false
    }
  }
}

function confirmedDirection(signal) {
  return signal.confirmed === true &&
    ['buy', 'sell'].includes(signal.direction)
}

function imageLoaded(signal) {
  signal.imageLoading = false
  signal.imageError = false
}

function imageFailed(signal) {
  signal.imageLoading = false
  signal.imageError = true
}

function retryImage(signal) {
  signal.imageError = false
  signal.imageLoading = true

  signal.imageSrc = imageUrl(signal.type, signal._id, {
    updatedAt: Date.now(),
  })
}

async function openChart(signal) {
  if (
    signal.imageError ||
    signal.imageLoading ||
    !signal.imageSrc
  ) {
    return
  }

  enlargedChart.value = {
    key: signal.key,
    src: signal.imageSrc,
    alt: `${signal.pair} technical analysis chart`,
  }

  await nextTick()

  if (!controller.signal.aborted && !chartDialog.value?.open) {
    chartDialog.value?.showModal()
  }
}

function closeChart() {
  chartDialog.value?.close()
  enlargedChart.value = null
}

watch(
  () => groups.value.flatMap(group =>
    group.signals.map(signal => signal.key),
  ),
  keys => {
    if (
      enlargedChart.value &&
      !keys.includes(enlargedChart.value.key)
    ) {
      closeChart()
    }
  },
)

watch(dailyActive, active => {
  if (!active) dailySignals.value = []
})

function refreshVisible() {
  if (document.visibilityState === 'visible') {
    currentTime.value = Date.now()
    void loadSignals()
  }
}

onMounted(() => {
  void loadSignals()

  refreshTimer = window.setInterval(refreshVisible, 60_000)

  clockTimer = window.setInterval(() => {
    currentTime.value = Date.now()
  }, 1000)

  window.addEventListener('focus', refreshVisible)
  document.addEventListener('visibilitychange', refreshVisible)
})

onUnmounted(() => {
  controller.abort()

  window.clearInterval(refreshTimer)
  window.clearInterval(clockTimer)

  window.removeEventListener('focus', refreshVisible)
  document.removeEventListener('visibilitychange', refreshVisible)

  closeChart()
})
</script>

<template>
  <main
    class="w-full min-w-0 space-y-8 p-4
           text-slate-900 sm:p-6 lg:p-8 dark:text-slate-100"
  >
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0">
        <h2 class="text-2xl font-semibold">
          My Signal
        </h2>

        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your unlocked charts and trading analysis.
        </p>
      </div>

      <button
        type="button"
        :disabled="refreshing"
        class="cursor-pointer rounded-xl border border-slate-200
               bg-white px-4 py-2.5 text-sm font-semibold
               transition hover:border-emerald-500
               focus-visible:outline-2
               focus-visible:outline-emerald-500
               disabled:cursor-wait disabled:opacity-50
               dark:border-white/10 dark:bg-[#111c2d]"
        @click="loadSignals"
      >
        {{ refreshing ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>

    <p
      v-if="loading"
      role="status"
      class="text-sm text-slate-500 dark:text-slate-400"
    >
      Loading your signals…
    </p>

    <div
      v-if="error"
      role="alert"
      class="rounded-xl border border-red-500/20
             bg-red-500/10 p-4 text-sm
             text-red-700 dark:text-red-300"
    >
      {{ error }}
    </div>

    <template v-if="!loading">
      <section
        v-for="group in groups"
        :key="group.key"
        :aria-labelledby="`${group.key}-signals-title`"
        class="min-w-0 space-y-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3
            :id="`${group.key}-signals-title`"
            class="text-lg font-semibold"
          >
            {{ group.title }}
          </h3>

          <span
            v-if="group.key === 'daily'"
            class="rounded-full px-3 py-1 text-xs font-semibold"
            :class="
              dailyActive
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-200 text-slate-600 dark:bg-white/5 dark:text-slate-300'
            "
          >
            {{ dailyActive ? 'Active access' : 'No active access' }}
          </span>
        </div>

        <p
          v-if="
            group.key === 'daily' &&
            dailyActive &&
            subscription.expiresAt
          "
          class="text-sm text-slate-500 dark:text-slate-400"
        >
          Access until {{ formatDate(subscription.expiresAt) }}.
        </p>

        <div
          v-if="!group.signals.length"
          class="rounded-2xl border border-slate-200
                 bg-white p-5 dark:border-white/10 dark:bg-[#111c2d]"
        >
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ group.empty }}
          </p>

          <RouterLink
            :to="localizedPath('/signal')"
            class="mt-3 inline-block text-sm font-semibold
                   text-emerald-700 hover:underline
                   dark:text-emerald-300"
          >
            Browse signals →
          </RouterLink>
        </div>

        <div
          v-else
          class="grid grid-cols-1 items-start gap-6
                 md:grid-cols-2 2xl:grid-cols-3"
        >
          <article
            v-for="signal in group.signals"
            :key="signal.key"
            class="w-full min-w-0 max-w-sm justify-self-center
                   overflow-hidden rounded-2xl
                   border border-slate-200 bg-white shadow-sm
                   dark:border-white/10 dark:bg-[#111c2d]"
          >
            <header
              class="border-b border-slate-200 p-4 dark:border-white/10"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span
                  class="rounded-lg bg-amber-100 px-3 py-1
                         text-sm font-bold text-amber-800
                         dark:bg-amber-400/10 dark:text-amber-300"
                >
                  {{ signal.pair }}
                </span>

                <span
                  role="status"
                  class="inline-flex items-center gap-2 rounded-full
                         px-2.5 py-1.5 text-xs font-semibold"
                  :class="
                    signal.isReleased
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-500/10 text-red-700 dark:text-red-300'
                  "
                >
                  <span
                    v-if="!signal.isReleased"
                    aria-hidden="true"
                    class="relative flex size-2.5 shrink-0"
                  >
                    <span
                      class="absolute inline-flex h-full w-full
                             animate-ping rounded-full bg-red-500
                             opacity-60 motion-reduce:animate-none"
                    />

                    <span
                      class="relative inline-flex size-2.5
                             rounded-full bg-red-500"
                    />
                  </span>

                  {{
                    signal.isReleased
                      ? 'Signal Released'
                      : 'Signal Coming Soon'
                  }}
                </span>
              </div>

              <h4 class="mt-3 break-words text-base font-bold">
                {{ signal.title }}
              </h4>

              <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                by Thun Tula
              </p>

              <div
                class="mt-3 min-h-24 rounded-xl
                       border border-slate-200 bg-slate-50 p-3
                       dark:border-white/10 dark:bg-white/[0.03]"
              >
                <template v-if="group.key === 'daily'">
                  <div
                    class="flex flex-wrap items-center
                           justify-between gap-2"
                  >
                    <p
                      class="text-xs font-semibold
                             text-slate-500 dark:text-slate-400"
                    >
                      Signal date For
                    </p>

                    <time
                      v-if="validDate(signal.updatedAt)"
                      :datetime="signal.updatedAt"
                      :title="formatDate(signal.updatedAt)"
                      class="ml-auto text-right text-xs
                             text-slate-500 dark:text-slate-400"
                    >
                      Updated {{ timeAgo(signal.updatedAt) }}
                    </time>
                  </div>

                  <time
                    v-if="signal.scheduledAt"
                    :datetime="signal.scheduledAt"
                    class="mt-2 block break-words
                           text-sm font-semibold"
                  >
                    {{ formatDailyDate(signal.scheduledAt) }}
                  </time>

                  <p
                    v-else
                    class="mt-2 text-sm
                           text-slate-500 dark:text-slate-400"
                  >
                    Date not announced.
                  </p>
                </template>

                <template v-else>
                  <p
                    class="text-xs text-slate-500 dark:text-slate-400"
                  >
                    Signal date
                  </p>

                  <p class="mt-2 break-words text-sm font-semibold">
                    {{ formatDate(signal.scheduledAt) }}
                  </p>
                </template>

                <span
                  v-if="signal.newsType"
                  class="mt-2 inline-block max-w-full break-words
                         rounded-md bg-blue-100 px-2 py-1
                         text-xs font-semibold text-blue-700
                         dark:bg-blue-400/10 dark:text-blue-300"
                >
                  {{ signal.newsType }}
                </span>
              </div>
            </header>

            <div
              class="relative flex aspect-video items-center
                     justify-center bg-slate-100 dark:bg-slate-950/50"
            >
              <button
                v-if="signal.imageSrc && !signal.imageError"
                type="button"
                :disabled="signal.imageLoading"
                :aria-label="`Enlarge ${signal.pair} chart`"
                class="h-full w-full cursor-zoom-in
                       focus-visible:outline-2
                       focus-visible:outline-emerald-500
                       disabled:cursor-wait"
                @click="openChart(signal)"
              >
                <img
                  :src="signal.imageSrc"
                  :alt="`${signal.pair} technical analysis chart`"
                  crossorigin="use-credentials"
                  class="h-full w-full object-contain"
                  @load="imageLoaded(signal)"
                  @error="imageFailed(signal)"
                />
              </button>

              <div
                v-if="
                  !signal.imageSrc ||
                  signal.imageError ||
                  signal.imageLoading
                "
                class="absolute inset-0 flex flex-col items-center
                       justify-center gap-3 bg-slate-100 p-4
                       text-center text-sm text-slate-500
                       dark:bg-[#101827] dark:text-slate-400"
              >
                <p role="status">
                  {{
                    signal.imageError
                      ? 'Unable to load the chart.'
                      : signal.imageLoading
                        ? 'Loading chart…'
                        : 'Chart will be added soon.'
                  }}
                </p>

                <button
                  v-if="signal.imageError"
                  type="button"
                  class="cursor-pointer rounded-lg border
                         border-slate-300 px-3 py-2 font-semibold
                         dark:border-white/10"
                  @click="retryImage(signal)"
                >
                  Retry chart
                </button>
              </div>

              <span
                v-if="confirmedDirection(signal)"
                class="absolute top-3 right-3 rounded-lg
                       px-3 py-2 text-xs font-bold shadow-sm"
                :class="
                  signal.direction === 'buy'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                "
              >
                Confirmed {{ signal.direction.toUpperCase() }}
              </span>
            </div>

            <div class="p-4">
              <p
                v-if="
                  signal.imageSrc &&
                  !signal.imageError &&
                  !signal.imageLoading
                "
                class="mb-4 text-xs text-slate-500 dark:text-slate-400"
              >
                Click the chart to enlarge.
              </p>

              <h5 class="text-sm font-bold underline">
                Note:
              </h5>

              <p
                class="mt-3 whitespace-pre-line break-words
                       text-sm font-medium leading-6"
              >
                {{ signal.details || 'Analysis will be added soon.' }}
              </p>

              <template v-if="signal.news">
                <h5 class="mt-5 text-sm font-bold">
                  Related news
                </h5>

                <p
                  class="mt-2 whitespace-pre-line break-words
                         text-sm leading-6
                         text-slate-600 dark:text-slate-300"
                >
                  {{ signal.news }}
                </p>
              </template>
            </div>
          </article>
        </div>
      </section>
    </template>

    <dialog
      ref="chartDialog"
      aria-label="Enlarged signal chart"
      class="m-auto max-h-[94dvh] w-[96vw] max-w-6xl
             overflow-auto rounded-xl border border-slate-600
             bg-slate-900 p-3 text-white backdrop:bg-black/80"
      @click.self="closeChart"
      @close="enlargedChart = null"
    >
      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="text-sm font-semibold">
          {{ enlargedChart?.alt }}
        </p>

        <button
          type="button"
          autofocus
          class="min-h-11 shrink-0 cursor-pointer rounded-lg
                 bg-slate-700 px-4 py-2 text-sm font-semibold
                 hover:bg-slate-600"
          @click="closeChart"
        >
          Close
        </button>
      </div>

      <img
        v-if="enlargedChart"
        :src="enlargedChart.src"
        :alt="enlargedChart.alt"
        crossorigin="use-credentials"
        class="mx-auto h-auto max-h-[80dvh] max-w-full object-contain"
      />
    </dialog>
  </main>
</template>