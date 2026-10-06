<template>
  <section aria-labelledby="calendar-title" class="mt-12 min-w-0 max-w-full overflow-hidden rounded-xl
           border border-(--border-color)
           bg-(--surface-bg) text-(--text-color)
           transition-colors duration-300
           max-[768px]:mt-10
           max-[600px]:mt-8
           max-[480px]:mt-6
           max-[414px]:mt-5
           max-[320px]:mt-4">
    <!-- Heading -->
    <header class="border-b border-(--border-color) p-5 sm:p-6
             max-[768px]:p-5
             max-[600px]:p-4
             max-[480px]:p-3.5
             max-[414px]:p-3
             max-[320px]:p-2.5">
      <h2 id="calendar-title" class="text-2xl font-bold
               max-[768px]:text-[22px]
               max-[600px]:text-xl
               max-[480px]:text-lg
               max-[414px]:text-[17px]
               max-[320px]:text-base">
        Economic Calendar
      </h2>

      <p class="mt-2 text-sm leading-6 text-(--muted-color)
               max-[480px]:text-xs max-[480px]:leading-5">
        Daily economic events and their expected market impact.
        Events are managed by CMM-FT; unavailable values appear as —.
      </p>
    </header>

    <!-- Date navigation -->
    <div class="flex flex-wrap items-center justify-between gap-4
             bg-[#365581] px-4 py-3 text-white
             transition-colors duration-300
             in-[.ligh-mode]:bg-blue-100
             in-[.ligh-mode]:text-blue-950
             max-[768px]:flex-col max-[768px]:items-stretch
             max-[600px]:gap-3
             max-[480px]:px-3
             max-[414px]:gap-2.5
             max-[320px]:px-2">
      <div class="flex min-w-0 items-center gap-3
               max-[768px]:justify-between
               max-[480px]:gap-2
               max-[320px]:gap-1">
        <button type="button" aria-label="Previous day" class="shrink-0 cursor-pointer rounded-lg
                 bg-white/10 px-3 py-2 transition-colors
                 hover:bg-white/20
                 in-[.ligh-mode]:bg-blue-200
                 in-[.ligh-mode]:hover:bg-blue-300" @click="changeDay(-1)">
          ←
        </button>

        <div class="min-w-0 text-center">
          <p class="text-sm font-bold sm:text-base
                   max-[600px]:text-sm
                   max-[414px]:text-[13px]
                   max-[320px]:text-xs">
            {{ selectedDateLabel }}
          </p>

          <p v-if="followToday" class="mt-1 text-xs text-blue-100
                   in-[.ligh-mode]:text-blue-700
                   max-[414px]:text-[11px]">
            Following today automatically
          </p>
        </div>

        <button type="button" aria-label="Next day" class="shrink-0 cursor-pointer rounded-lg
                 bg-white/10 px-3 py-2 transition-colors
                 hover:bg-white/20
                 in-[.ligh-mode]:bg-blue-200
                 in-[.ligh-mode]:hover:bg-blue-300" @click="changeDay(1)">
          →
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2
               max-[768px]:w-full">
        <input type="date" :value="selectedDate" aria-label="Select event date" class="min-w-0 cursor-pointer rounded-lg
                 border border-(--border-color)
                 bg-(--input-bg) px-3 py-2
                 text-sm text-(--text-color)
                 transition-colors duration-300
                 max-[768px]:flex-1
                 max-[600px]:text-base
                 max-[414px]:px-2
                 max-[320px]:w-0" @change="selectDate($event.target.value)" />

        <button type="button" :aria-pressed="followToday" :class="followToday
          ? 'bg-white text-blue-900 in-[.ligh-mode]:bg-blue-700 in-[.ligh-mode]:text-white'
          : 'bg-white/10 text-white hover:bg-white/20 in-[.ligh-mode]:bg-blue-200 in-[.ligh-mode]:text-blue-950 in-[.ligh-mode]:hover:bg-blue-300'
          " class="shrink-0 cursor-pointer rounded-lg px-4 py-2
                 text-sm font-semibold transition-colors
                 max-[414px]:px-3
                 max-[320px]:px-2.5" @click="goToToday">
          Today
        </button>
      </div>
    </div>

    <!-- Refresh -->
    <div class="flex justify-end border-b border-(--border-color) px-4 py-2">
      <button type="button" :disabled="loading" class="cursor-pointer text-sm text-(--muted-color) disabled:opacity-50"
        @click="fetchEvents">
        {{ loading ? 'Loading…' : 'Refresh events' }}
      </button>
    </div>

    <!-- Impact legend -->
    <div class="flex flex-wrap items-center gap-4
             border-b border-(--border-color)
             px-4 py-3 text-xs text-(--muted-color)
             max-[768px]:gap-3
             max-[600px]:gap-2.5
             max-[480px]:px-3
             max-[414px]:gap-2
             max-[320px]:px-2">
      <span class="inline-flex items-center gap-2">
        <span aria-hidden="true" class="h-3 w-4 shrink-0 rounded-sm bg-red-500"></span>
        High impact
      </span>

      <span class="inline-flex items-center gap-2">
        <span aria-hidden="true" class="h-3 w-4 shrink-0 rounded-sm bg-orange-400"></span>
        Medium impact
      </span>

      <span class="inline-flex items-center gap-2">
        <span aria-hidden="true" class="h-3 w-4 shrink-0 rounded-sm bg-yellow-400"></span>
        Low impact
      </span>

      <span class="ml-auto max-[600px]:ml-0 max-[600px]:w-full" :class="isWeekend
        ? 'text-yellow-400 in-[.ligh-mode]:text-amber-700'
        : 'text-(--muted-color)'
        ">
        {{ dailyEvents.length }} events{{ isWeekend ? ' · Weekend' : '' }}
      </span>
    </div>

    <!-- Loading -->
    <p v-if="stale" role="status" class="border-b border-(--border-color) px-4 py-3 text-sm text-amber-500">
      Showing the last successful update for this date.
      {{ errorMessage }}
    </p>

    <div v-if="loading" role="status" class="px-4 py-10 text-center text-(--muted-color)">
      Loading economic events...
    </div>

    <!-- Error -->
    <div v-else-if="errorMessage && !stale" role="alert" class="px-4 py-8 text-center">
      <p class="text-red-500">{{ errorMessage }}</p>

      <button type="button" class="mt-3 cursor-pointer rounded-lg bg-indigo-600
               px-4 py-2 text-sm text-white hover:bg-indigo-500" @click="fetchEvents">
        Retry
      </button>
    </div>

    <!-- Weekend -->
    <div v-else-if="isWeekend && dailyEvents.length === 0" class="px-4 py-12 text-center text-(--muted-color)">
      <p class="font-semibold">Bank Holiday</p>

      <p class="mt-2 text-sm">
        No events have been added for this weekend date.
      </p>
    </div>

    <!-- Events -->
    <div v-else tabindex="0" role="region" aria-label="Daily economic events" class="w-full min-w-0 overflow-x-auto
             [scrollbar-color:#6366f1_var(--surface-bg)]
             focus-visible:outline-2
             focus-visible:-outline-offset-2
             focus-visible:outline-indigo-500">
      <table class="w-full min-w-[800px] border-collapse text-sm
               max-[768px]:min-w-[740px]
               max-[768px]:[&_th]:px-3
               max-[768px]:[&_td]:px-3
               max-[600px]:min-w-[700px]
               max-[600px]:[&_td]:py-3
               max-[480px]:min-w-[660px]
               max-[480px]:text-xs
               max-[480px]:[&_th]:px-2.5
               max-[480px]:[&_td]:px-2.5
               max-[414px]:min-w-[640px]
               max-[320px]:min-w-[620px]
               max-[320px]:[&_th]:px-2
               max-[320px]:[&_td]:px-2">
        <caption class="sr-only">
          Economic events for {{ selectedDateLabel }}.
          Times shown in {{ timeZone }}.
        </caption>

        <thead class="bg-(--input-bg) text-(--muted-color)">
          <tr>
            <th scope="col" class="border-r border-(--border-color) px-4 py-3 text-left font-medium">
              Time
            </th>

            <th scope="col" class="px-4 py-3 text-center font-medium">
              Currency
            </th>

            <th scope="col" class="px-4 py-3 text-center font-medium">
              Impact
            </th>

            <th scope="col" class="px-4 py-3 text-left font-medium">
              Event
            </th>

            <th scope="col" class="px-4 py-3 text-right font-medium">
              Actual
            </th>

            <th scope="col" class="px-4 py-3 text-right font-medium">
              Forecast
            </th>

            <th scope="col" class="px-4 py-3 text-right font-medium">
              Previous
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(event, index) in dailyEvents" :key="event.id" class="border-b border-(--border-color)
                   bg-(--surface-bg)
                   transition-colors duration-300
                   hover:bg-(--hover-bg)">
            <td v-if="timeRowSpan(index) > 0" :rowspan="timeRowSpan(index)" class="border-r border-(--border-color)
         whitespace-nowrap bg-(--surface-bg)
         px-4 py-4 align-top tabular-nums">
              <span class="transition-opacity duration-300" :class="{ 'opacity-40': isPastEvent(event.scheduledAt) }">
                {{ formatTime(event.scheduledAt) }}
              </span>
            </td>

            <td class="px-4 py-4 text-center font-semibold">
              {{ event.currency }}
            </td>

            <td class="px-4 py-4 text-center">
              <span :title="`${event.impact} impact`" aria-hidden="true" class="inline-block h-3.5 w-4 rounded-sm"
                :class="impactColors[event.impact]"></span>

              <span class="sr-only">
                {{ event.impact }} impact
              </span>
            </td>

            <td class="px-4 py-4 font-medium">
              {{ event.title }}

              <span v-if="event.status === 'cancelled'" class="ml-2 text-xs text-red-500">
                (Cancelled)
              </span>
            </td>

            <td class="px-4 py-4 text-right tabular-nums" :class="valueColor(event.actual)">
              <span v-if="isActualLoading(event)" role="status" class="inline-flex items-center justify-end">
                <span aria-hidden="true" class="h-4 w-4 animate-spin rounded-full
             border-2 border-indigo-500/30
             border-t-indigo-500"></span>

                <span class="sr-only">Awaiting</span>
              </span>

              <span v-else>
                {{ event.actual ?? '—' }}
              </span>
            </td>
            <td class="px-4 py-4 text-right tabular-nums" :class="valueColor(event.forecast)">
              {{ event.forecast ?? '—' }}
            </td>

            <td class="px-4 py-4 text-right tabular-nums" :class="valueColor(event.previous)">
              {{ event.previous ?? '—' }}
            </td>
          </tr>

          <tr v-if="dailyEvents.length === 0">
            <td colspan="7" class="px-4 py-12 text-center text-(--muted-color)">
              No events have been added for this date.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <footer class="flex flex-wrap justify-between gap-2
             border-t border-(--border-color)
             px-4 py-3 text-xs text-(--muted-color)
             max-[600px]:flex-col
             max-[480px]:px-3
             max-[414px]:gap-1.5
             max-[320px]:px-2
             wrap-anywhere">
      <span>
        Time zone: {{ timeZone }}
      </span>

      <span>
        Source: CMM-FT Economic Calendar

        <template v-if="lastUpdated">
          · Last fetched {{ formatTime(lastUpdated) }}
        </template>
      </span>
    </footer>
  </section>
</template>

<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'

import { getEconomicEvents } from '../api/calendar.js'

const REFRESH_INTERVAL = 60 * 1000

// Automatically use the visitor's device timezone.
const timeZone =
  Intl.DateTimeFormat().resolvedOptions().timeZone

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

function dateKey(date) {
  const parts = dateFormatter.formatToParts(date)

  const get = (type) =>
    parts.find((part) => part.type === type).value

  return `${get('year')}-${get('month')}-${get('day')}`
}

function parseDate(value) {
  return new Date(`${value}T12:00:00Z`)
}

function addDays(value, amount) {
  const date = parseDate(value)

  date.setUTCDate(date.getUTCDate() + amount)

  return date.toISOString().slice(0, 10)
}

// Convert the selected local day into UTC boundaries.
function dayBounds(value) {
  const [year, month, day] = value.split('-').map(Number)

  return {
    from: new Date(
      year,
      month - 1,
      day
    ).toISOString(),

    to: new Date(
      year,
      month - 1,
      day + 1
    ).toISOString(),
  }
}

const selectedDate = ref(dateKey(new Date()))

const followToday = ref(true)

const events = ref([])

const loading = ref(false)

const errorMessage = ref('')

const lastUpdated = ref(null)

const stale = ref(false)

let loadedDate = null

let requestController = null

let clockTimer = null

let refreshTimer = null

const isWeekend = computed(() => {
  const day = parseDate(selectedDate.value).getUTCDay()

  return day === 0 || day === 6
})

const selectedDateLabel = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseDate(selectedDate.value))
})

