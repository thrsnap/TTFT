<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../../store/user/authStore.js'
import { useProfilePhoto } from '../../composable/useProfilePhoto.js'

const auth = useAuthStore()
const route = useRoute()
const username = computed(() => auth.user?.username || 'Member')
const initial = computed(() => username.value.slice(0, 1).toUpperCase())
const email = computed(() => auth.user?.email || '—')
const showEmail = ref(false)
const verified = computed(() => Boolean(auth.user?.emailVerified))
const isAdmin = computed(() => auth.user?.role === 'admin')
const dashboardLink = computed(() => ({
  name: 'dashboard',
  params: route.params.lang === 'km' ? { lang: 'km' } : {},
}))
watch(email, () => { showEmail.value = false })

const {
  photoUrl: savedPhotoUrl,
  loading: photoLoading,
  error: photoLoadError,
  ownerKey: photoOwner,
  refreshPhoto,
  publishPhoto,
  clearPhoto,
} = useProfilePhoto()
const photoEndpoint = `${(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').trim().replace(/\/+$/, '')}/api/profile/photo`
const photoInput = ref(null)
const photoChecking = ref(false)
const photoSaving = ref(false)
const photoRemoving = ref(false)
const photoError = ref('')
const photoNotice = ref('')
const photoBusy = computed(() => photoChecking.value || photoSaving.value || photoRemoving.value)
const photoSrc = computed(() => savedPhotoUrl.value)
const displayedPhotoError = computed(() => photoError.value || photoLoadError.value)
let mutationController
let selectionId = 0
let disposed = false

const cropDialog = ref(null)
const cropViewport = ref(null)
const cropOpen = ref(false)
const cropSourceUrl = ref('')
const cropWidth = ref(0)
const cropHeight = ref(0)
const cropZoom = ref(1)
const cropX = ref(0)
const cropY = ref(0)
const cropDragging = ref(false)
const cropError = ref('')
const cropPercent = computed(() => Math.round(cropZoom.value * 100))
const cropImageStyle = computed(() => {
  const side = (Math.min(cropWidth.value, cropHeight.value) || 1) / cropZoom.value
  return {
    width: `${cropWidth.value / side * 100}%`,
    height: `${cropHeight.value / side * 100}%`,
    left: `${(0.5 + cropX.value) * 100}%`,
    top: `${(0.5 + cropY.value) * 100}%`,
    transform: 'translate(-50%, -50%)',
  }
})
let cropImage = null
let cropOwner = ''
let cropSession = 0
let gesture = null
const pointers = new Map()
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const currentOwner = owner => !disposed && Boolean(owner) && owner === photoOwner.value

function cropLimits() {
  const side = (Math.min(cropWidth.value, cropHeight.value) || 1) / cropZoom.value
  return {
    x: Math.max(0, (cropWidth.value / side - 1) / 2),
    y: Math.max(0, (cropHeight.value / side - 1) / 2),
  }
}

function positionCrop(x, y) {
  const limits = cropLimits()
  cropX.value = clamp(x, -limits.x, limits.x)
  cropY.value = clamp(y, -limits.y, limits.y)
}

