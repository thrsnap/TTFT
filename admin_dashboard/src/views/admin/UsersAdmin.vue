<script setup>
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  getUsers,
  addUser,
  editUser,
  deleteUser,
  getUserAccess,
  grantCourseAccess,
  revokeCourseAccess,
  grantSignalAccess,
  revokeSignalAccess,
} from '../../api/userApi.js'

const router = useRouter()

const users = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const currentAdminId = ref('')

const search = ref('')
const appliedSearch = ref('')
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const message = ref('')

const editingId = ref('')
const googleAccount = ref(false)
const confirmDelete = ref(null)

const emptyForm = () => ({
  username: '',
  email: '',
  password: '',
  role: 'user',
  emailVerified: false,
})

const form = ref(emptyForm())

const pages = computed(() =>
  Math.max(1, Math.ceil(total.value / limit.value)),
)

// Only one permission panel is open at a time.
// 'course' and 'signal' have separate controls.
const panelType = ref('')
const accessUser = ref(null)
const accessLoading = ref(false)
const accessReady = ref(false)
const accessError = ref('')
const accessMessage = ref('')

const availableCourses = ref([])
const grantedCourses = ref([])
const selectedCourseId = ref('')

const signalAccess = ref(null)
const signalExpiry = ref('')

const locked = computed(() =>
  busy.value || loading.value || accessLoading.value,
)

const now = ref(Date.now())
let clock

const courseChoices = computed(() => {
  const grantedIds = new Set(
    grantedCourses.value.map(course => String(course.id)),
  )

  return availableCourses.value.filter(
    course => !grantedIds.has(String(course.id)),
  )
})

function activeSubscription(subscription) {
  return Boolean(
    subscription?.expiresAt &&
    new Date(subscription.expiresAt).getTime() > now.value,
  )
}

const signalActive = computed(() =>
  activeSubscription(signalAccess.value),
)

function date(value) {
  if (!value) return '—'

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString()
}

function dateTime(value) {
  if (!value) return '—'

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString()
}

