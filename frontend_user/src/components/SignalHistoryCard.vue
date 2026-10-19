<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  signal: { type: Object, required: true },
  timeZone: { type: String, default: 'Asia/Phnom_Penh' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['subscribe', 'enlarge'])

const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')

const loaded = ref(false)
const failed = ref(false)
const retry = ref(0)
const root = ref(null)
const visible = ref(false)

let timer
let observer

const isNews = computed(() => props.signal.type === 'news')

const labels = {
  pending: 'Result pending',
  win: 'Win',
  loss: 'Loss',
  breakeven: 'Breakeven',
  cancelled: 'Cancelled',
}

const badge = computed(() => {
  const result = props.signal.outcome

  if (result === 'win') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
  }

  if (result === 'loss') {
    return 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300'
  }

  if (result === 'breakeven') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'
  }

  return 'bg-slate-400/15 text-(--muted-color)'
})

const imageSrc = computed(() => {
  if (!props.signal.hasImage) return ''

  const retryQuery = retry.value ? `&retry=${retry.value}` : ''

  if (props.signal.publicHistory) {
    const version =
      props.signal.updatedAt || props.signal.archivedAt || '1'

    return (
      `${BASE}/api/signal-history/${props.signal.type}/` +
      `${encodeURIComponent(props.signal._id)}/image` +
      `?v=${encodeURIComponent(version)}${retryQuery}`
    )
  }

  const resource = isNews.value ? 'signals' : 'daily-signals'
  const endpoint = props.signal.hasAccess ? 'image' : 'preview'
  const version =
    props.signal.imageUpdatedAt ||
    props.signal.updatedAt ||
    props.signal.archivedAt ||
    '1'

  return (
    `${BASE}/api/${resource}/` +
    `${encodeURIComponent(props.signal._id)}/${endpoint}` +
    `?v=${encodeURIComponent(version)}${retryQuery}`
  )
})

const confirmed = computed(() =>
  props.signal.hasAccess &&
  props.signal.confirmed === true &&
  ['buy', 'sell'].includes(props.signal.direction),
)

// Daily: date only.
// News: date and time.
function date(value) {
  const parsed = new Date(value)

  if (!value || !Number.isFinite(parsed.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: props.timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(isNews.value
      ? { hour: '2-digit', minute: '2-digit' }
      : {}),
  }).format(parsed)
}

function finish(error = false) {
  clearTimeout(timer)
  failed.value = error
  loaded.value = !error
}

function startImageTimer() {
  clearTimeout(timer)

  if (
    visible.value &&
    imageSrc.value &&
    !loaded.value &&
    !failed.value
  ) {
    timer = setTimeout(() => {
      failed.value = true
    }, 25_000)
  }
}

function openChart() {
  if (props.signal.hasAccess && loaded.value && !failed.value) {
    emit('enlarge', {
      ...props.signal,
      src: imageSrc.value,
    })
  }
}

watch(
  imageSrc,
  src => {
    clearTimeout(timer)
    loaded.value = false
    failed.value = false

    if (src) startImageTimer()
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    visible.value = true
    startImageTimer()
    return
  }

  observer = new IntersectionObserver(
    entries => {
      visible.value = entries[0]?.isIntersecting === true
      startImageTimer()
    },
    { rootMargin: '200px' },
  )

  if (root.value) observer.observe(root.value)
})

onUnmounted(() => {
  clearTimeout(timer)
  observer?.disconnect()
})
</script>

