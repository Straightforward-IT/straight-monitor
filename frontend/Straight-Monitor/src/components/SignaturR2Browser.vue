<template>
  <Toolbar>
    <SearchBar
      v-model="searchQuery"
      class="toolbar-search"
      placeholder="Ablage durchsuchen"
      aria-label="Ablage durchsuchen"
    />
    <button class="icon-button" type="button" title="Ablage aktualisieren" :disabled="loading" @click="loadFiles">
      <font-awesome-icon :icon="['fas', 'rotate']" :spin="loading" />
    </button>
  </Toolbar>

  <div class="storage-browser">
    <div class="storage-head">
      <nav class="storage-breadcrumb" aria-label="Ablagepfad">
        <button type="button" @click="selectFolder('')">
          <font-awesome-icon :icon="['fas', 'folder-open']" /> Signaturen
        </button>
        <template v-for="crumb in breadcrumbs" :key="crumb.path">
          <font-awesome-icon :icon="['fas', 'chevron-right']" class="breadcrumb-separator" />
          <button type="button" @click="selectFolder(crumb.path)">{{ crumb.label }}</button>
        </template>
      </nav>
    </div>

    <div v-if="loading && files.length === 0" class="storage-state">
      <font-awesome-icon :icon="['fas', 'spinner']" spin />
      <span>R2-Ablage wird geladen…</span>
    </div>
    <div v-else-if="error" class="storage-state storage-state--error">
      <span>{{ error }}</span>
      <button type="button" @click="loadFiles">Erneut versuchen</button>
    </div>
    <div v-else class="storage-layout">
      <aside class="folder-panel" aria-label="Ordnerstruktur">
        <div
          v-for="folder in folderTree"
          :key="folder.path"
          class="folder-row"
          :class="{ active: selectedPath === folder.path }"
          :style="{ paddingLeft: `${12 + folder.depth * 18}px` }"
        >
          <button
            class="folder-toggle"
            type="button"
            :class="{ invisible: !folder.hasChildren }"
            :disabled="Boolean(searchQuery.trim())"
            :title="isFolderExpanded(folder.path) ? 'Ordner zuklappen' : 'Ordner aufklappen'"
            @click="toggleFolder(folder.path)"
          >
            <font-awesome-icon :icon="['fas', isFolderExpanded(folder.path) ? 'chevron-down' : 'chevron-right']" />
          </button>
          <button class="folder-select" type="button" @click="selectFolder(folder.path)">
            <font-awesome-icon :icon="['fas', isFolderExpanded(folder.path) ? 'folder-open' : 'folder']" />
            <span>{{ folder.label }}</span>
          </button>
        </div>
      </aside>

      <section class="file-panel">
        <div class="file-panel-head">
          <button
            v-if="currentEntity"
            class="entity-link"
            type="button"
            :disabled="entityOpening"
            :title="currentEntity.entityType === 'kunde' ? 'Kundenkarte öffnen' : 'Mitarbeiterkarte öffnen'"
            @click="openCurrentEntity"
          >
            <strong>{{ currentFolderLabel }}</strong>
            <font-awesome-icon :icon="['fas', entityOpening ? 'spinner' : 'arrow-up-right-from-square']" :spin="entityOpening" />
          </button>
          <strong v-else>{{ currentFolderLabel }}</strong>
          <span>{{ currentItems.length }} {{ currentItems.length === 1 ? 'Element' : 'Elemente' }}</span>
        </div>

        <div v-if="currentItems.length === 0" class="storage-state">
          <font-awesome-icon :icon="['fas', searchQuery ? 'magnifying-glass' : 'folder-open']" />
          <span>{{ searchQuery ? 'Keine passenden Dokumente oder Ordner gefunden.' : 'Dieser Ordner ist leer.' }}</span>
        </div>

        <div v-else class="file-list">
          <button
            v-for="folder in currentFolders"
            :key="folder.path"
            class="file-row file-row--folder"
            type="button"
            @click="selectFolder(folder.path)"
          >
            <span class="file-icon"><font-awesome-icon :icon="['fas', 'folder']" /></span>
            <span class="file-name">{{ folder.label }}</span>
            <span class="file-kind">Ordner</span>
            <font-awesome-icon :icon="['fas', 'chevron-right']" class="row-chevron" />
          </button>

          <div v-for="file in currentFiles" :key="file.key" class="file-row">
            <span class="file-icon file-icon--pdf"><font-awesome-icon :icon="['fas', 'file-pdf']" /></span>
            <span class="file-name" :title="file.name">{{ file.name }}</span>
            <span class="file-meta">{{ formatSize(file.size) }}</span>
            <span class="file-meta file-meta--date">{{ formatDate(file.lastModified) }}</span>
            <div class="file-actions">
              <button type="button" title="Datei öffnen" @click="openFile(file)">
                <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
              </button>
              <button type="button" title="Datei herunterladen" @click="downloadFile(file)">
                <font-awesome-icon :icon="['fas', 'download']" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <EmployeeCardModal
      :mitarbeiter-id="selectedMitarbeiterId"
      @close="selectedMitarbeiterId = null"
    />

  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowUpRightFromSquare, faChevronDown, faChevronRight, faDownload, faFilePdf,
  faFolder, faFolderOpen, faMagnifyingGlass, faRotate, faSpinner, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import { useCustomerModals } from '@/composables/useCustomerModals';
