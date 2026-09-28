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
          <span class="news-card__type">Einsatz bestätigen</span>
          <span class="news-card__progress">{{ item.confirmation.currentStep.position }}/{{ item.confirmation.totalSteps }}</span>
        </div>
        <h4>{{ item.einsatz.title }}</h4>
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
.news-card { display:grid; gap:.35rem; padding:1rem; border-left:4px solid var(--primary); background:var(--panel); box-shadow:0 8px 24px rgba(0,0,0,.07); }
.news-card__header { display:flex; align-items:center; justify-content:space-between; gap:.75rem; color:var(--muted); font-size:.68rem; font-weight:800; text-transform:uppercase; }
.news-card__type { color:var(--primary); }
.news-card h4 { margin:.1rem 0; font-size:1rem; }
.news-card p { margin:0; color:var(--muted); font-size:.76rem; }
.news-card__location svg { margin-right:.2rem; }
.news-card__statement { margin:.45rem 0 .6rem !important; color:var(--text) !important; line-height:1.45; }
.primary-button:disabled { cursor:wait; opacity:.65; }
</style>