<template>
  <article
    ref="root"
    class="mx-auto flex h-full w-full min-w-0 max-w-sm flex-col
           overflow-hidden rounded-2xl border border-(--border-color)
           bg-(--surface-bg) text-(--text-color) shadow-sm"
  >
    <div class="min-w-0">
      <header
        class="border-b border-(--border-color) p-4 max-[320px]:p-3"
      >
        <p
          class="mb-3 text-xs font-semibold uppercase tracking-wide
                 text-(--muted-color)"
        >
          {{ isNews ? 'News Signal' : 'Daily Signal' }} · History
        </p>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <span
            class="rounded-lg bg-amber-100 px-3 py-1 text-sm
                   font-bold text-amber-800
                   dark:bg-amber-400/10 dark:text-amber-300"
          >
            {{ signal.pair }}
          </span>

          <span
            class="inline-flex max-w-full items-center gap-2
                   rounded-full px-3 py-1.5 text-xs font-semibold"
            :class="badge"
          >
            <span aria-hidden="true">
              {{
                signal.outcome === 'win' ? '✓'
                  : signal.outcome === 'loss' ? '×'
                    : signal.outcome === 'breakeven' ? '='
                      : signal.outcome === 'cancelled' ? '—'
                        : '◷'
              }}
            </span>

            {{ labels[signal.outcome] || 'Result pending' }}
          </span>
        </div>

        <h3 class="mt-3 min-h-7 break-words text-base font-bold">
          {{ signal.title }}
        </h3>

        <p class="mt-2 text-xs font-medium text-(--muted-color)">
          by Thun Tula
        </p>

        <div
          class="mt-3 min-h-24 rounded-xl border
                 border-(--border-color) bg-(--page-bg) p-3"
        >
          <p
            class="mb-2 text-xs font-semibold text-(--muted-color)"
          >
            {{ isNews ? 'News date and time' : 'Daily Signal date' }}
          </p>

          <time
            :datetime="signal.scheduledAt"
            class="block break-words text-sm font-semibold"
          >
            {{ date(signal.scheduledAt) }}
          </time>

          <span
            v-if="isNews && signal.newsType"
            class="mt-1 inline-flex max-w-full break-words rounded-md
                   bg-blue-100 px-2 py-1 text-xs font-semibold
                   text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
          >
            {{ signal.newsType }}
          </span>
        </div>
      </header>

      <div
        class="relative overflow-hidden"
        :class="!signal.hasAccess ? 'min-h-[328px]' : ''"
      >
        <div
          :class="!signal.hasAccess
            ? 'pointer-events-none select-none'
            : ''"
          :aria-hidden="!signal.hasAccess ? 'true' : undefined"
          :inert="!signal.hasAccess"
        >
          <div
            class="relative flex aspect-video items-center
                   justify-center overflow-hidden bg-(--input-bg)"
          >
            <div
              v-if="imageSrc && !loaded && !failed"
              role="status"
              aria-label="Loading chart"
              class="absolute inset-0 animate-pulse bg-slate-400/25
                     motion-reduce:animate-none"
            ></div>

            <img
              v-if="imageSrc && !failed"
              :key="imageSrc"
              :src="imageSrc"
              crossorigin="use-credentials"
              loading="lazy"
              :alt="signal.hasAccess
                ? `${signal.pair} historical analysis chart`
                : ''"
              class="absolute inset-0 h-full w-full object-contain"
              :class="[
                loaded ? 'opacity-100' : 'opacity-0',
                !signal.hasAccess
                  ? 'scale-105 blur-sm'
                  : 'cursor-zoom-in',
              ]"
              :role="signal.hasAccess ? 'button' : undefined"
              :tabindex="signal.hasAccess ? 0 : undefined"
              :aria-label="signal.hasAccess
                ? 'Enlarge chart'
                : undefined"
              @load="finish()"
              @error="finish(true)"
              @click="openChart"
              @keydown.enter.prevent="openChart"
              @keydown.space.prevent="openChart"
            />

            <div
              v-if="signal.hasAccess && (failed || !imageSrc)"
              class="p-4 text-center text-sm text-(--muted-color)"
            >
              <p>
                {{
                  failed
                    ? 'Unable to load this chart.'
                    : 'No chart available.'
                }}
              </p>

              <button
                v-if="failed"
                type="button"
                class="mt-3 min-h-11 rounded-lg border
                       border-(--border-color) px-4 font-semibold"
                @click="retry = Date.now()"
              >
                Retry chart
              </button>
            </div>

            <span
              v-if="confirmed"
              class="absolute right-3 top-3 rounded-lg px-3 py-2
                     text-xs font-bold shadow-sm"
              :class="signal.direction === 'buy'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'"
            >
              Confirmed {{ signal.direction.toUpperCase() }}
            </span>
          </div>

          <p
            v-if="signal.hasAccess && loaded"
            class="px-3 pt-2 text-xs text-(--muted-color)"
          >
            Click the chart to enlarge
          </p>

          <div
            class="min-h-32 p-3"
            :class="!signal.hasAccess ? 'blur-sm' : ''"
          >
            <h4 class="text-sm font-bold underline">Note:</h4>

            <p
              class="mt-3 whitespace-pre-line break-words text-sm
                     font-bold leading-6 text-slate-900
                     dark:text-slate-100"
            >
              {{
                signal.hasAccess
                  ? signal.details || 'No additional details.'
                  : signal.previewText ||
                    'Subscribe to view this historical analysis.'
              }}
            </p>

            <template v-if="signal.hasAccess && signal.news">
              <h4 class="mt-5 text-sm font-bold">Related news</h4>

              <p
                class="mt-2 whitespace-pre-line break-words text-sm
                       leading-6 text-(--muted-color)"
              >
                {{ signal.news }}
              </p>
            </template>
          </div>
        </div>

        <div
          v-if="!signal.hasAccess"
          class="absolute inset-0 flex items-center justify-center
                 bg-(--surface-bg)/45 p-4 max-[414px]:p-3"
        >
          <div
            class="flex min-h-[264px] w-full max-w-xs flex-col
                   items-center justify-center rounded-xl border
                   border-(--border-color) bg-(--surface-bg)/95
                   p-4 text-center shadow-xl"
          >
            <svg
              class="h-9 w-9 text-amber-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
            </svg>

            <h4
              class="mt-3 text-lg font-bold text-amber-600
                     dark:text-amber-300"
            >
              {{ isNews ? 'News' : 'Daily' }} Signal History
            </h4>

            <p class="mt-3 text-xs leading-5 text-(--muted-color)">
              Your active {{ isNews ? 'News' : 'Daily' }} subscription
              unlocks this chart, direction and full analysis.
            </p>

            <button
              type="button"
              :disabled="busy"
              class="mt-4 min-h-11 w-full rounded-xl bg-amber-400
                     px-4 py-2 text-sm font-bold text-slate-950
                     hover:bg-amber-300 disabled:opacity-60"
              @click="emit('subscribe', signal)"
            >
              {{
                busy
                  ? 'Please wait…'
                  : `Subscribe to ${isNews ? 'News' : 'Daily'} Signals`
              }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <footer
      class="mt-auto border-t border-(--border-color) p-3
             text-xs leading-5 text-(--muted-color)"
    >
      <p>
        Released: {{ date(signal.releasedAt || signal.scheduledAt) }}
      </p>

      <p v-if="signal.closedAt">
        Result recorded: {{ date(signal.closedAt) }}
      </p>
    </footer>
  </article>
</template>