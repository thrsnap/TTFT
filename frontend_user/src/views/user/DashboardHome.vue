<script setup>
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../store/user/authStore.js'
import { api } from '../../api/autService.js'
import UserAvatar from '../../components/UserAvatar.vue'
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
let requestPending = false
const username = computed(
  () => auth.user?.username || 'Member',
)
function localizedPath(path) {
  if (route.params.lang !== 'km') return path
  return path === '/' ? '/km' : `/km${path}`
}
const services = [
  {
    title: 'My Courses',
    subtitle: 'Learn at your own pace',
    description: 'Access your purchased courses and continue learning.',
    path: '/dashboard/courses',
    button: 'View my courses',
    icon: 'M3 5h6a3 3 0 0 1 3 3v13a5 5 0 0 0-5-2H3z M21 5h-6a3 3 0 0 0-3 3v13a5 5 0 0 1 5-2h4z',
    color:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  },
  {
    title: 'My Signal',
    subtitle: 'Your trading access',
    description: 'Access your News Signals and Daily Signals.',
    path: '/dashboard/signals',
    button: 'View my signals',
    icon: 'M3 17l6-6 4 4 8-10 M15 5h6v6',
    color:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  {
    title: 'My Challenges',
    subtitle: 'Keep moving forward',
    description: 'Review your enrolled challenges and check their status.',
    path: '/dashboard/challenges',
    button: 'View my challenges',
    icon: 'M8 3h8v6a4 4 0 0 1-8 0z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 13v7 M8 21h8',
    color:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
]
const journalBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .trim()
  .replace(/\/+$/, '')
const journalClock = ref(new Date())
const journalSummary = ref(null)
const journalDays = ref([])
const journalLoading = ref(true)
const journalError = ref('')
const journalChoices = ref([])
const selectedJournalId = ref('default')
const selectedJournal = computed(() => journalChoices.value.find(item => item._id === selectedJournalId.value) || null)
const journalChoicesReady = ref(false)
const journalChoicesLoading = ref(false)
const journalChoicesError = ref('')
const journalOwnerKey = computed(() => String(auth.user?._id ?? auth.user?.id ?? ''))
let journalController
let journalRequestId = 0
let journalChoicesController
let journalChoicesRequestId = 0
let journalClockTimer
let dashboardDisposed = false
const journalIsKhmer = computed(() => route.params.lang === 'km')
const journalLocale = computed(() => journalIsKhmer.value ? 'km-KH' : 'en-US')
const journalCopy = computed(() => journalIsKhmer.value ? {
  title: 'ការជួញដូរខែនេះ', private: 'សម្រាប់អ្នកតែប៉ុណ្ណោះ', open: 'បើកកំណត់ហេតុ',
  refresh: 'ផ្ទុកស្ថិតិឡើងវិញ', loading: 'កំពុងផ្ទុកលទ្ធផលខែនេះ…', error: 'មិនអាចផ្ទុកស្ថិតិការជួញដូរបានទេ។ សូមព្យាយាមម្ដងទៀត។',
  retry: 'ព្យាយាមម្ដងទៀត', net: 'ចំណេញ / ខាតសុទ្ធ', netHint: 'លទ្ធផលក្រោយដកថ្លៃសេវា · USD',
  win: 'អត្រាឈ្នះ', won: 'ឈ្នះ', lost: 'ខាត', flat: 'ស្មើដើម', emotion: 'ស្ថានភាពអារម្មណ៍',
  positive: 'អារម្មណ៍វិជ្ជមាន', noEmotions: 'មិនទាន់បានកត់ត្រាអារម្មណ៍', streak: 'ថ្ងៃជួញដូរជាប់គ្នា',
  active: 'ថ្ងៃដែលបានជួញដូរ', best: 'វែងបំផុត', days: 'ថ្ងៃ', trades: 'ការជួញដូរ',
  calendar: 'ប្រតិទិនលទ្ធផលប្រចាំខែ', week: 'សប្តាហ៍', noTrades: 'មិនទាន់មានការជួញដូរក្នុងខែនេះទេ។',
  start: 'បើកកំណត់ហេតុ ដើម្បីបន្ថែមការជួញដូរដំបូងរបស់អ្នក។', profit: 'ចំណេញ', loss: 'ខាត',
  hint: 'អត្រាឈ្នះមិនរាប់ការស្មើដើម។ ស្ថិតិអារម្មណ៍រាប់តែការជួញដូរដែលបានកត់ត្រាអារម្មណ៍។',
  journal: 'ជ្រើសរើសកំណត់ហេតុ', journalsLoading: 'កំពុងផ្ទុកកំណត់ហេតុរបស់អ្នក…',
  journalsHint: 'ស្ថិតិ និងប្រតិទិនបង្ហាញតែកំណត់ហេតុដែលអ្នកបានជ្រើសរើស។',
} : {
  title: 'This month’s trading', private: 'Private to you', open: 'Open journal',
  refresh: 'Refresh trading summary', loading: 'Loading this month’s results…', error: 'Unable to load your trading summary. Please try again.',
  retry: 'Try again', net: 'Net P&L', netHint: 'Recorded net results · USD',
  win: 'Trade win %', won: 'wins', lost: 'losses', flat: 'breakeven', emotion: 'Emotion meter',
  positive: 'Positive emotions', noEmotions: 'No emotions recorded', streak: 'Daily streak',
  active: 'active days', best: 'Best', days: 'days', trades: 'trades',
  calendar: 'Monthly performance calendar', week: 'Week', noTrades: 'No trades recorded this month.',
  start: 'Open your journal to add your first trade.', profit: 'Profit', loss: 'Loss',
  hint: 'Win rate excludes breakeven trades. Emotions use only tagged trades.',
  journal: 'Choose journal', journalsLoading: 'Loading your journals…',
  journalsHint: 'Statistics and calendar totals follow the selected journal.',
})
const journalToday = computed(() => {
  const value = journalClock.value
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
})
const journalMonth = computed(() => journalToday.value.slice(0, 7))
const journalMonthLabel = computed(() => new Intl.DateTimeFormat(journalLocale.value, {
  month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${journalMonth.value}-01T12:00:00Z`)))
const journalWeekdays = computed(() => journalIsKhmer.value
  ? ['អា', 'ច', 'អ', 'ពុ', 'ព្រ', 'សុ', 'ស']
  : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
const journalDateMap = computed(() => new Map(journalDays.value.map(day => [day.date, day])))
const journalWeeks = computed(() => {
  const [year, month] = journalMonth.value.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const monthLength = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells = Array.from({ length: Math.ceil((firstWeekday + monthLength) / 7) * 7 }, (_, index) => {
    const key = new Date(Date.UTC(year, month - 1, index - firstWeekday + 1)).toISOString().slice(0, 10)
    return {
      key,
      number: Number(key.slice(8)),
      isWeekend: index % 7 === 0 || index % 7 === 6,
      inMonth: key.startsWith(journalMonth.value),
      data: journalDateMap.value.get(key),
    }
  })
  return Array.from({ length: cells.length / 7 }, (_, index) => {
    const days = cells.slice(index * 7, index * 7 + 7)
    const currentDays = days.filter(day => day.inMonth)
    return {
      number: index + 1, days, from: currentDays[0].key, to: currentDays.at(-1).key,
      pnlCents: currentDays.reduce((sum, day) => sum + (day.data?.pnlCents || 0), 0),
      tradeCount: currentDays.reduce((sum, day) => sum + (day.data?.tradeCount || 0), 0),
    }
  })
})
const journalSparkline = computed(() => {
  let total = 0
  const values = [0, ...(journalSummary.value?.days || []).map(day => { total += day.pnlCents; return total })]
  if (values.length === 1) values.push(0)
  const min = Math.min(...values)
  const span = Math.max(...values) - min || 1
  return values.map((value, index) => `${index ? 'L' : 'M'}${(index / (values.length - 1) * 100).toFixed(1)},${(36 - (value - min) / span * 28).toFixed(1)}`).join(' ')
})
function journalMoney(cents = 0, compact = false, signed = false) {
  const abbreviate = compact && Math.abs(cents) >= 100_000
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    ...(abbreviate ? { notation: 'compact', maximumFractionDigits: 1 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ...(signed ? { signDisplay: 'exceptZero' } : {}),
  }).format(cents / 100)
}
const journalPercent = value => value == null ? '—' : `${value.toFixed(1)}%`
const journalTone = value => value > 0 ? 'text-emerald-600 dark:text-emerald-400' : value < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
function journalDateLabel(key) {
  return new Intl.DateTimeFormat(journalLocale.value, { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${key}T12:00:00Z`))
}
function journalDayClass(day) {
  if (!day.inMonth) return 'border-dashed border-slate-200/70 text-slate-300 dark:border-white/5 dark:text-slate-700'
  if (day.data?.pnlCents > 0) return 'border-emerald-400/60 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
  if (day.data?.pnlCents < 0) return 'border-red-400/60 bg-red-50/70 text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
  return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-[#0e1726] dark:text-slate-400'
}
function resetJournalResults() {
  journalController?.abort()
  journalRequestId++
  journalSummary.value = null
  journalDays.value = []
  journalLoading.value = false
  journalError.value = ''
}
function resetJournal() {
  resetJournalResults()
  journalChoicesController?.abort()
  journalChoicesRequestId++
  journalChoices.value = []
  selectedJournalId.value = 'default'
  journalChoicesReady.value = false
  journalChoicesLoading.value = false
  journalChoicesError.value = ''
}
function validJournalId(value) {
  return value === 'default' || (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value))
}
function rememberedJournal() {
  if (!journalOwnerKey.value) return 'default'
  try { return localStorage.getItem(`cmm:trade-journal:${journalOwnerKey.value}:active`) || 'default' }
  catch { return 'default' }
}
function rememberJournal() {
  if (!journalOwnerKey.value) return
  try { localStorage.setItem(`cmm:trade-journal:${journalOwnerKey.value}:active`, selectedJournalId.value) }
  catch { /* Reading and switching journals also works without browser storage. */ }
}
function chooseJournal(id) {
  if (!journalChoicesReady.value || id === selectedJournalId.value || !journalChoices.value.some(item => item._id === id)) return
  selectedJournalId.value = id
  rememberJournal()
}
async function journalSignIn() {
  resetJournal()
  await router.replace({ name: 'login', params: route.params.lang === 'km' ? { lang: 'km' } : {}, query: { redirect: route.fullPath } })
}
async function loadJournalChoices() {
  if (dashboardDisposed || auth.isAuthenticated === false) return
  journalChoicesController?.abort()
  const current = ++journalChoicesRequestId
  const owner = journalOwnerKey.value
  const controller = new AbortController()
  journalChoicesController = controller
  journalChoicesReady.value = false
  journalChoicesLoading.value = true
  journalChoicesError.value = ''
  resetJournalResults()
  const isCurrent = () => current === journalChoicesRequestId && owner === journalOwnerKey.value && !dashboardDisposed && auth.isAuthenticated !== false
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, 20000)
  try {
    const response = await fetch(`${journalBase}/api/trade-journal/journals`, {
      credentials: 'include', cache: 'no-store', signal: controller.signal,
    })
    if (!isCurrent()) return
    if (response.status === 401) { await journalSignIn(); return }
    const data = await response.json().catch(() => null)
    if (!isCurrent()) return
    if (!response.ok) throw new Error(data?.message || journalCopy.value.error)
    if (!Array.isArray(data?.journals) || !data.journals.some(item => item?._id === 'default') ||
      !data.journals.every(item => item && validJournalId(item._id) && typeof item.name === 'string')) {
      throw new Error(journalCopy.value.error)
    }
    journalChoices.value = data.journals
    const desired = rememberedJournal()
    selectedJournalId.value = journalChoices.value.some(item => item._id === desired) ? desired : 'default'
    rememberJournal()
    journalChoicesReady.value = true
  } catch (failure) {
    if ((failure.name !== 'AbortError' || timedOut) && isCurrent()) journalChoicesError.value = failure.message || journalCopy.value.error
  } finally {
    clearTimeout(timeout)
    if (current === journalChoicesRequestId) journalChoicesLoading.value = false
  }
}
async function loadMonthlyJournal() {
  if (dashboardDisposed || !journalChoicesReady.value || auth.isAuthenticated === false) return
  journalController?.abort()
  const current = ++journalRequestId
  const controller = new AbortController()
  journalController = controller
  journalLoading.value = true
  journalError.value = ''
  const owner = journalOwnerKey.value
  const selectedId = selectedJournalId.value
  const monthValue = journalMonth.value
  const isCurrent = () => current === journalRequestId && owner === journalOwnerKey.value && selectedId === selectedJournalId.value && monthValue === journalMonth.value && journalChoicesReady.value && !dashboardDisposed && auth.isAuthenticated !== false
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, 20000)
  const [year, month] = journalMonth.value.split('-').map(Number)
  const params = new URLSearchParams({
    month: monthValue,
    from: `${monthValue}-01`,
    to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
    today: journalToday.value,
    journalId: selectedId,
  })
  try {
    const response = await fetch(`${journalBase}/api/trade-journal/overview?${params}`, {
      credentials: 'include', cache: 'no-store', signal: controller.signal,
    })
    if (!isCurrent()) return
    if (response.status === 401) {
      await journalSignIn()
      return
    }
    const data = await response.json().catch(() => null)
    if (!isCurrent()) return
    if (!response.ok) throw new Error(data?.message || journalCopy.value.error)
    if (!data?.summary || !Array.isArray(data.calendar) || data.month !== monthValue) throw new Error(journalCopy.value.error)
    journalSummary.value = data.summary
    journalDays.value = data.calendar
  } catch (failure) {
    if ((failure.name !== 'AbortError' || timedOut) && isCurrent()) journalError.value = failure.message || journalCopy.value.error
  } finally {
    clearTimeout(timeout)
    if (current === journalRequestId) journalLoading.value = false
  }
}
async function loadDashboard() {
  if (requestPending) return
  requestPending = true
  loading.value = true
  error.value = ''
  try {
    await api('/dashboard')
  } catch (failure) {
    error.value =
      failure?.message || 'Unable to refresh your dashboard.'
  } finally {
    loading.value = false
    requestPending = false
  }
}
watch([journalToday, selectedJournalId, journalChoicesReady], ([, , ready]) => {
  if (!ready || auth.isAuthenticated === false) return
  resetJournalResults()
  void loadMonthlyJournal()
})
watch(() => auth.user?._id ?? auth.user?.id, (next, previous) => {
  if (next === previous) return
  resetJournal()
  if (next && auth.isAuthenticated !== false) void loadJournalChoices()
})
watch(() => auth.isAuthenticated, authenticated => {
  if (!authenticated) resetJournal()
  else if (!journalChoicesReady.value && !journalChoicesLoading.value) void loadJournalChoices()
})
onMounted(() => {
  void loadDashboard()
  void loadJournalChoices()
  journalClockTimer = setInterval(() => { journalClock.value = new Date() }, 60000)
})
onActivated(() => {
  if (!dashboardDisposed && !journalChoicesLoading.value) void loadJournalChoices()
})
onDeactivated(() => { resetJournal() })
onUnmounted(() => {
  dashboardDisposed = true
  resetJournal()
  clearInterval(journalClockTimer)
})
</script>
<template>
  <main
    class="w-full min-w-0 space-y-6 p-4
           text-slate-900 sm:p-6 lg:p-8 dark:text-slate-100"
  >
    <!-- Welcome -->
    <div class="flex min-w-0 items-center gap-3">
      <UserAvatar class="size-12 text-lg sm:size-14 sm:text-xl" decorative />
      <h1
        class="min-w-0 break-words text-xl font-semibold leading-tight
               tracking-tight text-slate-900 sm:text-2xl dark:text-white"
      >
        Hay!!   Welcome Back, {{ username }}
      </h1>
    </div>
    <!-- Request status -->
    <div v-if="loading || error" aria-live="polite">
      <p
        v-if="loading"
        role="status"
        class="text-sm text-slate-600 dark:text-slate-300"
      >
        Refreshing your workspace…
      </p>
      <div
        v-else-if="error"
        role="alert"
        class="flex flex-wrap items-center justify-between
               gap-3 rounded-xl border border-red-200
               bg-red-50 p-4 text-sm text-red-700
               dark:border-red-500/20 dark:bg-red-500/10
               dark:text-red-300"
      >
        <p>{{ error }}</p>
        <button
          type="button"
          class="cursor-pointer font-semibold underline
                 underline-offset-4"
          @click="loadDashboard"
        >
          Try again
        </button>
      </div>
    </div>
    <!-- Current-month private trading overview -->
    <section
      class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-[#111c2d]"
      :class="{ 'font-khmer': journalIsKhmer }"
      :aria-busy="journalChoicesLoading || journalLoading"
      aria-labelledby="dashboard-trading-title"
    >
      <div class="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ journalMonthLabel }} · {{ journalCopy.private }}</p>
          <h2 id="dashboard-trading-title" class="text-lg font-semibold text-slate-900 dark:text-white">{{ journalCopy.title }}</h2>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="journalSummary" class="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">{{ journalSummary.tradeCount }} {{ journalCopy.trades }}</span>
          <button type="button" :disabled="journalChoicesLoading || journalLoading" :aria-label="journalCopy.refresh" :title="journalCopy.refresh" class="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300" @click="loadJournalChoices">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="size-4" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5m-4-3a7 7 0 0 1 12-4l3 3M4 16l3 3a7 7 0 0 0 12-4" /></svg>
          </button>
          <RouterLink :to="localizedPath('/dashboard/trade-journal')" class="inline-flex min-h-9 items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500">{{ journalCopy.open }} <span aria-hidden="true">↗</span></RouterLink>
        </div>
      </div>
      <div class="mb-5 flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:flex-row sm:items-end sm:p-4 dark:border-slate-700 dark:bg-[#0c1422]">
        <label for="dashboard-active-journal" class="block w-full min-w-0 text-[11px] font-semibold leading-5 sm:max-w-md sm:flex-1">
          {{ journalCopy.journal }}
          <select id="dashboard-active-journal" :value="selectedJournalId" :disabled="!journalChoicesReady || journalChoicesLoading" class="mt-1.5 block w-full min-w-0 truncate rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-[#111c2d] dark:text-slate-100" @change="chooseJournal($event.target.value)">
            <option v-if="!journalChoicesReady" value="default">{{ journalChoicesLoading ? journalCopy.journalsLoading : journalCopy.journal }}</option>
            <option v-for="item in (journalChoicesReady ? journalChoices : [])" :key="item._id" :value="item._id">{{ item.name }}</option>
          </select>
        </label>
        <div class="min-w-0 flex-1 text-[11px] leading-6 text-slate-500 dark:text-slate-400">
          <p v-if="selectedJournal && (selectedJournal.broker || selectedJournal.accountLabel)" class="break-words font-medium text-slate-700 dark:text-slate-300">{{ [selectedJournal.broker, selectedJournal.accountLabel].filter(Boolean).join(' · ') }}</p>
          <p>{{ journalCopy.journalsHint }}</p>
        </div>
      </div>
      <p v-if="(journalChoicesLoading || journalLoading) && !journalSummary" role="status" class="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500 dark:bg-white/5 dark:text-slate-400">{{ journalChoicesLoading ? journalCopy.journalsLoading : journalCopy.loading }}</p>
      <div v-else-if="journalChoicesError || journalError" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><p>{{ journalChoicesError || journalError }}</p><button type="button" class="font-semibold underline underline-offset-4" @click="loadJournalChoices">{{ journalCopy.retry }}</button></div>
      <div v-else-if="journalChoicesReady && journalSummary" :class="{ 'opacity-60': journalLoading }">
        <div class="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article class="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-[#0c1422]">
            <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ journalCopy.net }}</p>
            <div class="mt-3 flex items-center justify-between gap-2"><strong class="text-2xl font-bold tracking-tight tabular-nums" :class="journalTone(journalSummary.pnlCents)" :title="journalMoney(journalSummary.pnlCents)">{{ journalMoney(journalSummary.pnlCents, Math.abs(journalSummary.pnlCents) >= 1_000_000) }}</strong><svg viewBox="0 0 100 42" class="h-9 w-14 shrink-0" :class="journalTone(journalSummary.pnlCents)" aria-hidden="true"><path :d="`${journalSparkline} L100,42 L0,42 Z`" fill="currentColor" opacity=".12" /><path :d="journalSparkline" fill="none" stroke="currentColor" stroke-width="2" /></svg></div>
            <p class="mt-2 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{{ journalCopy.netHint }}</p>
          </article>
          <article class="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-[#0c1422]">
            <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ journalCopy.emotion }}</p>
            <strong class="mt-3 block text-2xl font-bold tracking-tight text-violet-600 tabular-nums dark:text-violet-300">{{ journalPercent(journalSummary.positiveRate) }}</strong>
            <p class="mt-2 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{{ journalSummary.tagged ? journalCopy.positive : journalCopy.noEmotions }}</p>
          </article>
          <article class="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-[#0c1422]">
            <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ journalCopy.win }}</p>
            <strong class="mt-3 block text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{{ journalPercent(journalSummary.winRate) }}</strong>
            <p class="mt-2 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{{ journalSummary.wins }} {{ journalCopy.won }} · {{ journalSummary.losses }} {{ journalCopy.lost }} · {{ journalSummary.breakeven }} {{ journalCopy.flat }}</p>
          </article>
          <article class="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-[#0c1422]">
            <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ journalCopy.streak }}</p>
            <strong class="mt-3 block text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{{ journalSummary.currentStreak }} <small class="text-xs font-normal text-slate-500 dark:text-slate-400">{{ journalCopy.days }}</small></strong>
            <p class="mt-2 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{{ journalSummary.activeDays }} {{ journalCopy.active }} · {{ journalCopy.best }} {{ journalSummary.longestStreak }}</p>
          </article>
        </div>
        <div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_170px]">
          <div class="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4 dark:border-slate-700">
            <h3 class="mb-3 px-1 text-base font-semibold text-violet-600 dark:text-violet-300">{{ journalMonthLabel }}</h3>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[420px] table-fixed border-separate border-spacing-1.5 text-center">
                <caption class="sr-only">{{ journalCopy.calendar }} — {{ journalMonthLabel }}</caption>
                <thead>
                  <tr>
                    <th
                      v-for="(day, index) in journalWeekdays"
                      :key="index"
                      scope="col"
                      class="pb-2 text-[10px] font-medium"
                      :class="index === 0 || index === 6
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-500 dark:text-slate-400'"
                    >
                      {{ day }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="week in journalWeeks" :key="week.number">
                    <td v-for="day in week.days" :key="day.key" class="p-0 align-top">
                      <div class="relative flex min-h-[78px] min-w-0 flex-col items-center justify-end gap-1 rounded-lg border px-1 pb-2 pt-7" :class="journalDayClass(day)" :aria-hidden="!day.inMonth" :title="day.inMonth ? `${journalDateLabel(day.key)}: ${day.data ? journalMoney(day.data.pnlCents, false, true) : '—'}` : ''">
                        <span
                          class="absolute right-2 top-1.5 text-[10px]"
                          :class="[
                            day.key === journalToday
                              ? (day.isWeekend
                                ? 'rounded bg-red-100 px-1.5 py-0.5 dark:bg-red-500/15'
                                : 'rounded bg-violet-600 px-1.5 py-0.5')
                              : '',
                            day.isWeekend
                              ? 'font-semibold text-red-600 dark:text-red-400'
                              : day.key === journalToday
                                ? 'text-white'
                                : '',
                          ]"
                        >
                          {{ day.number }}
                        </span>
                        <template v-if="day.inMonth && day.data"><strong class="text-[10px] font-bold whitespace-nowrap tabular-nums sm:text-[11px]"><span class="sm:hidden">{{ journalMoney(day.data.pnlCents, true, true) }}</span><span class="hidden sm:inline">{{ journalMoney(day.data.pnlCents, Math.abs(day.data.pnlCents) >= 1_000_000, true) }}</span></strong><span class="text-[8px] whitespace-nowrap text-slate-500 dark:text-slate-400">{{ day.data.tradeCount }} {{ journalCopy.trades }}</span></template>
                        <span v-else-if="day.inMonth" aria-hidden="true" class="text-slate-300 dark:text-slate-700">·</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mt-3 flex flex-wrap justify-center gap-4 text-[10px] text-slate-500 dark:text-slate-400"><span class="flex items-center gap-1.5"><i class="size-1.5 rounded-full bg-emerald-500"></i>{{ journalCopy.profit }}</span><span class="flex items-center gap-1.5"><i class="size-1.5 rounded-full bg-red-500"></i>{{ journalCopy.loss }}</span><span class="flex items-center gap-1.5"><i class="size-1.5 rounded-full bg-slate-400"></i>{{ journalCopy.flat }}</span></div>
          </div>
          <aside class="grid grid-cols-2 content-start gap-3 sm:grid-cols-3 xl:grid-cols-1" :aria-label="journalCopy.week">
            <article v-for="week in journalWeeks" :key="week.number" class="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-[#0c1422]">
              <div class="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400"><span>{{ journalCopy.week }} {{ week.number }}</span><small class="text-[8px]">{{ journalDateLabel(week.from) }} – {{ journalDateLabel(week.to) }}</small></div>
              <strong class="mt-2 block text-lg font-bold tabular-nums" :class="journalTone(week.pnlCents)" :title="journalMoney(week.pnlCents, false, true)">{{ journalMoney(week.pnlCents, Math.abs(week.pnlCents) >= 1_000_000, true) }}</strong>
              <p class="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{{ week.tradeCount }} {{ journalCopy.trades }}</p>
            </article>
          </aside>
        </div>
        <div v-if="!journalSummary.tradeCount" class="mt-4 rounded-xl bg-violet-50 p-4 text-sm text-violet-700 dark:bg-violet-500/10 dark:text-violet-200"><strong>{{ journalCopy.noTrades }}</strong> <RouterLink :to="localizedPath('/dashboard/trade-journal')" class="underline underline-offset-4">{{ journalCopy.start }}</RouterLink></div>
        <p class="mt-4 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{{ journalCopy.hint }}</p>
      </div>
    </section>
    <!-- Services -->
    <section aria-labelledby="dashboard-services-title">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2
          id="dashboard-services-title"
          class="text-base font-semibold text-slate-900 dark:text-white"
        >
          Your services
        </h2>
        <span class="text-xs text-slate-500 dark:text-slate-400">
          Quick access
        </span>
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="service in services"
          :key="service.path"
          class="flex min-w-0 flex-col rounded-2xl
                 border border-slate-200 bg-white p-5 shadow-sm
                 transition hover:border-emerald-400
                 dark:border-slate-700 dark:bg-[#111c2d]
                 dark:hover:border-emerald-500/50"
        >
          <span
            :class="service.color"
            class="flex size-11 items-center justify-center rounded-xl"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-5"
            >
              <path :d="service.icon" />
            </svg>
          </span>
          <h3
            class="mt-4 text-lg font-semibold
                   text-slate-900 dark:text-white"
          >
            {{ service.title }}
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ service.subtitle }}
          </p>
          <p
            class="mt-3 text-sm leading-6
                   text-slate-600 dark:text-slate-300"
          >
            {{ service.description }}
          </p>
          <div class="mt-auto pt-5">
            <RouterLink
              :to="localizedPath(service.path)"
              class="flex items-center justify-between gap-3
                     rounded-xl bg-slate-100 px-4 py-3
                     text-sm font-semibold text-emerald-800
                     transition hover:bg-emerald-100
                     focus-visible:outline-2
                     focus-visible:outline-emerald-500
                     dark:bg-white/5 dark:text-emerald-300
                     dark:hover:bg-emerald-500/15"
            >
              <span>{{ service.button }}</span>
              <span aria-hidden="true">→</span>
            </RouterLink>
          </div>
        </article>
      </div>
    </section>
    <!-- Account and support -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section
        class="min-w-0 rounded-2xl border border-slate-200
               bg-white p-5 dark:border-slate-700 dark:bg-[#111c2d]"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2
            class="text-base font-semibold
                   text-slate-900 dark:text-white"
          >
            Account status
          </h2>
          <span
            class="inline-flex items-center gap-2 rounded-full
                   px-3 py-1 text-xs font-semibold"
            :class="
              auth.user?.emailVerified
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
            "
          >
            <span
              aria-hidden="true"
              class="size-1.5 rounded-full bg-current"
            />
            {{ auth.user?.emailVerified ? 'Verified' : 'Unverified' }}
          </span>
        </div>
        <p
          class="mt-4 break-all text-sm font-medium
                 text-slate-700 dark:text-slate-200"
        >
          {{ auth.user?.email || '—' }}
        </p>
        <RouterLink
          :to="localizedPath('/dashboard/profile')"
          class="mt-4 inline-flex items-center gap-2 text-sm
                 font-semibold text-emerald-700 hover:underline
                 dark:text-emerald-300"
        >
          My information
          <span aria-hidden="true">→</span>
        </RouterLink>
      </section>
      <section
        class="min-w-0 rounded-2xl border border-slate-200
               bg-white p-5 dark:border-slate-700 dark:bg-[#111c2d]"
      >
        <h2
          class="text-base font-semibold
                 text-slate-900 dark:text-white"
        >
          We’re here to help
        </h2>
        <p
          class="mt-3 text-sm leading-6
                 text-slate-600 dark:text-slate-300"
        >
          Questions about your account, courses, or access?
          Visit your support inbox.
        </p>
        <RouterLink
          :to="localizedPath('/dashboard/support')"
          class="mt-4 inline-flex items-center gap-2 text-sm
                 font-semibold text-emerald-700 hover:underline
                 dark:text-emerald-300"
        >
          Open support
          <span aria-hidden="true">→</span>
        </RouterLink>
      </section>
    </div>
  </main>
</template>