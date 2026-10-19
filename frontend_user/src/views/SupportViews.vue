<template>
  <main
    class="min-h-screen bg-(--page-bg) px-5 py-16
           text-(--text-color) transition-colors duration-300
           max-[768px]:px-4 max-[768px]:py-12
           max-[600px]:py-10
           max-[480px]:px-3 max-[480px]:py-8
           max-[414px]:px-2.5 max-[414px]:py-6
           max-[320px]:px-2 max-[320px]:py-5"
  >
    <div class="mx-auto w-full max-w-6xl">
      <!-- Page heading -->
      <header
        class="mb-12 text-center
               max-[768px]:mb-10
               max-[600px]:mb-8
               max-[480px]:mb-6
               max-[414px]:mb-5
               max-[320px]:mb-4"
      >
        <h1
          class="mt-3 text-5xl font-bold
                 max-[768px]:text-4xl
                 max-[600px]:text-3xl
                 max-[480px]:text-[26px]
                 max-[414px]:text-2xl
                 max-[320px]:text-xl"
                 :class="language === 'km' ? 'font-khmer' : 'font-sans'"
        >
          {{ t('Support.title') }}
        </h1>
        <p
          class="mx-auto mt-4 max-w-xl text-base leading-7
                 text-(--muted-color)
                 max-[600px]:text-sm max-[600px]:leading-6
                 max-[480px]:mt-3
                 max-[320px]:text-xs"
                 :class="language === 'km' ? 'font-khmer' : 'font-sans'"
        >
         {{ t('Support.subtitle') }}
        </p>
      </header>
      <div
        class="grid grid-cols-1 items-start gap-8
               lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]
               max-[768px]:gap-6
               max-[600px]:gap-5
               max-[480px]:gap-4
               max-[414px]:gap-3
               max-[320px]:gap-2.5"
      >
        <!-- Facebook, Telegram, and email -->
        <section aria-labelledby="contact-heading" class="min-w-0">
          <h2
            id="contact-heading"
            class="mb-4 text-xl font-semibold
                   max-[480px]:text-lg
                   max-[320px]:text-base"
                   :class="language === 'km' ? 'font-khmer' : 'font-sans'"
          >
            {{ t('Support.social') }}
          </h2>
          <div
            class="grid gap-4
                   max-[600px]:gap-3
                   max-[414px]:gap-2.5
                   max-[320px]:gap-2"
          >
            <a
              v-for="channel in channels"
              :key="channel.name"
              :href="channel.href"
              :target="channel.external ? '_blank' : undefined"
              :rel="channel.external ? 'noopener noreferrer' : undefined"
              class="flex min-w-0 items-center gap-4 rounded-2xl
                     border border-(--border-color)
                     bg-(--surface-bg) p-6
                     transition-colors hover:border-indigo-400
                     focus-visible:outline-2
                     focus-visible:outline-offset-2
                     focus-visible:outline-indigo-400
                     max-[768px]:p-5
                     max-[600px]:gap-3 max-[600px]:p-4
                     max-[480px]:rounded-xl
                     max-[414px]:p-3
                     max-[320px]:gap-2 max-[320px]:p-2.5"
            >
              <span
                :class="channel.iconClass"
                class="flex h-14 w-14 shrink-0 items-center
                       justify-center rounded-xl text-3xl
                       max-[768px]:h-12 max-[768px]:w-12
                       max-[600px]:text-2xl
                       max-[480px]:h-11 max-[480px]:w-11
                       max-[414px]:h-10 max-[414px]:w-10
                       max-[320px]:h-9 max-[320px]:w-9
                       max-[320px]:text-xl"
              >
                <FontAwesomeIcon :icon="channel.icon" />
              </span>
              <div class="min-w-0 flex-1">
                <h3
                  class="text-lg font-semibold
                         max-[600px]:text-base
                         max-[320px]:text-sm"
                >
                  {{ channel.name }}
                </h3>
                <p
                  class="mt-1 text-sm leading-6 text-(--muted-color)
                         [overflow-wrap:anywhere]
                         max-[480px]:text-xs max-[480px]:leading-5"
                >
                  {{ channel.description }}
                </p>
              </div>
              <span
                aria-hidden="true"
                class="shrink-0 text-lg text-indigo-400"
              >
                {{ channel.external ? '↗' : '→' }}
              </span>
            </a>
          </div>
        </section>
        <!-- Message form -->
        <section
           aria-labelledby="message-heading"
  class="min-w-0 rounded-3xl
         border border-(--border-color)
         bg-(--surface-bg) p-9 text-(--text-color)
         transition-colors duration-300
         max-[768px]:p-7
         max-[600px]:p-6
         max-[480px]:rounded-2xl max-[480px]:p-5
         max-[414px]:p-4
         max-[320px]:p-3"
        >
          <h2
            id="message-heading"
            class="text-2xl font-bold
                   max-[480px]:text-xl
                   max-[320px]:text-lg"
                   :class="language === 'km' ? 'font-khmer' : 'font-sans'"
          >
            {{ t('Support.sendhead') }}
          </h2>
          <p class="mt-2 text-sm text-slate-400" :class="language === 'km' ? 'font-khmer' : 'font-sans'">
            {{ t('Support.required') }}
          </p>
          <form
            class="mt-8 space-y-6
                   max-[600px]:space-y-5
                   max-[480px]:mt-6
                   max-[414px]:space-y-4"
            @submit.prevent="sendMessage"
          >
            <!-- Name and email -->
            <div
              class="grid grid-cols-2 gap-6
                     max-[600px]:grid-cols-1
                     max-[600px]:gap-5
                     max-[414px]:gap-4"
            >
              <div class="min-w-0">
                <label
                  for="contact-name"
                  class="mb-2 block text-sm font-semibold"
                  :class="language === 'km' ? 'font-khmer' : 'font-sans'"
                >
                  {{ t('Support.username') }}
                </label>
                <input
                  :disabled="busy"
                  id="contact-name"
                  v-model.trim="form.name"
                  name="name"
                  type="text"
                  autocomplete="name"
                  placeholder="ex.Mr Dev"
                  required
                  maxlength="100"
                  :class="inputClasses"
                />
              </div>
              <div class="min-w-0">
                <label
                  for="contact-email"
                  class="mb-2 block text-sm font-semibold"
                  :class="language === 'km' ? 'font-khmer' : 'font-sans'"
                >
                  {{ t('Support.email') }}
                </label>
                <input
                  :disabled="busy"
                  id="contact-email"
                  v-model.trim="form.email"
                  name="email"
                  type="email"
                  autocomplete="email"
                 placeholder="ex.mrdev123@gmail.com"
                  required
                  maxlength="254"
                  :class="inputClasses"
                />
              </div>
            </div>
            <!-- Topic -->
            <div>
              <label
                for="contact-topic"
                class="mb-2 block text-sm font-semibold"
                :class="language === 'km' ? 'font-khmer' : 'font-sans'"
              >
                {{ t('Support.problem') }}
              </label>
              <select
                  :disabled="busy"
                id="contact-topic"
                v-model="form.topic"
                name="topic"
                required
                :class="inputClasses"
              >
                <option disabled value="">{{ t('Support.select') }}</option>
                <option value="Account support">{{ t('Support.account') }}</option>
                <option value="Academy and courses">{{ t('Support.payment') }}</option>
                <option value="Other">{{ t('Support.other') }}</option>
              </select>
            </div>
            <!-- Subject -->
            <div>
              <label
                for="contact-subject"
                class="mb-2 block text-sm font-semibold"
                :class="language === 'km' ? 'font-khmer' : 'font-sans'"
              >
                {{ t('Support.subject') }}
              </label>
              <input
                  :disabled="busy"
                id="contact-subject"
                v-model.trim="form.subject"
                name="subject"
                type="text"
                placeholder="Other(optinal)"
                
                maxlength="150"
                :class="inputClasses"
              />
            </div>
            <!-- Message -->
            <div>
              <label
                for="contact-message"
                class="mb-2 block text-sm font-semibold"
                :class="language === 'km' ? 'font-khmer' : 'font-sans'"
              >
                {{ t('Support.message') }}
              </label>
              <textarea
                  :disabled="busy"
                id="contact-message"
                v-model="form.message"
                name="message"
                rows="6"
                placeholder="ex. Hello,សួស្ដី"
                required
                minlength="20"
                maxlength="2000"
                aria-describedby="message-hint"
                :class="inputClasses"
                class="min-h-36 resize-y max-[480px]:min-h-32"
              ></textarea>
              <div
                id="message-hint"
                class="mt-2 flex flex-wrap justify-between gap-2
                       text-xs text-slate-400"
              >
                <span>Minimum 20 characters.</span>
                <span>{{ form.message.length }}/2000</span>
              </div>
            </div>
            <!-- Send button -->
            <button
              type="submit"
              :disabled="busy"
              class="inline-flex min-h-12 cursor-pointer items-center
                     justify-center rounded-xl
                     bg-linear-to-r from-indigo-600 to-emerald-600
                     px-8 py-3.5 text-sm font-semibold text-white
                     transition-opacity hover:opacity-90 disabled:opacity-50
                     focus-visible:outline-2
                     focus-visible:outline-offset-4
                     focus-visible:outline-indigo-400
                     max-[480px]:w-full max-[480px]:px-5"
                     :class="language === 'km' ? 'font-khmer' : 'font-sans'"
            >
              {{ busy ? t('Support.sending...') : t('Support.sendMessage')  }}
            </button>
            <p class="text-xs leading-5 text-slate-400">
              Sign in before sending. Read replies in Dashboard → My Support.
              <RouterLink :to="localizedPath('/dashboard/support')" class="ml-1 font-semibold text-indigo-400 underline">Open My Support</RouterLink>
            </p>
            <p
              v-if="status"
              role="status"
              class="text-sm leading-6 text-slate-300"
            >
              {{ status }}
            </p>
            <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
          </form>
        </section>
      </div>
    </div>
  
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faFacebook, faTelegram } from '@fortawesome/free-brands-svg-icons'
import { faEnvelope } from '@fortawesome/free-solid-svg-icons'
import { supportApi, supportJson } from '../api/supportApi.js'
import { useI18n } from 'vue-i18n'

