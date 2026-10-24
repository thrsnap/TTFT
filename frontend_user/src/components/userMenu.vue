<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faHouse,
  faNewspaper,
  faBook,
  faBookOpen,
  faSquarePollVertical,
  faMagnifyingGlassChart,
  faHandshake,
  faHeadset,
  faCircleUser,
  faBoltLightning
} from '@fortawesome/free-solid-svg-icons'
import { useAuthStore } from '../store/user/authStore.js'
import UserAvatar from './UserAvatar.vue'
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
const root = ref(null)
const trigger = ref(null)
const open = ref(false)
const busy = ref(false)
const error = ref('')
const username = computed(
  () => auth.user?.username || 'My account',
)
const email = computed(
  () => auth.user?.email || '—',
)
const dashboardLink = computed(() => ({
  name: 'dashboard',
  params: route.params.lang === 'km' ? { lang: 'km' } : {},
}))
const navLinks = [
  {
    to: '/',
    label: 'nav.home',
    icon: faHouse,
  },
  {
    to: '/news',
    label: 'nav.news',
    icon: faNewspaper,
  },
  {
    to: '/academy',
    label: 'nav.academy',
    icon: faBook,
  },
  {
    to: '/signal',
    label: 'nav.signal',
    icon: faSquarePollVertical,
  },
 {
  to: '/trader-post',
  label: 'nav.trader-post',
  icon: faBoltLightning,
},
  {
    to: '/analysis',
    label: 'nav.analysis',
    icon: faMagnifyingGlassChart,
  },
  {
    to: '/collaborate',
    label: 'nav.collaborate',
    icon: faHandshake,
  },
  {
    to: '/getsupport',
    label: 'nav.support',
    icon: faHeadset,
  },
  {
    to: '/about',
    label: 'nav.about',
    icon: faCircleUser,
  },
]
function linkLabel(link) {
  if (link.to === '/trader-post') {
    return route.params.lang === 'km'
      ? 'បង្ហោះការជួញដូរ'
      : 'Trader Post'
  }
  return t(link.label)
}
function localizedPath(path) {
  if (route.params.lang !== 'km') return path
  return path === '/' ? '/km' : `/km${path}`
}
function close() {
  open.value = false
}
function toggle() {
  error.value = ''
  open.value = !open.value
}
function outside(event) {
  if (root.value && !root.value.contains(event.target)) {
    close()
  }
}
function escape(event) {
  if (event.key === 'Escape' && open.value) {
    close()
    trigger.value?.focus()
  }
}
async function logout() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const params = route.params.lang === 'km'
    ? { lang: 'km' }
    : {}
  try {
    await auth.logout()
  } catch (failure) {
    error.value =
      failure?.message || 'Unable to log out. Please try again.'
    busy.value = false
    return
  }
  close()
  try {
    await router.replace({
      name: 'home',
      params,
    })
  } catch (failure) {
    console.error('Navigation after logout failed:', failure)
  } finally {
    busy.value = false
  }
}
watch(() => route.fullPath, close)
watch(() => auth.isAuthenticated, close)
let desktopQuery
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
  desktopQuery = window.matchMedia('(min-width: 1024px)')
  desktopQuery.addEventListener('change', close)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
  desktopQuery?.removeEventListener('change', close)
})
</script>
<template>
  <div
    v-if="auth.isAuthenticated"
    ref="root"
    class="relative shrink-0 text-white"
    :class="{ 'font-khmer': route.params.lang === 'km' }"
  >
    <button
      ref="trigger"
      type="button"
      :aria-expanded="open"
      :aria-label="open ? 'Close account menu' : 'Open account menu'"
      aria-controls="user-account-dropdown"
      class="flex shrink-0 cursor-pointer items-center gap-1.5
             rounded-full p-1 transition-colors hover:bg-white/10
             focus-visible:outline-2
             focus-visible:outline-offset-2
             focus-visible:outline-emerald-400"
      @click="toggle"
    >
      <!-- Profile circle -->
      <UserAvatar
        variant="dark"
        class="size-10 border border-emerald-700 text-base
               max-[768px]:size-8 max-[768px]:text-sm
               max-[320px]:size-7 max-[320px]:text-xs"
        decorative
      />
      <!-- Dropdown arrow -->
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="size-3.5 shrink-0 text-slate-300
               transition-transform duration-200"
        :class="{ 'rotate-180': open }"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="-translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-100"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        id="user-account-dropdown"
        class="absolute right-0 top-full z-[70] mt-3 w-64
               max-h-[calc(100dvh-100px)]
               max-w-[calc(100vw-24px)]
               overflow-y-auto overscroll-contain
               rounded-2xl border border-white/10
               bg-slate-900 text-white shadow-2xl"
      >
        <!-- Username and email -->
        <div class="border-b border-white/10 px-4 py-4">
          <div class="flex min-w-0 items-center gap-3">
            <UserAvatar variant="dark" class="size-10 border border-emerald-700 text-base" decorative />
            <div class="min-w-0 flex-1">
              <p class="break-words text-sm font-semibold text-white">
                {{ username }}
              </p>
              <p class="mt-1 break-all text-xs leading-5 text-slate-400">
                {{ email }}
              </p>
            </div>
          </div>
        </div>
        <!-- Navbar links: mobile and tablet only -->
        <nav
          aria-label="Mobile navigation"
          class="border-b border-white/10 p-2 min-[1024px]:hidden"
        >
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="localizedPath(link.to)"
            class="flex min-h-11 items-center gap-3
                   rounded-lg px-3 py-2.5
                   text-sm font-medium text-white
                   no-underline transition-colors
                   hover:bg-white/10
                   focus-visible:outline-2
                   focus-visible:outline-emerald-400"
            exact-active-class="bg-white/10 text-emerald-300"
            @click="close"
          >
            <FontAwesomeIcon
              :icon="link.icon"
              class="w-5 shrink-0"
            />
            {{ linkLabel(link) }}
          </RouterLink>
        </nav>
        <!-- Dashboard -->
        <nav aria-label="Your account" class="p-2">
          <RouterLink
            :to="dashboardLink"
            class="flex min-h-11 items-center gap-3
                   rounded-lg px-3 py-2.5
                   text-sm font-medium text-white
                   no-underline transition-colors
                   hover:bg-white/10
                   focus-visible:outline-2
                   focus-visible:outline-emerald-400"
            exact-active-class="bg-white/10 text-emerald-300"
            @click="close"
          >
            <svg
              class="size-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="3"
                width="7"
                height="7"
                rx="1.5"
              />
              <rect
                x="14"
                y="3"
                width="7"
                height="7"
                rx="1.5"
              />
              <rect
                x="3"
                y="14"
                width="7"
                height="7"
                rx="1.5"
              />
              <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1.5"
              />
            </svg>
            My Dashboard
          </RouterLink>
        </nav>
        <!-- Log out: always last -->
        <div class="border-t border-white/10 p-2">
          <button
            type="button"
            :disabled="busy"
            class="flex min-h-11 w-full cursor-pointer
                   items-center gap-3 rounded-lg px-3 py-2.5
                   text-left text-sm font-medium text-red-300
                   transition-colors hover:bg-red-500/10
                   focus-visible:outline-2
                   focus-visible:outline-red-400
                   disabled:cursor-wait disabled:opacity-50"
            @click="logout"
          >
            <svg
              class="size-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M9 5H5v14h4" />
              <path d="M9 12h12" />
              <path d="m17 8 4 4-4 4" />
            </svg>
            {{ busy ? 'Logging out…' : 'Log out' }}
          </button>
          <p
            v-if="error"
            role="alert"
            class="px-3 pb-2 text-xs leading-5 text-red-300"
          >
            {{ error }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>
