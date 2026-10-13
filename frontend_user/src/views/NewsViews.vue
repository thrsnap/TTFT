<template>
  <main
    class="min-h-screen bg-(--page-bg) px-4 py-10
           text-(--text-color) transition-colors duration-300 sm:px-6
           max-[768px]:px-4 max-[768px]:py-8
           max-[600px]:py-7
           max-[480px]:px-3 max-[480px]:py-6
           max-[414px]:px-2.5 max-[414px]:py-5
           max-[320px]:px-2 max-[320px]:py-4"
  >
    <div class="mx-auto min-w-0 max-w-7xl">
      <header
        class="mb-8 max-[768px]:mb-7 max-[600px]:mb-6
               max-[480px]:mb-5 max-[414px]:mb-4 max-[320px]:mb-3"
      >
        <h1
          class="text-3xl font-bold sm:text-4xl
                 max-[768px]:text-3xl max-[600px]:text-[28px]
                 max-[480px]:text-2xl max-[414px]:text-[22px]
                 max-[320px]:text-xl"
        >
          News
        </h1>

        <p
          class="mt-3 leading-7 text-(--muted-color)
                 max-[600px]:text-sm max-[600px]:leading-6
                 max-[480px]:mt-2 max-[320px]:text-xs"
        >
          Explore market stories and financial updates from around the world.
        </p>
      </header>

      <section
        v-if="breakingNews"
        aria-label="Latest news headline"
        class="mb-10 overflow-hidden rounded-2xl
               border border-red-500/30 bg-red-500/10
               max-[768px]:mb-8 max-[600px]:mb-7
               max-[480px]:mb-6 max-[480px]:rounded-xl
               max-[414px]:mb-5 max-[320px]:mb-4"
      >
        <div class="flex flex-col md:flex-row">
          <div
            class="flex shrink-0 items-center gap-3
                   bg-red-600 px-6 py-5 text-white
                   max-[768px]:px-5 max-[768px]:py-4
                   max-[600px]:px-4 max-[600px]:py-3
                   max-[480px]:gap-2 max-[480px]:px-3
                   max-[320px]:px-2.5"
          >
            <span class="relative flex h-3 w-3 shrink-0">
              <span
                class="absolute inline-flex h-full w-full animate-ping
                       rounded-full bg-white opacity-60
                       motion-reduce:animate-none"
              ></span>

              <span
                class="relative h-3 w-3 rounded-full bg-white"
              ></span>
            </span>

            <h2
              class="font-bold uppercase tracking-wide
                     max-[600px]:text-sm max-[320px]:text-xs"
            >
              Breaking
            </h2>
          </div>

          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer items-center
                   justify-between gap-5 px-6 py-5 text-left
                   transition-colors hover:bg-(--hover-bg)
                   focus-visible:outline-2 focus-visible:outline-indigo-500
                   max-[768px]:gap-4 max-[768px]:px-5
                   max-[600px]:px-4 max-[600px]:py-4
                   max-[480px]:gap-3 max-[480px]:px-3
                   max-[414px]:py-3
                   max-[320px]:gap-2 max-[320px]:px-2.5"
            @click="openArticle(breakingNews)"
          >
            <div class="min-w-0">
              <h3
                class="wrap-anywhere font-semibold sm:text-lg
                       max-[600px]:text-base max-[480px]:text-sm
                       max-[320px]:text-[13px]"
              >
                {{ breakingNews.title }}
              </h3>

              <time
                :datetime="breakingNews.addedAt || undefined"
                :title="addedTimeTitle(breakingNews)"
                class="mt-2 block text-xs text-(--muted-color)"
              >
                {{ formatAddedTime(breakingNews.addedAt) }}
              </time>
            </div>

            <span aria-hidden="true" class="shrink-0 text-xl">→</span>
          </button>
        </div>
      </section>

      <section aria-labelledby="latest-news" class="min-w-0">
        <div
          class="mb-6 flex flex-wrap items-end justify-between gap-3
                 max-[600px]:mb-5 max-[480px]:mb-4 max-[414px]:gap-2"
        >
          <h2
            id="latest-news"
            class="text-2xl font-bold sm:text-3xl
                   max-[768px]:text-[26px] max-[600px]:text-2xl
                   max-[480px]:text-xl max-[414px]:text-lg
                   max-[320px]:text-base"
          >
            Latest News
          </h2>

          <span
            aria-live="polite"
            class="text-sm text-(--muted-color) max-[480px]:text-xs"
          >
            {{ filteredNews.length }} articles
          </span>
        </div>

        <nav
          aria-label="News categories"
          class="mb-6 flex flex-wrap gap-2 max-[600px]:mb-5
                 max-[480px]:mb-4 max-[480px]:gap-1.5 max-[320px]:gap-1"
        >
          <RouterLink
            v-for="category in categories"
            :key="category.value"
            :to="categoryLocation(category.value)"
            :aria-current="
              selectedCategory === category.value ? 'page' : undefined
            "
            class="cursor-pointer rounded-full border px-5 py-2.5
                   text-sm font-semibold transition-colors
                   focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-indigo-500
                   max-[768px]:px-4 max-[600px]:px-3.5
                   max-[480px]:px-3 max-[480px]:text-xs
                   max-[414px]:px-2.5 max-[320px]:px-2"
            :class="
              selectedCategory === category.value
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-(--border-color) bg-(--surface-bg) text-(--text-color) hover:border-indigo-400 hover:bg-(--hover-bg)'
            "
          >
            {{ category.label }}
          </RouterLink>
        </nav>

        <div class="mb-3 space-y-2">
          <template v-for="feed in feedStatuses" :key="feed.key">
            <p
              v-if="feed.loading"
              role="status"
              class="text-sm text-(--muted-color)"
            >
              Loading {{ feed.label }} news…
            </p>

            <div
              v-if="feed.error"
              class="flex flex-wrap items-center gap-3"
            >
              <p role="alert" class="text-sm text-red-500">
                {{ feed.error }}
              </p>

              <button
                type="button"
                :disabled="feed.loading"
                class="cursor-pointer text-sm text-indigo-500 underline
                       disabled:opacity-50"
                @click="feed.retry()"
              >
                Retry {{ feed.label }} news
              </button>
            </div>

            <p
              v-if="feed.stale"
              class="text-sm text-(--muted-color)"
            >
              Showing saved {{ feed.label }} news while the feed is unavailable.
            </p>
          </template>
        </div>

        <p id="scroll-instructions" class="sr-only">
          Scroll using your mouse wheel, touch, or keyboard.
        </p>

        <div
          ref="newsScroll"
          tabindex="0"
          role="region"
          aria-label="Latest news cards"
          aria-describedby="scroll-instructions"
          class="max-h-[75vh] min-w-0 overflow-y-auto rounded-xl
                 [scrollbar-gutter:stable]
                 [scrollbar-color:#6366f1_var(--surface-bg)]
                 focus-visible:outline-2 focus-visible:outline-indigo-500
                 [&::-webkit-scrollbar]:w-3
                 [&::-webkit-scrollbar-track]:rounded-full
                 [&::-webkit-scrollbar-track]:bg-(--surface-bg)
                 [&::-webkit-scrollbar-thumb]:rounded-full
                 [&::-webkit-scrollbar-thumb]:border-2
                 [&::-webkit-scrollbar-thumb]:border-solid
                 [&::-webkit-scrollbar-thumb]:border-(--surface-bg)
                 [&::-webkit-scrollbar-thumb]:bg-indigo-500
                 max-[768px]:max-h-[75dvh]"
        >
          <div
            class="grid grid-cols-3 gap-6 p-2 pr-4
                   max-[768px]:grid-cols-3 max-[768px]:gap-3
                   max-[600px]:grid-cols-2 max-[600px]:gap-3
                   max-[480px]:grid-cols-2 max-[480px]:gap-2
                   max-[480px]:p-1 max-[480px]:pr-2
                   max-[414px]:gap-1.5
                   max-[320px]:gap-1 max-[320px]:pr-1"
          >
            <p
              v-if="filteredNews.length === 0"
              class="col-span-full py-12 text-center text-(--muted-color)
                     max-[480px]:py-8 max-[480px]:text-sm"
            >
              {{
                selectedFeedLoading
                  ? 'Loading articles…'
                  : 'No articles in this category yet.'
              }}
            </p>

            <article
              v-for="article in filteredNews"
              :key="article.id"
              class="group flex h-full min-w-0 flex-col
                     overflow-hidden rounded-2xl
                     border border-(--border-color) bg-(--surface-bg)
                     transition-colors duration-300
                     max-[768px]:rounded-xl max-[414px]:rounded-lg"
            >
              <button
                v-if="hasUsableImage(article)"
                type="button"
                :aria-label="`Read article: ${article.title}`"
                class="block aspect-[16/10] w-full shrink-0 cursor-pointer
                       overflow-hidden bg-(--input-bg)
                       focus-visible:outline-2
                       focus-visible:-outline-offset-2
                       focus-visible:outline-indigo-500"
                @click="openArticle(article)"
              >
                <img
                  :key="article.image"
                  :src="article.image"
                  alt=""
                  loading="lazy"
                  class="h-full w-full object-cover"
                  @error="handleImageError(article)"
                />
              </button>

              <div
                v-else
                class="flex aspect-[16/10] w-full shrink-0 items-center
                       justify-center bg-(--input-bg) px-3 text-center
                       text-sm text-(--muted-color)
                       max-[480px]:text-xs"
              >
                No image available
              </div>

              <div
                class="flex min-w-0 flex-1 flex-col p-5
                       [overflow-wrap:anywhere]
                       max-[768px]:p-3 max-[600px]:p-3
                       max-[480px]:p-2.5 max-[414px]:p-2
                       max-[320px]:p-1.5"
              >
                <div
                  class="mb-3 flex flex-wrap items-center gap-2
                         text-xs text-(--muted-color)
                         max-[768px]:mb-2 max-[768px]:gap-1
                         max-[480px]:text-[11px]"
                >
                  <time
                    :datetime="article.addedAt || undefined"
                    :title="addedTimeTitle(article)"
                  >
                    {{ formatAddedTime(article.addedAt) }}
                  </time>

                  <span aria-hidden="true">•</span>
                  <span>{{ article.author }}</span>
                </div>

                <h3
                  class="text-xl font-bold leading-snug
                         max-[768px]:text-base max-[600px]:text-base
                         max-[480px]:text-sm max-[414px]:text-[13px]
                         max-[320px]:text-xs"
                >
                  {{ article.title }}
                </h3>

                <p
                  v-if="article.description"
                  class="mt-3 text-sm leading-7 text-(--muted-color)
                         max-[768px]:mt-2 max-[768px]:text-xs
                         max-[768px]:leading-5 max-[480px]:line-clamp-3"
                >
                  {{ article.description }}
                </p>

                <div
                  class="mt-auto pt-6 max-[768px]:pt-4
                         max-[480px]:pt-3 max-[320px]:pt-2"
                >
                  <button
                    type="button"
                    :aria-label="`Read more: ${article.title}`"
                    class="inline-flex min-h-11 cursor-pointer items-center
                           gap-2 rounded text-sm font-semibold
                           text-indigo-500 transition-colors
                           hover:text-indigo-400
                           focus-visible:outline-2
                           focus-visible:outline-indigo-500
                           max-[768px]:text-xs max-[414px]:gap-1"
                    @click="openArticle(article)"
                  >
                    Read More
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>

    <dialog
      ref="articleDialog"
      aria-labelledby="article-title"
      class="fixed inset-0 m-auto max-h-[85vh]
             w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto
             rounded-2xl border border-(--border-color)
             bg-(--surface-bg) p-0 text-(--text-color)
             shadow-2xl backdrop:bg-black/80
             transition-colors duration-300
             [scrollbar-width:thin]
             [scrollbar-color:#6366f1_var(--surface-bg)]
             max-[768px]:max-h-[90dvh]
             max-[600px]:w-[calc(100%_-_1.5rem)]
             max-[480px]:w-[calc(100%_-_1rem)]
             max-[480px]:rounded-xl
             max-[414px]:max-h-[92dvh]
             max-[320px]:w-[calc(100%_-_0.75rem)]"
      @click="closeOnBackdrop"
    >
      <div v-if="selectedArticle" class="min-w-0">
        <div
          class="sticky top-0 z-10 flex items-center justify-between gap-4
                 border-b border-(--border-color) bg-(--surface-bg)
                 px-5 py-4 transition-colors duration-300 sm:px-8
                 max-[768px]:px-5
                 max-[600px]:px-4 max-[600px]:py-3
                 max-[480px]:gap-3 max-[480px]:px-3
                 max-[320px]:gap-2 max-[320px]:px-2.5"
        >
          <span
            class="font-semibold text-indigo-500 max-[480px]:text-sm"
          >
            Article Summary
          </span>

          <button
            type="button"
            autofocus
            class="shrink-0 cursor-pointer rounded-lg bg-(--input-bg)
                   px-4 py-2 text-sm font-medium text-(--text-color)
                   transition-colors hover:bg-(--hover-bg)
                   focus-visible:outline-2 focus-visible:outline-indigo-500
                   max-[480px]:px-3"
            @click="closeArticle"
          >
            Close ✕
          </button>
        </div>

        <div
          class="p-5 sm:p-8 max-[768px]:p-6 max-[600px]:p-5
                 max-[480px]:p-4 max-[414px]:p-3.5 max-[320px]:p-3"
        >
          <!-- Full dates and times appear inside Read More. -->
          <div
  class="mb-4 space-y-2 text-sm text-(--muted-color)
         [overflow-wrap:anywhere]
         max-[480px]:mb-3 max-[480px]:text-xs"
>
  <p class="font-semibold">
    {{ selectedArticle.author }}
  </p>

  <p>
    added at
    <time :datetime="selectedArticle.addedAt || undefined">
      {{ formatFullDate(selectedArticle.addedAt) }}
    </time>
  </p>
</div>
          <h2
            id="article-title"
            class="text-2xl font-bold leading-tight sm:text-3xl
                   [overflow-wrap:anywhere]
                   max-[768px]:text-[28px] max-[600px]:text-2xl
                   max-[480px]:text-xl max-[414px]:text-lg
                   max-[320px]:text-base"
          >
            {{ selectedArticle.title }}
          </h2>

          <img
            v-if="hasUsableImage(selectedArticle)"
            :key="`${selectedArticle.id}-${selectedArticle.image}`"
            :src="selectedArticle.image"
            alt=""
            class="mt-6 aspect-video w-full rounded-xl
                   bg-(--input-bg) object-cover
                   max-[600px]:mt-5 max-[480px]:mt-4 max-[320px]:mt-3"
            @error="handleImageError(selectedArticle)"
          />

          <div
            v-else
            class="mt-6 flex aspect-video w-full items-center
                   justify-center rounded-xl bg-(--input-bg)
                   px-4 text-center text-sm text-(--muted-color)
                   max-[600px]:mt-5 max-[480px]:mt-4
                   max-[480px]:text-xs max-[320px]:mt-3"
          >
            No image available
          </div>

          <p
            class="mt-6 whitespace-pre-line break-words
                   text-base leading-8 text-(--text-color)
                   max-[768px]:leading-7
                   max-[600px]:mt-5 max-[600px]:text-[15px]
                   max-[480px]:mt-4 max-[480px]:text-sm
                   max-[414px]:leading-6
                   max-[320px]:mt-3 max-[320px]:text-[13px]"
          >
            {{ selectedArticle.content }}
          </p>

          <a
            v-if="selectedArticle.link"
            :href="selectedArticle.link"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-5 inline-flex min-h-11 items-center gap-2 rounded
                   text-sm font-semibold text-indigo-500 underline
                   hover:text-indigo-400
                   focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            Read full article at {{ selectedArticle.author }}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </dialog>

    <impactnews />
  </main>
</template>

<script setup>
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import impactnews from '../components/impactnew.vue'


const route = useRoute()
const emit = defineEmits(['subscribe'])

function forwardSubscription(...args) {
  emit('subscribe', ...args)
}

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
)
  .trim()
  .replace(/\/+$/, '')

const REFRESH_INTERVAL = 5 * 60 * 1000
const RELATIVE_TIME_INTERVAL = 10 * 1000

const ALL_CATEGORIES = [
  'economy',
  'markets',
  'forex',
  'crypto',
]

let newsRefreshTimer = null
let relativeTimeTimer = null
let disposed = false

const activeRequests = new Set()
const relativeNow = ref(Date.now())

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', {
  numeric: 'always',
})

