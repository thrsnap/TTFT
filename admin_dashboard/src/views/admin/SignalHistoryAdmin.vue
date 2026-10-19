<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim().replace(/\/+$/, '')
const type = ref('all')
const page = ref(1)
const history = ref([])
const pagination = ref({ total: 0, hasMore: false })
const stats = ref({})
const loading = ref(false)
const saving = ref('')
const error = ref('')
const message = ref('')
const outcomes = [{ value: 'pending', label: 'Result pending' }, { value: 'win', label: 'Win' }, { value: 'loss', label: 'Loss' }, { value: 'breakeven', label: 'Breakeven' }, { value: 'cancelled', label: 'Cancelled' }]
let request
let disposed = false
let version = 0
let timer
const date = value => value ? new Date(value).toLocaleString() : '—'
const key = item => `${item.type}:${item._id}`
async function load(background = false) {
  if (saving.value) return
  request?.abort()
  const current = ++version
  request = new AbortController()
  loading.value = true; error.value = ''
  try {
    const query = new URLSearchParams({ type: type.value, page: String(page.value), limit: '12' })
    const response = await fetch(`${BASE}/api/signal-history/admin?${query}`, { credentials: 'include', cache: 'no-store', signal: request.signal })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Could not load signal history.')
    if (!Array.isArray(data.history)) throw new Error('Invalid history response.')
    if (disposed || current !== version) return
    const previous = new Map(history.value.map(item => [key(item), item]))
    history.value = data.history.map(item => {
      const existing = previous.get(key(item))
      // Background updates must not overwrite an admin's unsaved result edit.
      const dirty = background && existing && (existing.formOutcome !== existing.outcome || existing.formNotes !== (existing.resultNotes || ''))
      return { ...item, formOutcome: dirty ? existing.formOutcome : item.outcome, formNotes: dirty ? existing.formNotes : item.resultNotes || '' }
    })
    pagination.value = data.pagination; stats.value = data.stats
  } catch (failure) {
    if (current === version && failure.name !== 'AbortError') error.value = failure.message
  } finally { if (!disposed && current === version) loading.value = false }
}
async function save(item) {
  if (saving.value || loading.value) return
  saving.value = key(item); error.value = ''; message.value = ''
  try {
    const response = await fetch(`${BASE}/api/signal-history/${item.type}/${encodeURIComponent(item._id)}/result`, {
      method: 'PATCH', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CMM-Request': '1' },
      body: JSON.stringify({ outcome: item.formOutcome, resultNotes: item.formNotes }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Could not save result.')
    if (disposed) return
    item.outcome = data.signal.outcome; item.resultNotes = data.signal.resultNotes
    message.value = `${item.pair}: result saved.`
  } catch (failure) { if (!disposed) error.value = failure.message }
  finally { saving.value = '' }
  if (!disposed) await load(true)
}
function changePage(offset) { if (saving.value) return; page.value += offset; void load() }
watch(type, () => { page.value = 1; history.value = []; void load() })
function refreshVisible() { if (!document.hidden && !saving.value) void load(true) }
onMounted(() => { void load(); timer = setInterval(refreshVisible, 60000); window.addEventListener('focus', refreshVisible) })
onUnmounted(() => { disposed = true; version++; request?.abort(); clearInterval(timer); window.removeEventListener('focus', refreshVisible) })
</script>

<template>
  <section class="mt-8 min-w-0 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" aria-labelledby="admin-signal-history">
    <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 id="admin-signal-history" class="text-xl font-semibold">Signal History &amp; Results</h2><p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Released News and Daily Signals move here the next day. Record the actual result to update the public win rate.</p></div><button type="button" :disabled="loading || !!saving" @click="load(true)" class="min-h-11 rounded-lg border border-slate-300 px-4 text-sm disabled:opacity-50 dark:border-slate-600">Refresh</button></div>
    <div class="mt-5 flex flex-wrap items-center justify-between gap-4"><label class="text-sm font-medium">Signal type<select v-model="type" :disabled="!!saving" class="ml-3 min-h-11 rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800"><option value="all">All signals</option><option value="news">News Signals</option><option value="daily">Daily Signals</option></select></label><p class="text-sm text-slate-500 dark:text-slate-400">Win rate: <strong class="text-slate-900 dark:text-white">{{ stats.winRate == null ? '—' : `${stats.winRate}%` }}</strong> · {{ stats.wins || 0 }} wins · {{ stats.losses || 0 }} losses</p></div>
    <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">Only wins and losses count towards win rate. Internal result notes stay private.</p>
    <p v-if="error" role="alert" class="mt-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p><p v-if="message" role="status" class="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{{ message }}</p>
    <p v-if="loading && !history.length" role="status" class="py-8 text-center text-sm">Loading history…</p><p v-else-if="!history.length && !error" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No archived signals yet.</p>
    <div class="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
      <form v-for="item in history" :key="key(item)" @submit.prevent="save(item)" class="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <fieldset :disabled="!!saving || loading" class="min-w-0"><p class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{{ item.type === 'news' ? 'News Signal' : 'Daily Signal' }} · {{ item.pair }}</p><h3 class="mt-2 break-words font-semibold">{{ item.title }}</h3><p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Released {{ date(item.releasedAt || item.scheduledAt) }}</p><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Archived {{ date(item.archivedAt) }}</p>
          <label :for="`result-${key(item)}`" class="mt-4 block text-sm font-medium">Result</label><select :id="`result-${key(item)}`" v-model="item.formOutcome" class="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800"><option v-for="outcome in outcomes" :key="outcome.value" :value="outcome.value">{{ outcome.label }}</option></select>
          <label :for="`notes-${key(item)}`" class="mt-4 block text-sm font-medium">Internal notes (optional)</label><textarea :id="`notes-${key(item)}`" v-model="item.formNotes" maxlength="2000" rows="2" class="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-800"></textarea><button type="submit" class="mt-3 min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{{ saving === key(item) ? 'Saving…' : 'Save result' }}</button>
        </fieldset>
      </form>
    </div>
    <div v-if="pagination.total > 12" class="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p>Page {{ page }} · {{ pagination.total }} signals</p><div class="flex gap-2"><button type="button" :disabled="loading || !!saving || page === 1" @click="changePage(-1)" class="min-h-11 rounded-lg border border-slate-300 px-4 disabled:opacity-40 dark:border-slate-600">Previous</button><button type="button" :disabled="loading || !!saving || !pagination.hasMore" @click="changePage(1)" class="min-h-11 rounded-lg border border-slate-300 px-4 disabled:opacity-40 dark:border-slate-600">Next</button></div></div>
  </section>
</template>
