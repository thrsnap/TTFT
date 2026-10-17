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

const email = computed(
  () => auth.user?.email || '—',
)

const initial = computed(
  () => username.value.slice(0, 1).toUpperCase(),
)

const dashboardLink = computed(() => ({
  name: 'dashboard',
  params: route.params.lang === 'km' ? { lang: 'km' } : {},
}))

function close() {
  open.value = false
}

function toggle() {
  error.value = ''
  open.value = !open.value
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

  const params = route.params.lang === 'km'
    ? { lang: 'km' }
    : {}

  try {
    await auth.logout()
  } catch (failure) {
    error.value =
      failure?.message || 'Unable to log out. Please try again.'

    busy.value = false
    return
  }

  close()

  try {
    await router.replace({
      name: 'home',
      params,
    })
  } catch (failure) {
    console.error('Navigation after logout failed:', failure)
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
    class="relative shrink-0 text-white"
  >
    <button
      ref="trigger"
      type="button"
      :aria-expanded="open"
      :aria-label="open ? 'Close account menu' : 'Open account menu'"
      aria-controls="user-account-dropdown"
      class="flex size-10 shrink-0 cursor-pointer
             items-center justify-center rounded-full
             border border-emerald-700 bg-emerald-950
             text-base font-semibold text-emerald-400
             transition-colors hover:border-emerald-500
             focus-visible:outline-2
             focus-visible:outline-offset-2
             focus-visible:outline-emerald-400
             max-[768px]:size-8 max-[768px]:text-sm
             max-[320px]:size-7 max-[320px]:text-xs"
      @click="toggle"
    >
      {{ initial }}
    </button>

    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="-translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-100"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        id="user-account-dropdown"
        class="absolute right-0 top-full z-[70] mt-3 w-64
               max-w-[calc(100vw-24px)] overflow-hidden
               rounded-2xl border border-white/10
               bg-slate-900 text-white shadow-2xl"
      >
        <!-- Username and email -->
        <div class="border-b border-white/10 px-4 py-4">
          <p class="break-words text-sm font-semibold text-white">
            {{ username }}
          </p>

          <p class="mt-1 break-all text-xs leading-5 text-slate-400">
            {{ email }}
          </p>
        </div>

        <!-- Dashboard -->
        <nav aria-label="Your account" class="p-2">
          <RouterLink
            :to="dashboardLink"
            class="block rounded-lg px-3 py-2.5
                   text-sm font-medium transition-colors
                   hover:bg-white/10
                   focus-visible:outline-2
                   focus-visible:outline-emerald-400"
            @click="close"
          >
            My Dashboard
          </RouterLink>
        </nav>

        <!-- Logout -->
        <div class="border-t border-white/10 p-2">
          <button
            type="button"
            :disabled="busy"
            class="w-full cursor-pointer rounded-lg px-3 py-2.5
                   text-left text-sm font-medium text-red-300
                   transition-colors hover:bg-red-500/10
                   focus-visible:outline-2
                   focus-visible:outline-red-400
                   disabled:cursor-wait disabled:opacity-50"
            @click="logout"
          >
            {{ busy ? 'Logging out…' : 'Logout' }}
          </button>

          <p
            v-if="error"
            role="alert"
            class="px-3 pb-2 text-xs leading-5 text-red-300"
          >
            {{ error }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>