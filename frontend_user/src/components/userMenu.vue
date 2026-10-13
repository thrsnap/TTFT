<script setup>
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/user/authStore.js'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const root = ref(null)
const trigger = ref(null)
const open = ref(false)
const busy = ref(false)
const error = ref('')

const username = computed(
  () => auth.user?.username || 'My account',
)

const initial = computed(
  () => username.value.slice(0, 1).toUpperCase(),
)

const profileLink = computed(() => ({
  name: 'profile',
  params: route.params.lang === 'km' ? { lang: 'km' } : {},
}))

const dashboardLink = computed(() => ({
  name: 'dashboard',
  params: route.params.lang === 'km' ? { lang: 'km' } : {},
}))

function close() {
  open.value = false
}

function outside(event) {
  if (root.value && !root.value.contains(event.target)) {
    close()
  }
}

function escape(event) {
  if (event.key === 'Escape' && open.value) {
    close()
    trigger.value?.focus()
  }
}

async function logout() {
  if (busy.value) return

  busy.value = true
  error.value = ''

  try {
    await auth.logout()
    close()

    await router.replace({
      name: 'home',
      params: route.params.lang === 'km' ? { lang: 'km' } : {},
    })
  } catch (failure) {
    error.value =
      failure.message || 'Unable to log out. Please try again.'
  } finally {
    busy.value = false
  }
}

watch(() => route.fullPath, close)
watch(() => auth.isAuthenticated, close)

onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
})
</script>

<template>
  <div
    v-if="auth.isAuthenticated"
    ref="root"
    class="relative text-white"
  >
    <button
      ref="trigger"
      type="button"
      :aria-expanded="open"
      :aria-label="open ? 'Close account menu' : 'Open account menu'"
      aria-controls="user-account-dropdown"
      class="flex cursor-pointer items-center gap-2 rounded-full
             border border-white/15 bg-white/10 p-1.5
             transition hover:bg-white/20
             focus-visible:outline-2
             focus-visible:outline-offset-2
             focus-visible:outline-emerald-400
             min-[1024px]:pr-3"
      @click="open = !open"
    >
      <span
        aria-hidden="true"
        class="flex size-9 shrink-0 items-center justify-center
               rounded-full border border-emerald-700
               bg-emerald-950 text-sm font-semibold
               text-emerald-400 max-[320px]:size-7"
      >
        {{ initial }}
      </span>

      <span
        class="hidden max-w-28 truncate text-sm font-semibold
               min-[1024px]:block"
      >
        {{ username }}
      </span>

      <svg
        class="hidden h-4 w-4 transition-transform min-[1024px]:block"
        :class="{ 'rotate-180': open }"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m5 7 5 5 5-5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-100"
      leave-to-class="translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        id="user-account-dropdown"
        class="absolute right-0 top-full z-[70] mt-3 w-64
               max-w-[calc(100vw-24px)] overflow-hidden
               rounded-2xl border border-white/10
               bg-slate-900 text-white shadow-2xl"
      >
        <div class="border-b border-white/10 px-4 py-4">
          <p class="truncate font-semibold">
            {{ username }}
          </p>

          <p class="mt-1 truncate text-xs text-slate-400">
            {{ auth.user?.email }}
          </p>

          <span
            v-if="auth.user?.emailVerified"
            class="mt-2 inline-block rounded-full bg-emerald-500/10
                   px-2 py-1 text-xs text-emerald-300"
          >
            Email verified
          </span>
        </div>

        <nav aria-label="Your account" class="space-y-1 p-2">
          <RouterLink
            :to="profileLink"
            class="block rounded-lg px-3 py-2.5 text-sm
                   hover:bg-white/10"
            @click="close"
          >
            My profile
          </RouterLink>

          <RouterLink
            :to="dashboardLink"
            class="block rounded-lg px-3 py-2.5 text-sm
                   hover:bg-white/10"
            @click="close"
          >
            My dashboard
          </RouterLink>
        </nav>

        <div class="border-t border-white/10 p-2">
          <button
            type="button"
            :disabled="busy"
            class="w-full cursor-pointer rounded-lg px-3 py-2.5
                   text-left text-sm text-red-300
                   hover:bg-red-500/10 disabled:opacity-50"
            @click="logout"
          >
            {{ busy ? 'Logging out…' : 'Logout' }}
          </button>

          <p
            v-if="error"
            role="alert"
            class="px-3 pb-2 text-xs text-red-300"
          >
            {{ error }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>