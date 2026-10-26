<script setup>
import { computed, nextTick, onActivated, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/user/authStore.js'
import { useProfilePhoto } from '../composable/useProfilePhoto.js'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { photoUrl: myProfilePhoto } = useProfilePhoto()

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  .trim()
  .replace(/\/+$/, '')

const MIN_SKELETON_MS = 600

const reactionOptions = [
  {
    type: 'like',
    label: 'Like',
    emoji: '👍',
    activeClass: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  },
  {
    type: 'love',
    label: 'Love',
    emoji: '❤️',
    activeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-300',
  },
  {
    type: 'smile',
    label: 'Smile',
    emoji: '😊',
    activeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
]

const reactionTypes = reactionOptions.map((option) => option.type)
const emptyReactionCounts = () =>
  Object.fromEntries(reactionTypes.map((type) => [`${type}Count`, 0]))

const posts = ref([])
const tab = ref('all')
const resultFilter = ref('all')
const loading = ref(true)
const loadingMore = ref(false)
const skeletonCount = computed(() => loading.value ? (loadingMore.value ? 2 : 3) : 0)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')
const formError = ref('')
const notice = ref('')
const nextCursor = ref(null)
const now = ref(Date.now())

const editor = ref(null)
const viewer = ref(null)
const deleteDialog = ref(null)
const selectedPost = ref(null)
const selectedImage = ref(null)
const editingId = ref(null)
const imageFile = ref(null)
const imagePreview = ref('')
const imageErrors = ref({})
const reactionBusy = ref({})
const viewerError = ref(false)
const viewerLoading = ref(false)
const fileInput = ref(null)

const form = reactive({
  pair: '',
  direction: 'buy',
  result: 'profit',
  amount: '',
  currency: 'USD',
  notes: '',
})

let clock
let noticeTimer
let loadController
let loadId = 0
let disposed = false
let firstActivation = true

const myId = computed(() => String(auth.user?._id || auth.user?.id || ''))

const mine = (post) =>
  Boolean(myId.value && String(post.author?.id || post.author?._id || '') === myId.value)

const localPath = (path) => (route.params.lang === 'km' ? `/km${path}` : path)

const exactTime = (value) =>
  new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

const username = (post) => post.author?.username || 'Trader'
const isAdminAuthor = (post) => post.author?.role === 'admin'
const authorId = (post) => String(post.author?.id || post.author?._id || '')

const authorPhotos = ref({})
const authorPhotoErrors = ref({})
const photoSession = computed(() => auth.isAuthenticated === false ? '' : myId.value)

const authorCheckedAt = new Map()
const authorRequests = new Map()

let photoEpoch = 0
let photosDisposed = false

function authorPhotoSrc(post) {
  const id = authorId(post)
  if (!photoSession.value || !id) return ''

  const source = id === myId.value
    ? myProfilePhoto.value
    : authorPhotos.value[id] || ''

  return authorPhotoErrors.value[id] === source ? '' : source
}

function authorPhotoFailed(post, event) {
  const id = authorId(post)
  const source = event.target?.getAttribute('src')

  if (id && source) authorPhotoErrors.value[id] = source
}

function replaceAuthorPhoto(id, next) {
  const previous = authorPhotos.value[id]

  if (next) authorPhotos.value[id] = next
  else delete authorPhotos.value[id]

  delete authorPhotoErrors.value[id]

  if (previous && previous !== next) URL.revokeObjectURL(previous)
}

function clearAuthorPhotos() {
  photoEpoch++

  for (const entry of authorRequests.values()) {
    entry.controller.abort()
  }

  authorRequests.clear()
  authorCheckedAt.clear()

  for (const source of Object.values(authorPhotos.value)) {
    URL.revokeObjectURL(source)
  }

  authorPhotos.value = {}
  authorPhotoErrors.value = {}
}

function pruneAuthorPhotos() {
  const visible = new Set(posts.value.map(authorId))

  for (const id of Object.keys(authorPhotos.value)) {
    if (!visible.has(id)) replaceAuthorPhoto(id, '')
  }

  for (const id of authorCheckedAt.keys()) {
    if (!visible.has(id)) authorCheckedAt.delete(id)
  }

  for (const [id, entry] of authorRequests) {
    if (!visible.has(id)) {
      entry.controller.abort()
      authorRequests.delete(id)
    }
  }
}

function fetchAuthorPhoto(id, force = false) {
  if (
    photosDisposed ||
    !photoSession.value ||
    id === myId.value ||
    !/^[a-f\d]{24}$/i.test(id)
  ) {
    return Promise.resolve()
  }

  const pending = authorRequests.get(id)
  if (pending) return pending.promise

  if (!force && Date.now() - (authorCheckedAt.get(id) || 0) < 60000) {
    return Promise.resolve()
  }

  const entry = {
    controller: new AbortController(),
    epoch: photoEpoch,
    session: photoSession.value,
    promise: null,
  }

  const current = () =>
    !photosDisposed &&
    entry.epoch === photoEpoch &&
    entry.session === photoSession.value &&
    authorRequests.get(id) === entry

  authorRequests.set(id, entry)

  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    entry.controller.abort()
  }, 20000)

  entry.promise = (async () => {
    try {
      const response = await fetch(
        `${BASE}/api/profile/photo/${encodeURIComponent(id)}`,
        {
          credentials: 'include',
          cache: 'no-store',
          signal: entry.controller.signal,
        },
      )

      if (!current()) return

      if (response.status === 404) {
        replaceAuthorPhoto(id, '')
        authorCheckedAt.set(id, Date.now())
        return
      }

      if (
        !response.ok ||
        !response.headers.get('content-type')?.startsWith('image/')
      ) {
        authorCheckedAt.set(id, Date.now())
        return
      }

      const photo = await response.blob()

      if (!current() || !photo.size) return

      replaceAuthorPhoto(id, URL.createObjectURL(photo))
      authorCheckedAt.set(id, Date.now())
    } catch (failure) {
      if (current() && (timedOut || failure.name !== 'AbortError')) {
        authorCheckedAt.set(id, Date.now())
      }
    } finally {
      clearTimeout(timer)

      if (authorRequests.get(id) === entry) {
        authorRequests.delete(id)
      }
    }
  })()

  return entry.promise
}

