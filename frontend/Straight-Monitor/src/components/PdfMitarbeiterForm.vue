<template>
  <div class="form-shell">
    <!-- Loading -->
    <div v-if="loading" class="center-state">
      <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
      <p>Formular wird geladen…</p>
    </div>

    <!-- Error -->
    <div v-else-if="errorMsg" class="center-state error-state">
      <font-awesome-icon :icon="['fas', 'circle-exclamation']" size="2x" />
      <p>{{ errorMsg }}</p>
    </div>

    <!-- Already submitted -->
    <div v-else-if="data?.status === 'bereit'" class="center-state success-state">
      <font-awesome-icon :icon="['fas', 'circle-check']" size="3x" />
      <h2>Bereits übermittelt</h2>
      <p>Dieses Formular wurde bereits ausgefüllt. Vielen Dank!</p>
    </div>

    <!-- Form -->
    <div v-else-if="data" class="form-card">
      <!-- Header -->
      <div class="form-card-header" v-if="!submitted">
        <div class="form-logo">
          <font-awesome-icon :icon="['fas', 'file-pen']" />
        </div>
        <div>
          <h1>{{ data.vorgangName }}</h1>
          <p v-if="data.templateName" class="sub">{{ data.templateName }}</p>
        </div>
      </div>

      <!-- Submitted success -->
      <div v-if="submitted" class="center-state success-state">
        <font-awesome-icon :icon="['fas', 'circle-check']" size="3x" />
        <h2>Vielen Dank!</h2>
        <p>Deine Angaben wurden erfolgreich übermittelt.</p>
      </div>

      <!-- Form fields -->
      <div v-else>
        <p class="form-intro">Bitte fülle die folgenden Felder aus und klicke auf <strong>Absenden</strong>.</p>
        <div class="fields-list">
          <div v-for="bm in data.bookmarks" :key="bm.id" class="field-row">
            <label :for="`f-${bm.id}`" class="field-label">
              {{ bm.label }}
              <span v-if="bm.dataType" class="field-type-badge">
                {{ dataTypeLabel(bm.dataType) }}
              </span>
            </label>
            <div v-if="bm.dataType === 'checkbox'" class="checkbox-row">
              <input :id="`f-${bm.id}`" v-model="values[bm.id]" type="checkbox" class="form-checkbox" />
              <span class="checkbox-label">{{ values[bm.id] ? 'Ja' : 'Nein' }}</span>
            </div>
            <input
              v-else-if="bm.dataType === 'date'"
              :id="`f-${bm.id}`"
              v-model="values[bm.id]"
              type="date"
              class="form-input"
            />
            <input
              v-else
              :id="`f-${bm.id}`"
              v-model="values[bm.id]"
              type="text"
              class="form-input"
              :placeholder="bm.defaultValue || bm.label"
            />
          </div>
        </div>

        <div v-if="data.bookmarks.length === 0" class="no-fields">
          Keine Felder zum Ausfüllen.
        </div>

        <button
          class="btn-submit"
          :disabled="submitting"
          @click="submit"
        >
          <font-awesome-icon v-if="submitting" :icon="['fas', 'spinner']" spin />
          <font-awesome-icon v-else :icon="['fas', 'paper-plane']" />
          Absenden
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route  = useRoute();
const token  = route.params.token;

const loading   = ref(false);
const submitting = ref(false);
const submitted  = ref(false);
const errorMsg   = ref('');
const data       = ref(null);
const values     = ref({});

function dataTypeLabel(t) {
  const map = { text: 'Text', date: 'Datum', checkbox: 'Ja/Nein' };
  return map[t] || t;
}

async function fetchForm() {
  loading.value = true;
  try {
    const res = await axios.get(`/api/pdf-vorgaenge/formular/${token}`);
    data.value = res.data;
    // Pre-fill values from backend (existing mitarbeiterValues or defaults)
    for (const bm of res.data.bookmarks) {
      const existing = res.data.values?.[bm.id];
      if (bm.dataType === 'checkbox') {
        values.value[bm.id] = existing === 'true' || existing === true;
      } else {
        values.value[bm.id] = existing ?? (bm.defaultValue || '');
      }
    }
  } catch (e) {
    errorMsg.value = e.response?.data?.message || 'Dieses Formular konnte nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    // Serialize checkbox as string 'true'/'false', date as de-DE
    const serialized = {};
    for (const bm of data.value.bookmarks) {
      const raw = values.value[bm.id];
      if (bm.dataType === 'checkbox') {
        serialized[bm.id] = raw ? 'true' : 'false';
      } else if (bm.dataType === 'date' && raw) {
        const d = new Date(raw);
        serialized[bm.id] = isNaN(d) ? raw : d.toLocaleDateString('de-DE');
      } else {
        serialized[bm.id] = raw || '';
      }
    }
    await axios.post(`/api/pdf-vorgaenge/formular/${token}/submit`, { values: serialized });
    submitted.value = true;
  } catch (e) {
    alert('Fehler beim Absenden: ' + (e.response?.data?.message || e.message));
  } finally {
    submitting.value = false;
  }
}

onMounted(fetchForm);
</script>

<style scoped lang="scss">
* { box-sizing: border-box; }

.form-shell {
  min-height: 100vh; display: flex; align-items: flex-start; justify-content: center;
  background: #f4f5f7; padding: 40px 16px;
}

.center-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; text-align: center; padding: 60px 20px; color: #6b7280;
  &.error-state   { color: #dc2626; }
  &.success-state { color: #16a34a; h2 { color: #15803d; margin: 0; font-size: 1.3rem; } p { margin: 0; font-size: 14px; } }
}

.form-card {
  background: #fff; border-radius: 14px; box-shadow: 0 2px 16px rgba(0,0,0,.10);
  padding: 36px; width: 100%; max-width: 560px;
}

.form-card-header {
  display: flex; align-items: flex-start; gap: 16px; margin-bottom: 26px;
  h1 { font-size: 1.25rem; margin: 0; color: #111827; line-height: 1.3; }
  .sub { font-size: 13px; color: #6b7280; margin: 4px 0 0; }
}
.form-logo {
  width: 44px; height: 44px; border-radius: 10px; background: #fff7ed;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-size: 20px; color: #f97316;
}

.form-intro {
  font-size: 14px; color: #6b7280; margin: 0 0 22px;
}

.fields-list { display: flex; flex-direction: column; gap: 16px; }
.field-row { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 13px; font-weight: 600; color: #374151;
  display: flex; align-items: center; gap: 8px;
}
.field-type-badge {
  font-size: 10px; font-weight: 400; padding: 2px 6px; border-radius: 4px;
  background: #f3f4f6; color: #9ca3af; letter-spacing: .03em;
}
.form-input {
  border: 1px solid #d1d5db; border-radius: 8px; padding: 9px 12px;
  font-size: 14px; color: #111827; font-family: inherit; width: 100%;
  &:focus { outline: none; border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,.12); }
}
.checkbox-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px;
}
.form-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: #f97316; }
.checkbox-label { font-size: 14px; color: #374151; }
.no-fields { font-size: 14px; color: #9ca3af; padding: 16px 0; text-align: center; }

.btn-submit {
  width: 100%; margin-top: 28px; padding: 13px;
  background: #f97316; color: #fff; border: none; border-radius: 8px;
  font-size: 15px; font-weight: 600; cursor: pointer; display: flex;
  align-items: center; justify-content: center; gap: 8px; font-family: inherit;
  transition: background 150ms;
  &:hover { background: #ea6c0a; }
  &:disabled { opacity: .6; cursor: not-allowed; }
}
</style>
