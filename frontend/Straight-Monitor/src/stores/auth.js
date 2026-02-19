import { defineStore } from 'pinia';
import api from '@/utils/api';
import { useDataCache } from '@/stores/dataCache';

export const useAuth = defineStore('auth', {
  state: () => ({ token: localStorage.getItem('token'), user: null }),
  getters: { isLoggedIn: s => !!s.token },
  actions: {
    setToken(t){ this.token = t; t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); },
    async fetchMe(){ const { data } = await api.get('/api/users/me'); this.user = data; return data; },
    async logout() {
      // Clear IndexedDB cache so stale data is not shown after re-login
      try { await useDataCache().clearAllCaches(); } catch (e) { console.warn('[Auth] Cache clear failed:', e); }
      // Clear session-persisted filter state
      sessionStorage.clear();
      this.setToken(null);
      this.user = null;
      window.location.href = '/';
    }
  }
});
