<template>
  <main
    class="bg-(--page-bg) text-(--text-color)
           transition-colors duration-800"
  >
    <!-- Course hero -->
    <div
  class="relative isolate flex min-h-112.5
         items-center justify-center overflow-hidden
         px-5 py-10 text-center sm:min-h-137.5
         max-[768px]:min-h-0 max-[768px]:py-10
         max-[600px]:py-8
         max-[480px]:px-4 max-[480px]:py-6
         max-[414px]:px-3 max-[414px]:py-5
         max-[320px]:px-2 max-[320px]:py-4"
>
  <coursehero />
</div>

    <!-- Courses section -->
    <section
  aria-labelledby="free-courses"
  class="bg-(--page-bg) px-5 py-10
         transition-colors duration-300 sm:py-14
         max-[768px]:px-4 max-[768px]:py-10
         max-[600px]:py-8
         max-[480px]:px-3 max-[480px]:py-6
         max-[414px]:px-2.5 max-[414px]:py-5
         max-[320px]:px-2 max-[320px]:py-4"
>
  <div class="mx-auto min-w-0 max-w-250">
    <!-- Heading -->
    <div
      class="mb-10
             max-[768px]:mb-8
             max-[600px]:mb-6
             max-[480px]:mb-5
             max-[414px]:mb-4
             max-[320px]:mb-3"
    >
      <h2
        id="free-courses"
        class="text-3xl font-bold text-[#389bc5]
               in-[.ligh-mode]:text-sky-700
               max-[768px]:text-[28px]
               max-[600px]:text-2xl
               max-[480px]:text-[22px]
               max-[414px]:text-xl
               max-[320px]:text-lg"
      >
        Free Courses
      </h2>

      <p
        class="mt-2 text-sm text-(--muted-color)
               max-[480px]:text-xs"
      >
        Find your courses here
      </p>
    </div>

    <!-- Course cards -->
    <div
      class="grid grid-cols-3 gap-6
             max-[768px]:grid-cols-3 max-[768px]:gap-4
             max-[600px]:grid-cols-2 max-[600px]:gap-3
             max-[480px]:gap-2
             max-[414px]:gap-1.5
             max-[320px]:gap-1"
    >
      <article
        v-for="course in courses"
        :key="course.id"
        class="flex min-w-0 flex-col overflow-hidden rounded-[10px]
               border border-(--border-color)
               bg-(--surface-bg)
               shadow-[0_5px_15px_rgba(0,0,0,0.12)]
               transition duration-300
               hover:shadow-[0_8px_25px_rgba(0,0,0,0.25)]
               motion-safe:hover:-translate-y-1
               max-[414px]:rounded-lg"
      >
        <!-- Image -->
        <div
          class="aspect-[285/188] shrink-0 overflow-hidden rounded-lg
                 bg-(--input-bg) transition-colors duration-300"
        >
          <img
            :src="course.image"
            :alt="course.title"
            loading="lazy"
            class="block h-full w-full object-cover"
          />
        </div>

        <!-- Details -->
        <div
          class="flex min-w-0 flex-1 flex-col items-start p-4
                 [overflow-wrap:anywhere]
                 max-[768px]:p-3
                 max-[600px]:p-3
                 max-[480px]:p-2.5
                 max-[414px]:p-2
                 max-[320px]:p-1.5"
        >
          <h3
            class="text-base font-bold leading-snug text-indigo-400
                   in-[.ligh-mode]:text-indigo-700
                   max-[768px]:text-[15px]
                   max-[600px]:text-sm
                   max-[480px]:text-[13px]
                   max-[414px]:text-xs
                   max-[320px]:text-xs"
          >
            {{ course.title }}
          </h3>

          <p
            class="mb-3 mt-2 text-xs leading-relaxed
                   text-(--muted-color)
                   max-[480px]:mb-2
                   max-[320px]:mt-1.5"
          >
            This course is available for free!
          </p>

          <a
            :href="course.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`Enroll in ${course.title} (opens in a new tab)`"
            class="mt-auto inline-flex min-h-11 items-center rounded
                   text-sm font-semibold text-emerald-400
                   transition-colors hover:text-emerald-300
                   hover:underline
                   in-[.ligh-mode]:text-emerald-700
                   in-[.ligh-mode]:hover:text-emerald-800
                   focus-visible:outline-2
                   focus-visible:outline-offset-4
                   focus-visible:outline-emerald-500
                   max-[768px]:text-[13px]
                   max-[480px]:text-xs"
          >
            Enroll Now →
          </a>
        </div>
      </article>
    </div>
  </div>
</section>
  </main>
</template>

<script setup>
import { courses } from '../store/course/coursename'
import coursehero from '../components/coursehero.vue'
</script>