function updateGesture() {
  const points = [...pointers.values()]
  cropDragging.value = points.length > 0
  if (points.length === 1) {
    gesture = { type: 'pan', point: points[0], x: cropX.value, y: cropY.value }
  } else if (points.length >= 2) {
    gesture = {
      type: 'pinch',
      center: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
      distance: Math.max(0.001, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
      zoom: cropZoom.value,
      x: cropX.value,
      y: cropY.value,
    }
  } else gesture = null
}

function clearPointers() {
  const ids = [...pointers.keys()]
  pointers.clear()
  gesture = null
  cropDragging.value = false
  for (const id of ids) {
    try {
      if (cropViewport.value?.hasPointerCapture(id)) cropViewport.value.releasePointerCapture(id)
    } catch { /* The browser may already have released a cancelled pointer. */ }
  }
}

function zoomCrop(value, anchor = { x: 0, y: 0 }) {
  if (photoBusy.value) return
  const next = clamp(Number(value), 1, 4)
  if (!Number.isFinite(next)) return
  const ratio = next / cropZoom.value
  const x = anchor.x - (anchor.x - cropX.value) * ratio
  const y = anchor.y - (anchor.y - cropY.value) * ratio
  cropZoom.value = next
  positionCrop(x, y)
  updateGesture()
}

function resetCrop() {
  if (photoSaving.value) return
  clearPointers()
  cropZoom.value = 1
  cropX.value = 0
  cropY.value = 0
}

function pointerPosition(event) {
  const bounds = cropViewport.value?.getBoundingClientRect()
  if (!bounds?.width || !bounds.height) return null
  return {
    x: (event.clientX - bounds.left) / bounds.width - 0.5,
    y: (event.clientY - bounds.top) / bounds.height - 0.5,
  }
}

function startCropPointer(event) {
  if (!cropOpen.value || photoBusy.value || pointers.size >= 2) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const point = pointerPosition(event)
  if (!point) return
  event.preventDefault()
  cropViewport.value?.focus({ preventScroll: true })
  cropViewport.value?.setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, point)
  updateGesture()
}

function moveCropPointer(event) {
  if (!pointers.has(event.pointerId) || !gesture || photoBusy.value) return
  const point = pointerPosition(event)
  if (!point) return
  pointers.set(event.pointerId, point)
  if (gesture.type === 'pan' && pointers.size === 1) {
    positionCrop(gesture.x + point.x - gesture.point.x, gesture.y + point.y - gesture.point.y)
  } else if (gesture.type === 'pinch' && pointers.size === 2) {
    const [first, second] = [...pointers.values()]
    const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
    const distance = Math.hypot(first.x - second.x, first.y - second.y)
    const zoom = clamp(gesture.zoom * distance / gesture.distance, 1, 4)
    cropZoom.value = zoom
    positionCrop(
      center.x - (gesture.center.x - gesture.x) * zoom / gesture.zoom,
      center.y - (gesture.center.y - gesture.y) * zoom / gesture.zoom,
    )
  }
}

function endCropPointer(event) {
  if (!pointers.has(event.pointerId)) return
  pointers.delete(event.pointerId)
  try {
    if (cropViewport.value?.hasPointerCapture(event.pointerId)) cropViewport.value.releasePointerCapture(event.pointerId)
  } catch { /* Pointer capture may already have ended. */ }
  updateGesture()
}

function wheelCrop(event) {
  const anchor = pointerPosition(event)
  if (anchor && !photoBusy.value) zoomCrop(cropZoom.value * Math.exp(-event.deltaY * 0.0015), anchor)
}

function keyboardCrop(event) {
  if (photoBusy.value) return
  const step = event.shiftKey ? 0.08 : 0.02
  if (event.key === 'ArrowLeft') positionCrop(cropX.value - step, cropY.value)
  else if (event.key === 'ArrowRight') positionCrop(cropX.value + step, cropY.value)
  else if (event.key === 'ArrowUp') positionCrop(cropX.value, cropY.value - step)
  else if (event.key === 'ArrowDown') positionCrop(cropX.value, cropY.value + step)
  else if (event.key === '+' || event.key === '=') zoomCrop(cropZoom.value + 0.1)
  else if (event.key === '-') zoomCrop(cropZoom.value - 0.1)
  else if (event.key === 'Home') resetCrop()
  else return
  event.preventDefault()
}

function closeCrop(force = false) {
  if (photoSaving.value && !force) return
  cropSession++
  if (cropDialog.value?.open) cropDialog.value.close()
  cropOpen.value = false
  clearPointers()
  cropImage = null
  cropOwner = ''
  const previous = cropSourceUrl.value
  cropSourceUrl.value = ''
  if (previous) URL.revokeObjectURL(previous)
  cropError.value = ''
}

function chooseProfilePhoto() {
  if (!photoBusy.value && !cropOpen.value) photoInput.value?.click()
}

