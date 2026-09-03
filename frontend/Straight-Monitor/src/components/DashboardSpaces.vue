<template>
  <section class="spaces">
    <div v-if="loading && !spaces.length" class="spaces__state">
      <font-awesome-icon :icon="['fas', 'spinner']" spin />
      Spaces werden geladen...
    </div>
    <div v-else-if="error" class="spaces__state spaces__state--error">{{ error }}</div>
    <div v-else-if="!spaces.length" class="spaces__state">
      <font-awesome-icon :icon="['fas', 'folder-open']" />
      Für deine Standorte sind noch keine Spaces eingerichtet.
    </div>
    <PageLayout
      v-else
      :model-value="selectedSpaceId"
      :tabs="locationTabs"
      aria-label="Standort-Space auswählen"
      width="full"
      content-variant="flush"
      @update:model-value="selectSpace"
    >
      <Toolbar wrap>
        <SearchBar v-model="searchQuery" class="toolbar-search" placeholder="In diesem Space suchen" aria-label="Space durchsuchen" />
        <ToolbarLabel>{{ uploadingCount ? `${uploadingCount} ${uploadingCount === 1 ? 'Datei wird' : 'Dateien werden'} hochgeladen...` : `${filteredItems.length} ${filteredItems.length === 1 ? 'Eintrag' : 'Einträge'}` }}</ToolbarLabel>
        <template #actions>
        <ToolbarGroup push-right>
          <ToolbarButton variant="secondary" :disabled="loading" @click="refreshCurrentFolder">
            <font-awesome-icon :icon="['fas', loading ? 'spinner' : 'rotate']" :spin="loading" />
            Aktualisieren
          </ToolbarButton>
        </ToolbarGroup>
        </template>
      </Toolbar>

      <div
        class="spaces__browser"
        :class="{ 'spaces__browser--drop-target': dropTargetId === currentFolderId }"
        @dragover.prevent="handleDirectoryDragOver"
        @dragleave="handleDirectoryDragLeave"
        @drop.prevent="handleDirectoryDrop"
      >
        <div v-if="fileOpenNotice" class="spaces__notice" role="status">{{ fileOpenNotice }}</div>
        <header class="spaces__head">
          <nav class="spaces__breadcrumb" aria-label="Space-Pfad">
            <button type="button" @click="openRoot">{{ selectedSpace?.nameFull || 'Space' }}</button>
            <template v-for="folder in path" :key="folder.id">
              <font-awesome-icon :icon="['fas', 'chevron-right']" />
              <button type="button" @click="openFolder(folder)">{{ folder.name }}</button>
            </template>
          </nav>
          <div v-if="showSelectionHeader" class="spaces__selection" aria-live="polite">
            <span>{{ selectedItems.length }} {{ selectedItems.length === 1 ? 'Eintrag ausgewählt' : 'Einträge ausgewählt' }}</span>
            <button type="button" title="Ausgewählte Einträge" aria-label="Ausgewählte Einträge" @click="openSelectionContextMenu">
              <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
            </button>
            <button type="button" title="Auswahl aufheben" aria-label="Auswahl aufheben" @click="clearSelection">
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </div>
          <span v-if="loading" class="spaces__loading">Lädt...</span>
        </header>

        <div v-if="!loading && !filteredItems.length" class="spaces__state spaces__state--inner">
          <font-awesome-icon :icon="['fas', searchQuery ? 'magnifying-glass' : 'folder-open']" />
          {{ searchQuery ? 'Keine passenden Einträge gefunden.' : 'Dieser Space ist leer.' }}
        </div>
        <div v-else class="spaces__list">
          <button
            v-for="item in filteredFolders"
            :key="item.id"
            type="button"
            class="spaces__row spaces__row--folder"
            :class="{ 'spaces__row--drop-target': dropTargetId === item.id, 'spaces__row--selected': isSelected(item.id), 'spaces__row--dragging': isDragging(item.id) }"
            draggable="true"
            @click="handleFolderClick(item, $event)"
            @dragstart="handleDragStart(item, $event)"
            @dragend="handleDragEnd"
            @dragover.stop.prevent="handleFolderDragOver(item, $event)"
            @dragleave.stop="handleFolderDragLeave(item)"
            @drop.stop.prevent="handleFolderDrop(item, $event)"
          >
            <font-awesome-icon :icon="['fas', 'folder-open']" />
            <span>{{ item.name }}</span>
            <font-awesome-icon :icon="['fas', 'chevron-right']" class="spaces__row-arrow" />
          </button>
          <div
            v-for="item in filteredFiles"
            :key="item.id"
            class="spaces__row"
            :class="{ 'spaces__row--downloading': isDownloading(item.id), 'spaces__row--moving': movingItemIds.includes(item.id), 'spaces__row--selected': isSelected(item.id), 'spaces__row--dragging': isDragging(item.id) }"
            :style="{ '--download-progress': `${downloadProgress(item.id)}%` }"
            draggable="true"
            @click="handleItemClick(item, $event)"
            @contextmenu.prevent="openContextMenu(item, $event, true)"
            @dragstart="handleDragStart(item, $event)"
            @dragend="handleDragEnd"
          >
            <font-awesome-icon :icon="['fas', 'file-lines']" />
            <span>{{ item.name }}</span>
            <small>{{ formatSize(item.size) }}<template v-if="item.lastModifiedDateTime"> · {{ formatDate(item.lastModifiedDateTime) }}</template></small>
            <button
              type="button"
              class="spaces__actions"
              :disabled="isDownloading(item.id) || deletingId === item.id || renamingId === item.id"
              :aria-label="`${item.name} Aktionen`"
              title="Aktionen"
              @click="openContextMenu(item, $event)"
            >
              <font-awesome-icon :icon="['fas', deletingId === item.id || renamingId === item.id ? 'spinner' : 'ellipsis-vertical']" :spin="deletingId === item.id || renamingId === item.id" />
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
    <ContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :options="contextMenuOptions"
      @select="handleContextMenuAction"
      @close="closeContextMenu"
    />
    <ContextMenu
      v-if="appActionsMenu.visible"
      :x="appActionsMenu.x"
      :y="appActionsMenu.y"
      :options="appActionsMenuOptions"
      @select="handleAppActionsMenuAction"
      @close="closeAppActionsMenu"
    />
    <ContextMenu
      v-if="selectionContextMenu.visible"
      :x="selectionContextMenu.x"
      :y="selectionContextMenu.y"
      :options="selectionContextMenuOptions"
      @select="handleSelectionContextMenuAction"
      @close="closeSelectionContextMenu"
    />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import SearchBar from '@/components/SearchBar.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import ToolbarGroup from '@/components/ui-elements/ToolbarGroup.vue';
