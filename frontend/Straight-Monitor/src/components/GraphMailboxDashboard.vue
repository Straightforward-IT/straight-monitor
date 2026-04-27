<template>
  <section class="mailbox-dashboard">
    <header class="mailbox-dashboard__hero">
      <div>
        <p class="mailbox-dashboard__eyebrow">Microsoft Graph</p>
        <h1>Mailbox Explorer</h1>
        <p class="mailbox-dashboard__subtitle">
          Ordnerstruktur und Folder-IDs pro Team-Postfach.
        </p>
      </div>

      <button
        class="mailbox-dashboard__refresh"
        type="button"
        :disabled="loadingAccounts || loadingTree || loadingInsights"
        @click="reloadCurrent"
      >
        Neu laden
      </button>
    </header>

    <div v-if="error" class="mailbox-dashboard__error">
      {{ error }}
    </div>

    <section class="mailbox-dashboard__filters">
      <div class="mailbox-dashboard__chips">
        <FilterChip
          v-for="account in accounts"
          :key="account.key"
          :active="selectedTeamKey === account.key"
          @click="selectTeam(account.key)"
        >
          {{ account.displayName }}
        </FilterChip>
      </div>

      <div v-if="selectedAccount" class="mailbox-dashboard__account-meta">
        <span>{{ selectedAccount.upn }}</span>
        <span v-if="selectedAccount.sharedMailbox">Shared: {{ selectedAccount.sharedMailbox }}</span>
      </div>
    </section>

    <div class="mailbox-dashboard__layout">
      <aside class="mailbox-dashboard__tree-panel">
        <div class="panel-card panel-card--tree">
          <div class="panel-card__head">
            <div>
              <h2>Ordner</h2>
              <p>{{ visibleFolders.length }} sichtbar</p>
            </div>
            <div class="panel-card__actions">
              <button
                v-if="folderTree.length"
                class="panel-card__action-btn"
                type="button"
                :disabled="loadingTree"
                @click="expandAllFolders"
              >
                Alle aufklappen
              </button>
              <span v-if="loadingTree" class="panel-card__status">Lädt…</span>
            </div>
          </div>

          <div v-if="loadingAccounts" class="panel-card__empty">Accounts werden geladen…</div>
          <div v-else-if="!accounts.length" class="panel-card__empty">Keine Mailbox-Accounts verfügbar.</div>
          <div v-else-if="loadingTree" class="panel-card__empty">Ordnerstruktur wird geladen…</div>
          <div v-else-if="!folderTree.length" class="panel-card__empty">Keine Ordner gefunden.</div>
          <div v-else class="folder-tree">
            <div
              v-for="entry in visibleFolders"
              :key="entry.node.id"
              class="folder-tree__row"
              :class="{ 'is-selected': entry.node.id === selectedFolderId }"
            >
              <span class="folder-tree__indent" :style="{ width: `${entry.depth * 16}px` }"></span>

              <button
                v-if="entry.hasChildren"
                class="folder-tree__caret"
                type="button"
                @click.stop="toggleExpanded(entry.node.id)"
              >
                <span :class="expandedFolderIds.has(entry.node.id) ? 'caret caret--open' : 'caret'"></span>
              </button>
              <span v-else class="folder-tree__caret folder-tree__caret--ghost"></span>

              <button
                class="folder-tree__item"
                type="button"
                @click="selectFolder(entry.node.id)"
              >
                <span class="folder-tree__icon"></span>
                <span class="folder-tree__label">{{ entry.node.displayName }}</span>
                <span v-if="entry.node.unreadItemCount" class="folder-tree__unread">{{ entry.node.unreadItemCount }}</span>
                <span class="folder-tree__count">{{ entry.node.totalItemCount }}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <section class="mailbox-dashboard__detail-panel">
        <div v-if="!selectedFolder && !loadingInsights" class="panel-card panel-card--empty">
          <h2>Ordner auswählen</h2>
          <p>Wähle links einen Ordner aus, um Folder-ID, Nachrichtenanzahl und Speicherwerte zu sehen.</p>
        </div>

        <template v-else>
          <div class="detail-header panel-card">
            <div>
              <p class="detail-header__eyebrow">Ausgewählter Ordner</p>
              <h2>{{ selectedFolder?.displayName || insights?.folder?.displayName || 'Ordner' }}</h2>
              <nav v-if="breadcrumbEntries.length" class="detail-breadcrumb" aria-label="Ordnerpfad">
                <template v-for="(entry, index) in breadcrumbEntries" :key="entry.id || `${entry.label}-${index}`">
                  <button
                    class="detail-breadcrumb__link"
                    :class="{ 'is-current': index === breadcrumbEntries.length - 1 }"
                    type="button"
                    :disabled="!entry.id || entry.id === selectedFolderId"
                    @click="entry.id && selectFolder(entry.id)"
                  >
                    {{ entry.label }}
                  </button>
                  <span v-if="index < breadcrumbEntries.length - 1" class="detail-breadcrumb__sep">/</span>
                </template>
              </nav>
            </div>
            <span v-if="loadingInsights" class="panel-card__status">Analysiere…</span>
          </div>

          <div class="detail-metrics">
            <article class="metric-card panel-card">
              <p class="metric-card__label">Folder ID</p>
              <p class="metric-card__value metric-card__value--mono">{{ insights?.folder?.id || selectedFolderId }}</p>
            </article>

            <article class="metric-card panel-card">
              <p class="metric-card__label">Nachrichten im Ordner</p>
              <p class="metric-card__value">{{ formatCount(insights?.folder?.totalItemCount) }}</p>
            </article>

            <article class="metric-card panel-card">
              <p class="metric-card__label">Ungelesen</p>
              <p class="metric-card__value">{{ formatCount(insights?.folder?.unreadItemCount) }}</p>
            </article>

            <article class="metric-card panel-card">
              <p class="metric-card__label">Unterordner</p>
              <p class="metric-card__value">{{ formatCount(insights?.folder?.childFolderCount) }}</p>
            </article>

            <article v-if="showSizeMetrics" class="metric-card panel-card metric-card--wide">
              <p class="metric-card__label">Speicherverbrauch</p>
              <p class="metric-card__value">{{ formatBytes(insights?.storage?.totalMessageSizeBytes) }}</p>
              <p class="metric-card__hint">
                {{ storageHint }}
              </p>
            </article>
          </div>

          <div class="detail-lists" :class="{ 'detail-lists--single': !showSizeMetrics }">
            <article v-if="showSizeMetrics" class="panel-card">
              <div class="panel-card__head">
                <div>
                  <h3>Größte Nachrichten</h3>
                  <p>Top 15 nach `message.size`</p>
                </div>
              </div>

              <div v-if="loadingInsights" class="panel-card__empty">Nachrichten werden geladen…</div>
              <div v-else-if="!insights?.largestMessages?.length" class="panel-card__empty">
                Keine Größenwerte für diesen Ordner verfügbar.
              </div>
              <div v-else class="table-wrap">
                <table class="mail-table">
                  <thead>
                    <tr>
                      <th>Betreff</th>
                      <th>Von</th>
                      <th>Erhalten</th>
                      <th>Größe</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="message in insights.largestMessages" :key="message.id">
                      <td>{{ message.subject }}</td>
                      <td>{{ message.from || '—' }}</td>
                      <td>{{ formatDate(message.receivedDateTime) }}</td>
                      <td>{{ formatBytes(message.size) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article class="panel-card">
              <div class="panel-card__head">
                <div>
                  <h3>Neueste Nachrichten</h3>
                  <p>Zuletzt eingegangene Mails im Ordner</p>
                </div>
              </div>

              <div v-if="loadingInsights" class="panel-card__empty">Nachrichten werden geladen…</div>
              <div v-else-if="!insights?.recentMessages?.length" class="panel-card__empty">
                Keine Nachrichten vorhanden.
              </div>
              <div v-else class="table-wrap">
                <table class="mail-table">
                  <thead>
                    <tr>
                      <th>Betreff</th>
                      <th>Von</th>
                      <th>Erhalten</th>
                      <th>Anhänge</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="message in insights.recentMessages" :key="message.id">
                      <td>{{ message.subject }}</td>
                      <td>{{ message.from || '—' }}</td>
                      <td>{{ formatDate(message.receivedDateTime) }}</td>
                      <td>{{ message.hasAttachments ? 'Ja' : 'Nein' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </template>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FilterChip from '@/components/FilterChip.vue';
import api from '@/utils/api';

const route = useRoute();
const router = useRouter();

const accounts = ref([]);
const selectedTeamKey = ref('');
const treeTeamKey = ref('');
const folderTree = ref([]);
const selectedFolderId = ref('');
const insights = ref(null);
const error = ref('');

const loadingAccounts = ref(false);
const loadingTree = ref(false);
const loadingInsights = ref(false);

const expandedFolderIds = ref(new Set());
let latestInsightsRequest = 0;
let latestTreeRequest = 0;

const selectedAccount = computed(() =>
  accounts.value.find((account) => account.key === selectedTeamKey.value) || null
);

const folderIndex = computed(() => {
  const index = new Map();

  const walk = (nodes = []) => {
    for (const node of nodes) {
      index.set(node.id, node);
      if (node.children?.length) walk(node.children);
    }
  };

  walk(folderTree.value);
  return index;
});

const visibleFolders = computed(() => {
  const rows = [];

  const walk = (nodes = [], depth = 0) => {
    for (const node of nodes) {
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      rows.push({ node, depth, hasChildren });
      if (hasChildren && expandedFolderIds.value.has(node.id)) {
        walk(node.children, depth + 1);
      }
    }
  };

  walk(folderTree.value, 0);
  return rows;
});

const selectedFolder = computed(() => folderIndex.value.get(selectedFolderId.value) || null);

const breadcrumbEntries = computed(() => {
  if (selectedFolder.value) {
    const entries = [];
    let current = selectedFolder.value;

    while (current) {
      entries.unshift({ id: current.id, label: current.displayName || 'Ordner' });
      current = current.parentFolderId ? folderIndex.value.get(current.parentFolderId) || null : null;
    }

    return entries;
  }

  if (insights.value?.folder?.displayName) {
    return [{ id: insights.value.folder.id || null, label: insights.value.folder.displayName }];
  }

  return [];
});

const showSizeMetrics = computed(() => {
  return Boolean(insights.value?.storage) && insights.value.storage.method !== 'unavailable';
});

const storageHint = computed(() => {
  if (!insights.value?.storage) return 'Speicherwerte werden über Microsoft Graph geladen.';
  if (insights.value.storage.method === 'unavailable') {
    return 'Graph liefert für diesen Tenant keinen zuverlässigen Größenwert pro Nachricht.';
  }

  return `Berechnet aus ${formatCount(insights.value.storage.sizedMessageCount)} Nachrichten mit Größenwert.`;
});

function normalizeQueryValue(value) {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}

function formatBytes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 'Nicht verfügbar';
  if (numeric === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let amount = numeric;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }

  return `${amount.toLocaleString('de-DE', {
    minimumFractionDigits: index === 0 ? 0 : 1,
    maximumFractionDigits: index === 0 ? 0 : 1,
  })} ${units[index]}`;
}

function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('de-DE');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function setError(err, fallback) {
  error.value = err?.response?.data?.error || err?.response?.data?.msg || err?.message || fallback;
}

function findFirstFolder(nodes = [], predicate) {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const nested = findFirstFolder(node.children || [], predicate);
    if (nested) return nested;
  }
  return null;
}

function initializeExpandedFolders() {
  const next = new Set();
  for (const node of folderTree.value) {
    next.add(node.id);
    if (String(node.displayName || '').toLowerCase() === 'archive') {
      next.add(node.id);
    }
  }
  expandedFolderIds.value = next;
}

function ensureExpandedToFolder(folderId) {
  const next = new Set(expandedFolderIds.value);
  let current = folderIndex.value.get(folderId);
  while (current?.parentFolderId) {
    next.add(current.parentFolderId);
    current = folderIndex.value.get(current.parentFolderId);
  }
  expandedFolderIds.value = next;
}

function toggleExpanded(folderId) {
  const next = new Set(expandedFolderIds.value);
  if (next.has(folderId)) next.delete(folderId);
  else next.add(folderId);
  expandedFolderIds.value = next;
}

function expandAllFolders() {
  const next = new Set();

  const walk = (nodes = []) => {
    for (const node of nodes) {
      if (Array.isArray(node.children) && node.children.length > 0) {
        next.add(node.id);
        walk(node.children);
      }
    }
  };

  walk(folderTree.value);
  expandedFolderIds.value = next;
}

async function replaceQuery(nextValues) {
  const nextQuery = {
    ...route.query,
    ...nextValues,
  };

  Object.keys(nextQuery).forEach((key) => {
    if (nextQuery[key] === undefined || nextQuery[key] === null || nextQuery[key] === '') {
      delete nextQuery[key];
    }
  });

  await router.replace({ query: nextQuery });
}

function getPreferredFolderId() {
  const requestedFolderId = normalizeQueryValue(route.query.folderId);
  if (requestedFolderId && folderIndex.value.has(requestedFolderId)) {
    return requestedFolderId;
  }

  const archiveFolder = findFirstFolder(folderTree.value, (node) =>
    String(node.displayName || '').toLowerCase() === 'archive'
  );
  if (archiveFolder) return archiveFolder.id;

  const inboxFolder = findFirstFolder(folderTree.value, (node) =>
    String(node.displayName || '').toLowerCase() === 'inbox'
  );
  if (inboxFolder) return inboxFolder.id;

  return folderTree.value[0]?.id || '';
}

async function loadAccounts() {
  loadingAccounts.value = true;
  error.value = '';

  try {
    const { data } = await api.get('/api/graph/mailboxes/accounts');
    accounts.value = data.accounts || [];
  } catch (err) {
    setError(err, 'Mailbox-Accounts konnten nicht geladen werden.');
  } finally {
    loadingAccounts.value = false;
  }
}

async function loadTree(teamKey) {
  const requestId = ++latestTreeRequest;
  loadingTree.value = true;
  error.value = '';
  folderTree.value = [];
  insights.value = null;
  treeTeamKey.value = '';

  try {
    const { data } = await api.get('/api/graph/mailboxes/tree', {
      params: { team: teamKey },
    });

    if (requestId !== latestTreeRequest) return;

    folderTree.value = data.folders || [];
    treeTeamKey.value = teamKey;
    initializeExpandedFolders();

    const preferredFolderId = getPreferredFolderId();
    if (preferredFolderId) {
      await selectFolder(preferredFolderId, { updateQuery: true, force: true, teamKey });
    }
  } catch (err) {
    if (requestId !== latestTreeRequest) return;
    setError(err, 'Ordnerstruktur konnte nicht geladen werden.');
  } finally {
    if (requestId !== latestTreeRequest) return;
    loadingTree.value = false;
  }
}

async function loadInsights(folderId, teamKey = selectedTeamKey.value) {
  const requestId = ++latestInsightsRequest;
  loadingInsights.value = true;
  error.value = '';

  try {
    const { data } = await api.get('/api/graph/mailboxes/folder-insights', {
      params: {
        team: teamKey,
        folderId,
      },
    });
    if (requestId !== latestInsightsRequest) return;
    insights.value = data;
  } catch (err) {
    if (requestId !== latestInsightsRequest) return;
    setError(err, 'Folder-Details konnten nicht geladen werden.');
  } finally {
    if (requestId !== latestInsightsRequest) return;
    loadingInsights.value = false;
  }
}

async function selectFolder(folderId, { updateQuery = true, force = false, teamKey = treeTeamKey.value || selectedTeamKey.value } = {}) {
  if (!folderId) return;

  selectedFolderId.value = folderId;
  ensureExpandedToFolder(folderId);

  if (updateQuery) {
    await replaceQuery({ team: teamKey, folderId });
  }

  if (!force && insights.value?.folder?.id === folderId && selectedTeamKey.value === teamKey) {
    return;
  }

  await loadInsights(folderId, teamKey);
}

async function selectTeam(teamKey) {
  if (!teamKey || teamKey === selectedTeamKey.value) return;

  latestInsightsRequest += 1;
  selectedTeamKey.value = teamKey;
  selectedFolderId.value = '';
  folderTree.value = [];
  insights.value = null;
  treeTeamKey.value = '';
  expandedFolderIds.value = new Set();
  await replaceQuery({ team: teamKey, folderId: '' });
  await loadTree(teamKey);
}

async function reloadCurrent() {
  if (!selectedTeamKey.value) {
    await initializePage();
    return;
  }

  await loadTree(selectedTeamKey.value);
}

async function initializePage() {
  await loadAccounts();
  if (!accounts.value.length) return;

  const requestedTeam = normalizeQueryValue(route.query.team);
  const matchedAccount = accounts.value.find((account) => account.key === requestedTeam) || accounts.value[0];

  selectedTeamKey.value = matchedAccount.key;
  await replaceQuery({ team: matchedAccount.key, folderId: normalizeQueryValue(route.query.folderId) || '' });
  await loadTree(matchedAccount.key);
}

onMounted(async () => {
  await initializePage();
});
</script>

<style scoped lang="scss">
.mailbox-dashboard {
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: var(--text);
}

.mailbox-dashboard__hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--primary) 18%, transparent), transparent 34%),
    linear-gradient(145deg, var(--surface), color-mix(in srgb, var(--surface) 80%, var(--bg)));
}

