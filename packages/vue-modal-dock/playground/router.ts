import { createRouter, createWebHistory } from 'vue-router'
import PageOne from './views/PageOne.vue'
import PageTwo from './views/PageTwo.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: PageOne },
    { path: '/second', component: PageTwo },
  ],
})
