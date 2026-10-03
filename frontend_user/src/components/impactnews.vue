<template>
  <section
    aria-labelledby="calendar-title"
    class="mt-12 min-w-0 max-w-full overflow-hidden rounded-xl
           border border-(--border-color)
           bg-(--surface-bg) text-(--text-color)
           transition-colors duration-300
           max-[768px]:mt-10
           max-[600px]:mt-8
           max-[480px]:mt-6
           max-[414px]:mt-5
           max-[320px]:mt-4"
  >
    <!-- Heading -->
    <header
      class="border-b border-(--border-color) p-5 sm:p-6
             max-[768px]:p-5
             max-[600px]:p-4
             max-[480px]:p-3.5
             max-[414px]:p-3
             max-[320px]:p-2.5"
    >
      <h2
        id="calendar-title"
        class="text-2xl font-bold
               max-[768px]:text-[22px]
               max-[600px]:text-xl
               max-[480px]:text-lg
               max-[414px]:text-[17px]
               max-[320px]:text-base"
      >
        Economic Calendar
      </h2>
      <p
        class="mt-2 text-sm leading-6 text-(--muted-color)
               max-[480px]:text-xs max-[480px]:leading-5"
      >
        Daily economic events and their expected market impact.
        This feed covers the current week only; unavailable values appear as —.
      </p>
    </header>
    <!-- Date navigation -->
    <div
      class="flex flex-wrap items-center justify-between gap-4
             bg-[#365581] px-4 py-3 text-white
             transition-colors duration-300
             in-[.ligh-mode]:bg-blue-100
             in-[.ligh-mode]:text-blue-950
             max-[768px]:flex-col max-[768px]:items-stretch
             max-[600px]:gap-3
             max-[480px]:px-3
             max-[414px]:gap-2.5
             max-[320px]:px-2"
    >
      <div
        class="flex min-w-0 items-center gap-3
               max-[768px]:justify-between
               max-[480px]:gap-2
               max-[320px]:gap-1"
      >
        <button
          type="button"
          aria-label="Previous day"
          class="shrink-0 cursor-pointer rounded-lg
                 bg-white/10 px-3 py-2 transition-colors
                 hover:bg-white/20
                 in-[.ligh-mode]:bg-blue-200
                 in-[.ligh-mode]:hover:bg-blue-300"
          @click="changeDay(-1)"
        >
          ←
        </button>
        <div class="min-w-0 text-center">
          <p
            class="text-sm font-bold sm:text-base
                   max-[600px]:text-sm
                   max-[414px]:text-[13px]
                   max-[320px]:text-xs"
          >
            {{ selectedDateLabel }}
          </p>
          <p
            v-if="followToday"
            class="mt-1 text-xs text-blue-100
                   in-[.ligh-mode]:text-blue-700
                   max-[414px]:text-[11px]"
          >
            Following today automatically
          </p>
        </div>
        <button
          type="button"
          aria-label="Next day"
          class="shrink-0 cursor-pointer rounded-lg
                 bg-white/10 px-3 py-2 transition-colors
                 hover:bg-white/20
                 in-[.ligh-mode]:bg-blue-200
                 in-[.ligh-mode]:hover:bg-blue-300"
          @click="changeDay(1)"
        >
          →
        </button>
      </div>
      <div
        class="flex flex-wrap items-center gap-2
               max-[768px]:w-full"
      >
        <input
          type="date"
          :value="selectedDate"
          aria-label="Select event date"
          class="min-w-0 cursor-pointer rounded-lg
                 border border-(--border-color)
                 bg-(--input-bg) px-3 py-2
                 text-sm text-(--text-color)
                 transition-colors duration-300
                 max-[768px]:flex-1
                 max-[600px]:text-base
                 max-[414px]:px-2
                 max-[320px]:w-0"
          @change="selectDate($event.target.value)"
        />
        <button
          type="button"
          :aria-pressed="followToday"
          class="shrink-0 cursor-pointer rounded-lg px-4 py-2
                 text-sm font-semibold transition-colors
                 max-[414px]:px-3
                 max-[320px]:px-2.5"
          :class="
            followToday
              ? 'bg-white text-blue-900 in-[.ligh-mode]:bg-blue-700 in-[.ligh-mode]:text-white'
              : 'bg-white/10 text-white hover:bg-white/20 in-[.ligh-mode]:bg-blue-200 in-[.ligh-mode]:text-blue-950 in-[.ligh-mode]:hover:bg-blue-300'
          "
          @click="goToToday"
        >
          Today
        </button>
      </div>
    </div>
    <!-- Impact legend -->
    <div
      class="flex flex-wrap items-center gap-4
             border-b border-(--border-color)
             px-4 py-3 text-xs text-(--muted-color)
             max-[768px]:gap-3
             max-[600px]:gap-2.5
             max-[480px]:px-3
             max-[414px]:gap-2
             max-[320px]:px-2"
    >
      <span class="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          class="h-3 w-4 shrink-0 rounded-sm bg-red-500"
        ></span>
        High impact
      </span>
      <span class="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          class="h-3 w-4 shrink-0 rounded-sm bg-orange-400"
        ></span>
        Medium impact
      </span>
      <span class="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          class="h-3 w-4 shrink-0 rounded-sm bg-yellow-400"
        ></span>
        Low impact
      </span>
      <span
        class="ml-auto max-[600px]:ml-0 max-[600px]:w-full"
        :class="
          isWeekend
            ? 'text-yellow-400 in-[.ligh-mode]:text-amber-700'
            : 'text-(--muted-color)'
        "
      >
        {{ isWeekend ? 'Weekend Holiday' : `${dailyEvents.length} events` }}
      </span>
    </div>
    <!-- Loading and error states -->
    <div
      v-if="loading"
      role="status"
      class="px-4 py-10 text-center text-(--muted-color)"
    >
      Loading economic events...
    </div>
    <div
      v-else-if="errorMessage"
      role="alert"
      class="px-4 py-8 text-center"
    >
      <p class="text-red-500">{{ errorMessage }}</p>
      <button
        type="button"
        class="mt-3 cursor-pointer rounded-lg bg-indigo-600
               px-4 py-2 text-sm text-white hover:bg-indigo-500"
        @click="fetchEvents"
      >
        Retry
      </button>
    </div>
    <!-- Preserve the requested Saturday/Sunday holiday display. -->
    <div
      v-else-if="isWeekend"
      class="px-4 py-12 text-center text-(--muted-color)"
    >
      <p class="font-semibold">Weekend Holiday</p>
      <p class="mt-2 text-sm">This calendar view hides Saturday and Sunday events.</p>
    </div>
    <!-- Weekday events: horizontal scrolling on smaller screens -->
    <div
      v-else
      tabindex="0"
      role="region"
      aria-label="Daily economic events"
      class="w-full min-w-0 overflow-x-auto
             [scrollbar-color:#6366f1_var(--surface-bg)]
             focus-visible:outline-2
             focus-visible:-outline-offset-2
             focus-visible:outline-indigo-500"
    >
      <table
        class="w-full min-w-[800px] border-collapse text-sm
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
               max-[320px]:[&_td]:px-2"
      >
        <caption class="sr-only">
          Economic events for {{ selectedDateLabel }}.
          Times shown in {{ timeZone }}.
        </caption>
        <thead class="bg-(--input-bg) text-(--muted-color)">
          <tr>
            <th scope="col" class="px-4 py-3 text-left font-medium">
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
        <tbody class="divide-y divide-(--border-color)">
          <tr
            v-for="event in dailyEvents"
            :key="event.id"
            class="transition-colors duration-300
                   odd:bg-(--surface-bg)
                   even:bg-(--page-bg)
                   hover:bg-(--hover-bg)"
          >
            <td class="whitespace-nowrap px-4 py-4 tabular-nums">
              {{ formatTime(event.scheduledAt) }}
            </td>
            <td class="px-4 py-4 text-center font-semibold">
              {{ event.currency }}
            </td>
            <td class="px-4 py-4 text-center">
              <span
                :title="`${event.impact} impact`"
                aria-hidden="true"
                class="inline-block h-3.5 w-4 rounded-sm"
                :class="impactColors[event.impact]"
              ></span>
              <span class="sr-only">
                {{ event.impact }} impact
              </span>
            </td>
            <td class="px-4 py-4 font-medium">
              {{ event.title }}
            </td>
            <td class="px-4 py-4 text-right font-semibold tabular-nums">
              {{ event.actual ?? '—' }}
            </td>
            <td class="px-4 py-4 text-right tabular-nums">
              {{ event.forecast ?? '—' }}
            </td>
            <td
              class="px-4 py-4 text-right
                     text-(--muted-color) tabular-nums"
            >
              {{ event.previous ?? '—' }}
            </td>
          </tr>
          <tr v-if="dailyEvents.length === 0">
            <td
              colspan="7"
              class="px-4 py-12 text-center text-(--muted-color)"
            >
              No events for this date in the downloaded weekly feed.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Footer -->
    <footer
      class="flex flex-wrap justify-between gap-2
             border-t border-(--border-color)
             px-4 py-3 text-xs text-(--muted-color)
             max-[600px]:flex-col
             max-[480px]:px-3
             max-[414px]:gap-1.5
             max-[320px]:px-2
             wrap-anywhere"
    >
      <span>Time zone: {{ timeZone }}</span>
     <span>
  Source: Forex Factory · This week only
  <template v-if="lastUpdated">
    · Updated {{ formatTime(lastUpdated) }}
  </template>
</span>
    </footer>
  </section>
</template>
```vue
<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

/*
 * Forex Factory weekly JSON feed
 */
const API_URL =
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json'

const REFRESH_INTERVAL = 60 * 60 * 1000

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

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

/*
 * Convert Date -> YYYY-MM-DD in user's timezone
 */
function dateKey(date) {
  const parts = dateFormatter.formatToParts(date)

  const get = (type) =>
    parts.find((part) => part.type === type)?.value

  return `${get('year')}-${get('month')}-${get('day')}`
}

/*
 * Parse YYYY-MM-DD safely
 */
function parseDate(value) {
  return new Date(`${value}T12:00:00Z`)
}

/*
 * Add days
 */
function addDays(value, amount) {
  const date = parseDate(value)

  date.setUTCDate(date.getUTCDate() + amount)

  return date.toISOString().slice(0, 10)
}

const todayKey = ref(dateKey(new Date()))
const selectedDate = ref(todayKey.value)

const followToday = ref(true)

const events = ref([])

const loading = ref(false)
const errorMessage = ref('')
const lastUpdated = ref(null)

let requestController = null
let clockTimer = null
let refreshTimer = null

const selectedDayNumber = computed(() =>
  parseDate(selectedDate.value).getUTCDay()
)

const isWeekend = computed(
  () =>
    selectedDayNumber.value === 0 ||
    selectedDayNumber.value === 6
)

const selectedDateLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseDate(selectedDate.value))
)

const impactColors = {
  high: 'bg-red-500',
  medium: 'bg-orange-400',
  low: 'bg-yellow-400',
  holiday: 'bg-slate-400',
  unknown: 'bg-slate-400',
}

/*
 * Preserve 0 values.
 */
function normalizeValue(value) {
  if (
    value == null ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return null
  }

  return value
}

/*
 * Convert Forex Factory date string to a real Date.
 *
 * Examples can look like:
 *
 * 2026-10-03T08:30:00-04:00
 *
 * or:
 *
 * 2026-10-03T08:30:00Z
 */
function parseEventDate(value) {
  if (!value) return null

  const timestamp = String(value).trim()

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

/*
 * Fetch Forex Factory weekly calendar
 */
async function fetchEvents() {
  requestController?.abort()

  const controller = new AbortController()

  requestController = controller

  loading.value = true
  errorMessage.value = ''

  let timedOut = false

  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 15000)

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const error = new Error(
        `Calendar request failed (${response.status}).`
      )

      error.status = response.status

      throw error
    }

    const data = await response.json()

    /*
     * Forex Factory feed normally returns an array.
     */
    if (!Array.isArray(data)) {
      throw new Error(
        'Forex Factory returned an unexpected JSON format.'
      )
    }

    const mappedEvents = data
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null
        }

        /*
         * Forex Factory fields:
         *
         * date
         * country
         * title
         * impact
         * actual
         * forecast
         * previous
         */

        const date = parseEventDate(item.date)

        if (!date) {
          return null
        }

        const impact = String(
          item.impact ?? ''
        )
          .trim()
          .toLowerCase()

        return {
          id:
            item.id ||
            `${item.date}-${item.country}-${item.title}-${index}`,

          scheduledAt: date.toISOString(),

          currency:
            item.country ||
            '—',

          title:
            item.title ||
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
        }
      })
      .filter(Boolean)

    if (data.length > 0 && mappedEvents.length === 0) {
      throw new Error(
        'Forex Factory returned events, but their dates could not be parsed.'
      )
    }

    if (controller.signal.aborted) {
      return
    }

    events.value = mappedEvents

    lastUpdated.value = new Date()

  } catch (error) {
    if (requestController !== controller) {
      return
    }

    if (
      controller.signal.aborted &&
      !timedOut
    ) {
      return
    }

    const status = error?.status

    if (timedOut) {

      errorMessage.value =
        'The request timed out. Please retry.'

    } else if (
      status === 401 ||
      status === 403
    ) {

      errorMessage.value =
        'The calendar provider denied this request.'

    } else if (status === 429) {

      errorMessage.value =
        'API request limit reached. Please try again later.'

    } else if (
      error instanceof TypeError
    ) {

      errorMessage.value =
        'The Forex Factory feed blocked the browser request (CORS). Use a backend/proxy on Netlify.'

    } else {

      errorMessage.value =
        error?.message ||
        'Unable to load economic events.'
    }

  } finally {

    window.clearTimeout(timeout)

    if (requestController === controller) {
      loading.value = false
    }
  }
}

/*
 * Events for selected day
 */
const dailyEvents = computed(() => {

  if (isWeekend.value) {
    return []
  }

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

/*
 * Format event time
 */
function formatTime(timestamp) {

  if (!timestamp) {
    return '—'
  }

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return timeFormatter.format(date)
}

/*
 * Previous / next day
 */
function changeDay(direction) {

  selectedDate.value =
    addDays(
      selectedDate.value,
      direction
    )

  followToday.value = false
}

/*
 * Select date
 */
function selectDate(value) {

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return
  }

  const date = parseDate(value)

  if (Number.isNaN(date.getTime())) {
    return
  }

  selectedDate.value = value

  followToday.value = false
}

/*
 * Keep today's date synchronized
 */
function syncToday() {

  const currentDate =
    dateKey(new Date())

  todayKey.value = currentDate

  if (
    followToday.value &&
    selectedDate.value !== currentDate
  ) {
    selectedDate.value = currentDate
  }
}

/*
 * Go back to today
 */
function goToToday() {

  followToday.value = true

  syncToday()
}

/*
 * Refresh when tab becomes visible
 */
function handleVisibility() {

  if (
    document.visibilityState !== 'visible'
  ) {
    return
  }

  syncToday()

  const needsRefresh =
    !lastUpdated.value ||
    Date.now() -
      lastUpdated.value.getTime() >=
      REFRESH_INTERVAL

  if (
    !loading.value &&
    needsRefresh
  ) {
    fetchEvents()
  }
}

/*
 * Mount
 */
onMounted(() => {

  fetchEvents()

  clockTimer =
    window.setInterval(
      syncToday,
      1000
    )

  refreshTimer =
    window.setInterval(() => {

      if (
        document.visibilityState ===
          'visible' &&
        !loading.value
      ) {
        fetchEvents()
      }

    }, REFRESH_INTERVAL)

  document.addEventListener(
    'visibilitychange',
    handleVisibility
  )
})

/*
 * Unmount
 */
onUnmounted(() => {

  window.clearInterval(clockTimer)

  window.clearInterval(refreshTimer)

  requestController?.abort()

  document.removeEventListener(
    'visibilitychange',
    handleVisibility
  )
})
</script>

