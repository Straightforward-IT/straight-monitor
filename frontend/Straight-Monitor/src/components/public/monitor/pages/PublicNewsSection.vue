<template>
  <section class="news-section" aria-labelledby="news-heading">
    <div class="section-heading">
      <h3 id="news-heading">Neuigkeiten</h3>
      <span v-if="items.length" class="news-count">{{ items.length }}</span>
    </div>

    <div v-if="loading" class="news-state">
      <font-awesome-icon icon="fa-solid fa-spinner" spin /> Neuigkeiten werden geladen
    </div>
    <p v-else-if="error" class="news-state news-state--error">{{ error }}</p>
    <div v-else-if="!items.length" class="news-state">
      <font-awesome-icon icon="fa-solid fa-circle-check" /> Keine neuen Neuigkeiten
    </div>
    <template v-else>
      <article v-for="item in items" :key="item.id" class="news-card">
        <div class="news-card__header">
          <span class="news-card__type">Du wurdest eingeplant für den folgenden Job</span>
          <span class="news-card__progress">{{ item.confirmation.currentStep.position }}/{{ item.confirmation.totalSteps }}</span>
        </div>
        <p class="news-card__intro"></p>
        <h4 class="news-card__title">{{ item.einsatz.title }}</h4>
        <p>{{ formatDate(item.einsatz.dateFrom) }} · {{ formatTime(item.einsatz) }}</p>
        <p class="news-card__location"><font-awesome-icon icon="fa-solid fa-location-dot" /> {{ item.einsatz.location }}</p>
        <p class="news-card__statement">{{ item.confirmation.currentStep.text }}</p>
        <button
          class="primary-button wide"
          type="button"
          :disabled="confirmingId === item.id"
          @click="$emit('confirm', item)"
        >
          <font-awesome-icon v-if="confirmingId === item.id" icon="fa-solid fa-spinner" spin />
          {{ confirmingId === item.id ? 'Wird bestätigt …' : 'Bestätigen' }}
        </button>
      </article>
    </template>
  </section>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  confirmingId: { type: String, default: '' },
});

defineEmits(['confirm']);

function formatDate(value) {
  if (!value) return 'Datum offen';
  return new Date(value).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\.$/, '');
}

function formatTime(einsatz) {
  const from = String(einsatz.timeFrom || '').slice(0, 5);
  const to = String(einsatz.timeTo || '').slice(0, 5);
  return from ? `${from}${to ? ` – ${to}` : ''}` : 'Uhrzeit offen';
}
</script>

<style scoped>
.news-section { margin:0 0 1.4rem; }
.section-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:.5rem; }
.section-heading h3 { margin:0; font-size:.95rem; }
.news-count { display:grid; min-width:24px; height:24px; padding:0 5px; place-items:center; border-radius:50%; background:var(--primary); color:#fff; font-size:.7rem; font-weight:800; }
.news-state { display:flex; align-items:center; justify-content:center; gap:.45rem; min-height:64px; padding:.75rem 1rem; border:1px solid var(--border); background:var(--panel); color:var(--muted); font-size:.78rem; text-align:center; }
.news-state svg { color:var(--dev-green, #157f5b); }
.news-state--error { color:var(--dev-red, #b84235); }
.news-card { display:grid; gap:.4rem; padding:1.1rem; border:2px solid var(--primary); border-radius:4px; background:linear-gradient(135deg, color-mix(in srgb, var(--primary) 9%, var(--panel)), var(--panel) 48%); box-shadow:0 10px 26px rgba(31,28,25,.14); }
.news-card__header { display:flex; align-items:center; justify-content:space-between; gap:.75rem; color:var(--muted); font-size:.68rem; font-weight:800; text-transform:uppercase; }
.news-card__type { color:var(--primary); }
.news-card__progress { min-width:2.3rem; padding:.2rem .42rem; border-radius:999px; background:var(--text); color:var(--panel); text-align:center; }
.news-card__intro { margin:.25rem 0 0 !important; color:var(--text) !important; font-size:.78rem !important; font-weight:750; }
.news-card h4 { margin:0; color:var(--text); font-size:1.15rem; font-weight:850; }
.news-card p { margin:0; color:var(--muted); font-size:.76rem; }
.news-card h4 + p, .news-card__location, .news-card__title, .news-card__statement { text-align:center; }
.news-card__location svg { margin-right:.2rem; }
.news-card__statement { margin:.65rem 0 .75rem !important; color:var(--text) !important; font-size:.96rem !important; font-weight:800; line-height:1.5; }
.news-card .primary-button { border-color:var(--text); background:var(--text); color:var(--panel); }
.news-card .primary-button:hover:not(:disabled) { background:var(--primary); border-color:var(--primary); color:var(--text); }
.primary-button:disabled { cursor:wait; opacity:.65; }
</style>
