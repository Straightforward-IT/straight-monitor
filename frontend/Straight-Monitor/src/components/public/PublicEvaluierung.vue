<template>
  <div class="evaluierung-view">

    <!-- Back Button -->
    <button class="back-btn" @click="$emit('back')">
      <font-awesome-icon icon="fa-solid fa-arrow-left" /> Zurück
    </button>

    <h2 class="view-title">Evaluierung schreiben</h2>

    <!-- Success -->
    <div v-if="submitSuccess" class="success-state">
      <div class="success-icon">
        <font-awesome-icon icon="fa-solid fa-check" />
      </div>
      <h3>Evaluierung eingereicht!</h3>
      <p>Die Evaluierung wurde erfolgreich gespeichert.</p>
      <button class="btn-secondary" @click="$emit('back')">Zurück zur Übersicht</button>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="submitEvaluierung" class="eval-form">

      <!-- Prefill Info -->
      <div class="prefill-info">
        <div class="prefill-row">
          <span class="prefill-label">Mitarbeiter</span>
          <span class="prefill-value">{{ laufzettel?.name_mitarbeiter }}</span>
        </div>
        <div class="prefill-row">
          <span class="prefill-label">Teamleiter</span>
          <span class="prefill-value">{{ laufzettel?.name_teamleiter }}</span>
        </div>
        <div class="prefill-row" v-if="laufzettel?.location">
          <span class="prefill-label">Location</span>
          <span class="prefill-value">{{ laufzettel.location }}</span>
        </div>
        <div class="prefill-row" v-if="laufzettel?.datum">
          <span class="prefill-label">Datum</span>
          <span class="prefill-value">{{ formatDate(laufzettel.datum) }}</span>
        </div>
      </div>

      <!-- Kunde -->
      <div class="form-group">
        <label>Kunde *</label>
        <input v-model="form.kunde" type="text" required placeholder="Kundenname" />
      </div>

      <!-- Ratings -->
      <div class="rating-section">
        <h3 class="rating-title">Bewertung</h3>

        <div class="form-group">
          <label>Pünktlichkeit</label>
          <div class="rating-chips">
            <button v-for="r in ratings" :key="r" type="button"
              :class="['chip', { active: form.puenktlichkeit === r }]"
              @click="form.puenktlichkeit = r">{{ r }}</button>
          </div>
        </div>

        <div class="form-group">
          <label>Grooming / Erscheinungsbild</label>
          <div class="rating-chips">
            <button v-for="r in ratings" :key="r" type="button"
              :class="['chip', { active: form.grooming === r }]"
              @click="form.grooming = r">{{ r }}</button>
          </div>
        </div>

        <div class="form-group">
          <label>Motivation</label>
          <div class="rating-chips">
            <button v-for="r in ratings" :key="r" type="button"
              :class="['chip', { active: form.motivation === r }]"
              @click="form.motivation = r">{{ r }}</button>
          </div>
        </div>

        <div class="form-group">
          <label>Technische Fertigkeiten</label>
          <div class="rating-chips">
            <button v-for="r in ratings" :key="r" type="button"
              :class="['chip', { active: form.technische_fertigkeiten === r }]"
              @click="form.technische_fertigkeiten = r">{{ r }}</button>
          </div>
        </div>

        <div class="form-group">
          <label>Lernbereitschaft</label>
          <div class="rating-chips">
            <button v-for="r in ratings" :key="r" type="button"
              :class="['chip', { active: form.lernbereitschaft === r }]"
              @click="form.lernbereitschaft = r">{{ r }}</button>
          </div>
        </div>
      </div>

      <!-- Sonstiges -->
      <div class="form-group">
        <label>Sonstiges / Kommentar</label>
        <textarea v-model="form.sonstiges" rows="3" placeholder="Optionaler Kommentar…"></textarea>
      </div>

      <button type="submit" class="submit-btn" :disabled="!form.kunde || submitting">
        <span v-if="submitting">
          <font-awesome-icon icon="fa-solid fa-spinner" spin /> Wird gesendet…
        </span>
        <span v-else>
          <font-awesome-icon icon="fa-solid fa-paper-plane" /> Evaluierung absenden
        </span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';

const props = defineProps({
  laufzettel: { type: Object, required: true },
  api:        { type: Object, required: true },
  email:      { type: String, default: '' },
});

const emit = defineEmits(['back', 'evaluierung-submitted']);

const ratings = ['1', '2', '3', '4', '5'];
const submitSuccess = ref(false);
const submitting = ref(false);

const form = reactive({
  kunde: '',
  puenktlichkeit: '',
  grooming: '',
  motivation: '',
  technische_fertigkeiten: '',
  lernbereitschaft: '',
  sonstiges: '',
});

async function submitEvaluierung() {
  if (!form.kunde) return;
  submitting.value = true;
  try {
    await props.api.post('/api/public/evaluierung', {
      email: props.email,
      laufzettel_id: props.laufzettel._id,
      kunde: form.kunde,
      datum: props.laufzettel.datum || new Date().toISOString(),
      puenktlichkeit: form.puenktlichkeit,
      grooming: form.grooming,
      motivation: form.motivation,
      technische_fertigkeiten: form.technische_fertigkeiten,
      lernbereitschaft: form.lernbereitschaft,
      sonstiges: form.sonstiges,
    });
    submitSuccess.value = true;
    emit('evaluierung-submitted');
  } catch (err) {
    console.error('Evaluierung submit error:', err);
    alert('Fehler beim Einreichen: ' + (err.response?.data?.msg || err.message));
  } finally {
    submitting.value = false;
  }
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<style scoped>
.evaluierung-view {
  padding: 0 0 2rem;
}

.back-btn {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  -webkit-tap-highlight-color: transparent;
}

.view-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 1.25rem;
}

/* Success */
.success-state {
  text-align: center;
  padding: 3rem 1rem;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #28a745;
  color: white;
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.success-state h3 {
  font-size: 1.2rem;
  margin: 0 0 0.5rem;
  color: var(--text);
}

.success-state p {
  color: var(--muted);
  margin: 0 0 1.5rem;
}

.btn-secondary {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.65rem 1.5rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* Form */
.eval-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.prefill-info {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.prefill-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.prefill-label {
  color: var(--muted);
  min-width: 80px;
  font-weight: 600;
}

.prefill-value {
  color: var(--text);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 0.9rem;
  font-family: inherit;
  background: var(--tile-bg);
  color: var(--text);
  transition: border-color 0.2s;
  box-sizing: border-box;
  -webkit-appearance: none;
  appearance: none;
  resize: vertical;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
}

/* Rating */
.rating-section {
  margin-bottom: 0.5rem;
}

.rating-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border);
}

.rating-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s;
}

.chip:active {
  transform: scale(0.95);
}

.chip.active {
  border-color: var(--primary);
  background: rgba(255, 117, 24, 0.1);
  color: var(--primary);
  font-weight: 600;
}

/* Submit */
.submit-btn {
  width: auto;
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0.5rem auto 0;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.2s;
}

.submit-btn:active:not(:disabled) {
  transform: scale(0.98);
  filter: brightness(1.1);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
