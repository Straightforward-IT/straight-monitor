<template>
  <DashboardWidget
    title="Profilbild-Quote"
    :icon="['fas', 'camera']"
    :loading="loading"
  >
    <template #actions>
      <button class="wpb-refresh" :class="{ spinning: refreshing }" @click="refresh" :disabled="refreshing" title="Aktualisieren">
        <font-awesome-icon :icon="['fas', 'rotate-right']" />
      </button>
    </template>
    <div class="wpb-body">
      <!-- Overall hero -->
      <div class="wpb-hero">
        <span class="wpb-percent" :style="{ color: totalQuoteColor }">{{ totalQuote }}%</span>
        <span class="wpb-label">gesamt mit Profilbild</span>
      </div>

      <!-- Per-Standort rows -->
      <ul class="wpb-locations">
        <li v-for="s in standorte" :key="s.label" class="wpb-loc-row">
          <span class="wpb-loc-name">{{ s.label }}</span>
          <div class="wpb-loc-bar-wrap">
            <div class="wpb-loc-bar" :style="{ width: s.quote + '%', background: quoteColor(s.quote) }" />
          </div>
          <span class="wpb-loc-stat">
            <span :style="{ color: quoteColor(s.quote) }">{{ s.quote }}%</span>
            <span class="wpb-loc-frac">{{ s.with }}/{{ s.total }}</span>
          </span>
        </li>
      </ul>

      <!-- Overall fraction -->
      <div class="wpb-fraction">
        <span class="wpb-count">{{ totalWith }}</span>
        <span class="wpb-sep">&thinsp;/&thinsp;</span>
        <span class="wpb-total">{{ totalAll }} aktive Nutzer</span>
        <span v-if="unknown > 0" class="wpb-unknown">({{ unknown }} ohne Standort)</span>
      </div>
    </div>
  </DashboardWidget>
</template>

<script setup>
import { computed, ref } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useFlipAll } from "@/stores/flipAll";
import DashboardWidget from "./DashboardWidget.vue";

const LOCATIONS = [
  { label: "Hamburg", keys: ["hamburg"] },
  { label: "Berlin",  keys: ["berlin"]  },
  { label: "Köln",    keys: ["köln", "koeln", "cologne"] },
];

const flip = useFlipAll();

const loading = computed(() => flip.loading && !flip.loaded);

const activeUsers = computed(() =>
  flip.allFlipUsers.filter((u) => u.status === "ACTIVE")
);

const getLocation = (u) => {
  const raw =
    u.profile?.location ??
    u.attributes?.find((a) => /standort|location/i.test(a.name ?? ""))?.value ??
    null;
  return raw ? String(raw).trim() : null;
};

const locKey = (loc) => (loc ?? "").toLowerCase().replace(/ö/g, "o");

const standorte = computed(() =>
  LOCATIONS.map((def) => {
    const users = activeUsers.value.filter((u) => {
      const k = locKey(getLocation(u));
      return def.keys.some((dk) => k.startsWith(locKey(dk)));
    });
    const withPic = users.filter((u) => u.profilbild).length;
    const total   = users.length;
    const quote   = total > 0 ? Math.round((withPic / total) * 100) : 0;
    return { label: def.label, with: withPic, total, quote };
  })
);

const totalAll  = computed(() => activeUsers.value.length);
const totalWith = computed(() => activeUsers.value.filter((u) => u.profilbild).length);
const unknown   = computed(() => {
  const assigned = standorte.value.reduce((s, loc) => s + loc.total, 0);
  return totalAll.value - assigned;
});

const totalQuote = computed(() =>
  totalAll.value > 0 ? Math.round((totalWith.value / totalAll.value) * 100) : 0
);

const quoteColor = (q) => {
  if (q >= 75) return "#02b504";   // grün
  if (q >= 50) return "#ffd647";   // gelb
  if (q >= 25) return "#ff8c00";   // orange
  return "#fb2a2a";                 // rot
};

const totalQuoteColor = computed(() => quoteColor(totalQuote.value));

const refreshing = ref(false);
const refresh = async () => {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    await flip.fetchAll(true);
  } finally {
    refreshing.value = false;
  }
};
</script>

<style scoped lang="scss">
:deep(.dash-widget__icon) {
  color: var(--muted);
}

.wpb-body {
  padding: 12px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow: hidden;
}

/* ── Hero ───────────────────────────────────────────────── */
.wpb-hero {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.wpb-percent {
  font-size: 38px;
  font-weight: 700;
  line-height: 1;
  transition: color 0.3s;
}

.wpb-label {
  font-size: 12px;
  color: var(--muted);
}

/* ── Per-Standort rows ──────────────────────────────────── */
.wpb-locations {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex: 1;
  min-height: 0;
}

.wpb-loc-row {
  display: grid;
  grid-template-columns: 60px 1fr auto;
  align-items: center;
  gap: 8px;
}

.wpb-loc-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.wpb-loc-bar-wrap {
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}

.wpb-loc-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease, background 0.3s;
}

.wpb-loc-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  min-width: 48px;

  span:first-child {
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    transition: color 0.3s;
  }
}

.wpb-loc-frac {
  font-size: 10px;
  color: var(--muted);
  line-height: 1;
}

/* ── Overall fraction ───────────────────────────────────── */
.wpb-fraction {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}

.wpb-count {
  font-weight: 600;
  color: var(--text);
}

.wpb-unknown {
  font-size: 10px;
  color: var(--muted);
  margin-left: 4px;
}

/* ── Refresh Button ─────────────────────────────────────── */
.wpb-refresh {
  background: none;
  border: none;
  padding: 4px 6px;
  cursor: pointer;
  color: var(--muted);
  font-size: 13px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;

  &:hover:not(:disabled) {
    color: var(--text);
    background: var(--hover);
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }

  &.spinning svg {
    animation: wpb-spin 0.7s linear infinite;
  }
}

@keyframes wpb-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
