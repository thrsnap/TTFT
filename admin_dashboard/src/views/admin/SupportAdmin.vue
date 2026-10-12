<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supportApi, supportJson } from '../../api/supportApi.js'
const router = useRouter()
const messages = ref([]), total = ref(0), page = ref(1), status = ref('all')
const loading = ref(false), busy = ref(false), error = ref(''), notice = ref(''), replies = ref({})
const pages = computed(() => Math.max(1, Math.ceil(total.value / 20)))
const date = value => new Date(value).toLocaleString()
async function handleError(err) {
  error.value = err.message
  if (err.status === 401) await router.replace({ name: 'admin-login', query: { redirect: '/admin/support' } })
}
async function load() {
  loading.value = true; error.value = ''
  try {
    const data = await supportApi(`/api/admin/support/messages?${new URLSearchParams({ status: status.value, page: String(page.value) })}`)
    messages.value = data.messages; total.value = data.total
    if (page.value > pages.value) { page.value = pages.value; await load() }
  } catch (err) { await handleError(err) } finally { loading.value = false }
}
async function reply(item) {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const body = (replies.value[item.id] || '').trim()
    if (!body) throw new Error('Enter a reply.')
    const data = await supportApi(`/api/admin/support/messages/${item.id}/replies`, supportJson('POST', { body }))
    replies.value[item.id] = ''; await load(); notice.value = data.message
  } catch (err) { await handleError(err) } finally { busy.value = false }
}
async function setStatus(item, value) {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    await supportApi(`/api/admin/support/messages/${item.id}`, supportJson('PATCH', { status: value }))
    await load(); notice.value = 'Message status updated.'
  } catch (err) { await handleError(err) } finally { busy.value = false }
}
async function filter() { page.value = 1; await load() }
async function turn(delta) { page.value += delta; await load() }
onMounted(load)
</script>
<template>
  <main class="min-h-screen bg-(--page-bg) px-6 py-8 text-(--text-color) max-[768px]:px-5 max-[600px]:px-4 max-[480px]:px-3 max-[414px]:px-2.5 max-[320px]:px-2">
    <div class="mx-auto max-w-5xl">
      <RouterLink to="/admin" class="text-sm text-indigo-500">← Admin Panel</RouterLink>
      <header class="my-6 flex flex-wrap items-center justify-between gap-3"><h1 class="text-3xl font-bold max-[480px]:text-2xl">Support Inbox · {{ total }}</h1><div class="flex gap-2"><select v-model="status" @change="filter" :disabled="loading || busy" aria-label="Filter messages" class="min-h-11 rounded-lg border border-(--border-color) bg-(--input-bg) px-3"><option value="all">All</option><option value="open">Open</option><option value="replied">Replied</option><option value="closed">Closed</option></select><button @click="load" :disabled="loading || busy" class="min-h-11 rounded-lg border border-(--border-color) px-4 disabled:opacity-50">Refresh</button></div></header>
      <p v-if="error" role="alert" class="mb-4 text-red-500">{{ error }}</p><p v-if="notice" role="status" class="mb-4 text-emerald-600">{{ notice }}</p>
      <p v-if="loading" role="status" class="mb-4 text-(--muted-color)">Loading messages…</p>
      <article v-for="item in messages" :key="item.id" class="mb-5 min-w-0 rounded-xl border border-(--border-color) bg-(--surface-bg) p-6 max-[480px]:p-4 max-[320px]:p-3">
        <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="break-words text-xl font-bold max-[480px]:text-lg">{{ item.subject }}</h2><span class="rounded bg-indigo-500/10 px-2 py-1 text-xs">{{ item.status }}</span></div>
        <p class="mt-2 break-all text-sm text-(--muted-color)">{{ item.name }} · {{ item.email }}</p><p class="mt-1 text-xs text-(--muted-color)">{{ item.senderType }} · {{ item.topic }} · {{ date(item.createdAt) }}</p>
        <p class="my-5 whitespace-pre-wrap break-words leading-7">{{ item.message }}</p>
        <section v-if="item.replies.length" aria-label="Previous replies" class="space-y-3"><div v-for="entry in item.replies" :key="entry.id" class="rounded-lg bg-indigo-500/10 p-4"><p class="text-xs text-(--muted-color)">Admin reply · {{ date(entry.createdAt) }}</p><p class="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{{ entry.body }}</p></div></section>
        <form @submit.prevent="reply(item)" class="mt-5"><label :for="`reply-${item.id}`" class="mb-2 block text-sm font-semibold">Reply</label><textarea :id="`reply-${item.id}`" v-model="replies[item.id]" required maxlength="4000" rows="4" :disabled="busy" class="w-full rounded-lg border border-(--border-color) bg-(--input-bg) p-3"></textarea><p class="mt-2 text-xs text-(--muted-color)">Account users read replies in Dashboard → My Support after signing in. No email is sent. Legacy guest tickets have no dashboard access.</p><div class="mt-3 flex flex-wrap gap-2"><button :disabled="busy" class="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Save reply</button><button type="button" @click="setStatus(item, item.status === 'closed' ? 'open' : 'closed')" :disabled="busy" class="min-h-11 rounded-lg border border-(--border-color) px-4 py-2">{{ item.status === 'closed' ? 'Reopen' : 'Close ticket' }}</button></div></form>
      </article>
      <p v-if="!loading && !messages.length" class="py-8 text-(--muted-color)">No support messages found.</p>
      <nav aria-label="Inbox pages" class="mt-5 flex flex-wrap items-center justify-between gap-3"><button @click="turn(-1)" :disabled="loading || busy || page <= 1" class="min-h-11 rounded-lg border border-(--border-color) px-4 disabled:opacity-40">Previous</button><span class="text-sm">Page {{ page }} of {{ pages }}</span><button @click="turn(1)" :disabled="loading || busy || page >= pages" class="min-h-11 rounded-lg border border-(--border-color) px-4 disabled:opacity-40">Next</button></nav>
    </div>
  </main>
</template>
