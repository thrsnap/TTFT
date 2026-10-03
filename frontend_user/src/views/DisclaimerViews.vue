<template>
  <main
    class="min-h-screen bg-black px-10 py-8 text-white
      max-[1024px]:px-8
      max-[991px]:px-6
      max-[768px]:px-5 max-[768px]:py-7
      max-[600px]:px-4 max-[600px]:py-6
      max-[480px]:px-3 max-[480px]:py-5
      max-[414px]:px-2.5
      max-[320px]:px-2 max-[320px]:py-4"
    :class="language === 'km' ? 'font-khmer' : 'font-sans'"
  >
    <div class="mx-auto w-full min-w-0 max-w-6xl">
      <h2
        class="mx-auto mb-8 w-fit max-w-full
          break-words rounded-xl border-[3px] border-[#ff4d4d]
          bg-[rgba(255,77,77,0.1)] px-4 py-3
          text-center text-[2.5rem] font-bold leading-[1.6]
          text-red-400 shadow-[0_0_15px_rgba(255,77,77,0.4)]
          max-[1024px]:text-[2.2rem]
          max-[991px]:text-[2rem]
          max-[768px]:mb-7 max-[768px]:text-[1.8rem]
          max-[600px]:mb-6 max-[600px]:text-[1.5rem]
          max-[480px]:px-3 max-[480px]:py-2.5
          max-[480px]:text-[1.3rem]
          max-[414px]:text-[1.15rem]
          max-[320px]:mb-5 max-[320px]:px-2
          max-[320px]:text-[1rem]"
      >
        {{ t('disclaimer.title') }}
      </h2>

      <div
        class="space-y-8
          max-[768px]:space-y-7
          max-[600px]:space-y-6
          max-[480px]:space-y-5
          max-[320px]:space-y-4"
      >
        <p
          class="rounded-xl border-l-[5px] border-[#38bdf8]
            bg-black p-6 text-[1.1rem] leading-[1.9]
            break-words shadow-[0_4px_12px_rgba(0,0,0,0.3)]
            max-[768px]:p-5 max-[768px]:text-base
            max-[600px]:p-4
            max-[480px]:p-3.5 max-[480px]:text-[0.95rem]
            max-[414px]:p-3
            max-[320px]:p-2.5 max-[320px]:text-[0.875rem]"
        >
          {{ t('disclaimer.intro') }}
        </p>

        <div
          class="space-y-5 rounded-xl border-l-[5px] border-[#23b000]
            bg-black p-6 text-[1.1rem] leading-[1.9]
            break-words shadow-[0_4px_12px_rgba(0,0,0,0.3)]
            max-[768px]:p-5 max-[768px]:text-base
            max-[600px]:p-4
            max-[480px]:space-y-4 max-[480px]:p-3.5
            max-[480px]:text-[0.95rem]
            max-[414px]:p-3
            max-[320px]:p-2.5 max-[320px]:text-[0.875rem]"
        >
          <p>{{ t('disclaimer.hypothetical') }}</p>
          <p>{{ t('disclaimer.futuresOptions') }}</p>
          <p>{{ t('disclaimer.advice') }}</p>
          <p>{{ t('disclaimer.lossRisk') }}</p>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t, locale: language } = useI18n({
  useScope: 'global',
})
</script>