import { createApp } from 'vue'
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

const i18n = createI18n({
   legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    km,
  },
})
const pinia = createPinia() 

const app=createApp(App) 
app.use(pinia) 
app.component('font-awesome-icon', FontAwesomeIcon)
app.use(router) 
app.use(i18n)
useTheme()
app.mount('#app')
