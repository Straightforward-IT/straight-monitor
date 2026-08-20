import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { createModalDock } from '../src'
import './playground.css'

createApp(App)
  .use(router)
  .use(createModalDock({ maxModals: 20 }))
  .mount('#app')
