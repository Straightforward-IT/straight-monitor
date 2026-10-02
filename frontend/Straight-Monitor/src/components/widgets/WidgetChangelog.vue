<template>
  <DashboardWidget>
    <template #title>
      <AppSegmentedControl
        v-model="activeTab"
        label="Änderungsstatus"
        size="sm"
        :options="[{ value: 'released', label: 'Veröffentlicht' }, { value: 'wip', label: 'In Entwicklung' }]"
      />
    </template>

    <div class="changelog">
      <div
        v-for="item in visibleItems"
        :key="item.text"
        class="changelog__item"
      >
        <font-awesome-icon :icon="item.icon" class="changelog__icon" />
        <span>{{ item.text }}</span>
      </div>

      <AppButton
        v-if="currentList.length > defaultCount"
        class="changelog__toggle"
        variant="secondary"
        size="sm"
        block
        :aria-expanded="showAll"
        @click="showAll = !showAll"
      >
        <font-awesome-icon :icon="['fas', showAll ? 'chevron-up' : 'chevron-down']" />
        {{ showAll ? "Weniger" : `${currentList.length - defaultCount} weitere` }}
      </AppButton>
    </div>
  </DashboardWidget>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import DashboardWidget from "./DashboardWidget.vue";
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppSegmentedControl from '@/components/ui-elements/AppSegmentedControl.vue';

const activeTab = ref("released");
const showAll = ref(false);
const defaultCount = 2;

// Reset show-all when switching tabs
watch(activeTab, () => { showAll.value = false; });

const released = [
  { icon: ["fas", "palette"],        text: "Design Overhaul: Kompaktere Toolboxen, kleineres Filterpanel und mehr Platz für den Wichtigen Inhalt" },
  { icon: ["fas", "chart-line"],     text: "Mitarbeiter Analytics - Diagramm für Mitarbeiter Einsätze jetzt in Mitarbeiter-Karte" },
  { icon: ["fas", "shirt"],          text: "Neues Kleiderpaket - Küche für Hamburg und Köln" },
  { icon: ["fas", "comment-dots"],   text: "Feedback bearbeiten & löschen — aus Dokumente und Mitarbeiterkarte" },
  { icon: ["fas", "list"],           text: "Neue Navigation — Unterpunkte & Reihenfolge" },
  { icon: ["fas", "table"],          text: "Dispo-Tabelle" },
  { icon: ["fas", "image-portrait"],       text: "Profilbilder - Die Bilder aus Flip jetzt auch in den Personalkarten des Monitors" },
  { icon: ["fas", "th-large"],       text: "Dashboard Widgets — anpassbare Übersicht" },
  { icon: ["fas", "dolly"],          text: "Bestand — Service- & Logi-Pakete je Mitarbeiter" },
  { icon: ["fas", "mobile-alt"],     text: 'Public Monitor — integriert in Flip unter "Jobs"' },
  { icon: ["fas", "moon"],           text: "Dark-Mode" },
  { icon: ["fas", "ticket-alt"],     text: "Support-Ticket-System" },
  { icon: ["fas", "file-invoice"],   text: "Lohnabrechnungen mit E-Mail-Versand" },
  { icon: ["fas", "envelope"],       text: "Automatische Bewerber-Tasks aus E-Mails" },
  { icon: ["fas", "calendar-days"],  text: "Aufträge — Kalender-Ansicht" },
  { icon: ["fas", "users"],          text: "Personal — Mitarbeiterverwaltung" },
  { icon: ["fas", "file-alt"],       text: "Dokumente — Event-Reports & Laufzettel" },
  { icon: ["fas", "table"],          text: "Teamleiter Auswertung — Live Tracking" },
  { icon: ["fas", "warehouse"],      text: "Bestand" },
  { icon: ["fas", "building"],       text: "Kunden" },
  { icon: ["fas", "chart-line"],     text: "Verlauf / Monitoring" },
];

const wip = [
  { icon: ["fas", "file-pdf"],       text: "PDF-Formular-Builder (Arbeitsverträge)" },
];

const currentList = computed(() => activeTab.value === "released" ? released : wip);

const visibleItems = computed(() =>
  showAll.value ? currentList.value : currentList.value.slice(0, defaultCount)
);
</script>

<style scoped lang="scss">
.changelog {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--text);
    line-height: 1.4;

    svg {
      width: 14px;
      color: var(--muted);
      flex-shrink: 0;
    }
  }

  &__toggle {
    --action-secondary-text: var(--muted);
    svg { font-size: 10px; }
  }
}
</style>
