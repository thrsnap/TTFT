<template>
  <div
    class="flex flex-col items-center justify-center gap-8 p-24
           max-[768px]:gap-7 max-[768px]:px-10 max-[768px]:py-14
           max-[600px]:gap-6 max-[600px]:px-6 max-[600px]:py-10
           max-[480px]:gap-5 max-[480px]:px-4 max-[480px]:py-8
           max-[414px]:gap-4 max-[414px]:px-3 max-[414px]:py-6
           max-[320px]:gap-3 max-[320px]:px-2 max-[320px]:py-5"
  >
    <h2
      class="mb-12 text-center text-[2.5rem]
             max-[768px]:mb-8 max-[768px]:text-[2.25rem]
             max-[600px]:mb-6 max-[600px]:text-[2rem]
             max-[480px]:mb-4 max-[480px]:text-[1.75rem]
             max-[414px]:mb-3 max-[414px]:text-[1.5rem]
             max-[320px]:mb-2 max-[320px]:text-[1.3rem]"
    >
      About Me
    </h2>

    <!-- Profile photo -->
    <div
      class="relative flex h-80 w-[20rem] max-w-full
             items-center justify-center rounded-[50%]
             max-[768px]:h-72 max-[768px]:w-72
             max-[600px]:h-64 max-[600px]:w-64
             max-[480px]:h-56 max-[480px]:w-56
             max-[414px]:h-48 max-[414px]:w-48
             max-[320px]:h-40 max-[320px]:w-40"
    >
      <img
        class="h-75 w-75 rounded-[50%] object-cover
               border-(--dark) shadow-[0_0_20px_rgba(0,0,0,0.3)]
               max-[768px]:h-68 max-[768px]:w-68
               max-[600px]:h-60 max-[600px]:w-60
               max-[480px]:h-52 max-[480px]:w-52
               max-[414px]:h-44 max-[414px]:w-44
               max-[320px]:h-36 max-[320px]:w-36"
        src="../assets/static/profile/aboutme.JPG"
        alt="profile"
      />
      <span class="text-(--secondary)"></span>
    </div>

    <!-- About content -->
    <div class="w-full min-w-0 text-center">
      <h3
        class="text-[2rem] font-['Roboto_Mono',monospace]
               max-[768px]:text-[1.8rem]
               max-[600px]:text-[1.6rem]
               max-[480px]:text-[1.4rem]
               max-[414px]:text-[1.25rem]
               max-[320px]:text-[1.1rem]"
      >
        Independent Trader
      </h3>

      <p
        class="mx-0 mt-4 mb-8 text-[1rem] leading-7
               max-[768px]:text-[15px]
               max-[600px]:mb-6 max-[600px]:text-sm
               max-[480px]:mt-3 max-[480px]:mb-5 max-[480px]:leading-6
               max-[414px]:text-[13px]
               max-[320px]:mt-2 max-[320px]:mb-4
               max-[320px]:text-xs max-[320px]:leading-5"
      >
        I'm Thun Tula, with 6 years of experience in the Forex trading industry.
        <br class="max-[768px]:hidden" />
        Currently, I trade independently and am the creator of Creator Of
        Money Mentorship,
        <br class="max-[768px]:hidden" />
        where I share trading knowledge and help others build confidence
        and skills in the financial markets.
      </p>

      <strong
        class="mt-2.5 inline-block w-0 overflow-hidden
               whitespace-nowrap border-r-2 border-solid border-white
               text-[1.7rem]
               animate-[student_10s_steps(30)_infinite,blink_0.7s_step-end_infinite]
               max-[768px]:w-auto max-[768px]:max-w-full
               max-[768px]:animate-none max-[768px]:whitespace-normal
               max-[768px]:border-r-0 max-[768px]:text-[1.5rem]
               max-[600px]:text-[1.3rem]
               max-[480px]:text-[1.1rem]
               max-[414px]:text-base
               max-[320px]:text-sm"
      >
        I am a student of The Inner circle Trader!
        <FontAwesomeIcon :icon="faCircleCheck" class="text-blue-500" />
      </strong>

      <br />
    </div>

    <!-- Audio -->
    <audio
      controls
      class="max-w-full
             max-[768px]:w-80
             max-[600px]:w-72
             max-[480px]:w-64
             max-[414px]:w-60
             max-[320px]:w-full"
    >
      <source
        src="../assets/static/voice/ICTvoice.mp3"
        type="audio/mpeg"
      />
    </audio>

    <br /><br />
  </div>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons'
</script>