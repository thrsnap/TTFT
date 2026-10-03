import { readonly, ref } from 'vue'

// Outside the function: shared by every component.
const isLightMode = ref(false)
let initialized = false

function applyTheme() {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle(
    'ligh-mode',
    isLightMode.value,
  )

  // Remove the body class from the previous implementation.
  document.body?.classList.remove('ligh-mode')
}

function initTheme() {
  if (initialized || typeof window === 'undefined') return

  initialized = true

  try {
    isLightMode.value = localStorage.getItem('theme') === 'light'
  } catch {
    isLightMode.value = false
  }

  applyTheme()
}

function toggleTheme() {
  isLightMode.value = !isLightMode.value
  applyTheme()

  try {
    localStorage.setItem(
      'theme',
      isLightMode.value ? 'light' : 'dark',
    )
  } catch {
    // Theme switching still works without browser storage.
  }
}

export function useTheme() {
  initTheme()

  return {
    isLightMode: readonly(isLightMode),
    toggleTheme,
  }
}