const impactColors = {
  high: 'bg-red-500',
  medium: 'bg-orange-400',
  low: 'bg-yellow-400',
  holiday: 'bg-slate-400',
  unknown: 'bg-slate-400',
}

function normalizeValue(value) {
  return value == null ||
    (typeof value === 'string' && !value.trim())
    ? null
    : value
}

function parseEventDate(value) {
  if (!value) return null

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? null
    : date
}

/*
|--------------------------------------------------------------------------
| Fetch Economic Calendar
|--------------------------------------------------------------------------
| Frontend -> /api/calendar
| Netlify -> Render
| Render -> MongoDB
|--------------------------------------------------------------------------
*/

async function fetchEvents() {
  requestController?.abort()

  const controller = new AbortController()

  requestController = controller

  const requestedDate = selectedDate.value

  if (loadedDate !== requestedDate) {
    events.value = []
    lastUpdated.value = null
  }

  loading.value = true

  errorMessage.value = ''

  stale.value = false

  let timedOut = false

  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 20000)

  try {
    const { from, to } = dayBounds(requestedDate)

    /*
     * IMPORTANT:
     * economic.js calls:
     *
     * GET /api/calendar
     *
     * Netlify redirects this to:
     *
     * https://ttft-4.onrender.com/api/calendar
     */
    const data = await getEconomicEvents({
      from,
      to,
      signal: controller.signal,
    })

    if (
      controller.signal.aborted ||
      selectedDate.value !== requestedDate
    ) {
      return
    }

    if (!Array.isArray(data)) {
      throw new Error(
        'The calendar returned an unexpected response.'
      )
    }

    const mappedEvents = data.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(
          'The calendar returned an invalid event.'
        )
      }

      const date = parseEventDate(item.scheduledAt)

      if (!date) {
        throw new Error(
          'An event has an invalid scheduled time.'
        )
      }

      const impact = String(
        item.impact ?? ''
      )
        .trim()
        .toLowerCase()

      return {
        id:
          item._id ??
          item.id ??
          `${date.toISOString()}-${item.currency}-${item.title}-${index}`,

        scheduledAt: date.toISOString(),

        currency:
          normalizeValue(item.currency) ?? '—',

        title:
          normalizeValue(item.title) ??
          'Unnamed event',

        impact:
          Object.hasOwn(impactColors, impact)
            ? impact
            : 'unknown',

        actual:
          normalizeValue(item.actual),

        forecast:
          normalizeValue(item.forecast),

        previous:
          normalizeValue(item.previous),

        status:
          item.status ?? 'scheduled',
      }
    })

    events.value = mappedEvents

    loadedDate = requestedDate

    lastUpdated.value =
      new Date().toISOString()

  } catch (error) {
    if (
      requestController !== controller ||
      (controller.signal.aborted && !timedOut)
    ) {
      return
    }

    stale.value =
      loadedDate === requestedDate &&
      events.value.length > 0

    errorMessage.value = timedOut
      ? 'The request timed out. Please retry.'
      : error?.message ||
      'Unable to load economic events.'

  } finally {
    window.clearTimeout(timeout)

    if (requestController === controller) {
      requestController = null

      loading.value = false
    }
  }
}

