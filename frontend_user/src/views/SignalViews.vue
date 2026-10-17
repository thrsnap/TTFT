<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import NewsSignal from '../components/NewsSignal.vue'
import DailySignal from '../components/DailySignal.vue'

const signalGrid = ref(null)
let resizeObserver
let mutationObserver
let frame
let desktop
const observedContents = new Set()

function matchCardHeights() {
  const root = signalGrid.value
  if (!root) return
  const news = [...root.querySelectorAll('[data-signal-column="news"] [data-signal-card]')]
  const daily = [...root.querySelectorAll('[data-signal-column="daily"] [data-signal-card]')]
  for (const card of [...news, ...daily]) card.style.removeProperty('min-height')
  if (!desktop?.matches) return

  for (let index = 0; index < Math.min(news.length, daily.length); index++) {
    const cards = [news[index], daily[index]]
    const height = Math.ceil(Math.max(...cards.map(card => {
      const content = card.querySelector('[data-signal-card-content]')
      const style = window.getComputedStyle(card)
      return (content?.getBoundingClientRect().height || 0)
        + (parseFloat(style.borderTopWidth) || 0)
        + (parseFloat(style.borderBottomWidth) || 0)
    })))
    for (const card of cards) card.style.minHeight = `${height}px`
  }
}

function scheduleMatch() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(matchCardHeights)
}

function observeContents() {
  const current = new Set(signalGrid.value?.querySelectorAll('[data-signal-card-content]') || [])
  for (const element of observedContents) {
    if (!current.has(element)) {
      resizeObserver.unobserve(element)
      observedContents.delete(element)
    }
  }
  for (const element of current) {
    if (!observedContents.has(element)) {
      resizeObserver.observe(element)
      observedContents.add(element)
    }
  }
  scheduleMatch()
}

onMounted(() => {
  desktop = window.matchMedia('(min-width: 1024px)')
  resizeObserver = new ResizeObserver(scheduleMatch)
  mutationObserver = new MutationObserver(observeContents)
  mutationObserver.observe(signalGrid.value, { childList: true, subtree: true, characterData: true })
  window.addEventListener('resize', scheduleMatch)
  observeContents()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  window.removeEventListener('resize', scheduleMatch)
  cancelAnimationFrame(frame)
  observedContents.clear()
})
</script>

<template>
  <main class="bg-(--page-bg)">
    <div ref="signalGrid" class="mx-auto grid w-full max-w-4xl grid-cols-1 items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
      <div data-signal-column="news" class="min-w-0"><NewsSignal /></div>
      <div data-signal-column="daily" class="min-w-0"><DailySignal /></div>
    </div>
  </main>
</template>

