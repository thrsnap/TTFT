<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim().replace(/\/+$/, '')
const signals = ref([])
const loading = ref(false)
const saving = ref(false)
const deletingId = ref('')
const error = ref('')
const message = ref('')
const editingId = ref('')
const image = ref(null)
const imageInput = ref(null)
const form = ref(blank())
const editorOpen = ref(false)
const editorDialog = ref(null)
const imageErrors = ref(new Set())
let previousFocus
function markImageError(id) { imageErrors.value = new Set([...imageErrors.value, id]) }
function openEditor() {
  previousFocus = document.activeElement
  editorOpen.value = true
  nextTick(() => editorDialog.value?.focus())
}
function create() { reset(); error.value = ''; message.value = ''; openEditor() }
function editorKeys(event) {
  if (event.key === 'Escape' && !saving.value) { event.preventDefault(); reset(); return }
  if (event.key !== 'Tab') return
  const targets = [...editorDialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')]
  const first = targets[0], last = targets[targets.length - 1]
  if (!first) { event.preventDefault(); return }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === editorDialog.value)) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === editorDialog.value)) { event.preventDefault(); first.focus() }
}
function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
const controller = new AbortController()
let listVersion = 0
function blank() {
  return { pair: 'XAUUSD', title: '', scheduledAt: '', direction: 'pending', confirmed: false, details: '', previewText: '', status: 'draft' }
}
async function request(path = '', options = {}) {
  const headers = new Headers(options.headers)
  if (options.method && options.method !== 'GET') headers.set('X-CMM-Request', '1')
  const response = await fetch(`${BASE}/api/daily-signals/admin${path}`, {
    ...options, headers, credentials: 'include', cache: 'no-store', signal: controller.signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status}).`)
  return data
}
async function load() {
  const current = ++listVersion
  loading.value = true
  try {
    const data = await request()
    if (!Array.isArray(data?.signals)) throw new Error('Invalid Daily Signal response.')
    if (current === listVersion) { signals.value = data.signals; imageErrors.value = new Set() }
  } catch (cause) { if (cause.name !== 'AbortError') error.value = cause.message }
  finally { if (current === listVersion) loading.value = false }
}
function reset() {
  editorOpen.value = false
  nextTick(() => { if (previousFocus?.isConnected) previousFocus.focus() })
  editingId.value = ''
  form.value = blank()
  image.value = null
  if (imageInput.value) imageInput.value.value = ''
}
function edit(signal) {
  const local = String(signal.scheduledAt || '').slice(0, 10)
  editingId.value = signal._id
  form.value = {
    pair: signal.pair, title: signal.title, scheduledAt: local,
    direction: signal.direction || 'pending', confirmed: signal.confirmed === true,
    details: signal.details || '', previewText: signal.previewText || '', status: signal.status,
  }
  image.value = null
  if (imageInput.value) imageInput.value.value = ''
  error.value = ''
  message.value = ''
  openEditor()
}
function chooseImage(event) {
  const file = event.target.files?.[0]
  if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) {
    error.value = 'Choose a JPG, PNG or WebP image under 2 MB.'
    event.target.value = ''
    image.value = null
    return
  }
  image.value = file || null
}
async function save() {
  if (saving.value || deletingId.value) return
  error.value = ''; message.value = ''
  const scheduledAt = new Date(form.value.scheduledAt)
  if (!Number.isFinite(scheduledAt.getTime())) { error.value = 'Enter a valid date.'; return }
  if (form.value.confirmed && form.value.direction === 'pending') { error.value = 'Choose BUY or SELL before confirming.'; return }
  saving.value = true
  try {
    const body = new FormData()
    for (const [key, value] of Object.entries(form.value)) {
      body.append(key, key === 'scheduledAt' ? scheduledAt.toISOString() : String(value))
    }
    if (image.value) body.append('image', image.value)
    const data = await request(editingId.value ? `/${editingId.value}` : '', {
      method: editingId.value ? 'PATCH' : 'POST', body,
    })
    reset()
    message.value = data.message
    await load()
  } catch (cause) { if (cause.name !== 'AbortError') error.value = cause.message }
  finally { saving.value = false }
}
async function remove(signal) {
  if (saving.value || deletingId.value || !window.confirm(`Delete Daily Signal “${signal.title}”?`)) return
  deletingId.value = signal._id; error.value = ''; message.value = ''
  try {
    const data = await request(`/${signal._id}`, { method: 'DELETE' })
    if (editingId.value === signal._id) reset()
    message.value = data.message
    await load()
  } catch (cause) { if (cause.name !== 'AbortError') error.value = cause.message }
  finally { deletingId.value = '' }
}
onMounted(load)
onUnmounted(() => controller.abort())
</script>

<template>
  <section class="mb-6 min-w-0">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold">Daily Signals</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">$25/month · separate from News Signal access</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" :disabled="loading || saving" @click="load" class="min-h-11 rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-600">Refresh</button>
        <button type="button" :disabled="saving || Boolean(deletingId)" @click="create" class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"><span aria-hidden="true">+</span>Upload daily signal</button>
      </div>
    </div>
    <p v-if="error" role="alert" class="mb-4 rounded-lg bg-red-500/10 p-3 text-red-700 dark:text-red-300">{{ error }}</p>
    <p v-if="message" role="status" class="mb-4 rounded-lg bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">{{ message }}</p>
    <div v-if="editorOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" @click.self="!saving && reset()">
      <section ref="editorDialog" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="daily-editor-title" @keydown="editorKeys" class="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl sm:p-6 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <div class="mb-5 flex items-start justify-between gap-3">
          <h3 id="daily-editor-title" class="text-xl font-bold">{{ editingId ? 'Edit Daily Signal' : 'Upload Daily Signal' }}</h3>
          <button type="button" :disabled="saving" @click="reset" aria-label="Close Daily Signal editor" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-xl dark:border-slate-600">×</button>
        </div>
        <p v-if="error" role="alert" class="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        <form @submit.prevent="save">
      <fieldset :disabled="saving || Boolean(deletingId)" class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 [&_input]:min-h-11 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-300 [&_input]:bg-transparent [&_input]:px-3 [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-3 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:bg-transparent [&_textarea]:p-3 dark:[&_input]:border-slate-600 dark:[&_select]:border-slate-600 dark:[&_select]:bg-slate-900 dark:[&_textarea]:border-slate-600">
        <legend class="mb-3 font-semibold">{{ editingId ? 'Edit Daily Signal' : 'Create Daily Signal' }}</legend>
        <label class="min-w-0"><span class="mb-1 block text-sm">Pair</span><input v-model="form.pair" maxlength="30" required /></label>
        <label class="min-w-0"><span class="mb-1 block text-sm">Title</span><input v-model="form.title" maxlength="200" required /></label>
        <label class="min-w-0"><span class="mb-1 block text-sm">Date</span><input v-model="form.scheduledAt" type="date" required /></label>
        <label><span class="mb-1 block text-sm">Visibility</span><select v-model="form.status"><option value="draft">Draft</option><option value="published">Published</option></select></label>
        <label><span class="mb-1 block text-sm">Direction</span><select v-model="form.direction"><option value="pending">Pending</option><option value="buy">BUY</option><option value="sell">SELL</option></select></label>
        <label class="flex min-h-11 items-center gap-2 self-end"><input v-model="form.confirmed" type="checkbox" class="!min-h-0 !w-5" /> Confirm direction</label>
        <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-sm">Details (subscribers only)</span><textarea v-model="form.details" rows="5" maxlength="20000"></textarea></label>
        <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-sm">Public preview text</span><textarea v-model="form.previewText" rows="2" maxlength="500"></textarea></label>
        <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-sm">Chart image (JPG, PNG, WebP · max 2 MB)</span><input ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp" @change="chooseImage" class="py-2 text-sm" /><span v-if="editingId" class="mt-1 block text-xs text-slate-500">Choose a file to replace the current chart.</span></label>
        <div class="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" class="min-h-11 rounded-lg bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Create Daily Signal' }}</button><button type="button" @click="reset" class="min-h-11 rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-600">Cancel</button></div>
      </fieldset>
        </form>
      </section>
    </div>
    <p v-if="loading" role="status" class="py-5 text-center">Loading Daily Signals…</p>
    <p v-else-if="!signals.length" class="py-5 text-center text-slate-500">No Daily Signals yet. Click Upload daily signal to create your first card.</p>
    <div v-else class="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
      <article v-for="signal in signals" :key="signal._id" class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div class="relative flex aspect-video items-center justify-center overflow-hidden bg-emerald-50 dark:bg-emerald-950/50">
          <img v-if="signal.hasImage && !imageErrors.has(signal._id)" :src="`${BASE}/api/daily-signals/admin/${signal._id}/image?v=${signal.imageUpdatedAt || ''}`" crossorigin="use-credentials" :alt="`${signal.pair} chart`" class="h-full w-full object-contain" @error="markImageError(signal._id)" />
          <svg v-else class="h-14 w-14 text-emerald-600 dark:text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 7-7 5 5 6-9" /><path d="M15 6h6v6" /></svg>
          <span class="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] break-words rounded-lg bg-white/95 px-3 py-1.5 text-sm font-medium text-slate-900 dark:bg-slate-900/95 dark:text-white">{{ signal.pair }}</span>
        </div>
        <div class="flex flex-1 flex-col p-5 sm:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span class="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{{ signal.status === 'draft' ? 'Draft' : signal.confirmed ? 'Confirmed' : 'Pending' }}</span>
            <time v-if="signal.updatedAt" :datetime="signal.updatedAt" :title="formatDate(signal.updatedAt)" class="text-xs text-slate-500 dark:text-slate-400">
              {{ formatDate(signal.updatedAt) }}
            </time>
          </div>
          <h3 class="mt-5 break-words text-xl font-semibold text-slate-900 dark:text-white">{{ signal.title }}</h3>
          <p class="mt-4 line-clamp-3 whitespace-pre-line break-words text-sm leading-7 text-slate-500 dark:text-slate-400">{{ signal.details || signal.previewText || 'Technical analysis will be added soon.' }}</p>
          <p class="mt-4 flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
            <svg class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 7v6c0 5 9 8 9 8s9-3 9-8V7l-9-4Z" /><path d="m8 12 3 3 5-6" /></svg>
            <span>Monthly subscription · $25 / month</span>
          </p>
          <div class="mt-auto pt-5">
            <div class="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button type="button" :disabled="saving || Boolean(deletingId)" @click="edit(signal)" class="inline-flex min-h-11 items-center gap-2 font-semibold text-emerald-700 hover:text-emerald-600 disabled:opacity-50 dark:text-emerald-300">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m14 5 5 5" /></svg>Edit
              </button>
              <button type="button" :disabled="saving || Boolean(deletingId)" @click="remove(signal)" :aria-label="`Delete Daily Signal: ${signal.title}`" class="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
