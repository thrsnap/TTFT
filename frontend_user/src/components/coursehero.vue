<template>
  
  <!-- Background image -->
  <img
  src="../assets/static/coursecard/liveclass.jpg"
  alt=""
  class="absolute inset-0 -z-20 h-full w-full
         object-cover object-center blur-[4px] scale-105"
/>

  <!-- Dark overlay -->
  <div class="absolute inset-0 -z-10 bg-black/60"></div>

  <!-- Content -->
  <div
    class="mx-auto max-w-3xl
           max-[768px]:w-full max-[768px]:px-6
           max-[600px]:px-5
           max-[480px]:px-4
           max-[414px]:px-3
           max-[320px]:px-2"
  >
    <h1
      class="text-4xl font-extrabold leading-tight text-white
             sm:text-5xl lg:text-6xl
             max-[768px]:text-[2rem]
             max-[600px]:text-[2rem]
             max-[480px]:text-[1.5rem]
             max-[414px]:text-[1.2rem]
             max-[320px]:text-[1.1rem]"
    >
      ICT Live Class
    </h1>

    <p
      class="mx-auto mt-5 max-w-xl text-base leading-relaxed
             text-gray-200 sm:text-lg
             max-[768px]:text-base
             max-[600px]:mt-4 max-[600px]:text-[15px]
             max-[480px]:mt-3 max-[480px]:text-sm
             max-[414px]:text-[13px]
             max-[320px]:text-xs"
    >
      Explore practical lessons and start your learning journey with us.
    </p>

    <RouterLink
      to="/login"
      class="mt-8 inline-flex items-center justify-center
             rounded-xl bg-emerald-100 px-7 py-3 font-semibold
             text-slate-950 transition duration-300
             hover:-translate-y-1 hover:bg-emerald-400
             focus-visible:outline-2 focus-visible:outline-offset-4
             focus-visible:outline-white
             max-[768px]:mt-7 max-[768px]:px-6 max-[768px]:text-base
             max-[600px]:mt-6 max-[600px]:px-5 max-[600px]:text-sm
             max-[480px]:mt-5 max-[480px]:py-2.5
             max-[414px]:px-4 max-[414px]:text-[13px]
             max-[320px]:mt-4 max-[320px]:px-3 max-[320px]:text-xs"
    >
      Rister Now->
    </RouterLink>
  </div>

  <!-- Bottom fade -->
  <div
    class="pointer-events-none absolute inset-x-0 bottom-0 -z-10
           h-40 bg-[linear-gradient(to_bottom,transparent,#131e30)]
           max-[768px]:h-32
           max-[600px]:h-28
           max-[480px]:h-24
           max-[414px]:h-20
           max-[320px]:h-16"
  ></div>
</template>