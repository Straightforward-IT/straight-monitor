<template>
  <ModalFrame
    title="Tageseintrag anlegen"
    :subtitle="employeeName"
    size="md"
    @close="emit('close')"
  >
    <form
      :id="formId"
      class="time-entry-form"
      @submit.prevent="submit"
    >
      <div class="time-entry-form__grid">
        <label>Datum<input
          v-model="date"
          type="date"
          :min="`${month}-01`"
          :max="lastDate"
          required
        ></label>
        <label>Stunden<input
          v-model.number="hours"
          type="number"
          min="0"
          max="24"
          step="1"
          required
        ></label>
        <label>Minuten<input
          v-model.number="minutePart"
          type="number"
          min="0"
          max="59"
          step="1"
          required
        ></label>
      </div>
      <label>Eintragsart
        <select
          v-model="code"
          @change="credited = selectedType.credited"
        >
          <option
            v-for="type in DAY_ENTRY_TYPES"
            :key="type.code"
            :value="type.code"
          >{{ type.code }} · {{ type.label }}</option>
        </select>
      </label>
      <label class="time-entry-form__check"><input
        v-model="credited"
        type="checkbox"
      > Auf das Monatskontingent anrechnen</label>
      <label>Notiz <span>(optional)</span><input
        v-model="note"
        maxlength="160"
        placeholder="z. B. Korrektur nach Rücksprache"
      ></label>
      <p class="time-entry-form__hint">
        {{ code === 'FA' ? `Entnahme aus dem Zeitkonto · verfügbar: ${formatMinutes(bankMinutes)}.` : 'Die eingegebene Zeit wird als neue Zeit angelegt.' }}
        Mit 0 Stunden legst du ein leeres Ziel für den Eimer an.
      </p>
      <p class="time-entry-form__hint">
        Eintragsarten nach Vorlage. Die Anrechnung ist für diese Demo frei wählbar.
      </p>
      <p
        v-if="error"
        role="alert"
        class="time-entry-form__error"
      >
        {{ error }}
      </p>
    </form>
    <template #footer>
      <button
        class="time-form-button"
        type="button"
        @click="emit('close')"
      >
        Abbrechen
      </button>
      <button
        class="time-form-button time-form-button--primary"
        type="submit"
        :form="formId"
      >
        Eintrag anlegen
      </button>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import { DAY_ENTRY_TYPES, formatMinutes, monthDays } from '@/utils/timeManagement';
const props = defineProps({ month: { type: String, required: true }, initialDate: { type: String, required: true },
  employeeName: { type: String, default: '' }, bankMinutes: { type: Number, default: 0 } });
const emit = defineEmits(['close', 'create']);
const formId = `time-day-entry-${getCurrentInstance().uid}`;
const date = ref(props.initialDate);
const code = ref('U');
const hours = ref(0);
const minutePart = ref(0);
const credited = ref(true);
const note = ref('');
const error = ref('');
const selectedType = computed(() => DAY_ENTRY_TYPES.find(type => type.code === code.value));
const lastDate = computed(() => monthDays(props.month).at(-1).date);
function submit() {
  const amount = Number(hours.value) * 60 + Number(minutePart.value);
  if (!monthDays(props.month).some(day => day.date === date.value) || !Number.isInteger(amount)
    || !Number.isInteger(Number(hours.value)) || !Number.isInteger(Number(minutePart.value))
    || amount < 0 || amount > 1440 || Number(hours.value) < 0 || Number(minutePart.value) < 0 || Number(minutePart.value) > 59) {
    error.value = 'Bitte ein Datum im gewählten Monat und eine Zeit zwischen 0 und 24 Stunden eingeben.';
    return;
  }
  if (code.value === 'FA' && amount > props.bankMinutes) {
    error.value = 'Für diesen Freizeitausgleich reicht das Zeitkonto nicht aus.';
    return;
  }
  emit('create', { date: date.value, ...selectedType.value, minutes: amount, credited: credited.value, note: note.value.trim(), source: 'Manuell' });
}
</script>

<style scoped>
.time-entry-form { display: grid; gap: 20px; color: var(--text); }
.time-entry-form label { display: grid; gap: 8px; font-size: 13px; font-weight: 500; }
.time-entry-form label span { color: var(--muted); font-weight: 400; }
.time-entry-form input, .time-entry-form select { box-sizing: border-box; width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; }
.time-entry-form__grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; }
.time-entry-form .time-entry-form__check { display: flex; align-items: center; }
.time-entry-form__check input { width: 16px; height: 16px; accent-color: var(--primary); }
.time-entry-form__hint { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.time-entry-form__error { margin: 0; color: var(--danger, #c7544c); font-size: 13px; }
.time-form-button { padding: 9px 14px; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font: inherit; font-size: 13px; }
.time-form-button--primary { background: var(--primary); color: #292117; border-color: var(--primary); }
@media (max-width: 480px) { .time-entry-form__grid { grid-template-columns: 1fr 1fr; } .time-entry-form__grid label:first-child { grid-column: 1 / -1; } }
</style>