function localDateTime(value) {
  if (!value) return ''

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const pad = number => String(number).padStart(2, '0')

  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-` +
    `${pad(parsed.getDate())}T${pad(parsed.getHours())}:` +
    `${pad(parsed.getMinutes())}`
  )
}

function subscriptionLabel(subscription) {
  if (!subscription?.expiresAt) return 'No subscription'

  return activeSubscription(subscription)
    ? 'Active subscription'
    : 'Expired subscription'
}

async function report(err, access = false) {
  const target = access ? accessError : error
  target.value = err.message || 'Request failed.'

  if (err.status === 401) {
    await router.replace({
      name: 'admin-login',
      query: { redirect: '/admin/users' },
    })
  }
}

async function load() {
  loading.value = true
  error.value = ''

  try {
    let data = await getUsers(appliedSearch.value, page.value)

    const lastPage = Math.max(
      1,
      Math.ceil(data.total / (data.limit || 20)),
    )

    if (page.value > lastPage) {
      page.value = lastPage
      data = await getUsers(appliedSearch.value, page.value)
    }

    users.value = data.users || []
    total.value = data.total || 0
    limit.value = data.limit || 20
    currentAdminId.value = data.currentAdminId || ''
  } catch (err) {
    await report(err)
  } finally {
    loading.value = false
  }
}

function reset() {
  editingId.value = ''
  googleAccount.value = false
  form.value = emptyForm()
}

function edit(user) {
  if (locked.value || user.id === currentAdminId.value) return

  error.value = ''
  message.value = ''
  editingId.value = user.id
  googleAccount.value = Boolean(user.isGoogleAccount)

  form.value = {
    username: user.username,
    email: user.email,
    password: '',
    role: user.role,
    emailVerified: Boolean(user.emailVerified),
  }

  document.getElementById('user-form')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

async function save() {
  if (locked.value) return

  busy.value = true
  error.value = ''
  message.value = ''

  try {
    const body = { ...form.value }

    if (
      (editingId.value && !body.password) ||
      googleAccount.value
    ) {
      delete body.password
    }

    const result = editingId.value
      ? await editUser(editingId.value, body)
      : await addUser(body)

    reset()
    await load()
    message.value = result.message || 'User saved.'
  } catch (err) {
    await report(err)
  } finally {
    busy.value = false
  }
}

function clearPanel() {
  panelType.value = ''
  accessUser.value = null
  accessReady.value = false
  accessError.value = ''
  accessMessage.value = ''
  availableCourses.value = []
  grantedCourses.value = []
  selectedCourseId.value = ''
  signalAccess.value = null
  signalExpiry.value = ''
}

function closePanel() {
  if (locked.value) return
  clearPanel()
}

async function remove() {
  if (!confirmDelete.value || locked.value) return

  busy.value = true
  error.value = ''
  message.value = ''

  try {
    const id = confirmDelete.value.id
    const result = await deleteUser(id)

    confirmDelete.value = null

    if (editingId.value === id) reset()
    if (accessUser.value?.id === id) clearPanel()

    await load()
    message.value = result.message || 'User deleted.'
  } catch (err) {
    await report(err)
  } finally {
    busy.value = false
  }
}

async function applySearch() {
  if (locked.value) return

  appliedSearch.value = search.value.trim()
  page.value = 1
  await load()
}

async function changePage(delta) {
  if (locked.value) return

  page.value = Math.min(
    pages.value,
    Math.max(1, page.value + delta),
  )

  await load()
}

async function loadPanel() {
  if (!accessUser.value) return

  accessLoading.value = true
  accessReady.value = false
  accessError.value = ''

  try {
    const data = await getUserAccess(accessUser.value.id)

    if (panelType.value === 'course') {
      if (
        !Array.isArray(data.availableCourses) ||
        !Array.isArray(data.courses)
      ) {
        throw new Error('Invalid course access response.')
      }

      availableCourses.value = data.availableCourses
      grantedCourses.value = data.courses

      if (
        !courseChoices.value.some(
          course => String(course.id) === selectedCourseId.value,
        )
      ) {
        selectedCourseId.value = ''
      }
    } else {
      if (!Object.hasOwn(data, 'signalAccess')) {
        throw new Error('Invalid signal subscription response.')
      }

      signalAccess.value = data.signalAccess || null
      signalExpiry.value = localDateTime(
        signalAccess.value?.expiresAt,
      )
    }

    accessReady.value = true
  } catch (err) {
    await report(err, true)
  } finally {
    accessLoading.value = false
  }
}

async function openPanel(user, type) {
  if (locked.value) return

  clearPanel()
  panelType.value = type
  accessUser.value = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  }

  await nextTick()

  document.getElementById('permission-panel')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })

  await loadPanel()
}

async function changeAccess(action, successMessage) {
  if (
    locked.value ||
    !accessUser.value ||
    !accessReady.value
  ) {
    return
  }

  busy.value = true
  accessError.value = ''
  accessMessage.value = ''

  try {
    const result = await action()
    accessMessage.value = result.message || successMessage

    await loadPanel()
    await load()
  } catch (err) {
    await report(err, true)
  } finally {
    busy.value = false
  }
}

async function grantCourse() {
  if (
    panelType.value !== 'course' ||
    !accessUser.value ||
    locked.value
  ) {
    return
  }

  if (!selectedCourseId.value) {
    accessError.value = 'Select a course first.'
    return
  }

  const userId = accessUser.value.id
  const courseId = selectedCourseId.value

  await changeAccess(
    () => grantCourseAccess(userId, courseId),
    'Course access granted.',
  )
}

async function removeCourse(course) {
  if (
    panelType.value !== 'course' ||
    !accessUser.value ||
    locked.value ||
    !accessReady.value
  ) {
    return
  }

  if (
    !window.confirm(
      `Remove "${course.title}" access for ${accessUser.value.email}?`,
    )
  ) {
    return
  }

  const userId = accessUser.value.id

  await changeAccess(
    () => revokeCourseAccess(userId, course.id),
    'Course access removed.',
  )
}

async function saveSignals() {
  if (
    panelType.value !== 'signal' ||
    !accessUser.value ||
    locked.value
  ) {
    return
  }

  accessError.value = ''

  const expiry = new Date(signalExpiry.value)

  if (
    !signalExpiry.value ||
    Number.isNaN(expiry.getTime()) ||
    expiry.getTime() <= Date.now()
  ) {
    accessError.value = 'Choose a future expiry date and time.'
    return
  }

  const userId = accessUser.value.id

  await changeAccess(
    () => grantSignalAccess(userId, expiry.toISOString()),
    'Signal subscription saved.',
  )
}

async function removeSignals() {
  if (
    panelType.value !== 'signal' ||
    !accessUser.value ||
    locked.value ||
    !accessReady.value
  ) {
    return
  }

  if (
    !window.confirm(
      `Remove the signal subscription for ${accessUser.value.email}?`,
    )
  ) {
    return
  }

  const userId = accessUser.value.id

  await changeAccess(
    () => revokeSignalAccess(userId),
    'Signal subscription removed.',
  )
}

onMounted(() => {
  load()
  clock = window.setInterval(() => {
    now.value = Date.now()
  }, 30_000)
})

onUnmounted(() => {
  window.clearInterval(clock)
})
</script>

<template>
  <main
    class="min-h-screen bg-(--page-bg) px-6 py-8 text-(--text-color)
           max-[768px]:px-5 max-[600px]:px-4 max-[480px]:px-3
           max-[414px]:px-2.5 max-[320px]:px-2"
  >
    <div class="mx-auto max-w-6xl">
      <header class="mb-6 flex flex-wrap justify-between gap-3">
        <div>
          <RouterLink to="/admin" class="text-sm text-indigo-500">
            ← Admin Panel
          </RouterLink>

          <h1 class="mt-2 text-3xl font-bold max-[480px]:text-2xl">
            User Management
          </h1>
        </div>

        <button
          type="button"
          :disabled="locked"
          class="min-h-11 rounded-lg border border-(--border-color)
                 px-4 py-2 disabled:opacity-50"
          @click="load"
        >
          Refresh Users
        </button>
      </header>

      <p
        v-if="error"
        role="alert"
        class="mb-4 rounded-lg bg-red-500/10 p-4 text-red-500"
      >
        {{ error }}
      </p>

      <p
        v-if="message"
        role="status"
        class="mb-4 rounded-lg bg-emerald-500/10 p-4 text-emerald-600"
      >
        {{ message }}
      </p>

      <!-- Account management -->
      <form
        id="user-form"
        class="mb-8 rounded-xl border border-(--border-color)
               bg-(--surface-bg) p-6 max-[480px]:p-4"
        @submit.prevent="save"
      >
        <h2 class="mb-4 text-xl font-bold">
          {{ editingId ? 'Edit user' : 'Add user' }}
        </h2>

        <fieldset
          :disabled="locked"
          class="grid min-w-0 grid-cols-2 gap-4 max-[600px]:grid-cols-1"
        >
          <div>
            <label for="username" class="mb-2 block text-sm font-semibold">
              Username
            </label>
            <input
              id="username"
              v-model="form.username"
              required
              pattern="[A-Za-z0-9_]{3,30}"
              minlength="3"
              maxlength="30"
              class="min-h-11 w-full rounded-lg border
                     border-(--border-color) bg-(--input-bg) px-3 py-2"
            />
          </div>

          <div>
            <label for="email" class="mb-2 block text-sm font-semibold">
              Email
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              maxlength="254"
              :readonly="googleAccount"
              class="min-h-11 w-full rounded-lg border
                     border-(--border-color) bg-(--input-bg) px-3 py-2"
              @input="form.emailVerified = false"
            />
          </div>

          <div>
            <label for="password" class="mb-2 block text-sm font-semibold">
              {{ editingId ? 'New password (optional)' : 'Password' }}
            </label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              :required="!editingId"
              minlength="12"
              :disabled="googleAccount"
              class="min-h-11 w-full rounded-lg border
                     border-(--border-color) bg-(--input-bg)
                     px-3 py-2 disabled:opacity-50"
            />
            <p class="mt-1 text-xs text-(--muted-color)">
              {{
                googleAccount
                  ? 'Google account: email and password changes are unavailable here.'
                  : 'At least 12 characters. Leave blank when editing to keep the password.'
              }}
            </p>
          </div>

          <div>
            <label for="role" class="mb-2 block text-sm font-semibold">
              Role
            </label>
            <select
              id="role"
              v-model="form.role"
              class="min-h-11 w-full rounded-lg border
                     border-(--border-color) bg-(--input-bg) px-3 py-2"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <label class="flex items-start gap-2 text-sm">
            <input
              v-model="form.emailVerified"
              type="checkbox"
              class="mt-1"
            />
            <span>
              I confirm this email is verified.
              <span class="mt-1 block text-xs text-(--muted-color)">
                Unverified accounts must verify their email before login.
              </span>
            </span>
          </label>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              class="min-h-11 rounded-lg bg-indigo-600 px-4 py-2
                     font-semibold text-white disabled:opacity-50"
            >
              {{
                busy
                  ? 'Please wait…'
                  : editingId
                    ? 'Save changes'
                    : 'Add user'
              }}
            </button>

            <button
              v-if="editingId"
              type="button"
              class="min-h-11 rounded-lg border border-(--border-color)
                     px-4 py-2"
              @click="reset"
            >
              Cancel edit
            </button>
          </div>
        </fieldset>

        <p class="mt-4 text-xs text-(--muted-color)">
          Changing email, password, verification or role revokes
          previous sessions.
        </p>
      </form>

      <!-- Displays only the selected permission option -->
      <section
        v-if="accessUser"
        id="permission-panel"
        aria-labelledby="permission-heading"
        class="mb-8 rounded-xl border bg-(--surface-bg)
               p-6 max-[480px]:p-4"
        :class="
          panelType === 'course'
            ? 'border-emerald-500/40'
            : 'border-indigo-500/40'
        "
      >
        <div class="mb-5 flex flex-wrap justify-between gap-3">
          <div class="min-w-0">
            <h2 id="permission-heading" class="text-xl font-bold">
              {{
                panelType === 'course'
                  ? 'Course Access'
                  : 'Signal Subscription'
              }}
              · {{ accessUser.username }}
            </h2>

            <p class="mt-1 break-all text-sm text-(--muted-color)">
              {{ accessUser.email }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :disabled="locked"
              class="min-h-11 rounded-lg border border-(--border-color)
                     px-3 py-2 text-sm disabled:opacity-50"
              @click="loadPanel"
            >
              Refresh
            </button>

            <button
              type="button"
              :disabled="locked"
              class="min-h-11 rounded-lg border border-(--border-color)
                     px-3 py-2 text-sm disabled:opacity-50"
              @click="closePanel"
            >
              Close
            </button>
          </div>
        </div>

        <p
          v-if="accessUser.role === 'admin'"
          class="mb-4 rounded-lg bg-indigo-500/10 p-3
                 text-sm text-indigo-500"
        >
          Removing purchased access does not remove permissions
          provided by the admin role.
        </p>

        <p
          v-if="accessError"
          role="alert"
          class="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500"
        >
          {{ accessError }}
        </p>

        <p
          v-if="accessMessage"
          role="status"
          class="mb-4 rounded-lg bg-emerald-500/10 p-3
                 text-sm text-emerald-600"
        >
          {{ accessMessage }}
        </p>

        <p
          v-if="accessLoading"
          role="status"
          class="text-sm text-(--muted-color)"
        >
          {{
            panelType === 'course'
              ? 'Loading course access…'
              : 'Loading signal subscription…'
          }}
        </p>

        <!-- Course controls only -->
        <div
          v-if="accessReady && !accessLoading && panelType === 'course'"
        >
          <form @submit.prevent="grantCourse">
            <fieldset :disabled="locked">
              <label
                for="access-course"
                class="mb-2 block text-sm font-semibold"
              >
                Select course
              </label>

              <div class="flex gap-3 max-[600px]:flex-col">
                <select
                  id="access-course"
                  v-model="selectedCourseId"
                  required
                  class="min-h-11 min-w-0 flex-1 rounded-lg border
                         border-(--border-color) bg-(--input-bg)
                         px-3 py-2"
                >
                  <option disabled value="">Choose a course</option>
                  <option
                    v-for="course in courseChoices"
                    :key="course.id"
                    :value="String(course.id)"
                  >
                    {{ course.title }}
                  </option>
                </select>

                <button
                  type="submit"
                  :disabled="locked || !selectedCourseId"
                  class="min-h-11 rounded-lg bg-emerald-600 px-4 py-2
                         text-sm font-semibold text-white
                         disabled:opacity-50"
                >
                  {{ busy ? 'Please wait…' : 'Grant Course Access' }}
                </button>
              </div>
            </fieldset>
          </form>

          <p
            v-if="!courseChoices.length"
            class="mt-2 text-xs text-(--muted-color)"
          >
            No additional courses are available to grant.
          </p>

          <h3 class="mt-6 font-semibold">Approved courses</h3>

          <p
            v-if="!grantedCourses.length"
            class="mt-2 text-sm text-(--muted-color)"
          >
            No course access granted.
          </p>

          <ul v-else class="mt-3 space-y-3">
            <li
              v-for="course in grantedCourses"
              :key="course.id"
              class="flex flex-wrap items-center justify-between gap-3
                     rounded-lg border border-(--border-color) p-4"
            >
              <div class="min-w-0">
                <p class="break-words text-sm font-semibold">
                  {{ course.title }}
                </p>
                <p class="mt-1 text-xs text-(--muted-color)">
                  Granted {{ date(course.grantedAt) }}
                </p>
              </div>

              <button
                type="button"
                :disabled="locked"
                class="min-h-11 rounded-lg bg-red-500/10 px-3 py-2
                       text-xs font-semibold text-red-500
                       disabled:opacity-50"
                @click="removeCourse(course)"
              >
                Remove Course Access
              </button>
            </li>
          </ul>
        </div>

        <!-- Signal controls only -->
        <div
          v-if="accessReady && !accessLoading && panelType === 'signal'"
          class="max-w-xl"
        >
          <div
            class="mb-4 rounded-lg border border-(--border-color) p-4"
          >
            <p
              class="text-sm font-semibold"
              :class="
                signalActive
                  ? 'text-emerald-600'
                  : 'text-(--muted-color)'
              "
            >
              {{ subscriptionLabel(signalAccess) }}
            </p>

            <p
              v-if="signalAccess?.expiresAt"
              class="mt-2 text-sm text-(--muted-color)"
            >
              Expires: {{ dateTime(signalAccess.expiresAt) }}
            </p>
          </div>

          <form @submit.prevent="saveSignals">
            <fieldset :disabled="locked">
              <label
                for="signal-expiry"
                class="mb-2 block text-sm font-semibold"
              >
                Subscription expiry
              </label>

              <input
                id="signal-expiry"
                v-model="signalExpiry"
                type="datetime-local"
                required
                class="min-h-11 w-full min-w-0 rounded-lg border
                       border-(--border-color) bg-(--input-bg) px-3 py-2"
              />

              <p class="mt-2 text-xs text-(--muted-color)">
                Select the date and time in your local timezone.
              </p>

              <button
                type="submit"
                :disabled="locked || !signalExpiry"
                class="mt-4 min-h-11 rounded-lg bg-indigo-600
                       px-4 py-2 text-sm font-semibold text-white
                       disabled:opacity-50 max-[480px]:w-full"
              >
                {{
                  busy
                    ? 'Please wait…'
                    : signalAccess?.expiresAt
                      ? 'Update Signal Subscription'
                      : 'Grant Signal Subscription'
                }}
              </button>
            </fieldset>
          </form>

          <button
            v-if="signalAccess?.expiresAt"
            type="button"
            :disabled="locked"
            class="mt-3 min-h-11 rounded-lg bg-red-500/10
                   px-4 py-2 text-sm font-semibold text-red-500
                   disabled:opacity-50 max-[480px]:w-full"
            @click="removeSignals"
          >
            Remove Signal Subscription
          </button>
        </div>

        <p class="mt-5 text-xs text-(--muted-color)">
          Grant access after confirming payment. Removing access
          does not issue a refund or erase payment history.
        </p>
      </section>

      <!-- Users -->
      <section aria-labelledby="users-heading">
        <div
          class="mb-4 flex flex-wrap items-center justify-between gap-3"
        >
          <h2 id="users-heading" class="text-xl font-bold">
            All users · {{ total }}
          </h2>

          <form
            class="flex w-full gap-2 sm:w-auto"
            @submit.prevent="applySearch"
          >
            <input
              v-model="search"
              type="search"
              maxlength="100"
              placeholder="Search username or email"
              aria-label="Search users"
              class="min-h-11 min-w-0 flex-1 rounded-lg border
                     border-(--border-color) bg-(--input-bg) px-3 py-2"
            />
            <button
              :disabled="locked"
              class="min-h-11 rounded-lg bg-indigo-600 px-4 py-2
                     text-white disabled:opacity-50"
            >
              Search
            </button>
          </form>
        </div>

        <p
          v-if="loading"
          role="status"
          class="mb-4 text-(--muted-color)"
        >
          Loading users…
        </p>

        <div
          class="grid grid-cols-2 gap-4 max-[768px]:grid-cols-1
                 max-[480px]:gap-3"
        >
          <article
            v-for="user in users"
            :key="user.id"
            class="min-w-0 rounded-xl border border-(--border-color)
                   bg-(--surface-bg) p-5 max-[480px]:p-4"
          >
            <h3 class="break-words font-bold">
              {{ user.username }}
              <span
                v-if="user.id === currentAdminId"
                class="text-xs text-indigo-500"
              >
                (You)
              </span>
            </h3>

            <p class="mt-1 break-all text-sm text-(--muted-color)">
              {{ user.email }}
            </p>

            <div class="my-3 flex flex-wrap gap-2 text-xs">
              <span class="rounded bg-indigo-500/10 px-2 py-1">
                {{ user.role }}
              </span>

              <span
                class="rounded px-2 py-1"
                :class="
                  user.emailVerified
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-amber-500/10 text-amber-600'
                "
              >
                {{ user.emailVerified ? 'Verified' : 'Unverified' }}
              </span>

              <span class="rounded bg-slate-500/10 px-2 py-1">
                {{ user.active ? 'Active in last 15 min' : 'Inactive' }}
              </span>
            </div>

            <p class="text-xs text-(--muted-color)">
              Joined {{ date(user.createdAt) }}
              · Last seen {{ date(user.lastSeenAt) }}
            </p>

            <!-- Independent course option -->
            <section
              class="mt-4 border-t border-(--border-color) pt-4"
              :aria-label="`Course access for ${user.username}`"
            >
              <h4 class="text-sm font-semibold">Course Access</h4>

              <p
                v-if="user.role === 'admin'"
                class="mt-1 text-xs text-indigo-500"
              >
                Admin preview access does not indicate a purchase.
              </p>

              <p
                v-if="!user.courses?.length"
                class="mt-2 text-xs text-(--muted-color)"
              >
                No approved course enrollments.
              </p>

              <ul v-else class="mt-2 space-y-2">
                <li
                  v-for="course in user.courses"
                  :key="course.id"
                  class="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs"
                >
                  <span
                    class="block break-words font-semibold text-emerald-600"
                  >
                    {{ course.title }}
                  </span>
                  <span class="mt-1 block text-(--muted-color)">
                    Granted {{ date(course.grantedAt) }}
                  </span>
                </li>
              </ul>

              <div v-if="user.pendingCoursePayments?.length" class="mt-3">
                <h5 class="text-xs font-semibold text-amber-600">
                  Awaiting payment review
                </h5>
                <p
                  v-for="payment in user.pendingCoursePayments"
                  :key="payment.id"
                  class="mt-1 break-words text-xs text-(--muted-color)"
                >
                  {{ payment.courseTitle }}
                  · {{ payment.currency }}
                  {{ Number(payment.amount).toFixed(2) }}
                  · awaiting review
                </p>
                <RouterLink
                  to="/admin/academy"
                  class="mt-2 inline-flex min-h-11 items-center text-xs
                         font-semibold text-indigo-500 underline"
                >
                  Review course payments →
                </RouterLink>
              </div>

              <button
                type="button"
                :disabled="locked"
                class="mt-3 min-h-11 rounded-lg bg-emerald-600 px-4 py-2
                       text-sm font-semibold text-white
                       disabled:opacity-40 max-[480px]:w-full"
                @click="openPanel(user, 'course')"
              >
                Course Access
              </button>
            </section>

            <!-- Independent signal option -->
            <section
              class="mt-4 border-t border-(--border-color) pt-4"
              :aria-label="`Signal subscription for ${user.username}`"
            >
              <h4 class="text-sm font-semibold">Signal Subscription</h4>

              <template v-if="user.signalAccess !== undefined">
                <p
                  class="mt-2 text-xs"
                  :class="
                    activeSubscription(user.signalAccess)
                      ? 'text-emerald-600'
                      : 'text-(--muted-color)'
                  "
                >
                  {{ subscriptionLabel(user.signalAccess) }}
                </p>

                <p
                  v-if="user.signalAccess?.expiresAt"
                  class="mt-1 text-xs text-(--muted-color)"
                >
                  Expires {{ dateTime(user.signalAccess.expiresAt) }}
                </p>
              </template>

              <p v-else class="mt-2 text-xs text-(--muted-color)">
                Open Signal Subscription to check the current status.
              </p>

              <button
                type="button"
                :disabled="locked"
                class="mt-3 min-h-11 rounded-lg bg-indigo-600 px-4 py-2
                       text-sm font-semibold text-white
                       disabled:opacity-40 max-[480px]:w-full"
                @click="openPanel(user, 'signal')"
              >
                Signal Subscription
              </button>
            </section>

            <div
              class="mt-4 flex flex-wrap gap-2 border-t
                     border-(--border-color) pt-4"
            >
              <button
                type="button"
                :disabled="locked || user.id === currentAdminId"
                class="min-h-11 rounded-lg border border-(--border-color)
                       px-4 py-2 text-sm font-semibold disabled:opacity-40"
                @click="edit(user)"
              >
                Edit User
              </button>

              <button
                type="button"
                :disabled="
                  locked ||
                  user.role === 'admin' ||
                  user.id === currentAdminId
                "
                class="min-h-11 rounded-lg bg-red-600 px-4 py-2
                       text-sm font-semibold text-white disabled:opacity-40"
                @click="confirmDelete = user"
              >
                Delete User
              </button>
            </div>
          </article>
        </div>

        <p
          v-if="!loading && !users.length"
          class="py-8 text-(--muted-color)"
        >
          No users found.
        </p>

        <nav
          aria-label="User list pages"
          class="mt-5 flex flex-wrap items-center justify-between gap-3"
        >
          <button
            type="button"
            :disabled="locked || page <= 1"
            class="min-h-11 rounded-lg border border-(--border-color)
                   px-4 py-2 disabled:opacity-40"
            @click="changePage(-1)"
          >
            Previous
          </button>

          <span class="text-sm">Page {{ page }} of {{ pages }}</span>

          <button
            type="button"
            :disabled="locked || page >= pages"
            class="min-h-11 rounded-lg border border-(--border-color)
                   px-4 py-2 disabled:opacity-40"
            @click="changePage(1)"
          >
            Next
          </button>
        </nav>
      </section>

      <!-- Account deletion -->
      <section
        v-if="confirmDelete"
        role="region"
        aria-label="Confirm user deletion"
        class="mt-6 rounded-xl border border-red-500/30
               bg-(--surface-bg) p-5"
      >
        <h2 class="font-bold">
          Delete {{ confirmDelete.username }}?
        </h2>

        <p class="mt-2 text-sm text-(--muted-color)">
          This permanently removes the account. To remove a course or
          subscription, use its separate permission button.
        </p>

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            :disabled="locked"
            class="min-h-11 rounded-lg bg-red-600 px-4 py-2
                   font-semibold text-white disabled:opacity-50"
            @click="remove"
          >
            Confirm delete
          </button>
          <button
            type="button"
            :disabled="locked"
            class="min-h-11 rounded-lg border border-(--border-color)
                   px-4 py-2 disabled:opacity-50"
            @click="confirmDelete = null"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  </main>
</template>