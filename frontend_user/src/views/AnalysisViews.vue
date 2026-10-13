<script setup>
import { computed, onMounted, ref } from 'vue'
const BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')
const categories = ['All', 'ICT', 'PDArray', 'CSNR', 'SMS']
const selectedCategory = ref('All')
const analysisPosts = ref([])
const documents = ref([])
const loading = ref(false)
const error = ref('')
const filteredAnalysis = computed(() => {
  if (selectedCategory.value === 'All') {
    return analysisPosts.value
  }
  return analysisPosts.value.filter(
    post => post.category === selectedCategory.value,
  )
})
// One horizontal row per category, including separately saved posts.
const analysisGroups = computed(() => {
  const order = categories.filter(category => category !== 'All')
  return order.map(category => ({
    category,
    posts: filteredAnalysis.value.filter(post => post.category === category),
  })).filter(group => group.posts.length)
})
function fileUrl(path) {
  if (typeof path !== 'string' || !path.trim()) return ''
  try {
    const url = new URL(path, `${BASE}/`)
    return ['http:', 'https:'].includes(url.protocol)
      ? url.href
      : ''
  } catch {
    return ''
  }
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
async function loadAnalysis() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${BASE}/api/analysis`, {
      credentials: 'include',
      cache: 'no-store',
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(
        data?.message || `Request failed (${response.status})`,
      )
    }
    if (
      !Array.isArray(data?.posts) ||
      !Array.isArray(data?.documents)
    ) {
      throw new Error(
        'The backend must return posts and documents arrays.',
      )
    }
    analysisPosts.value = data.posts.map(post => ({
      ...post,
      id: post.id || post._id,
      pictures: Array.isArray(post.pictures)
        ? post.pictures.map(fileUrl).filter(Boolean)
        : [],
    }))
    documents.value = data.documents.map(document => ({
      ...document,
      id: document.id || document._id,
      url: fileUrl(document.url),
    }))
  } catch (err) {
    error.value =
      err.message || 'Could not load analysis and documents.'
  } finally {
    loading.value = false
  }
}
onMounted(loadAnalysis)
</script>
<template>
  <main
    class="min-h-screen bg-(--page-bg) px-6 py-10
           text-(--text-color) transition-colors duration-300
           max-[768px]:px-5 max-[768px]:py-8
           max-[600px]:px-4 max-[600px]:py-6
           max-[480px]:px-3
           max-[414px]:py-5
           max-[320px]:px-2"
  >
    <div class="mx-auto w-full min-w-0 max-w-6xl">
      <section aria-labelledby="analysis-heading">
        <header
          class="mb-8 flex flex-wrap items-center justify-between gap-4
                 max-[480px]:mb-6"
        >
          <h1
            id="analysis-heading"
            class="text-4xl font-bold
                   max-[768px]:text-3xl
                   max-[414px]:text-2xl"
          >
            Technical Analysis
          </h1>
          <button
            type="button"
            @click="loadAnalysis"
            :disabled="loading"
            class="min-h-11 cursor-pointer rounded-lg
                   bg-(--surface-bg) px-4 py-2
                   text-sm font-semibold transition-colors
                   hover:bg-(--hover-bg)
                   focus-visible:outline-2
                   focus-visible:outline-offset-2
                   focus-visible:outline-indigo-500
                   disabled:cursor-wait disabled:opacity-50"
          >
            {{ loading ? 'Loading…' : 'Refresh' }}
          </button>
        </header>
        <nav
          aria-label="Analysis categories"
          class="mb-10 flex flex-wrap gap-3
                 max-[600px]:gap-2 max-[480px]:mb-6"
        >
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            @click="selectedCategory = category"
            :aria-pressed="selectedCategory === category"
            class="min-h-11 cursor-pointer rounded-lg px-5 py-2.5
                   font-semibold transition-colors
                   focus-visible:outline-2
                   focus-visible:outline-offset-2
                   focus-visible:outline-indigo-500
                   max-[600px]:px-4
                   max-[480px]:text-sm
                   max-[320px]:px-3"
            :class="
              selectedCategory === category
                ? 'bg-indigo-600 text-white'
                : 'bg-(--surface-bg) text-(--text-color) hover:bg-(--hover-bg)'
            "
          >
            {{ category }}
          </button>
        </nav>
        <p
          v-if="loading"
          role="status"
          class="mb-6 py-4 text-(--muted-color)"
        >
          Loading analysis and reference documents…
        </p>
        <div
          v-if="error"
          role="alert"
          class="mb-8 rounded-lg border border-red-500/30
                 bg-red-500/10 p-4 text-red-500"
        >
          <p class="break-words">{{ error }}</p>
          <button
            type="button"
            @click="loadAnalysis"
            :disabled="loading"
            class="mt-3 min-h-11 cursor-pointer font-semibold underline
                   disabled:cursor-wait disabled:opacity-50"
          >
            Try again
          </button>
        </div>
        <div class="space-y-12 max-[600px]:space-y-8">
          <section v-for="group in analysisGroups" :key="group.category"
            :aria-label="`${group.category} analysis`"
            class="min-w-0 border-b border-(--border-color) pb-8">
            <h2 class="mb-5 text-2xl font-bold text-indigo-500">{{ group.category }}</h2>
            <div
              class="flex w-full min-w-0 flex-nowrap items-start gap-6 overflow-x-auto overscroll-x-contain pb-4 max-[600px]:gap-4"
              role="region" tabindex="0"
              :aria-label="`${group.category} posts; scroll horizontally to see more`"
            >
          <article
            v-for="post in group.posts"
            :key="post.id"
            class="w-[480px] min-w-0 shrink-0
                   max-[768px]:w-[400px]
                   max-[600px]:w-[340px]
                   max-[480px]:w-[300px]
                   max-[414px]:w-[280px]
                   max-[320px]:w-[250px]"
          >
            <div
              class="mb-4 flex flex-wrap items-center gap-3 text-sm
                     max-[480px]:gap-2"
            >
              <span class="font-semibold text-indigo-500">
                {{ post.category }}
              </span>
              <span class="text-(--muted-color)">
                {{ post.symbol }} · {{ post.timeframe }}
              </span>
              <time
                :datetime="post.date"
                class="text-(--muted-color)"
              >
                {{ formatDate(post.date) }}
              </time>
            </div>
            <h2
              class="mb-6 break-words text-2xl font-bold
                     max-[480px]:mb-4 max-[414px]:text-xl"
            >
              {{ post.title }}
            </h2>
            <!-- Charts remain vertically stacked within each post. -->
           <div class="space-y-5 max-[480px]:space-y-3">
  <a
    v-for="(picture, index) in post.pictures"
    :key="`${post.id}-${index}`"
    :href="picture"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="`Open ${post.title}, chart ${index + 1}, in a new tab`"
    class="block w-fit max-w-full rounded-lg
           focus-visible:outline-2
           focus-visible:outline-offset-2
           focus-visible:outline-indigo-500"
  >
    <img
      :src="picture"
      :alt="`${post.title} — chart ${index + 1}`"
      loading="lazy"
      decoding="async"
      class="block h-auto w-auto
             max-h-[200px] max-w-[280px]
             rounded-lg bg-(--input-bg) object-contain
             max-[320px]:max-w-[250px]"
    />
  </a>
</div>
            <div class="mt-6">
              <h3 class="mb-3 text-lg font-semibold">
                Analysis Details
              </h3>
              <p
                class="whitespace-pre-line break-words leading-8
                       text-(--text-color)
                       max-[480px]:text-sm max-[480px]:leading-7"
              >
                {{ post.details }}
              </p>
            </div>
          </article>
            </div>
          </section>
        </div>
        <p
          v-if="!loading && !error && !filteredAnalysis.length"
          class="py-12 text-center text-(--muted-color)"
        >
          {{
            selectedCategory === 'All'
              ? 'No analysis published yet.'
              : `No ${selectedCategory} analysis published yet.`
          }}
        </p>
      </section>
      <!-- Documents remain visible for every analysis category. -->
      <section
        aria-labelledby="documents-heading"
        class="mt-16 border-t border-(--border-color) pt-10
               max-[600px]:mt-10 max-[600px]:pt-8"
      >
        <header class="mb-6">
          <h2
            id="documents-heading"
            class="text-3xl font-bold
                   max-[768px]:text-2xl max-[414px]:text-xl"
          >
            Download References
          </h2>
          <p class="mt-3 text-(--muted-color) max-[480px]:text-sm">
            Download my study notes and supporting materials.
          </p>
        </header>
        <div class="divide-y divide-(--border-color)">
          <article
            v-for="document in documents"
            :key="document.id"
            class="flex items-center justify-between gap-4 py-6
                   max-[600px]:flex-col max-[600px]:items-start
                   max-[480px]:py-5"
          >
            <div class="min-w-0">
              <h3 class="break-words text-lg font-semibold">
                {{ document.title }}
              </h3>
              <p
                class="mt-1 break-words text-sm text-(--muted-color)"
              >
                {{ document.description }}
              </p>
              <span
                class="mt-2 inline-block text-xs font-semibold
                       text-indigo-500"
              >
                {{ document.type }}
              </span>
            </div>
            <a
              v-if="document.url"
              :href="document.url"
              target="_blank"
              rel="noopener noreferrer"
              download
              :aria-label="`Download ${document.title}`"
              class="inline-flex min-h-11 shrink-0 items-center
                     justify-center gap-2 rounded-lg bg-indigo-600
                     px-5 py-3 text-sm font-semibold text-white
                     transition-colors hover:bg-indigo-500
                     focus-visible:outline-2
                     focus-visible:outline-offset-2
                     focus-visible:outline-indigo-500
                     max-[480px]:w-full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"
                />
              </svg>
              Download
            </a>
            <span v-else class="text-sm text-(--muted-color)">
              File unavailable
            </span>
          </article>
        </div>
        <p
          v-if="!loading && !error && !documents.length"
          class="py-6 text-(--muted-color)"
        >
          No documents available yet.
        </p>
      </section>
    </div>
  </main>
</template>
