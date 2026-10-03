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
      <!-- Page heading -->
      <header
        class="mb-8
               max-[768px]:mb-7
               max-[600px]:mb-6
               max-[480px]:mb-5
               max-[414px]:mb-4
               max-[320px]:mb-3"
      >
        <h1
          class="text-3xl font-bold sm:text-4xl
                 max-[768px]:text-3xl
                 max-[600px]:text-[28px]
                 max-[480px]:text-2xl
                 max-[414px]:text-[22px]
                 max-[320px]:text-xl"
        >
           News
        </h1>

        <p
          class="mt-3 leading-7 text-(--muted-color)
                 max-[600px]:text-sm max-[600px]:leading-6
                 max-[480px]:mt-2
                 max-[320px]:text-xs"
        >
          Explore market stories and financial updates from around the world.
        </p>
      </header>

      <!-- Breaking news -->
      <section
        aria-label="Breaking news"
        class="mb-10 overflow-hidden rounded-2xl
               border border-red-500/30 bg-red-500/10
               max-[768px]:mb-8
               max-[600px]:mb-7
               max-[480px]:mb-6 max-[480px]:rounded-xl
               max-[414px]:mb-5
               max-[320px]:mb-4"
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
                class="absolute inline-flex h-full w-full
                       animate-ping rounded-full bg-white opacity-60
                       motion-reduce:animate-none"
              ></span>

              <span
                class="relative h-3 w-3 rounded-full bg-white"
              ></span>
            </span>

            <h2
              class="font-bold uppercase tracking-wide
                     max-[600px]:text-sm
                     max-[320px]:text-xs"
            >
              Breaking News
            </h2>
          </div>

          <button
            v-if="breakingNews"
            type="button"
            class="group flex min-w-0 flex-1 items-center
                   justify-between gap-5 px-6 py-5 text-left
                   transition-colors hover:bg-(--hover-bg)
                   focus-visible:outline-2
                   focus-visible:outline-indigo-500
                   max-[768px]:gap-4 max-[768px]:px-5
                   max-[600px]:px-4 max-[600px]:py-4
                   max-[480px]:gap-3 max-[480px]:px-3
                   max-[414px]:py-3
                   max-[320px]:gap-2 max-[320px]:px-2.5"
            @click="openArticle(breakingNews)"
          >
            <div class="min-w-0 wrap-anywhere">
            

              <h3
                class="font-semibold sm:text-lg
                       max-[600px]:text-base
                       max-[480px]:text-sm
                       max-[320px]:text-[13px]"
              >
                {{ breakingNews.title }}
              </h3>
            </div>

            <span aria-hidden="true" class="shrink-0 text-xl">
              →
            </span>
          </button>
        </div>
      </section>

      <!-- Latest news -->
      <section aria-labelledby="latest-news" class="min-w-0">
        <div
          class="mb-6 flex flex-wrap items-end justify-between gap-3
                 max-[600px]:mb-5
                 max-[480px]:mb-4
                 max-[414px]:gap-2"
        >
          <div class="min-w-0">
            <h2
              id="latest-news"
              class="text-2xl font-bold sm:text-3xl
                     max-[768px]:text-[26px]
                     max-[600px]:text-2xl
                     max-[480px]:text-xl
                     max-[414px]:text-lg
                     max-[320px]:text-base"
            >
              Latest News
            </h2>
          </div>

          <span
            aria-live="polite"
            class="text-sm text-(--muted-color)
                   max-[480px]:text-xs"
          >
            {{ filteredNews.length }} articles
          </span>
        </div>

        <!-- Category filters -->
        <div
          role="group"
          aria-label="Filter news by category"
          class="mb-6 flex flex-wrap gap-2
                 max-[600px]:mb-5
                 max-[480px]:mb-4 max-[480px]:gap-1.5
                 max-[320px]:gap-1"
        >
          <button
            v-for="category in categories"
            :key="category.value"
            type="button"
            :aria-pressed="selectedCategory === category.value"
            class="cursor-pointer rounded-full border px-5 py-2.5
                   text-sm font-semibold transition-colors
                   focus-visible:outline-2
                   focus-visible:outline-offset-2
                   focus-visible:outline-indigo-500
                   max-[768px]:px-4
                   max-[600px]:px-3.5
                   max-[480px]:px-3 max-[480px]:text-xs
                   max-[414px]:px-2.5
                   max-[320px]:px-2"
            :class="
              selectedCategory === category.value
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-(--border-color) bg-(--surface-bg) text-(--text-color) hover:border-indigo-400 hover:bg-(--hover-bg)'
            "
            @click="selectCategory(category.value)"
          >
            {{ category.label }}
          </button>
        </div>

        <!-- Scrollable news area -->
        <div
          ref="newsScroll"
          tabindex="0"
          role="region"
          aria-label="Latest news cards"
          aria-describedby="scroll-instructions"
          class="max-h-[75vh] min-w-0 overflow-y-scroll rounded-xl
                 [scrollbar-gutter:stable]
                 [scrollbar-color:#6366f1_var(--surface-bg)]
                 focus-visible:outline-2
                 focus-visible:outline-indigo-500
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
          <!-- Keep your existing mouse-wheel behavior -->
          <div
  class="grid grid-cols-3 gap-6 p-2 pr-4
         max-[768px]:grid-cols-3 max-[768px]:gap-3
         max-[600px]:grid-cols-2 max-[600px]:gap-3
         max-[480px]:grid-cols-2 max-[480px]:gap-2
         max-[480px]:p-1 max-[480px]:pr-2
         max-[414px]:gap-1.5
         max-[320px]:gap-1 max-[320px]:pr-1"
  @wheel.prevent
>
            <p
              v-if="filteredNews.length === 0"
              class="col-span-full py-12 text-center text-(--muted-color)
                     max-[480px]:py-8 max-[480px]:text-sm"
            >
              No articles in this category yet.
            </p>

           <article
  v-for="article in filteredNews"
  :key="article.id"
  class="group flex h-full min-w-0 flex-col
         overflow-hidden rounded-2xl
         border border-(--border-color)
         bg-(--surface-bg)
         transition-colors duration-300
         max-[768px]:rounded-xl
         max-[414px]:rounded-lg"
>
  <!-- Card image -->
  <button
    type="button"
    :aria-label="`Read article: ${article.title}`"
    class="block aspect-[16/10] w-full shrink-0
           overflow-hidden bg-(--input-bg)
           focus-visible:outline-2
           focus-visible:-outline-offset-2
           focus-visible:outline-indigo-500"
    @click="openArticle(article)"
  >
    <img
      :src="article.image"
      alt=""
      loading="lazy"
      class="h-full w-full object-cover"
    />
  </button>

  <!-- Card content -->
  <div
    class="flex min-w-0 flex-1 flex-col p-5
           [overflow-wrap:anywhere]
           max-[768px]:p-3
           max-[600px]:p-3
           max-[480px]:p-2.5
           max-[414px]:p-2
           max-[320px]:p-1.5"
  >
    <div
      class="mb-3 flex flex-wrap items-center gap-2
             text-xs text-(--muted-color)
             max-[768px]:mb-2 max-[768px]:gap-1
             max-[480px]:text-[11px]"
    >
      <time :datetime="article.date">
        {{ formatDate(article.date) }}
      </time>

      <span aria-hidden="true">•</span>
      <span>{{ article.author }}</span>
    </div>

    <h3
      class="text-xl font-bold leading-snug
             max-[768px]:text-base
             max-[600px]:text-base
             max-[480px]:text-sm
             max-[414px]:text-[13px]
             max-[320px]:text-xs"
    >
      {{ article.title }}
    </h3>

    <p
      class="mt-3 text-sm leading-7 text-(--muted-color)
             max-[768px]:mt-2 max-[768px]:text-xs
             max-[768px]:leading-5
             max-[480px]:line-clamp-3"
    >
      {{ article.description }}
    </p>

    <div
      class="mt-auto pt-6
             max-[768px]:pt-4
             max-[480px]:pt-3
             max-[320px]:pt-2"
    >
      <button
        type="button"
        :aria-label="`Read more: ${article.title}`"
        class="inline-flex min-h-11 items-center gap-2 rounded
               text-sm font-semibold text-indigo-400
               transition-colors hover:text-indigo-300
               in-[.ligh-mode]:text-indigo-700
               in-[.ligh-mode]:hover:text-indigo-900
               focus-visible:outline-2
               focus-visible:outline-indigo-500
               max-[768px]:text-xs
               max-[414px]:gap-1"
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

    <!-- Article popup -->
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
          class="sticky top-0 z-10 flex items-center
                 justify-between gap-4
                 border-b border-(--border-color)
                 bg-(--surface-bg) px-5 py-4
                 transition-colors duration-300 sm:px-8
                 max-[768px]:px-5
                 max-[600px]:px-4 max-[600px]:py-3
                 max-[480px]:gap-3 max-[480px]:px-3
                 max-[320px]:gap-2 max-[320px]:px-2.5"
        >
          <span
            class="font-semibold text-indigo-400
                   in-[.ligh-mode]:text-indigo-700
                   max-[480px]:text-sm"
          >
            Full Article
          </span>

          <button
            type="button"
            autofocus
            class="shrink-0 rounded-lg bg-(--input-bg) px-4 py-2
                   text-sm font-medium text-(--text-color)
                   transition-colors hover:bg-(--hover-bg)
                   focus-visible:outline-2
                   focus-visible:outline-indigo-500
                   max-[480px]:px-3"
            @click="closeArticle"
          >
            Close ✕
          </button>
        </div>

        <div
          class="p-5 sm:p-8
                 max-[768px]:p-6
                 max-[600px]:p-5
                 max-[480px]:p-4
                 max-[414px]:p-3.5
                 max-[320px]:p-3"
        >
          <div
            class="mb-4 flex flex-wrap gap-2
                   text-sm text-(--muted-color)
                   [overflow-wrap:anywhere]
                   max-[480px]:mb-3 max-[480px]:text-xs"
          >
            <time :datetime="selectedArticle.date">
              {{ formatDate(selectedArticle.date) }}
            </time>

            <span aria-hidden="true">•</span>
            <span>{{ selectedArticle.author }}</span>
          </div>

          <h2
            id="article-title"
            class="text-2xl font-bold leading-tight sm:text-3xl
                   [overflow-wrap:anywhere]
                   max-[768px]:text-[28px]
                   max-[600px]:text-2xl
                   max-[480px]:text-xl
                   max-[414px]:text-lg
                   max-[320px]:text-base"
          >
            {{ selectedArticle.title }}
          </h2>

          <img
            :src="selectedArticle.image"
            alt=""
            class="mt-6 aspect-video w-full rounded-xl
                   bg-(--input-bg) object-cover
                   max-[600px]:mt-5
                   max-[480px]:mt-4
                   max-[320px]:mt-3"
          />

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
        </div>
      </div>
    </dialog>

    <impactnews />
  </main>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import impactnews from '../components/impactnews.vue'

const categories = [
  { value: 'all', label: 'All' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'economy', label: 'Economy' },
  { value: 'markets', label: 'Markets' },
  { value: 'business', label: 'Business' },
  { value: 'forex', label: 'Forex' },
]

const selectedCategory = ref('all')
const newsScroll = ref(null)
const selectedArticle = ref(null)
const articleDialog = ref(null)

// Sample content — replace with your own articles.
// Place images inside public/images/news/.
const news = [
  {
    id: 1,
    category: 'markets',
    title: 'Global markets: what traders are watching',
    date: '2026-09-27',
    author: 'CMM-FT Team',
    image: '/images/news/markets.jpg',
    description:
      'A market briefing covering stock indices, currencies, and upcoming economic events.',
    content:
      'This is a sample article.\n\nAdd your full market report here, including verified information and references to your sources.',
  },
  {
    id: 2,
    category: 'economy',
    title: 'Interest rates and their role in the economy',
    date: '2026-09-26',
    author: 'CMM-FT Team',
    image: '/images/news/economy.jpg',
    description:
      'Explore how changes in interest rates can affect borrowing, spending, and financial markets.',
    content:
      'This is a sample article.\n\nReplace this text with your economic news report or educational explanation.',
  },
  {
    id: 3,
    category: 'business',
    title: 'Company earnings: key figures to follow',
    date: '2026-09-25',
    author: 'CMM-FT Team',
    image: '/images/news/business.jpg',
    description:
      'An introduction to revenue, profits, and company outlooks during earnings season.',
    content:
      'This is a sample article.\n\nAdd your company news, earnings figures, and source references here.',
  },
  {
    id: 4,
    category: 'crypto',
    title: 'Understanding volatility in crypto markets',
    date: '2026-09-24',
    author: 'CMM-FT Team',
    image: '/images/news/crypto.jpg',
    description:
      'Learn about the factors that can influence price movements across digital assets.',
    content:
      'This is a sample article.\n\nAdd your cryptocurrency market coverage here.',
  },
  {
    id: 5,
    category: 'forex',
    title: 'Gold and currencies: a market overview',
    date: '2026-09-23',
    author: 'CMM-FT Team',
    image: '/images/news/gold.jpg',
    description:
      'Explore the relationship between gold, currency movements, and market expectations.',
    content:
      'This is a sample article.\n\nWrite your gold and foreign exchange report here.',
  },
  {
    id: 6,
    category: 'economy',
    title: 'Reading the economic calendar',
    date: '2026-09-22',
    author: 'CMM-FT Team',
    image: '/images/news/calendar.jpg',
    description:
      'A guide to tracking inflation releases, employment data, and central bank announcements.',
    content:
      'This is a sample article.\n\nAdd your economic calendar preview and verified event details here.',
  },
]

const latestNews = computed(() =>
  [...news].sort((a, b) => b.date.localeCompare(a.date)),
)

const filteredNews = computed(() =>
  selectedCategory.value === 'all'
    ? latestNews.value
    : latestNews.value.filter(
        (article) => article.category === selectedCategory.value,
      ),
)

const breakingNews = news[0]

async function selectCategory(category) {
  selectedCategory.value = category
  await nextTick()

  if (newsScroll.value) {
    newsScroll.value.scrollTop = 0
  }
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

async function openArticle(article) {
  selectedArticle.value = article
  await nextTick()

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
</script>