const dailyEvents = computed(() => {
  return events.value
    .filter(
      (event) =>
        dateKey(
          new Date(event.scheduledAt)
        ) === selectedDate.value
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() -
        new Date(b.scheduledAt).getTime()
    )
})

// Calculate one merged time cell per group.
const timeSpans = computed(() => {
  const rows = dailyEvents.value

  const spans = Array(rows.length).fill(0)

  let start = 0

  while (start < rows.length) {
    const minute = Math.floor(
      new Date(
        rows[start].scheduledAt
      ).getTime() / 60000
    )

    let end = start + 1

    while (
      end < rows.length &&
      Math.floor(
        new Date(
          rows[end].scheduledAt
        ).getTime() / 60000
      ) === minute
    ) {
      end++
    }

    spans[start] = end - start

    start = end
  }

  return spans
})

function timeRowSpan(index) {
  return timeSpans.value[index] ?? 0
}

function formatTime(timestamp) {
  const date = parseEventDate(timestamp)

  return date
    ? timeFormatter.format(date)
    : '—'
}

function changeDay(direction) {
  followToday.value = false

  selectedDate.value =
    addDays(
      selectedDate.value,
      direction
    )
}

function selectDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return
  }

  const date = parseDate(value)

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return
  }

  followToday.value = false

  selectedDate.value = value
}