async function selectProfilePhoto(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || photoBusy.value || cropOpen.value || !photoOwner.value) return
  photoError.value = ''
  photoNotice.value = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    photoError.value = 'Choose a JPG, PNG or WebP image.'
    return
  }
  if (!file.size || file.size > 2 * 1024 * 1024) {
    photoError.value = 'Choose a photo smaller than 2 MB.'
    return
  }

  const owner = photoOwner.value
  const selected = ++selectionId
  let candidate = URL.createObjectURL(file)
  photoChecking.value = true
  try {
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('This image could not be read. Choose another photo.'))
      image.src = candidate
    })
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 20_000_000) {
      throw new Error('Choose a photo up to 20 megapixels.')
    }
    if (!currentOwner(owner) || selected !== selectionId) return
    closeCrop(true)
    cropImage = image
    cropOwner = owner
    cropWidth.value = image.naturalWidth
    cropHeight.value = image.naturalHeight
    cropSourceUrl.value = candidate
    candidate = ''
    resetCrop()
    cropOpen.value = true
    const session = cropSession
    await nextTick()
    if (!currentOwner(owner) || selected !== selectionId || session !== cropSession) return
    if (!cropDialog.value) throw new Error('The photo editor could not be opened. Please try again.')
    cropDialog.value.showModal()
    cropViewport.value?.focus({ preventScroll: true })
  } catch (failure) {
    if (currentOwner(owner) && selected === selectionId) {
      closeCrop(true)
      photoError.value = failure.message
    }
  } finally {
    if (candidate) URL.revokeObjectURL(candidate)
    if (currentOwner(owner) && selected === selectionId) photoChecking.value = false
  }
}

function cropRectangle() {
  const side = Math.min(cropWidth.value, cropHeight.value) / cropZoom.value
  return {
    x: clamp((cropWidth.value - side) / 2 - cropX.value * side, 0, cropWidth.value - side),
    y: clamp((cropHeight.value - side) / 2 - cropY.value * side, 0, cropHeight.value - side),
    side,
  }
}

async function croppedPhotoBlob() {
  if (!cropImage) throw new Error('Choose a photo first.')
  const rectangle = cropRectangle()
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The photo could not be cropped. Please try again.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(cropImage, rectangle.x, rectangle.y, rectangle.side, rectangle.side, 0, 0, 512, 512)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) reject(new Error('The photo could not be cropped. Please choose another image.'))
      else if (blob.size > 2 * 1024 * 1024) reject(new Error('The cropped photo is too large. Please choose another image.'))
      else resolve(blob)
    }, 'image/webp', 0.9)
  })
}

async function requestPhoto(method, controller, body) {
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 45000)
  try {
    const response = await fetch(photoEndpoint, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'X-CMM-Request': '1' },
      ...(body ? { body } : {}),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      if (response.status === 401) throw new Error('Your session has expired. Please sign in again.')
      throw new Error(data?.message || 'Unable to update your profile photo. Please try again.')
    }
    if (method === 'DELETE') { await response.json(); return null }
    if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('The saved photo could not be loaded. Please try again.')
    const photo = await response.blob()
    if (!photo.size) throw new Error('The saved photo is empty. Please choose another image.')
    return photo
  } catch (failure) {
    if (timedOut) throw new Error('The request timed out. Refresh your photo before trying again.')
    throw failure
  } finally { clearTimeout(timer) }
}

async function saveCroppedPhoto() {
  if (!cropOpen.value || !cropImage || photoBusy.value || !currentOwner(cropOwner)) return
  const owner = cropOwner
  const session = cropSession
  const controller = new AbortController()
  mutationController = controller
  photoSaving.value = true
  cropError.value = ''
  photoError.value = ''
  photoNotice.value = ''
  try {
    const cropped = await croppedPhotoBlob()
    if (!currentOwner(owner) || session !== cropSession) return
    const data = new FormData()
    data.append('photo', cropped, cropped.type === 'image/webp' ? 'profile.webp' : 'profile.png')
    const saved = await requestPhoto('POST', controller, data)
    if (!currentOwner(owner) || session !== cropSession || controller !== mutationController) return
    publishPhoto(saved, owner)
    photoNotice.value = 'Profile photo saved.'
    closeCrop(true)
  } catch (failure) {
    if (failure.name !== 'AbortError' && currentOwner(owner) && session === cropSession) cropError.value = failure.message
  } finally {
    if (currentOwner(owner) && controller === mutationController) photoSaving.value = false
  }
}

