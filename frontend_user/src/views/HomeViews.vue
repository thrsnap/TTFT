<template>
  <!-- The existing navbar is above this page. Hide the whole banner offline. -->
  <YouTubeLiveBanner />

  <div class="flex items-center justify-center py-10 px-1 pt-5 bg-[linear-gradient(rgba(5,15,40,0.7),rgba(5,15,40,0.7))]">
    <herosection />
  </div>

  <div class="py-10 px-5 text-(--dark) text-center transition-(--transition)">
    <community />
    <div class="py-19 px-5 text-(--ligh) items-center transition-(--transition) max-[480px]:py-5">
      <meeting />
    </div>
    <div class="py-1 px-5 text-(--dark) items-center transition-(--transition)">
      <partner />
    </div>
    <div class="text-(--dark) items-center transition-(--transition) max-[480px]:py-1">
      <Challenge />
    </div>
  </div>
</template>

<script setup>
import YouTubeLiveBanner from '../components/YouTubeLiveBanner.vue'
import herosection from '../components/herosection.vue'
import community from '../components/community.vue'
import partner from '../components/partner.vue'
import Challenge from '../components/challenge.vue'
import meeting from '../components/meeting.vue'
</script>
