<template>
  <div class="kf-feed">
    <!-- Header -->
    <div class="kf-header">
      <div class="kf-header-left">
        <span class="kf-header-title">Kommentar-Feed</span>
        <span v-if="unreadCount > 0" class="kf-unread-badge">{{ unreadCount }}</span>
      </div>
      <div class="kf-header-right">
        <custom-tooltip v-if="unreadCount > 0" text="Alle als gelesen markieren" position="bottom" :delay-in="200">
          <button class="kf-icon-btn" @click="markAllRead">
            <font-awesome-icon :icon="['fas', 'check-double']" />
          </button>
        </custom-tooltip>
        <button class="kf-icon-btn close-btn" @click="ui.close()">
          <font-awesome-icon :icon="['fas', 'xmark']" />
        </button>
      </div>
    </div>

    <!-- Filter chips + Standort -->
    <div class="kf-filters">
      <button class="kf-chip" :class="{ active: filter === 'all' }" @click="filter = 'all'">Alle</button>
      <button class="kf-chip" :class="{ active: filter === 'unread' }" @click="filter = 'unread'">
        Ungelesen
        <span v-if="unreadCount > 0" class="kf-chip-badge">{{ unreadCount }}</span>
      </button>
      <select class="kf-standort-select" v-model="standortFilterModel">
        <option value="Hamburg">HH</option>
        <option value="Berlin">B</option>
        <option value="Köln">K</option>
        <option :value="null">Alle</option>
      </select>
    </div>

    <!-- Feed loading -->
    <div v-if="store.loading" class="kf-loading">
      <font-awesome-icon :icon="['fas', 'spinner']" spin />
    </div>

    <!-- Empty state -->
    <div v-else-if="visibleItems.length === 0" class="kf-empty">
      <font-awesome-icon :icon="['fas', 'check-circle']" class="kf-empty-icon" />
      <span>{{ filter === 'unread' ? 'Keine ungelesenen Kommentare' : 'Keine Kommentare vorhanden' }}</span>
    </div>

    <!-- Comment list -->
    <div v-else class="kf-list" ref="listRef">
      <div
        v-for="item in visibleItems"
        :key="item._id"
        class="kf-item"
        :class="{ unread: item.isUnread }"
        :ref="(el) => setItemRef(el, item._id)"
        @mouseenter="onItemHover(item)"
        @mouseleave="onItemLeave(item._id)"
      >
        <!-- Unread dot -->
        <div class="kf-unread-dot" v-if="item.isUnread"></div>

        <!-- Top row: MA name + date + jump-to -->
        <div class="kf-item-top">
          <button class="kf-ma-btn" @click="jumpTo(item)">
            <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="kf-jump-icon" />
            <span class="kf-ma-name">{{ item.maName }}</span>
            <span class="kf-datum-chip">{{ formatDate(item.datum) }}</span>
          </button>
        </div>

        <!-- Author row -->
        <div class="kf-item-meta">
          <div class="kf-avatar">{{ authorInitial(item.author) }}</div>
          <span class="kf-author">{{ item.author }}</span>
          <custom-tooltip :text="formatAbsolute(item.timestamp)" position="bottom" :delay-in="300">
            <span class="kf-time">{{ formatRelative(item.timestamp) }}</span>
          </custom-tooltip>
        </div>

        <!-- Text -->
        <p class="kf-text">{{ item.text }}</p>

        <!-- Actions -->
        <div class="kf-actions">
          <button
            v-if="item.canDelete"
            class="kf-action-btn kf-delete-btn"
            @click="deleteComment(item._id)"
          >
            <font-awesome-icon :icon="['fas', 'trash']" />
            Löschen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useUi } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { useDispoKommentare } from '@/stores/dispoKommentare';
import { useDataCache } from '@/stores/dataCache';
import CustomTooltip from '@/components/CustomTooltip.vue';

const ui = useUi();
const auth = useAuth();
const store = useDispoKommentare();
const cache = useDataCache();
const router = useRouter();
const route = useRoute();

const filter = ref('all');
const listRef = ref(null);
const itemRefs = ref({});