const relativeUnits = [
  { name: 'year', seconds: 365 * 24 * 60 * 60 },
  { name: 'month', seconds: 30 * 24 * 60 * 60 },
  { name: 'week', seconds: 7 * 24 * 60 * 60 },
  { name: 'day', seconds: 24 * 60 * 60 },
  { name: 'hour', seconds: 60 * 60 },
  { name: 'minute', seconds: 60 },
]

const categories = [
  { value: 'all', label: 'All' },
  { value: 'economy', label: 'Economy' },
  { value: 'markets', label: 'Markets' },
  { value: 'insider', label: 'Insider Trading' },
  { value: 'forex', label: 'Forex' },
  { value: 'crypto', label: 'Crypto' },
]

const feedDefinitions = [
  {
    key: 'economy',
    label: 'economy',
    endpoint: '/api/investing-news',
  },
  {
    key: 'markets',
    label: 'stock market',
    endpoint: '/api/investing-news/markets',
  },
  {
    key: 'insider',
    label: 'insider trading',
    endpoint: '/api/investing-news/insider',
  },
  {
    key: 'forex',
    label: 'forex',
    endpoint: '/api/investing-news/forex',
  },
  {
    key: 'crypto',
    label: 'crypto',
    endpoint: '/api/investing-news/crypto',
  },
]

