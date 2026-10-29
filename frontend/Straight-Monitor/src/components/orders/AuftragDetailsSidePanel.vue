<template>
  <SidePanelFrame
    :model-value="modelValue"
    class="detail-sidebar"
    :class="{ 'auftrag-details-modal': presentation === 'modal' }"
    :title="event?.eventTitel || (auftragNr ? `Auftrag #${auftragNr}` : 'Auftrag Details')"
    :presentation="presentation"
    :modal-minimizable="minimizable"
    :minimize-id="minimizeId"
    :has-modal-side="showModalSide && Boolean($slots['modal-side'])"
    modal-size="lg"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template
      v-if="event"
      #header="{ titleId }"
    >
      <div class="sidebar-title-area">
        <span
          v-if="event.auftStatus !== 2"
          class="sidebar-status"
          :class="statusClass(event)"
        >{{ statusText(event.auftStatus) }}</span>
        <h2 :id="titleId">
          {{ event.eventTitel || "Auftrag Details" }}
        </h2>
        <span class="sidebar-date">
          {{ formatRange(new Date(event.vonDatum), new Date(event.bisDatum)) }}
        </span>
      </div>
    </template>
    <template #actions>
      <div class="sidebar-header-actions">
        <AppIconButton
          v-if="event"
          variant="ghost"
          size="sm"
          label="Auftrag aktualisieren"
          title="Auftrag aktualisieren"
          :disabled="reloading"
          @click.stop="$emit('refresh')"
        >
          <font-awesome-icon :icon="faRotateRight" :spin="reloading" />
        </AppIconButton>
        <AppIconButton
          v-if="event && presentation === 'panel'"
          variant="ghost"
          size="sm"
          label="Auftrag in Fenster öffnen"
          title="Abdocken"
          @click.stop="$emit('undock')"
        >
          <font-awesome-icon :icon="faUpRightFromSquare" />
        </AppIconButton>
        <AppIconButton
          variant="ghost"
          size="sm"
          :label="`Aktionen für Auftrag ${event?.auftragNr || ''}`.trim()"
          :disabled="!event"
          @click.stop="$emit('actions', $event)"
        >
          <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
        </AppIconButton>
        <AppIconButton
          v-if="showStaffingExpand && event && presentation === 'modal'"
          variant="ghost"
          size="sm"
          label="Personal & Bewerbungen einblenden"
          @click.stop="$emit('expand-staffing')"
        >
          <font-awesome-icon :icon="faAnglesLeft" />
        </AppIconButton>
      </div>
    </template>
    <slot />
    <template
      v-if="showModalSide && $slots['modal-side']"
      #modal-side
    >
      <slot name="modal-side" />
    </template>
    <template v-if="calendarTarget" #modal-footer>
      <RouterLink :to="calendarTarget" class="auftrag-calendar-link" @click="closeForCalendarNavigation">
        <FontAwesomeIcon :icon="faCalendarDays" />
        Im Auftragskalender öffnen
      </RouterLink>
    </template>
  </SidePanelFrame>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faAnglesLeft, faCalendarDays, faRotateRight, faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import SidePanelFrame from "@/components/frames/SidePanelFrame.vue";
import AppIconButton from "@/components/ui-elements/AppIconButton.vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  event: { type: Object, default: null },
  auftragNr: { type: [String, Number], default: null },
  presentation: { type: String, default: 'panel' },
  minimizable: { type: Boolean, default: false },
  minimizeId: { type: String, default: '' },
  reloading: { type: Boolean, default: false },
  showStaffingExpand: { type: Boolean, default: false },
  showModalSide: { type: Boolean, default: false },
  formatRange: { type: Function, required: true },
  statusClass: { type: Function, required: true },
  statusText: { type: Function, required: true },
});

const emit = defineEmits(["update:modelValue", "actions", "undock", "expand-staffing", "refresh"]);
const calendarTarget = computed(() => {
  const number = props.event?.auftragNr || props.auftragNr;
  if (props.presentation !== 'modal' || !number) return null;
  const date = props.event?.vonDatum ? new Date(props.event.vonDatum) : null;
  const location = props.event?.locationV2;
  const locationId = typeof location === 'object' ? location?._id : location;
  return { path: '/auftraege', query: {
    tab: 'calendar', auftragnr: String(number),
    ...(date && !Number.isNaN(date.getTime()) ? { focusDate: date.toISOString().slice(0, 10) } : {}),
    ...(locationId ? { locationV2: String(locationId) } : {}),
  } };
});
function closeForCalendarNavigation(event) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  emit('update:modelValue', false);
}
</script>

<style scoped lang="scss">
.sidebar-title-area { min-width: 0; }
.sidebar-title-area h2 { margin: 0; overflow: hidden; color: var(--text); font-size: 1.1rem; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-date { display: block; margin-top: 3px; color: var(--muted); font-size: .8rem; }
.sidebar-status { display: inline-block; margin-bottom: 6px; padding: 3px 8px; border-radius: 4px; font-size: .65rem; font-weight: 600; text-transform: uppercase; }
.sidebar-status.status-draft { background: color-mix(in srgb, var(--status-warning) 12%, var(--tile-bg)); color: var(--status-warning-text); }
.sidebar-status.status-confirmed { background: color-mix(in srgb, var(--status-success-text) 12%, var(--tile-bg)); color: var(--status-success-text); }
.sidebar-status.status-completed { background: #dbeafe; color: #1e40af; }
.sidebar-header-actions { display: flex; align-items: center; gap: 4px; }
.auftrag-details-modal { --surface: var(--panel); --soft: var(--hover); --brand: var(--primary); }
.auftrag-calendar-link { display: inline-flex; align-items: center; gap: 8px; color: var(--primary); font-size: .875rem; font-weight: 600; text-underline-offset: 3px; }
.auftrag-calendar-link:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 3px; }
</style>