// ── Standort filter (synced with store) ────────────────────────────────────────
const activeStandort = computed(() => {
  const f = store.standortFilter;
  if (f === 'auto') return auth.user?.location ?? null;
  return f; // null = Alle, or specific city
});

const standortFilterModel = computed({
  get: () => activeStandort.value,
  set: (val) => store.setStandortFilter(val),
});

function getMaStandort(maId) {
  const ma = maMap.value[String(maId)];
  const pnr = String(ma?.personalnr ?? '').trim();
  if (pnr.startsWith('1')) return 'Berlin';
  if (pnr.startsWith('2')) return 'Hamburg';
  if (pnr.startsWith('3')) return 'Köln';
  return null;
}

function setItemRef(el, id) {
  if (el) itemRefs.value[id] = el;
  else delete itemRefs.value[id];
}

// ── MA name map from cache ─────────────────────────────────────────────────
const maMap = computed(() => {
  const map = {};
  for (const ma of cache.mitarbeiter) {
    map[String(ma._id)] = ma;
  }
  return map;
});

function getMaName(maId) {
  const ma = maMap.value[String(maId)];
  if (!ma) return 'Unbekannt';
  return `${ma.vorname} ${ma.nachname}`;
}

// ── Computed feeds ──────────────────────────────────────────────────────────
const userId = computed(() => String(auth.user?._id ?? ''));

const unreadCount = computed(() => store.unreadCount);

const enrichedItems = computed(() => {
  return [...store.kommentare]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((k) => ({
      ...k,
      maName: getMaName(k.mitarbeiter),
      maStandort: getMaStandort(k.mitarbeiter),
      isUnread: String(k.authorId) !== userId.value && !(k.readBy ?? []).map(String).includes(userId.value),
      canDelete: String(k.authorId) === userId.value,
    }));
});

const visibleItems = computed(() => {
  let items = enrichedItems.value;
  // Apply standort filter
  const loc = activeStandort.value;
  if (loc) items = items.filter((k) => !k.maStandort || k.maStandort === loc);
  // Apply read filter
  if (filter.value === 'unread') items = items.filter((k) => k.isUnread);
  return items;
});

// ── Load data on mount if not already loaded ───────────────────────────────
onMounted(async () => {
  await cache.loadMitarbeiter();
  // If the store has no data yet (e.g. panel opened before DispoTable loaded), fetch now
  if (!store.kommentare.length && !store.loading) {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    const von = today.toISOString().slice(0, 10);
    const bis = end.toISOString().slice(0, 10);
    await store.fetch(von, bis);
  }
});

// ── Hover-based mark-read ───────────────────────────────────────────────────
const _hoverTimers = {};

function onItemHover(item) {
  if (!item.isUnread) return;
  _hoverTimers[item._id] = setTimeout(async () => {
    await store.markRead([item._id]);
  }, 800);
}

function onItemLeave(id) {
  if (_hoverTimers[id]) {
    clearTimeout(_hoverTimers[id]);
    delete _hoverTimers[id];
  }
}

