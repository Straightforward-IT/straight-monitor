<template>
  <section class="drive-dashboard">
    <header class="drive-dashboard__hero">
      <div>
        <p class="drive-dashboard__eyebrow">Microsoft Graph · OneDrive</p>
        <h1>OneDrive Explorer</h1>
        <p class="drive-dashboard__subtitle">
          Ordner, Dateien und Downloads aus dem Team-OneDrive.
        </p>
      </div>

      <button
        class="drive-dashboard__refresh"
        type="button"
        :disabled="loadingAccounts || loadingTree"
        @click="reloadCurrent"
      >
        Neu laden
      </button>
    </header>

    <div v-if="error" class="drive-dashboard__error">{{ error }}</div>

    <!-- Team-Chips -->
    <section class="drive-dashboard__filters">
      <div class="drive-dashboard__chips">
        <FilterChip
          v-for="account in accounts"
          :key="account.key"
          :active="selectedTeamKey === account.key"
          @click="selectTeam(account.key)"
        >
          {{ account.displayName }}
        </FilterChip>
      </div>
      <div v-if="selectedAccount" class="drive-dashboard__account-meta">
        <span>{{ selectedAccount.upn }}</span>
      </div>
    </section>

    <div class="drive-dashboard__layout">
      <!-- Left: Folder tree -->
      <aside class="drive-dashboard__tree-panel">
        <div class="panel-card panel-card--tree">
          <div class="panel-card__head">
            <div>
              <h2>Ordner</h2>
              <p>{{ visibleFolders.length }} sichtbar</p>
            </div>
            <div class="panel-card__actions">
              <button
                class="panel-card__action-btn"
                :disabled="!folderTree.length"
                @click="expandAllFolders"
              >
                Alle aufklappen
              </button>
              <span v-if="loadingTree" class="panel-card__status">Lädt…</span>
            </div>
          </div>

          <div v-if="loadingAccounts" class="panel-card__empty">Accounts werden geladen…</div>
          <div v-else-if="!accounts.length" class="panel-card__empty">Keine Accounts verfügbar.</div>
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
                v-if="entry.node.children?.length"
                class="folder-tree__caret"
                @click.stop="toggleExpanded(entry.node.id)"
              >
                <span class="caret" :class="{ 'caret--open': expandedFolderIds.has(entry.node.id) }"></span>
              </button>
              <span v-else class="folder-tree__caret folder-tree__caret--ghost"></span>

              <button class="folder-tree__item" @click="selectFolder(entry.node.id)">
                <span class="folder-tree__icon"></span>
                <span class="folder-tree__label">{{ entry.node.name }}</span>
                <span v-if="entry.node.childCount !== null" class="folder-tree__count">
                  {{ entry.node.childCount }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Right: File list + upload -->
      <section class="drive-dashboard__detail-panel">
        <div v-if="!selectedFolderId && !loadingTree" class="panel-card panel-card--empty">
          <h2>Ordner auswählen</h2>
          <p>Wähle links einen Ordner, um dessen Inhalt anzuzeigen.</p>
        </div>

        <template v-else>
          <!-- Breadcrumb -->
          <div class="detail-header panel-card">
            <div>
              <p class="detail-header__eyebrow">Ausgewählter Ordner</p>
              <h2>{{ selectedFolderNode?.name || '—' }}</h2>
              <nav v-if="breadcrumbEntries.length" class="detail-breadcrumb" aria-label="Ordnerpfad">
                <template v-for="(entry, idx) in breadcrumbEntries" :key="entry.id">
                  <span v-if="idx > 0" class="detail-breadcrumb__sep" aria-hidden="true">›</span>
                  <button
                    class="detail-breadcrumb__link"
                    :class="{ 'is-current': idx === breadcrumbEntries.length - 1 }"
                    :disabled="idx === breadcrumbEntries.length - 1"
                    @click="selectFolder(entry.id)"
                  >{{ entry.label }}</button>
                </template>
              </nav>
              <div v-if="selectedFolderId" class="folder-id-row">
                <span class="folder-id-label">Folder-ID</span>
                <code class="folder-id-value">{{ selectedFolderId }}</code>
                <button class="folder-id-copy" :class="{ copied: copiedFolderId }" @click="copyFolderId">
                  {{ copiedFolderId ? 'Kopiert!' : 'Kopieren' }}
                </button>
              </div>
            </div>
          </div>

          <!-- File table -->
          <div class="panel-card" style="margin-top: 14px;">
            <div class="panel-card__head">
              <h3>Inhalt</h3>
              <span v-if="loadingChildren" class="panel-card__status">Lädt…</span>
            </div>

            <div v-if="!folderChildren.length && !loadingChildren" class="panel-card__empty">
              Dieser Ordner ist leer.
            </div>
            <div v-else class="table-wrap">
              <table class="file-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>ID</th>
                    <th>Typ</th>
                    <th>Größe</th>
                    <th>Geändert am</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in folderChildren"
                    :key="item.id"
                    :class="{ 'row--folder': item.isFolder }"
                  >
                    <td>
                      <button
                        v-if="item.isFolder"
                        class="file-name-btn"
                        @click="selectFolder(item.id)"
                      >
                        <span class="file-icon file-icon--folder"></span>
                        {{ item.name }}
                      </button>
                      <span v-else class="file-name">
                        <span class="file-icon" :class="fileIconClass(item)"></span>
                        {{ item.name }}
                      </span>
                    </td>
                    <td>
                      <div class="id-cell">
                        <span class="item-id">{{ item.id }}</span>
                        <button class="id-copy-btn" :title="'ID kopieren: ' + item.id" @click="copyItemId(item.id)">
                          {{ copiedItemId === item.id ? '✓' : 'ID' }}
                        </button>
                      </div>
                    </td>
                    <td>{{ item.isFolder ? 'Ordner' : fileTypeLabel(item) }}</td>
                    <td>{{ item.isFolder ? '—' : formatBytes(item.size) }}</td>
                    <td>{{ formatDate(item.lastModifiedDateTime) }}</td>
                    <td>
                      <div class="actions-cell">
                        <template v-if="!item.isFolder">
                          <a
                            v-if="item.downloadUrl"
                            :href="item.downloadUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="action-btn"
                          >Download</a>
                          <button
                            class="action-btn"
                            @click="openPreview(item)"
                          >Vorschau</button>
                        </template>
                        <button
                          v-else
                          class="action-btn"
                          @click="selectFolder(item.id)"
                        >Öffnen</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Upload -->
          <div class="panel-card upload-card" style="margin-top: 14px;">
            <h3>Datei hochladen</h3>
            <div
              class="upload-zone"
              :class="{ 'upload-zone--drag': dragging, 'upload-zone--uploading': uploading }"
              @dragover.prevent="dragging = true"
              @dragleave.prevent="dragging = false"
              @drop.prevent="onDrop"
            >
              <input
                ref="fileInputRef"
                type="file"
                class="upload-zone__input"
                @change="onFileInputChange"
              />
              <span v-if="uploading" class="upload-zone__hint">Wird hochgeladen…</span>
              <span v-else class="upload-zone__hint">
                Datei hierher ziehen oder
                <button class="upload-zone__pick" @click="fileInputRef?.click()">auswählen</button>
              </span>
            </div>
            <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
            <p v-if="uploadSuccess" class="upload-success">{{ uploadSuccess }}</p>
          </div>
        </template>
      </section>
    </div>

    <!-- Preview Modal -->
    <teleport to="body">
      <div v-if="previewItem" class="preview-backdrop" @click.self="closePreview">
        <div class="preview-modal">
          <div class="preview-modal__head">
            <span class="preview-modal__name">{{ previewItem.name }}</span>
            <div class="preview-modal__actions">
              <a
                v-if="previewItem.downloadUrl"
                :href="previewItem.downloadUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="action-btn"
              >Download</a>
              <button class="preview-modal__close" @click="closePreview">✕</button>
            </div>
          </div>

          <div class="preview-modal__body">
            <div v-if="loadingPreview" class="preview-modal__loading">Vorschau wird geladen…</div>
            <div v-else-if="previewError" class="preview-modal__error">{{ previewError }}</div>

            <!-- Bild-Vorschau direkt via downloadUrl -->
            <img
              v-else-if="isImage(previewItem) && previewItem.downloadUrl"
              :src="previewItem.downloadUrl"
              :alt="previewItem.name"
              class="preview-modal__img"
            />

            <!-- Office / PDF / allgemein via Microsoft-Embed-URL -->
            <iframe
              v-else-if="previewUrl"
              :src="previewUrl"
              class="preview-modal__frame"
              frameborder="0"
              allow="autoplay"
            ></iframe>

            <div v-else class="preview-modal__error">
              Keine Vorschau für diesen Dateityp verfügbar.
              <a
                v-if="previewItem.downloadUrl"
                :href="previewItem.downloadUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="action-btn"
                style="margin-top: 12px; display: inline-block;"
              >Direkt öffnen / herunterladen</a>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FilterChip from '@/components/FilterChip.vue';
import api from '@/utils/api';

const route = useRoute();
const router = useRouter();

/* -------- state -------- */
const accounts = ref([]);
const selectedTeamKey = ref('');
const folderTree = ref([]);
const treeTeamKey = ref('');
const selectedFolderId = ref('');
const folderChildren = ref([]);
const previewItem = ref(null);
const previewUrl = ref('');
const error = ref('');
const uploadError = ref('');
const uploadSuccess = ref('');
const copiedFolderId = ref(false);
const copiedItemId = ref('');

const loadingAccounts = ref(false);
const loadingTree = ref(false);
const loadingChildren = ref(false);
const loadingPreview = ref(false);
const uploading = ref(false);
const dragging = ref(false);
const fileInputRef = ref(null);

const expandedFolderIds = ref(new Set());
const loadedFolderIds = ref(new Set()); // folders whose subfolders have been fetched
let latestTreeRequest = 0;
let latestChildrenRequest = 0;
let previewError = ref('');

/* -------- computed -------- */
const selectedAccount = computed(() =>
  accounts.value.find((a) => a.key === selectedTeamKey.value) || null
);

/** Flat map: id → node (includes lazily loaded subfolders) */
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

/** Visible rows in tree: a folder is expandable when childCount > 0 OR it already has loaded children */
const visibleFolders = computed(() => {
  const rows = [];
  const walk = (nodes = [], depth = 0) => {
    for (const node of nodes) {
      const hasChildren = (node.childCount ?? 0) > 0 || (node.children?.length ?? 0) > 0;
      rows.push({ node, depth, hasChildren });
      if (expandedFolderIds.value.has(node.id) && node.children?.length) {
        walk(node.children, depth + 1);
      }
    }
  };
  walk(folderTree.value, 0);
  return rows;
});

const selectedFolderNode = computed(() => folderIndex.value.get(selectedFolderId.value) || null);

const breadcrumbEntries = computed(() => {
  if (!selectedFolderNode.value) return [];
  const entries = [];
  let current = selectedFolderNode.value;
  while (current) {
    entries.unshift({ id: current.id, label: current.name || 'Ordner' });
    current = current.parentId ? folderIndex.value.get(current.parentId) || null : null;
  }
  return entries;
});

/* -------- helpers -------- */
function normalizeQueryValue(value) {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}

function formatBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString('de-DE', { minimumFractionDigits: i === 0 ? 0 : 1, maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

function fileTypeLabel(item) {
  if (item.mimeType) {
    const parts = item.mimeType.split('/');
    return parts[1]?.toUpperCase() || item.mimeType;
  }
  const ext = (item.name || '').split('.').pop();
  return ext ? ext.toUpperCase() : '—';
}

function isImage(item) {
  return Boolean(item.mimeType?.startsWith('image/'));
}

function fileIconClass(item) {
  const mime = item.mimeType || '';
  if (mime.startsWith('image/')) return 'file-icon--image';
  if (mime.includes('pdf')) return 'file-icon--pdf';
  if (mime.includes('word') || mime.includes('document')) return 'file-icon--word';
  if (mime.includes('excel') || mime.includes('sheet')) return 'file-icon--excel';
  if (mime.includes('powerpoint') || mime.includes('presentation')) return 'file-icon--ppt';
  return 'file-icon--generic';
}

function setError(err, fallback) {
  error.value = err?.response?.data?.error || err?.response?.data?.msg || err?.message || fallback;
}

async function copyFolderId() {
  if (!selectedFolderId.value) return;
  try {
    await navigator.clipboard.writeText(selectedFolderId.value);
    copiedFolderId.value = true;
    setTimeout(() => { copiedFolderId.value = false; }, 2000);
  } catch {
    // fallback: select text
  }
}

async function copyItemId(id) {
  try {
    await navigator.clipboard.writeText(id);
    copiedItemId.value = id;
    setTimeout(() => { copiedItemId.value = ''; }, 2000);
  } catch {
    // ignore
  }
}

/* -------- tree helpers -------- */
function initializeExpanded() {
  // Expand all root-level folders by default
  const next = new Set();
  for (const node of folderTree.value) next.add(node.id);
  expandedFolderIds.value = next;
}

function ensureExpandedToFolder(folderId) {
  const next = new Set(expandedFolderIds.value);
  let current = folderIndex.value.get(folderId);
  while (current?.parentId) {
    next.add(current.parentId);
    current = folderIndex.value.get(current.parentId);
  }
  expandedFolderIds.value = next;
}

async function toggleExpanded(folderId) {
  const isExpanded = expandedFolderIds.value.has(folderId);

  if (isExpanded) {
    // Collapse
    const next = new Set(expandedFolderIds.value);
    next.delete(folderId);
    expandedFolderIds.value = next;
    return;
  }

  // Expand: fetch subfolders if not yet loaded
  if (!loadedFolderIds.value.has(folderId)) {
    try {
      const { data } = await api.get('/api/graph/drive/children', {
        params: { team: treeTeamKey.value || selectedTeamKey.value, itemId: folderId, foldersOnly: 'true' },
      });
      const node = folderIndex.value.get(folderId);
      if (node) {
        node.children = (data.items || []).map((n) => ({ ...n, children: [] }));
      }
      const next = new Set(loadedFolderIds.value);
      next.add(folderId);
      loadedFolderIds.value = next;
    } catch (err) {
      setError(err, 'Unterordner konnten nicht geladen werden.');
      return;
    }
  }

  const next = new Set(expandedFolderIds.value);
  next.add(folderId);
  expandedFolderIds.value = next;
}

function expandAllFolders() {
  // With lazy tree we can only expand already-loaded folders
  const next = new Set();
  const walk = (nodes = []) => {
    for (const node of nodes) {
      if ((node.children?.length ?? 0) > 0) {
        next.add(node.id);
        walk(node.children);
      }
    }
  };
  walk(folderTree.value);
  expandedFolderIds.value = next;
}

/* -------- routing helpers -------- */
async function replaceQuery(nextValues) {
  const nextQuery = { ...route.query, ...nextValues };
  Object.keys(nextQuery).forEach((key) => {
    if (nextQuery[key] === undefined || nextQuery[key] === null || nextQuery[key] === '') {
      delete nextQuery[key];
    }
  });
  await router.replace({ query: nextQuery });
}

/* -------- data loading -------- */
async function loadAccounts() {
  loadingAccounts.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/api/graph/mailboxes/accounts');
    accounts.value = data.accounts || [];
  } catch (err) {
    setError(err, 'Accounts konnten nicht geladen werden.');
  } finally {
    loadingAccounts.value = false;
  }
}

/** Loads children of the selected folder via API (lazy, on folder select). */
async function loadFolderChildren(folderId, teamKey) {
  const requestId = ++latestChildrenRequest;
  loadingChildren.value = true;
  folderChildren.value = [];
  try {
    const { data } = await api.get('/api/graph/drive/children', {
      params: { team: teamKey, itemId: folderId },
    });
    if (requestId !== latestChildrenRequest) return;
    folderChildren.value = data.items || [];
  } catch (err) {
    if (requestId !== latestChildrenRequest) return;
    setError(err, 'Ordnerinhalt konnte nicht geladen werden.');
  } finally {
    if (requestId !== latestChildrenRequest) return;
    loadingChildren.value = false;
  }
}

async function loadTree(teamKey) {
  const requestId = ++latestTreeRequest;
  loadingTree.value = true;
  error.value = '';
  folderTree.value = [];
  folderChildren.value = [];
  selectedFolderId.value = '';
  treeTeamKey.value = '';
  expandedFolderIds.value = new Set();
  loadedFolderIds.value = new Set();

  try {
    const { data } = await api.get('/api/graph/drive/tree', { params: { team: teamKey } });
    if (requestId !== latestTreeRequest) return;

    // Each root node gets an empty children array (populated lazily on expand)
    folderTree.value = (data.items || []).map((n) => ({ ...n, children: [] }));
    treeTeamKey.value = teamKey;
    initializeExpanded();

    // Auto-select first folder
    const firstFolder = folderTree.value[0];
    if (firstFolder) {
      await selectFolder(firstFolder.id, { updateQuery: true, teamKey });
    }
  } catch (err) {
    if (requestId !== latestTreeRequest) return;
    setError(err, 'Ordnerstruktur konnte nicht geladen werden.');
  } finally {
    if (requestId !== latestTreeRequest) return;
    loadingTree.value = false;
  }
}

async function selectFolder(folderId, { updateQuery = true, teamKey = treeTeamKey.value || selectedTeamKey.value } = {}) {
  if (!folderId) return;
  selectedFolderId.value = folderId;
  ensureExpandedToFolder(folderId);
  if (updateQuery) await replaceQuery({ team: teamKey, folderId });
  await loadFolderChildren(folderId, teamKey);
}

async function selectTeam(teamKey) {
  if (!teamKey || teamKey === selectedTeamKey.value) return;
  selectedTeamKey.value = teamKey;
  selectedFolderId.value = '';
  folderChildren.value = [];
  loadedFolderIds.value = new Set();
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

/* -------- preview -------- */
async function openPreview(item) {
  previewItem.value = item;
  previewUrl.value = '';
  previewError.value = '';

  // Images: render directly via downloadUrl (no extra API call needed)
  if (isImage(item) && item.downloadUrl) return;

  loadingPreview.value = true;
  try {
    const { data } = await api.get('/api/graph/drive/preview', {
      params: { team: selectedTeamKey.value, itemId: item.id },
    });
    previewUrl.value = data.previewUrl || '';
  } catch (err) {
    previewError.value = err?.response?.data?.error || err?.message || 'Vorschau nicht verfügbar.';
  } finally {
    loadingPreview.value = false;
  }
}

function closePreview() {
  previewItem.value = null;
  previewUrl.value = '';
  previewError.value = '';
}

/* -------- upload -------- */
async function uploadFile(file) {
  if (!file || !selectedFolderId.value) return;
  uploadError.value = '';
  uploadSuccess.value = '';
  uploading.value = true;

  try {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post(
      `/api/graph/drive/upload?team=${selectedTeamKey.value}&itemId=${selectedFolderId.value}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    uploadSuccess.value = `"${data.item?.name || file.name}" wurde hochgeladen.`;
    // Reload only the current folder's children (file list)
    await loadFolderChildren(selectedFolderId.value, selectedTeamKey.value);
  } catch (err) {
    uploadError.value = err?.response?.data?.error || err?.message || 'Upload fehlgeschlagen.';
  } finally {
    uploading.value = false;
    dragging.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
}

function onDrop(event) {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) uploadFile(file);
}

function onFileInputChange(event) {
  const file = event.target?.files?.[0];
  if (file) uploadFile(file);
}

/* -------- init -------- */
async function initializePage() {
  await loadAccounts();
  if (!accounts.value.length) return;

  const requestedTeam = normalizeQueryValue(route.query.team);
  const matched = accounts.value.find((a) => a.key === requestedTeam) || accounts.value[0];

  selectedTeamKey.value = matched.key;
  await replaceQuery({ team: matched.key, folderId: normalizeQueryValue(route.query.folderId) || '' });
  await loadTree(matched.key);
}

onMounted(async () => {
  await initializePage();
});
</script>

<style scoped lang="scss">
.drive-dashboard {
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: var(--text);
}

/* Hero */
.drive-dashboard__hero {
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

.drive-dashboard__eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--muted);
}

.drive-dashboard__hero h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 40px);
  line-height: 1;
}

.drive-dashboard__subtitle {
  margin: 10px 0 0;
  max-width: 720px;
  color: var(--muted);
}

.drive-dashboard__refresh {
  border: 1px solid color-mix(in srgb, var(--primary) 45%, var(--border));
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  padding: 10px 16px;
  cursor: pointer;
  font-weight: 600;
}

.drive-dashboard__refresh:disabled {
  cursor: wait;
  opacity: 0.6;
}

/* Filters */
.drive-dashboard__filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drive-dashboard__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.drive-dashboard__account-meta {
  color: var(--muted);
  font-size: 13px;
}

/* Layout */
.drive-dashboard__layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

/* Panel */
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

  h2, h3 { margin: 0; }
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

  &:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
  }

  &:disabled { opacity: 0.6; cursor: wait; }
}

.panel-card__empty,
.panel-card__status {
  margin: 4px 0 0;
  color: var(--muted);
}

/* Folder tree */
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

.folder-tree__caret--ghost { width: 24px; }

.caret {
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(-45deg);
  transition: transform 160ms ease;
}

.caret--open { transform: rotate(45deg); }

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
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    top: -4px; left: 1px;
    width: 7px; height: 4px;
    border: 1px solid color-mix(in srgb, var(--text) 45%, transparent);
    border-bottom: none;
    border-radius: 2px 2px 0 0;
  }
}

.folder-tree__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.folder-tree__count {
  flex: 0 0 auto;
  min-width: 20px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  text-align: center;
  background: color-mix(in srgb, var(--text) 8%, var(--surface));
}

/* Detail header */
.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;

  h2 { margin: 0; }
}

.detail-header__eyebrow {
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

  &:hover:not(:disabled) {
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, var(--surface));
  }

  &.is-current, &:disabled {
    cursor: default;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 14%, var(--surface));
  }
}

.detail-breadcrumb__sep { color: var(--muted); font-size: 13px; }

.folder-id-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.folder-id-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  flex-shrink: 0;
}

.folder-id-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  background: color-mix(in srgb, var(--text) 6%, var(--surface));
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 8px;
  word-break: break-all;
  color: var(--text);
}

.folder-id-copy {
  border: 1px solid color-mix(in srgb, var(--primary) 45%, var(--border));
  background: transparent;
  color: var(--text);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s;

  &:hover { border-color: var(--primary); color: var(--primary); }
  &.copied { border-color: #386a20; color: #386a20; }
}

/* File table */
.table-wrap { overflow: auto; }

.file-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 10px 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    text-align: left;
    font-size: 13px;
    vertical-align: middle;
  }

  th {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
}

.id-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  max-width: 100%;
}

.item-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: var(--muted);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: middle;
}

.id-copy-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;

  &:hover { border-color: var(--primary); color: var(--primary); }
}

.row--folder td { font-weight: 500; }

.file-name, .file-name-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.file-name-btn {
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  padding: 0;
  font-size: inherit;
  font-weight: 500;

  &:hover { text-decoration: underline; }
}

/* File icons (CSS-only) */
.file-icon {
  width: 14px;
  height: 16px;
  border: 1px solid color-mix(in srgb, var(--text) 40%, transparent);
  border-radius: 2px;
  position: relative;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 2px; right: 2px;
    width: 4px; height: 4px;
    border-top: 1px solid color-mix(in srgb, var(--text) 35%, transparent);
    border-right: 1px solid color-mix(in srgb, var(--text) 35%, transparent);
  }
}

.file-icon--folder {
  border-radius: 2px 2px 3px 3px;

  &::before {
    content: '';
    position: absolute;
    top: -4px; left: 1px;
    width: 7px; height: 4px;
    border: 1px solid color-mix(in srgb, var(--text) 40%, transparent);
    border-bottom: none;
    border-radius: 2px 2px 0 0;
  }

  &::after { display: none; }
}

.actions-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.action-btn {
  border: 1px solid color-mix(in srgb, var(--primary) 50%, var(--border));
  background: transparent;
  color: var(--text);
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
  }
}

/* Upload */
.upload-card h3 { margin: 0 0 12px; }

.upload-zone {
  border: 2px dashed color-mix(in srgb, var(--primary) 35%, var(--border));
  border-radius: 14px;
  padding: 24px;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
  position: relative;

  &--drag {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 6%, var(--surface));
  }

  &--uploading { opacity: 0.7; pointer-events: none; }
}

.upload-zone__input {
  display: none;
}

.upload-zone__hint {
  color: var(--muted);
  font-size: 14px;
}

.upload-zone__pick {
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  font-size: inherit;
  padding: 0;
  text-decoration: underline;
}

.upload-error { color: #b3261e; margin: 8px 0 0; font-size: 13px; }
.upload-success { color: #386a20; margin: 8px 0 0; font-size: 13px; }

/* Error banner */
.drive-dashboard__error {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, #b3261e 35%, var(--border));
  background: color-mix(in srgb, #b3261e 10%, var(--surface));
  color: var(--text);
}

/* Preview modal */
.preview-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.preview-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  width: min(96vw, 1100px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-modal__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.preview-modal__name {
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.preview-modal__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.preview-modal__close {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  border-radius: 999px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 14px;
}

.preview-modal__body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  min-height: 300px;
}

.preview-modal__loading,
.preview-modal__error {
  color: var(--muted);
  text-align: center;
}

.preview-modal__img {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 10px;
  object-fit: contain;
}

.preview-modal__frame {
  width: 100%;
  height: 70vh;
  border: none;
  border-radius: 10px;
}

/* Responsive */
@media (max-width: 900px) {
  .drive-dashboard__layout {
    grid-template-columns: 1fr;
  }

  .folder-tree {
    max-height: 380px;
  }
}

@media (max-width: 640px) {
  .drive-dashboard__hero {
    padding: 18px;
    flex-direction: column;
  }
}
</style>
