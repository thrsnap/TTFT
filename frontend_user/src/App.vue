<template>
    <div class=" flex flex-col min-h-screen font-Roboto scroll-smooth overflow-x-hidden">


        <navbar />
        <RouterView />


        <div>
            <footer class=" border-indigo-500/60
         bg-gray-950/80 backdrop-blur-md text-gray-300 ">
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
        <!-- Logo -->
        <div class="col-span-2 min-w-0 lg:col-span-1">
          <img
            class="block h-15 w-15 cursor-pointer rounded-[10px]
                   object-cover transition-transform duration-300
                   ease-in-out hover:rotate-10 hover:scale-[1.2]
                   max-[768px]:h-14 max-[768px]:w-14
                   max-[600px]:h-13 max-[600px]:w-13
                   max-[480px]:h-12 max-[480px]:w-12
                   max-[414px]:h-11 max-[414px]:w-11
                   max-[320px]:h-10 max-[320px]:w-10"
            src="/Profile.jpg"
            alt="CMM-FT logo"
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
            class="mt-5 max-w-lg text-gray-400 leading-7
                   max-[768px]:text-[15px]
                   max-[600px]:mt-4 max-[600px]:text-sm
                   max-[480px]:mt-3 max-[480px]:leading-6
                   max-[414px]:text-[13px]
                   max-[320px]:text-xs max-[320px]:leading-5"
          >
            I am not a financial advisor.
            <br />
            This is not financial advice.
            The content is provided for informational and educational purposes only
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
                   max-[320px]:text-xs
                   [&_a]:inline-block [&_a]:py-1"
          >
            <li>
              <RouterLink to="/" @click="scrollToTop" class="hover:text-white">Home</RouterLink>
            </li>
            <li>
              <RouterLink to="/news" @click="scrollToTop" class="hover:text-white">News</RouterLink>
            </li>
            <li>
              <RouterLink to="/academy" @click="scrollToTop" class="hover:text-white">Academy</RouterLink>
            </li>
            <li>
              <RouterLink to="/analysis" @click="scrollToTop" class="hover:text-white">Analysis</RouterLink>
            </li>
            <li>
              <RouterLink to="/collaborate" @click="scrollToTop" class="hover:text-white">
                Collaborate
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/getsupport" @click="scrollToTop" class="hover:text-white">
                Support
              </RouterLink>
            </li>
            <li>
              <RouterLink to="/about" @click="scrollToTop" class="hover:text-white">About</RouterLink>
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
                   max-[320px]:text-xs
                   [&_a]:inline-block [&_a]:py-1"
          >
            <li><RouterLink to="/" class="hover:text-white">Privacy Policy</RouterLink></li>
            <li><RouterLink to="/" class="hover:text-white">Terms</RouterLink></li>
            <li><RouterLink to="/getsupport" @click="scrollToTop" class="hover:text-white">Help Center</RouterLink></li>
            <li><RouterLink to="/"  class="hover:text-white">FAQ</RouterLink></li>
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
                 md:text-left
                 max-[480px]:text-xs"
        >
          © 2026 CMM-FT Team. All Rights Reserved.
        </p>

        <div
          class="flex flex-wrap items-center justify-center gap-3 text-2xl
                 max-[768px]:gap-2
                 max-[600px]:text-[22px]
                 max-[480px]:gap-1.5
                 max-[414px]:text-xl
                 max-[320px]:gap-1"
        >
          <a
            href="https://www.facebook.com/profile.php?id=61568427742130"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            class="flex h-11 w-11 items-center justify-center rounded-lg
                   transition-colors hover:bg-white/10"
          >
            <FontAwesomeIcon :icon="faFacebook" class="text-[#408cff]" />
          </a>

          <a
            href="https://www.youtube.com/@ThunTula-FT"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            class="flex h-11 w-11 items-center justify-center rounded-lg
                   transition-colors hover:bg-white/10"
          >
            <FontAwesomeIcon :icon="faYoutube" class="text-[#ff0000]" />
          </a>

          <a
            href="https://t.me/Creator_Of_Mentorship_FT"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            class="flex h-11 w-11 items-center justify-center rounded-lg
                   transition-colors hover:bg-white/10"
          >
            <FontAwesomeIcon :icon="faTelegram" class="text-[#29ACFF]" />
          </a>

          <a
            href="https://discord.com/invite/UXzxFatB6F"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Discord"
            class="flex h-11 w-11 items-center justify-center rounded-lg
                   transition-colors hover:bg-white/10"
          >
            <FontAwesomeIcon :icon="faDiscord" class="text-[#005FC9]" />
          </a>

          <!-- Replace with your actual TikTok profile URL -->
          <a
            href="https://www.tiktok.com/@YOUR_USERNAME"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            class="flex h-11 w-11 items-center justify-center rounded-lg
                   transition-colors hover:bg-white/10"
          >
            <FontAwesomeIcon
              :icon="faTiktok"
              class="rounded-full bg-[#0f0c0c] text-white
                     shadow-[0_0_20px_rgba(0,0,0,0.3)]"
            />
          </a>
        </div>
      </div>
    </div>
  </footer>
        </div>
    </div>



</template>


<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faFacebook, faYoutube, faTelegram, faDiscord, faTiktok } from '@fortawesome/free-brands-svg-icons'
import navbar from './components/navbar.vue';
import { RouterView } from 'vue-router';
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
const route = useRoute()

const { locale } = useI18n({
  useScope: 'global',
})

watch(
  () => route.params.lang,
  (lang) => {
    locale.value = lang === 'km' ? 'km' : 'en'
    document.documentElement.lang = locale.value
  },
  { immediate: true },
)
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}
</script>