import ToolbarLabel from '@/components/ui-elements/ToolbarLabel.vue';
import PageLayout from '@/components/layout/PageLayout.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import { useSignaturModal } from '@/stores/signaturModal';
import { useSignaturBuilder } from '@/stores/signaturBuilder';

const spaces = ref([]);
const selectedSpaceId = ref('');
const items = ref([]);
const path = ref([]);
const searchQuery = ref('');
const loading = ref(false);
const error = ref('');
const downloading = ref({});
const deletingId = ref('');
const renamingId = ref('');
const contextMenu = ref({ visible: false, x: 0, y: 0 });
const contextMenuItem = ref(null);
const appActionsMenu = ref({ visible: false, x: 0, y: 0 });
const appActionsMenuItem = ref(null);
const selectionContextMenu = ref({ visible: false, x: 0, y: 0 });
const draggedItems = ref([]);
const dropTargetId = ref('');
const uploadingCount = ref(0);
const movingItemIds = ref([]);
const selectedItemIds = ref([]);
const selectionAnchorId = ref('');
const fileOpenNotice = ref('');
const signaturModal = useSignaturModal();
const signaturBuilder = useSignaturBuilder();
let fileOpenNoticeTimer;
const SPACE_NAVIGATION_STORAGE_KEY = 'straight-monitor:dashboard-spaces-navigation';

