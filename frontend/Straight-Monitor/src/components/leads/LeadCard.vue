<template>
  <article
    class="lead-card"
    :class="{ active: isActive, 'is-favorite': lead.isFavorite }"
    @click="$emit('open', lead)"
  >
    <header class="lc-header">
      <button
        class="lc-fav"
        :class="{ active: lead.isFavorite }"
        :title="lead.isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren'"
        @click.stop="$emit('toggle-favorite', lead)"
      >
        <font-awesome-icon :icon="lead.isFavorite ? ['fas','star'] : ['far','star']" />
      </button>
      <h4 class="lc-title">{{ lead.title }}</h4>
      <button
        class="lc-menu-btn"
        title="Aktionen"
        @click.stop="$emit('row-menu', $event, lead)"
      >
        <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
      </button>
    </header>

    <div class="lc-meta">
      <span v-if="lead.standort" class="lc-chip lc-chip--standort">{{ lead.standort }}</span>
      <span v-if="lead.quelle" class="lc-chip lc-chip--quelle">{{ quelleLabel(lead.quelle) }}</span>
    </div>

    <!-- Custom field chips (only those marked visible in colConfig) -->
    <div v-if="customChips.length > 0 || (showCreated && lead.createdAt)" class="lc-custom">
      <div v-if="showCreated && lead.createdAt" class="lc-custom-row">
        <span class="lc-custom-key">Lead erstellt:</span>
        <span class="lc-custom-val">{{ formatCreated(lead.createdAt) }}</span>
      </div>
      <div v-for="chip in customChips" :key="chip.key" class="lc-custom-row">
        <span class="lc-custom-key">{{ chip.name }}:</span>
        <span class="lc-custom-val" v-html="chip.html" />
      </div>
    </div>

    <footer class="lc-footer">
      <span class="lc-owner" :title="lead.eigentuemer?.email || ''">
        <font-awesome-icon :icon="['fas', 'user']" class="lc-owner-icon" />
        {{ lead.eigentuemer?.name || lead.eigentuemer?.email || '—' }}
      </span>
    </footer>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const props = defineProps({
  lead: { type: Object, required: true },
  isActive: { type: Boolean, default: false },
  // Visible custom-field labels (filtered list of LeadLabel objects)
  customLabels: { type: Array, default: () => [] },
  showCreated: { type: Boolean, default: false },
  quelleOptions: { type: Array, default: () => [] },
});
defineEmits(['open', 'toggle-favorite', 'row-menu']);

function quelleLabel(q) {
  const opt = props.quelleOptions.find(o => o.value === q);
  return opt ? opt.label : q;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeUrlDisplay(url) {
  try {
    const u = new URL(url);
    let display = u.hostname;
    if (u.pathname && u.pathname !== '/') {
      const pathParts = u.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        display += '/' + pathParts.slice(0, 1).join('/');
      }
    }
    if (display.length > 40) {
      display = display.substring(0, 37) + '…';
    }
    return display;
  } catch (e) {
    if (url.length > 40) {
      return url.substring(0, 37) + '…';
    }
    return url;
  }
}

function renderValue(lbl) {
  const v = props.lead.customFields?.[lbl.key];
  if (v === undefined || v === null || v === '') return '<span class="muted">—</span>';
  if (lbl.fieldType === 'checkbox') return v ? '✓' : '—';
  if (lbl.fieldType === 'currency') {
    return Number(v).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  }
  if (lbl.fieldType === 'date') return new Date(v).toLocaleDateString('de-DE');
  if (lbl.fieldType === 'dropdown') {
    const opt = (lbl.options || []).find(o => o.value === v);
    return escapeHtml(opt ? opt.label : String(v));
  }
  if (lbl.fieldType === 'multiselect' && Array.isArray(v)) {
    return v
      .map(val => {
        const opt = (lbl.options || []).find(o => o.value === val);
        return `<span class="cell-pill">${escapeHtml(opt ? opt.label : val)}</span>`;
      })
      .join(' ');
  }
  if (lbl.fieldType === 'address' && typeof v === 'object') {
    return escapeHtml([v.street, [v.zip, v.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—');
  }
  // Shorten URLs for display
  if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
    return escapeHtml(normalizeUrlDisplay(v));
  }
  return escapeHtml(String(v));
}

const customChips = computed(() =>
  (props.customLabels || []).map(lbl => ({
    key: lbl.key,
    name: lbl.name,
    html: renderValue(lbl),
  })),
);

function formatCreated(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('de-DE'); } catch { return '—'; }
}
</script>

<style scoped lang="scss">
.lead-card {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: grab;
  transition: box-shadow 0.15s, border-color 0.15s, transform 0.05s;
  display: flex;
  flex-direction: column;
  gap: 8px;
  user-select: none;

  &:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
    border-color: color-mix(in srgb, var(--border) 55%, var(--text));
  }
  &.active {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent);
  }
  &.is-favorite {
    background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 7%, transparent), var(--tile-bg));
  }
  &:active { cursor: grabbing; }
}

.lc-header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.lc-title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text);
  word-break: break-word;
}
.lc-fav {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-size: 13px;
  padding: 0;
  line-height: 1;
  &:hover { color: #f59e0b; }
  &.active { color: #f59e0b; }
}
.lc-menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 4px;
  &:hover { background: var(--hover); color: var(--text); }
}

.lc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.lc-chip {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  border-radius: 4px;
  background: var(--hover);
  color: var(--text);
  &--standort {
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
    font-weight: 500;
  }
}

.lc-custom {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--muted);
}
.lc-custom-key { font-weight: 500; margin-right: 4px; }
.lc-custom-val { color: var(--text); }
:deep(.cell-pill) {
  display: inline-block;
  padding: 1px 5px;
  margin-right: 2px;
  font-size: 10px;
  border-radius: 3px;
  background: var(--hover);
}
:deep(.muted) { color: var(--muted); }

.lc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  padding-top: 6px;
}
.lc-owner-icon { margin-right: 3px; opacity: 0.7; }
</style>
