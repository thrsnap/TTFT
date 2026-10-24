<script setup>
import { useProfilePhoto } from '../composable/useProfilePhoto.js'

defineProps({
  decorative: { type: Boolean, default: false },
  variant: { type: String, default: 'soft' },
})

const { photoUrl, initial, username, ownerKey, clearPhoto } = useProfilePhoto()

function photoDisplayError() {
  clearPhoto(ownerKey.value)
}
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden
           rounded-full font-semibold leading-none"
    :class="variant === 'dark'
      ? 'bg-emerald-950 text-emerald-400'
      : variant === 'solid'
        ? 'bg-emerald-600 text-white'
        : 'bg-emerald-100 text-emerald-800'"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : `${username}'s profile photo`"
    :aria-hidden="decorative ? true : undefined"
  >
    <img
      v-if="photoUrl"
      :src="photoUrl"
      alt=""
      class="size-full rounded-full object-cover"
      @error="photoDisplayError"
    >
    <span v-else aria-hidden="true">{{ initial }}</span>
  </span>
</template>
