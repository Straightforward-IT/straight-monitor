<template>
  <div class="layout">
    <HeaderBar :current-view-title="currentViewTitle" />
    <div class="page" :class="{ hasRight }">
      <main ref="contentEl" class="content"><router-view /></main>

      <aside v-if="hasRight" class="right" :class="{ open: ui.isOpen }" :style="panelStyle">
        <component :is="panelComponent" />
      </aside>
    </div>
    <AppFooter @open-support="handleOpenSupport" @open-shortcuts="handleOpenShortcuts" />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useUi } from '@/stores/ui';

import HeaderBar from '@/components/HeaderBar.vue';
import AppFooter from '@/components/AppFooter.vue';
import Shortcuts from '@/components/Shortcuts.vue';
import Tools from '@/components/Tools.vue';
import KommentarFeed from '@/components/KommentarFeed.vue';

const route = useRoute();
const ui = useUi();
const contentEl = ref(null);
const currentViewTitle = ref('');

const routeTitleFallbacks = {
  Dashboard: 'Dashboard',
  Bestand: 'Bestand',
  Verlauf: 'Verlauf',
  Auswertung: 'Auswertung Jobangebote',
  ExcelFormatierung: 'Excel Formatierung',
  Lohnabrechnungen: 'Lohnabrechnungen',
  Personal: 'Personal',
  Dokumente: 'Reports',
  BenutzerErstellen: 'Benutzer erstellen',
  Austritte: 'Flip Austritte',
  FlipUserFix: 'Quick Flip Fix',
  VerlosungTool: 'Verlosung',
  DatenImport: 'Daten Import',
  Auftraege: 'Aufträge',
  Kunden: 'Kunden',
  TeamleiterAuswertung: 'Teamleiter Auswertung',
  DokumenteNachpflegen: 'Dokumente nachpflegen',
  PdfVorlagen: 'PDF-Vorlagen',
  PdfVorgaenge: 'Vorgänge',
  PdfAusfuellen: 'PDF ausfüllen',
  Dispo: 'Dispo',
  BenutzerVerwaltung: 'Benutzerverwaltung',
  MailboxExplorer: 'Mailbox Explorer',
};

const pageTitleSelector = [
  '[data-page-title]',
  '.page-title',
  '.view-title',
  '.page-header h1',
  '.page-header h2',
  '.header-title-group h1',
  '.header-title-group h2',
  'h1',
].join(', ');

let managedTitleEl = null;
let titleObserver = null;
let titleSyncFrame = null;

const getFallbackTitle = () => {
  const routeName = String(route.name || '');
  return routeTitleFallbacks[routeName] || routeName.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
};

const clearManagedTitle = () => {
  if (managedTitleEl?.classList) {
    managedTitleEl.classList.remove('layout-managed-page-title');
  }
  managedTitleEl = null;
};

const syncPageTitle = () => {
  if (!contentEl.value) return;

  clearManagedTitle();

  const titleEl = contentEl.value.querySelector(pageTitleSelector);
  const explicitTitle = titleEl?.dataset?.pageTitle?.trim();
  const titleText = explicitTitle || titleEl?.textContent?.replace(/\s+/g, ' ').trim();

  currentViewTitle.value = titleText || getFallbackTitle();

  if (titleEl?.classList) {
    titleEl.classList.add('layout-managed-page-title');
    managedTitleEl = titleEl;
  }
};

const schedulePageTitleSync = () => {
  if (titleSyncFrame) {
    cancelAnimationFrame(titleSyncFrame);
  }

  titleSyncFrame = requestAnimationFrame(() => {
    titleSyncFrame = null;
    syncPageTitle();
  });
};

// Welches Panel wäre "default" für die aktuelle Route?
const defaultType = computed(() => {
  const name = String(route.name || '');
  // Nur noch Shortcuts auf Bestand-Seite automatisch anzeigen
  if (name === 'Bestand') return 'shortcuts';
  // Alle anderen Seiten: keine automatische Panel-Anzeige
  return null;
});

// Tatsächlich anzuzeigendes Panel
const panelComponent = computed(() => {
  if (ui.hidden) return null;                // vom User geschlossen

  if (ui.panelType) {                        // expliziter Override
    if (ui.panelType === 'shortcuts')    return Shortcuts;
    if (ui.panelType === 'tools')        return Tools;
    if (ui.panelType === 'kommentare')   return KommentarFeed;
  }

  // Route-Default
  const d = defaultType.value;
  if (d === 'shortcuts') return Shortcuts;
  if (d === 'tools')     return Tools;
  return null;
});

const hasRight = computed(() => !!panelComponent.value);

const panelStyle = computed(() => ({
  '--panel-width': ui.panelType === 'kommentare' ? '310px' : '260px',
}));

// Beim Routenwechsel nur den Override zurücksetzen – "hidden" respektieren
watch(() => route.fullPath, async () => {
  ui.panelType = null;
  await nextTick();
  schedulePageTitleSync();
});

// Handler für Footer Events
const handleOpenSupport = () => {
  // Support Modal öffnen - hier kannst du später einen Support-Modal einbauen
  console.log('Open Support Modal');
};

const handleOpenShortcuts = () => {
  ui.toggle('shortcuts');
};

onMounted(() => {
  schedulePageTitleSync();

  if (!contentEl.value) return;

  titleObserver = new MutationObserver(() => {
    schedulePageTitleSync();
  });

  titleObserver.observe(contentEl.value, {
    childList: true,
    subtree: true,
    characterData: true,
  });
});

onBeforeUnmount(() => {
  if (titleObserver) {
    titleObserver.disconnect();
    titleObserver = null;
  }

  if (titleSyncFrame) {
    cancelAnimationFrame(titleSyncFrame);
    titleSyncFrame = null;
  }

  clearManagedTitle();
});
</script>

<style scoped>
.layout{ min-height:100vh; display:flex; flex-direction:column; }
.page{ flex:1; display:grid; grid-template-columns:1fr; }
.page.hasRight{ grid-template-columns: 1fr auto; }
.content{ padding:16px; background: var(--bg); color: var(--text); min-width: 0; overflow: hidden; }
.content :deep(.layout-managed-page-title){ display:none !important; }

/* Sticky Drawer (Right Panel) */
.right{
  position: sticky;
  top: var(--header-h, 56px);
  align-self: start;
  width: var(--panel-width, 260px);
  height: calc(100vh - var(--header-h, 56px));
  overflow:auto;
  background: var(--panel);
  color: var(--text);
}

/* Mobile Optimierungen */
@media (max-width: 768px){
  .page.hasRight{ grid-template-columns:1fr; }
  
  .content {
    padding: 12px 8px;
  }
  
  .right{
    position: fixed;
    top: var(--header-h, 48px);
    right: 0; bottom: 0;
    width: 0; /* geschlossen */
    z-index: 60;
    box-shadow: -8px 0 20px rgba(0,0,0,.15);
  }
  .right.open{ width: min(320px, 90vw); }
}
</style>

