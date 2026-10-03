<template>
  <main
    class="min-h-screen bg-(--page-bg) px-5 py-12
           text-(--text-color) transition-colors duration-300
           sm:px-8 sm:py-16"
  >
    <div class="mx-auto max-w-6xl">
      <!-- Original hero -->
      <div
        class="mb-10 rounded-2xl border border-indigo-400/30
               bg-linear-to-br from-indigo-500/20 to-purple-500/10
               p-6 sm:p-8"
      >
        <span
          class="inline-flex items-center gap-2 rounded-full
                 bg-(--page-bg) px-3 py-1 text-xs font-semibold
                 uppercase tracking-widest text-indigo-300
                 in-[.ligh-mode]:text-indigo-700"
        >
          <img
            src="../assets/static/broker/exness_icon.png"
            alt=""
            class="h-6 w-6 shrink-0 rounded-2xl object-cover"
          />
          Exness
        </span>

        <h2 class="mt-4 text-2xl font-bold sm:text-3xl">
          Best Broker I ever used with perfect condition place:
        </h2>

        <p class="mt-3 leading-7 text-(--muted-color)">
          Low Spread and No Commission.
        </p>

        <ul class="mt-5 space-y-3 text-sm text-(--muted-color)">
          <li>
            <strong class="text-(--text-color)">Minimum Deposit:</strong>
            10$
          </li>

          <li>
            <strong class="text-(--text-color)">Leverage:</strong>
            1:2000
          </li>

          <li>
            <strong class="text-(--text-color)">
              withdrawal and deposit local bank:
            </strong>
            ABA Bank , Wing Bank , ACLEDA Bank.
          </li>
        </ul>

        <a
          href="https://one.exnessonelink.com/a/q7fx6btblq"
          target="_blank"
          rel="sponsored noopener noreferrer"
          class="mt-6 inline-flex w-full items-center justify-center
                 gap-2 rounded-xl bg-indigo-600 px-6 py-3
                 font-semibold text-white transition-colors
                 hover:bg-indigo-500
                 focus-visible:outline-2
                 focus-visible:outline-offset-4
                 focus-visible:outline-indigo-500 sm:w-auto"
        >
          Register Now
          <span aria-hidden="true">↗</span>
        </a>

        <p class="mt-4 text-xs leading-5 text-(--muted-color)">
          Promotion terms and eligibility conditions apply.
        </p>
      </div>

      <!-- Broker heading -->
      <header class="mb-10 max-w-2xl">
        <p
          class="mb-3 text-xs font-semibold uppercase tracking-widest
                 text-indigo-400 in-[.ligh-mode]:text-indigo-700"
        >
          Collaborate
        </p>

        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
          Explore our broker partners
        </h1>

        <p class="mt-5 leading-7 text-(--muted-color)">
          Explore broker details and register using the links below.
        </p>
      </header>

      <!-- Search -->
      <div
        class="mb-7 flex flex-col gap-4
               sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2 class="text-xl font-semibold">
            Broker Details
          </h2>

          <p
            class="mt-1 text-sm text-(--muted-color)"
            aria-live="polite"
          >
            {{ filtered.length }} of {{ brokers.length }} brokers
          </p>
        </div>

        <div class="w-full sm:max-w-xs">
          <label
            for="broker-search"
            class="mb-2 block text-sm text-(--text-color)"
          >
            Search brokers
          </label>

          <input
            id="broker-search"
            v-model="search"
            type="search"
            placeholder="Search by name…"
            class="w-full rounded-xl border border-(--border-color)
                   bg-(--input-bg) px-4 py-3 text-(--text-color)
                   placeholder:text-(--muted-color)
                   transition-colors duration-300
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <!-- Broker cards -->
      <div
        v-if="filtered.length"
        class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        <article
          v-for="broker in filtered"
          :key="broker.id"
          class="flex min-w-0 flex-col overflow-hidden rounded-2xl
                 border border-(--border-color) bg-(--surface-bg)
                 transition-colors duration-300
                 hover:border-indigo-400/60"
        >
          <!-- Broker logo -->
          <div
            class="flex h-44 items-center justify-center
                   border-b border-(--border-color)
                   bg-(--input-bg) p-5 transition-colors duration-300"
          >
            <img
              v-if="broker.logo && !brokenLogos[broker.id]"
              :src="broker.logo"
              :alt="`${broker.name} logo`"
              class="h-full w-full rounded-xl object-contain"
              @error="brokenLogos[broker.id] = true"
            />

            <span
              v-else
              :class="broker.color"
              class="flex h-20 w-20 items-center justify-center
                     rounded-2xl text-3xl font-black"
              aria-hidden="true"
            >
              {{ broker.initials }}
            </span>
          </div>

          <!-- Broker content -->
          <div class="flex flex-1 flex-col p-6">
            <h3 class="text-2xl font-bold">
              {{ broker.name }}
            </h3>

            <p class="mt-3 text-sm leading-6 text-(--muted-color)">
              {{ broker.description || 'Full broker profile coming soon.' }}
            </p>

            <!-- Details -->
            <dl class="mb-6 mt-5 space-y-3">
              <div
                v-for="[key, label] in detailFields"
                :key="key"
                class="rounded-xl border border-(--border-color)
                       bg-(--page-bg) p-4
                       transition-colors duration-300"
              >
                <dt class="text-xs font-medium text-(--muted-color)">
                  {{ label }}
                </dt>

                <dd
                  class="mt-2 whitespace-pre-line break-words
                         text-sm font-semibold text-(--text-color)"
                >
                  {{
                    broker[key] === '' || broker[key] == null
                      ? 'Details coming soon'
                      : broker[key]
                  }}
                </dd>
              </div>
            </dl>

            <!-- Register -->
            <div class="mt-auto">
              <a
                v-if="safeUrl(broker.referralLink)"
                :href="safeUrl(broker.referralLink)"
                target="_blank"
                rel="sponsored noopener noreferrer"
                class="inline-flex w-full items-center justify-center
                       gap-2 rounded-xl bg-indigo-600 px-4 py-3
                       text-center text-sm font-semibold text-white
                       transition-colors hover:bg-indigo-500
                       focus-visible:outline-2
                       focus-visible:outline-offset-4
                       focus-visible:outline-indigo-500"
              >
                Register with {{ broker.name }}
                <span aria-hidden="true">↗</span>
              </a>

              <button
                v-else
                type="button"
                disabled
                class="w-full cursor-not-allowed rounded-xl
                       bg-(--input-bg) px-4 py-3 text-center
                       text-sm font-semibold text-(--muted-color)"
              >
                Registration coming soon
              </button>
            </div>
          </div>
        </article>
      </div>

      <!-- No search results -->
      <div
        v-else
        class="rounded-2xl border border-dashed
               border-(--border-color) p-10 text-center"
      >
        <p class="wrap-break-words text-(--text-color)">
          No brokers match “{{ search }}”.
        </p>

        <button
          type="button"
          class="mt-4 rounded px-3 py-2 text-indigo-300
                 underline hover:text-indigo-200
                 in-[.ligh-mode]:text-indigo-700
                 in-[.ligh-mode]:hover:text-indigo-900"
          @click="search = ''"
        >
          Clear search
        </button>
      </div>
    </div>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'

