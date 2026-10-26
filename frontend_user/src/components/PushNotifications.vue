<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '../store/user/authStore.js'
import { createPushClient } from '../api/pushClient.js'

const auth = useAuthStore()
const settingsDialog = ref(null)
let previousFocus = null
const state = reactive({
  phase: 'signed-out', busy: false, ready: false, permission: 'default',
  message: '', error: '', cooldownSeconds: 0,
})
const userId = computed(() => auth.isAuthenticated === false
  ? ''
  : String(auth.user?._id || auth.user?.id || ''))

const client = createPushClient({
  apiBase: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  basePath: import.meta.env.BASE_URL || '/',
  onChange: update => Object.assign(state, update),
})

const stopWatching = watch(userId, id => {
  if (!id) close()
  void client.connect(id)
}, { immediate: true })

function close() {
  settingsDialog.value?.close()
}

function restoreFocus() {
  if (previousFocus?.isConnected) previousFocus.focus()
  previousFocus = null
}

function openSettings() {
  if (!userId.value || !settingsDialog.value || settingsDialog.value.open) return
  previousFocus = document.activeElement
  settingsDialog.value.showModal()
  checkPermission()
}

function checkPermission() {
  if (
    userId.value && !state.busy && 'Notification' in window &&
    Notification.permission !== state.permission
  ) {
    void client.refresh()
  }
}

function workerMessage(event) {
  if (event.data?.type === 'CMM_PUSH_SUBSCRIPTION_CHANGED' && userId.value && !state.busy) {
    void client.refresh()
  }
}

let clock
onMounted(() => {
  window.addEventListener('cmm-ft:open-settings', openSettings)
  window.addEventListener('focus', checkPermission)
  navigator.serviceWorker?.addEventListener('message', workerMessage)
  clock = setInterval(() => {
    if (state.cooldownSeconds > 0) client.tick()
  }, 1000)
})

onUnmounted(() => {
  stopWatching()
  close()
  client.dispose()
  clearInterval(clock)
  window.removeEventListener('cmm-ft:open-settings', openSettings)
  window.removeEventListener('focus', checkPermission)
  navigator.serviceWorker?.removeEventListener('message', workerMessage)
})
</script>

<template>
  <Teleport to="body">
    <dialog
      v-if="userId"
      ref="settingsDialog"
      class="cmm-settings-dialog"
      aria-labelledby="cmm-settings-heading"
      @close="restoreFocus"
    >
      <header class="cmm-settings-header">
        <h2 id="cmm-settings-heading">Notifications</h2>
        <button type="button" class="cmm-settings-close" aria-label="Close notifications" @click="close">×</button>
      </header>

      <section class="cmm-push-section" aria-labelledby="cmm-push-heading" :aria-busy="state.busy">
        <h3 id="cmm-push-heading">This device</h3>
        <p class="cmm-push-description">Manage CMM-FT alerts on this device.</p>
        <p v-if="state.message" class="cmm-push-message" role="status">{{ state.message }}</p>
        <p v-if="state.error" class="cmm-push-error" role="alert">{{ state.error }}</p>

        <div v-if="state.phase === 'loading'" class="cmm-push-placeholders" aria-hidden="true">
          <span></span><span></span>
        </div>

        <div class="cmm-push-actions">
          <template v-if="state.phase === 'on'">
            <button
              type="button"
              class="cmm-push-primary"
              :disabled="state.busy || state.cooldownSeconds > 0"
              @click="client.test()"
            >
              <template v-if="state.cooldownSeconds > 0">Test again in {{ state.cooldownSeconds }}s</template>
              <template v-else>Test notification</template>
            </button>
            <button type="button" class="cmm-push-secondary" :disabled="state.busy" @click="client.disable()">
              Disable
            </button>
          </template>
          <button
            v-else-if="state.ready"
            type="button"
            class="cmm-push-primary"
            :disabled="state.busy"
            @click="client.enable()"
          >
            {{ state.busy ? 'Please wait…' : 'Enable notifications' }}
          </button>

          <button
            v-if="state.error || ['error', 'blocked', 'unsupported'].includes(state.phase)"
            type="button"
            class="cmm-push-secondary"
            :disabled="state.busy"
            @click="client.refresh()"
          >
            Retry
          </button>
        </div>

      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.cmm-settings-dialog {
  box-sizing: border-box;
  width: min(30rem, calc(100% - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  margin: auto;
  padding: 1.25rem;
  border: 1px solid rgb(100 116 139 / 30%);
  border-radius: 1rem;
  background: var(--page-bg, white);
  color: var(--text-color, #0f172a);
  font-family: inherit;
  box-shadow: 0 10px 40px rgb(15 23 42 / 20%);
}
.cmm-settings-dialog::backdrop { background: rgb(2 6 23 / 65%); backdrop-filter: blur(3px); }
.cmm-settings-dialog *, .cmm-settings-dialog *::before, .cmm-settings-dialog *::after { box-sizing: border-box; }
.cmm-settings-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.cmm-settings-header h2 { margin: 0; font-size: 1.2rem; font-weight: 700; }
.cmm-settings-close {
  min-width: 2.75rem; min-height: 2.75rem; padding: 0; border: 0; background: transparent;
  color: inherit; font-size: 1.5rem; cursor: pointer;
}
.cmm-push-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgb(100 116 139 / 25%); }
.cmm-push-section h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.cmm-push-description { margin: .65rem 0 1rem; font-size: .82rem; opacity: .7; }
.cmm-push-message, .cmm-push-error { margin: .7rem 0; font-size: .85rem; line-height: 1.65; overflow-wrap: anywhere; }
.cmm-push-error { color: #dc2626; }
.cmm-push-actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: 1rem; }
.cmm-push-primary, .cmm-push-secondary {
  min-height: 2.75rem; padding: .6rem .9rem; border-radius: .65rem;
  font: inherit; font-size: .8rem; font-weight: 600; cursor: pointer;
}
.cmm-push-primary { border: 1px solid #4f46e5; background: #4f46e5; color: white; }
.cmm-push-secondary { border: 1px solid rgb(100 116 139 / 40%); background: transparent; color: inherit; }
button:disabled { opacity: .5; cursor: wait; }
button:focus-visible { outline: 2px solid #818cf8; outline-offset: 3px; }
.cmm-push-placeholders { display: grid; gap: .6rem; padding-top: .4rem; }
.cmm-push-placeholders span {
  display: block; height: .65rem; border-radius: .3rem;
  background: rgb(100 116 139 / 25%); animation: cmm-push-pulse 1.4s ease-in-out infinite;
}
.cmm-push-placeholders span:last-child { width: 70%; }
@keyframes cmm-push-pulse { 50% { opacity: .4; } }
@media (prefers-reduced-motion: reduce) { .cmm-push-placeholders span { animation: none; } }
</style>
