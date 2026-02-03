import { defineStore } from 'pinia';
import api from '@/utils/api';

/**
 * Cache Store für optimierte Datenabfragen
 * 
 * Speichert Daten in IndexedDB und synchronisiert nur geänderte Dokumente.
 * Reduziert API-Anfragen erheblich nach dem initialen Laden.
 */

const DB_NAME = 'StraightMonitorCache';
const DB_VERSION = 3;
const STORES = ['mitarbeiter', 'items', 'auftraege', 'kunden', 'documents', 'flipusers'];

// IndexedDB Helper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          // FlipUsers use 'id' as primary key, others use '_id'
          const keyPath = storeName === 'flipusers' ? 'id' : '_id';
          const store = db.createObjectStore(storeName, { keyPath });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      });
      
      // Meta store für lastSync timestamps
      if (!db.objectStoreNames.contains('_meta')) {
        db.createObjectStore('_meta', { keyPath: 'key' });
      }
    };
  });
}

async function getFromStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToStore(storeName, items) {
  if (!items || items.length === 0) return;
  
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    items.forEach(item => {
      store.put(item);
    });
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromStore(storeName, ids) {
  if (!ids || ids.length === 0) return;
  
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    ids.forEach(id => {
      store.delete(id);
    });
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getMeta(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('_meta', 'readonly');
    const store = tx.objectStore('_meta');
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

async function setMeta(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('_meta', 'readwrite');
    const store = tx.objectStore('_meta');
    store.put({ key, value });
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const useDataCache = defineStore('dataCache', {
  state: () => ({
    // In-memory cache
    mitarbeiter: [],
    items: [],
    auftraege: [],
    kunden: [],
    documents: [],
    flipusers: [],
    
    // Loading states
    loading: {
      mitarbeiter: false,
      items: false,
      auftraege: false,
      kunden: false,
      documents: false,
      flipusers: false
    },
    
    // Last sync timestamps
    lastSync: {
      mitarbeiter: null,
      items: null,
      auftraege: null,
      kunden: null,
      documents: null,
      flipusers: null
    },
    
    // Sync status
    syncing: {
      mitarbeiter: false,
      items: false,
      documents: false,
      auftraege: false,
      kunden: false,
      flipusers: false
    }
  }),
  
  getters: {
    isLoading: (state) => (key) => state.loading[key],
    isSyncing: (state) => (key) => state.syncing[key],
    getLastSync: (state) => (key) => state.lastSync[key],
    
    // Check if cache is stale (older than 5 minutes)
    isCacheStale: (state) => (key, maxAgeMinutes = 5) => {
      const lastSync = state.lastSync[key];
      if (!lastSync) return true;
      const ageMs = Date.now() - new Date(lastSync).getTime();
      return ageMs > maxAgeMinutes * 60 * 1000;
    }
  },
  
  actions: {
    /**
     * Load data with smart caching
     * 1. Return cached data immediately if available
     * 2. Sync in background if cache is stale
     */
    async loadMitarbeiter(forceRefresh = false) {
      // Prevent concurrent loads
      if (this.loading.mitarbeiter) return this.mitarbeiter;
      
      try {
        this.loading.mitarbeiter = true;
        
        // Try to load from IndexedDB first
        if (!forceRefresh && this.mitarbeiter.length === 0) {
          const cached = await getFromStore('mitarbeiter');
          if (cached && cached.length > 0) {
            this.mitarbeiter = cached;
            this.lastSync.mitarbeiter = await getMeta('lastSync_mitarbeiter');
            console.log(`[Cache] Loaded ${cached.length} Mitarbeiter from cache`);
          }
        }
        
        // If no cache or force refresh, do full load
        if (forceRefresh || this.mitarbeiter.length === 0) {
          await this.fullSyncMitarbeiter();
        } else if (this.isCacheStale('mitarbeiter')) {
          // Sync in background
          this.incrementalSyncMitarbeiter();
        }
        
        return this.mitarbeiter;
      } finally {
        this.loading.mitarbeiter = false;
      }
    },
    
    async fullSyncMitarbeiter() {
      try {
        console.log('[Cache] Full sync Mitarbeiter...');
        const response = await api.get('/api/personal/mitarbeiter');
        const data = response.data?.data || response.data || [];
        
        // Clear and save to IndexedDB
        await clearStore('mitarbeiter');
        await saveToStore('mitarbeiter', data);
        
        // Update state
        this.mitarbeiter = data;
        this.lastSync.mitarbeiter = new Date().toISOString();
        await setMeta('lastSync_mitarbeiter', this.lastSync.mitarbeiter);
        
        console.log(`[Cache] Full sync complete: ${data.length} Mitarbeiter`);
        return data;
      } catch (error) {
        console.error('[Cache] Full sync Mitarbeiter failed:', error);
        throw error;
      }
    },
    
    async incrementalSyncMitarbeiter() {
      if (this.syncing.mitarbeiter) return;
      
      try {
        this.syncing.mitarbeiter = true;
        const since = this.lastSync.mitarbeiter;
        
        console.log(`[Cache] Incremental sync Mitarbeiter since ${since}...`);
        
        // Fetch only updated documents
        const response = await api.get('/api/personal/mitarbeiter/sync', {
          params: { since }
        });
        
        const { updated = [], deleted = [] } = response.data;
        
        if (updated.length > 0) {
          // Update IndexedDB
          await saveToStore('mitarbeiter', updated);
          
          // Update in-memory cache
          updated.forEach(item => {
            const idx = this.mitarbeiter.findIndex(m => m._id === item._id);
            if (idx >= 0) {
              this.mitarbeiter[idx] = item;
            } else {
              this.mitarbeiter.push(item);
            }
          });
        }
        
        if (deleted.length > 0) {
          await deleteFromStore('mitarbeiter', deleted);
          this.mitarbeiter = this.mitarbeiter.filter(m => !deleted.includes(m._id));
        }
        
        this.lastSync.mitarbeiter = new Date().toISOString();
        await setMeta('lastSync_mitarbeiter', this.lastSync.mitarbeiter);
        
        console.log(`[Cache] Incremental sync: ${updated.length} updated, ${deleted.length} deleted`);
      } catch (error) {
        console.error('[Cache] Incremental sync failed:', error);
        // Fallback to full sync
        await this.fullSyncMitarbeiter();
      } finally {
        this.syncing.mitarbeiter = false;
      }
    },
    
    /**
     * Items (Bestand)
     */
    async loadItems(forceRefresh = false) {
      if (this.loading.items) return this.items;
      
      try {
        this.loading.items = true;
        
        if (!forceRefresh && this.items.length === 0) {
          const cached = await getFromStore('items');
          if (cached && cached.length > 0) {
            this.items = cached;
            this.lastSync.items = await getMeta('lastSync_items');
            console.log(`[Cache] Loaded ${cached.length} Items from cache`);
          }
        }
        
        if (forceRefresh || this.items.length === 0) {
          await this.fullSyncItems();
        } else if (this.isCacheStale('items')) {
          this.incrementalSyncItems();
        }
        
        return this.items;
      } finally {
        this.loading.items = false;
      }
    },
    
    async fullSyncItems() {
      try {
        console.log('[Cache] Full sync Items...');
        const response = await api.get('/api/items');
        const data = response.data?.data || response.data || [];
        
        await clearStore('items');
        await saveToStore('items', data);
        
        this.items = data;
        this.lastSync.items = new Date().toISOString();
        await setMeta('lastSync_items', this.lastSync.items);
        
        console.log(`[Cache] Full sync complete: ${data.length} Items`);
        return data;
      } catch (error) {
        console.error('[Cache] Full sync Items failed:', error);
        throw error;
      }
    },
    
    async incrementalSyncItems() {
      if (this.syncing.items) return;
      
      try {
        this.syncing.items = true;
        const since = this.lastSync.items;
        
        const response = await api.get('/api/items/sync', {
          params: { since }
        });
        
        const { updated = [], deleted = [] } = response.data;
        
        if (updated.length > 0) {
          await saveToStore('items', updated);
          updated.forEach(item => {
            const idx = this.items.findIndex(i => i._id === item._id);
            if (idx >= 0) {
              this.items[idx] = item;
            } else {
              this.items.push(item);
            }
          });
        }
        
        if (deleted.length > 0) {
          await deleteFromStore('items', deleted);
          this.items = this.items.filter(i => !deleted.includes(i._id));
        }
        
        this.lastSync.items = new Date().toISOString();
        await setMeta('lastSync_items', this.lastSync.items);
        
        console.log(`[Cache] Items sync: ${updated.length} updated, ${deleted.length} deleted`);
      } catch (error) {
        console.error('[Cache] Items sync failed, falling back to full sync');
        await this.fullSyncItems();
      } finally {
        this.syncing.items = false;
      }
    },
    
    /**
     * Documents (Dokumente)
     */
    async loadDocuments(forceRefresh = false) {
      if (this.loading.documents) return this.documents;
      
      try {
        this.loading.documents = true;
        
        if (!forceRefresh && this.documents.length === 0) {
          const cached = await getFromStore('documents');
          if (cached && cached.length > 0) {
            this.documents = cached;
            this.lastSync.documents = await getMeta('lastSync_documents');
            console.log(`[Cache] Loaded ${cached.length} Documents from cache`);
          }
        }
        
        if (forceRefresh || this.documents.length === 0) {
          await this.fullSyncDocuments();
        } else if (this.isCacheStale('documents')) {
          this.incrementalSyncDocuments();
        }
        
        return this.documents;
      } finally {
        this.loading.documents = false;
      }
    },
    
    async fullSyncDocuments() {
      try {
        console.log('[Cache] Full sync Documents...');
        const response = await api.get('/api/wordpress/reports');
        const data = response.data?.data || response.data || [];
        
        await clearStore('documents');
        await saveToStore('documents', data);
        
        this.documents = data;
        this.lastSync.documents = new Date().toISOString();
        await setMeta('lastSync_documents', this.lastSync.documents);
        
        console.log(`[Cache] Full sync complete: ${data.length} Documents`);
        return data;
      } catch (error) {
        console.error('[Cache] Full sync Documents failed:', error);
        throw error;
      }
    },
    
    async incrementalSyncDocuments() {
      if (this.syncing.documents) return;
      
      try {
        this.syncing.documents = true;
        const since = this.lastSync.documents;
        
        const response = await api.get('/api/wordpress/reports/sync', {
          params: { since }
        });
        
        const { updated = [], deleted = [] } = response.data;
        
        if (updated.length > 0) {
          await saveToStore('documents', updated);
          updated.forEach(doc => {
            const idx = this.documents.findIndex(d => d._id === doc._id);
            if (idx >= 0) {
              this.documents[idx] = doc;
            } else {
              this.documents.push(doc);
            }
          });
        }
        
        if (deleted.length > 0) {
          await deleteFromStore('documents', deleted);
          this.documents = this.documents.filter(d => !deleted.includes(d._id));
        }
        
        this.lastSync.documents = new Date().toISOString();
        await setMeta('lastSync_documents', this.lastSync.documents);
        
        console.log(`[Cache] Documents sync: ${updated.length} updated, ${deleted.length} deleted`);
      } catch (error) {
        console.error('[Cache] Documents sync failed, falling back to full sync');
        await this.fullSyncDocuments();
      } finally {
        this.syncing.documents = false;
      }
    },
    
    /**
     * Aufträge
     */
    async loadAuftraege(forceRefresh = false) {
      if (this.loading.auftraege) return this.auftraege;
      
      try {
        this.loading.auftraege = true;
        
        if (forceRefresh) {
          return await this.fullSyncAuftraege();
        }
        
        // Try to load from IndexedDB
        const cached = await getFromStore('auftraege');
        
        if (cached.length > 0) {
          this.auftraege = cached;
          console.log(`[Cache] Loaded ${cached.length} Aufträge from IndexedDB`);
          
          // Check if cache is stale (>5 minutes)
          const lastSync = await getMeta('lastSync_auftraege');
          if (lastSync) {
            const cacheAge = Date.now() - new Date(lastSync).getTime();
            if (cacheAge > 5 * 60 * 1000) {
              console.log('[Cache] Aufträge cache is stale, syncing in background...');
              this.incrementalSyncAuftraege();
            }
          }
          
          return this.auftraege;
        }
        
        // No cache, do full sync
        return await this.fullSyncAuftraege();
        
      } catch (error) {
        console.error('[Cache] Error loading Aufträge:', error);
        throw error;
      } finally {
        this.loading.auftraege = false;
      }
    },
    
    async fullSyncAuftraege() {
      try {
        console.log('[Cache] Full sync Aufträge...');
        const response = await api.get('/api/auftraege');
        const data = response.data || [];
        
        await clearStore('auftraege');
        await saveToStore('auftraege', data);
        
        this.auftraege = data;
        this.lastSync.auftraege = new Date().toISOString();
        await setMeta('lastSync_auftraege', this.lastSync.auftraege);
        
        console.log(`[Cache] Full sync complete: ${data.length} Aufträge`);
        return data;
      } catch (error) {
        console.error('[Cache] Full sync Aufträge failed:', error);
        throw error;
      }
    },
    
    async incrementalSyncAuftraege() {
      if (this.syncing.auftraege) return;
      
      try {
        this.syncing.auftraege = true;
        const since = this.lastSync.auftraege;
        
        const response = await api.get('/api/auftraege/sync', {
          params: { since }
        });
        
        const { updated = [], deleted = [] } = response.data;
        
        if (updated.length > 0) {
          await saveToStore('auftraege', updated);
          updated.forEach(auftrag => {
            const idx = this.auftraege.findIndex(a => a._id === auftrag._id);
            if (idx >= 0) {
              this.auftraege[idx] = auftrag;
            } else {
              this.auftraege.push(auftrag);
            }
          });
        }
        
        if (deleted.length > 0) {
          await deleteFromStore('auftraege', deleted);
          this.auftraege = this.auftraege.filter(a => !deleted.includes(a._id));
        }
        
        this.lastSync.auftraege = new Date().toISOString();
        await setMeta('lastSync_auftraege', this.lastSync.auftraege);
        
        console.log(`[Cache] Aufträge sync: ${updated.length} updated, ${deleted.length} deleted`);
      } catch (error) {
        console.error('[Cache] Aufträge sync failed, falling back to full sync');
        await this.fullSyncAuftraege();
      } finally {
        this.syncing.auftraege = false;
      }
    },
    
    /**
     * Kunden (extracted from Aufträge)
     */
    async loadKunden(forceRefresh = false) {
      if (this.loading.kunden) return this.kunden;
      
      try {
        this.loading.kunden = true;
        
        if (forceRefresh) {
          return await this.fullSyncKunden();
        }
        
        // Try to load from IndexedDB
        const cached = await getFromStore('kunden');
        
        if (cached.length > 0) {
          this.kunden = cached;
          console.log(`[Cache] Loaded ${cached.length} Kunden from IndexedDB`);
          
          // Check if cache is stale (>5 minutes)
          const lastSync = await getMeta('lastSync_kunden');
          if (lastSync) {
            const cacheAge = Date.now() - new Date(lastSync).getTime();
            if (cacheAge > 5 * 60 * 1000) {
              console.log('[Cache] Kunden cache is stale, syncing in background...');
              this.incrementalSyncKunden();
            }
          }
          
          return this.kunden;
        }
        
        // No cache, do full sync
        return await this.fullSyncKunden();
        
      } catch (error) {
        console.error('[Cache] Error loading Kunden:', error);
        throw error;
      } finally {
        this.loading.kunden = false;
      }
    },
    
    async fullSyncKunden() {
      try {
        console.log('[Cache] Full sync Kunden...');
        // Kunden are embedded in Aufträge response, extract unique Kunden
        const auftraege = await this.loadAuftraege();
        const kundenMap = new Map();
        
        auftraege.forEach(auftrag => {
          if (auftrag.kundeData && auftrag.kundeData._id) {
            kundenMap.set(auftrag.kundeData._id, auftrag.kundeData);
          }
        });
        
        const data = Array.from(kundenMap.values());
        
        await clearStore('kunden');
        await saveToStore('kunden', data);
        
        this.kunden = data;
        this.lastSync.kunden = new Date().toISOString();
        await setMeta('lastSync_kunden', this.lastSync.kunden);
        
        console.log(`[Cache] Full sync complete: ${data.length} Kunden`);
        return data;
      } catch (error) {
        console.error('[Cache] Full sync Kunden failed:', error);
        throw error;
      }
    },
    
    async incrementalSyncKunden() {
      if (this.syncing.kunden) return;
      
      try {
        this.syncing.kunden = true;
        
        // Since Kunden are derived from Aufträge, sync Aufträge first
        await this.incrementalSyncAuftraege();
        
        // Then extract updated Kunden
        const kundenMap = new Map();
        this.auftraege.forEach(auftrag => {
          if (auftrag.kundeData && auftrag.kundeData._id) {
            kundenMap.set(auftrag.kundeData._id, auftrag.kundeData);
          }
        });
        
        const data = Array.from(kundenMap.values());
        
        await clearStore('kunden');
        await saveToStore('kunden', data);
        
        this.kunden = data;
        this.lastSync.kunden = new Date().toISOString();
        await setMeta('lastSync_kunden', this.lastSync.kunden);
        
        console.log(`[Cache] Kunden sync complete: ${data.length} Kunden`);
      } catch (error) {
        console.error('[Cache] Kunden sync failed, falling back to full sync');
        await this.fullSyncKunden();
      } finally {
        this.syncing.kunden = false;
      }
    },
    
    /**
     * FlipUsers (external API, no incremental sync)
     */
    async loadFlipUsers(forceRefresh = false) {
      if (this.loading.flipusers) return this.flipusers;
      
      try {
        this.loading.flipusers = true;
        
        if (forceRefresh) {
          return await this.fullSyncFlipUsers();
        }
        
        // Try to load from IndexedDB
        const cached = await getFromStore('flipusers');
        
        if (cached.length > 0) {
          this.flipusers = cached;
          console.log(`[Cache] Loaded ${cached.length} FlipUsers from IndexedDB`);
          
          // Check if cache is stale (>5 minutes)
          const lastSync = await getMeta('lastSync_flipusers');
          if (lastSync) {
            const cacheAge = Date.now() - new Date(lastSync).getTime();
            if (cacheAge > 5 * 60 * 1000) {
              console.log('[Cache] FlipUsers cache is stale, refreshing in background...');
              this.fullSyncFlipUsers();
            }
          }
          
          return this.flipusers;
        }
        
        // No cache, do full sync
        return await this.fullSyncFlipUsers();
        
      } catch (error) {
        console.error('[Cache] Error loading FlipUsers:', error);
        throw error;
      } finally {
        this.loading.flipusers = false;
      }
    },
    
    async fullSyncFlipUsers() {
      try {
        console.log('[Cache] Full sync FlipUsers...');
        const response = await api.get('/api/personal/flip');
        // FlipUsers response structure varies, handle both
        const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
        
        await clearStore('flipusers');
        await saveToStore('flipusers', data);
        
        this.flipusers = data;
        this.lastSync.flipusers = new Date().toISOString();
        await setMeta('lastSync_flipusers', this.lastSync.flipusers);
        
        console.log(`[Cache] Full sync complete: ${data.length} FlipUsers`);
        return data;
      } catch (error) {
        console.error('[Cache] Full sync FlipUsers failed:', error);
        throw error;
      }
    },
    
    /**
     * Clear all caches
     */
    async clearAllCaches() {
      for (const store of STORES) {
        await clearStore(store);
      }
      
      this.mitarbeiter = [];
      this.items = [];
      this.auftraege = [];
      this.kunden = [];
      this.documents = [];
      this.flipusers = [];
      
      this.lastSync = {
        mitarbeiter: null,
        items: null,
        auftraege: null,
        kunden: null,
        documents: null,
        flipusers: null
      };
      
      console.log('[Cache] All caches cleared');
    },
    
    /**
     * Invalidate specific cache (force next load to refresh)
     */
    invalidateCache(key) {
      this.lastSync[key] = null;
    },
    
    /**
     * Update single item in cache (after local edit)
     */
    async updateCachedMitarbeiter(mitarbeiter) {
      const idx = this.mitarbeiter.findIndex(m => m._id === mitarbeiter._id);
      if (idx >= 0) {
        this.mitarbeiter[idx] = mitarbeiter;
      } else {
        this.mitarbeiter.push(mitarbeiter);
      }
      await saveToStore('mitarbeiter', [mitarbeiter]);
    },
    
    async updateCachedItem(item) {
      const idx = this.items.findIndex(i => i._id === item._id);
      if (idx >= 0) {
        this.items[idx] = item;
      } else {
        this.items.push(item);
      }
      await saveToStore('items', [item]);
    },
    
    async removeCachedItem(itemId) {
      this.items = this.items.filter(i => i._id !== itemId);
      await deleteFromStore('items', [itemId]);
    },
    
    async updateCachedDocument(document) {
      const idx = this.documents.findIndex(d => d._id === document._id);
      if (idx >= 0) {
        this.documents[idx] = document;
      } else {
        this.documents.push(document);
      }
      await saveToStore('documents', [document]);
    },
    
    async updateCachedAuftrag(auftrag) {
      const idx = this.auftraege.findIndex(a => a._id === auftrag._id);
      if (idx >= 0) {
        this.auftraege[idx] = auftrag;
      } else {
        this.auftraege.push(auftrag);
      }
      await saveToStore('auftraege', [auftrag]);
    },
    
    async updateCachedKunde(kunde) {
      const idx = this.kunden.findIndex(k => k._id === kunde._id);
      if (idx >= 0) {
        this.kunden[idx] = kunde;
      } else {
        this.kunden.push(kunde);
      }
      await saveToStore('kunden', [kunde]);
    }
  }
});
