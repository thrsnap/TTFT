<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/user/authStore.js'
import SignalHistoryCard from './SignalHistoryCard.vue'
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim().replace(/\/+$/, '')
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const busy = ref(false)
const subscriptions = ref({ news: { active: false }, daily: { active: false } })
const purchaseController = new AbortController()
let expiryTimer
const type = ref('all')
const weekSelection = ref('latest')
const chosenWeek = ref('')
const appliedRange = ref({ from: '', to: '' })
const page = ref(1)
const cardPage = ref(1)
const weeks = ref([])
const pagination = ref({ total: 0, hasMore: false })
const timeZone = ref('Asia/Phnom_Penh')
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const dialog = ref(null)
const enlarged = ref(null)
const filters = [{ value: 'all', label: 'All signals' }, { value: 'news', label: 'News Signals' }, { value: 'daily', label: 'Daily Signals' }]
let request
let version = 0
let disposed = false
let refreshTimer
function weekLabel(week) {
  const format = value => new Date(value).toLocaleDateString('en-GB', { timeZone: timeZone.value, day: 'numeric', month: 'long', year: 'numeric' })
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timeZone.value, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(week.startsAt)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  const localStart = `${parts.year}-${parts.month}-${parts.day}`
  const current = presetRange('this')
  const last = presetRange('last')
  const next = presetRange('next')
  const label = localStart === current.from ? 'This week' : localStart === last.from ? 'Last week' : localStart === next.from ? 'Next week' : 'Week'
  return `${label} · ${format(week.startsAt)} – ${format(week.endsAt)}`
}
function statItems(stats) {
  return [
    { label: 'Weekly win rate', value: stats.winRate == null ? '—' : `${stats.winRate}%` },
    { label: 'Wins', value: stats.wins }, { label: 'Losses', value: stats.losses },
    { label: 'Breakeven', value: stats.breakeven }, { label: 'Cancelled', value: stats.cancelled },
    { label: 'Result pending', value: stats.pending },
  ]
}
function closeChart() { dialog.value?.close(); enlarged.value = null }
async function openChart(signal) {
  scheduleAccessCheck()
  if (!signal.hasAccess) return
  enlarged.value = signal
  await nextTick()
  if (enlarged.value?.hasAccess && !dialog.value?.open) dialog.value?.showModal()
}
async function load(background = false) {
  request?.abort()
  const current = ++version
  const controller = new AbortController()
  request = controller
  refreshing.value = true
  if (!background && !weeks.value.length) loading.value = true
  error.value = ''
  try {
    const query = new URLSearchParams({ type: type.value, page: String(page.value), cardPage: String(cardPage.value), groupBy: 'week' })
    if (appliedRange.value.from) query.set('from', appliedRange.value.from)
    if (appliedRange.value.to) query.set('to', appliedRange.value.to)
    const response = await fetch(`${BASE}/api/signal-history/weekly?${query}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.message || 'Unable to load history.')
    if (!data || data.groupBy !== 'week') throw new Error('Update the history backend to enable week selection.')
    if (data.subscriptionRequired !== true || data.publicHistory !== false) throw new Error('Deploy the subscriber-only history backend first.')
    if (!Array.isArray(data.weeks) || !data.pagination) throw new Error('Invalid weekly history response.')
    if (disposed || current !== version) return
    if (!data.weeks.length && page.value > 1 && data.pagination.total > 0) {
      page.value = Math.min(page.value, data.pagination.total); cardPage.value = 1
      void load(); return
    }
    timeZone.value = data.timeZone || 'Asia/Phnom_Penh'
    if (['this', 'last', 'next'].includes(weekSelection.value)) {
      const expected = presetRange(weekSelection.value)
      if (expected.from !== appliedRange.value.from || expected.to !== appliedRange.value.to) {
        appliedRange.value = expected; page.value = 1; cardPage.value = 1; void load(); return
      }
    }
    subscriptions.value = data.subscriptions || { news: { active: false }, daily: { active: false } }
    weeks.value = data.weeks
    scheduleAccessCheck()
    pagination.value = data.pagination
    timeZone.value = data.timeZone || 'Asia/Phnom_Penh'
    cardPage.value = data.weeks[0]?.pagination.page || 1
    if (enlarged.value && !data.weeks.some(week => week.cards.some(card => card._id === enlarged.value._id && card.type === enlarged.value.type && card.hasAccess))) closeChart()
  } catch (failure) {
    if (current === version && failure.name !== 'AbortError') error.value = failure.message || 'Unable to load history.'
  } finally {
    if (!disposed && current === version) { loading.value = false; refreshing.value = false }
  }
}
function lockCard(card) {
  card.hasAccess = false
  for (const key of ['details', 'news', 'direction', 'confirmed', 'imageSrc', 'src']) {
    delete card[key]
  }
}

function scheduleAccessCheck() {
  clearTimeout(expiryTimer)
  let nearest = Infinity
  const now = Date.now()
  for (const kind of ['news', 'daily']) {
    const period = subscriptions.value[kind]
    const end = period?.expiresAt ? new Date(period.expiresAt).getTime() : NaN
    const expired = Number.isFinite(end) && end <= now
    if (expired && period) period.active = false
    if (period?.active !== true) {
      for (const week of weeks.value) {
        for (const card of week.cards) if (card.type === kind) lockCard(card)
      }
      if (enlarged.value?.type === kind) closeChart()
    } else if (Number.isFinite(end)) {
      nearest = Math.min(nearest, end - now)
    }
  }
  if (Number.isFinite(nearest) && !disposed) {
    expiryTimer = setTimeout(scheduleAccessCheck, Math.min(nearest, 86_400_000))
  }
}

function localizedPath(path) {
  return route.params.lang === 'km' ? `/km${path}` : path
}

async function subscribe(signal) {
  if (busy.value || !['news', 'daily'].includes(signal.type)) return
  busy.value = true
  error.value = ''
  const destination = {
    path: localizedPath('/payment'),
    query: { productId: signal.type === 'news' ? 'news-signal-monthly' : 'daily-signal-monthly' },
  }
  try {
    const response = await fetch(`${BASE}/api/auth/me`, {
      credentials: 'include', cache: 'no-store', signal: purchaseController.signal,
    })
    if (response.status === 401) {
      await router.push({
        path: localizedPath('/login'),
        query: { redirect: router.resolve(destination).fullPath },
      })
    } else {
      if (!response.ok) throw new Error('Unable to check your account. Please try again.')
      await router.push(destination)
    }
  } catch (failure) {
    if (failure.name !== 'AbortError') error.value = failure.message || 'Unable to continue.'
  } finally {
    busy.value = false
  }
}

// Account changes immediately discard analysis from the previous session.
watch(
  () => [auth.isAuthenticated, auth.user?._id || auth.user?.id || auth.user?.email || ''],
  () => {
    request?.abort()
    version++
    clearTimeout(expiryTimer)
    subscriptions.value = { news: { active: false }, daily: { active: false } }
    for (const week of weeks.value) for (const card of week.cards) lockCard(card)
    closeChart()
    void load(true)
  },
)
watch(() => route.query.paymentReturn, (value, previous) => {
  if (value && value !== previous) void load(true)
})

function calendarString(date) { return date.toISOString().slice(0, 10) }
function presetRange(selection, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timeZone.value, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]))
  const monday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const offset = selection === 'last' ? -7 : selection === 'next' ? 7 : 0
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7 + offset)
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6)
  return { from: calendarString(monday), to: calendarString(sunday) }
}
function isoWeekCode(date) {
  const thursday = new Date(date)
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7))
  const year = thursday.getUTCFullYear()
  const number = Math.ceil(((thursday - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7)
  return `${year}-W${String(number).padStart(2, '0')}`
}
function selectedWeekRange(value) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value)
  if (!match || Number(match[1]) < 1900 || Number(match[2]) < 1 || Number(match[2]) > 53) throw new Error('Choose a valid week.')
  const monday = new Date(Date.UTC(Number(match[1]), 0, 4))
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7 + (Number(match[2]) - 1) * 7)
  if (isoWeekCode(monday) !== value) throw new Error('That week does not exist in the selected year.')
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6)
  return { from: calendarString(monday), to: calendarString(sunday) }
}
function refreshVisible() {
  scheduleAccessCheck()
  if (document.hidden) return
  if (['this', 'last', 'next'].includes(weekSelection.value)) {
    const expected = presetRange(weekSelection.value)
    if (expected.from !== appliedRange.value.from) { appliedRange.value = expected; page.value = 1; cardPage.value = 1; closeChart() }
  }
  void load(true)
}
function selectType(value) {
  if (type.value === value) return
  type.value = value; resetPeriod()
}
function resetPeriod() { page.value = 1; cardPage.value = 1; weeks.value = []; closeChart(); void load() }
function applyWeekSelection() {
  if (weekSelection.value === 'custom') return
  appliedRange.value = weekSelection.value === 'latest' ? { from: '', to: '' } : presetRange(weekSelection.value)
  resetPeriod()
}
function applyChosenWeek() {
  try { appliedRange.value = selectedWeekRange(chosenWeek.value); resetPeriod() }
  catch (failure) { error.value = failure.message }
}
function changeWeek(offset) { page.value += offset; cardPage.value = 1; weeks.value = []; closeChart(); void load() }
function changeCardPage(offset) { cardPage.value += offset; closeChart(); void load() }
onMounted(() => {
  void load(); refreshTimer = setInterval(refreshVisible, 60000)
  window.addEventListener('focus', refreshVisible)
  document.addEventListener('visibilitychange', refreshVisible)
})
onUnmounted(() => {
  disposed = true; version++; request?.abort()
  clearInterval(refreshTimer); clearTimeout(expiryTimer); purchaseController.abort(); closeChart()
  window.removeEventListener('focus', refreshVisible)
  document.removeEventListener('visibilitychange', refreshVisible)
})
</script>
<template>
  <section aria-labelledby="signal-history-heading" class="mt-10 min-w-0 border-t border-(--border-color) pt-8 text-(--text-color)">
    <div class="flex flex-wrap items-start justify-between gap-4"><div><h2 id="signal-history-heading" class="text-2xl font-bold">Signal History</h2><p class="mt-2 text-sm leading-6 text-(--muted-color)">Previous signals organized by week. An active News or Daily subscription unlocks its matching charts and analysis.</p><p class="mt-1 text-xs text-(--muted-color)">Monday–Sunday weeks · {{ timeZone }} · Results recorded by admin</p></div><button type="button" :disabled="refreshing" @click="load(true)" class="min-h-11 rounded-lg border border-(--border-color) px-4 text-sm disabled:opacity-50">{{ refreshing ? 'Refreshing…' : 'Refresh' }}</button></div>
    <div class="mt-5 flex flex-wrap gap-2" aria-label="Filter signal history"><button v-for="filter in filters" :key="filter.value" type="button" :aria-pressed="type === filter.value" @click="selectType(filter.value)" class="min-h-11 rounded-lg border px-4 text-sm font-semibold" :class="type === filter.value ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'border-(--border-color)'">{{ filter.label }}</button></div>
    <div class="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-(--border-color) bg-(--surface-bg) p-4">
      <label class="min-w-0 flex-1 basis-48 text-sm font-semibold">Week
        <select v-model="weekSelection" @change="applyWeekSelection" class="mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-(--border-color) bg-(--input-bg) px-3 text-(--text-color)">
          <option value="latest">Latest available week</option><option value="this">This week</option><option value="last">Last week</option><option value="next">Next week</option><option value="custom">Choose another week</option>
        </select>
      </label>
      <form v-if="weekSelection === 'custom'" @submit.prevent="applyChosenWeek" class="flex min-w-0 flex-1 basis-64 flex-wrap items-end gap-3">
        <label class="min-w-0 flex-1 basis-40 text-sm font-semibold">Select week<input v-model="chosenWeek" type="week" required placeholder="2026-W42" pattern="[0-9]{4}-W[0-9]{2}" class="mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-(--border-color) bg-(--input-bg) px-3 text-(--text-color)" /></label><button type="submit" class="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500">Show week</button>
      </form>
    </div>
    <p v-if="error" role="alert" class="mt-5 text-sm text-red-500">{{ error }}</p>
    <div v-if="loading" role="status" aria-label="Loading signal history" class="mt-6 grid gap-5 lg:grid-cols-2"><span class="sr-only">Loading weekly signals</span><div v-for="n in 2" :key="n" aria-hidden="true" class="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-(--border-color) bg-(--surface-bg)"><div class="animate-pulse motion-reduce:animate-none"><div class="space-y-4 p-4"><div class="h-7 w-20 rounded bg-slate-400/25"></div><div class="h-5 w-3/4 rounded bg-slate-400/25"></div><div class="h-24 rounded bg-slate-400/25"></div></div><div class="aspect-video bg-slate-400/25"></div><div class="space-y-3 p-4"><div class="h-3 rounded bg-slate-400/25"></div><div class="h-3 w-3/4 rounded bg-slate-400/25"></div></div></div></div></div>
    <p v-else-if="!weeks.length && !error" class="mt-6 rounded-xl border border-dashed border-(--border-color) p-8 text-center text-sm text-(--muted-color)">{{ weekSelection === 'next' ? 'No archived signals for next week yet.' : 'No archived signals in this week. Choose Last week or Latest available week.' }}</p>
    <template v-else>
      <section v-for="week in weeks" :key="week.key" class="mt-7" :aria-label="`Signal history for ${weekLabel(week)}`">
        <div class="flex flex-wrap items-center justify-between gap-3"><h3 class="text-lg font-bold sm:text-xl">{{ weekLabel(week) }}</h3><span class="text-xs text-(--muted-color)">{{ week.stats.total }} signals this week</span></div>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div v-for="stat in statItems(week.stats)" :key="stat.label" class="rounded-xl border border-(--border-color) bg-(--surface-bg) p-4"><p class="text-xs text-(--muted-color)">{{ stat.label }}</p><p class="mt-2 text-xl font-bold">{{ stat.value }}</p></div></div>
        <p class="mt-3 text-xs leading-5 text-(--muted-color)">Win rate = wins ÷ (wins + losses). Breakeven, cancelled and pending results are excluded. Counts cover the full selected week.</p>
        <div class="mt-6 grid min-w-0 grid-cols-1 items-stretch gap-x-6 gap-y-6 lg:grid-cols-2"><SignalHistoryCard v-for="signal in week.cards" :key="`${signal.type}:${signal._id}`" :signal="signal" :time-zone="timeZone" :busy="busy" @subscribe="subscribe" @enlarge="openChart" /></div>
        <div v-if="week.pagination.total > week.pagination.limit" class="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p class="text-(--muted-color)">Cards page {{ cardPage }} of {{ Math.ceil(week.pagination.total / week.pagination.limit) }}</p><div class="flex gap-2"><button type="button" :disabled="refreshing || cardPage === 1" @click="changeCardPage(-1)" class="min-h-11 rounded-lg border border-(--border-color) px-4 disabled:opacity-40">Previous cards</button><button type="button" :disabled="refreshing || !week.pagination.hasMore" @click="changeCardPage(1)" class="min-h-11 rounded-lg border border-(--border-color) px-4 disabled:opacity-40">More cards</button></div></div>
      </section>
      <div v-if="pagination.total > 1" class="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-(--border-color) pt-5 text-sm"><p class="text-(--muted-color)">Week {{ page }} of {{ pagination.total }} · newest first</p><div class="flex gap-2"><button type="button" :disabled="refreshing || page === 1" @click="changeWeek(-1)" class="min-h-11 rounded-lg border border-(--border-color) px-4 disabled:opacity-40">Newer week</button><button type="button" :disabled="refreshing || !pagination.hasMore" @click="changeWeek(1)" class="min-h-11 rounded-lg border border-(--border-color) px-4 disabled:opacity-40">Older week</button></div></div>
    </template>
    <dialog ref="dialog" @close="enlarged = null" @click.self="closeChart" class="m-auto max-h-[94dvh] w-[96vw] max-w-6xl overflow-auto rounded-xl border border-slate-600 bg-slate-900 p-3 text-white backdrop:bg-black/80"><div class="mb-3 flex items-center justify-between gap-3"><p class="text-sm font-semibold">{{ enlarged?.pair }} · Historical chart</p><button type="button" autofocus @click="closeChart" class="min-h-11 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">Close</button></div><img v-if="enlarged" :src="enlarged.src" crossorigin="use-credentials" :alt="`${enlarged.pair} historical chart`" class="mx-auto h-auto max-h-[80dvh] max-w-full object-contain" /></dialog>
  </section>
</template>