import EmployeeCardModal from '@/components/Modals/EmployeeCardModal.vue';
import SearchBar from '@/components/SearchBar.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';

library.add(
  faArrowUpRightFromSquare, faChevronDown, faChevronRight, faDownload, faFilePdf,
  faFolder, faFolderOpen, faMagnifyingGlass, faRotate, faSpinner, faXmark,
);

const files = ref([]);
const loading = ref(false);
const error = ref('');
const selectedPath = ref('');
const searchQuery = ref('');
const expandedPaths = ref(new Set(['']));
const entityOpening = ref(false);
const selectedMitarbeiterId = ref(null);
const { openCustomer } = useCustomerModals();

function getRelativePath(file) {
  return file.displayPath || file.key.replace(/^(?:Signatures|signaturen)\//, '');
}

function getFolderLabel(path) {
  const parts = path.split('/');
  const labelIndex = parts.length - 1;
  const matchingFile = files.value.find((file) => {
    if (!file.folderLabels?.[labelIndex]) return false;
    const folderPath = getRelativePath(file).split('/').slice(0, -1);
    return folderPath.slice(0, parts.length).join('/') === path;
  });
  if (matchingFile) return matchingFile.folderLabels[labelIndex];
  return parts.pop() || 'Signaturen';
}

const filteredFiles = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('de');
  if (!query) return files.value;

  return files.value.filter((file) => [
    ...(file.folderLabels || []),
    file.fileName,
    getRelativePath(file),
  ].filter(Boolean).join(' ').toLocaleLowerCase('de').includes(query));
});

const allFolderPaths = computed(() => {
  const paths = new Set(['']);
  filteredFiles.value.forEach((file) => {
    const parts = getRelativePath(file).split('/');
    parts.pop();
    parts.forEach((_, index) => paths.add(parts.slice(0, index + 1).join('/')));
  });
  return paths;
});

const folderTree = computed(() => [...allFolderPaths.value]
    .sort((a, b) => a.localeCompare(b, 'de'))
    .filter((path) => {
      if (!path || searchQuery.value.trim()) return true;
      const parts = path.split('/');
      const parentPath = parts.slice(0, -1).join('/');
      return isFolderExpanded(parentPath) && folderAncestorsExpanded(parentPath);
    })
    .map((path) => ({
      path,
      depth: path ? path.split('/').length : 0,
      label: path ? getFolderLabel(path) : 'Signaturen',
      hasChildren: [...allFolderPaths.value].some((candidate) => candidate.startsWith(path ? `${path}/` : '') && candidate !== path),
    }))
);

