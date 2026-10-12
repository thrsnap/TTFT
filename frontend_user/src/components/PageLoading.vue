<script setup>
import { usePageLoading } from '../composable/usePageLoading.js'

const { isPageLoading } = usePageLoading()
</script>

<template>
  <Teleport to="body">
    <Transition
  leave-active-class="transition-opacity duration-200"
  leave-from-class="opacity-100"
  leave-to-class="opacity-0"
>
      <div
        v-if="isPageLoading"
        role="status"
        aria-live="polite"
        aria-label="Loading page"
        class="fixed inset-0 z-[99999] flex items-center justify-center
               bg-slate-950 px-6"
      >
        <div class="flex flex-col items-center gap-6">
          <div
            class="relative flex size-36 items-center justify-center
                   max-[480px]:size-28 max-[320px]:size-24"
          >
            <div
              aria-hidden="true"
              class="absolute inset-0 animate-spin rounded-full
                     border-2 border-white/10 border-t-amber-400
                     motion-reduce:animate-none"
            />

            <img
              src="/fav.jpg"
              alt="CMM-FT"
              class="size-24 rounded-xl object-contain
                     max-[480px]:size-20 max-[320px]:size-16"
            />
          </div>

          <p class="text-sm tracking-[0.2em] text-slate-300">
            CMM-FT...
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>