async function removeProfilePhoto() {
  if (!savedPhotoUrl.value || photoBusy.value || cropOpen.value || !photoOwner.value) return
  const owner = photoOwner.value
  const controller = new AbortController()
  mutationController = controller
  photoRemoving.value = true
  photoError.value = ''
  photoNotice.value = ''
  try {
    await requestPhoto('DELETE', controller)
    if (!currentOwner(owner) || controller !== mutationController) return
    clearPhoto(owner)
    photoNotice.value = 'Profile photo removed.'
  } catch (failure) {
    if (failure.name !== 'AbortError' && currentOwner(owner)) photoError.value = failure.message
  } finally {
    if (currentOwner(owner) && controller === mutationController) photoRemoving.value = false
  }
}

function photoDisplayError() {
  clearPhoto(photoOwner.value)
  photoError.value = 'This photo could not be displayed. Choose another image or retry.'
}

function loadProfilePhoto() {
  photoError.value = ''
  return refreshPhoto()
}

watch(photoOwner, () => {
  mutationController?.abort()
  selectionId++
  closeCrop(true)
  photoChecking.value = false
  photoSaving.value = false
  photoRemoving.value = false
  photoError.value = ''
  photoNotice.value = ''
  showEmail.value = false
}, { immediate: true })

onUnmounted(() => {
  disposed = true
  mutationController?.abort()
  selectionId++
  closeCrop(true)
})
</script>
<template>
  <main class="w-full min-w-0 p-4 sm:p-6 lg:p-8">
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100">
        Personal information
      </h2>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Your profile and account details.
      </p>
    </div>
    <section
      aria-label="My information"
      class="w-full overflow-hidden rounded-3xl
             border border-slate-200 bg-white shadow-sm
             dark:border-white/10 dark:bg-[#111c2d]"
    >
      <div
        aria-hidden="true"
        class="relative h-28 overflow-hidden bg-[#123d35] sm:h-36"
      >
        <div
          class="absolute -top-24 right-12 size-64 rounded-full
                 border-[30px] border-white/5"
        />
        <div
          class="absolute -right-16 -bottom-36 size-80 rounded-full
                 border-[35px] border-emerald-300/10"
        />
      </div>
      <div class="px-5 pb-6 sm:px-8 sm:pb-8">
        <div
          class="relative -mt-10 flex flex-wrap items-end
                 justify-between gap-3"
        >
          <div class="relative size-24 shrink-0">
            <div
              class="flex size-full items-center justify-center overflow-hidden
                     rounded-full border-[5px] border-white bg-emerald-100
                     text-3xl font-bold text-emerald-800 shadow-sm
                     dark:border-[#111c2d]"
            >
              <img
                v-if="photoSrc"
                :src="photoSrc"
                :alt="`${username}'s profile photo`"
                class="size-full rounded-full object-cover"
                @error="photoDisplayError"
              >
              <span v-else aria-hidden="true">{{ initial }}</span>
            </div>
            <span
              v-if="verified"
              class="pointer-events-none absolute bottom-0 right-0 flex size-8
                     items-center justify-center rounded-full border-[3px] border-white
                     bg-white dark:border-[#111c2d] dark:bg-[#111c2d]"
            >
              <svg
                viewBox="0 0 24 24"
                role="img"
                aria-label="Email verified"
                class="size-full text-[#1877f2] dark:text-blue-400"
              >
                <title>Email verified</title>
                <path
                  fill="currentColor"
                  d="m12 2 2.3 1.6 2.8-.2 1 2.6 2.5 1.2-.2 2.8L22 12l-1.6 2.3.2 2.8-2.6 1-1.2 2.5-2.8-.2L12 22l-2.3-1.6-2.8.2-1-2.6-2.5-1.2.2-2.8L2 12l1.6-2.3-.2-2.8 2.6-1 1.2-2.5 2.8.2Z"
                />
                <path
                  d="m7.8 12 2.7 2.7 5.7-5.8"
                  fill="none"
                  stroke="white"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </div>
          <span
            class="mb-1 inline-flex items-center gap-2 rounded-full
                   px-3 py-1.5 text-xs font-semibold"
            :class="
              verified
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
            "
          >
            <span aria-hidden="true" class="size-1.5 rounded-full bg-current" />
            {{ verified ? 'Email verified' : 'Email not verified' }}
          </span>
        </div>
        <div class="mt-4 space-y-2">
          <input
            ref="photoInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            aria-label="Choose profile photo"
            :disabled="photoBusy || cropOpen"
            @change="selectProfilePhoto"
          >
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="inline-flex min-h-9 cursor-pointer items-center justify-center
                     rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs
                     font-semibold text-slate-600 hover:border-emerald-400
                     hover:text-emerald-700 focus-visible:outline-2
                     focus-visible:outline-offset-2 focus-visible:outline-emerald-500
                     disabled:cursor-wait disabled:opacity-60 dark:border-white/10
                     dark:bg-white/5 dark:text-slate-300 dark:hover:text-emerald-300"
              :disabled="photoBusy || cropOpen"
              @click="chooseProfilePhoto"
            >
              {{ photoChecking ? 'Opening photo…' : photoSrc ? 'Change photo' : 'Add photo' }}
            </button>
            <button
              v-if="savedPhotoUrl"
              type="button"
              class="inline-flex min-h-9 cursor-pointer items-center justify-center
                     rounded-lg px-3 py-2 text-xs font-semibold text-red-600
                     hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500
                     disabled:cursor-wait disabled:opacity-60
                     dark:text-red-400 dark:hover:bg-red-500/10"
              :disabled="photoBusy || cropOpen"
              @click="removeProfilePhoto"
            >
              {{ photoRemoving ? 'Removing…' : 'Remove photo' }}
            </button>
          </div>
          <p v-if="photoLoading" role="status" class="text-xs text-slate-500 dark:text-slate-400">
            Loading your photo…
          </p>
          <p v-if="photoNotice" role="status" class="text-xs text-emerald-700 dark:text-emerald-400">
            {{ photoNotice }}
          </p>
          <div v-if="displayedPhotoError" role="alert" class="flex flex-wrap items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <p>{{ displayedPhotoError }}</p>
            <button
              v-if="!photoBusy && !photoLoading"
              type="button"
              class="cursor-pointer rounded px-1 py-1 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-red-500"
              @click="loadProfilePhoto"
            >
              Refresh photo
            </button>
          </div>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <h3
            class="flex min-w-0 max-w-full items-center gap-2
                   text-2xl font-semibold text-slate-800 dark:text-slate-100"
          >
            <span class="min-w-0 break-all">{{ username }}</span>
          </h3>
          <span
            v-if="isAdmin"
            class="inline-flex shrink-0 items-center rounded-full
                   bg-violet-50 px-3 py-1 text-xs font-semibold
                   text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
          >
            Admin
          </span>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ isAdmin ? 'CMM-FT admin full control' : 'CMM-FT member account' }}
        </p>
        <dl
          class="mt-7 grid gap-5 border-t border-slate-100
                 pt-6 md:grid-cols-2 dark:border-white/10"
        >
          <div
            class="min-w-0 rounded-2xl border border-slate-100
                   bg-slate-50 p-5 dark:border-white/5 dark:bg-white/[0.03]"
          >
            <dt class="text-xs text-slate-500 dark:text-slate-400">
              Username
            </dt>
            <dd
              class="mt-2 break-all text-base font-semibold
                     text-slate-800 dark:text-slate-100"
            >
              {{ auth.user?.username || '—' }}
            </dd>
          </div>
          <div
            class="min-w-0 rounded-2xl border border-slate-100
                   bg-slate-50 p-5 dark:border-white/5 dark:bg-white/[0.03]"
          >
            <dt class="text-xs text-slate-500 dark:text-slate-400">
              Email address
            </dt>
            <dd class="mt-2 flex min-w-0 flex-wrap items-center gap-3">
              <span
                id="profile-email-value"
                class="min-w-0 break-all text-base font-semibold
                       text-slate-800 dark:text-slate-100"
                aria-live="polite"
              >
                <template v-if="showEmail || !auth.user?.email">
                  {{ email }}
                </template>
                <template v-else>
                  <span aria-hidden="true">••••••••••</span>
                  <span class="sr-only">Email hidden</span>
                </template>
              </span>
              <button
                v-if="auth.user?.email"
                type="button"
                class="inline-flex min-h-9 shrink-0 cursor-pointer items-center
                       justify-center gap-1.5 rounded-lg border border-slate-200
                       bg-white px-3 py-1.5 text-xs font-semibold text-slate-600
                       transition hover:border-emerald-400 hover:text-emerald-700
                       focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-emerald-500 dark:border-white/10
                       dark:bg-white/5 dark:text-slate-300
                       dark:hover:border-emerald-500/50 dark:hover:text-emerald-300"
                :aria-label="showEmail ? 'Hide email address' : 'Show email address'"
                :aria-pressed="showEmail"
                aria-controls="profile-email-value"
                @click="showEmail = !showEmail"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-4"
                  aria-hidden="true"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  <path v-if="showEmail" d="m3 3 18 18" />
                </svg>
                {{ showEmail ? 'Hide' : 'Show' }}
              </button>
            </dd>
          </div>
        </dl>
        <div
          class="mt-6 flex flex-wrap items-center justify-between
                 gap-4 border-t border-slate-100 pt-5 dark:border-white/10"
        >
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Your personal account information.
          </p>
          <RouterLink
            :to="dashboardLink"
            class="inline-flex items-center justify-center gap-2
                   rounded-xl bg-emerald-600 px-5 py-3 text-sm
                   font-semibold text-white transition hover:bg-emerald-700
                   focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-emerald-500"
          >
            Back to Overview
            <span aria-hidden="true">→</span>
          </RouterLink>
        </div>
      </div>
    </section>
    <dialog
      ref="cropDialog"
      aria-labelledby="profile-photo-crop-title"
      :aria-busy="photoSaving"
      class="m-auto max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-md
             overflow-y-auto overscroll-contain rounded-2xl border border-slate-200
             bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/75
             backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-[#111c2d]
             dark:text-slate-100"
      @cancel.prevent="closeCrop()"
    >
      <header class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="profile-photo-crop-title" class="text-lg font-semibold">
            Adjust your photo
          </h2>
          <p id="profile-photo-crop-help" class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Drag to position your photo. Zoom to choose what fits in the circle.
            <span class="sr-only">Use arrow keys to move the photo, plus and minus to zoom, and Home to reset.</span>
          </p>
        </div>
        <button
          type="button"
          aria-label="Cancel photo editing"
          class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center
                 rounded-full text-xl text-slate-500 hover:bg-slate-100
                 focus-visible:outline-2 focus-visible:outline-emerald-500
                 disabled:cursor-wait disabled:opacity-50
                 dark:text-slate-400 dark:hover:bg-white/5"
          :disabled="photoSaving"
          @click="closeCrop()"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div
        ref="cropViewport"
        role="group"
        aria-label="Photo crop area"
        aria-describedby="profile-photo-crop-help"
        tabindex="0"
        class="relative mx-auto aspect-square w-full max-w-[min(320px,45dvh)]
               touch-none overflow-hidden rounded-xl bg-slate-950
               focus-visible:outline-2 focus-visible:outline-offset-4
               focus-visible:outline-emerald-500"
        :class="cropDragging ? 'cursor-grabbing' : 'cursor-grab'"
        @pointerdown="startCropPointer"
        @pointermove="moveCropPointer"
        @pointerup="endCropPointer"
        @pointercancel="endCropPointer"
        @lostpointercapture="endCropPointer"
        @wheel.prevent="wheelCrop"
        @keydown="keyboardCrop"
      >
        <img
          v-if="cropSourceUrl"
          :key="cropSourceUrl"
          :src="cropSourceUrl"
          alt=""
          draggable="false"
          class="pointer-events-none absolute max-w-none select-none"
          :style="cropImageStyle"
          @dragstart.prevent
        >
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 rounded-full border-2 border-white"
          style="box-shadow: 0 0 0 999px rgb(2 6 23 / 0.6)"
        />
        <div
          v-if="photoSaving"
          aria-hidden="true"
          class="absolute inset-0 flex items-center justify-center bg-slate-950/50
                 text-sm font-semibold text-white"
        >
          Saving…
        </div>
      </div>

      <div class="mt-5">
        <div class="mb-2 flex items-center justify-between gap-3">
          <label for="profile-photo-zoom" class="text-xs font-semibold">
            Zoom <span class="ml-1 font-normal tabular-nums text-slate-500 dark:text-slate-400">{{ cropPercent }}%</span>
          </label>
          <button
            type="button"
            class="cursor-pointer rounded px-1 py-1 text-xs font-semibold text-emerald-700
                   hover:underline focus-visible:outline-2 focus-visible:outline-emerald-500
                   disabled:cursor-wait disabled:opacity-50 dark:text-emerald-400"
            :disabled="photoSaving"
            @click="resetCrop"
          >
            Reset
          </button>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            aria-label="Zoom out"
            class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center
                   rounded-full border border-slate-200 text-lg hover:bg-slate-50
                   focus-visible:outline-2 focus-visible:outline-emerald-500
                   disabled:cursor-default disabled:opacity-35
                   dark:border-white/10 dark:hover:bg-white/5"
            :disabled="photoSaving || cropZoom <= 1"
            @click="zoomCrop(cropZoom - 0.1)"
          >
            <span aria-hidden="true">−</span>
          </button>
          <input
            id="profile-photo-zoom"
            type="range"
            min="1"
            max="4"
            step="0.01"
            :value="cropZoom"
            :aria-valuetext="`${cropPercent} percent`"
            :disabled="photoSaving"
            class="min-h-9 w-full min-w-0 cursor-pointer accent-emerald-600
                   focus-visible:outline-2 focus-visible:outline-emerald-500
                   disabled:cursor-wait disabled:opacity-50"
            @input="zoomCrop($event.target.value)"
          >
          <button
            type="button"
            aria-label="Zoom in"
            class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center
                   rounded-full border border-slate-200 text-lg hover:bg-slate-50
                   focus-visible:outline-2 focus-visible:outline-emerald-500
                   disabled:cursor-default disabled:opacity-35
                   dark:border-white/10 dark:hover:bg-white/5"
            :disabled="photoSaving || cropZoom >= 4"
            @click="zoomCrop(cropZoom + 0.1)"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>

      <p v-if="cropError" role="alert" class="mt-3 text-xs leading-5 text-red-600 dark:text-red-400">
        {{ cropError }}
      </p>
      <footer class="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-white/10">
        <button
          type="button"
          class="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg
                 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600
                 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-500
                 disabled:cursor-wait disabled:opacity-50 dark:border-white/10
                 dark:text-slate-300 dark:hover:bg-white/5"
          :disabled="photoSaving"
          @click="closeCrop()"
        >
          Cancel
        </button>
        <button
          type="button"
          class="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg
                 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-emerald-500 disabled:cursor-wait disabled:opacity-60"
          :disabled="photoSaving || !cropSourceUrl"
          @click="saveCroppedPhoto"
        >
          {{ photoSaving ? 'Saving…' : 'Save photo' }}
        </button>
      </footer>
    </dialog>
  </main>
</template>