.mailbox-dashboard__eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--muted);
}

.mailbox-dashboard__hero h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 40px);
  line-height: 1;
}

.mailbox-dashboard__subtitle {
  margin: 10px 0 0;
  max-width: 720px;
  color: var(--muted);
}

.mailbox-dashboard__refresh {
  border: 1px solid color-mix(in srgb, var(--primary) 45%, var(--border));
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  padding: 10px 16px;
  cursor: pointer;
  font-weight: 600;
}

.mailbox-dashboard__refresh:disabled {
  cursor: wait;
  opacity: 0.6;
}

.mailbox-dashboard__filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mailbox-dashboard__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mailbox-dashboard__account-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--muted);
  font-size: 13px;
}

.mailbox-dashboard__layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.panel-card {
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  padding: 18px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
}

.panel-card--tree {
  padding-right: 10px;
}

.panel-card__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.panel-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.panel-card__action-btn {
  border: 1px solid color-mix(in srgb, var(--primary) 40%, var(--border));
  background: transparent;
  color: var(--text);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.panel-card__action-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.panel-card__action-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.panel-card__head h2,
.panel-card__head h3,
.detail-header h2 {
  margin: 0;
}

.panel-card__head p,
.metric-card__hint,
.panel-card__empty,
.panel-card__status {
  margin: 4px 0 0;
  color: var(--muted);
}

.folder-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: calc(100vh - 260px);
  overflow: auto;
  padding-right: 4px;
}

