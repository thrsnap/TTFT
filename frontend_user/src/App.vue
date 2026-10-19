<script setup>
import { computed, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faFacebook,
  faYoutube,
  faTelegram,
  faDiscord,
  faTiktok,
} from '@fortawesome/free-brands-svg-icons'

import Navbar from './components/navbar.vue'
import PageLoading from './components/PageLoading.vue'

import {
  startPageLoading,
  stopPageLoading,
} from './composable/usePageLoading.js'

import { useAutoLogout } from './composable/userAutoLogout.js'
import { useAuthStore } from './store/user/authStore.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const { locale } = useI18n({
  useScope: 'global',
})

// Dashboard children inherit this setting from their parent.
const hidePublicLayout = computed(() =>
  route.matched.some(record => record.meta.hidePublicLayout === true),
)

function localizedPath(path) {
  if (route.params.lang !== 'km') return path
  return path === '/' ? '/km' : `/km${path}`
}

const quickLinks = [
  { label: 'Home', path: '/' },
  { label: 'News', path: '/news' },
  { label: 'Academy', path: '/academy' },
  { label: 'Analysis', path: '/analysis' },
  { label: 'Collaborate', path: '/collaborate' },
  { label: 'Support', path: '/getsupport' },
  { label: 'About', path: '/about' },
]

// Preserves your existing resource destinations.
const resourceLinks = [
  { label: 'Privacy Policy', path: '/' },
  { label: 'Terms', path: '/' },
  { label: 'Help Center', path: '/getsupport' },
  { label: 'FAQ', path: '/' },
]

const socialLinks = [
  {
    label: 'Facebook',
    url: 'https://www.facebook.com/profile.php?id=61568427742130',
    icon: faFacebook,
    color: 'text-[#408cff]',
  },
  {
    label: 'YouTube',
    url: 'https://www.youtube.com/@ThunTula-FT',
    icon: faYoutube,
    color: 'text-[#ff0000]',
  },
  {
    label: 'Telegram',
    url: 'https://t.me/Creator_Of_Mentorship_FT',
    icon: faTelegram,
    color: 'text-[#29ACFF]',
  },
  {
    label: 'Discord',
    url: 'https://discord.com/invite/UXzxFatB6F',
    icon: faDiscord,
    color: 'text-[#005FC9]',
  },
  {
    label: 'TikTok',
    url: 'https://www.tiktok.com/@YOUR_USERNAME',
    icon: faTiktok,
    color: 'text-white',
  },
]

// Language.
watch(
  () => route.params.lang,
  lang => {
    locale.value = lang === 'km' ? 'km' : 'en'
    document.documentElement.lang = locale.value
  },
  { immediate: true },
)

// Automatic logout after 10 minutes without activity.
const { start: startIdleTimer } = useAutoLogout({
  isLoggedIn: () => Boolean(auth.user),

  timeoutMs: 10 * 60 * 1000,

  logout: async () => {
    const loginPath =
      route.params.lang === 'km' ? '/km/login' : '/login'

    await auth.logout()

    await router.replace({
      path: loginPath,
      query: {
        reason: 'inactive',
      },
    })
  },
})

// Start a fresh timer after login or session restoration.
watch(
  () => Boolean(auth.user),
  loggedIn => {
    if (loggedIn) {
      startIdleTimer()
    }
  },
)

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

// Initial page loading.
onMounted(async () => {
  startPageLoading()

  try {
    await router.isReady()

    if (auth.user) {
      startIdleTimer()
    }
  } finally {
    stopPageLoading()
  }
})
</script>

