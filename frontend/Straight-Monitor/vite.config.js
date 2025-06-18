import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
          additionalData: `@use "sass:color"; @import "@/assets/styles/global.scss";`,
           api: 'modern-compiler'
      }
    }
  }
})