const newsScroll = ref(null)
const selectedArticle = ref(null)
const articleDialog = ref(null)
const news = ref([])
const brokenImages = reactive(new Set())

const feedState = reactive(
  Object.fromEntries(
    feedDefinitions.map((feed) => [
      feed.key,
      {
        loading: false,
        error: '',
        stale: false,
      },
    ]),
  ),
)

const selectedCategory = computed(() => {
  const category = route.params.category

  return categories.some((item) => item.value === category)
    ? category
    : 'all'
})

function categoryLocation(category) {
  const prefix = route.params.lang === 'km' ? '/km' : ''

  return {
    path:
      category === 'all'
        ? `${prefix}/news`
        : `${prefix}/news/${category}`,
    query: route.query,
  }
}

function belongsToSelectedCategory(category) {
  return selectedCategory.value === 'all'
    ? ALL_CATEGORIES.includes(category)
    : category === selectedCategory.value
}

const feedStatuses = computed(() =>
  feedDefinitions
    .filter((feed) => belongsToSelectedCategory(feed.key))
    .map((feed) => ({
      key: feed.key,
      label: feed.label,
      ...feedState[feed.key],
      retry: () => loadInvestingFeed(feed.key, feed.endpoint),
    })),
)

const selectedFeedLoading = computed(() =>
  feedStatuses.value.some((feed) => feed.loading),
)

