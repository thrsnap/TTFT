<template>
  <header
    class="sticky top-0 z-1000 border-b border-white/10
      bg-[rgba(40,54,75,0.95)] px-4 py-4
      text-white shadow-lg backdrop-blur-[10px]
      animate-[navbarEnter_0.8s_ease-out]
      max-[768px]:px-3 max-[768px]:py-3
      max-[600px]:px-2.5
      max-[480px]:px-2 max-[480px]:py-2.5
      max-[414px]:px-1.5
      max-[320px]:px-1 max-[320px]:py-2"
    @keydown.esc="closeMenus"
  >
    <div
      class="mx-auto flex max-w-350 items-center justify-between gap-2
        max-[414px]:gap-1"
    >
      <!-- Logo -->
      <RouterLink
        :to="localizedPath('/')"
        @click="closeMenus"
        class="group flex shrink-0 items-center gap-2 no-underline
          max-[414px]:gap-1"
      >
        <img
          src="/Profile.jpg"
          alt="CMM-FT logo"
          class="block h-10 w-10 shrink-0 rounded-lg object-cover
            transition-transform duration-300 group-hover:scale-110
            max-[480px]:h-9 max-[480px]:w-9
            max-[320px]:h-8 max-[320px]:w-8"
        >

        <span
          class="shrink-0 whitespace-nowrap
            bg-[linear-gradient(135deg,#667eea,#764ba2)]
            bg-clip-text text-base font-bold tracking-tight
            text-transparent
            max-[600px]:text-sm
            max-[414px]:text-xs
            max-[320px]:text-[10px]"
        >
          CMM-FT
        </span>
      </RouterLink>

      <!-- Desktop navigation -->
      <nav
        aria-label="Main navigation"
        class="hidden min-[1024px]:block"
        :class="{ 'font-khmer': language === 'km' }"
      >
        <ul class="flex list-none items-center">
          <li v-for="link in navLinks" :key="link.to">
            <RouterLink
              :to="localizedPath(link.to)"
              @click="closeMenus"
              class="flex items-center gap-2 whitespace-nowrap
                rounded-lg px-2 py-2 text-sm
                font-medium text-white no-underline
                transition-colors hover:bg-white/10
                min-[1280px]:px-3 min-[1280px]:text-base"
              exact-active-class="bg-white/10"
            >
              <FontAwesomeIcon
                :icon="link.icon"
                class="hidden min-[1280px]:inline-block"
              />
              {{ t(link.label) }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <!-- Right-side controls -->
      <div
        class="flex shrink-0 items-center gap-2
          max-[768px]:gap-1.5
          max-[600px]:gap-1
          max-[320px]:gap-0.5"
      >
        <!-- Mobile Home -->
        <RouterLink
          :to="localizedPath('/')"
          @click="closeMenus"
          :aria-label="t('nav.home')"
          class="flex h-10 w-10 shrink-0 items-center justify-center
            rounded-lg bg-white/10 text-white
            transition-colors hover:bg-white/20
            min-[1024px]:hidden
            max-[480px]:h-9 max-[480px]:w-9
            max-[320px]:h-8 max-[320px]:w-8"
        >
          <FontAwesomeIcon :icon="faHouse" />
        </RouterLink>

        <!-- Theme -->
        <button
          type="button"
          @click="toggleTheme"
          :aria-label="isLightMode ? 'Use dark theme' : 'Use light theme'"
          :aria-pressed="isLightMode"
          class="flex h-10 w-10 shrink-0 cursor-pointer items-center
            justify-center rounded-lg bg-white/10 text-white
            transition-colors hover:bg-white/20
            max-[480px]:h-9 max-[480px]:w-9
            max-[320px]:h-8 max-[320px]:w-8"
        >
          <FontAwesomeIcon :icon="isLightMode ? faSun : faMoon" />
        </button>

        <!-- Language -->
        <div
          role="group"
          aria-label="Select language"
          class="inline-flex shrink-0 items-center rounded-lg
            border border-white/20 bg-slate-800 p-1
            max-[480px]:p-0.5"
        >
          <button
            type="button"
            @click="switchLanguage('en')"
            :aria-pressed="language === 'en'"
            aria-label="English"
            class="min-h-8 cursor-pointer rounded-md px-3 py-1.5
              text-xs font-semibold transition-colors duration-200
              max-[768px]:px-2.5
              max-[600px]:px-2
              max-[480px]:py-1
              max-[320px]:px-1.5"
            :class="language === 'en'
              ? 'bg-white text-slate-900'
              : 'text-slate-300 hover:bg-white/10'"
          >
            EN
          </button>

          <button
            type="button"
            @click="switchLanguage('km')"
            :aria-pressed="language === 'km'"
            aria-label="ភាសាខ្មែរ"
            class="min-h-8 cursor-pointer rounded-md px-3 py-1.5
              text-xs font-semibold transition-colors duration-200 font-khmer
              max-[768px]:px-2.5
              max-[600px]:px-2
              max-[480px]:py-1
              max-[320px]:px-1.5"
            :class="language === 'km'
              ? 'bg-white text-slate-900'
              : 'text-slate-300 hover:bg-white/10'"
          >
            ខ្មែរ
          </button>
        </div>

        <!-- Desktop account dropdown -->
        <div
          v-if="!auth.isAuthenticated"
          class="relative hidden shrink-0 min-[1024px]:block"
          :class="{ 'font-khmer': language === 'km' }"
        > 
          <button
            type="button"
            @click="joinOpen = !joinOpen"
            :aria-expanded="joinOpen"
            aria-controls="join-dropdown"
            class="flex cursor-pointer items-center gap-2
              whitespace-nowrap rounded-xl
              bg-[linear-gradient(135deg,#667eea,#764ba2)]
              px-3 py-2 text-sm font-semibold text-white
              min-[1280px]:px-4 min-[1280px]:text-base"
          >
            <FontAwesomeIcon :icon="faUserPlus" />
            {{ t('nav.joinNow') }}
          </button>

          <nav
            v-if="joinOpen"
            id="join-dropdown"
            aria-label="Account"
            class="absolute right-0 top-full z-50 mt-2 w-40
              overflow-hidden rounded-xl border border-white/10
              bg-slate-900 text-white shadow-xl"
          >
            <RouterLink
              :to="localizedPath('/login')"
              @click="closeMenus"
              class="flex items-center gap-2 px-4 py-3 hover:bg-slate-800"
            >
              <FontAwesomeIcon :icon="faRightToBracket" />
              {{ t('nav.login') }}
            </RouterLink>

            <RouterLink
              :to="localizedPath('/register')"
              @click="closeMenus"
              class="flex items-center gap-2 px-4 py-3 hover:bg-slate-800"
            >
              <FontAwesomeIcon :icon="faUserPlus" />
              {{ t('nav.register') }}
            </RouterLink>
          </nav>
        </div>

        <!-- Profile menu on desktop and mobile -->
        <div
          v-if="auth.isAuthenticated"
          class="relative z-[60] shrink-0"
          :class="{ 'font-khmer': language === 'km' }"
          @click="isMenuOpen = false"
        >
          <UserMenu />
        </div>

        <!-- Hamburger -->
        <button
          type="button"
          @click="toggleMenu"
          :aria-expanded="isMenuOpen"
          :aria-label="isMenuOpen ? 'Close menu' : 'Open menu'"
          aria-controls="mobile-navigation"
          class="flex h-10 w-10 shrink-0 cursor-pointer flex-col
            items-center justify-center gap-1.5 rounded-lg
            bg-white/10 transition-colors hover:bg-white/20
            min-[1024px]:hidden
            max-[480px]:h-9 max-[480px]:w-9
            max-[320px]:h-8 max-[320px]:w-8"
        >
          <span
            class="block h-0.5 w-6 rounded-sm bg-white
              transition-transform duration-300 max-[480px]:w-5"
            :class="{ 'translate-y-2 rotate-45': isMenuOpen }"
          ></span>

          <span
            class="block h-0.5 w-6 rounded-sm bg-white
              transition-opacity duration-300 max-[480px]:w-5"
            :class="{ 'opacity-0': isMenuOpen }"
          ></span>

          <span
            class="block h-0.5 w-6 rounded-sm bg-white
              transition-transform duration-300 max-[480px]:w-5"
            :class="{ '-translate-y-2 -rotate-45': isMenuOpen }"
          ></span>
        </button>
      </div>
    </div>

    <!-- Mobile navigation -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <div
        v-if="isMenuOpen"
        id="mobile-navigation"
        class="absolute left-0 top-full z-50
          max-h-[calc(100dvh-80px)] w-full overflow-y-auto
          overscroll-contain bg-[rgba(30,41,59,0.98)]
          px-3 pb-4 pt-3 text-white shadow-xl
          backdrop-blur-md min-[1024px]:hidden
          max-[768px]:px-2
          max-[480px]:pt-2
          max-[320px]:px-1.5"
      >
        <nav
          aria-label="Mobile navigation"
          class="flex flex-col"
          :class="{ 'font-khmer': language === 'km' }"
        >
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="localizedPath(link.to)"
            @click="closeMenus"
            class="flex min-h-11 items-center gap-3 rounded-lg
              px-4 py-4 text-white
              transition-colors hover:bg-white/10
              max-[768px]:py-3
              max-[600px]:text-sm
              max-[480px]:px-3
              max-[414px]:gap-2
              max-[320px]:px-2"
            exact-active-class="bg-white/10"
          >
            <FontAwesomeIcon :icon="link.icon" class="w-5 shrink-0" />
            {{ t(link.label) }}
          </RouterLink>
        </nav>

        <!-- Mobile account buttons -->
        <div
          v-if="!auth.isAuthenticated"
          class="mt-6 grid grid-cols-2 gap-2
            max-[768px]:mt-5
            max-[600px]:mt-4
            max-[480px]:mt-3"
          :class="{ 'font-khmer': language === 'km' }"
        >
          <RouterLink
            :to="localizedPath('/login')"
            @click="closeMenus"
            class="flex min-h-11 items-center justify-center gap-2
              rounded-xl bg-gray-100 px-4 py-3 text-sm
              font-semibold text-black transition-colors
              hover:bg-gray-300
              max-[414px]:px-3
              max-[320px]:px-2"
          >
            <FontAwesomeIcon :icon="faRightToBracket" />
            {{ t('nav.login') }}
          </RouterLink>

          <RouterLink
            :to="localizedPath('/register')"
            @click="closeMenus"
            class="flex min-h-11 items-center justify-center gap-2
              rounded-xl bg-gray-100 px-4 py-3 text-sm
              font-semibold text-black transition-colors
              hover:bg-gray-300
              max-[414px]:px-3
              max-[320px]:px-2"
          >
            <FontAwesomeIcon :icon="faUserPlus" />
            {{ t('nav.register') }}
          </RouterLink>
        </div>
      </div>
    </Transition>
  </header>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useI18n } from 'vue-i18n'
import UserMenu from './userMenu.vue'
import { useAuthStore } from '../store/user/authStore.js'
import {
  faHouse,
  faNewspaper,
  faBook,
  faCircleUser,
  faMoon,
  faSun,
  faHeadset,
  faSquarePollVertical,
  faUserPlus,
  faRightToBracket,
  faHandshake,
} from '@fortawesome/free-solid-svg-icons'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const { t, locale: language } = useI18n({
  useScope: 'global',
})

const joinOpen = ref(false)
const isMenuOpen = ref(false)
const isLightMode = ref(false)

const navLinks = [
  { to: '/', label: 'nav.home', icon: faHouse },
  { to: '/news', label: 'nav.news', icon: faNewspaper },
  { to: '/academy', label: 'nav.academy', icon: faBook },
  {
    to: '/analysis',
    label: 'nav.analysis',
    icon: faSquarePollVertical,
  },
  {
    to: '/collaborate',
    label: 'nav.collaborate',
    icon: faHandshake,
  },
  { to: '/getsupport', label: 'nav.support', icon: faHeadset },
  { to: '/about', label: 'nav.about', icon: faCircleUser },
]

// English: /news
// Khmer: /km/news
function localizedPath(path) {
  if (route.params.lang !== 'km') return path

  return path === '/' ? '/km' : `/km${path}`
}

// Preserve the current page, category, broker, query, and hash.
function switchLanguage(lang) {
  if (!route.name || !['en', 'km'].includes(lang)) return

  return router.push({
    name: route.name,
    params: {
      ...route.params,
      lang: lang === 'km' ? 'km' : '',
    },
    query: route.query,
    hash: route.hash,
  })
}

// Synchronize translations with the URL, including browser Back/Forward.
watch(
  () => route.params.lang,
  (lang) => {
    language.value = lang === 'km' ? 'km' : 'en'
    document.documentElement.lang = language.value
  },
  { immediate: true },
)

function closeMenus() {
  joinOpen.value = false
  isMenuOpen.value = false
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
  joinOpen.value = false
}

function toggleTheme() {
  isLightMode.value = !isLightMode.value

  document.documentElement.classList.toggle(
    'ligh-mode',
    isLightMode.value,
  )

  document.body.classList.toggle(
    'ligh-mode',
    isLightMode.value,
  )
}

watch(() => route.fullPath, closeMenus)
watch(() => auth.isAuthenticated, closeMenus)

let desktopQuery

onMounted(() => {
  isLightMode.value =
    document.documentElement.classList.contains('ligh-mode') ||
    document.body.classList.contains('ligh-mode')

  desktopQuery = window.matchMedia('(min-width: 1024px)')
  desktopQuery.addEventListener('change', closeMenus)
})

onUnmounted(() => {
  desktopQuery?.removeEventListener('change', closeMenus)
})
</script>