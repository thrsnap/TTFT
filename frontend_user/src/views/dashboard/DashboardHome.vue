<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../../store/user/authStore.js'
import { api } from '../../api/autService.js'

const auth = useAuthStore()
const message = ref('Loading dashboard…')
const error = ref('')

onMounted(async () => {
  try {
    const data = await api('/dashboard')
    message.value = data.message
  } catch (failure) {
    message.value = ''
    error.value = failure.message
  }
})
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-12">
    <h1 class="text-3xl font-bold">My dashboard</h1>
    <p class="mt-3" role="status">{{ message }}</p>
    <p v-if="error" role="alert" class="mt-3 text-red-500">{{ error }}</p>

    <div class="mt-8 grid gap-5 sm:grid-cols-2">
      <article class="rounded-xl border border-slate-500 p-6">
        <h2 class="text-xl font-semibold">My profile</h2>
        <p class="mt-4">Username: {{ auth.user?.username }}</p>
        <p class="mt-2 break-all">Email: {{ auth.user?.email }}</p>
      </article>

      <article class="rounded-xl border border-slate-500 p-6">
        <h2 class="text-xl font-semibold">Account status</h2>
        <p class="mt-4 text-emerald-500">Email verified</p>
      </article>
    </div>
  </section>
</template>