const selectedSpace = computed(() => spaces.value.find((space) => space._id === selectedSpaceId.value) || null);
const currentFolderId = computed(() => path.value[path.value.length - 1]?.id || selectedSpace.value?.spaceFolder?.folderId || '');
const locationTabs = computed(() => spaces.value.map((space) => ({
  id: space._id,
  label: space.nameFull,
  icon: ['fas', 'building'],
})));
const contextMenuOptions = computed(() => contextMenuItem.value ? [
  { label: 'App-Aktionen', action: 'app-actions', special: true },
  { label: 'Herunterladen', action: 'download' },
  { label: 'Umbenennen', action: 'rename' },
  { label: 'Löschen', action: 'delete' },
] : []);
const appActionsMenuOptions = computed(() => isSignatureFile(appActionsMenuItem.value) ? [
  { label: 'Vorlage erstellen', action: 'create-template' },
  { label: 'Einmalige Signatur erstellen', action: 'create-one-off-signature' },
] : [
  { label: 'Keine App-Aktionen verfügbar', action: 'none' },
]);
const selectionContextMenuOptions = computed(() => selectedItems.value.length ? [
  { label: 'Als ZIP herunterladen', action: 'download-zip' },
  ...(selectedItemsAreFiles.value ? [{ label: 'Löschen', action: 'delete' }] : []),
] : []);
const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('de');
  return query ? items.value.filter((item) => item.name?.toLocaleLowerCase('de').includes(query)) : items.value;
});
const filteredFolders = computed(() => filteredItems.value.filter((item) => item.isFolder));
const filteredFiles = computed(() => filteredItems.value.filter((item) => !item.isFolder));
const visibleItems = computed(() => [...filteredFolders.value, ...filteredFiles.value]);
const selectedItems = computed(() => items.value.filter((item) => selectedItemIds.value.includes(item.id)));
const showSelectionHeader = computed(() => selectedItems.value.length > 1 || selectedItems.value[0]?.isFolder);
const selectedItemsAreFiles = computed(() => selectedItems.value.length > 0 && selectedItems.value.every((item) => !item.isFolder));

function formatSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 1) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function loadItems(itemId) {
  if (!selectedSpaceId.value) return false;
  const folderId = typeof itemId === 'string' ? itemId : '';
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/api/graph/spaces/${selectedSpaceId.value}/children`, { params: folderId ? { itemId: folderId } : {} });
    items.value = data.items || [];
    selectedItemIds.value = selectedItemIds.value.filter((id) => items.value.some((item) => item.id === id));
    return true;
  } catch (requestError) {
    error.value = requestError.response?.data?.error || 'Der Space konnte nicht geladen werden.';
    return false;
  } finally {
    loading.value = false;
  }
}

async function refreshCurrentFolder() {
  await loadItems(currentFolderId.value);
}

async function selectSpace(spaceId) {
  selectedSpaceId.value = spaceId;
  path.value = [];
  searchQuery.value = '';
  clearSelection();
  await loadItems();
  persistNavigation();
}

async function openFolder(folder) {
  const existingIndex = path.value.findIndex((entry) => entry.id === folder.id);
  path.value = existingIndex === -1 ? [...path.value, folder] : path.value.slice(0, existingIndex + 1);
  clearSelection();
  await loadItems(folder.id);
  persistNavigation();
}

async function openRoot() {
  path.value = [];
  clearSelection();
  await loadItems();
  persistNavigation();
}

function persistNavigation() {
  if (!selectedSpaceId.value) return;
  localStorage.setItem(SPACE_NAVIGATION_STORAGE_KEY, JSON.stringify({
    locationId: selectedSpaceId.value,
    path: path.value.map((folder) => ({ id: folder.id, name: folder.name })),
  }));
}

function readPersistedNavigation() {
  try {
    const value = JSON.parse(localStorage.getItem(SPACE_NAVIGATION_STORAGE_KEY) || 'null');
    return value?.locationId && Array.isArray(value.path) ? value : null;
  } catch (_) {
    return null;
  }
}

function openContextMenu(item, event, atPointer = false) {
  event.stopPropagation();
  const rect = event.currentTarget.getBoundingClientRect();
  const x = atPointer ? event.clientX : rect.right;
  const y = atPointer ? event.clientY : rect.bottom + 4;
  contextMenuItem.value = item;
  contextMenu.value = {
    visible: true,
    x: Math.max(8, Math.min(x, window.innerWidth - 160)),
    y: Math.max(8, Math.min(y, window.innerHeight - 104)),
  };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
  contextMenuItem.value = null;
}

async function handleContextMenuAction(action) {
  const item = contextMenuItem.value;
  const position = { x: contextMenu.value.x, y: contextMenu.value.y };
  closeContextMenu();
  if (!item) return;
  if (action === 'app-actions') {
    appActionsMenuItem.value = item;
    appActionsMenu.value = { visible: true, ...position };
    return;
  }
  if (action === 'download') await downloadFile(item);
  if (action === 'rename') await renameFile(item);
  if (action === 'delete') await deleteFile(item);
}

function closeAppActionsMenu() {
  appActionsMenu.value.visible = false;
  appActionsMenuItem.value = null;
}

function openSelectionContextMenu(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  selectionContextMenu.value = {
    visible: true,
    x: Math.max(8, Math.min(rect.right, window.innerWidth - 190)),
    y: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 52)),
  };
}

function closeSelectionContextMenu() {
  selectionContextMenu.value.visible = false;
}

async function handleSelectionContextMenuAction(action) {
  closeSelectionContextMenu();
  if (action === 'download-zip') await downloadSelectedZip();
  if (action === 'delete') await deleteSelectedFiles();
}

function handleAppActionsMenuAction(action) {
  const item = appActionsMenuItem.value;
  closeAppActionsMenu();
  if (action === 'create-template' && item) openSpaceTemplateBuilder(item);
  if (action === 'create-one-off-signature' && item) openSpaceTemplateBuilder(item, { oneOff: true });
}

function isSignatureFile(item) {
  return /\.(pdf|docx)$/i.test(item?.name || '');
}

async function openSpaceTemplateBuilder(item, { oneOff = false } = {}) {
  const name = item.name.replace(/\.(pdf|docx)$/i, '');
  error.value = '';
  try {
    const { data: template } = await api.post(
      `/api/signaturen/spaces/${selectedSpaceId.value}/items/${encodeURIComponent(item.id)}/template`,
      { name }
    );
    signaturBuilder.openBuilder({ templateId: template.id, name: template.name || name, closeAfterSave: oneOff }, (savedTemplate) => {
      if (!oneOff || !savedTemplate?.id) return;
      signaturModal.openModal({
        name,
        locationId: selectedSpaceId.value,
        templateId: savedTemplate.id,
        templateName: savedTemplate.name || template.name || name,
      });
    });
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Die Vorlage konnte nicht erstellt werden.';
  }
}

function isSelected(itemId) {
  return selectedItemIds.value.includes(itemId);
}

function isDragging(itemId) {
  return draggedItems.value.some((item) => item.id === itemId);
}

function clearSelection() {
  selectedItemIds.value = [];
  selectionAnchorId.value = '';
}

function handleKeydown(event) {
  if (event.key === 'Escape' && selectedItems.value.length) clearSelection();
}

function handleItemClick(item, event) {
  const itemIds = visibleItems.value.map((entry) => entry.id);
  if (event.shiftKey && selectionAnchorId.value && itemIds.includes(selectionAnchorId.value)) {
    const start = itemIds.indexOf(selectionAnchorId.value);
    const end = itemIds.indexOf(item.id);
    selectedItemIds.value = itemIds.slice(Math.min(start, end), Math.max(start, end) + 1);
    return;
  }
  if (event.metaKey || event.ctrlKey) {
    selectedItemIds.value = isSelected(item.id)
      ? selectedItemIds.value.filter((id) => id !== item.id)
      : [...selectedItemIds.value, item.id];
    selectionAnchorId.value = item.id;
    return;
  }
  openFile(item);
}

function canOpenInBrowser(item) {
  return /\.(pdf|png|jpe?g|gif|webp|avif|txt|md|csv|json|xml|mp3|wav|ogg|mp4|webm)$/i.test(item.name || '');
}

function showFileOpenNotice(message) {
  fileOpenNotice.value = message;
  clearTimeout(fileOpenNoticeTimer);
  fileOpenNoticeTimer = setTimeout(() => { fileOpenNotice.value = ''; }, 3200);
}

async function openFile(item) {
  if (!canOpenInBrowser(item)) {
    showFileOpenNotice('Dieses Dateiformat kann nicht im Browser geöffnet werden.');
    return;
  }
  const fileTab = window.open('', '_blank');
  if (!fileTab) {
    showFileOpenNotice('Der Browser hat das Öffnen eines neuen Tabs blockiert.');
    return;
  }
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || ''}/api/graph/spaces/${selectedSpaceId.value}/download/${encodeURIComponent(item.id)}`,
      { credentials: 'include', headers: token ? { 'x-auth-token': token } : {} }
    );
    if (!response.ok) {
      const responseError = await response.json().catch(() => null);
      throw new Error(responseError?.error || 'Die Datei konnte nicht geöffnet werden.');
    }
    const fileUrl = URL.createObjectURL(await response.blob());
    fileTab.location.replace(fileUrl);
    setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
  } catch (requestError) {
    fileTab.close();
    showFileOpenNotice(requestError.message || 'Die Datei konnte nicht geöffnet werden.');
  }
}

