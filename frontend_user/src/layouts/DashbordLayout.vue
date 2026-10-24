<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import {
  RouterLink,
  RouterView,
  useRoute,
  useRouter,
} from 'vue-router'
import { useAuthStore } from '../store/user/authStore.js'
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const accountOpen = ref(false)
const accountRoot = ref(null)
const accountTrigger = ref(null)
const busy = ref(false)
const logoutError = ref('')

const isDark = ref(true)
let themeObserver

const themeLabel = computed(() =>
  isDark.value ? 'Switch to light mode' : 'Switch to dark mode',
)

function syncTheme() {
  const root = document.documentElement
  // Match the existing website CSS, which defaults to dark mode.
  isDark.value = !root.classList.contains('ligh-mode')

  // Keep components that read the dark class in sync as well.
  if (root.classList.contains('dark') !== isDark.value) {
    root.classList.toggle('dark', isDark.value)
  }

  root.style.colorScheme = isDark.value ? 'dark' : 'light'
}

function applyTheme(dark) {
  document.documentElement.classList.toggle('ligh-mode', !dark)
  syncTheme()
}

function toggleTheme() {
  const dark = document.documentElement.classList.contains('ligh-mode')
  applyTheme(dark)

  try {
    window.localStorage.setItem('theme', dark ? 'dark' : 'light')
  } catch {
    // The button still works when the browser blocks saved preferences.
  }
}

function restoreTheme() {
  let savedTheme
  try {
    savedTheme = window.localStorage.getItem('theme')
  } catch {
    // Keep the theme already applied by the website.
  }

  if (savedTheme === 'dark' || savedTheme === 'light') {
    applyTheme(savedTheme === 'dark')
  } else {
    syncTheme()
  }
}

function onThemeStorage(event) {
  if (
    event.key === 'theme' &&
    event.storageArea === window.localStorage &&
    (event.newValue === 'dark' || event.newValue === 'light')
  ) {
    applyTheme(event.newValue === 'dark')
  }
}

