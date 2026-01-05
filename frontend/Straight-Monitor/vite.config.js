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
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true
      }
    }
  }
})