async function loadAuthorPhotos(pagePosts, force = false) {
  if (!photoSession.value || photosDisposed) return

  const epoch = photoEpoch
  const session = photoSession.value

  const ids = [
    ...new Set(pagePosts.map(authorId)),
  ].filter((id) => id !== myId.value && /^[a-f\d]{24}$/i.test(id))

  let index = 0

  await Promise.allSettled(
    Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (
        index < ids.length &&
        epoch === photoEpoch &&
        session === photoSession.value &&
        !photosDisposed
      ) {
        await fetchAuthorPhoto(ids[index++], force)
      }
    }),
  )
}

const resultLabel = (result) =>
  ({ profit: 'Profit', loss: 'Loss', breakeven: 'Breakeven' })[result] || 'Result'

const resultClass = (result) =>
  ({
    profit: 'text-emerald-600 dark:text-emerald-400',
    loss: 'text-red-600 dark:text-red-400',
    breakeven: 'text-slate-500 dark:text-slate-400',
  })[result]

function screenshotUrl(value) {
  if (!value) return ''

  try {
    const url = new URL(value, `${BASE}/`)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function retryImage(post) {
  if (!post?.imageUrl) return

  const url = new URL(post.imageUrl)
  url.searchParams.set('_retry', String(Date.now()))

  post.imageUrl = url.href
  delete imageErrors.value[post._id]

  viewerError.value = false
  viewerLoading.value = true
}

function timeAgo(value) {
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return ''

  const seconds = Math.max(0, Math.floor((now.value - ms) / 1000))

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${seconds < 120 ? '' : 's'} ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${seconds < 7200 ? '' : 's'} ago`
  if (seconds < 172800) return 'Yesterday'
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`

  return new Date(ms).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function money(post) {
  const amount = post.result === 'breakeven' ? 0 : Math.abs(Number(post.amount) || 0)

  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: ['USD', 'KHR', 'EUR', 'GBP', 'INR'].includes(post.currency)
      ? post.currency
      : 'USD',
  }).format(amount)

  return `${post.result === 'loss' ? '−' : post.result === 'profit' ? '+' : ''}${formatted}`
}

function notify(message) {
  notice.value = message
  clearTimeout(noticeTimer)

  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 5000)
}

function login() {
  return router.replace({
    path: localPath('/login'),
    query: { redirect: route.fullPath },
  })
}