function handleFolderClick(folder, event) {
  if (event.metaKey || event.ctrlKey) {
    handleItemClick(folder, event);
    return;
  }
  openFolder(folder);
}

function handleDragStart(item, event) {
  if (!isSelected(item.id)) {
    selectedItemIds.value = [item.id];
    selectionAnchorId.value = item.id;
  }
  draggedItems.value = selectedItems.value.filter((selected) => !selectedItemIds.value.some((id) => id === selected.parentId));
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/x-straight-monitor-space-items', draggedItems.value.map((selected) => selected.id).join(','));
  setDragPreview(item, draggedItems.value.length, event);
}

function handleDragEnd() {
  draggedItems.value = [];
  dropTargetId.value = '';
}

function setDragPreview(item, count, event) {
  const preview = document.createElement('div');
  preview.className = 'spaces__drag-preview';
  const icon = event.currentTarget.querySelector('svg')?.cloneNode(true);
  if (icon) preview.append(icon);
  const label = document.createElement('span');
  label.textContent = count > 1 ? `${item.name} · ${count} Einträge` : item.name;
  preview.append(label);
  document.body.append(preview);
  event.dataTransfer.setDragImage(preview, 16, 16);
  requestAnimationFrame(() => preview.remove());
}

function setDropTarget(folderId, event) {
  if (draggedItems.value.some((item) => item.id === folderId)) return;
  event.dataTransfer.dropEffect = draggedItems.value.length ? 'move' : 'copy';
  dropTargetId.value = folderId;
}

function handleFolderDragOver(folder, event) {
  setDropTarget(folder.id, event);
}

function handleFolderDragLeave(folder) {
  if (dropTargetId.value === folder.id) dropTargetId.value = '';
}

function handleDirectoryDragOver(event) {
  setDropTarget(currentFolderId.value, event);
}

function handleDirectoryDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) dropTargetId.value = '';
}

async function handleFolderDrop(folder, event) {
  await handleDrop(folder.id, event);
}

async function handleDirectoryDrop(event) {
  await handleDrop(currentFolderId.value, event);
}

async function handleDrop(targetFolderId, event) {
  dropTargetId.value = '';
  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length) {
    await uploadFiles(files, targetFolderId);
    return;
  }
  const droppedItems = draggedItems.value;
  handleDragEnd();
  if (!droppedItems.length) return;
  await moveItems(droppedItems, targetFolderId);
}

async function uploadFiles(files, parentItemId) {
  if (!selectedSpaceId.value || !parentItemId) return;
  uploadingCount.value += files.length;
  error.value = '';
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('parentItemId', parentItemId);
      await api.post(`/api/graph/spaces/${selectedSpaceId.value}/upload`, formData);
    }
    await loadItems(currentFolderId.value);
  } catch (requestError) {
    error.value = requestError.response?.data?.error || 'Datei konnte nicht hochgeladen werden.';
  } finally {
    uploadingCount.value = Math.max(0, uploadingCount.value - files.length);
  }
}

async function moveItems(itemsToMove, targetFolderId) {
  if (!selectedSpaceId.value || movingItemIds.value.length) return;
  movingItemIds.value = itemsToMove.map((item) => item.id);
  error.value = '';
  try {
    for (const item of itemsToMove) {
      await api.post(`/api/graph/spaces/${selectedSpaceId.value}/items/${encodeURIComponent(item.id)}/move`, { targetFolderId });
    }
    clearSelection();
    await loadItems(currentFolderId.value);
  } catch (requestError) {
    error.value = requestError.response?.data?.error || 'Eintrag konnte nicht verschoben werden.';
  } finally {
    movingItemIds.value = [];
  }
}

