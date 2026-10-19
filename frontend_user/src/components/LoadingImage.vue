<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  aspectRatio: { type: String, default: '16 / 9' },
  loading: { type: String, default: 'lazy' },
})

const emit = defineEmits(['load', 'error'])
const image = ref(null)
const loaded = ref(false)
const failed = ref(false)

watch(
  () => props.src,
  async (src, previous, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    loaded.value = false
    failed.value = !src
    await nextTick()
    if (cancelled) return
    // Cached images may already be complete after Vue updates the DOM.
    if (image.value?.complete && image.value.naturalWidth > 0) {
      loaded.value = true
    }
  },
  { immediate: true },
)

function isCurrent(event) {
  const current = event.target?.currentSrc
  return !current || (
    Boolean(props.src) &&
    current === new URL(props.src, window.location.href).href
  )
}

function handleLoad(event) {
  if (!isCurrent(event)) return
  loaded.value = true
  failed.value = false
  emit('load', event)
}

function handleError(event) {
  if (!isCurrent(event)) return
  loaded.value = false
  failed.value = true
  emit('error', event)
}
</script>

<template>
  <div class="relative w-full overflow-hidden bg-(--input-bg)" :style="{ aspectRatio: props.aspectRatio }">
    <div v-if="!loaded && !failed" role="status" aria-label="Loading image" class="absolute inset-0 animate-pulse bg-slate-400/50 motion-reduce:animate-none"></div>

    <img
      v-if="props.src && !failed"
      ref="image"
      :src="props.src"
      :alt="props.alt"
      :loading="props.loading"
      class="absolute inset-0 h-full w-full object-cover"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="handleLoad"
      @error="handleError"
    />

    <div v-if="failed" class="absolute inset-0 flex items-center justify-center px-3 text-center text-sm text-(--muted-color) max-[480px]:text-xs">
      No image available
    </div>
  </div>
</template>