function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return ''

  try {
    const url = new URL(value.trim())

    return ['https:', 'http:'].includes(url.protocol)
      ? url.href
      : ''
  } catch {
    return ''
  }
}

function normalizeDate(value) {
  if (!value) return null

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString()
}

function articleTimestamp(value) {
  if (!value) return 0

  const timestamp = new Date(value).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function updateRelativeTime() {
  relativeNow.value = Date.now()
}

function formatAddedTime(value) {
  if (!value) return 'Added time unavailable'

  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) {
    return 'Added time unavailable'
  }

  const difference = timestamp - relativeNow.value

  if (difference >= 60000) {
    return 'Added time unavailable'
  }

  const seconds = Math.floor(
    Math.max(0, -difference) / 1000,
  )

  if (seconds < 60) {
    return 'Added just now'
  }

  const unit = relativeUnits.find(
    (item) => seconds >= item.seconds,
  )

  const amount = Math.floor(seconds / unit.seconds)

  return `Added ${relativeTimeFormatter.format(-amount, unit.name)}`
}

// Full date and time in the visitor's device timezone.
function formatFullDate(value) {
  if (!value) return 'Time unavailable'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Time unavailable'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date)
}

function addedTimeTitle(article) {
  return `First added to this website: ${formatFullDate(article.addedAt)}`
}

