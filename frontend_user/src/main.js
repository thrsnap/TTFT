import { createApp, h, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from '../src/locales/langs/en.js'
import km from '../src/locales/langs/km.js'
import router from './router/index.js'
import './assets/tailwind.css'
import App from './App.vue'
import './assets/main.css'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useTheme } from './composable/useTheme.js'
import {
  startPageLoading,
  stopPageLoading,
} from './composable/usePageLoading.js'
import PushNotifications from './components/PushNotifications.vue'
import { configurePushInstallMetadata } from './api/pushInstall.js'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, km },
})

router.beforeEach(async (to, from) => {
  if (to.fullPath === from.fullPath) return

  startPageLoading()
  await nextTick()
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve)
    })
  })
})

router.afterEach(() => {
  stopPageLoading()
})

router.onError(() => {
  stopPageLoading()
})

const pinia = createPinia()

// Mount the notification controls alongside App, using the same Pinia and router.
const app = createApp({
  name: 'CmmRoot',
  render: () => [h(App), h(PushNotifications)],
})

app.use(pinia)
app.component('font-awesome-icon', FontAwesomeIcon)
app.use(router)
app.use(i18n)
configurePushInstallMetadata(import.meta.env.BASE_URL || '/')
useTheme()
app.mount('#app')