// ── Jump To ─────────────────────────────────────────────────────────────────
function jumpTo(item) {
  const ma = maMap.value[String(item.mitarbeiter)];
  const pnr = String(ma?.personalnr ?? '').trim();
  const query = { resetPlanung: '1', showHidden: '1' };
  if (pnr.startsWith('1')) query.standort = '1';
  else if (pnr.startsWith('2')) query.standort = '2';
  else if (pnr.startsWith('3')) query.standort = '3';
  if (item.datum) query.datum = item.datum;
  if (item.mitarbeiter) query.maId = String(item.mitarbeiter);

  if (route.name === 'Dispo') {
    // Already on dispo — just update query params to trigger the watcher
    router.push({ name: 'Dispo', query });
  } else {
    router.push({ path: '/dispo', query });
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────
async function deleteComment(id) {
  try {
    await store.deleteComment(id);
  } catch (err) {
    console.error('Kommentar löschen fehlgeschlagen:', err);
  }
}

// ── Mark all read ───────────────────────────────────────────────────────────
async function markAllRead() {
  const ids = enrichedItems.value.filter((k) => k.isUnread).map((k) => k._id);
  await store.markRead(ids);
}

// ── Formatters ──────────────────────────────────────────────────────────────
function authorInitial(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0].toUpperCase();
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatRelative(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  return formatAbsolute(ts);
}

function formatAbsolute(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.kf-feed {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--text);
  font-size: 12.5px;
}

/* ── Header ──────────────────────────────────────────────────────── */
.kf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 10px 6px;
  flex-shrink: 0;
}

.kf-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kf-header-icon {
  color: var(--primary);
  font-size: 13px;
}

.kf-header-title {
  font-size: 14px;
  font-weight: 700;
  opacity: 0.9;
}

.kf-unread-badge {
  font-size: 10px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 10px;
  background: var(--primary);
  color: #fff;
}

.kf-header-right {
  display: flex;
  gap: 4px;
  align-items: center;
}

.kf-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
  opacity: 0.65;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;

  &:hover {
    opacity: 1;
    background: var(--hover);
  }
}

.close-btn {
  display: none;

  @media (max-width: 768px) {
    display: flex;
  }
}

/* ── Filter chips ────────────────────────────────────────────────── */
.kf-filters {
  display: flex;
  gap: 6px;
  padding: 0 10px 8px;
  flex-shrink: 0;
}

.kf-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: none;
  color: var(--muted);
  font-size: 11.5px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--primary);
    color: var(--text);
  }

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: transparent;
  }
}

.kf-chip-badge {
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
}

.kf-standort-select {
  margin-left: auto;
  font-size: 11.5px;
  padding: 2px 6px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
  height: 24px;
  transition: border-color 0.15s;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

/* ── Loading / Empty ─────────────────────────────────────────────── */
.kf-loading,
.kf-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  color: var(--muted);
  font-size: 12.5px;
  text-align: center;
}

.kf-empty-icon {
  color: #10b981;
  font-size: 22px;
}

/* ── Comment list ────────────────────────────────────────────────── */
.kf-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 6px 12px;
}

/* ── Single comment item ─────────────────────────────────────────── */
.kf-item {
  position: relative;
  padding: 8px 10px 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  transition: background 0.12s;

  &:hover {
    background: var(--hover);
  }

  &.unread {
    border-left: 2px solid var(--primary);
  }
}

.kf-unread-dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
}

/* Top row with MA name + jump-to */
.kf-item-top {
  margin-bottom: 5px;
}

.kf-ma-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text);
  font-size: 12.5px;
  font-weight: 600;
  transition: color 0.15s;

  &:hover {
    color: var(--primary);

    .kf-jump-icon {
      opacity: 1;
    }
  }
}

.kf-jump-icon {
  font-size: 10px;
  opacity: 0.45;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.kf-ma-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
}

.kf-datum-chip {
  font-size: 10.5px;
  font-weight: 400;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--hover);
  border: 1px solid var(--border);
  color: var(--muted);
  flex-shrink: 0;
}

/* Author row */
.kf-item-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
}

.kf-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--primary) 20%, transparent);
  color: var(--primary);
  font-size: 9px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
}

.kf-author {
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
  opacity: 0.8;
}

.kf-time {
  font-size: 10.5px;
  color: var(--muted);
  cursor: default;
}

/* Text */
.kf-text {
  font-size: 12px;
  color: var(--text);
  opacity: 0.9;
  margin: 0 0 5px;
  line-height: 1.45;
  word-break: break-word;
}

/* Actions */
.kf-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.kf-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 11px;
  cursor: pointer;
  color: var(--muted);
  transition: color 0.12s, border-color 0.12s, background 0.12s;

  &:hover {
    color: var(--text);
    border-color: var(--text);
    background: var(--hover);
  }
}

.kf-delete-btn {
  color: color-mix(in srgb, #dc3545 80%, var(--muted));

  &:hover {
    color: #dc3545;
    border-color: #dc3545;
    background: rgba(220, 53, 69, 0.08);
  }
}
</style>
