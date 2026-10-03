<template>
  <div
    class="hero-container max-w-300 grid items-center grid-cols-2 gap-1 max-[1024px]:grid-cols-1"
  >
    <div class="hero-content text-center">
      <h1
        class="text-[2rem] font-extrabold mb-5 bg-[linear-gradient(135deg,#6366f1,#10b981)] bg-clip-text text-transparent max-[480px]:text-[1.5rem] max-[320px]:text-[1rem] max-[768px]:text-[2.2rem] max-[600px]:text-[1.5rem] max-[991px]:text-[1rem] max-[1024px]:text-[3rem]" :class="{ 'font-khmer': locale === 'km' }">
        {{ t('hero.title') }}
      </h1>

      <h2
        class="bg-red-700 inline-block animate-[opacity_8s_infinite] max-[320px]:text-[0.5rem] max-[480px]:text-[0.7rem]" :class="{ 'font-khmer': locale === 'km' }"
      >
        {{ t('hero.riskTitle') }}
      </h2>

      <p
        class="text-[1.2rem] text-(--gray) leading-[1.6] animate-[fadeIn_7s_ease-in-out] max-[480px]:text-[1rem] max-[1024px]:hidden" :class="{ 'font-khmer': locale === 'km' }"
      >
        {{ t('hero.notAdvisor') }}
        <br>
        {{ t('hero.notAdvice') }}
        <br>
        {{ t('hero.purpose') }}
        {{ t('hero.research') }}
        {{ t('hero.risk') }}
        {{ t('hero.loss') }}
        <br>
        <strong>{{ t('hero.study') }}</strong>
      </p>

      <br>

      <RouterLink
        class="mt-1 inline-flex items-center gap-2 rounded-(--radius) bg-gray-600 px-5 py-3 text-[1.1rem] font-semibold text-white no-underline transition duration-300 hover:-translate-y-1 hover:bg-gray-600 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)] max-[480px]:text-[0.6rem] max-[320px]:text-[0.5rem] max-[768px]:text-[0.7rem] max-[600px]:text-[0.4rem] max-[991px]:text-[1rem]"
        to="/disclaimer" :class="{ 'font-khmer': locale === 'km' }"
      >
        {{ t('hero.readMore') }}
        <span aria-hidden="true">→</span>
      </RouterLink>
    </div>

    <div class="relative w-full overflow-hidden rounded-2xl">
      <video
        ref="heroVideo"
        class="block h-90 w-full object-cover rounded-xl mt-4 max-[480px]:h-55 max-[480px]:w-full max-[320px]:h-30 max-[320px]:w-full max-[414px]:h-50 max-[414px]:w-full max-[768px]:w-full max-[768px]:h-70 max-[991px]:w-full"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @volumechange="isMuted = heroVideo?.muted ?? true"
      >
        <source
          src="../assets/static/video/herovideo.mp4"
          type="video/mp4"
        >
        {{ t('hero.videoUnsupported') }}
      </video>

      <!-- Video controls -->
      <div class="absolute bottom-5 right-5 flex gap-3">
        <button
          type="button"
          class="rounded-full border border-white/30 bg-black/60 px-5 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-black/80 cursor-pointer"
          :aria-label="isPlaying ? t('hero.pauseVideo') : t('hero.playVideo')" :class="{ 'font-khmer': locale === 'km' }"
          @click="togglePlay"
        >
          <span aria-hidden="true">{{ isPlaying ? '❚❚' : '▶' }}</span>
          {{ isPlaying ? t('hero.pause') : t('hero.play') }}
        </button>

        <button
          type="button"
          class="rounded-full border border-white/30 bg-black/60 px-5 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-black/80 cursor-pointer"
          :aria-label="isMuted ? t('hero.unmuteVideo') : t('hero.muteVideo')" :class="{ 'font-khmer': locale === 'km' }"
          @click="toggleMute"
        >
          <span aria-hidden="true">{{ isMuted ? '🔇' : '🔊' }}</span>
          {{ isMuted ? t('hero.unmute') : t('hero.mute') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n({
  useScope: 'global',
})

const heroVideo = ref(null)
const isPlaying = ref(false)
const isMuted = ref(true)

async function togglePlay() {
  const video = heroVideo.value
  if (!video) return

  if (video.paused) {
    try {
      await video.play()
    } catch {
      isPlaying.value = false
    }
  } else {
    video.pause()
  }
}

function toggleMute() {
  const video = heroVideo.value
  if (!video) return

  video.muted = !video.muted
  isMuted.value = video.muted
}
</script>