import exness from '../assets/static/partnerphoto/exness.jpg'
import cxm from '../assets/static/partnerphoto/cxm.jpg'
import lerunex from '../assets/static/partnerphoto/lerunex.jpg'

const search = ref('')
const brokenLogos = ref({})

// Add your verified broker details in the empty fields.
const brokers = [
  {
    id: 'exness',
    name: 'Exness',
    initials: 'EX',
    color: 'bg-yellow-300 text-slate-950',
    logo: exness,

    description: '  hellow',
    platforms: 'MT-4 ,MT-5',
    accounts: 'STANDARD , PRO , CENT',
    commission: 'No commission & Low spread ',
    minimumDeposit: '10$',
    bank: 'ABA, Wing, ACLEDA',

    referralLink: 'https://one.exnessonelink.com/a/q7fx6btblq',
  },

  {
    id: 'lirunex',
    name: 'Lirunex',
    initials: 'LX',
    color: 'bg-blue-500 text-white',
    logo: lerunex,

    description: '',
    platforms: 'MT-4 , MT-5',
    accounts: 'STANDARD, PRIME, PRO, CENT',
    commission: 'No commission & Low spread ',
    minimumDeposit: '10$',
    bank: 'ABA, Wing, ACLEDA',

    // Paste your Lirunex registration link here.
    referralLink: 'https://client.lirunextrd.com/auth/signup?partnerId=360768&affiliateId=65917',
  },

  {
    id: 'cxm-direct',
    name: 'CXM Direct',
    initials: 'CXM',
    color: 'bg-emerald-400 text-slate-950',
    logo: cxm,

    description: '',
    platforms: 'MT4 , MT5',
    accounts: 'STANDARD, CENT , ECN',
    commission: 'No commission & Low spread ',
    minimumDeposit: '10$`',
    bank: 'ABA, Wing, ACLEDA',

    // Paste your CXM registration link here.
    referralLink: 'https://secure.cxmys.com/links/go/346477',
  },
]

const detailFields = [
  ['platforms', 'Trading platforms'],
  ['accounts', 'Account types'],
  ['commission', 'Commissoin & Spread'],
  ['minimumDeposit', 'Minimum deposit'],
  ['bank', 'Bank Support(Deposit&Withdraw)'],
]

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()

  return brokers.filter((broker) =>
    broker.name.toLowerCase().includes(query),
  )
})

function safeUrl(value) {
  if (!value) return null

  try {
    const url = new URL(value)

    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
</script>