<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../store/user/authStore.js'
import en from '../../locales/langs/journal/tradingJournal.en.js'
import km from '../../locales/langs/journal/tradingJournal.km.js'
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim().replace(/\/+$/, '')
const API = '/api/trade-journal'
const isKhmer = computed(() => route.params.lang === 'km')
const locale = computed(() => isKhmer.value ? 'km-KH' : 'en-US')


const c = computed(() => isKhmer.value ? { ...en, ...km } : en)
const clock = ref(new Date())
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = computed(() => dateKey(clock.value))
const calendarMonth = ref(today.value.slice(0, 7))
const preset = ref('thisMonth')
const customRange = ref(null)
const customDraft = reactive({ from: '', to: '' })
const customRangeOpen = ref(false)
const customError = ref('')
const selectedDate = ref('')
const search = ref('')
const searchQuery = ref('')
const summary = ref(null)
const calendarDays = ref([])
const trades = ref([])
const nextCursor = ref(null)
const overviewLoading = ref(false)
const listLoading = ref(false)
const overviewError = ref('')
const listError = ref('')
const notice = ref('')
const editor = ref(null)
const deleteDialog = ref(null)
const editing = ref(null)
const deletingTrade = ref(null)
const saving = ref(false)
const deleting = ref(false)
const formError = ref('')
const form = reactive({ tradeDate: today.value, symbol: '', side: 'buy', pnl: '', emotion: '', strategy: '', notes: '' })
const emotionValues = ['calm', 'confident', 'focused', 'neutral', 'anxious', 'frustrated', 'impulsive']
const presetValues = ['thisMonth', 'lastMonth', 'lastQuarter', 'lastYear', 'all']
let overviewController
let listController
let overviewId = 0
let listId = 0
let searchTimer
let noticeTimer
let clockTimer
let disposed = false

const utcKey = (year, month, day = 1) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
function monthBounds(month) {
    const [year, index] = month.split('-').map(Number)
    return { from: `${month}-01`, to: utcKey(year, index, 0) }
}
const range = computed(() => {
    const year = Number(today.value.slice(0, 4))
    const month = Number(today.value.slice(5, 7)) - 1
    if (preset.value === 'custom' && customRange.value) return customRange.value
    if (preset.value === 'all') return { from: null, to: null }
    if (preset.value === 'lastYear') return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
    if (preset.value === 'lastQuarter') {
        const start = Math.floor(month / 3) * 3 - 3
        return { from: utcKey(year, start), to: utcKey(year, start + 3, 0) }
    }
    return monthBounds(calendarMonth.value)
})
const isCustomRange = computed(() => preset.value === 'custom' && customRange.value !== null)
const rangeLabel = computed(() => range.value.from ? `${formatDate(range.value.from)} – ${formatDate(range.value.to)}` : c.value.all)
const monthLabel = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${calendarMonth.value}-01T12:00:00Z`)))
const weekdays = computed(() => isKhmer.value ? ['អា', 'ច', 'អ', 'ពុ', 'ព្រ', 'សុ', 'ស'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
const byDate = computed(() => new Map(calendarDays.value.map((day) => [day.date, day])))
const cells = computed(() => {
    const [year, month] = calendarMonth.value.split('-').map(Number)
    const offset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
        const key = utcKey(year, month - 1, index - offset + 1)
        const inRange = !isCustomRange.value || (key >= range.value.from && key <= range.value.to)
        return { key, day: Number(key.slice(8)), inMonth: key.startsWith(calendarMonth.value), inRange, data: inRange ? byDate.value.get(key) : undefined }
    })
})
const weeks = computed(() => Array.from({ length: cells.value.length / 7 }, (_, index) => {
    const days = cells.value.slice(index * 7, index * 7 + 7).filter((day) => day.inMonth)
    return {
        index: index + 1, from: days[0]?.key, to: days.at(-1)?.key,
        pnlCents: days.reduce((sum, day) => sum + (day.data?.pnlCents || 0), 0),
        count: days.reduce((sum, day) => sum + (day.data?.tradeCount || 0), 0),
    }
}))
const sparkline = computed(() => {
    let total = 0
    const values = [0, ...(summary.value?.days || []).map((day) => { total += day.pnlCents; return total })]
    if (values.length === 1) values.push(0)
    const min = Math.min(...values)
    const span = Math.max(...values) - min || 1
    return values.map((value, index) => `${index ? 'L' : 'M'}${(index / (values.length - 1) * 100).toFixed(1)},${(38 - (value - min) / span * 30).toFixed(1)}`).join(' ')
})
const emotionBars = computed(() => (summary.value?.days || []).slice(-15).map((day) => ({ date: day.date, height: day.tagged ? Math.max(8, day.positive / day.tagged * 100) : 8, tagged: day.tagged > 0 })))
const factor = computed(() => !summary.value?.tradeCount ? '—' : summary.value.grossLossCents ? (summary.value.grossProfitCents / summary.value.grossLossCents).toFixed(2) : summary.value.grossProfitCents ? '∞' : '—')

function formatDate(key, short = false) {
    if (!key) return ''
    return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: short ? 'short' : 'short', ...(short ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`))
}
function money(cents = 0, signed = false, compact = false) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', ...(compact && Math.abs(cents) >= 1_000_000 ? { notation: 'compact', maximumFractionDigits: 1 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }), ...(signed ? { signDisplay: 'exceptZero' } : {}) }).format(cents / 100)
}
const percent = (value) => value == null ? '—' : `${value.toFixed(1)}%`
const tone = (value) => value > 0 ? 'text-emerald-600 dark:text-emerald-400' : value < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
const countLabel = (count) => `${count} ${count === 1 ? c.value.trade : c.value.trades}`
const emotionLabel = (value) => value ? c.value[value] || value : '—'

