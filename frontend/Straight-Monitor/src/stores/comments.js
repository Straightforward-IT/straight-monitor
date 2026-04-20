/**
 * Unified comment store — replaces dispoKommentare.js + dispoAktivitaet.js
 *
 * Scopes: 'dispo_day' | 'chronik' | 'event_report' | ...
 *
 * Usage:
 *   const comments = useComments();
 *   await comments.fetch({ scope: 'dispo_day', von: '2026-04-01', bis: '2026-04-30' });
 *   await comments.fetch({ scope: 'chronik', mitarbeiterId: '...' });
 */
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

export const useComments = defineStore('comments', {
  state: () => ({
    items: [],        // Comment[]
    zvooveItems: [],  // Virtual comments from ZvooveVerfuegbarkeit.info (display-only, never persisted)
    loading: false,

    // For the KommentarFeed panel — standort + read filter
    standortFilter: 'auto', // 'auto' = user's own location | null = Alle | specific city

    // Track which scopes & ranges have been loaded to avoid redundant fetches
    _loadedKeys: new Set(),
  }),

  getters: {
    // Total unread (all scopes, all MAs), respecting standort filter — for HeaderBar badge
    unreadCount(state) {
      const auth = useAuth();
      const cache = useDataCache();
      const userId = String(auth.user?._id ?? '');
      if (!userId) return 0;

      const activeFilter = state.standortFilter === 'auto'
        ? (auth.user?.location ?? null)
        : state.standortFilter;

      const maMap = {};
      for (const ma of cache.mitarbeiter) maMap[String(ma._id)] = ma;

      return state.items.filter((c) => {
        if (String(c.authorId) === userId) return false;
        if ((c.readBy ?? []).map(String).includes(userId)) return false;
        if (activeFilter && c.context?.mitarbeiter) {
          const ma = maMap[String(c.context.mitarbeiter)];
          if (ma) {
            const maStandort = getMaStandortFromPnr(ma.personalnr);
            if (maStandort && maStandort !== activeFilter) return false;
          }
        }
        return true;
      }).length;
    },

    // Unread count by scope — for scope-specific badges (respects standort filter)
    unreadCountByScope(state) {
      const auth = useAuth();
      const cache = useDataCache();
      const userId = String(auth.user?._id ?? '');

      const activeFilter = state.standortFilter === 'auto'
        ? (auth.user?.location ?? null)
        : state.standortFilter;

      const maMap = {};
      for (const ma of cache.mitarbeiter) maMap[String(ma._id)] = ma;

      const counts = {};
      for (const c of state.items) {
        if (String(c.authorId) === userId) continue;
        if ((c.readBy ?? []).map(String).includes(userId)) continue;
        if (activeFilter && c.context?.mitarbeiter) {
          const ma = maMap[String(c.context.mitarbeiter)];
          if (ma) {
            const maStandort = getMaStandortFromPnr(ma.personalnr);
            if (maStandort && maStandort !== activeFilter) continue;
          }
        }
        counts[c.scope] = (counts[c.scope] ?? 0) + 1;
      }
      return counts;
    },

    // Lookup map for 'dispo_day' scope: "maId_YYYY-MM-DD" → Comment[]
    // Merges real DB comments with virtual Zvoove comments (zvooveItems).
    dispoDayMap(state) {
      const map = {};
      for (const c of [...state.items, ...state.zvooveItems]) {
        if (c.scope !== 'dispo_day') continue;
        const key = `${String(c.context?.mitarbeiter)}_${c.context?.datum}`;
        if (!map[key]) map[key] = [];
        map[key].push(c);
      }
      return map;
    },

    // All chronik entries for a given MA — sorted ascending (used by DispoTable)
    chronikForMa: (state) => (maId) => {
      return state.items
        .filter(c => c.scope === 'chronik' && String(c.context?.mitarbeiter) === String(maId))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    },
  },

  actions: {
    // Helper: unread count for a single MA's chronik — called as method from DispoTable
    chronikUnreadForMa(maId) {
      const auth = useAuth();
      const userId = String(auth.user?._id ?? '');
      return this.items.filter(c => {
        if (c.scope !== 'chronik') return false;
        if (String(c.context?.mitarbeiter) !== String(maId)) return false;
        if (String(c.authorId) === userId) return false;
        if ((c.readBy ?? []).map(String).includes(userId)) return false;
        return true;
      }).length;
    },

    // Helper: unread count for a single dispo cell
    cellUnreadCount(maId, datum) {
      const auth = useAuth();
      const userId = String(auth.user?._id ?? '');
      const cell = this.dispoDayMap[`${String(maId)}_${datum}`] ?? [];
      return cell.filter(c =>
        String(c.authorId) !== userId &&
        !(c.readBy ?? []).map(String).includes(userId)
      ).length;
    },

    // Helper: get dispo cell comments
    getCellComments(maId, datum) {
      return this.dispoDayMap[`${String(maId)}_${datum}`] ?? [];
    },

    setStandortFilter(loc) {
      this.standortFilter = loc;
    },

    /**
     * Fetch comments for a scope + optional filters.
     * @param {object} opts
     * @param {string} opts.scope         — required
     * @param {string} [opts.von]         — date range start (dispo_day)
     * @param {string} [opts.bis]         — date range end  (dispo_day)
     * @param {string} [opts.mitarbeiterId] — filter by MA
     */
    async fetch({ scope, von, bis, mitarbeiterId } = {}) {
      if (!scope) throw new Error('scope required');
      this.loading = true;
      try {
        const params = new URLSearchParams({ scope });
        if (von) params.set('von', von);
        if (bis) params.set('bis', bis);
        if (mitarbeiterId) params.set('mitarbeiterId', mitarbeiterId);

        const { data } = await api.get(`/api/comments?${params}`);

        // Detect new chronik items from other users → browser notification
        if (scope === 'chronik' && Notification.permission === 'granted') {
          const auth = useAuth();
          const cache = useDataCache();
          const userId = String(auth.user?._id ?? '');
          const userLocation = auth.user?.location ?? null;
          const existingIds = new Set(this.items.map(c => String(c._id)));

          const maMap = {};
          for (const ma of cache.mitarbeiter) maMap[String(ma._id)] = ma;

          for (const c of data) {
            if (existingIds.has(String(c._id))) continue;          // already known
            if (String(c.authorId) === userId) continue;           // own entry
            if (c.scope !== 'chronik') continue;

            const ma = maMap[String(c.context?.mitarbeiter)];
            if (!ma) continue;

            // Only notify for MAs at the user's own location
            if (userLocation) {
              const maStandort = getMaStandortFromPnr(ma.personalnr);
              if (maStandort && maStandort !== userLocation) continue;
            }

            const maName = [ma.vorname, ma.nachname].filter(Boolean).join(' ') || 'Unbekannt';
            new Notification('Neuer Chronik-Eintrag', {
              body: `${c.author || 'Jemand'} hat einen Eintrag bei ${maName} hinterlassen.`,
              icon: '/favicon.ico',
              tag: `chronik-${String(c._id)}`,   // deduplicates identical notifications
            });
          }
        }

        // Merge: remove existing items with this scope (+ optional MA filter), then add new ones
        this.items = [
          ...this.items.filter(c => {
            if (c.scope !== scope) return true;
            if (mitarbeiterId && String(c.context?.mitarbeiter) !== String(mitarbeiterId)) return true;
            return false;
          }),
          ...data,
        ];
      } catch (err) {
        console.error('comments fetch fehlgeschlagen:', err);
      } finally {
        this.loading = false;
      }
    },

    async post({ scope, text, context = {} }) {
      const { data } = await api.post('/api/comments', { scope, text, context });
      this.items = [...this.items, data];
      return data;
    },

    async delete(id) {
      await api.delete(`/api/comments/${id}`);
      this.items = this.items.filter(c => String(c._id) !== String(id));
    },

    async markRead(ids) {
      if (!ids?.length) return;
      try {
        await api.post('/api/comments/mark-read', { ids });
        const auth = useAuth();
        const userId = String(auth.user?._id ?? '');
        const idSet = new Set(ids.map(String));
        this.items = this.items.map((c) => {
          if (!idSet.has(String(c._id))) return c;
          if ((c.readBy ?? []).map(String).includes(userId)) return c;
          return { ...c, readBy: [...(c.readBy ?? []), userId] };
        });
      } catch (_) { /* silent */ }
    },

    async markReadForMa(maId) {
      const auth = useAuth();
      const userId = String(auth.user?._id ?? '');
      const ids = this.items
        .filter(c =>
          c.scope === 'chronik' &&
          String(c.context?.mitarbeiter) === String(maId) &&
          String(c.authorId) !== userId &&
          !(c.readBy ?? []).map(String).includes(userId)
        )
        .map(c => c._id);
      if (ids.length) await this.markRead(ids);
    },

    async markAllRead() {
      const auth = useAuth();
      const userId = String(auth.user?._id ?? '');
      const ids = this.items
        .filter(c => String(c.authorId) !== userId && !(c.readBy ?? []).map(String).includes(userId))
        .map(c => c._id);
      if (ids.length) await this.markRead(ids);
    },
  },
});
