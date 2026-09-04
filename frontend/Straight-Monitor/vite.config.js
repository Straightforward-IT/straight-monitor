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
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Keep rarely-changing vendor code in stable chunks so app deploys don't bust their cache.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@fortawesome')) return 'vendor-fontawesome';
          if (/node_modules\/(vue|@vue|vue-router|pinia)\//.test(id)) return 'vendor-vue';
          return undefined;
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        timeout: 600000,      // 10 min – large Excel imports
        proxyTimeout: 600000
      }
    }
  }
})
