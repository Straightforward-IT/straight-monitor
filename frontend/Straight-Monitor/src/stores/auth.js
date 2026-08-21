import { defineStore } from 'pinia';
import api from '@/utils/api';
import { useDataCache } from '@/stores/dataCache';

export const useAuth = defineStore('auth', {
  state: () => ({ token: localStorage.getItem('token'), user: null }),
  getters: {
    isLoggedIn: s => !!s.token,
    kundenWatchlist: s => s.user?.kundenWatchlist ?? [],
    highlightedKunden: s => s.user?.highlightedKunden ?? [],
    highlightedInventoryItems: s => s.user?.highlightedInventoryItems ?? [],
  },
  actions: {
    setToken(t){ this.token = t; t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); },
    async fetchMe(){ const { data } = await api.get('/api/users/me'); this.user = data; return data; },
    async toggleKundeWatchlist(kundeId) {
      const { data } = await api.put('/api/users/me/kunden-watchlist/toggle', { kundeId });
      if (this.user) this.user.kundenWatchlist = data.kundenWatchlist;
    },
    async toggleHighlightedKunde(kundeId) {
      const { data } = await api.put('/api/users/me/highlighted-kunden/toggle', { kundeId });
      if (this.user) this.user.highlightedKunden = data.highlightedKunden;
    },
    async toggleHighlightedInventoryItem(itemId) {
      const { data } = await api.put('/api/users/me/highlighted-inventory-items/toggle', { itemId });
      if (this.user) this.user.highlightedInventoryItems = data.highlightedInventoryItems;
    },
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
