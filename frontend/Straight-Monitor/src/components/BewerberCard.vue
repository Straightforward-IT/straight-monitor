<template>
  <article class="bewerber-card" :class="{ 'is-expanded': expanded }">
    <div class="card-progress" :class="{ 'card-progress--expired': isExpired }" :style="{ '--seg-color': stageColor }" :title="statusLabel" role="progressbar" :aria-valuetext="statusLabel">
      <span v-for="(step, i) in progressSteps" :key="step.key" class="progress-seg" :class="{ done: !isExpired && i <= currentStepIndex, current: !isExpired && i === currentStepIndex }" :title="step.label"></span>
    </div>
    <header class="card-header" :aria-expanded="expanded" @click="toggleExpand">
      <div class="identity">
        <div class="avatar">{{ initials }}</div>
        <div>
          <h3>{{ bewerber.vorname }} {{ bewerber.nachname }}</h3>
          <p>{{ bewerber.email || 'Keine E-Mail hinterlegt' }}</p>
        </div>
      </div>
      <div class="header-actions" @click.stop>
        <button type="button" class="chevron" :class="{ open: expanded }" aria-label="Details" @click="toggleExpand">
          <font-awesome-icon icon="fa-solid fa-chevron-right" />
        </button>
        <button ref="actionButton" type="button" class="icon-button" aria-label="Aktionen" @click="openContextMenu">
          <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
        </button>
      </div>
    </header>

    <div class="card-meta">
      <span v-if="bewerber.telefon">{{ bewerber.telefon }}</span>
      <span>läuft ab {{ formatDate(bewerber.expiresAt) }}</span>
      <span v-if="bewerber.asana_id">Asana verknüpft</span>
    </div>

    <transition name="expand">
      <div v-show="expanded" class="card-body">
        <BewerberDetailCard
          v-if="hasLoaded"
          :bewerber-id="bewerber._id"
          embedded
          @saved="$emit('saved', $event)"
          @invite="$emit('invite', $event)"
          @close="expanded = false"
        />
      </div>
    </transition>

    <ContextMenu v-if="showContextMenu" :x="contextMenuX" :y="contextMenuY" :options="contextMenuOptions" @close="showContextMenu = false" @select="handleContextAction" />
  </article>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faEllipsisVertical, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import ContextMenu from './ContextMenu.vue';
import BewerberDetailCard from './BewerberDetailCard.vue';

library.add(faEllipsisVertical, faChevronRight);

export default {
  name: 'BewerberCard',
  components: { ContextMenu, FontAwesomeIcon, BewerberDetailCard },
  props: { bewerber: { type: Object, required: true } },
  emits: ['saved', 'invite'],
  data() {
    return { expanded: false, hasLoaded: false, showContextMenu: false, contextMenuX: 0, contextMenuY: 0 };
  },
  computed: {
    initials() {
      return `${this.bewerber.vorname?.[0] || ''}${this.bewerber.nachname?.[0] || ''}`.toUpperCase() || '?';
    },
    statusLabel() {
      return { neu: 'Neu', eingeladen: 'Eingeladen', formular_geoeffnet: 'Formular geöffnet', eingereicht: 'Eingereicht', abgelaufen: 'Abgelaufen' }[this.bewerber.status] || 'Neu';
    },
    progressSteps() {
      return [
        { key: 'neu', label: 'Neu' },
        { key: 'eingeladen', label: 'Eingeladen' },
        { key: 'eingereicht', label: 'Eingereicht' },
      ];
    },
    isExpired() {
      return this.bewerber.status === 'abgelaufen';
    },
    currentStepIndex() {
      // Form opened counts as "Eingeladen" stage.
      if (this.bewerber.status === 'formular_geoeffnet') return 1;
      const index = this.progressSteps.findIndex((step) => step.key === this.bewerber.status);
      return index === -1 ? 0 : index;
    },
    stageColor() {
      return ['#3b82f6', '#f59e0b', '#22c55e'][this.currentStepIndex] || '#3b82f6';
    },
    contextMenuOptions() {
      const options = [{ label: 'Details öffnen', action: 'open' }];
      if (this.bewerber.asana_permalink) options.unshift({ label: 'Asana-Aufgabe öffnen', action: 'asana' });
      options.push({ label: 'Einladung senden', action: 'invite' });
      return options;
    },
  },
  methods: {
    formatDate(value) {
      return value ? new Date(value).toLocaleDateString('de-DE') : '—';
    },
    toggleExpand() {
      this.expanded = !this.expanded;
      if (this.expanded) this.hasLoaded = true;
    },
    openContextMenu() {
      const rect = this.$refs.actionButton.getBoundingClientRect();
      this.contextMenuX = rect.right - 160;
      this.contextMenuY = rect.bottom + 4;
      this.showContextMenu = true;
    },
    handleContextAction(action) {
      if (action === 'asana') window.open(this.bewerber.asana_permalink, '_blank', 'noopener,noreferrer');
      if (action === 'open') { if (!this.expanded) this.toggleExpand(); }
      if (action === 'invite') this.$emit('invite', this.bewerber);
    },
  },
};
</script>

