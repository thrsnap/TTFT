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
        >
          Contact <span class="text-indigo-500">Us</span>
        </h1>

        <p
          class="mx-auto mt-4 max-w-xl text-base leading-7
                 text-(--muted-color)
                 max-[600px]:text-sm max-[600px]:leading-6
                 max-[480px]:mt-3
                 max-[320px]:text-xs"
        >
          Have a question? Reach us on Facebook, Telegram,
          or send us an email.
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
          >
            Connect with us
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
          >
            Send a message
          </h2>

          <p class="mt-2 text-sm text-slate-400">
            All fields are required.
          </p>

          <form
            class="mt-8 space-y-6
                   max-[600px]:space-y-5
                   max-[480px]:mt-6
                   max-[414px]:space-y-4"
            @submit.prevent="prepareEmail"
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
                >
                  User name
                </label>

                <input
                  id="contact-name"
                  v-model.trim="form.name"
                  name="name"
                  type="text"
                  autocomplete="name"
                  placeholder="input your username"
                  required
                  maxlength="100"
                  :class="inputClasses"
                />
              </div>

              <div class="min-w-0">
                <label
                  for="contact-email"
                  class="mb-2 block text-sm font-semibold"
                >
                  Email address
                </label>

                <input
                  id="contact-email"
                  v-model.trim="form.email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  placeholder="you@example.com"
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
              >
                What do you need help with?
              </label>

              <select
                id="contact-topic"
                v-model="form.topic"
                name="topic"
                required
                :class="inputClasses"
              >
                <option disabled value="">Select a topic</option>
                <option value="General question">General question</option>
                <option value="Account support">Account support</option>
                <option value="Academy and courses">Academy and courses</option>
                <option value="Trading challenge">Trading challenge</option>
                <option value="Broker collaboration">Broker collaboration</option>
                <option value="Technical issue">Technical issue</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <!-- Subject -->
            <div>
              <label
                for="contact-subject"
                class="mb-2 block text-sm font-semibold"
              >
                Subject
              </label>

              <input
                id="contact-subject"
                v-model.trim="form.subject"
                name="subject"
                type="text"
                placeholder="Briefly describe your issue"
                required
                maxlength="150"
                :class="inputClasses"
              />
            </div>

            <!-- Message -->
            <div>
              <label
                for="contact-message"
                class="mb-2 block text-sm font-semibold"
              >
                Your message
              </label>

              <textarea
                id="contact-message"
                v-model="form.message"
                name="message"
                rows="6"
                placeholder="Please explain how we can help you..."
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
              class="inline-flex min-h-12 cursor-pointer items-center
                     justify-center rounded-xl
                     bg-linear-to-r from-indigo-600 to-emerald-600
                     px-8 py-3.5 text-sm font-semibold text-white
                     transition-opacity hover:opacity-90
                     focus-visible:outline-2
                     focus-visible:outline-offset-4
                     focus-visible:outline-indigo-400
                     max-[480px]:w-full max-[480px]:px-5"
            >
              Send message
            </button>

            <p class="text-xs leading-5 text-slate-400">
              Opens your email app. Review the message and press Send there.
            </p>

            <p
              v-if="status"
              role="status"
              class="text-sm leading-6 text-slate-300"
            >
              {{ status }}
            </p>
          </form>
        </section>
      </div>
    </div>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faFacebook,
  faTelegram,
} from '@fortawesome/free-brands-svg-icons'
import { faEnvelope } from '@fortawesome/free-solid-svg-icons'

// Replace these with your real contact details.
const contactEmail = 'your-email@example.com'
const facebookUrl = 'https://www.facebook.com/thuntulaofficial01'
const telegramUrl = 'https://t.me/ThunTulaFT'

const channels = [
  {
    name: 'Facebook',
    description: 'Chat with us in Facebook',
    href: facebookUrl,
    icon: faFacebook,
    iconClass: 'bg-blue-500/10 text-blue-500',
    external: true,
  },
  {
    name: 'Telegram',
    description: 'Chat with us directly on Telegram.',
    href: telegramUrl,
    icon: faTelegram,
    iconClass: 'bg-sky-500/10 text-sky-500',
    external: true,
  },
  {
    name: 'Email',
    description: contactEmail,
    href: `mailto:${contactEmail}`,
    icon: faEnvelope,
    iconClass: 'bg-indigo-500/10 text-indigo-400',
    external: false,
  },
]

const inputClasses = `
  block w-full min-w-0 rounded-xl
  border border-(--border-color)
  bg-(--page-bg) px-4 py-3
  text-base text-(--text-color)
  placeholder:text-(--muted-color)
  outline-none transition-colors duration-300
  focus:border-indigo-500
  focus:ring-2 focus:ring-indigo-500/20
  max-[480px]:px-3
  max-[320px]:px-2.5
`

const form = reactive({
  name: '',
  email: '',
  topic: '',
  subject: '',
  message: '',
})

const status = ref('')

function prepareEmail() {
  const message = form.message.trim()

  if (
    !form.name ||
    !form.email ||
    !form.topic ||
    !form.subject ||
    !message
  ) {
    status.value = 'Please complete all fields.'
    return
  }

  if (message.length < 20 || message.length > 2000) {
    status.value = 'Please enter a message between 20 and 2000 characters.'
    return
  }

  const subject = `[${form.topic}] ${form.subject}`
    .replace(/[\r\n]+/g, ' ')

  const body = [
    `Full name: ${form.name}`,
    `Email address: ${form.email}`,
    `Topic: ${form.topic}`,
    '',
    message,
  ].join('\n')

  window.location.href =
    `mailto:${contactEmail}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`

  status.value =
    'If your email app opened, review the message and press Send. ' +
    'Otherwise, copy your message and email us directly.'
}
</script>