<template>
  <SidePanelFrame
    :model-value="modelValue"
    class="detail-sidebar"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template
      v-if="event"
      #header
    >
      <div class="sidebar-title-area">
        <span
          v-if="event.auftStatus !== 2"
          class="sidebar-status"
          :class="statusClass(event)"
        >{{ statusText(event.auftStatus) }}</span>
        <h2>{{ event.eventTitel || "Auftrag Details" }}</h2>
        <span class="sidebar-date">
          {{ formatRange(new Date(event.vonDatum), new Date(event.bisDatum)) }}
        </span>
      </div>
    </template>
    <template #actions>
      <div class="sidebar-header-actions">
        <button
          class="qa-dots-btn"
          type="button"
          title="Aktionen"
          @click.stop="$emit('actions', $event)"
        >
          <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
        </button>
      </div>
    </template>
    <slot />
  </SidePanelFrame>
</template>

<script setup>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import SidePanelFrame from "@/components/frames/SidePanelFrame.vue";

defineProps({
  modelValue: { type: Boolean, default: false },
  event: { type: Object, default: null },
  formatRange: { type: Function, required: true },
  statusClass: { type: Function, required: true },
  statusText: { type: Function, required: true },
});

defineEmits(["update:modelValue", "actions"]);
</script>

<style scoped lang="scss">
.sidebar-title-area { min-width: 0; }
.sidebar-title-area h2 { margin: 0; overflow: hidden; color: var(--text); font-size: 1.1rem; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-date { display: block; margin-top: 3px; color: var(--muted); font-size: .8rem; }
.sidebar-status { display: inline-block; margin-bottom: 6px; padding: 3px 8px; border-radius: 4px; font-size: .65rem; font-weight: 600; text-transform: uppercase; }
.sidebar-status.status-draft { background: #fef3c7; color: #92400e; }
.sidebar-status.status-confirmed { background: #d1fae5; color: #065f46; }
.sidebar-status.status-completed { background: #dbeafe; color: #1e40af; }
.sidebar-header-actions { display: flex; align-items: center; gap: 4px; }
.qa-dots-btn { display: flex; width: 32px; height: 32px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 6px; background: none; color: var(--muted); font-size: 1rem; cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
.qa-dots-btn:hover { border-color: var(--border); background: var(--hover); color: var(--text); }
</style>
