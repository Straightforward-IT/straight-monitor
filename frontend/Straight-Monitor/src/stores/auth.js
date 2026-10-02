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
    employeeNameFormat: s => s.user?.preferences?.display?.employeeNameFormat || 'first-last',
  },
  actions: {
    setToken(t){ this.token = t; t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); },
    async fetchMe(){ const { data } = await api.get('/api/users/me'); this.user = data; return data; },
    async updatePreferences(preferences) {
      const previous = this.user?.preferences
        ? JSON.parse(JSON.stringify(this.user.preferences))
        : {};
      if (this.user) {
        this.user.preferences = {
          ...previous,
          ...(preferences.appearance ? { appearance: { ...previous.appearance, ...preferences.appearance } } : {}),
          ...(preferences.display ? { display: { ...previous.display, ...preferences.display } } : {}),
        };
      }
      try {
        const { data } = await api.patch('/api/users/me/preferences', { preferences });
        if (this.user) this.user.preferences = data.preferences;
        return data.preferences;
      } catch (error) {
        if (this.user) this.user.preferences = previous;
        throw error;
      }
    },
    async updateProfile(name) {
      const { data } = await api.patch('/api/users/me/profile', { name });
      this.user = { ...this.user, ...data.user };
      return data.user;
    },
    async changePassword(currentPassword, newPassword) {
      const { data } = await api.put('/api/users/me/password', { currentPassword, newPassword });
      return data;
    },
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