async function request(path, options = {}) {
  const method = options.method || 'GET'
  const headers = new Headers(options.headers)

  if (method !== 'GET') headers.set('X-CMM-Request', '1')

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })

  if (response.status === 401) {
    posts.value = []
    editor.value?.close()
    viewer.value?.close()
    deleteDialog.value?.close()

    await login()
    throw new Error('Please sign in to continue.')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status}).`)
  }

  if (response.status !== 204 && !data) {
    throw new Error('The journal API did not return valid JSON. Please check the backend route.')
  }

  return data
}

function applyReaction(post, value) {
  if (
    !value ||
    String(value.postId) !== String(post._id) ||
    !reactionTypes.every(
      (type) => Number.isSafeInteger(value[`${type}Count`]) && value[`${type}Count`] >= 0,
    ) ||
    ![null, ...reactionTypes].includes(value.myReaction)
  ) {
    throw new Error('Invalid reaction response. Please retry.')
  }

  Object.assign(post, {
    ...Object.fromEntries(
      reactionTypes.map((type) => [`${type}Count`, value[`${type}Count`]]),
    ),
    myReaction: value.myReaction,
    reactionsReady: true,
    reactionError: '',
  })
}

async function loadReactions(pagePosts, current = loadId, signal, targetPosts = posts.value) {
  if (!pagePosts.length) return

  try {
    const ids = pagePosts.map((post) => post._id).join(',')

    const data = await request(
      `/api/journal-reactions?${new URLSearchParams({ ids })}`,
      { signal },
    )

    if (current !== loadId) return

    if (!Array.isArray(data?.reactions)) {
      throw new Error('Invalid reaction response.')
    }

    const byId = new Map(
      data.reactions.map((value) => [String(value.postId), value]),
    )

    const targets = new Set(pagePosts.map((post) => String(post._id)))

    for (const post of targetPosts) {
      if (!targets.has(String(post._id))) continue

      const value = byId.get(String(post._id))

      if (!value) {
        post.reactionError = 'Reactions unavailable. Please retry.'
        continue
      }

      applyReaction(post, value)
    }
  } catch (err) {
    if (err.name === 'AbortError' || current !== loadId) return

    const targets = new Set(pagePosts.map((post) => String(post._id)))

    for (const post of targetPosts) {
      if (targets.has(String(post._id))) {
        post.reactionError = 'Reactions unavailable. Please retry.'
      }
    }
  }
}

async function retryReactions(post) {
  const id = String(post._id)
  if (reactionBusy.value[id]) return

  reactionBusy.value[id] = true
  post.reactionError = ''

  try {
    await loadReactions([post])
  } finally {
    delete reactionBusy.value[id]
  }
}

async function reactToPost(post, type) {
  const id = String(post._id)

  if (reactionBusy.value[id] || !post.reactionsReady || !reactionTypes.includes(type)) {
    return
  }

  if (!myId.value) return login()

  const memberId = myId.value
  const desiredType = post.myReaction === type ? null : type

  reactionBusy.value[id] = true
  post.reactionError = ''

  try {
    const data = await request(`/api/journal-reactions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: desiredType }),
    })

    if (myId.value !== memberId) return

    const visiblePost = posts.value.find((item) => String(item._id) === id)

    if (visiblePost) applyReaction(visiblePost, data?.reaction)
  } catch (err) {
    const visiblePost = posts.value.find((item) => String(item._id) === id)

    if (visiblePost) {
      visiblePost.reactionError = err.message || 'Unable to save your reaction.'
    }
  } finally {
    delete reactionBusy.value[id]
  }
}

function waitForSkeleton(startedAt, signal) {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Request cancelled.', 'AbortError'))
  }

  const remaining = Math.ceil(MIN_SKELETON_MS - (performance.now() - startedAt))
  if (remaining <= 0) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(new DOMException('Request cancelled.', 'AbortError'))
    }

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, remaining)

    signal.addEventListener('abort', abort, { once: true })
  })
}