function hasUsableImage(article) {
  return Boolean(
    article?.image && !brokenImages.has(article.image),
  )
}

function handleImageError(article) {
  if (article?.image) {
    brokenImages.add(article.image)
  }
}

const latestNews = computed(() =>
  [...news.value].sort(
    (a, b) =>
      articleTimestamp(b.publishedAt) -
        articleTimestamp(a.publishedAt) ||
      articleTimestamp(b.addedAt) -
        articleTimestamp(a.addedAt),
  ),
)

const filteredNews = computed(() =>
  latestNews.value.filter((article) =>
    belongsToSelectedCategory(article.category),
  ),
)

const breakingNews = computed(() =>
  latestNews.value.find((article) =>
    ALL_CATEGORIES.includes(article.category),
  ),
)

watch(
  () => route.params.category,
  async () => {
    closeArticle()
    await nextTick()

    if (newsScroll.value) {
      newsScroll.value.scrollTop = 0
    }
  },
)

async function openArticle(article) {
  if (!article || disposed) return

  updateRelativeTime()
  selectedArticle.value = article

  await nextTick()

  if (disposed) return

  const dialog = articleDialog.value

  if (dialog && !dialog.open) {
    dialog.showModal()
    dialog.scrollTop = 0
  }
}

function closeArticle() {
  articleDialog.value?.close()
}

