import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(),
     tailwindcss(),
  ],

  server: {
  proxy: {
    '/forex-calendar': {
      target: 'https://nfs.faireconomy.media',
      changeOrigin: true,
      rewrite: () => '/ff_calendar_thisweek.json',
    },
  },
},
})
