<template>

    <h2  class="text-[2rem] font-bold mb-2.5 bg-[linear-gradient(135deg,#6366f1,#10b981)] bg-clip-text text-transparent max-[480px]:text-[1.3rem] max-[414px]:text-[1.2rem]" :class="{ 'font-khmer': language === 'km' }">{{ t('meeting.title') }}</h2>
    
<div class="py-5">
    <div
    class="w-full overflow-hidden
           mask-[linear-gradient(to_right,transparent,black,transparent)]
           transition duration-300 hover:grayscale-[0.8]
           blur-[0.5px] cursor-pointer"
  >
    <div
      class="flex w-max will-change-transform
             animate-[scrolled_200s_linear_infinite]
             hover:[animation-play-state:paused]

             max-[768px]:[&>div]:h-44
             max-[768px]:[&>div]:mr-3
             max-[768px]:[&>.w-80]:w-70
             max-[768px]:[&>.w-60]:w-52

             max-[600px]:[&>div]:h-38
             max-[600px]:[&>div]:mr-2.5
             max-[600px]:[&>.w-80]:w-60
             max-[600px]:[&>.w-60]:w-45

             max-[480px]:[&>div]:h-32
             max-[480px]:[&>div]:mr-2
             max-[480px]:[&>.w-80]:w-50
             max-[480px]:[&>.w-60]:w-38

             max-[414px]:[&>div]:h-28
             max-[414px]:[&>div]:mr-1.5
             max-[414px]:[&>.w-80]:w-45
             max-[414px]:[&>.w-60]:w-34

             max-[320px]:[&>div]:h-24
             max-[320px]:[&>div]:mr-1
             max-[320px]:[&>.w-80]:w-38
             max-[320px]:[&>.w-60]:w-28"
    >
      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even1.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even2.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even3.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even4.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even5.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even6.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even7.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even8.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even9.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even10.jpg"
        />
      </div>

      <!-- Duplicate images -->
      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even1.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even2.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even3.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even4.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even5.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even6.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even7.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even8.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even9.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even10.jpg"
        />
      </div>
    </div>
  </div>

  <!-- Second row: reverse -->
  <div
    class="w-full overflow-hidden
           mask-[linear-gradient(to_right,transparent,black,transparent)]
           transition duration-300 hover:grayscale-[0.8]
           blur-[0.5px] cursor-pointer"
  >
    <div
      class="flex w-max will-change-transform
             animate-[scrolled_200s_linear_infinite_reverse]
             hover:[animation-play-state:paused] py-3

             max-[768px]:[&>div]:h-44
             max-[768px]:[&>div]:mr-3
             max-[768px]:[&>.w-80]:w-70
             max-[768px]:[&>.w-60]:w-52

             max-[600px]:[&>div]:h-38
             max-[600px]:[&>div]:mr-2.5
             max-[600px]:[&>.w-80]:w-60
             max-[600px]:[&>.w-60]:w-45

             max-[480px]:[&>div]:h-32
             max-[480px]:[&>div]:mr-2
             max-[480px]:[&>.w-80]:w-50
             max-[480px]:[&>.w-60]:w-38

             max-[414px]:[&>div]:h-28
             max-[414px]:[&>div]:mr-1.5
             max-[414px]:[&>.w-80]:w-45
             max-[414px]:[&>.w-60]:w-34

             max-[320px]:[&>div]:h-24
             max-[320px]:[&>div]:mr-1
             max-[320px]:[&>.w-80]:w-38
             max-[320px]:[&>.w-60]:w-28"
    >
      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even10.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even9.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even8.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even7.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even6.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even5.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even4.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even3.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even2.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even1.jpg"
        />
      </div>

      <!-- Duplicate images -->
      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even10.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even9.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even8.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even7.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even6.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even5.jpg"
        />
      </div>

      <div class="w-80 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even4.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even3.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even2.jpg"
        />
      </div>

      <div class="w-60 h-50 shrink-0 rounded-[15px] mr-3.75 overflow-hidden">
        <img
          class="w-full h-full object-cover block transition-all duration-300 hover:grayscale-0 hover:scale-[1.06]"
          src="../assets/static/meeting/even1.jpg"
        />
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t, locale: language } = useI18n({
  useScope: 'global',
})

</script>