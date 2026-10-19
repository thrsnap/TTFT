<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { usePageLoading } from '../composable/usePageLoading.js'

const { isPageLoading } = usePageLoading()

const logo = ref(null)
const logoLoaded = ref(false)

function checkCachedLogo() {
  logoLoaded.value = Boolean(
    logo.value?.complete && logo.value.naturalWidth > 0,
  )
}

onMounted(checkCachedLogo)

watch(
  isPageLoading,
  async visible => {
    if (!visible) return

    logoLoaded.value = false

    await nextTick()
    checkCachedLogo()
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isPageLoading"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      class="fixed inset-0 z-[99999] flex items-center
             justify-center bg-slate-950 px-6"
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
          ></div>

          <img
            ref="logo"
            src="/fav.jpg"
            alt=""
            width="96"
            height="96"
            loading="eager"
            fetchpriority="high"
            class="size-24 rounded-xl object-contain
                   max-[480px]:size-20 max-[320px]:size-16"
            :class="logoLoaded ? 'opacity-100' : 'opacity-0'"
            @load="logoLoaded = true"
            @error="logoLoaded = false"
          />
        </div>

        <p class="text-sm tracking-[0.2em] text-slate-300">
          CMM-FT...
        </p>
      </div>
    </div>
  </Teleport>
</template>