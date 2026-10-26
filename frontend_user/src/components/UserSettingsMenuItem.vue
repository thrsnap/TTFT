<script setup>
const emit = defineEmits(['click'])

function openSettings(event) {
  emit('click', event)
  window.dispatchEvent(new Event('cmm-ft:open-settings'))
}
</script>

<template>
  <button
    type="button"
    class="cmm-user-settings-item"
    aria-haspopup="dialog"
    @click="openSettings"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" stroke-linejoin="round" />
      <path d="M10 21h4" stroke-linecap="round" />
    </svg>
    <span>Notifications</span>
  </button>
</template>

<style scoped>
.cmm-user-settings-item {
  display: flex;
  align-items: center;
  gap: .65rem;
  width: 100%;
  min-height: 2.75rem;
  padding: .75rem 1rem;
  border: 0;
  border-radius: .5rem;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: .875rem;
  text-align: left;
  cursor: pointer;
}
.cmm-user-settings-item:hover { background: rgb(100 116 139 / 10%); }
.cmm-user-settings-item:focus-visible { outline: 2px solid #818cf8; outline-offset: -2px; }
.cmm-user-settings-item svg { width: 1.15rem; height: 1.15rem; flex-shrink: 0; }
</style>
