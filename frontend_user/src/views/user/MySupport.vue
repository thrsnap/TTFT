<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { supportApi } from '../../api/supportApi.js'

const route = useRoute()
const router = useRouter()
const messages = ref([])
const loading = ref(false)
const error = ref('')
function localizedPath(path) { return route.params.lang === 'km' ? `/km${path}` : path }
function date(value) { return new Date(value).toLocaleString() }
async function loadMessages() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  messages.value = []
  try {
    const data = await supportApi('/api/support/messages')
    messages.value = data.messages
  } catch (err) {
    if (err.status === 401) {
      await router.replace({ path: localizedPath('/login'), query: { redirect: route.fullPath } })
    } else error.value = err.message
  } finally { loading.value = false }
}
onMounted(loadMessages)
</script>

<template>
  <section aria-labelledby="my-support-heading"
    class="min-w-0 bg-(--page-bg) px-6 py-8 text-(--text-color) max-[768px]:px-4 max-[600px]:py-6 max-[480px]:px-3 max-[414px]:px-2.5 max-[320px]:px-2">
    <div class="mx-auto min-w-0 max-w-5xl">
      <header class="mb-6 flex flex-wrap items-start justify-between gap-4 max-[480px]:mb-4">
        <div>
          <h1 id="my-support-heading" class="text-3xl font-bold max-[768px]:text-[28px] max-[600px]:text-2xl max-[480px]:text-[22px] max-[414px]:text-xl max-[320px]:text-lg">My Support</h1>
          <p class="mt-2 text-sm text-(--muted-color) max-[480px]:text-xs">Your messages and replies from our support team.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <RouterLink :to="localizedPath('/support')" class="inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">New message</RouterLink>
          <button type="button" :disabled="loading" @click="loadMessages" class="min-h-11 rounded-lg border border-(--border-color) bg-(--surface-bg) px-4 py-2 text-sm font-semibold hover:bg-(--hover-bg) disabled:opacity-50">{{ loading ? 'Checking…' : 'Check replies' }}</button>
        </div>
      </header>
      <p v-if="loading" role="status" class="py-6 text-sm text-(--muted-color)">Loading your messages…</p>
      <p v-if="error" role="alert" class="mb-5 text-sm text-red-500">{{ error }}</p>
      <div class="space-y-5 max-[480px]:space-y-3">
        <article v-for="ticket in messages" :key="ticket.id" class="min-w-0 rounded-xl border border-(--border-color) bg-(--surface-bg) p-6 [overflow-wrap:anywhere] max-[768px]:p-5 max-[600px]:p-4 max-[480px]:p-3 max-[320px]:p-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-bold max-[480px]:text-base">{{ ticket.subject }}</h2>
            <span class="rounded-lg bg-indigo-500/10 px-3 py-1 text-xs font-semibold">{{ ticket.status }}</span>
          </div>
          <p class="mt-2 text-xs text-(--muted-color)">{{ ticket.topic }} · {{ date(ticket.createdAt) }}</p>
          <h3 class="mt-5 text-sm font-semibold">Your message</h3>
          <p class="mt-2 whitespace-pre-wrap text-sm leading-7">{{ ticket.message }}</p>
          <div v-for="reply in ticket.replies" :key="reply.id" class="mt-4 rounded-lg border border-(--border-color) bg-(--input-bg) p-4 max-[480px]:p-3">
            <h3 class="text-sm font-semibold text-indigo-400 in-[.ligh-mode]:text-indigo-700">Support reply</h3>
            <time :datetime="reply.createdAt" class="mt-1 block text-xs text-(--muted-color)">{{ date(reply.createdAt) }}</time>
            <p class="mt-3 whitespace-pre-wrap text-sm leading-7">{{ reply.body }}</p>
          </div>
          <p v-if="!ticket.replies.length" class="mt-4 text-sm text-(--muted-color)">{{ ticket.status === 'closed' ? 'This ticket is closed.' : 'Waiting for a support reply. Check again later.' }}</p>
        </article>
      </div>
      <p v-if="!loading && !error && !messages.length" class="py-10 text-center text-sm text-(--muted-color)">You have no support messages yet. Select New message to contact us.</p>
    </div>
  </section>
</template>
