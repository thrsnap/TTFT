<template>
  <div aria-live="polite" aria-atomic="true">
    <Transition name="youtube-live">
      <div v-if="stream" class="youtube-live-wrap">
        <a
          class="youtube-live-banner"
          :href="`https://www.youtube.com/watch?v=${stream.videoId}`"
          :title="stream.title || 'Watch live on YouTube'"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Watch the livestream on YouTube (opens in a new tab)"
        >
          <span class="youtube-live-light" aria-hidden="true"></span>
          <span class="youtube-live-label">Live Trade on YouTube now</span>
        </a>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'

const stream = ref(null)
const apiBase = String(
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://api.cmm-ft.com',
).trim().replace(/\/+$/, '')
const endpoint = `${apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`}/youtube/live`
let pollTimer
let timeoutTimer
let controller
let active = false
let checking = false
let generation = 0

async function checkLive() {
  if (!active || checking || document.hidden) return
  checking = true
  const run = generation
  const request = new AbortController()
  controller = request
  const timeout = window.setTimeout(() => request.abort(), 12000)
  timeoutTimer = timeout
  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
      credentials: 'omit',
      signal: request.signal,
    })
    if (!response.ok) throw new Error('Live status unavailable')
    const data = await response.json()
    if (!active || run !== generation) return
    stream.value = data.available === true && data.isLive === true &&
      /^[A-Za-z0-9_-]{11}$/.test(data.videoId || '')
      ? { videoId: data.videoId, title: String(data.title || '').slice(0, 200) }
      : null
  } catch {
    // Never keep an old LIVE announcement when its status cannot be verified.
    if (active && run === generation) stream.value = null
  } finally {
    window.clearTimeout(timeout)
    if (run === generation) {
      checking = false
      controller = null
      timeoutTimer = null
      if (active && !document.hidden) pollTimer = window.setTimeout(checkLive, 30000)
    }
  }
}

function refreshVisiblePage() {
  window.clearTimeout(pollTimer)
  if (document.hidden) {
    generation += 1
    controller?.abort()
    window.clearTimeout(timeoutTimer)
    controller = null
    checking = false
    stream.value = null
    return
  }
  void checkLive()
}

function start() {
  if (active) return
  active = true
  document.addEventListener('visibilitychange', refreshVisiblePage)
  window.addEventListener('online', refreshVisiblePage)
  void checkLive()
}

function stop() {
  if (!active) return
  active = false
  generation += 1
  window.clearTimeout(pollTimer)
  window.clearTimeout(timeoutTimer)
  controller?.abort()
  controller = null
  checking = false
  stream.value = null
  document.removeEventListener('visibilitychange', refreshVisiblePage)
  window.removeEventListener('online', refreshVisiblePage)
}

onMounted(start)
onActivated(start)
onDeactivated(stop)
onUnmounted(stop)
</script>

<style scoped>
.youtube-live-wrap {
  box-sizing: border-box;
  padding: 12px 22px 12px;
}
.youtube-live-banner {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  max-width: 1100px;
  min-height: 38px;
  margin: 0 auto;
  padding: 8px 18px;
  border: 1px solid rgba(218, 40, 50, .8);
  border-radius: 11px;
  background: #121212;
  box-shadow: 0 0 24px rgba(239, 36, 54, .17);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
  text-decoration: none;
  transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
}
.youtube-live-banner:hover {
  border-color: #ff3346;
  background: #191414;
  box-shadow: 0 0 28px rgba(239, 36, 54, .25);
}
.youtube-live-banner:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 4px;
}
.youtube-live-label {
  min-width: 0;
  text-transform: uppercase;
  letter-spacing: .015em;
}
.youtube-live-light {
  position: relative;
  display: block;
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff3346;
  box-shadow: 0 0 10px rgba(255, 51, 70, .45);
}
.youtube-live-light::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1px solid rgba(255, 51, 70, .8);
  border-radius: 50%;
  animation: youtube-live-pulse 1.8s ease-out infinite;
}
.youtube-live-enter-active,
.youtube-live-leave-active {
  transition: opacity .2s ease, transform .2s ease;
}
.youtube-live-enter-from,
.youtube-live-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@keyframes youtube-live-pulse {
  from { transform: scale(.6); opacity: .8; }
  to { transform: scale(1.25); opacity: 0; }
}
@media (max-width: 480px) {
  .youtube-live-wrap { padding: 14px 14px 8px; }
  .youtube-live-banner { gap: 11px; padding: 8px 14px; font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .youtube-live-light::after { animation: none; opacity: .25; }
  .youtube-live-enter-active,
  .youtube-live-leave-active,
  .youtube-live-banner { transition: none; }
}
</style>