const breadcrumbs = computed(() => {
  const parts = selectedPath.value ? selectedPath.value.split('/') : [];
  return parts.map((_, index) => {
    const path = parts.slice(0, index + 1).join('/');
    return { label: getFolderLabel(path), path };
  });
});

const currentFolders = computed(() => {
  const folders = new Map();
  const prefix = selectedPath.value ? `${selectedPath.value}/` : '';
  filteredFiles.value.forEach((file) => {
    const relative = getRelativePath(file);
    if (!relative.startsWith(prefix)) return;
    const remainder = relative.slice(prefix.length);
    const separator = remainder.indexOf('/');
    if (separator === -1) return;
    const name = remainder.slice(0, separator);
    const path = `${prefix}${name}`;
    folders.set(name, { name, path, label: getFolderLabel(path) });
  });
  return [...folders.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'));
});

const currentFiles = computed(() => {
  const prefix = selectedPath.value ? `${selectedPath.value}/` : '';
  return filteredFiles.value
    .map((file) => ({ ...file, relative: getRelativePath(file) }))
    .filter((file) => file.relative.startsWith(prefix) && !file.relative.slice(prefix.length).includes('/'))
    .map((file) => ({ ...file, name: file.fileName || file.relative.slice(prefix.length) }))
    .sort((a, b) => {
      const dateDifference = new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
      return dateDifference || a.name.localeCompare(b.name, 'de');
    });
});

const currentItems = computed(() => [...currentFolders.value, ...currentFiles.value]);
const currentFolderLabel = computed(() => selectedPath.value ? getFolderLabel(selectedPath.value) : 'Signaturen');
const currentEntity = computed(() => {
  const parts = selectedPath.value.split('/').filter(Boolean);
  if (parts.length !== 3 || !['kunden', 'mitarbeiter'].includes(parts[1])) return null;

  const matchingFile = files.value.find((file) =>
    file.entityId && getRelativePath(file).startsWith(`${selectedPath.value}/`)
  );
  if (!matchingFile) return null;
  return { entityType: matchingFile.entityType, entityId: matchingFile.entityId };
});

function selectFolder(path) {
  selectedPath.value = path;
  const nextExpanded = new Set(expandedPaths.value);
  const parts = path ? path.split('/') : [];
  nextExpanded.add('');
  parts.forEach((_, index) => nextExpanded.add(parts.slice(0, index + 1).join('/')));
  expandedPaths.value = nextExpanded;
}

function isFolderExpanded(path) {
  return searchQuery.value.trim() ? true : expandedPaths.value.has(path);
}

function folderAncestorsExpanded(path) {
  if (!path) return true;
  const parts = path.split('/');
  return parts.every((_, index) => expandedPaths.value.has(parts.slice(0, index + 1).join('/')));
}

function toggleFolder(path) {
  const nextExpanded = new Set(expandedPaths.value);
  if (nextExpanded.has(path)) nextExpanded.delete(path);
  else nextExpanded.add(path);
  expandedPaths.value = nextExpanded;
}

async function openCurrentEntity() {
  const entity = currentEntity.value;
  if (!entity?.entityId || entityOpening.value) return;

  if (entity.entityType === 'mitarbeiter') {
    selectedMitarbeiterId.value = entity.entityId;
    return;
  }

  entityOpening.value = true;
  try {
    const { data } = await api.get(`/api/kunden/${entity.entityId}`);
    openCustomer(data);
  } catch (requestError) {
    error.value = requestError?.response?.data?.message
      || requestError?.response?.data?.msg
      || 'Kundenkarte konnte nicht geöffnet werden.';
  } finally {
    entityOpening.value = false;
  }
}

async function loadFiles() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/api/signaturen/storage');
    files.value = Array.isArray(data) ? data : [];
    if (!folderTree.value.some((folder) => folder.path === selectedPath.value)) selectedPath.value = '';
  } catch (requestError) {
    error.value = requestError?.response?.data?.message || 'R2-Ablage konnte nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

async function getFileUrl(file, download = false) {
  const { data } = await api.get('/api/signaturen/storage/url', {
    params: { key: file.key, download: download ? 'true' : 'false' },
  });
  return data.url;
}

async function openFile(file) {
  const previewWindow = window.open('', '_blank');
  try {
    const url = await getFileUrl(file);
    if (previewWindow) previewWindow.location.href = url;
    else window.open(url, '_blank', 'noopener');
  } catch (requestError) {
    previewWindow?.close();
    error.value = requestError?.response?.data?.message || 'Datei konnte nicht geöffnet werden.';
  }
}

async function downloadFile(file) {
  try {
    const url = await getFileUrl(file, true);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (requestError) {
    error.value = requestError?.response?.data?.message || 'Download konnte nicht gestartet werden.';
  }
}

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

watch(searchQuery, (query, previousQuery) => {
  if (query.trim() && !previousQuery.trim()) selectedPath.value = '';
});

onMounted(loadFiles);
</script>

<style scoped lang="scss">
.storage-browser {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
}

.storage-head {
  min-height: 48px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.storage-breadcrumb {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow-x: auto;

  button {
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 0.84rem;
    white-space: nowrap;
    cursor: pointer;
    &:hover { color: var(--primary); }
  }
}

.breadcrumb-separator { color: var(--muted); font-size: 0.62rem; margin: 0 5px; }
.icon-button, .file-actions button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  &:hover { border-color: var(--primary); color: var(--primary); }
}

.storage-layout { display: grid; grid-template-columns: minmax(210px, 280px) minmax(0, 1fr); min-height: 430px; }
.folder-panel { padding: 8px 0; border-right: 1px solid var(--border); overflow: auto; }
.folder-row {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  background: transparent;
  color: var(--text);
  &:hover { background: color-mix(in srgb, var(--primary) 7%, transparent); }
  &.active { color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
  &.active svg { color: var(--primary); }
}
.folder-toggle {
  width: 22px;
  height: 100%;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.6rem;
  &.invisible { visibility: hidden; }
  &:disabled { cursor: default; }
}
.folder-select {
  height: 100%;
  min-width: 0;
  flex: 1;
  padding: 0 10px 0 2px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  svg { color: var(--muted); flex-shrink: 0; }
}

.file-panel { min-width: 0; }
.file-panel-head {
  height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  strong { font-size: 0.9rem; font-weight: 600; }
  span { color: var(--muted); font-size: 0.76rem; }
}

.entity-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  svg { color: var(--muted); font-size: 0.72rem; }
  &:hover { color: var(--primary); }
  &:hover svg { color: var(--primary); }
  &:disabled { cursor: wait; opacity: 0.65; }
}

.file-list { width: 100%; }
.file-row {
  min-height: 48px;
  padding: 7px 12px;
  display: grid;
  grid-template-columns: 30px minmax(140px, 1fr) 80px 100px 74px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-size: 0.8rem;
}
.file-row--folder {
  width: 100%;
  grid-template-columns: 30px minmax(140px, 1fr) 100px 18px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  &:hover { background: color-mix(in srgb, var(--primary) 6%, transparent); }
}
.file-icon { color: #d39a37; font-size: 1rem; text-align: center; }
.file-icon--pdf { color: #c94141; }
.file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.file-kind, .file-meta, .row-chevron { color: var(--muted); }
.row-chevron { font-size: 0.65rem; }
.file-actions { display: flex; gap: 6px; }

.storage-state {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  font-size: 0.84rem;
  button { border: 0; background: transparent; color: var(--primary); cursor: pointer; }
}
.storage-state--error { color: #c94141; }

@media (max-width: 760px) {
  .storage-layout { grid-template-columns: 1fr; }
  .folder-panel { max-height: 190px; border-right: 0; border-bottom: 1px solid var(--border); }
  .file-row { grid-template-columns: 30px minmax(100px, 1fr) 70px 74px; }
  .file-meta--date { display: none; }
}
</style>