const username = computed(() => auth.user?.username || 'Member')
const email = computed(() => auth.user?.email || '—')
const initial = computed(() => username.value.slice(0, 1).toUpperCase())
const profileActive = computed(() => route.name === 'profile')
const menu = [
  {
    label: 'Overview',
    path: '/dashboard',
    icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  },
  {
    label: 'Trading Journal',
    labelKm: 'កំណត់ហេតុជួញដូរ',
    path: '/dashboard/trade-journal',
    icon: 'M4 4h16v17H4z M8 2v4 M16 2v4 M4 9h16 M7 17l3-3 3 2 4-5',
  },
  {
    label: 'My Courses',
    path: '/dashboard/courses',
    icon: 'M3 5h6a3 3 0 0 1 3 3v13a5 5 0 0 0-5-2H3z M21 5h-6a3 3 0 0 0-3 3v13a5 5 0 0 1 5-2h4z',
  },
  {
    label: 'My Signal',
    path: '/dashboard/signals',
    icon: 'M3 17l6-6 4 4 8-10 M15 5h6v6',
  },
  {
    label: 'My Challenges',
    path: '/dashboard/challenges',
    icon: 'M8 3h8v6a4 4 0 0 1-8 0z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 13v7 M8 21h8',
  },
  {
    label: 'My Support',
    path: '/dashboard/support',
    icon: 'M21 11a9 9 0 0 1-9 9H5l-4 3 2-7a9 9 0 1 1 18-5z M8 10h8 M8 14h5',
  },
]
function localizedPath(path) {
  if (route.params.lang !== 'km') return path
  return path === '/' ? '/km' : `/km${path}`
}
function isActive(path) {
  const current = route.path.replace(/\/+$/, '')
  const target = localizedPath(path)
  return path === '/dashboard'
    ? current === target
    : current === target || current.startsWith(`${target}/`)
}
function menuLabel(item) {
  return route.params.lang === 'km' && item.labelKm ? item.labelKm : item.label
}
const pageTitle = computed(() => {
  if (profileActive.value) return 'My information'
  const item = menu.find(item => isActive(item.path))
  return item ? menuLabel(item) : 'Dashboard'
})
function closeAccount() {
  accountOpen.value = false
}
function toggleAccount() {
  logoutError.value = ''
  accountOpen.value = !accountOpen.value
}
function toggleNavigation() {
  menuOpen.value = !menuOpen.value
  closeAccount()
}
function onOutside(event) {
  if (
    accountRoot.value &&
    !accountRoot.value.contains(event.target)
  ) {
    closeAccount()
  }
}
function onEscape(event) {
  if (event.key !== 'Escape') return
  if (accountOpen.value) {
    closeAccount()
    accountTrigger.value?.focus()
  } else {
    menuOpen.value = false
  }
}
async function logout() {
  if (busy.value) return
  busy.value = true
  logoutError.value = ''
  const params = route.params.lang === 'km'
    ? { lang: 'km' }
    : {}
  try {
    await auth.logout()
  } catch (failure) {
    logoutError.value =
      failure?.message || 'Unable to log out. Please try again.'
    busy.value = false
    return
  }
  closeAccount()
  menuOpen.value = false
  try {
    await router.replace({ name: 'home', params })
  } catch (failure) {
    console.error('Navigation after logout failed:', failure)
  } finally {
    busy.value = false
  }
}
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    closeAccount()
  },
)
watch(() => auth.isAuthenticated, closeAccount)
onMounted(() => {
  restoreTheme()
  themeObserver = new MutationObserver(syncTheme)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  window.addEventListener('storage', onThemeStorage)
  document.addEventListener('pointerdown', onOutside)
  document.addEventListener('keydown', onEscape)
})
onUnmounted(() => {
  themeObserver?.disconnect()
  window.removeEventListener('storage', onThemeStorage)
  document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('keydown', onEscape)
})
</script>
<template>
  <div
    class="min-h-dvh w-full bg-slate-50 text-slate-900
           dark:bg-[#0b1120] dark:text-slate-100"
  >
    <div class="min-h-dvh w-full lg:pl-[250px]">
      <!-- Sidebar -->
      <aside
        class="border-b border-slate-200 bg-white
               lg:fixed lg:inset-y-0 lg:left-0 lg:z-40
               lg:flex lg:w-[250px] lg:flex-col
               lg:border-r lg:border-b-0
               dark:border-white/10 dark:bg-[#101827]"
      >
        <!-- Brand -->
        <div
          class="flex shrink-0 items-center justify-between gap-3
                 border-b border-slate-100 px-5 py-5
                 dark:border-white/5"
        >
          <RouterLink
            :to="localizedPath('/dashboard')"
            class="flex min-w-0 items-center gap-3"
          >
            <span
  class="flex size-10 shrink-0 items-center justify-center
         overflow-hidden rounded-xl bg-emerald-600"
>
  <img
    src="/Profile.jpg"
    alt="CMM-FT logo"
    class="h-full w-full object-cover"
  />
</span>
            <span class="min-w-0">
              <span class="block text-sm font-bold">
                CMM-FT
              </span>
              <span
                class="mt-1 block text-[11px]
                       text-slate-500 dark:text-slate-400"
              >
                Member dashboard
              </span>
            </span>
          </RouterLink>
          <button
            type="button"
            aria-controls="dashboard-navigation"
            :aria-expanded="menuOpen"
            :aria-label="menuOpen ? 'Close navigation' : 'Open navigation'"
            class="flex size-10 shrink-0 cursor-pointer items-center
                   justify-center rounded-xl bg-slate-100
                   focus-visible:outline-2
                   focus-visible:outline-emerald-500
                   lg:hidden dark:bg-white/5"
            @click="toggleNavigation"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              class="size-5"
            >
              <path v-if="menuOpen" d="M6 6l12 12M6 18L18 6" />
              <path v-else d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <div
          id="dashboard-navigation"
          :class="menuOpen ? 'flex' : 'hidden'"
          class="min-h-0 flex-col lg:flex lg:flex-1"
        >
          <!-- Navigation -->
          <div
            class="min-h-0 px-3 pt-6 pb-4
                   lg:flex-1 lg:overflow-y-auto"
          >
            <p
              class="mb-3 px-3 text-[10px] font-semibold uppercase
                     tracking-[0.16em] text-slate-400"
            >
              Main menu
            </p>
            <nav
              aria-label="Dashboard navigation"
              class="space-y-1.5"
            >
              <RouterLink
                v-for="item in menu"
                :key="item.path"
                :to="localizedPath(item.path)"
                :aria-current="isActive(item.path) ? 'page' : undefined"
                class="flex min-h-12 items-center gap-3 rounded-xl
                       border px-3 py-3 text-sm font-medium
                       transition-colors focus-visible:outline-2
                       focus-visible:outline-emerald-500"
                :class="
                  isActive(item.path)
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                "
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-[18px] shrink-0"
                >
                  <path :d="item.icon" />
                </svg>
                <span class="min-w-0 flex-1">
                  {{ menuLabel(item) }}
                </span>
                <span
                  v-if="isActive(item.path)"
                  aria-hidden="true"
                  class="size-1.5 shrink-0 rounded-full bg-emerald-500"
                />
              </RouterLink>
            </nav>
          </div>
          <!-- Account -->
          <div
            class="shrink-0 border-t border-slate-100
                   px-3 pt-4 pb-3 dark:border-white/10"
          >
            <div ref="accountRoot">
              <button
                ref="accountTrigger"
                type="button"
                aria-controls="dashboard-account-dropdown"
                :aria-expanded="accountOpen"
                class="flex w-full cursor-pointer items-center gap-3
                       rounded-xl border p-3 text-left
                       transition-colors focus-visible:outline-2
                       focus-visible:outline-emerald-500"
                :class="
                  accountOpen || profileActive
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                    : 'border-slate-200 bg-slate-50 hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.03]'
                "
                @click="toggleAccount"
              >
                <span
                  aria-hidden="true"
                  class="flex size-10 shrink-0 items-center justify-center
                         rounded-xl bg-emerald-600
                         text-sm font-bold text-white"
                >
                  {{ initial }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold">
                    {{ username }}
                  </span>
                  <span
                    class="mt-1 block text-[11px]
                           text-slate-500 dark:text-slate-400"
                  >
                    My account
                  </span>
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-4 shrink-0 text-slate-400 transition-transform"
                  :class="{ 'rotate-180': accountOpen }"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <!-- Dropdown below username -->
              <div
                v-if="accountOpen"
                id="dashboard-account-dropdown"
                class="mt-2 max-h-[40dvh] overflow-y-auto
                       rounded-xl border border-slate-200
                       bg-white p-1.5 shadow-sm
                       dark:border-white/10 dark:bg-[#152033]"
              >
                <div
                  class="mb-1 border-b border-slate-100 px-3 py-3
                         dark:border-white/10"
                >
                  <p class="break-words text-sm font-semibold">
                    {{ username }}
                  </p>
                  <p
                    class="mt-1 break-all text-xs leading-5
                           text-slate-500 dark:text-slate-400"
                  >
                    {{ email }}
                  </p>
                </div>
                <RouterLink
                  :to="localizedPath('/dashboard/profile')"
                  :aria-current="profileActive ? 'page' : undefined"
                  class="flex items-center gap-3 rounded-lg px-3 py-3
                         text-sm font-medium transition-colors
                         focus-visible:outline-2
                         focus-visible:outline-emerald-500"
                  :class="
                    profileActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5'
                  "
                  @click="closeAccount"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    class="size-4 shrink-0"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                  </svg>
                  My information
                </RouterLink>
                <div
                  class="mt-1 border-t border-slate-100 pt-1
                         dark:border-white/10"
                >
                  <button
                    type="button"
                    :disabled="busy"
                    class="flex w-full cursor-pointer items-center gap-3
                           rounded-lg px-3 py-3 text-left
                           text-sm font-medium text-red-600
                           transition hover:bg-red-50
                           focus-visible:outline-2
                           focus-visible:outline-red-500
                           disabled:cursor-wait disabled:opacity-50
                           dark:text-red-300 dark:hover:bg-red-500/10"
                    @click="logout"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.7"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="size-4 shrink-0"
                    >
                      <path
                        d="M9 5H4v14h5 M14 8l4 4-4 4 M8 12h13"
                      />
                    </svg>
                    {{ busy ? 'Logging out…' : 'Logout' }}
                  </button>
                  <p
                    v-if="logoutError"
                    role="alert"
                    class="px-3 py-2 text-xs leading-5
                           text-red-600 dark:text-red-300"
                  >
                    {{ logoutError }}
                  </p>
                </div>
              </div>
            </div>
            <!-- Homepage -->
            <RouterLink
              :to="localizedPath('/')"
              class="mt-3 flex items-center gap-3 rounded-xl px-3 py-3
                     text-xs font-medium text-slate-600 transition
                     hover:bg-slate-100 dark:text-slate-300
                     dark:hover:bg-white/5"
            >
              <span aria-hidden="true">←</span>
              Back to Homepage
            </RouterLink>
          </div>
        </div>
      </aside>
      <!-- Page content -->
      <div class="w-full min-w-0">
        <header
          class="flex items-center justify-between gap-4
                 border-b border-slate-200 bg-white px-5 py-5
                 sm:px-6 lg:px-8
                 dark:border-white/10 dark:bg-[#101827]"
        >
          <div class="min-w-0">
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Your workspace
            </p>
            <h1 class="mt-1 text-lg font-semibold">
              {{ pageTitle }}
            </h1>
          </div>
          <div class="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              :aria-label="themeLabel"
              :title="themeLabel"
              class="flex size-11 shrink-0 cursor-pointer items-center
                     justify-center rounded-full border border-slate-200
                     bg-slate-50 text-slate-600 transition-colors
                     hover:border-emerald-400 hover:bg-slate-100
                     focus-visible:outline-2
                     focus-visible:outline-offset-2
                     focus-visible:outline-emerald-500
                     dark:border-white/10 dark:bg-white/5
                     dark:text-amber-300 dark:hover:border-emerald-500
                     dark:hover:bg-white/10"
              @click="toggleTheme"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="size-5"
              >
                <template v-if="isDark">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.93 4.93l1.42 1.42 M17.65 17.65l1.42 1.42 M4.93 19.07l1.42-1.42 M17.65 6.35l1.42-1.42" />
                </template>
                <path
                  v-else
                  d="M20.9 13.1A9 9 0 0 1 10.9 3.1a9 9 0 1 0 10 10Z"
                />
              </svg>
            </button>

            <RouterLink
              :to="localizedPath('/dashboard/profile')"
              aria-label="Open my information"
              class="flex shrink-0 items-center gap-2 rounded-full
                     border border-slate-200 px-2 py-1.5 text-xs
                     transition hover:border-emerald-400
                     dark:border-white/10"
            >
              <span
                aria-hidden="true"
                class="flex size-8 items-center justify-center
                       rounded-full bg-emerald-600
                       font-semibold text-white"
              >
                {{ initial }}
              </span>
              <span class="hidden max-w-32 truncate pr-2 sm:block">
                {{ username }}
              </span>
            </RouterLink>
          </div>
        </header>
        <RouterView />
      </div>
    </div>
  </div>
</template>
