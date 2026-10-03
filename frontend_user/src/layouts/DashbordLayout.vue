<template>
  <div class="min-h-screen bg-slate-950 text-white md:flex">
    <aside
      class="border-b border-slate-800 bg-slate-900 p-5
             md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r"
    >
      <RouterLink to="/" class="text-xl font-bold">
        CMM-FT
      </RouterLink>

      <nav class="mt-6 flex flex-col gap-2">
        <RouterLink
          to="/dashboard"
          exact-active-class="bg-indigo-600"
          class="rounded-lg px-4 py-3 hover:bg-indigo-500/30"
        >
          Overview
        </RouterLink>

        <RouterLink
          to="/dashboard/profile"
          exact-active-class="bg-indigo-600"
          class="rounded-lg px-4 py-3 hover:bg-indigo-500/30"
        >
          My profile
        </RouterLink>

        <RouterLink
          to="/"
          class="rounded-lg px-4 py-3 hover:bg-indigo-500/30"
        >
          Back to website
        </RouterLink>
      </nav>
    </aside>

    <main class="min-w-0 flex-1 p-5 sm:p-8">
      <RouterView />
    </main>
  </div>
</template>