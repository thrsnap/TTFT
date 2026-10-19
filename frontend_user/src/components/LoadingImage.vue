<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    default: '',
  },
  alt: {
    type: String,
    default: '',
  },
  aspectRatio: {
    type: String,
    default: '16 / 9',
  },
  loading: {
    type: String,
    default: 'lazy',
  },
})

const emit = defineEmits(['error'])

const loaded = ref(false)
const failed = ref(false)

watch(
  () => props.src,
  () => {
    loaded.value = false
    failed.value = !props.src
  },
  { immediate: true },
)

function handleError(event) {
  failed.value = true
  emit('error', event)
}
</script>

<template>
  <div
    class="relative w-full overflow-hidden bg-(--input-bg)"
    :style="{ aspectRatio }"
  >
    <!-- Image loading placeholder -->
    <div
      v-if="!loaded && !failed"
      role="status"
      aria-label="Loading image"
      class="absolute inset-0 animate-pulse
             bg-slate-400/30 motion-reduce:animate-none"
    ></div>

    <img
      v-if="src && !failed"
      :key="src"
      :src="src"
      :alt="alt"
      :loading="loading"
      class="absolute inset-0 h-full w-full object-cover"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="loaded = true"
      @error="handleError"
    />

    <!-- Missing or failed image -->
    <div
      v-if="failed"
      class="absolute inset-0 flex items-center justify-center
             px-3 text-center text-sm text-(--muted-color)
             max-[480px]:text-xs"
    >
      No image available
    </div>
  </div>
</template>