<template>
  <div class="flex min-h-dvh w-full min-w-0 flex-col font-Roboto">
    <PageLoading />

    <!-- Public navbar only -->
    <Navbar v-if="!hidePublicLayout" />

    <!-- Dashboard renders without the public navbar/footer -->
    <div class="w-full min-w-0 flex-1">
      <RouterView />
    </div>

    <!-- Public footer only -->
    <footer
      v-if="!hidePublicLayout"
      class="border-indigo-500/60 bg-gray-950/80
             text-gray-300 backdrop-blur-md"
    >
      <div
        class="mx-auto max-w-7xl px-4 py-10
               max-[768px]:py-8
               max-[600px]:py-7
               max-[480px]:px-3 max-[480px]:py-6
               max-[414px]:px-2.5
               max-[320px]:px-2 max-[320px]:py-5"
      >
        <div
          class="grid grid-cols-2 gap-10
                 lg:grid-cols-[2fr_1fr_1fr]
                 max-[768px]:gap-8
                 max-[600px]:gap-6
                 max-[480px]:gap-5
                 max-[414px]:gap-4
                 max-[320px]:gap-3"
        >
          <!-- Brand -->
          <div class="col-span-2 min-w-0 lg:col-span-1">
            <img
              src="/Profile.jpg"
              alt="CMM-FT logo"
              class="block h-15 w-15 cursor-pointer rounded-[10px]
                     object-cover transition-transform duration-300
                     ease-in-out hover:rotate-10 hover:scale-[1.2]
                     max-[768px]:h-14 max-[768px]:w-14
                     max-[600px]:h-13 max-[600px]:w-13
                     max-[480px]:h-12 max-[480px]:w-12
                     max-[414px]:h-11 max-[414px]:w-11
                     max-[320px]:h-10 max-[320px]:w-10"
            />

            <h2
              class="mt-3 text-[1.5rem] font-bold text-white
                     max-[600px]:text-xl
                     max-[480px]:text-lg
                     max-[320px]:text-base"
            >
              CMM-FT
            </h2>

            <p
              class="mt-5 max-w-lg leading-7 text-gray-400
                     max-[768px]:text-[15px]
                     max-[600px]:mt-4 max-[600px]:text-sm
                     max-[480px]:mt-3 max-[480px]:leading-6
                     max-[414px]:text-[13px]
                     max-[320px]:text-xs max-[320px]:leading-5"
            >
              I am not a financial advisor.
              <br />
              This is not financial advice.
              The content is provided for informational and educational
              purposes only.
            </p>
          </div>

          <!-- Quick links -->
          <div class="min-w-0">
            <h3
              class="mb-5 font-semibold text-white
                     max-[600px]:mb-4
                     max-[480px]:mb-3 max-[480px]:text-sm"
            >
              Quick Links
            </h3>

            <ul
              class="space-y-3
                     max-[768px]:text-sm
                     max-[600px]:space-y-2
                     max-[414px]:text-[13px]
                     max-[320px]:text-xs"
            >
              <li v-for="link in quickLinks" :key="link.label">
                <RouterLink
                  :to="localizedPath(link.path)"
                  class="inline-block py-1 hover:text-white"
                  @click="scrollToTop"
                >
                  {{ link.label }}
                </RouterLink>
              </li>
            </ul>
          </div>

          <!-- Resources -->
          <div class="min-w-0">
            <h3
              class="mb-5 font-semibold text-white
                     max-[600px]:mb-4
                     max-[480px]:mb-3 max-[480px]:text-sm"
            >
              Resources
            </h3>

            <ul
              class="space-y-3
                     max-[768px]:text-sm
                     max-[600px]:space-y-2
                     max-[414px]:text-[13px]
                     max-[320px]:text-xs"
            >
              <li v-for="link in resourceLinks" :key="link.label">
                <RouterLink
                  :to="localizedPath(link.path)"
                  class="inline-block py-1 hover:text-white"
                  @click="scrollToTop"
                >
                  {{ link.label }}
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>

        <!-- Copyright and social links -->
        <div
          class="mt-10 flex flex-col items-center justify-between
                 gap-5 border-t border-gray-800 pt-8 md:flex-row
                 max-[768px]:mt-8 max-[768px]:pt-6
                 max-[600px]:mt-7 max-[600px]:gap-4
                 max-[480px]:mt-6 max-[480px]:pt-5
                 max-[414px]:gap-3
                 max-[320px]:mt-5 max-[320px]:pt-4"
        >
          <p
            class="text-center text-sm leading-6 text-gray-300
                   md:text-left max-[480px]:text-xs"
          >
            © 2026 CMM-FT Team. All Rights Reserved.
          </p>

          <div
            class="flex flex-wrap items-center justify-center
                   gap-3 text-2xl
                   max-[768px]:gap-2
                   max-[600px]:text-[22px]
                   max-[480px]:gap-1.5
                   max-[414px]:text-xl
                   max-[320px]:gap-1"
          >
            <a
              v-for="social in socialLinks"
              :key="social.label"
              :href="social.url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="social.label"
              class="flex h-11 w-11 items-center justify-center
                     rounded-lg transition-colors hover:bg-white/10"
            >
              <FontAwesomeIcon
                :icon="social.icon"
                :class="social.color"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>