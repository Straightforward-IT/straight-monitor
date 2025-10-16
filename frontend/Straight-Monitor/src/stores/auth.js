import { defineStore } from 'pinia';
import api from '@/utils/api';

export const useAuth = defineStore('auth', {
  state: () => ({ token: localStorage.getItem('token'), user: null }),
  getters: { isLoggedIn: s => !!s.token },
  actions: {
    setToken(t){ this.token = t; t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); },
    async fetchMe(){ const { data } = await api.get('/api/users/me'); this.user = data; return data; },
    logout(){ this.setToken(null); this.user = null; window.location.href = '/'; }
  }
});
