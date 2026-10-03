<template>
  <h2
    class="text-[2rem] font-bold mb-2.5
      bg-[linear-gradient(135deg,#6366f1,#10b981)]
      bg-clip-text text-transparent
      max-[480px]:text-[1.3rem] max-[414px]:text-[1.2rem]"
    :class="{ 'font-khmer': language === 'km' }"
  >
    {{ t('community.title') }}
  </h2>

  <div
    class="mx-auto grid max-w-300
      grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-6
      max-[768px]:grid-cols-6 max-[768px]:gap-4
      max-[600px]:gap-3
      max-[480px]:gap-2
      max-[414px]:gap-1.5
      max-[320px]:gap-1"
    :class="{ 'font-khmer': language === 'km' }"
  >
    <div
      v-for="(item, index) in communities"
      :key="item.name"
      :class="{
        'max-[768px]:col-start-2': index === 3,
        'max-[768px]:col-start-4': index === 4,
      }"
      class="min-w-0 cursor-pointer rounded-(--radius)
        border-2 border-solid border-transparent p-1 text-center
        max-[768px]:col-span-2
        in-[.ligh-mode]:text-(--dark)
        in-[.ligh-mode]:shadow-[0_8px_20px_rgba(0,0,0,0.08)]
        in-[.ligh-mode]:hover:[background:linear-gradient(#ffffff,#ffffff)_padding-box,var(--gradient)_border-box]
        transition-transform duration-300 ease-in-out
        hover:-translate-y-2"
    >
      <!-- Platform icon -->
      <div
        class="mb-4 text-[2rem]
          max-[768px]:text-[1.875rem]
          max-[600px]:mb-3 max-[600px]:text-[1.75rem]
          max-[480px]:mb-2 max-[480px]:text-[1.5rem]
          max-[414px]:text-[1.375rem]
          max-[320px]:mb-1.5 max-[320px]:text-[1.25rem]"
      >
        <FontAwesomeIcon
          :icon="item.icon"
          :style="{ color: item.iconColor }"
        />
      </div>

      <!-- Platform label -->
      <p
        class="mb-5 text-base leading-normal text-(--gray)
          [overflow-wrap:anywhere]
          max-[768px]:text-[15px]
          max-[600px]:mb-4 max-[600px]:text-[14px]
          max-[480px]:mb-3 max-[480px]:text-[13px]
          max-[414px]:mb-2 max-[414px]:text-[12px]
          max-[320px]:text-[11px]"
      >
        {{ t(item.label, { count: item.count }) }}
      </p>

      <!-- Platform link -->
      <a
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`${t(item.button)} — ${item.name}`"
        class="inline-block max-w-full py-2
          text-base font-semibold text-(--secondary)
          no-underline [overflow-wrap:anywhere]
          transition-colors duration-300
          hover:text-(--primary) hover:underline
          max-[768px]:text-[15px]
          max-[600px]:text-[14px]
          max-[480px]:text-[13px]
          max-[414px]:text-[12px]
          max-[320px]:text-[11px]"
      >
        {{ t(item.button) }}
        <span aria-hidden="true">→</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t, locale: language } = useI18n({
  useScope: 'global',
})

import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {communities} from '../store/communities/media'
</script>