function syncToday() {
  if (followToday.value) {
    const today = dateKey(new Date())

    if (selectedDate.value !== today) {
      selectedDate.value = today
    }
  }
}

function goToToday() {
  followToday.value = true

  const today = dateKey(new Date())

  if (selectedDate.value === today) {
    fetchEvents()
  } else {
    selectedDate.value = today
  }
}

watch(
  selectedDate,
  () => {
    fetchEvents()
  }
)

onMounted(() => {
  fetchEvents()

  clockTimer = window.setInterval(
    syncToday,
    30000
  )

  refreshTimer = window.setInterval(() => {
    if (!requestController) {
      fetchEvents()
    }
  }, REFRESH_INTERVAL)
})

onUnmounted(() => {
  window.clearInterval(clockTimer)

  window.clearInterval(refreshTimer)

  requestController?.abort()
})

function valueColor(value) {
  if (value == null) return ''

  const text = String(value).trim().replace(/−/g, '-')

  return text.startsWith('-') ? 'text-red-500' : ''
}

const currentTime = ref(Date.now())
let fadeTimer = null

function isPastEvent(timestamp) {
  const time = new Date(timestamp).getTime()
  return Number.isFinite(time) && time <= currentTime.value
}

onMounted(() => {
  fadeTimer = window.setInterval(() => {
    currentTime.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  window.clearInterval(fadeTimer)
})


function isActualLoading(event) {
  const actual = event.actual

  const isMissing =
    actual == null ||
    (typeof actual === 'string' &&
      ['', '—', '-'].includes(actual.trim()))

  if (
    !isMissing ||
    event.status === 'cancelled' ||
    event.impact === 'holiday'
  ) {
    return false
  }

  const eventTime = new Date(event.scheduledAt).getTime()
  const remaining = eventTime - currentTime.value

  return Number.isFinite(eventTime) &&
    remaining <= 3 * 60 * 1000 &&
    remaining > -1 * 60 * 1000
}
</script>