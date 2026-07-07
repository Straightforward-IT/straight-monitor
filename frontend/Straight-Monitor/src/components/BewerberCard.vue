<template>
  <article class="bewerber-card" :class="{ 'bewerber-card--inactive': !ma.isActive }">
    <!-- Header -->
    <header class="card-header" role="button" tabindex="0" @click="toggle" @keydown.enter.prevent="toggle" @keydown.space.prevent="toggle">
      <div class="left">
        <div class="avatar" :style="{ '--hue': avatarHue }">{{ initials }}</div>
        <div class="title">
          <div class="name">{{ ma.vorname }} {{ ma.nachname }}</div>
          <div class="meta">
            <span class="pill info" v-if="ma.personalnr">
              <font-awesome-icon icon="fa-solid fa-id-badge" />
              {{ ma.personalnr }}
            </span>
            <span class="pill ok" v-if="ma.isActive">
              <font-awesome-icon icon="fa-solid fa-circle-check" />
              Aktiv
            </span>
            <span class="pill muted" v-else>
              <font-awesome-icon icon="fa-regular fa-circle" />
              Inaktiv
            </span>
            <span class="pill warn">
              <font-awesome-icon icon="fa-solid fa-user" />
              Bewerber
            </span>
            <span class="pill info" v-if="displayLocation">
              <font-awesome-icon icon="fa-solid fa-location-dot" />
              {{ displayLocation }}
            </span>
          </div>
        </div>
      </div>
      <font-awesome-icon
        icon="fa-solid fa-chevron-right"
        class="chevron"
        :class="{ 'chevron--open': expanded }"
      />
    </header>

    <!-- Expanded Body -->
    <transition name="expand">
      <div v-if="expanded" class="card-body">
        <div class="detail-row" v-if="ma.email">
          <span class="detail-label">E-Mail</span>
          <a :href="`mailto:${ma.email}`" class="detail-value link">{{ ma.email }}</a>
        </div>
        <div class="detail-row" v-if="ma.telefon">
          <span class="detail-label">Telefon</span>
          <span class="detail-value">{{ ma.telefon }}</span>
        </div>
        <div class="detail-row" v-if="ma.geburtsdatum">
          <span class="detail-label">Geburtsdatum</span>
          <span class="detail-value">{{ formatDate(ma.geburtsdatum) }}</span>
        </div>
        <div class="detail-row" v-if="ma.eintrittsdatum">
          <span class="detail-label">Eintrittsdatum</span>
          <span class="detail-value">{{ formatDate(ma.eintrittsdatum) }}</span>
        </div>
        <div class="detail-row" v-if="ma.asana_id">
          <span class="detail-label">Asana</span>
          <span class="detail-value pill info">
            <font-awesome-icon icon="fa-solid fa-check" />
            Verknüpft
          </span>
        </div>
        <div class="detail-row" v-if="ma.berufe && ma.berufe.length">
          <span class="detail-label">Berufe</span>
          <div class="pill-list">
            <span v-for="b in ma.berufe" :key="b._id" class="pill muted">{{ b.designation || b }}</span>
          </div>
        </div>
        <div class="detail-row" v-if="ma.dispoNotiz">
          <span class="detail-label">Notiz</span>
          <span class="detail-value notiz">{{ ma.dispoNotiz }}</span>
        </div>
      </div>
    </transition>
  </article>
</template>

<script setup>
import { ref, computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faIdBadge, faCircleCheck, faCircle, faUser, faLocationDot,
  faChevronRight, faCheck
} from '@fortawesome/free-solid-svg-icons';
import { faCircle as faCircleRegular } from '@fortawesome/free-regular-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

library.add(faIdBadge, faCircleCheck, faCircle, faUser, faLocationDot, faChevronRight, faCheck, faCircleRegular);

const props = defineProps({
  ma: { type: Object, required: true },
});

const expanded = ref(false);

function toggle() {
  expanded.value = !expanded.value;
}

const initials = computed(() => {
  const a = (props.ma?.vorname || '').trim()[0] || '';
  const b = (props.ma?.nachname || '').trim()[0] || '';
  return (a + b).toUpperCase() || '•';
});

const avatarHue = computed(() => {
  const seed = (props.ma?._id || props.ma?.email || '')
    .split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return seed % 360;
});

const displayLocation = computed(() => {
  if (props.ma?.flip?.profile?.location) return props.ma.flip.profile.location;
  if (props.ma?.standort) return props.ma.standort;
  const pnr = String(props.ma?.personalnr || '').trim();
  if (pnr.startsWith('1')) return 'Berlin';
  if (pnr.startsWith('2')) return 'Hamburg';
  if (pnr.startsWith('3')) return 'Köln';
  return null;
});

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<style scoped lang="scss">
.bewerber-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  }

  &--inactive {
    opacity: 0.7;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  gap: 12px;
  user-select: none;

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }
}

.left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: hsl(var(--hue, 200), 55%, 52%);
  color: white;
  font-weight: 700;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.title {
  min-width: 0;
}

.name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.chevron {
  color: var(--muted);
  font-size: 12px;
  flex-shrink: 0;
  transition: transform 0.2s;

  &--open {
    transform: rotate(90deg);
    color: var(--primary);
  }
}

.card-body {
  border-top: 1px solid var(--border);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--hover);
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
}

.detail-label {
  color: var(--muted);
  font-weight: 500;
  min-width: 110px;
  flex-shrink: 0;
}

.detail-value {
  color: var(--text);

  &.link {
    color: var(--primary);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }

  &.notiz {
    font-style: italic;
    color: var(--muted);
  }
}

.pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Pill styles (match EmployeeCard convention) */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;

  &.ok {
    background: color-mix(in srgb, #21a26a 15%, transparent);
    color: color-mix(in srgb, #21a26a 80%, var(--text));
  }

  &.warn {
    background: color-mix(in srgb, #f6a019 15%, transparent);
    color: color-mix(in srgb, #f6a019 80%, var(--text));
  }

  &.info {
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: color-mix(in srgb, var(--primary) 75%, var(--text));
  }

  &.muted {
    background: color-mix(in srgb, var(--text) 8%, transparent);
    color: var(--muted);
  }
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
