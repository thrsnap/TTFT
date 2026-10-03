<template>
  <main class="min-h-screen bg-(--page-bg) px-4 py-10  text-(--text-color) transition-colors duration-800 sm:px-6">
    <div class="mx-auto max-w-6xl">

      <!-- TOP: Technical analysis -->
      <section aria-labelledby="analysis-heading">
        <header class="mb-8">
          <h1
            id="analysis-heading"
            class="text-3xl font-bold sm:text-4xl"
          >
            Technical Analysis
          </h1>
        </header>

        <!-- Category options -->
        <nav
          aria-label="Analysis categories"
          class="mb-10 flex flex-wrap gap-3"
        >
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            @click="selectedCategory = category"
            :aria-pressed="selectedCategory === category"
            class="cursor-pointer rounded-lg px-5 py-2.5
                   font-semibold transition-colors
                   focus-visible:outline-2
                   focus-visible:outline-indigo-400"
            :class="
              selectedCategory === category
                ? 'bg-indigo-600 text-white'
                : 'bg-(--surface-bg) text-(--text-color) hover:bg-(--hover-bg)'
            "
          >
            {{ category }}
          </button>
        </nav>

        <!-- Analysis posts without cards -->
        <div class="space-y-12">
          <article
            v-for="post in filteredAnalysis"
            :key="post.id"
            class="border-b border-(--border-color) pb-10"
          >
            <div class="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <span class="font-semibold text-indigo-400 in-[.ligh-mode]:text-indigo-700">
                {{ post.category }}
              </span>

              <span class="text-(--muted-color)">
                {{ post.symbol }} · {{ post.timeframe }}
              </span>

              <time :datetime="post.date" class="text-(--muted-color)">
                {{ post.date }}
              </time>
            </div>

            <h2 class="mb-6 text-2xl font-bold">
              {{ post.title }}
            </h2>

            <!-- Analysis pictures -->
            <div class="space-y-5">
              <a
                v-for="(picture, index) in post.pictures"
                :key="picture"
                :href="picture"
                target="_blank"
                rel="noopener noreferrer"
                class="block"
                :aria-label="`Open ${post.title}, chart ${index + 1}, in a new tab`"
              >
                <img
                  :src="picture"
                  :alt="`${post.title} — chart ${index + 1}`"
                  loading="lazy"
                  class="block h-50 w-70 rounded-lg  bg-(--input-bg)"
                />
              </a>
            </div>

            <!-- Written details below pictures -->
            <div class="mt-6">
              <h3 class="mb-3 text-lg font-semibold">
                Analysis Details
              </h3>
              <p class="whitespace-pre-line leading-8  text-(--text-color)">
                {{ post.details }}
              </p>
            </div>
          </article>
        </div>

        <p
          v-if="!filteredAnalysis.length"
          class="py-12 text-center text-(--muted-color)"
        >
          No {{ selectedCategory }} analysis published yet.
        </p>
      </section>

      <!-- BELOW: Separate document download section -->
      <section
        aria-labelledby="documents-heading"
        class="mt-16 border-t border-(--border-color) pt-10"
      >
        <header class="mb-6">
          <h2
            id="documents-heading"
            class="text-2xl font-bold sm:text-3xl"
          >
            Download Refference
          </h2>

          <p class="mt-3 text-(--muted-color)">
            Download my study notes and supporting materials.
          </p>
        </header>

        <!-- Document rows, separate from analysis posts -->
        <div class="divide-y divide-(--border-color)">
          <div
            v-for="document in documents"
            :key="document.id"
            class="flex flex-col gap-4 py-6
                   sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <h3 class="text-lg font-semibold">
                {{ document.title }}
              </h3>

              <p class="mt-1 text-sm text-(--muted-color)">
                {{ document.description }}
              </p>

              <span
                class="mt-2 inline-block text-xs font-semibold text-indigo-400 in-[.ligh-mode]:text-indigo-700"
              >
                {{ document.type }}
              </span>
            </div>

            <a
              :href="document.url"
              download
              :aria-label="`Download ${document.title}`"
              class="inline-flex shrink-0 items-center justify-center
                     gap-2 self-start rounded-lg bg-indigo-600
                     px-5 py-3 text-sm font-semibold text-white
                     transition-colors hover:bg-indigo-500
                     focus-visible:outline-2
                     focus-visible:outline-offset-2
                     focus-visible:outline-indigo-500 sm:self-center"
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
          </div>
        </div>

        <p v-if="!documents.length" class="py-6 text-(--muted-color)">
          No documents available yet.
        </p>
      </section>

    </div>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import x1 from '../assets/static/analyspicture/x1.jpg'
const categories = ['All', 'ICT', 'PDArray', 'CSNR', 'SMS']
const selectedCategory = ref('All')

// TOP SECTION: Your pictures and written analysis.
// Replace the sample text and image paths.
const analysisPosts = [
  {
    id: 1,
    category: 'ICT',
    symbol: 'XAUUSD',
    timeframe: 'H4',
    date: '2026-09-25',
    title: 'Gold — ICT Analysis',
    pictures: [
      x1,
    ],
    details: `Write your analysis here.

Market structure:
Describe what you observe on the chart.

Important levels:
Explain the price levels you have marked.

Setup conditions:
Describe what you are waiting for and what would invalidate your idea.`,
  },
  {
    id: 2,
    category: 'PDArray',
    symbol: 'EURUSD',
    timeframe: 'H1',
    date: '2026-09-25',
    title: 'EURUSD — PDArray Analysis',
    pictures: [
      '/static/analysis/eurusd-pdarray.jpg',
    ],
    details: `Write your PDArray analysis here.

Explain the highlighted areas and your observations.`,
  },
]

// BOTTOM SECTION: Independent downloadable documents.
// These stay visible regardless of the selected analysis category.
const documents = [
  {
    id: 1,
    title: 'ICT Study Notes',
    description: 'My notes and chart examples.',
    type: 'PDF',
    url: '/documents/ict-notes.pdf',
  },
  {
    id: 2,
    title: 'PDArray Reference',
    description: 'My reference material for PDArray.',
    type: 'PDF',
    url: '/documents/pdarray-reference.pdf',
  },
  {
    id: 3,
    title: 'Trading Journal Template',
    description: 'A document for recording analysis and observations.',
    type: 'Word Document',
    url: '/documents/trading-journal.docx',
  },
]

const filteredAnalysis = computed(() => {
  if (selectedCategory.value === 'All') {
    return analysisPosts
  }

  return analysisPosts.filter(
    (post) => post.category === selectedCategory.value,
  )
})
</script>