function choosePreset(value) {
    customRangeOpen.value = false
    customError.value = ''
    preset.value = value
    selectedDate.value = ''
    const year = Number(today.value.slice(0, 4))
    const month = Number(today.value.slice(5, 7)) - 1
    calendarMonth.value = value === 'lastMonth' ? utcKey(year, month - 1).slice(0, 7)
        : value === 'lastQuarter' ? utcKey(year, Math.floor(month / 3) * 3, 0).slice(0, 7)
            : value === 'lastYear' ? `${year - 1}-12` : today.value.slice(0, 7)
}
function openCustomRange() {
    const current = range.value.from ? range.value : monthBounds(calendarMonth.value)
    Object.assign(customDraft, current)
    customError.value = ''
    customRangeOpen.value = true
}
function validRangeDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') return false
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
function applyCustomRange() {
    customError.value = ''
    if (!customDraft.from || !customDraft.to) { customError.value = 'rangeRequired'; return }
    if (!validRangeDate(customDraft.from) || !validRangeDate(customDraft.to)) { customError.value = 'rangeInvalid'; return }
    if (customDraft.from > customDraft.to) { customError.value = 'rangeOrder'; return }
    customRange.value = { from: customDraft.from, to: customDraft.to }
    calendarMonth.value = customDraft.from.slice(0, 7)
    selectedDate.value = ''
    preset.value = 'custom'
    customRangeOpen.value = false
}
function adjacentMonth(delta) {
    const [year, month] = calendarMonth.value.split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1 + delta, 1))
    if (next.getUTCFullYear() < 1900 || next.getUTCFullYear() > 9999) return ''
    return next.toISOString().slice(0, 7)
}
function canMoveMonth(delta) {
    const next = adjacentMonth(delta)
    return Boolean(next && (!isCustomRange.value || (next >= range.value.from.slice(0, 7) && next <= range.value.to.slice(0, 7))))
}
function moveMonth(delta) {
    if (!canMoveMonth(delta)) return
    const next = adjacentMonth(delta)
    calendarMonth.value = next
    if (!isCustomRange.value) {
        preset.value = 'customMonth'
        customRangeOpen.value = false
        customError.value = ''
    }
    selectedDate.value = ''
}
function queryString(forEntries = false) {
    const params = new URLSearchParams({ month: calendarMonth.value, today: today.value })
    if (forEntries && selectedDate.value) { params.set('from', selectedDate.value); params.set('to', selectedDate.value) }
    else if (range.value.from) { params.set('from', range.value.from); params.set('to', range.value.to) }
    else params.set('all', '1')
    if (searchQuery.value) params.set('q', searchQuery.value)
    return params.toString()
}
const overviewQuery = computed(() => queryString())
const entriesQuery = computed(() => queryString(true))
function clearPrivateData() {
    summary.value = null; calendarDays.value = []; trades.value = []; nextCursor.value = null
    overviewLoading.value = false; listLoading.value = false
    overviewError.value = ''; listError.value = ''; notice.value = ''
    editing.value = null; deletingTrade.value = null
    editor.value?.close(); deleteDialog.value?.close()
}
async function request(path, options = {}) {
    const timeoutController = new AbortController()
    let timedOut = false
    const cancel = () => timeoutController.abort()
    if (options.signal?.aborted) cancel()
    options.signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => { timedOut = true; timeoutController.abort() }, 25000)
    try {
        const headers = new Headers(options.headers)
        if (options.method && options.method !== 'GET') headers.set('X-CMM-Request', '1')
        const response = await fetch(`${BASE}${API}${path}`, { ...options, headers, signal: timeoutController.signal, credentials: 'include' })
        if (response.status === 401) {
            clearPrivateData()
            await router.replace({ name: 'login', params: isKhmer.value ? { lang: 'km' } : {}, query: { redirect: route.fullPath } })
            throw new Error(c.value.signIn)
        }
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.message || c.value.error)
        if (!data) throw new Error(c.value.error)
        return data
    } catch (error) {
        if (timedOut) throw new Error(c.value.timeout)
        throw error
    } finally {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', cancel)
    }
}
async function loadOverview() {
    if (disposed) return
    overviewController?.abort()
    const current = ++overviewId
    overviewController = new AbortController()
    overviewLoading.value = true; overviewError.value = ''
    try {
        const data = await request(`/overview?${overviewQuery.value}`, { signal: overviewController.signal })
        if (current !== overviewId || disposed) return
        if (!data.summary || !Array.isArray(data.calendar)) throw new Error(c.value.error)
        summary.value = data.summary; calendarDays.value = data.calendar
    } catch (error) {
        if (error.name !== 'AbortError' && current === overviewId && !disposed) overviewError.value = error.message
    } finally { if (current === overviewId) overviewLoading.value = false }
}
async function loadEntries(append = false) {
    if (disposed || (append && !nextCursor.value)) return
    listController?.abort()
    const current = ++listId
    listController = new AbortController()
    listLoading.value = true; listError.value = ''
    const params = new URLSearchParams(entriesQuery.value)
    params.set('limit', '20')
    if (append) params.set('cursor', nextCursor.value)
    else { trades.value = []; nextCursor.value = null }
    try {
        const data = await request(`?${params}`, { signal: listController.signal })
        if (current !== listId || disposed) return
        if (!Array.isArray(data.trades)) throw new Error(c.value.error)
        trades.value = [...new Map([...(append ? trades.value : []), ...data.trades].map((entry) => [entry._id, entry])).values()]
        nextCursor.value = data.nextCursor || null
    } catch (error) {
        if (error.name !== 'AbortError' && current === listId && !disposed) listError.value = error.message
    } finally { if (current === listId) listLoading.value = false }
}
const refreshAll = () => Promise.all([loadOverview(), loadEntries()])
function notify(message) {
    notice.value = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice.value = '' }, 5000)
}
async function openEditor(entry = null) {
    editing.value = entry
    formError.value = ''
    Object.assign(form, { tradeDate: entry?.tradeDate || selectedDate.value || today.value, symbol: entry?.symbol || '', side: entry?.side || 'buy', pnl: entry ? (entry.pnlCents / 100).toFixed(2) : '', emotion: entry?.emotion || '', strategy: entry?.strategy || '', notes: entry?.notes || '' })
    await nextTick()
    editor.value?.showModal()
}
function closeEditor() { if (!saving.value) editor.value?.close() }
async function saveEntry() {
    if (saving.value) return
    saving.value = true; formError.value = ''
    const original = editing.value
    try {
        await request(original ? `/${original._id}` : '', { method: original ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, pnl: String(form.pnl), ...(original ? { version: original.version } : {}) }) })
        editor.value?.close()
        notify(original ? c.value.updated : c.value.saved)
        await refreshAll()
    } catch (error) { formError.value = error.message || c.value.error }
    finally { saving.value = false }
}
async function askDelete(entry) { deletingTrade.value = entry; formError.value = ''; await nextTick(); deleteDialog.value?.showModal() }
async function deleteEntry() {
    if (!deletingTrade.value || deleting.value) return
    deleting.value = true; formError.value = ''
    const entry = deletingTrade.value
    try {
        await request(`/${entry._id}?${new URLSearchParams({ version: entry.version })}`, { method: 'DELETE' })
        deleteDialog.value?.close(); notify(c.value.deleted); await refreshAll()
    } catch (error) { formError.value = error.message || c.value.error }
    finally { deleting.value = false }
}

