import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Straight Monitor',
        short_name: 'Straight Monitor',
        description: 'Zentrale Orchestrierungsplattform von Straight Monitor.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'de',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
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