async function loadPosts(append = false) {
  if (disposed) return

  loadController?.abort()

  const current = ++loadId
  const controller = new AbortController()
  loadController = controller
  const startedAt = performance.now()

  loading.value = true
  loadingMore.value = append && posts.value.length > 0
  error.value = ''

  if (!append) {
    posts.value = []
    nextCursor.value = null
  }

  const params = new URLSearchParams({ scope: tab.value, limit: '12' })

  if (resultFilter.value !== 'all') {
    params.set('result', resultFilter.value)
  }

  if (append && nextCursor.value) {
    params.set('cursor', nextCursor.value)
  }

  try {
    // Render the loading cards before starting the API request.
    await nextTick()
    if (current !== loadId || disposed || controller.signal.aborted) return

    const data = await request(`/api/journals?${params}`, {
      signal: controller.signal,
    })

    if (current !== loadId || disposed) return

    if (!Array.isArray(data?.posts)) {
      throw new Error('Invalid journal response: expected a posts array.')
    }

    const incoming = data.posts.map((post) => ({
      ...post,
      imageUrl: screenshotUrl(post.imageUrl),
      ...emptyReactionCounts(),
      myReaction: null,
      reactionsReady: false,
      reactionError: '',
    }))

    // Prepare the cards before replacing the visible skeletons.
    await loadReactions(incoming, current, controller.signal, incoming)
    if (current !== loadId || disposed) return
    await waitForSkeleton(startedAt, controller.signal)
    if (current !== loadId || disposed) return

    const combined = append ? [...posts.value, ...incoming] : incoming
    if (!append) imageErrors.value = {}

    posts.value = [
      ...new Map(combined.map((post) => [String(post._id), post])).values(),
    ]
    nextCursor.value = data.nextCursor || null

    pruneAuthorPhotos()
    void loadAuthorPhotos(incoming, !append)
  } catch (err) {
    if (err.name !== 'AbortError' && current === loadId && !disposed) {
      error.value = err.message || 'Unable to load trades.'
    }
  } finally {
    if (current === loadId && !disposed) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function changeTab(value) {
  if (tab.value === value) return

  tab.value = value
  void loadPosts()
}

function clearFile() {
  if (imagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(imagePreview.value)
  }

  imageFile.value = null
  imagePreview.value = ''

  if (fileInput.value) fileInput.value.value = ''
}

async function openEditor(post = null) {
  editingId.value = post?._id || null
  formError.value = ''

  clearFile()

  Object.assign(form, {
    pair: post?.pair || '',
    direction: post?.direction || 'buy',
    result: post?.result || 'profit',
    amount: post?.amount ?? '',
    currency: post?.currency || 'USD',
    notes: post?.notes || '',
  })

  imagePreview.value = post?.imageUrl || ''

  await nextTick()
  editor.value?.showModal()
}

function closeEditor() {
  if (!saving.value) {
    editor.value?.close()
    clearFile()
  }
}

function chooseFile(event) {
  const file = event.target.files?.[0]
  if (!file) return

  formError.value = ''

  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    formError.value = 'Choose a JPG, PNG, or WebP image up to 5 MB.'
    event.target.value = ''
    return
  }

  if (imagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(imagePreview.value)
  }

  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

async function savePost() {
  if (saving.value) return

  formError.value = ''

  const amount = form.result === 'breakeven' ? 0 : Number(form.amount)

  if (!form.pair.trim() || form.pair.trim().length > 30) {
    formError.value = 'Enter a trading pair up to 30 characters.'
    return
  }

  if (!Number.isFinite(amount) || (form.result !== 'breakeven' && amount <= 0)) {
    formError.value = 'Enter a positive profit or loss amount.'
    return
  }

  const payload = new FormData()

  payload.set('pair', form.pair.trim().toUpperCase())
  payload.set('direction', form.direction)
  payload.set('result', form.result)
  payload.set('amount', amount.toFixed(2))
  payload.set('currency', form.currency)
  payload.set('notes', form.notes.trim())

  if (imageFile.value) payload.set('image', imageFile.value)

  saving.value = true

  try {
    await request(`/api/journals${editingId.value ? `/${editingId.value}` : ''}`, {
      method: editingId.value ? 'PATCH' : 'POST',
      body: payload,
    })

    saving.value = false
    closeEditor()

    notify(editingId.value ? 'Trade updated.' : 'Trade posted.')

    await loadPosts()
  } catch (err) {
    formError.value = err.message || 'Unable to save your trade.'
  } finally {
    saving.value = false
  }
}

function handleViewerError() {
  viewerLoading.value = false
  viewerError.value = true
}

async function openImage(post) {
  selectedImage.value = post
  viewerError.value = false
  viewerLoading.value = true

  await nextTick()
  viewer.value?.showModal()
}

function askDelete(post) {
  selectedPost.value = post
  deleteDialog.value?.showModal()
}

async function removePost() {
  if (!selectedPost.value || deleting.value) return

  deleting.value = true

  try {
    await request(`/api/journals/${selectedPost.value._id}`, {
      method: 'DELETE',
    })

    deleteDialog.value?.close()
    notify('Trade deleted.')

    await loadPosts()
  } catch (err) {
    error.value = err.message
    deleteDialog.value?.close()
  } finally {
    deleting.value = false
  }
}

watch(
  photoSession,
  () => {
    clearAuthorPhotos()

    if (photoSession.value) {
      void loadAuthorPhotos(posts.value)
    }
  },
  { flush: 'sync' },
)

onMounted(() => {
  disposed = false
  photosDisposed = false

  void loadPosts()

  clock = setInterval(() => {
    now.value = Date.now()
  }, 30000)
})

onActivated(() => {
  // KeepAlive also activates on mount; avoid fetching twice the first time.
  if (firstActivation) {
    firstActivation = false
    return
  }
  void loadPosts()
})

onUnmounted(() => {
  disposed = true
  photosDisposed = true

  loadId++
  loadController?.abort()

  clearAuthorPhotos()
  clearInterval(clock)
  clearTimeout(noticeTimer)
  clearFile()
})
</script>

<template>
  <main class="min-h-[75vh] bg-(--page-bg) px-3 py-8 text-(--text-color) sm:px-6 sm:py-12">
    <div class="mx-auto w-full max-w-2xl">
      <header class="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            CMM-FT Community
          </p>
          <h1 class="text-2xl font-bold sm:text-3xl">Trader Communities</h1>
          <p class="mt-2 max-w-xl text-sm opacity-65">
            Share your trades, review your results, and learn from each other.
          </p>
        </div>

        <button
          type="button"
          class="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
          @click="openEditor()"
        >
          + Add Trade
        </button>
      </header>

      <p
        v-if="notice"
        role="status"
        class="mb-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-300"
      >
        {{ notice }}
      </p>

      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-1 rounded-xl bg-slate-500/10 p-1" aria-label="Journal feed">
          <button
            v-for="item in [
              { value: 'all', label: 'All Posts' },
              { value: 'mine', label: 'My Posts' },
            ]"
            :key="item.value"
            type="button"
            :aria-pressed="tab === item.value"
            class="rounded-lg px-4 py-2 text-sm font-medium"
            :class="
              tab === item.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'hover:bg-slate-500/10'
            "
            @click="changeTab(item.value)"
          >
            {{ item.label }}
          </button>
        </div>

        <label class="flex items-center gap-2 text-sm">
          Result
          <select
            v-model="resultFilter"
            class="rounded-lg border border-slate-500/25 bg-(--page-bg) px-3 py-2"
            @change="loadPosts()"
          >
            <option value="all">All results</option>
            <option value="profit">Profit</option>
            <option value="loss">Loss</option>
            <option value="breakeven">Breakeven</option>
          </select>
        </label>
      </div>

      <p class="mb-5 text-xs opacity-60">
        Visible to signed-in members. Results are self-reported. Your username and profile photo are displayed.
      </p>

      <div
        v-if="error"
        role="alert"
        class="mb-5 rounded-xl border border-red-500/25 bg-red-500/10 p-4"
      >
        <p class="text-sm text-red-600 dark:text-red-300">{{ error }}</p>
        <button
          type="button"
          class="mt-3 text-sm font-semibold underline"
          @click="loadPosts()"
        >
          Try again
        </button>
      </div>

      <p v-if="loading" role="status" class="sr-only">
        {{ loadingMore ? 'Loading more trades…' : 'Loading trades…' }}
      </p>

      <div
        v-if="!loading && !error && !posts.length"
        class="rounded-2xl border border-dashed border-slate-500/30 p-10 text-center"
      >
        <h2 class="font-semibold">
          {{ tab === 'mine' ? 'Your journal starts here' : 'No trades to show yet' }}
        </h2>

        <p class="mt-2 text-sm opacity-60">
          {{
            resultFilter === 'all'
              ? 'Post a profit, loss, or breakeven trade and what you learned.'
              : 'Try a different result filter or add a trade.'
          }}
        </p>

        <button
          type="button"
          class="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"
          @click="openEditor()"
        >
          Add your trade
        </button>
      </div>

      <section
        aria-label="Trade posts"
        :aria-busy="loading"
        class="flex w-full min-w-0 flex-col gap-5 sm:gap-6"
      >
        <article
          v-for="post in posts"
          :key="post._id"
          class="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-500/20 bg-slate-500/5"
        >
          <div class="p-4 sm:p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/15 font-bold text-indigo-500"
                  aria-hidden="true"
                >
                  <img
                    v-if="authorPhotoSrc(post)"
                    :key="authorPhotoSrc(post)"
                    :src="authorPhotoSrc(post)"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    class="h-full w-full rounded-full object-cover"
                    @error="authorPhotoFailed(post, $event)"
                  />
                  <span v-else>{{ username(post).slice(0, 1).toUpperCase() }}</span>
                </span>

                <div class="min-w-0">
                  <p class="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                    <span class="min-w-0 truncate">@{{ username(post) }}</span>

                    <svg
                      v-if="isAdminAuthor(post)"
                      viewBox="0 0 24 24"
                      role="img"
                      aria-label="Admin account"
                      class="size-4 shrink-0 text-[#1877f2] dark:text-blue-400"
                    >
                      <title>Admin account</title>
                      <path
                        fill="currentColor"
                        d="m12 2 2.3 1.6 2.8-.2 1 2.6 2.5 1.2-.2 2.8L22 12l-1.6 2.3.2 2.8-2.6 1-1.2 2.5-2.8-.2L12 22l-2.3-1.6-2.8.2-1-2.6-2.5-1.2.2-2.8L2 12l1.6-2.3-.2-2.8 2.6-1 1.2-2.5 2.8.2Z"
                      />
                      <path
                        d="m8 12 2.5 2.5L16 9"
                        fill="none"
                        stroke="white"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                      />
                    </svg>
                  </p>

                  <time
                    :datetime="post.createdAt"
                    :title="exactTime(post.createdAt)"
                    class="text-xs opacity-60"
                  >
                    {{ timeAgo(post.createdAt) }}
                  </time>

                  <span
                    v-if="post.updatedAt && post.updatedAt !== post.createdAt"
                    class="ml-1 text-xs opacity-50"
                    :title="`Edited ${exactTime(post.updatedAt)}`"
                  >
                    · edited
                  </span>
                </div>
              </div>

              <span
                class="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-medium"
                :class="resultClass(post.result)"
              >
                {{ resultLabel(post.result) }}
              </span>
            </div>

            <div class="mt-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold">{{ post.pair }}</h2>
                <p class="mt-1 text-xs font-medium uppercase opacity-60">
                  {{ post.direction === 'buy' ? 'Buy' : 'Sell' }}
                </p>
              </div>

              <p class="text-2xl font-bold tabular-nums" :class="resultClass(post.result)">
                {{ money(post) }}
              </p>
            </div>

            <p
              v-if="post.notes"
              class="mt-4 whitespace-pre-wrap break-words text-sm leading-7 opacity-80"
            >
              {{ post.notes }}
            </p>
          </div>

          <div v-if="post.imageUrl">
            <div
              v-if="imageErrors[post._id]"
              role="status"
              class="bg-black/10 p-5 text-center text-sm"
            >
              <p>Screenshot could not load.</p>
              <button
                type="button"
                class="mt-2 font-semibold text-indigo-500 underline"
                @click="retryImage(post)"
              >
                Retry screenshot
              </button>
            </div>

            <button
              v-else
              type="button"
              class="block w-full bg-black/10"
              :aria-label="`Enlarge ${post.pair} screenshot`"
              @click="openImage(post)"
            >
              <img
                :key="post.imageUrl"
                :src="post.imageUrl"
                :alt="`${post.pair} trade screenshot shared by ${username(post)}`"
                loading="lazy"
                class="max-h-80 w-full object-contain"
                @error="imageErrors[post._id] = true"
              />
              <span class="block py-2 text-xs opacity-60">View screenshot</span>
            </button>
          </div>

          <footer class="border-t border-slate-500/15 px-4 py-3 sm:px-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div
                role="group"
                aria-label="React to this trade"
                :aria-busy="Boolean(reactionBusy[post._id])"
                class="flex flex-wrap gap-2"
              >
                <button
                  v-for="reaction in reactionOptions"
                  :key="reaction.type"
                  type="button"
                  :disabled="Boolean(reactionBusy[post._id]) || !post.reactionsReady"
                  :aria-pressed="post.myReaction === reaction.type"
                  :aria-label="`${post.myReaction === reaction.type ? 'Remove' : 'Choose'} ${reaction.label} reaction, ${post.reactionsReady ? post[reaction.type + 'Count'] : 'loading'} reactions`"
                  class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-wait disabled:opacity-50 sm:text-sm"
                  :class="
                    post.myReaction === reaction.type
                      ? reaction.activeClass
                      : 'border-slate-500/20 hover:bg-slate-500/10'
                  "
                  @click="reactToPost(post, reaction.type)"
                >
                  <span aria-hidden="true" class="text-lg">{{ reaction.emoji }}</span>
                  <span class="inline-flex min-w-4 items-center justify-center tabular-nums">
                    <span v-if="post.reactionsReady">{{ post[reaction.type + 'Count'] }}</span>
                    <span
                      v-else-if="!post.reactionError"
                      aria-hidden="true"
                      class="journal-skeleton block h-3 w-4 rounded"
                    ></span>
                    <span v-else>—</span>
                  </span>
                </button>
              </div>

              <div v-if="mine(post)" class="flex items-center gap-4">
                <button
                  type="button"
                  class="min-h-11 text-xs font-semibold hover:underline"
                  @click="openEditor(post)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="min-h-11 text-xs font-semibold text-red-500 hover:underline"
                  @click="askDelete(post)"
                >
                  Delete
                </button>
              </div>
            </div>

            <p
              v-if="post.reactionError"
              role="alert"
              class="mt-2 text-xs text-red-600 dark:text-red-300"
            >
              {{ post.reactionError }}
              <button
                type="button"
                :disabled="Boolean(reactionBusy[post._id])"
                class="ml-2 font-semibold underline disabled:opacity-50"
                @click="retryReactions(post)"
              >
                Reload reactions
              </button>
            </p>
          </footer>
        </article>

        <div
          v-for="n in skeletonCount"
          :key="`skeleton-${n}`"
          aria-hidden="true"
          class="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-500/20 bg-slate-500/5"
        >
          <div class="p-4 sm:p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <div class="h-10 w-10 shrink-0 rounded-full journal-skeleton"></div>

                <div class="min-w-0 flex-1 space-y-2">
                  <div class="h-4 w-28 max-w-full rounded journal-skeleton"></div>
                  <div class="h-3 w-20 rounded journal-skeleton"></div>
                </div>
              </div>

              <div class="h-6 w-16 shrink-0 rounded-full journal-skeleton"></div>
            </div>

            <div class="mt-5 flex flex-wrap items-end justify-between gap-3">
              <div class="space-y-2">
                <div class="h-5 w-24 rounded journal-skeleton"></div>
                <div class="h-3 w-12 rounded journal-skeleton"></div>
              </div>

              <div class="h-8 w-28 max-w-full rounded journal-skeleton"></div>
            </div>

            <div class="mt-5 space-y-2">
              <div class="h-3 w-full rounded journal-skeleton"></div>
              <div class="h-3 w-4/5 rounded journal-skeleton"></div>
            </div>
          </div>

          <div class="journal-skeleton h-48 w-full sm:h-56"></div>

          <div class="flex flex-wrap items-center gap-2 border-t border-slate-500/15 px-4 py-3 sm:px-5">
            <div class="h-10 w-20 rounded-xl journal-skeleton"></div>
            <div class="h-10 w-20 rounded-xl journal-skeleton"></div>
            <div class="h-10 w-20 rounded-xl journal-skeleton"></div>
          </div>
        </div>
      </section>

      <div v-if="nextCursor" class="mt-7 text-center">
        <button
          type="button"
          :disabled="loading"
          class="rounded-xl border border-slate-500/25 px-6 py-3 text-sm font-semibold disabled:opacity-50"
          @click="loadPosts(true)"
        >
          {{ loading ? 'Loading…' : 'Load more trades' }}
        </button>
      </div>
    </div>

    <!-- Create / edit trade dialog -->
    <dialog
      ref="editor"
      class="journal-dialog w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-slate-500/25 bg-(--page-bg) p-0 text-(--text-color) shadow-2xl"
      aria-labelledby="trade-editor-title"
      @cancel="saving ? $event.preventDefault() : closeEditor()"
    >
      <form class="p-5 sm:p-7" @submit.prevent="savePost">
        <div class="mb-6 flex items-center justify-between gap-3">
          <h2 id="trade-editor-title" class="text-xl font-bold">
            {{ editingId ? 'Edit trade' : 'Add a trade' }}
          </h2>
          <button
            type="button"
            :disabled="saving"
            aria-label="Close form"
            class="rounded-lg px-3 py-1 text-xl disabled:opacity-40"
            @click="closeEditor()"
          >
            ×
          </button>
        </div>

        <fieldset :disabled="saving" class="space-y-4 disabled:opacity-60">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-sm font-medium">
              Trading pair
              <input
                v-model="form.pair"
                required
                maxlength="30"
                placeholder="XAUUSD"
                class="journal-input uppercase"
              />
            </label>

            <label class="block text-sm font-medium">
              Direction
              <select v-model="form.direction" class="journal-input">
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </label>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <label class="block text-sm font-medium">
              Result
              <select v-model="form.result" class="journal-input">
                <option value="profit">Profit</option>
                <option value="loss">Loss</option>
                <option value="breakeven">Breakeven</option>
              </select>
            </label>

            <label class="block text-sm font-medium">
              Currency
              <select v-model="form.currency" class="journal-input">
                <option v-for="currency in ['USD', 'KHR', 'EUR', 'GBP', 'INR']" :key="currency">
                  {{ currency }}
                </option>
              </select>
            </label>
          </div>

          <label v-if="form.result !== 'breakeven'" class="block text-sm font-medium">
            {{ form.result === 'loss' ? 'Loss amount' : 'Profit amount' }}
            <input
              v-model="form.amount"
              type="number"
              min="0.01"
              max="999999999"
              step="0.01"
              inputmode="decimal"
              required
              placeholder="0.00"
              class="journal-input"
            />
            <span class="mt-1 block text-xs font-normal opacity-60">
              Enter a positive amount. The result determines the + or − sign.
            </span>
          </label>

          <label class="block text-sm font-medium">
            Notes
            <textarea
              v-model="form.notes"
              maxlength="2000"
              rows="4"
              placeholder="Why did you enter? What did you learn?"
              class="journal-input resize-y"
            ></textarea>
            <span class="mt-1 block text-right text-xs font-normal opacity-50">
              {{ form.notes.length }}/2000
            </span>
          </label>

          <label class="block text-sm font-medium">
            Screenshot <span class="font-normal opacity-50">(optional)</span>
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="journal-input text-xs"
              @change="chooseFile"
            />
            <span class="mt-1 block text-xs font-normal opacity-60">
              JPG, PNG, or WebP · Maximum 5 MB. Hide account numbers and personal details before uploading.
            </span>
          </label>

          <img
            v-if="imagePreview"
            :src="imagePreview"
            alt="Trade screenshot preview"
            class="max-h-60 w-full rounded-xl bg-black/10 object-contain"
          />

          <p v-if="editingId && imagePreview" class="text-xs opacity-60">
            Choose a new screenshot to replace the current one. Otherwise it stays attached.
          </p>
        </fieldset>

        <p
          v-if="formError"
          role="alert"
          class="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500"
        >
          {{ formError }}
        </p>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            :disabled="saving"
            class="rounded-xl border border-slate-500/25 px-4 py-2.5 text-sm disabled:opacity-40"
            @click="closeEditor()"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Post trade' }}
          </button>
        </div>
      </form>
    </dialog>

    <!-- Screenshot viewer -->
    <dialog
      ref="viewer"
      class="journal-dialog w-[calc(100%-2rem)] max-w-5xl rounded-2xl bg-slate-950 p-4 text-white"
      aria-label="Trade screenshot"
      @close="selectedImage = null"
    >
      <div class="mb-3 flex items-center justify-between gap-3">
        <p class="text-sm">
          {{ selectedImage?.pair }} · @{{ selectedImage ? username(selectedImage) : '' }}
        </p>
        <button
          type="button"
          aria-label="Close screenshot"
          class="px-3 py-1 text-2xl"
          @click="viewer.close()"
        >
          ×
        </button>
      </div>

      <template v-if="selectedImage">
        <p
          v-if="viewerLoading && !viewerError"
          role="status"
          class="py-6 text-center text-sm text-slate-300"
        >
          Loading screenshot…
        </p>

        <div v-if="viewerError" role="status" class="py-8 text-center">
          <p>Screenshot could not load.</p>
          <button
            type="button"
            class="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold"
            @click="retryImage(selectedImage)"
          >
            Retry screenshot
          </button>
        </div>

        <img
          v-else
          :key="selectedImage.imageUrl"
          :src="selectedImage.imageUrl"
          alt="Enlarged trade screenshot"
          class="max-h-[80vh] w-full object-contain"
          @load="viewerLoading = false"
          @error="handleViewerError()"
        />
      </template>
    </dialog>

    <!-- Delete confirmation -->
    <dialog
      ref="deleteDialog"
      class="journal-dialog w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-500/25 bg-(--page-bg) p-6 text-(--text-color)"
      aria-labelledby="delete-title"
      @cancel="deleting && $event.preventDefault()"
    >
      <h2 id="delete-title" class="text-lg font-bold">Delete this trade?</h2>
      <p class="mt-3 text-sm opacity-65">
        Your post and its screenshot will be removed permanently.
      </p>

      <div class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          :disabled="deleting"
          class="rounded-lg border border-slate-500/25 px-4 py-2 text-sm"
          @click="deleteDialog.close()"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="deleting"
          class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          @click="removePost()"
        >
          {{ deleting ? 'Deleting…' : 'Delete' }}
        </button>
      </div>
    </dialog>
  </main>
</template>

<style scoped>
.journal-dialog {
  margin: auto;
  max-height: 90dvh;
  overflow-y: auto;
}

.journal-dialog::backdrop {
  background: rgb(2 6 23 / 75%);
  backdrop-filter: blur(4px);
}

.journal-input {
  display: block;
  width: 100%;
  margin-top: 0.5rem;
  border: 1px solid rgb(100 116 139 / 30%);
  border-radius: 0.75rem;
  padding: 0.7rem 0.85rem;
  background: var(--page-bg);
  color: inherit;
  font: inherit;
}

.journal-input:focus {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.journal-skeleton {
  position: relative;
  overflow: hidden;
  background: rgb(100 116 139 / 24%);
}

.journal-skeleton::after {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(90deg, transparent, rgb(148 163 184 / 32%), transparent);
  transform: translateX(-100%);
  animation: journal-shimmer 1.5s ease-in-out infinite;
}

@keyframes journal-shimmer {
  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .journal-skeleton::after {
    animation: none;
    background: none;
  }
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: wait;
}
</style>
