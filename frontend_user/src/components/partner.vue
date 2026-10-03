<template>

    <h2  class="text-[2rem] font-bold mb-2.5 bg-[linear-gradient(135deg,#6366f1,#10b981)] bg-clip-text text-transparent max-[480px]:text-[1.5rem]" :class="{ 'font-khmer': language === 'km' }">{{ t('partner.title') }}</h2>
        <h2 class="text-3xl font-bold max-[480px]:text-[1.2rem]" :class="{ 'font-khmer': language === 'km' }">
          {{ t('partner.thebest') }}
        </h2>  

        
  <section
  class="px-5 py-10 text-white
         max-[768px]:px-4
         max-[600px]:py-8
         max-[480px]:px-3
         max-[414px]:px-2
         max-[320px]:px-1"
>
  <div
    class="mx-auto grid max-w-6xl grid-cols-3 gap-8
           max-[768px]:gap-6
           max-[600px]:gap-4
           max-[480px]:gap-3
           max-[414px]:gap-2
           max-[320px]:gap-1"
  >
    <!-- Exness -->
    <div class="flex min-w-0 flex-col items-center text-center">
      <img
        src="../assets/static/broker/exness_icon.png"
        alt="Exness logo"
        class="aspect-square h-auto w-32 max-w-full rounded-2xl object-contain
               max-[768px]:w-28
               max-[600px]:w-24
               max-[480px]:w-20 max-[480px]:rounded-xl
               max-[414px]:w-18
               max-[320px]:w-15 max-[320px]:rounded-lg"
      />

      <p
        class="mt-6 text-base leading-normal text-slate-400
               max-[768px]:mt-5 max-[768px]:text-[15px]
               max-[600px]:mt-4 max-[600px]:text-sm
               max-[480px]:mt-3 max-[480px]:text-[13px]
               max-[414px]:text-xs
               max-[320px]:mt-2 max-[320px]:text-[11px]"
      >
        EXNESS
      </p>

      <RouterLink
        to="/collaborate"
        class="mt-6 inline-flex max-w-full items-center justify-center
               whitespace-nowrap rounded-full bg-indigo-600
               px-6 py-2.5 text-sm font-semibold text-white
               transition-colors hover:bg-indigo-500
               focus-visible:outline-2 focus-visible:outline-offset-4
               focus-visible:outline-indigo-400
               max-[768px]:mt-5 max-[768px]:px-4 max-[768px]:text-[13px]
               max-[600px]:mt-4 max-[600px]:px-3 max-[600px]:text-xs
               max-[480px]:mt-3 max-[480px]:px-2.5 max-[480px]:text-[11px]
               max-[414px]:px-2
               max-[320px]:mt-2 max-[320px]:px-1.5 max-[320px]:text-[10px]" :class="{ 'font-khmer': language === 'km' }"
      >
        {{ t('partner.more') }} 
      </RouterLink>
    </div>

    <!-- CXM -->
    <div class="flex min-w-0 flex-col items-center text-center">
      <img
        src="../assets/static/broker/exm.png"
        alt="CXM logo"
        class="aspect-square h-auto w-32 max-w-full rounded-2xl
               bg-amber-50 object-contain
               max-[768px]:w-28
               max-[600px]:w-24
               max-[480px]:w-20 max-[480px]:rounded-xl
               max-[414px]:w-18
               max-[320px]:w-15 max-[320px]:rounded-lg"
      />

      <p
        class="mt-6 text-base leading-normal text-slate-400
               max-[768px]:mt-5 max-[768px]:text-[15px]
               max-[600px]:mt-4 max-[600px]:text-sm
               max-[480px]:mt-3 max-[480px]:text-[13px]
               max-[414px]:text-xs
               max-[320px]:mt-2 max-[320px]:text-[11px]"
      >
        CXM DIRECT
      </p>

      <RouterLink
        to="/collaborate"
        class="mt-6 inline-flex max-w-full items-center justify-center
               whitespace-nowrap rounded-full bg-indigo-600
               px-6 py-2.5 text-sm font-semibold text-white
               transition-colors hover:bg-indigo-500
               focus-visible:outline-2 focus-visible:outline-offset-4
               focus-visible:outline-indigo-400
               max-[768px]:mt-5 max-[768px]:px-4 max-[768px]:text-[13px]
               max-[600px]:mt-4 max-[600px]:px-3 max-[600px]:text-xs
               max-[480px]:mt-3 max-[480px]:px-2.5 max-[480px]:text-[11px]
               max-[414px]:px-2
               max-[320px]:mt-2 max-[320px]:px-1.5 max-[320px]:text-[10px]" :class="{ 'font-khmer': language === 'km' }"
      >
        {{ t('partner.more') }}
      </RouterLink>
    </div>

    <!-- Lirunex -->
    <div class="flex min-w-0 flex-col items-center text-center">
      <img
        src="../assets/static/broker/lerunex.png"
        alt="Lirunex logo"
        class="aspect-square h-auto w-32 max-w-full rounded-2xl object-contain
               max-[768px]:w-28
               max-[600px]:w-24
               max-[480px]:w-20 max-[480px]:rounded-xl
               max-[414px]:w-18
               max-[320px]:w-15 max-[320px]:rounded-lg"
      />

      <p
        class="mt-6 text-base leading-normal text-slate-400
               max-[768px]:mt-5 max-[768px]:text-[15px]
               max-[600px]:mt-4 max-[600px]:text-sm
               max-[480px]:mt-3 max-[480px]:text-[13px]
               max-[414px]:text-xs
               max-[320px]:mt-2 max-[320px]:text-[11px]"
      >
        LIRUNEX
      </p>

      <RouterLink
        to="/collaborate"
        class="mt-6 inline-flex max-w-full items-center justify-center
               whitespace-nowrap rounded-full bg-indigo-600
               px-6 py-2.5 text-sm font-semibold text-white
               transition-colors hover:bg-indigo-500
               focus-visible:outline-2 focus-visible:outline-offset-4
               focus-visible:outline-indigo-400
               max-[768px]:mt-5 max-[768px]:px-4 max-[768px]:text-[13px]
               max-[600px]:mt-4 max-[600px]:px-3 max-[600px]:text-xs
               max-[480px]:mt-3 max-[480px]:px-2.5 max-[480px]:text-[11px]
               max-[414px]:px-2
               max-[320px]:mt-2 max-[320px]:px-1.5 max-[320px]:text-[10px] " :class="{ 'font-khmer': language === 'km' }"
      >
        {{ t('partner.more') }}
      </RouterLink>
    </div>
  </div>
</section>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { text } from '@fortawesome/fontawesome-svg-core';

const { t, locale: language } = useI18n({
  useScope: 'global',
})
</script>