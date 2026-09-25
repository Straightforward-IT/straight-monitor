<template>
  <WorkflowCardFrame
    :active="isActive"
    :class="{ 'is-favorite': lead.isFavorite }"
    @open="$emit('open', lead)"
  >
    <template #header>
      <div class="lc-header">
        <FavoriteStarButton :active="lead.isFavorite" @toggle="$emit('toggle-favorite', lead)" />
        <h4 class="lc-title">{{ lead.title }}</h4>
        <button class="lc-menu-btn" title="Aktionen" @click.stop="$emit('row-menu', $event, lead)">
          <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
        </button>
      </div>
    </template>
    <template #meta>
      <div class="lc-meta">
        <span v-if="lead.standort" class="lc-chip lc-chip--standort">{{ lead.standort }}</span>
        <span v-if="lead.quelle" class="lc-chip lc-chip--quelle">{{ quelleLabel(lead.quelle) }}</span>
      </div>
    </template>
    <div v-if="customChips.length || (showCreated && lead.createdAt)" class="lc-custom">
      <div v-if="showCreated && lead.createdAt" class="lc-custom-row"><span class="lc-custom-key">Lead erstellt:</span><span class="lc-custom-val">{{ formatCreated(lead.createdAt) }}</span></div>
      <div v-for="chip in customChips" :key="chip.key" class="lc-custom-row"><span class="lc-custom-key">{{ chip.name }}:</span><span class="lc-custom-val" v-html="chip.html" /></div>
    </div>
    <template #footer>
      <span class="lc-owner" :title="lead.eigentuemer?.email || ''"><font-awesome-icon :icon="['fas', 'user']" class="lc-owner-icon" />{{ lead.eigentuemer?.name || lead.eigentuemer?.email || '—' }}</span>
    </template>
  </WorkflowCardFrame>
</template>

<script setup>
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import WorkflowCardFrame from '@/components/workflow/WorkflowCardFrame.vue';
import FavoriteStarButton from '@/components/ui-elements/FavoriteStarButton.vue';

const props = defineProps({ lead: { type: Object, required: true }, isActive: { type: Boolean, default: false }, customLabels: { type: Array, default: () => [] }, showCreated: { type: Boolean, default: false }, quelleOptions: { type: Array, default: () => [] } });
defineEmits(['open', 'toggle-favorite', 'row-menu']);
function quelleLabel(value) { return props.quelleOptions.find((option) => option.value === value)?.label || value; }
function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function normalizeUrlDisplay(url) { try { const parsed = new URL(url); const suffix = parsed.pathname && parsed.pathname !== '/' ? `/${parsed.pathname.split('/').filter(Boolean)[0] || ''}` : ''; return `${parsed.hostname}${suffix}`.slice(0, 40).replace(/(.{37}).+/, '$1…'); } catch { return String(url).slice(0, 40).replace(/(.{37}).+/, '$1…'); } }
function renderValue(label) {
  const value = props.lead.customFields?.[label.key];
  if (value === undefined || value === null || value === '') return '<span class="muted">—</span>';
  if (label.fieldType === 'checkbox') return value ? '✓' : '—';
  if (label.fieldType === 'currency') return Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  if (label.fieldType === 'date') return new Date(value).toLocaleDateString('de-DE');
  if (label.fieldType === 'dropdown') return escapeHtml(label.options?.find((option) => option.value === value)?.label || value);
  if (label.fieldType === 'multiselect' && Array.isArray(value)) return value.map((entry) => `<span class="cell-pill">${escapeHtml(label.options?.find((option) => option.value === entry)?.label || entry)}</span>`).join(' ');
  if (label.fieldType === 'address' && typeof value === 'object') return escapeHtml([value.street, [value.zip, value.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—');
  return escapeHtml(typeof value === 'string' && /^https?:\/\//i.test(value) ? normalizeUrlDisplay(value) : value);
}
const customChips = computed(() => props.customLabels.map((label) => ({ key: label.key, name: label.name, html: renderValue(label) })));
function formatCreated(value) { try { return value ? new Date(value).toLocaleDateString('de-DE') : '—'; } catch { return '—'; } }
</script>

<style scoped lang="scss">
:deep(.workflow-card.is-favorite) { background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 7%, transparent), var(--tile-bg)); }
.lc-header { align-items: flex-start; display: flex; gap: 6px; }
.lc-title { color: var(--text); flex: 1; font-size: 14px; font-weight: 600; line-height: 1.3; margin: 0; overflow-wrap: anywhere; }
.lc-menu-btn { background: none; border: 0; border-radius: 4px; color: var(--muted); cursor: pointer; font-size: 13px; padding: 2px 4px; }
.lc-menu-btn:hover { background: var(--hover); color: var(--text); }
.lc-meta { display: flex; flex-wrap: wrap; gap: 4px; }
.lc-chip { background: var(--hover); border-radius: 4px; color: var(--text); display: inline-block; font-size: 11px; padding: 2px 6px; }
.lc-chip--standort { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); font-weight: 500; }
.lc-custom { color: var(--muted); display: flex; flex-direction: column; font-size: 11px; gap: 2px; }
.lc-custom-key { font-weight: 500; margin-right: 4px; }.lc-custom-val { color: var(--text); }
:deep(.cell-pill) { background: var(--hover); border-radius: 3px; display: inline-block; font-size: 10px; margin-right: 2px; padding: 1px 5px; }:deep(.muted) { color: var(--muted); }
.lc-owner { color: var(--muted); font-size: 11px; }.lc-owner-icon { margin-right: 3px; opacity: .7; }
</style>
