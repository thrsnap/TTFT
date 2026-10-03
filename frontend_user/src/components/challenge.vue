<template>
  <section
    class="bg-(--page-bg) px-5 py-16 text-(--text-color)
           transition-colors duration-300
           max-[768px]:px-4 max-[768px]:py-12
           max-[600px]:py-8
           max-[480px]:px-3 max-[480px]:py-5
           max-[414px]:px-2.5
           max-[320px]:px-2 max-[320px]:py-4"
  >
    <div class="mx-auto max-w-6xl">
      <!-- Heading -->
      <header
        class="mb-10 text-center
               max-[768px]:mb-8
               max-[600px]:mb-6
               max-[480px]:mb-5
               max-[414px]:mb-4
               max-[320px]:mb-3"
      >
        <h2
          class="text-[2rem] font-bold
                 max-[600px]:text-[1rem]
                 max-[480px]:text-[1.3rem]
                 max-[414px]:text-[1.25rem]
                 max-[320px]:text-[1.125rem]"  :class="{ 'font-khmer': language === 'km' }"
        >
          {{ t('challenge.title') }}
        </h2>
      </header>

      <!-- Challenge content -->
      <div
        class="overflow-hidden rounded-3xl
               border border-(--border-color)
               bg-(--surface-bg) p-6
               transition-colors duration-300 sm:p-10
               max-[768px]:p-6
               max-[600px]:p-5
               max-[480px]:rounded-2xl max-[480px]:p-4
               max-[414px]:p-3
               max-[320px]:rounded-xl max-[320px]:p-2.5"
      >
        <div
          class="grid items-center gap-10 lg:grid-cols-2
                 max-[768px]:gap-8
                 max-[600px]:gap-6
                 max-[480px]:gap-5
                 max-[414px]:gap-4
                 max-[320px]:gap-3"
        >
          <div class="min-w-0">
            <!-- Badges -->
            <div
              class="flex flex-wrap items-center gap-3
                     max-[768px]:gap-2.5
                     max-[600px]:gap-2
                     max-[480px]:gap-1.5
                     max-[414px]:gap-1
                     max-[320px]:gap-1"
            >
              <span
                class="inline-flex rounded-full border
                       border-emerald-600/30 bg-emerald-500/10
                       px-4 py-1.5 text-xs font-semibold
                       text-emerald-400
                       in-[.ligh-mode]:text-emerald-700
                       max-[768px]:px-3
                       max-[600px]:text-[11px]
                       max-[480px]:px-2.5 max-[480px]:py-1
                       max-[414px]:px-2 max-[414px]:text-[10px]
                       max-[320px]:px-1.5 max-[320px]:text-[9px] " :class="{ 'font-khmer': language === 'km' }"
              >
                {{t('challenge.demo')}}
              </span>

              <span
                class="inline-flex items-center gap-2 rounded-full
                       border border-amber-600/30 bg-amber-500/10
                       px-4 py-1.5 text-xs font-semibold
                       text-amber-300
                       in-[.ligh-mode]:text-amber-800
                       max-[768px]:px-3
                       max-[600px]:text-[11px]
                       max-[480px]:gap-1.5 max-[480px]:px-2.5
                       max-[480px]:py-1
                       max-[414px]:px-2 max-[414px]:text-[10px]
                       max-[320px]:px-1.5 max-[320px]:text-[9px]" :class="{ 'font-khmer': language === 'km' }"
              >
                <span
                  aria-hidden="true"
                  class="h-2 w-2 shrink-0 rounded-full
                         bg-red-600 opacity-70 motion-safe:animate-ping"
                ></span>
                {{t('challenge.announce')}}
              </span>
            </div>

            <h3
              class="mt-5 text-2xl font-bold sm:text-3xl
                     max-[768px]:text-[1.75rem]
                     max-[600px]:mt-4 max-[600px]:text-2xl
                     max-[480px]:text-xl
                     max-[414px]:mt-3 max-[414px]:text-lg
                     max-[320px]:text-base"
            >
              30 Days of Trading Discipline
            </h3>

            <p
              class="mt-4 leading-7 text-(--muted-color)
                     max-[768px]:text-[15px]
                     max-[600px]:text-sm max-[600px]:leading-6
                     max-[480px]:mt-3
                     max-[414px]:text-[13px]
                     max-[320px]:mt-2 max-[320px]:text-xs
                     max-[320px]:leading-5"
            >
              Choose one strategy and practice it on a demo account.
              Focus on following your rules and understanding your decisions.
            </p>

            <!-- Register -->
            <RouterLink
              to="/register"
              class="mt-6 inline-flex items-center justify-center
                     gap-2 rounded-xl bg-gray-600 px-6 py-3
                     text-sm font-semibold text-white
                     transition-colors hover:bg-gray-500
                     max-[768px]:mt-5
                     max-[600px]:px-5
                     max-[480px]:mt-4 max-[480px]:px-4
                     max-[414px]:text-[13px]
                     max-[320px]:mt-3 max-[320px]:text-xs"
            >
              Register
              <span aria-hidden="true">→</span>
            </RouterLink>

            <p
              class="mt-3 text-xs leading-6 text-(--muted-color)
                     max-[600px]:leading-5
                     max-[480px]:mt-2
                     max-[320px]:text-[11px]"
            >
              Create your account now. Challenge enrollment opens later.
            </p>
          </div>

          <!-- Challenge overview -->
          <dl
            class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2
                   max-[768px]:grid-cols-2
                   max-[768px]:gap-3
                   max-[600px]:gap-2.5
                   max-[480px]:gap-2
                   max-[414px]:gap-1.5
                   max-[320px]:gap-1"
          >
            <div
              class="rounded-2xl border border-(--border-color)
                     bg-(--page-bg) p-5 transition-colors duration-300
                     max-[768px]:p-4
                     max-[600px]:p-3.5
                     max-[480px]:rounded-xl max-[480px]:p-3
                     max-[414px]:p-2.5
                     max-[320px]:p-2"
            >
              <dt
                class="text-sm text-(--muted-color)
                       max-[480px]:text-xs
                       max-[320px]:text-[11px]"
              >
                Duration
              </dt>
              <dd
                class="mt-2 text-x font-bold
                       max-[768px]:text-[22px]
                       max-[600px]:text-x
                       max-[480px]:text-x
                       max-[414px]:text-x
                       max-[320px]:mt-1 max-[320px]:text-sm"
              >
                30 Days
              </dd>
            </div>

            <div
              class="rounded-2xl border border-(--border-color)
                     bg-(--page-bg) p-5 transition-colors duration-300
                     max-[768px]:p-4
                     max-[600px]:p-3.5
                     max-[480px]:rounded-xl max-[480px]:p-3
                     max-[414px]:p-2.5
                     max-[320px]:p-2"
            >
              <dt
                class="text-x text-(--muted-color)
                       max-[480px]:text-x
                       max-[320px]:text-[11px]"
              >
                Account
              </dt>
              <dd
                class="mt-2 text-x font-bold text-emerald-400
                       in-[.ligh-mode]:text-emerald-700
                       max-[768px]:text-[22px]
                       max-[600px]:text-x
                       max-[480px]:text-lg
                       max-[414px]:text-base
                       max-[320px]:mt-1 max-[320px]:text-sm"
              >
                Demo
              </dd>
            </div>

            <div
              class="rounded-2xl border border-(--border-color)
                     bg-(--page-bg) p-5 transition-colors duration-300
                     max-[768px]:p-4
                     max-[600px]:p-3.5
                     max-[480px]:rounded-xl max-[480px]:p-3
                     max-[414px]:p-2.5
                     max-[320px]:p-2"
            >
              <dt
                class="text-sm text-(--muted-color)
                       max-[480px]:text-xs
                       max-[320px]:text-[11px]"
              >
                Strategy
              </dt>
              <dd
                class="mt-2 text-x font-bold
                       max-[768px]:text-[22px]
                       max-[600px]:text-xl
                       max-[480px]:text-lg
                       max-[414px]:text-base
                       max-[320px]:mt-1 max-[320px]:text-sm"
              >
                Any (ICT...)
              </dd>
            </div>

            <div
              class="rounded-2xl border border-(--border-color)
                     bg-(--page-bg) p-5 transition-colors duration-300
                     max-[768px]:p-4
                     max-[600px]:p-3.5
                     max-[480px]:rounded-xl max-[480px]:p-3
                     max-[414px]:p-2.5
                     max-[320px]:p-2"
            >
              <dt
                class="text-x text-(--muted-color)
                       max-[480px]:text-xs
                       max-[320px]:text-[11px]"
              >
                Pair
              </dt>
              <dd
                class="mt-2 text-x font-bold text-indigo-300 
                       in-[.ligh-mode]:text-indigo-700
                       max-[600px]:text-lg
                       max-[480px]:text-base
                       max-[414px]:text-[15px]
                       max-[320px]:mt-1 max-[320px]:text-sm "
              >
                XAUUSD
              </dd>
            </div>
          </dl>
        </div>

        <!-- Rules -->
        <div
          id="challenge-rules"
          class="mt-10 scroll-mt-24 border-t
                 border-(--border-color) pt-8
                 max-[768px]:mt-8 max-[768px]:pt-6
                 max-[600px]:mt-6 max-[600px]:pt-5
                 max-[480px]:mt-5 max-[480px]:pt-4
                 max-[414px]:mt-4
                 max-[320px]:mt-3 max-[320px]:pt-3"
        >
          <h3
            class="mb-6 text-xl font-semibold
                   max-[768px]:mb-5
                   max-[600px]:text-lg
                   max-[480px]:mb-4 max-[480px]:text-base
                   max-[414px]:mb-3
                   max-[320px]:text-sm" :class="{ 'font-khmer': language === 'km' }"
          >
            {{ t('challenge.rule') }}
          </h3>

          <ol
            class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4
                   max-[768px]:grid-cols-2 max-[768px]:gap-5
                   max-[600px]:gap-4
                   max-[480px]:grid-cols-1
                   max-[414px]:gap-3
                   max-[320px]:gap-2.5"
          >
            <li>
              <span class="text-sm font-bold text-indigo-500">01</span>
              <h4
                class="mt-2 font-semibold
                       max-[600px]:text-sm
                       max-[414px]:text-[13px]
                       max-[320px]:mt-1 max-[320px]:text-xs"
              >
                Use a Demo Account
              </h4>
              <p
                class="mt-2 text-sm leading-6 text-(--muted-color)
                       max-[480px]:mt-1
                       max-[414px]:text-[13px]
                       max-[320px]:text-xs max-[320px]:leading-5"
              >
                Complete the challenge using virtual funds.
              </p>
            </li>

            <li>
              <span class="text-sm font-bold text-indigo-500">02</span>
              <h4
                class="mt-2 font-semibold
                       max-[600px]:text-sm
                       max-[414px]:text-[13px]
                       max-[320px]:mt-1 max-[320px]:text-xs"
              >
                Write Your Plan
              </h4>
              <p
                class="mt-2 text-sm leading-6 text-(--muted-color)
                       max-[480px]:mt-1
                       max-[414px]:text-[13px]
                       max-[320px]:text-xs max-[320px]:leading-5"
              >
                Define your setup, entry, exit, and practice risk limits
                before trading.
              </p>
            </li>

            <li>
              <span class="text-sm font-bold text-indigo-500">03</span>
              <h4
                class="mt-2 font-semibold
                       max-[600px]:text-sm
                       max-[414px]:text-[13px]
                       max-[320px]:mt-1 max-[320px]:text-xs"
              >
                Keep a Journal
              </h4>
              <p
                class="mt-2 text-sm leading-6 text-(--muted-color)
                       max-[480px]:mt-1
                       max-[414px]:text-[13px]
                       max-[320px]:text-xs max-[320px]:leading-5"
              >
                Record each trade with a screenshot and your reasons
                for taking it.
              </p>
            </li>

            <li>
              <span class="text-sm font-bold text-indigo-500">04</span>
              <h4
                class="mt-2 font-semibold
                       max-[600px]:text-sm
                       max-[414px]:text-[13px]
                       max-[320px]:mt-1 max-[320px]:text-xs"
              >
                Review Every Week
              </h4>
              <p
                class="mt-2 text-sm leading-6 text-(--muted-color)
                       max-[480px]:mt-1
                       max-[414px]:text-[13px]
                       max-[320px]:text-xs max-[320px]:leading-5"
              >
                Check whether you followed your rules and identify
                one habit to improve.
              </p>
            </li>
          </ol>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { RouterLink } from 'vue-router'

import { useI18n } from 'vue-i18n'

const { t, locale: language } = useI18n({
  useScope: 'global',
})
</script>