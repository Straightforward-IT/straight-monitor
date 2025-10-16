<template>
  <div class="layout">
    <HeaderBar />
    <div class="page" :class="{ hasRight }">
      <main class="content"><router-view /></main>

      <aside v-if="hasRight" class="right" :class="{ open: ui.isOpen }">
        <component :is="panelComponent" />
      </aside>
    </div>
    <AppFooter @open-support="handleOpenSupport" @open-shortcuts="handleOpenShortcuts" />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { computed, watch } from 'vue';
import { useUi } from '@/stores/ui';

import HeaderBar from '@/components/HeaderBar.vue';
import AppFooter from '@/components/AppFooter.vue';
import Shortcuts from '@/components/Shortcuts.vue';
import Tools from '@/components/Tools.vue';

const route = useRoute();
const ui = useUi();

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
    if (ui.panelType === 'shortcuts') return Shortcuts;
    if (ui.panelType === 'tools')     return Tools;
  }

  // Route-Default
  const d = defaultType.value;
  if (d === 'shortcuts') return Shortcuts;
  if (d === 'tools')     return Tools;
  return null;
});

const hasRight = computed(() => !!panelComponent.value);

// Beim Routenwechsel nur den Override zurücksetzen – "hidden" respektieren
watch(() => route.fullPath, () => { ui.panelType = null; });

// Handler für Footer Events
const handleOpenSupport = () => {
  // Support Modal öffnen - hier kannst du später einen Support-Modal einbauen
  console.log('Open Support Modal');
};

const handleOpenShortcuts = () => {
  ui.toggle('shortcuts');
};
</script>

<style scoped>
.layout{ min-height:100vh; display:flex; flex-direction:column; }
.page{ flex:1; display:grid; grid-template-columns:1fr; }
.page.hasRight{ grid-template-columns: 1fr auto; }
.content{ padding:16px; background: var(--bg); color: var(--text); }

/* Sticky Drawer (Right Panel) */
.right{
  position: sticky;
  top: var(--header-h, 56px);
  align-self: start;
  width: 260px;
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

