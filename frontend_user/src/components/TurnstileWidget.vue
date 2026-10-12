<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import {
  loadTurnstile,
  setLoginTurnstileToken,
} from '../api/turnstile.js'

const emit = defineEmits(['update:modelValue'])

const container = ref(null)
const error = ref('')

let widgetId
let disposed = false

function updateToken(token = '') {
  setLoginTurnstileToken(token)
  emit('update:modelValue', token)
}

function reset() {
  updateToken('')
  error.value = ''

  if (
    !disposed &&
    widgetId !== undefined &&
    window.turnstile
  ) {
    window.turnstile.reset(widgetId)
  }
}

defineExpose({ reset })

onMounted(async () => {
  updateToken('')

  try {
    const sitekey =
      import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()

    if (!sitekey) {
      throw new Error(
        'Security verification is not configured.',
      )
    }

    await loadTurnstile()

    if (disposed) return

    widgetId = window.turnstile.render(container.value, {
      sitekey,
      action: 'login',
      theme: 'auto',
      size: 'flexible',

      callback: token => {
        if (disposed) return
        error.value = ''
        updateToken(token)
      },

      'expired-callback': () => {
        if (!disposed) updateToken('')
      },

      'error-callback': () => {
        if (disposed) return

        updateToken('')
        error.value =
          'Verification failed. Refresh the page to retry.'
      },
    })
  } catch (failure) {
    if (!disposed) {
      error.value =
        failure.message || 'Could not load verification.'
    }
  }
})

onBeforeUnmount(() => {
  disposed = true
  updateToken('')

  if (
    widgetId !== undefined &&
    window.turnstile
  ) {
    window.turnstile.remove(widgetId)
  }
})
</script>

<template>
  <div class="min-w-0">
    <div ref="container"></div>

    <p
      v-if="error"
      role="alert"
      class="mt-2 text-sm text-red-500"
    >
      {{ error }}
    </p>
  </div>
</template>