<style scoped lang="scss">
.bewerber-card { background: var(--tile-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; transition: border-color .15s, box-shadow .15s; }
.bewerber-card.is-expanded { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); box-shadow: 0 8px 28px rgba(0, 0, 0, .1); grid-column: 1 / -1; }
.card-header { align-items: center; cursor: pointer; display: flex; gap: 12px; justify-content: space-between; padding: 14px; }
.identity, .header-actions, .card-meta { align-items: center; display: flex; }
.identity { gap: 10px; min-width: 0; }
.avatar { align-items: center; background: var(--primary); border-radius: 6px; color: #fff; display: flex; flex: 0 0 38px; font-weight: 700; height: 38px; justify-content: center; }
h3, p { margin: 0; }
h3 { color: var(--text); font-size: .95rem; }
.identity p, .card-meta { color: var(--muted); font-size: .8rem; }
.header-actions { gap: 6px; }
.icon-button, .chevron { background: transparent; border: 0; color: var(--muted); cursor: pointer; height: 32px; width: 32px; }
.chevron { align-items: center; display: flex; justify-content: center; transition: transform .2s, color .2s; }
.chevron.open { color: var(--primary); transform: rotate(90deg); }
.card-progress { display: flex; gap: 2px; padding: 0; width: 100%; }
.card-progress .progress-seg { background: var(--border); flex: 1; height: 4px; transition: background .2s; }
.card-progress .progress-seg:first-child { border-top-left-radius: 8px; }
.card-progress .progress-seg:last-child { border-top-right-radius: 8px; }
.card-progress .progress-seg.done { background: var(--seg-color, var(--primary)); }
.card-progress .progress-seg.current { box-shadow: 0 0 8px color-mix(in srgb, var(--seg-color, var(--primary)) 45%, transparent); }
.card-progress--expired .progress-seg { background: color-mix(in srgb, var(--danger, #b91c1c) 60%, var(--border)) !important; }
.status { border: 1px solid var(--border); border-radius: 999px; color: var(--muted); font-size: .72rem; font-weight: 700; padding: 3px 7px; white-space: nowrap; }
.status--eingereicht { border-color: var(--success, #15803d); color: var(--success, #15803d); }
.status--eingeladen, .status--formular_geoeffnet { border-color: var(--primary); color: var(--primary); }
.status--abgelaufen { border-color: var(--danger, #b91c1c); color: var(--danger, #b91c1c); }
.card-meta { border-top: 1px solid var(--border); flex-wrap: wrap; gap: 8px 14px; padding: 9px 14px; }
.card-body { background: var(--hover); border-top: 1px solid var(--border); }

/* Expand animation (mirrors EmployeeCard) */
.expand-enter-from, .expand-leave-to { max-height: 0; opacity: 0; }
.expand-enter-active, .expand-leave-active { overflow: hidden; transition: max-height .3s ease, opacity .2s ease; }
.expand-enter-to, .expand-leave-from { max-height: 3000px; opacity: 1; }
@media (prefers-reduced-motion: reduce) { .expand-enter-active, .expand-leave-active { transition: none; } }
</style>