function closeOnBackdrop(event) {
  const dialog = articleDialog.value

  if (!dialog || event.target !== dialog) return

  const rect = dialog.getBoundingClientRect()

  const outside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom

  if (outside) closeArticle()
}

function replaceProviderArticles(provider, articles) {
  const otherNews = news.value.filter(
    (article) => article.provider !== provider,
  )

  const uniqueArticles = [
    ...new Map(
      articles.map((article) => [article.id, article]),
    ).values(),
  ]

  news.value = [...otherNews, ...uniqueArticles]

  if (selectedArticle.value?.provider === provider) {
    const selectedId = selectedArticle.value.id

    const updatedArticle = uniqueArticles.find(
      (article) => article.id === selectedId,
    )

    if (updatedArticle) {
      selectedArticle.value = updatedArticle
    }
  }
}

async function loadInvestingFeed(category, endpoint) {
  const state = feedState[category]
  const provider = `investing-${category}`

  if (disposed || state.loading) return

  state.loading = true
  state.error = ''

  const controller = new AbortController()
  activeRequests.add(controller)

  const requestTimeout = window.setTimeout(() => {
    controller.abort()
  }, 20000)

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      signal: controller.signal,
      cache: 'no-store',
    })

    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.success) {
      throw new Error(
        data?.message ||
          `Unable to load ${category} news (HTTP ${response.status}).`,
      )
    }

    if (!Array.isArray(data.news)) {
      throw new Error(`Invalid ${category} news response.`)
    }

    const articles = data.news
      .filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          !(
            category === 'crypto' &&
            /ETH\s+Gas\s*:/i.test(item.title || '')
          ),
      )
      .map((item, index) => ({
        id: `${provider}-${item.id || item.link || index}`,
        provider,
        category,
        title: item.title || 'Latest News',

        addedAt: normalizeDate(item.addedAt),
        publishedAt: normalizeDate(item.publishedAt),

        author: item.source || 'Investing.com',
        image: safeUrl(item.image),
        description: item.description || '',
        content:
          item.description ||
          'Read the full article at Investing.com.',
        link: safeUrl(item.link),
      }))

    if (disposed) return

    replaceProviderArticles(provider, articles)
    state.stale = Boolean(data.stale)
    updateRelativeTime()
  } catch (error) {
    if (disposed) return

    console.error(`${category} news error:`, error)

    state.error =
      error.name === 'AbortError'
        ? `${category.charAt(0).toUpperCase() + category.slice(1)} news request timed out. Please retry.`
        : error.message || `Unable to load ${category} news.`
  } finally {
    window.clearTimeout(requestTimeout)
    activeRequests.delete(controller)
    state.loading = false
  }
}

function refreshAllFeeds() {
  return Promise.allSettled(
    feedDefinitions.map((feed) =>
      loadInvestingFeed(feed.key, feed.endpoint),
    ),
  )
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    updateRelativeTime()
    refreshAllFeeds()
  }
}

onMounted(() => {
  updateRelativeTime()
  refreshAllFeeds()

  relativeTimeTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      updateRelativeTime()
    }
  }, RELATIVE_TIME_INTERVAL)

  newsRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      refreshAllFeeds()
    }
  }, REFRESH_INTERVAL)

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange,
  )
})

onUnmounted(() => {
  disposed = true

  window.clearInterval(relativeTimeTimer)
  window.clearInterval(newsRefreshTimer)

  document.removeEventListener(
    'visibilitychange',
    handleVisibilityChange,
  )

  for (const controller of activeRequests) {
    controller.abort()
  }

  activeRequests.clear()
})
</script>