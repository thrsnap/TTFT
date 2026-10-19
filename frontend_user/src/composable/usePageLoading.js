import { readonly, ref } from 'vue'

const isPageLoading = ref(true)

let startedAt = Date.now()
let timer

export function startPageLoading() {
  clearTimeout(timer)
  startedAt = Date.now()
  isPageLoading.value = true
}

export function stopPageLoading() {
  clearTimeout(timer)

  const remaining = Math.max(
    0,
    800 - (Date.now() - startedAt),
  )

  timer = setTimeout(() => {
    isPageLoading.value = false
  }, remaining)
}

export function usePageLoading() {
  return {
    isPageLoading: readonly(isPageLoading),
    startPageLoading,
    stopPageLoading,
  }
}