const { t, locale: language } = useI18n({
  useScope: 'global',
})
const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || 'cmmft.devsupport@gmail.com'
const channels = [
  { name: 'Facebook', description: 'Chat with us on Facebook.', href: 'https://www.facebook.com/thuntulaofficial01', icon: faFacebook, iconClass: 'bg-blue-500/10 text-blue-500', external: true },
  { name: 'Telegram', description: 'Chat with us directly on Telegram.', href: 'https://t.me/ThunTulaFT', icon: faTelegram, iconClass: 'bg-sky-500/10 text-sky-500', external: true },
  { name: 'Email', description: contactEmail, href: `mailto:${contactEmail}`, icon: faEnvelope, iconClass: 'bg-indigo-500/10 text-indigo-400', external: false },
]
const inputClasses = `block w-full min-w-0 rounded-xl border border-(--border-color) bg-(--page-bg) px-4 py-3 text-base text-(--text-color) placeholder:text-(--muted-color) outline-none transition-colors duration-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 max-[480px]:px-3 max-[320px]:px-2.5`
const form = reactive({ name: '', email: '', topic: '', subject: '', message: '' })
const status = ref(''), error = ref(''), busy = ref(false)
const route = useRoute()
const router = useRouter()
function localizedPath(path) { return route.params.lang === 'km' ? `/km${path}` : path }
async function sendMessage() {
  if (busy.value) return
  error.value = ''; status.value = ''
  if (form.message.trim().length < 20 || form.message.trim().length > 2000) {
    error.value = 'Please enter a message between 20 and 2000 characters.'; return
  }
  busy.value = true
  try {
    const data = await supportApi('/api/support/messages', supportJson('POST', {
      name: form.name.trim(), email: form.email.trim(), topic: form.topic,
      subject: form.subject.trim(), message: form.message.trim(),
    }))
    status.value = data.message
    form.topic = ''; form.subject = ''; form.message = ''
  } catch (err) {
    if (err.status === 401) {
      await router.push({ path: localizedPath('/login'), query: { redirect: localizedPath('/support') } })
    } else error.value = err.message
  } finally { busy.value = false }
}
</script>