.folder-tree__row {
  display: flex;
  align-items: center;
  min-height: 36px;
}

.folder-tree__indent,
.folder-tree__caret,
.folder-tree__caret--ghost {
  flex: 0 0 auto;
}

.folder-tree__caret {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.folder-tree__caret--ghost {
  width: 24px;
}

.caret {
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(-45deg);
  transition: transform 160ms ease;
}

.caret--open {
  transform: rotate(45deg);
}

.folder-tree__item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  padding: 8px 10px;
  border-radius: 12px;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.folder-tree__row.is-selected .folder-tree__item {
  background: color-mix(in srgb, var(--primary) 13%, var(--surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 55%, transparent);
}

.folder-tree__icon {
  width: 15px;
  height: 11px;
  border: 1px solid color-mix(in srgb, var(--text) 45%, transparent);
  border-radius: 2px 2px 3px 3px;
  position: relative;
  opacity: 0.75;
}

.folder-tree__icon::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 1px;
  width: 7px;
  height: 4px;
  border: 1px solid color-mix(in srgb, var(--text) 45%, transparent);
  border-bottom: none;
  border-radius: 2px 2px 0 0;
  background: transparent;
}

.folder-tree__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.folder-tree__count,
.folder-tree__unread {
  flex: 0 0 auto;
  min-width: 20px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  text-align: center;
}

.folder-tree__count {
  background: color-mix(in srgb, var(--text) 8%, var(--surface));
}

.folder-tree__unread {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.detail-header__eyebrow,
.metric-card__label {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.detail-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}

.detail-breadcrumb__link {
  border: none;
  background: color-mix(in srgb, var(--text) 6%, var(--surface));
  color: var(--text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
}

.detail-breadcrumb__link:hover:not(:disabled) {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 10%, var(--surface));
}

.detail-breadcrumb__link.is-current,
.detail-breadcrumb__link:disabled {
  cursor: default;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 14%, var(--surface));
}

.detail-breadcrumb__sep {
  color: var(--muted);
  font-size: 13px;
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.metric-card {
  min-height: 120px;
}

.metric-card--wide {
  grid-column: span 2;
}

.metric-card__value {
  margin: 14px 0 0;
  font-size: clamp(20px, 2vw, 28px);
  font-weight: 700;
  line-height: 1.2;
}

.metric-card__value--mono {
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-all;
}

.detail-lists {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.detail-lists--single {
  grid-template-columns: minmax(0, 1fr);
}

.table-wrap {
  overflow: auto;
}

.mail-table {
  width: 100%;
  border-collapse: collapse;
}

.mail-table th,
.mail-table td {
  padding: 10px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  text-align: left;
  font-size: 13px;
  vertical-align: top;
}

.mail-table th {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.mailbox-dashboard__error {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, #b3261e 35%, var(--border));
  background: color-mix(in srgb, #b3261e 10%, var(--surface));
  color: var(--text);
}

@media (max-width: 1200px) {
  .detail-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-card--wide {
    grid-column: span 2;
  }
}

@media (max-width: 900px) {
  .mailbox-dashboard__layout,
  .detail-lists {
    grid-template-columns: 1fr;
  }

  .folder-tree {
    max-height: 420px;
  }
}

@media (max-width: 640px) {
  .mailbox-dashboard__hero {
    padding: 18px;
    flex-direction: column;
  }

  .detail-metrics {
    grid-template-columns: 1fr;
  }

  .metric-card--wide {
    grid-column: span 1;
  }
}
</style>