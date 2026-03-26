import { defineStore } from 'pinia';
import { useAuth } from './auth';
import { useDataCache } from './dataCache';
import api from '@/utils/api';

function getMaStandortFromPnr(personalnr) {
  const pnr = String(personalnr ?? '').trim();
  if (pnr.startsWith('1')) return 'Berlin';
  if (pnr.startsWith('2')) return 'Hamburg';
  if (pnr.startsWith('3')) return 'Köln';
  return null;
}

export const useDispoKommentare = defineStore('dispoKommentare', {
  state: () => ({
    kommentare: [],
    loading: false,
    von: null,
    bis: null,
    standortFilter: 'auto', // 'auto' = user's own location | null = Alle | 'Hamburg'|'Berlin'|'Köln'
  }),

  getters: {
    // Number of unread comments for the current user (excl. own), filtered by active standort
    unreadCount(state) {
      const auth = useAuth();
      const cache = useDataCache();
      const userId = String(auth.user?._id ?? '');
      if (!userId) return 0;

      const activeFilter = state.standortFilter === 'auto'
        ? (auth.user?.location ?? null)
        : state.standortFilter;

      const maMap = {};
      for (const ma of cache.mitarbeiter) {
        maMap[String(ma._id)] = ma;
      }

      return state.kommentare.filter((k) => {
        if (String(k.authorId) === userId) return false;
        if ((k.readBy ?? []).map(String).includes(userId)) return false;
        if (activeFilter) {
          const ma = maMap[String(k.mitarbeiter)];
          if (ma) {
            const maStandort = getMaStandortFromPnr(ma.personalnr);
            if (maStandort && maStandort !== activeFilter) return false;
          }
          // MA not in cache → include (fail open)
        }
        return true;
      }).length;
    },

    // Map: mitarbeiterId_iso → comments[]  (for O(1) cell lookups)
    kommentarMap(state) {
      const map = {};
      for (const k of state.kommentare) {
        const key = `${String(k.mitarbeiter)}_${k.datum}`;
        if (!map[key]) map[key] = [];
        map[key].push(k);
      }
      return map;
    },
  },

  actions: {
    getForCell(maId, iso) {
      return this.kommentarMap[`${String(maId)}_${iso}`] ?? [];
    },

    setStandortFilter(loc) {
      // loc: null = Alle, 'Hamburg'|'Berlin'|'Köln' = specific
      this.standortFilter = loc;
    },

    async fetch(von, bis) {
      this.loading = true;
      this.von = von;
      this.bis = bis;
      try {
        const { data } = await api.get(`/api/dispo-kommentare?von=${von}&bis=${bis}`);
        this.kommentare = data ?? [];
      } catch (err) {
        console.error('Kommentare laden fehlgeschlagen:', err);
      } finally {
        this.loading = false;
      }
    },

    async markRead(ids) {
      if (!ids?.length) return;
      try {
        await api.post('/api/dispo-kommentare/mark-read', { ids });
        const auth = useAuth();
        const userId = String(auth.user?._id ?? '');
        const idSet = new Set(ids.map(String));
        this.kommentare = this.kommentare.map((c) => {
          if (!idSet.has(String(c._id))) return c;
          const already = (c.readBy ?? []).map(String).includes(userId);
          if (already) return c;
          return { ...c, readBy: [...(c.readBy ?? []), userId] };
        });
      } catch (_) { /* silent */ }
    },

    async postComment(mitarbeiterId, datum, text) {
      const { data } = await api.post('/api/dispo-kommentare', { mitarbeiterId, datum, text });
      this.kommentare = [...this.kommentare, data];
      return data;
    },

    async deleteComment(id) {
      await api.delete(`/api/dispo-kommentare/${id}`);
      this.kommentare = this.kommentare.filter((c) => String(c._id) !== String(id));
    },
  },
});