async function downloadFile(item) {
  if (!selectedSpaceId.value || isDownloading(item.id)) return;
  downloading.value = { ...downloading.value, [item.id]: 0 };
  error.value = '';
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || ''}/api/graph/spaces/${selectedSpaceId.value}/download/${encodeURIComponent(item.id)}`,
      { credentials: 'include', headers: token ? { 'x-auth-token': token } : {} }
    );
    if (!response.ok || !response.body) {
      const responseError = await response.json().catch(() => null);
      throw new Error(responseError?.error || 'Die Datei konnte nicht heruntergeladen werden.');
    }

    const totalBytes = Number(response.headers.get('content-length')) || 0;
    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedBytes += value.byteLength;
      if (totalBytes) {
        downloading.value = {
          ...downloading.value,
          [item.id]: Math.min(100, Math.round((receivedBytes / totalBytes) * 100)),
        };
      }
    }

    const downloadUrl = URL.createObjectURL(new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = item.name || 'download';
    link.click();
    URL.revokeObjectURL(downloadUrl);
  } catch (requestError) {
    error.value = requestError.message || 'Die Datei konnte nicht heruntergeladen werden.';
  } finally {
    const { [item.id]: _, ...remainingDownloads } = downloading.value;
    downloading.value = remainingDownloads;
  }
}

async function downloadSelectedZip() {
  if (!selectedItems.value.length || !selectedSpaceId.value) return;
  error.value = '';
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/graph/spaces/${selectedSpaceId.value}/download-zip`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-auth-token': token } : {}),
      },
      body: JSON.stringify({ itemIds: selectedItems.value.map((item) => item.id) }),
    });
    if (!response.ok) {
      const responseError = await response.json().catch(() => null);
      throw new Error(responseError?.error || 'Die ZIP-Datei konnte nicht erstellt werden.');
    }
    const downloadUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${selectedSpace.value?.shortName || selectedSpace.value?.nameFull || 'Space'}-Auswahl.zip`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  } catch (requestError) {
    error.value = requestError.message || 'Die ZIP-Datei konnte nicht heruntergeladen werden.';
  }
}

async function deleteSelectedFiles() {
  const files = selectedItems.value;
  if (!selectedItemsAreFiles.value || !selectedSpaceId.value || deletingId.value) return;
  const message = files.length === 1
    ? `„${files[0].name}“ wird in den OneDrive-Papierkorb verschoben. Fortfahren?`
    : `${files.length} Dateien werden in den OneDrive-Papierkorb verschoben. Fortfahren?`;
  if (!window.confirm(message)) return;
  deletingId.value = 'bulk';
  error.value = '';
  try {
    for (const file of files) {
      await api.delete(`/api/graph/spaces/${selectedSpaceId.value}/items/${encodeURIComponent(file.id)}`);
    }
    clearSelection();
    await loadItems(currentFolderId.value);
  } catch (requestError) {
    error.value = requestError.response?.data?.error || 'Dateien konnten nicht gelöscht werden.';
  } finally {
    deletingId.value = '';
  }
}

function isDownloading(itemId) {
  return Object.hasOwn(downloading.value, itemId);
}

function downloadProgress(itemId) {
  return downloading.value[itemId] || 0;
}

async function renameFile(item) {
  if (!selectedSpaceId.value || renamingId.value) return;
  const name = window.prompt('Neuer Dateiname:', item.name)?.trim();
  if (!name || name === item.name) return;
  renamingId.value = item.id;
  error.value = '';
  try {
    await api.patch(`/api/graph/spaces/${selectedSpaceId.value}/items/${encodeURIComponent(item.id)}`, { name });
    await loadItems(path.value[path.value.length - 1]?.id);
  } catch (requestError) {
    error.value = requestError.response?.data?.error || 'Die Datei konnte nicht umbenannt werden.';
  } finally {
    renamingId.value = '';
  }
}

async function deleteFile(item) {
  if (!selectedSpaceId.value || deletingId.value) return;
  if (!window.confirm(`„${item.name}“ wird in den OneDrive-Papierkorb verschoben. Fortfahren?`)) return;
  deletingId.value = item.id;
  error.value = '';
  try {
    await api.delete(`/api/graph/spaces/${selectedSpaceId.value}/items/${encodeURIComponent(item.id)}`);
    await loadItems(path.value[path.value.length - 1]?.id);
  } catch (requestError) {
    error.value = requestError.response?.data?.error || 'Die Datei konnte nicht gelöscht werden.';
  } finally {
    deletingId.value = '';
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  loading.value = true;
  try {
    const { data } = await api.get('/api/graph/spaces');
    spaces.value = data.spaces || [];
    const savedNavigation = readPersistedNavigation();
    const savedSpace = spaces.value.find((space) => space._id === savedNavigation?.locationId);
    if (savedSpace) {
      selectedSpaceId.value = savedSpace._id;
      path.value = savedNavigation.path;
      const lastFolderId = path.value[path.value.length - 1]?.id;
      if (await loadItems(lastFolderId)) return;
      path.value = [];
      await loadItems();
      persistNavigation();
    } else if (spaces.value[0]) {
      await selectSpace(spaces.value[0]._id);
    }
  } catch (requestError) {
    error.value = requestError.response?.data?.error || 'Die Spaces konnten nicht geladen werden.';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped lang="scss">
.spaces { display: grid; gap: 16px; color: var(--text); }
.spaces__browser { position: relative; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--tile-bg); }
.spaces__browser--drop-target { box-shadow: inset 0 0 0 2px var(--primary); }
.spaces__notice { position: absolute; z-index: 2; top: 52px; right: 14px; max-width: min(360px, calc(100% - 28px)); padding: 8px 12px; border: 1px solid color-mix(in srgb, #c3423f 35%, var(--border)); border-radius: 5px; background: var(--tile-bg); box-shadow: 0 8px 18px rgba(0, 0, 0, .14); color: #a23330; font-size: .82rem; }
.spaces__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--hover) 60%, var(--tile-bg)); }
.spaces__breadcrumb { display: flex; align-items: center; min-width: 0; gap: 8px; overflow-x: auto; }
.spaces__breadcrumb button { border: 0; padding: 0; background: transparent; color: var(--primary); cursor: pointer; font: inherit; white-space: nowrap; }
.spaces__breadcrumb svg { color: var(--muted); font-size: .7rem; }
.spaces__loading { color: var(--muted); font-size: .8rem; }
.spaces__list { display: grid; }
.spaces__selection { display: flex; align-items: center; gap: 8px; color: var(--primary); font-size: .85rem; font-weight: 500; white-space: nowrap; }
.spaces__selection button { display: grid; width: 28px; height: 28px; place-items: center; border: 0; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.spaces__selection button:hover { background: color-mix(in srgb, var(--primary) 12%, transparent); }
.spaces__row { position: relative; display: grid; grid-template-columns: 20px minmax(0, 1fr) auto 32px; align-items: center; gap: 10px; min-height: 48px; padding: 9px 14px; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; font: inherit; text-align: left; text-decoration: none; overflow: hidden; }
.spaces__row:last-child { border-bottom: 0; }
.spaces__row:hover:not(.spaces__row--disabled) { background: var(--hover); }
.spaces__row--drop-target { background: color-mix(in srgb, var(--primary) 14%, var(--tile-bg)); box-shadow: inset 3px 0 0 var(--primary); }
.spaces__row--selected { background: color-mix(in srgb, var(--primary) 10%, var(--tile-bg)); }
.spaces__row--dragging { opacity: 0; }
.spaces__row--downloading::before { position: absolute; inset: 0 auto 0 0; width: var(--download-progress); background: color-mix(in srgb, var(--primary) 22%, transparent); content: ''; pointer-events: none; transition: width .15s ease-out; }
.spaces__row--moving { opacity: .55; }
.spaces__row--downloading > * { position: relative; }
.spaces__actions { display: inline-grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer; font: inherit; }
.spaces__actions:hover:not(:disabled) { background: var(--hover); color: var(--text); }
.spaces__actions:disabled { cursor: wait; opacity: .6; }
.spaces__row--folder { width: 100%; }
.spaces__row > svg:first-child { color: var(--primary); }
.spaces__row small { color: var(--muted); white-space: nowrap; }
.spaces__row-arrow { color: var(--muted); font-size: .75rem; }
.spaces__state { display: flex; min-height: 180px; align-items: center; justify-content: center; gap: 9px; padding: 24px; color: var(--muted); text-align: center; }
.spaces__state--inner { min-height: 220px; }
.spaces__state--error { color: #c3423f; }
:global(.spaces__drag-preview) { position: fixed; top: -1000px; left: -1000px; display: flex; align-items: center; gap: 8px; max-width: 320px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--tile-bg); box-shadow: 0 8px 22px rgba(0, 0, 0, .2); color: var(--text); font: 500 .85rem -apple-system, BlinkMacSystemFont, "San Francisco", Helvetica, Arial, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:global(.spaces__drag-preview svg) { width: 18px; height: 18px; flex: 0 0 auto; color: var(--primary); }
@media (max-width: 640px) { .spaces__head { align-items: flex-start; flex-direction: column; } .spaces__row { grid-template-columns: 20px minmax(0, 1fr) 18px; } .spaces__row small { grid-column: 2 / -1; white-space: normal; } }
</style>
