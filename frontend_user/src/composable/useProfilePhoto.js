import { computed, readonly, ref, watch } from 'vue'
import { useAuthStore } from '../store/user/authStore.js'

const endpoint = `${(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).trim().replace(/\/+$/, '')}/api/profile/photo`

const photoUrl = ref('')
const loading = ref(false)
const error = ref('')

let currentOwner = ''
let loaded = false
let pending = null
let controller
let version = 0

function replaceUrl(next) {
  const previous = photoUrl.value

  photoUrl.value = next

  if (previous) {
    URL.revokeObjectURL(previous)
  }
}

function cancelLoad() {
  version++

  controller?.abort()
  controller = undefined

  pending = null
  loading.value = false
}

function changeOwner(owner) {
  if (owner === currentOwner) return

  cancelLoad()

  currentOwner = owner
  loaded = false
  error.value = ''

  replaceUrl('')
}

function loadPhoto(force = false) {
  if (!currentOwner) return Promise.resolve(false)

  if (!force && pending) return pending

  if (!force && loaded) return Promise.resolve(true)

  cancelLoad()

  const requestVersion = version
  const owner = currentOwner
  const requestController = new AbortController()

  controller = requestController
  loading.value = true
  error.value = ''

  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    requestController.abort()
  }, 45000)

  const request = (async () => {
    try {
      const response = await fetch(endpoint, {
        credentials: 'include',
        cache: 'no-store',
        signal: requestController.signal,
      })

      let nextPhoto = null

      if (!response.ok) {
        const data = await response.json().catch(() => null)

        const noPhoto =
          response.status === 404 &&
          data?.code === 'PROFILE_PHOTO_NOT_SET'

        if (!noPhoto) {
          throw new Error(
            response.status === 401
              ? 'Your session has expired. Please sign in again.'
              : data?.message ||
                  'Unable to load your profile photo. Please try again.',
          )
        }
      } else {
        const contentType = response.headers.get('content-type')

        if (!contentType?.startsWith('image/')) {
          throw new Error(
            'The profile photo could not be loaded. Please try again.',
          )
        }

        nextPhoto = await response.blob()

        if (!nextPhoto.size) {
          throw new Error(
            'The profile photo is empty. Please choose another image.',
          )
        }
      }

      if (
        requestVersion !== version ||
        owner !== currentOwner
      ) {
        return false
      }

      replaceUrl(
        nextPhoto ? URL.createObjectURL(nextPhoto) : '',
      )

      loaded = true

      return true
    } catch (failure) {
      if (
        requestVersion === version &&
        owner === currentOwner
      ) {
        if (timedOut) {
          error.value =
            'Loading your photo timed out. Please try again.'
        } else if (failure.name !== 'AbortError') {
          error.value = failure.message
        }
      }

      return false
    } finally {
      clearTimeout(timer)

      if (
        requestVersion === version &&
        owner === currentOwner
      ) {
        loading.value = false
      }
    }
  })()

  pending = request

  void request.finally(() => {
    if (pending === request) {
      pending = null
    }
  })

  return request
}

function publishPhoto(blob, owner) {
  if (!owner || owner !== currentOwner) return false

  cancelLoad()

  replaceUrl(URL.createObjectURL(blob))

  error.value = ''
  loaded = true

  return true
}

function clearPhoto(owner) {
  if (owner !== currentOwner) return false

  cancelLoad()
  replaceUrl('')

  error.value = ''
  loaded = true

  return true
}

export function useProfilePhoto() {
  const auth = useAuthStore()

  const ownerKey = computed(() => {
    if (auth.isAuthenticated === false) return ''

    return (
      auth.user?._id ??
      auth.user?.id ??
      auth.user?.email ??
      ''
    )
  })

  const username = computed(
    () => auth.user?.username || 'Member',
  )

  const initial = computed(
    () => username.value.slice(0, 1).toUpperCase(),
  )

  watch(
    ownerKey,
    owner => {
      changeOwner(owner)

      if (owner) {
        void loadPhoto()
      }
    },
    {
      immediate: true,
      flush: 'sync',
    },
  )

  return {
    ownerKey,
    username,
    initial,
    photoUrl: readonly(photoUrl),
    loading: readonly(loading),
    error: readonly(error),
    refreshPhoto: () => loadPhoto(true),
    publishPhoto,
    clearPhoto,
  }
}