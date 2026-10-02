<template>
  <article class="kunde-card">
    <button
      class="kunde-card__open"
      type="button"
      :aria-label="`${kunde.kundName || 'Unbenannten Kunden'} öffnen`"
      @click="$emit('open', kunde)"
    />
    <div class="card-header">
      <h3>{{ kunde.kundName || 'Unbenannt' }}</h3>
      <div class="card-header-right">
        <span class="status-badge" :class="statusClass">{{ statusText }}</span>
        <div class="card-controls">
          <FavoriteStarButton
            v-if="showHighlight"
            :active="highlighted"
            active-title="Hervorhebung entfernen"
            inactive-title="Kunde hervorheben"
            @toggle="$emit('toggle-highlight', kunde)"
          />
          <AppIconButton
            size="sm"
            variant="ghost"
            :label="`Aktionen für ${kunde.kundName || 'Kunde'}`"
            @click="$emit('menu', kunde, $event)"
          >
            <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
          </AppIconButton>
        </div>
      </div>
    </div>
    <div class="card-body">
      <p><strong>Nr:</strong> {{ kunde.kundenNr }}<span v-if="kunde.kuerzel" class="kuerzel-inline"> · {{ kunde.kuerzel }}</span></p>
      <div v-if="kunde.contacts?.length" class="contact-preview">
        <font-awesome-icon :icon="['fas', 'user']" />
        {{ kunde.contacts[0].vorname }} {{ kunde.contacts[0].nachname }}
        <span v-if="kunde.contacts.length > 1" class="more-contacts">+{{ kunde.contacts.length - 1 }}</span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import FavoriteStarButton from '@/components/ui-elements/FavoriteStarButton.vue';

const props = defineProps({
  kunde: { type: Object, required: true },
  highlighted: { type: Boolean, default: false },
  showHighlight: { type: Boolean, default: false },
});
defineEmits(['open', 'menu', 'toggle-highlight']);

const statusText = computed(() => ({ 1: 'Potentiell', 2: 'Aktiv', 3: 'Inaktiv' })[props.kunde.kundStatus] || 'Unbekannt');
const statusClass = computed(() => ({ 1: 'status-lead', 2: 'status-active', 3: 'status-inactive' })[props.kunde.kundStatus] || '');
</script>

<style scoped lang="scss">
.kunde-card {
  position: relative;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
}

.kunde-card__open {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  border: 0;
  border-radius: inherit;
  background: transparent;
  cursor: pointer;

  &:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 2px; }
}

.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.card-header h3 { min-width: 0; margin: 0; color: var(--text); font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
.card-header-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.card-controls { position: relative; z-index: 2; display: flex; align-items: center; gap: 6px; }

.status-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
.status-active { background: color-mix(in srgb, var(--status-success-text) 15%, transparent); color: var(--status-success-text); }
.status-inactive { background: var(--hover); color: var(--text); }
.status-lead { background: color-mix(in srgb, var(--status-warning-text) 15%, transparent); color: var(--status-warning-text); }

.card-body p { margin: 4px 0; color: var(--muted); font-size: 13px; }
.card-body strong { color: var(--text); }
.kuerzel-inline { color: var(--action-accent-text); font-weight: 500; }
.contact-preview { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: var(--text); font-size: 13px; }
.contact-preview svg { color: var(--muted); }
.more-contacts { padding: 2px 6px; border-radius: 10px; background: var(--hover); color: var(--muted); font-size: 11px; }
</style>