watch(search, (value) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { searchQuery.value = value.trim() }, 300) })
watch(overviewQuery, () => { void loadOverview() })
watch(entriesQuery, () => { void loadEntries() })
watch(() => auth.user?._id ?? auth.user?.id, (next, previous) => {
    if (next === previous) return
    overviewController?.abort(); listController?.abort(); overviewId++; listId++
    clearPrivateData()
    if (next) void refreshAll()
})
watch(() => auth.isAuthenticated, (value) => {
    if (!value) { overviewController?.abort(); listController?.abort(); overviewId++; listId++; clearPrivateData() }
})
watch(today, () => { if (preset.value === 'thisMonth' || preset.value === 'lastMonth') choosePreset(preset.value) })
onMounted(() => { void refreshAll(); clockTimer = setInterval(() => { clock.value = new Date() }, 60000) })
onUnmounted(() => {
    disposed = true; overviewId++; listId++
    overviewController?.abort(); listController?.abort()
    clearTimeout(searchTimer); clearTimeout(noticeTimer); clearInterval(clockTimer)
})
</script>

<template>
  <section
    class="min-w-0 rounded-2xl bg-slate-50 p-4 text-slate-900 scheme-light sm:p-5 lg:p-7 dark:bg-[#0d1422] dark:text-slate-100 dark:scheme-dark"
    :class="{ 'font-[Kantumruy_Pro,sans-serif]': isKhmer }"
    :lang="isKhmer ? 'km' : 'en'"
  >
    <header class="mb-6 flex flex-wrap items-start justify-between gap-5">
      <div class="min-w-0">
        <p class="mb-2 text-[10px] font-bold tracking-[0.18em] text-violet-600 dark:text-violet-300">{{ c.eyebrow }}</p>
        <h1 class="break-words text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{{ c.title }}</h1>
        <p class="mt-2 text-xs leading-6 text-slate-500 sm:text-[13px] dark:text-slate-400">{{ c.subtitle }}</p>
      </div>
      <div class="flex w-full flex-wrap items-center justify-end gap-2.5 lg:w-auto">
        <span class="mr-auto inline-flex items-center gap-1.5 text-[11px] text-slate-500 lg:mr-1 dark:text-slate-400">
          <svg class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></svg>
          {{ c.private }}
        </span>
        <button type="button" class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-violet-400 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400" :aria-label="c.refresh" :disabled="overviewLoading || listLoading" @click="refreshAll">
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5m-4-3a7 7 0 0 1 12-4l3 3M4 16l3 3a7 7 0 0 0 12-4" /></svg>
        </button>
        <button type="button" class="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500" data-testid="add-trade" @click="openEditor()"><span class="text-lg leading-none" aria-hidden="true">＋</span>{{ c.add }}</button>
      </div>
    </header>

    <p v-if="notice" class="mb-3.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-3 text-xs leading-6 text-emerald-700 dark:text-emerald-300" role="status">{{ notice }}</p>

    <div class="flex flex-col gap-3.5 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex min-w-0 flex-wrap gap-1.5" :aria-label="c.periodTrades">
        <button v-for="item in presetValues" :key="item" type="button" class="cursor-pointer rounded-lg border px-3 py-2 text-[11px] font-semibold leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500" :class="preset === item ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-violet-400 dark:border-slate-700 dark:bg-[#111b2d] dark:text-slate-400'" :aria-pressed="preset === item" @click="choosePreset(item)">{{ c[item] }}</button>
        <button id="tj-custom-range-toggle" type="button" class="cursor-pointer rounded-lg border px-3 py-2 text-[11px] font-semibold leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500" :class="isCustomRange ? 'border-violet-500 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-violet-400 dark:border-slate-700 dark:bg-[#111b2d] dark:text-slate-400'" :aria-pressed="isCustomRange" :aria-expanded="customRangeOpen" aria-controls="tj-custom-range" @click="openCustomRange">{{ c.custom }}</button>
      </div>
      <label class="flex w-full min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-500 focus-within:border-violet-500 lg:w-60 lg:shrink-0 dark:border-slate-700 dark:bg-[#111b2d] dark:text-slate-400">
        <svg class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input v-model="search" class="w-full min-w-0 border-0 bg-transparent text-[11px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100" type="search" maxlength="80" :placeholder="c.search" :aria-label="c.search">
      </label>
    </div>

    <form v-if="customRangeOpen" id="tj-custom-range" class="mt-3.5 grid grid-cols-1 items-end gap-3.5 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] dark:border-slate-700 dark:bg-[#111b2d]" aria-labelledby="tj-custom-range-toggle" novalidate @submit.prevent="applyCustomRange" @input="customError = ''">
      <label for="tj-range-from" class="block min-w-0 text-[11px] font-semibold leading-5">{{ c.fromDate }}
        <input id="tj-range-from" v-model="customDraft.from" class="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 aria-invalid:border-rose-500 dark:border-slate-700 dark:bg-[#111d30] dark:text-slate-100" type="date" min="1900-01-01" :max="customDraft.to || '9999-12-31'" required :aria-invalid="Boolean(customError)" :aria-describedby="customError ? 'tj-range-error' : undefined">
      </label>
      <label for="tj-range-to" class="block min-w-0 text-[11px] font-semibold leading-5">{{ c.toDate }}
        <input id="tj-range-to" v-model="customDraft.to" class="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 aria-invalid:border-rose-500 dark:border-slate-700 dark:bg-[#111d30] dark:text-slate-100" type="date" :min="customDraft.from || '1900-01-01'" max="9999-12-31" required :aria-invalid="Boolean(customError)" :aria-describedby="customError ? 'tj-range-error' : undefined">
      </label>
      <div class="flex flex-wrap justify-end gap-2 sm:col-span-2 xl:col-span-1">
        <button type="submit" class="flex-1 cursor-pointer rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 sm:flex-none">{{ c.applyRange }}</button>
        <button type="button" class="flex-1 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 sm:flex-none dark:border-slate-700 dark:bg-[#111d30]" @click="customRangeOpen = false; customError = ''">{{ c.cancel }}</button>
      </div>
      <p v-if="customError" id="tj-range-error" class="col-span-full text-[11px] leading-6 text-rose-600 dark:text-rose-400" role="alert">{{ c[customError] }}</p>
    </form>

    <div class="mb-4 mt-3 flex flex-col gap-1 text-[10px] leading-5 text-slate-500 sm:flex-row sm:justify-between sm:gap-3 dark:text-slate-400"><span>{{ rangeLabel }}</span><span v-if="overviewLoading" role="status">{{ c.updating }}</span><span v-else-if="searchQuery">{{ c.searchResults }}</span><span v-else>{{ c.usd }}</span></div>
    <div v-if="overviewError" class="mb-3.5 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3.5 py-3 text-xs leading-6 text-rose-600 dark:text-rose-400" role="alert">{{ overviewError }} <button type="button" class="ml-2 cursor-pointer underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-violet-500" @click="loadOverview">{{ c.retry }}</button></div>

    <div class="mb-5 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 xl:grid-cols-4" :class="{ 'opacity-60': overviewLoading }" :aria-busy="overviewLoading">
      <article class="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#111b2d]">
        <p class="mb-4 flex items-center justify-between gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{{ c.netPnl }} <span class="text-base text-violet-600 dark:text-violet-300" aria-hidden="true">$</span></p>
        <div class="flex min-h-10 flex-wrap items-center justify-between gap-1.5">
          <strong class="whitespace-nowrap text-2xl font-bold leading-tight tracking-tight tabular-nums" :class="tone(summary?.pnlCents || 0)" :title="money(summary?.pnlCents || 0)">{{ money(summary?.pnlCents || 0, false, true) }}</strong>
          <svg class="h-9 w-12 shrink-0 sm:w-16" :class="tone(summary?.pnlCents || 0)" viewBox="0 0 100 44" aria-hidden="true"><path :d="`${sparkline} L100,44 L0,44 Z`" fill="currentColor" opacity="0.12" /><path :d="sparkline" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </div>
        <p class="mt-2 text-[9px] leading-5 text-slate-500 dark:text-slate-400">{{ c.afterFees }}</p>
      </article>
      <article class="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#111b2d]">
        <p class="mb-4 flex items-center justify-between gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{{ c.emotions }} <span class="text-base text-violet-600 dark:text-violet-300" aria-hidden="true">☼</span></p>
        <div class="flex min-h-10 flex-wrap items-center justify-between gap-1.5">
          <strong class="text-2xl font-bold leading-tight tracking-tight tabular-nums">{{ percent(summary?.positiveRate) }}</strong>
          <svg class="h-8 w-12 shrink-0 fill-violet-500 sm:w-16 dark:fill-violet-400" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><rect v-for="(bar, index) in emotionBars" :key="bar.date" :x="index * 100 / emotionBars.length" :y="32 - bar.height * 0.32" :width="Math.max(1, 100 / emotionBars.length - 3)" :height="bar.height * 0.32" rx="1.5" :opacity="bar.tagged ? 1 : 0.25" /></svg>
        </div>
        <p class="mt-2 text-[9px] leading-5 text-slate-500 dark:text-slate-400">{{ summary?.tagged ? c.positive : c.noEmotions }}</p>
      </article>
      <article class="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#111b2d]">
        <p class="mb-4 flex items-center justify-between gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{{ c.winRate }} <span class="text-base text-violet-600 dark:text-violet-300" aria-hidden="true">↗</span></p>
        <div class="flex min-h-10 flex-wrap items-center justify-between gap-1.5">
          <strong class="text-2xl font-bold leading-tight tracking-tight tabular-nums">{{ percent(summary?.winRate) }}</strong>
          <svg class="size-9 shrink-0 -rotate-90" viewBox="0 0 40 40" aria-hidden="true"><circle class="stroke-slate-200 dark:stroke-slate-700" cx="20" cy="20" r="15.9155" fill="none" stroke-width="7" /><circle class="stroke-violet-500 dark:stroke-violet-400" cx="20" cy="20" r="15.9155" fill="none" stroke-width="7" :stroke-dasharray="`${summary?.winRate || 0} 100`" /></svg>
        </div>
        <p class="mt-2 text-[9px] leading-5 text-slate-500 dark:text-slate-400">{{ summary?.wins || 0 }} {{ c.wins }} · {{ summary?.losses || 0 }} {{ c.losses }} · {{ summary?.breakeven || 0 }} {{ c.flat }}</p>
      </article>
      <article class="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#111b2d]" :title="c.streakHint">
        <p class="mb-4 flex items-center justify-between gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{{ c.streak }} <svg class="size-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3c1 5-4 5-2 9 1-1 2-2 2-4 4 3 6 6 4 10-2 4-9 4-11-1-1-4 2-7 4-9-1 5 3 4 3-5Z" /></svg></p>
        <div class="flex min-h-10 flex-wrap items-center justify-between gap-1.5"><strong class="text-2xl font-bold leading-tight tracking-tight tabular-nums">{{ summary?.currentStreak || 0 }} <small class="text-xs font-medium tracking-normal text-slate-500 dark:text-slate-400">{{ c.days }}</small></strong><span class="text-3xl text-violet-500/75 dark:text-violet-300/75" aria-hidden="true">↗</span></div>
        <p class="mt-2 text-[9px] leading-5 text-slate-500 dark:text-slate-400">{{ summary?.activeDays || 0 }} {{ c.activeDays }} · {{ c.best }} {{ summary?.longestStreak || 0 }}</p>
      </article>
    </div>

    <div class="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_170px]" :class="{ 'opacity-60': overviewLoading }">
      <section class="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5 dark:border-slate-700 dark:bg-[#111b2d]" :aria-label="c.calendar">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><p class="mb-1 text-[9px] text-slate-500 dark:text-slate-400">{{ c.calendar }}</p><h2 class="text-lg font-bold text-violet-600 sm:text-xl dark:text-violet-300">{{ monthLabel }}</h2></div>
          <div class="flex items-center gap-1.5">
            <button type="button" class="cursor-pointer rounded px-2 py-1.5 text-[11px] text-slate-500 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-slate-400" @click="choosePreset('thisMonth')">{{ c.today }}</button>
            <button type="button" class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-xl leading-none text-slate-500 hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400" :aria-label="c.previous" :disabled="!canMoveMonth(-1)" @click="moveMonth(-1)">‹</button>
            <button type="button" class="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-xl leading-none text-slate-500 hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400" :aria-label="c.next" :disabled="!canMoveMonth(1)" @click="moveMonth(1)">›</button>
          </div>
        </div>
        <div class="overflow-x-auto p-1">
          <div class="grid min-w-[420px] grid-cols-7 gap-2">
            <div v-for="(day, index) in weekdays" :key="index" class="pb-2 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">{{ day }}</div>
            <button v-for="day in cells" :key="day.key" type="button" class="relative flex min-h-22 min-w-0 cursor-pointer flex-col items-center justify-end gap-1 rounded-lg border px-1 pb-2 pt-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-default motion-reduce:transition-none" :class="[
              !day.inMonth || !day.inRange ? 'border-dashed border-slate-200 bg-transparent opacity-35 dark:border-slate-700' : day.data?.pnlCents > 0 ? 'border-emerald-500/35 bg-emerald-50 hover:border-violet-400 dark:bg-emerald-500/5' : day.data?.pnlCents < 0 ? 'border-rose-500/35 bg-rose-50 hover:border-violet-400 dark:bg-rose-500/5' : 'border-slate-200 bg-slate-50 hover:border-violet-400 dark:border-slate-700 dark:bg-[#111d30]',
              day.key === selectedDate ? 'ring-2 ring-violet-500' : '',
            ]" :disabled="!day.inMonth || !day.inRange" :aria-pressed="day.key === selectedDate" :aria-current="day.key === today ? 'date' : undefined" :aria-label="`${formatDate(day.key)}: ${day.data ? `${money(day.data.pnlCents, true)}, ${countLabel(day.data.tradeCount)}` : c.noActivity}`" :title="day.data ? money(day.data.pnlCents, true) : ''" @click="selectedDate = selectedDate === day.key ? '' : day.key">
              <span class="absolute right-2 top-1.5 text-[10px]" :class="day.key === today ? 'rounded bg-violet-600 px-1.5 py-0.5 text-white' : 'text-slate-500 dark:text-slate-400'">{{ day.day }}</span>
              <template v-if="day.inMonth && day.data"><strong class="whitespace-nowrap text-[11px] leading-5 tracking-tight tabular-nums" :class="tone(day.data.pnlCents)">{{ money(day.data.pnlCents, true, true) }}</strong><span class="whitespace-nowrap text-[8px] text-slate-500 dark:text-slate-400">{{ countLabel(day.data.tradeCount) }}</span></template>
              <span v-else-if="day.inMonth" class="text-xl text-slate-200 dark:text-slate-700" aria-hidden="true">·</span>
            </button>
          </div>
        </div>
        <div class="flex flex-wrap justify-center gap-5 pt-4 text-[9px] text-slate-500 dark:text-slate-400"><span class="flex items-center gap-1.5"><i class="size-1.5 rounded-full bg-emerald-500"></i>{{ c.profit }}</span><span class="flex items-center gap-1.5"><i class="size-1.5 rounded-full bg-rose-400"></i>{{ c.loss }}</span><span class="flex items-center gap-1.5"><i class="size-1.5 rounded-full bg-slate-400"></i>{{ c.flat }}</span></div>
      </section>
      <aside class="grid grid-cols-2 content-start gap-2.5 sm:grid-cols-3 xl:grid-cols-1" :aria-label="c.week">
        <article v-for="week in weeks" :key="week.index" class="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-[#111b2d]">
          <div class="mb-2 flex flex-col gap-1 text-[10px] text-slate-500 dark:text-slate-400"><span>{{ c.week }} {{ week.index }}</span><small class="text-[8px] leading-4">{{ formatDate(week.from, true) }} – {{ formatDate(week.to, true) }}</small></div>
          <strong class="block break-words text-lg font-bold tracking-tight tabular-nums" :class="tone(week.pnlCents)">{{ money(week.pnlCents, true) }}</strong>
          <p class="mt-1 text-[9px] text-slate-500 dark:text-slate-400">{{ countLabel(week.count) }}</p>
        </article>
      </aside>
    </div>

    <div class="my-5 flex flex-wrap items-center gap-x-6 gap-y-3 px-1 text-[11px] text-slate-500 dark:text-slate-400">
      <span>{{ c.total }} <strong class="ml-1 text-slate-900 dark:text-slate-100">{{ summary?.tradeCount || 0 }}</strong></span>
      <span>{{ c.average }} <strong class="ml-1 tabular-nums" :class="tone(summary?.averageCents || 0)">{{ money(summary?.averageCents || 0) }}</strong></span>
      <span>{{ c.factor }} <strong class="ml-1 text-slate-900 dark:text-slate-100">{{ factor }}</strong></span>
      <small class="w-full text-[9px] leading-5">{{ c.statsHint }}</small>
    </div>

    <section class="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#111b2d]">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5 dark:border-slate-700">
        <div><h2 class="text-base font-semibold">{{ c.ledger }}</h2><p class="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{{ selectedDate ? `${c.dayTrades} ${formatDate(selectedDate)}` : c.periodTrades }}</p></div>
        <button v-if="selectedDate" type="button" class="cursor-pointer rounded px-1 py-1 text-[11px] font-semibold text-violet-600 hover:underline focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-violet-300" @click="selectedDate = ''">{{ c.viewPeriod }} ×</button>
      </header>
      <div v-if="listError" class="m-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3.5 py-3 text-xs leading-6 text-rose-600 dark:text-rose-400" role="alert">{{ listError }} <button type="button" class="ml-2 cursor-pointer underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-violet-500" @click="loadEntries()">{{ c.retry }}</button></div>
      <p v-if="listLoading && !trades.length" class="px-5 py-12 text-center text-xs text-slate-500 dark:text-slate-400" role="status">{{ c.loading }}</p>
      <div v-else-if="!trades.length && !listError" class="px-5 py-12 text-center">
        <span class="mb-3 block text-3xl text-violet-500 dark:text-violet-300" aria-hidden="true">↗</span><h3 class="text-base font-semibold">{{ searchQuery || selectedDate ? c.noMatches : c.emptyTitle }}</h3><p class="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500 dark:text-slate-400">{{ c.emptyBody }}</p>
        <div class="mt-5 flex flex-wrap justify-center gap-3"><button type="button" class="cursor-pointer rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500" @click="openEditor()">＋ {{ c.add }}</button><button v-if="searchQuery" type="button" class="cursor-pointer text-xs font-semibold text-violet-600 hover:underline focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-violet-300" @click="search = ''">{{ c.clearSearch }}</button></div>
      </div>
      <div v-if="trades.length" class="overflow-x-auto">
        <table class="w-full min-w-[760px] border-collapse text-left text-[11px]">
          <thead class="bg-slate-50 text-[10px] font-semibold text-slate-500 dark:bg-[#111d30] dark:text-slate-400"><tr><th scope="col" class="px-4 py-3">{{ c.date }}</th><th scope="col" class="px-4 py-3">{{ c.pair }}</th><th scope="col" class="px-4 py-3">{{ c.side }}</th><th scope="col" class="px-4 py-3 text-right">{{ c.netPnl }}</th><th scope="col" class="px-4 py-3">{{ c.emotion }}</th><th scope="col" class="px-4 py-3">{{ c.setup }}</th><th scope="col" class="px-4 py-3">{{ c.actions }}</th></tr></thead>
          <tbody><tr v-for="entry in trades" :key="entry._id" class="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-white/2">
            <td class="whitespace-nowrap px-4 py-4">{{ formatDate(entry.tradeDate) }}</td>
            <td class="px-4 py-4"><strong class="font-semibold">{{ entry.symbol }}</strong><span v-if="entry.notes" class="mt-1 block max-w-40 truncate text-[10px] text-slate-500 dark:text-slate-400" :title="entry.notes">{{ entry.notes }}</span></td>
            <td class="px-4 py-4"><span class="inline-flex rounded-md px-2 py-1 text-[10px] font-semibold" :class="entry.side === 'buy' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'">{{ entry.side === 'buy' ? c.buy : c.sell }}</span></td>
            <td class="whitespace-nowrap px-4 py-4 text-right tabular-nums" :class="tone(entry.pnlCents)"><strong class="font-semibold">{{ money(entry.pnlCents, true) }}</strong></td>
            <td class="px-4 py-4">{{ emotionLabel(entry.emotion) }}</td><td class="max-w-48 break-words px-4 py-4">{{ entry.strategy || '—' }}</td>
            <td class="px-4 py-4"><div class="flex items-center gap-3"><button type="button" class="cursor-pointer rounded py-1 font-semibold text-violet-600 hover:underline focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-violet-300" :aria-label="`${c.edit} ${entry.symbol}`" @click="openEditor(entry)">{{ c.edit }}</button><button type="button" class="cursor-pointer rounded py-1 font-semibold text-rose-600 hover:underline focus-visible:outline-2 focus-visible:outline-rose-500 dark:text-rose-400" :aria-label="`${c.delete} ${entry.symbol}`" @click="askDelete(entry)">{{ c.delete }}</button></div></td>
          </tr></tbody>
        </table>
      </div>
      <div v-if="nextCursor" class="flex justify-center border-t border-slate-200 p-4 dark:border-slate-700"><button type="button" class="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-[#111d30]" :disabled="listLoading" @click="loadEntries(true)">{{ listLoading ? c.loading : c.more }}</button></div>
    </section>

    <dialog ref="editor" class="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm sm:p-6 dark:border-slate-700 dark:bg-[#111b2d] dark:text-slate-100" aria-labelledby="tj-editor-title" @cancel="saving ? $event.preventDefault() : closeEditor()">
      <form @submit.prevent="saveEntry">
        <header class="mb-6 flex items-center justify-between gap-4"><div><p class="mb-2 text-[10px] font-bold tracking-wider text-violet-600 dark:text-violet-300">{{ c.private }}</p><h2 id="tj-editor-title" class="text-xl font-semibold">{{ editing ? c.editTrade : c.add }}</h2></div><button type="button" class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-2xl text-slate-500 hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400" :disabled="saving" :aria-label="c.close" @click="closeEditor()">×</button></header>
        <fieldset :disabled="saving" class="m-0 grid min-w-0 gap-4 border-0 p-0 disabled:opacity-60">
          <div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block min-w-0 text-[11px] font-semibold leading-5">{{ c.date }}<input v-model="form.tradeDate" class="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-[#111d30]" name="tradeDate" type="date" min="1900-01-01" max="9999-12-31" required autofocus></label>
            <label class="block min-w-0 text-[11px] font-semibold leading-5">{{ c.pair }}<input v-model="form.symbol" class="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal uppercase outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-[#111d30]" name="symbol" maxlength="30" placeholder="XAUUSD" required></label>
            <label class="block min-w-0 text-[11px] font-semibold leading-5">{{ c.side }}<select v-model="form.side" class="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-[#111d30]" name="side"><option value="buy">{{ c.buy }}</option><option value="sell">{{ c.sell }}</option></select></label>
            <label class="block min-w-0 text-[11px] font-semibold leading-5">{{ c.pnl }}<input v-model="form.pnl" class="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-[#111d30]" name="pnl" type="number" step="0.01" min="-10000000" max="10000000" inputmode="decimal" placeholder="125.50" required></label>
          </div>
          <p class="-mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{{ c.pnlHint }}</p>
          <div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block min-w-0 text-[11px] font-semibold leading-5">{{ c.emotion }} <small class="text-[10px] font-normal text-slate-500 dark:text-slate-400">({{ c.optional }})</small><select v-model="form.emotion" class="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-[#111d30]" name="emotion"><option value="">{{ c.chooseEmotion }}</option><option v-for="value in emotionValues" :key="value" :value="value">{{ c[value] }}</option></select></label>
            <label class="block min-w-0 text-[11px] font-semibold leading-5">{{ c.setup }} <small class="text-[10px] font-normal text-slate-500 dark:text-slate-400">({{ c.optional }})</small><input v-model="form.strategy" class="mt-1.5 block w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-[#111d30]" name="strategy" maxlength="120" :placeholder="c.setupPlaceholder"></label>
          </div>
          <label class="block min-w-0 text-[11px] font-semibold leading-5">{{ c.notes }} <small class="text-[10px] font-normal text-slate-500 dark:text-slate-400">({{ c.optional }})</small><textarea v-model="form.notes" class="mt-1.5 block min-h-25 w-full min-w-0 resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-slate-700 dark:bg-[#111d30]" name="notes" rows="4" maxlength="3000" :placeholder="c.notesPlaceholder"></textarea></label>
        </fieldset>
        <p v-if="formError" class="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3.5 py-3 text-xs leading-6 text-rose-600 dark:text-rose-400" role="alert">{{ formError }}</p>
        <footer class="mt-6 flex flex-wrap justify-end gap-2"><button type="button" class="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-[#111d30]" :disabled="saving" @click="closeEditor()">{{ c.cancel }}</button><button type="submit" class="cursor-pointer rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40" :disabled="saving">{{ saving ? c.saving : c.save }}</button></footer>
      </form>
    </dialog>
    <dialog ref="deleteDialog" class="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm sm:p-6 dark:border-slate-700 dark:bg-[#111b2d] dark:text-slate-100" aria-labelledby="tj-delete-title" @cancel="deleting && $event.preventDefault()">
      <h2 id="tj-delete-title" class="text-xl font-semibold">{{ c.deleteTitle }}</h2><p class="mt-4 text-base text-violet-600 dark:text-violet-300">{{ deletingTrade?.symbol }} · {{ deletingTrade ? money(deletingTrade.pnlCents, true) : '' }}</p><p class="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{{ c.deleteHint }}</p>
      <p v-if="formError" class="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3.5 py-3 text-xs leading-6 text-rose-600 dark:text-rose-400" role="alert">{{ formError }}</p>
      <footer class="mt-6 flex flex-wrap justify-end gap-2"><button type="button" class="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-[#111d30]" :disabled="deleting" @click="deleteDialog.close()">{{ c.cancel }}</button><button type="button" class="cursor-pointer rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-40" :disabled="deleting" @click="deleteEntry">{{ deleting ? c.deleting : c.delete }}</button></footer>
    </dialog>
  </section>
</template>
