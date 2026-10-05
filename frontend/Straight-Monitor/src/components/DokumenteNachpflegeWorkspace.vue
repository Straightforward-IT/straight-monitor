<template>
  <div class="documents-maintenance-workspace">
    <div class="content-grid">
      <!-- ── LAUFZETTEL FORM ─────────────────────────────── -->
      <div class="card form-card" v-if="activeTab === 'laufzettel'">
        <h2 class="card-title">
          <img :src="iconLaufzettel" class="card-icon" />
          Neuer Laufzettel
        </h2>

        <div v-if="success.laufzettel" class="success-banner" role="status">
          <div class="success-icon"><font-awesome-icon icon="fa-solid fa-circle-check" /></div>
          <div>
            <strong>Laufzettel erstellt!</strong>
            <p>Angelegt und dem Teamleiter in Flip zugewiesen.</p>
          </div>
          <AppButton size="sm" variant="outlined" @click="resetForm('laufzettel')">Weiteren erstellen</AppButton>
        </div>

        <form v-else @submit.prevent="submitLaufzettel" class="form-body">
          <fieldset class="form-fields" :disabled="loading.laufzettel">
          <div class="field-group">
            <label class="field-label" for="lz-auftrag-nr">
              Auftragsnummer *
              <span class="field-hint">Einsatzdaten werden automatisch geladen</span>
            </label>
            <div class="auftrag-input-wrap">
              <AppTextInput id="lz-auftrag-nr" v-model="lz.auftragNr" type="number" class="input-narrow" placeholder="z.B. 12345" min="1" required />
              <font-awesome-icon v-if="auftragLoading.laufzettel" icon="fa-solid fa-spinner" spin class="auftrag-spinner" />
            </div>
          </div>

          <template v-if="auftragData.laufzettel">
          <div class="einsatz-panel">
            <div class="einsatz-panel-header">
              <div class="einsatz-panel-icon"><font-awesome-icon icon="fa-solid fa-briefcase" /></div>
              <div>
                <span class="einsatz-panel-title">{{ auftragDisplayTitle('laufzettel') }}</span>
                <span class="einsatz-panel-meta">{{ auftragDisplayMeta('laufzettel') }}</span>
              </div>
            </div>
            <div v-if="lzEinsatzMAs.length" class="einsatz-ma-section">
              <span class="einsatz-ma-label"><font-awesome-icon icon="fa-solid fa-users" /> Mitarbeiter im Einsatz <span class="count-badge">{{ lzEinsatzMAs.length }}</span></span>
              <div class="einsatz-ma-grid">
                <AppButton v-for="ma in lzEinsatzMAs" :key="ma._id" type="button" size="sm" variant="secondary"
                  class="einsatz-ma-btn" :class="{ selected: lz.ma?._id === ma._id }" :aria-pressed="lz.ma?._id === ma._id"
                  @click="lz.ma = ma">
                  <font-awesome-icon icon="fa-solid fa-user" />
                  {{ ma.vorname }} {{ ma.nachname }}
                  <span v-if="ma.personalnr" class="einsatz-ma-nr">{{ ma.personalnr }}</span>
                </AppButton>
              </div>
            </div>
          </div>

          <PersonSearch label="Mitarbeiter *" hint="Vorname, Nachname oder Personalnr." v-model="lz.ma" />
          <PersonSearch label="Teamleitung *" hint="Vorname, Nachname oder Personalnr." v-model="lz.tl" />

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="lz-datum">Datum *</label>
              <AppTextInput id="lz-datum" v-model="lz.datum" type="date" :max="todayStr" required />
            </div>
            <div class="field-group">
              <label class="field-label" for="lz-location">Niederlassung *</label>
              <AppSelect id="lz-location" v-model="lz.locationV2" required>
                <option disabled value="">Standort wählen</option>
                <option v-for="location in locations" :key="location._id" :value="location._id">{{ location.nameFull }}</option>
              </AppSelect>
            </div>
          </div>

          <ValidationError :msg="errors.laufzettel" />
          <div class="form-actions">
            <AppButton type="submit" :loading="loading.laufzettel" :disabled="!lzValid">
              <font-awesome-icon v-if="!loading.laufzettel" icon="fa-solid fa-paper-plane" />
              {{ loading.laufzettel ? 'Wird erstellt…' : 'Laufzettel erstellen' }}
            </AppButton>
          </div>
          </template>
          </fieldset>
        </form>
      </div>

      <!-- ── EVALUIERUNG FORM ───────────────────────────── -->
      <div class="card form-card" v-if="activeTab === 'evaluierung'">
        <h2 class="card-title">
          <img :src="iconEvaluierung" class="card-icon" />
          Neue Evaluierung
        </h2>
        <p class="card-desc">Erstellt einen abgeschlossenen Laufzettel mit Bewertungsfeldern.</p>

        <div v-if="success.evaluierung" class="success-banner" role="status">
          <div class="success-icon"><font-awesome-icon icon="fa-solid fa-circle-check" /></div>
          <div>
            <strong>Evaluierung erstellt!</strong>
            <p>Der Laufzettel wurde mit Status „Bewertet" angelegt.</p>
          </div>
          <AppButton size="sm" variant="outlined" @click="resetForm('evaluierung')">Weiteren erstellen</AppButton>
        </div>

        <form v-else @submit.prevent="submitEvaluierung" class="form-body">
          <fieldset class="form-fields" :disabled="loading.evaluierung">
          <div class="field-group">
            <label class="field-label" for="ev-auftrag-nr">
              Auftragsnummer *
              <span class="field-hint">Einsatzdaten werden automatisch geladen</span>
            </label>
            <div class="auftrag-input-wrap">
              <AppTextInput id="ev-auftrag-nr" v-model="ev.auftragNr" type="number" class="input-narrow" placeholder="z.B. 12345" min="1" required />
              <font-awesome-icon v-if="auftragLoading.evaluierung" icon="fa-solid fa-spinner" spin class="auftrag-spinner" />
            </div>
          </div>

          <template v-if="auftragData.evaluierung">
          <div class="einsatz-panel">
            <div class="einsatz-panel-header">
              <div class="einsatz-panel-icon"><font-awesome-icon icon="fa-solid fa-briefcase" /></div>
              <div>
                <span class="einsatz-panel-title">{{ auftragDisplayTitle('evaluierung') }}</span>
                <span class="einsatz-panel-meta">{{ auftragDisplayMeta('evaluierung') }}</span>
              </div>
            </div>
            <div v-if="evEinsatzMAs.length" class="einsatz-ma-section">
              <span class="einsatz-ma-label"><font-awesome-icon icon="fa-solid fa-users" /> Mitarbeiter im Einsatz <span class="count-badge">{{ evEinsatzMAs.length }}</span></span>
              <div class="einsatz-ma-grid">
                <AppButton v-for="ma in evEinsatzMAs" :key="ma._id" type="button" size="sm" variant="secondary"
                  class="einsatz-ma-btn" :class="{ selected: ev.ma?._id === ma._id }" :aria-pressed="ev.ma?._id === ma._id"
                  @click="ev.ma = ma">
                  <font-awesome-icon icon="fa-solid fa-user" />
                  {{ ma.vorname }} {{ ma.nachname }}
                  <span v-if="ma.personalnr" class="einsatz-ma-nr">{{ ma.personalnr }}</span>
                </AppButton>
              </div>
            </div>
          </div>

          <PersonSearch label="Mitarbeiter *" hint="Person die bewertet wird" v-model="ev.ma" />
          <PersonSearch label="Teamleitung *" hint="Person die bewertet" v-model="ev.tl" />

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="ev-datum">Datum *</label>
              <AppTextInput id="ev-datum" v-model="ev.datum" type="date" :max="todayStr" required />
            </div>
            <div class="field-group">
              <label class="field-label" for="ev-location">Niederlassung *</label>
              <AppSelect id="ev-location" v-model="ev.locationV2" required>
                <option disabled value="">Standort wählen</option>
                <option v-for="location in locations" :key="location._id" :value="location._id">{{ location.nameFull }}</option>
              </AppSelect>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="ev-kunde">Kunde / Event <span class="field-hint">Optional – wird aus Auftrag übernommen</span></label>
            <AppTextInput id="ev-kunde" v-model="ev.kunde" placeholder="z.B. Messe Berlin" />
          </div>

          <div class="rating-grid">
            <RatingField label="Pünktlichkeit" v-model="ev.puenktlichkeit" />
            <RatingField label="Erscheinungsbild" v-model="ev.grooming" />
            <RatingField label="Motivation" v-model="ev.motivation" />
            <RatingField label="Technische Fertigkeiten" v-model="ev.technische_fertigkeiten" />
            <RatingField label="Lernbereitschaft" v-model="ev.lernbereitschaft" />
            <RatingField label="Sonstiges" v-model="ev.sonstiges" :wide="true" />
          </div>

          <ValidationError :msg="errors.evaluierung" />
          <div class="form-actions">
            <AppButton type="submit" :loading="loading.evaluierung" :disabled="!evValid">
              <font-awesome-icon v-if="!loading.evaluierung" icon="fa-solid fa-paper-plane" />
              {{ loading.evaluierung ? 'Wird erstellt…' : 'Evaluierung erstellen' }}
            </AppButton>
          </div>
          </template>
          </fieldset>
        </form>
      </div>

      <!-- ── EVENT REPORT FORM ──────────────────────────── -->
      <div class="card form-card" v-if="activeTab === 'eventreport'">
        <h2 class="card-title">
          <img :src="iconEventreport" class="card-icon" />
          Neuer Event Report
        </h2>

        <div v-if="success.eventreport" class="success-banner" role="status">
          <div class="success-icon"><font-awesome-icon icon="fa-solid fa-circle-check" /></div>
          <div>
            <strong>Event Report erstellt!</strong>
            <p>Der Report wurde angelegt und dem Teamleiter zugeordnet.</p>
          </div>
          <AppButton size="sm" variant="outlined" @click="resetForm('eventreport')">Weiteren erstellen</AppButton>
        </div>

        <form v-else @submit.prevent="submitEventReport" class="form-body">
          <fieldset class="form-fields" :disabled="loading.eventreport">
          <div class="field-group">
            <label class="field-label" for="er-auftrag-nr">
              Auftragsnummer *
              <span class="field-hint">Einsatzdaten werden automatisch geladen</span>
            </label>
            <div class="auftrag-input-wrap">
              <AppTextInput id="er-auftrag-nr" v-model="er.auftragNr" type="number" class="input-narrow" placeholder="z.B. 12345" min="1" required />
              <font-awesome-icon v-if="auftragLoading.eventreport" icon="fa-solid fa-spinner" spin class="auftrag-spinner" />
            </div>
          </div>

          <template v-if="auftragData.eventreport">
          <div class="einsatz-panel">
            <div class="einsatz-panel-header">
              <div class="einsatz-panel-icon"><font-awesome-icon icon="fa-solid fa-briefcase" /></div>
              <div>
                <span class="einsatz-panel-title">{{ auftragDisplayTitle('eventreport') }}</span>
                <span class="einsatz-panel-meta">{{ auftragDisplayMeta('eventreport') }}</span>
              </div>
            </div>
            <div v-if="erEinsatzMAs.length" class="einsatz-ma-section">
              <span class="einsatz-ma-label"><font-awesome-icon icon="fa-solid fa-users" /> {{ erEinsatzMAs.length }} Mitarbeiter im Einsatz</span>
            </div>
          </div>

          <PersonSearch label="Teamleitung *" hint="Vorname, Nachname oder Personalnr." v-model="er.tl" />

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="er-datum">Datum *</label>
              <AppTextInput id="er-datum" v-model="er.datum" type="date" :max="todayStr" required />
            </div>
            <div class="field-group">
              <label class="field-label" for="er-location">Niederlassung *</label>
              <AppSelect id="er-location" v-model="er.locationV2" required>
                <option disabled value="">Standort wählen</option>
                <option v-for="location in locations" :key="location._id" :value="location._id">{{ location.nameFull }}</option>
              </AppSelect>
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="er-kunde">Kunde / Event *</label>
              <AppTextInput id="er-kunde" v-model="er.kunde" placeholder="z.B. Messe Berlin" required />
            </div>
            <div class="field-group">
              <label class="field-label" for="er-anzahl">Mitarbeiter Anzahl <span class="field-hint">Optional – wird aus Einsatz übernommen</span></label>
              <AppTextInput id="er-anzahl" v-model="er.mitarbeiter_anzahl" placeholder="z.B. 12" />
            </div>
          </div>

          <div class="rating-grid">
            <RatingField label="Pünktlichkeit" v-model="er.puenktlichkeit" />
            <RatingField label="Erscheinungsbild" v-model="er.erscheinungsbild" />
            <RatingField label="Team" v-model="er.team" />

            <!-- ── Mitarbeiter / Job – per-MA rows ── -->
            <div class="field-group field-group--wide">
              <span class="field-label">Mitarbeiter / Job</span>

              <!-- Chip row: available MAs not yet added -->
              <div v-if="erMaAvailable.length" class="er-ma-chips">
                <AppButton
                  v-for="ma in erMaAvailable"
                  :key="ma._id"
                  type="button"
                  size="sm"
                  variant="outlined"
                  class="er-ma-chip"
                  @click="addErMaRow(ma)"
                >
                  <font-awesome-icon icon="fa-solid fa-plus" />
                  {{ ma.vorname }} {{ ma.nachname }}
                </AppButton>
              </div>

              <!-- Per-MA feedback rows -->
              <div class="er-ma-rows">
                <div v-for="row in erMaRows" :key="row._id" class="er-ma-row-field">
                  <span class="er-ma-row-legend">{{ row.name }}</span>
                  <textarea
                    v-model="row.text"
                    class="er-ma-row-input"
                    rows="2"
                    :aria-label="`Feedback zu ${row.name}`"
                    :placeholder="'Feedback zu ' + row.name + '\u2026'"
                  />
                  <AppIconButton type="button" size="sm" variant="ghost" class="er-ma-row-remove" :label="`${row.name} entfernen`" @click="removeErMaRow(row)">
                    <font-awesome-icon icon="fa-solid fa-times" />
                  </AppIconButton>
                </div>

                <!-- Fallback free-text when no Einsatz MAs available -->
                <textarea
                  v-if="!erEinsatzMAs.length"
                  v-model="er.mitarbeiter_job"
                  class="input-field textarea-field"
                  rows="2"
                  aria-label="Mitarbeiter und Job"
                  placeholder="Mitarbeiter / Job\u2026"
                />
              </div>
            </div>

            <RatingField label="Feedback Auftraggeber" v-model="er.feedback_auftraggeber" :wide="true" />
            <RatingField label="Sonstiges" v-model="er.sonstiges" :wide="true" />
          </div>

          <ValidationError :msg="errors.eventreport" />
          <div class="form-actions">
            <AppButton type="submit" :loading="loading.eventreport" :disabled="!erValid">
              <font-awesome-icon v-if="!loading.eventreport" icon="fa-solid fa-paper-plane" />
              {{ loading.eventreport ? 'Wird erstellt…' : 'Event Report erstellen' }}
            </AppButton>
          </div>
          </template>
          </fieldset>
        </form>
      </div>

      <!-- ── HISTORY ────────────────────────────────────── -->
      <div class="card history-card" v-if="sessionHistory.length > 0">
        <h2 class="card-title">
          <font-awesome-icon icon="fa-solid fa-clock-rotate-left" />
          Erstellt in dieser Sitzung
          <span class="count-badge">{{ sessionHistory.length }}</span>
        </h2>
        <div class="history-list">
          <div v-for="item in sessionHistory" :key="item.id" class="history-item">
            <div class="history-icon" :class="`history-icon--${item.type}`">
              <font-awesome-icon :icon="typeIcon(item.type)" />
            </div>
            <div class="history-info">
              <span class="history-title">{{ item.title }}</span>
              <span class="history-meta">
                <font-awesome-icon icon="fa-solid fa-user-tie" /> {{ item.tl }}
              </span>
              <span class="history-meta">
                <font-awesome-icon icon="fa-solid fa-location-dot" />
                {{ item.standort }}
                <span v-if="item.datum"> · {{ formatDate(item.datum) }}</span>
                <span v-if="item.auftragNr"> · #{{ item.auftragNr }}</span>
              </span>
            </div>
            <span class="status-badge" :class="`status-badge--${item.type}`">{{ typeLabel(item.type) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, defineComponent, h, getCurrentInstance } from 'vue';
import api from '@/utils/api';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useTheme } from '@/stores/theme';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import laufzettelImg from '@/assets/laufzettel.png';
import laufzettelDarkImg from '@/assets/laufzettel-dark.png';
import evaluierungImg from '@/assets/evaluierung.png';
import evaluierungDarkImg from '@/assets/evaluierung-dark.png';
import eventreportImg from '@/assets/eventreport.png';
import eventreportDarkImg from '@/assets/eventreport-dark.png';

// ─────────────────────────────────────────────────────────
// Sub-components (inline to keep everything in one file)
// ─────────────────────────────────────────────────────────

// PersonSearch – autocomplete input returning selected MA object
const PersonSearch = defineComponent({
  name: 'PersonSearch',
  props: {
    label: String,
    hint: String,
    modelValue: { type: Object, default: null },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const inputId = `document-person-search-${getCurrentInstance().uid}`;
    const query = ref(props.modelValue ? `${props.modelValue.vorname} ${props.modelValue.nachname}` : '');
    const results = ref([]);
    const loading = ref(false);
    const focused = ref(false);
    const showDrop = ref(false);
    const highlight = ref(-1);
    const inputRef = ref(null);
    let timer = null;
    let blurTimer = null;
    let searchRevision = 0;

    watch(() => props.modelValue, (value, previousValue) => {
      if (!value) {
        if (previousValue && query.value === `${previousValue.vorname} ${previousValue.nachname}`) query.value = '';
        if (previousValue) {
          searchRevision++;
          results.value = [];
          showDrop.value = false;
          loading.value = false;
        }
        return;
      }
      query.value = `${value.vorname} ${value.nachname}`;
    });

    onBeforeUnmount(() => {
      clearTimeout(timer);
      clearTimeout(blurTimer);
      searchRevision++;
    });

    const selected = computed(() => props.modelValue);

    function onInput() {
      emit('update:modelValue', null);
      highlight.value = -1;
      clearTimeout(timer);
      searchRevision++;
      if (query.value.trim().length < 2) { results.value = []; showDrop.value = false; loading.value = false; return; }
      timer = setTimeout(search, 280);
    }

    async function search() {
      const revision = searchRevision;
      loading.value = true;
      try {
        const { data } = await api.get('/api/personal/mitarbeiter/search', { params: { q: query.value } });
        if (revision !== searchRevision) return;
        results.value = Array.isArray(data) ? data : [];
        showDrop.value = true;
      } catch { if (revision === searchRevision) results.value = []; }
      finally { if (revision === searchRevision) loading.value = false; }
    }

    function pick(ma) {
      searchRevision++;
      loading.value = false;
      emit('update:modelValue', ma);
      query.value = `${ma.vorname} ${ma.nachname}`;
      results.value = [];
      showDrop.value = false;
    }

    function clear() {
      searchRevision++;
      clearTimeout(timer);
      loading.value = false;
      emit('update:modelValue', null);
      query.value = '';
      results.value = [];
      showDrop.value = false;
      inputRef.value?.focus();
    }

    function onBlur() {
      focused.value = false;
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => { showDrop.value = false; highlight.value = -1; }, 150);
    }

    function nav(dir) {
      highlight.value = Math.max(-1, Math.min(results.value.length - 1, highlight.value + dir));
    }

    function enter() {
      if (highlight.value >= 0) pick(results.value[highlight.value]);
    }

    return () => {
      const inputEl = h('div', { class: ['search-field', focused.value && 'focused'] }, [
        h(FontAwesomeIcon, { icon: 'fa-solid fa-magnifying-glass', class: 'search-icon' }),
        h(AppTextInput, {
          ref: inputRef,
          id: inputId,
          modelValue: query.value,
          placeholder: 'Name oder Personalnr. suchen…',
          autocomplete: 'off',
          role: 'combobox',
          'aria-autocomplete': 'list',
          'aria-expanded': showDrop.value && results.value.length > 0,
          'aria-controls': `${inputId}-results`,
          'aria-activedescendant': highlight.value >= 0 ? `${inputId}-option-${highlight.value}` : undefined,
          'onUpdate:modelValue': (value) => { query.value = value; onInput(); },
          onFocus: () => { focused.value = true; showDrop.value = true; },
          onBlur,
          onKeydown: (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); nav(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); nav(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); enter(); }
            else if (e.key === 'Escape') { showDrop.value = false; highlight.value = -1; }
          },
        }),
        selected.value && h(AppIconButton, {
          type: 'button', size: 'sm', variant: 'ghost', class: 'clear-btn',
          label: `${props.label.replace(/\s*\*$/, '')} Auswahl aufheben`, onClick: clear,
        }, { default: () => h(FontAwesomeIcon, { icon: 'fa-solid fa-times' }) }),
        loading.value && h(FontAwesomeIcon, { icon: 'fa-solid fa-spinner', spin: true, class: 'loading-icon' }),
      ]);

      const dropItems = showDrop.value && results.value.length > 0
        ? h('div', { id: `${inputId}-results`, class: 'search-dropdown', role: 'listbox', 'aria-label': props.label },
            results.value.map((ma, i) =>
              h('button', {
                key: ma._id,
                id: `${inputId}-option-${i}`,
                type: 'button',
                role: 'option',
                'aria-selected': highlight.value === i,
                tabindex: -1,
                class: ['dropdown-item', highlight.value === i && 'highlighted'],
                onClick: () => pick(ma),
              }, [
                h('span', { class: 'dropdown-name' }, `${ma.vorname} ${ma.nachname}`),
                h('span', { class: 'dropdown-meta' }, [
                  ma.personalnr && h('span', {}, `Nr. ${ma.personalnr}`),
                  ma.email && h('span', { class: 'dropdown-email' }, ma.email),
                ]),
              ])
            )
          )
        : (showDrop.value && query.value.length >= 2 && results.value.length === 0 && !loading.value
            ? h('div', { class: 'search-dropdown' }, [h('div', { class: 'dropdown-empty' }, 'Keine Mitarbeiter gefunden.')])
            : null);

      const chip = selected.value
        ? h('div', { class: 'selected-chip' }, [
            h(FontAwesomeIcon, { icon: 'fa-solid fa-user' }),
            ` ${selected.value.vorname} ${selected.value.nachname}`,
            selected.value.personalnr && h('span', { class: 'chip-meta' }, ` Nr. ${selected.value.personalnr}`),
          ])
        : null;

      return h('div', { class: 'field-group' }, [
        h('label', { class: 'field-label', for: inputId }, [
          props.label,
          props.hint && h('span', { class: 'field-hint' }, props.hint),
        ]),
        inputEl,
        dropItems,
        chip,
      ]);
    };
  },
});

// RatingField
const RatingField = defineComponent({
  name: 'RatingField',
  props: { label: String, modelValue: String, wide: { type: Boolean, default: false } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const inputId = `document-rating-${getCurrentInstance().uid}`;
    return () => h('div', { class: ['field-group', props.wide && 'field-group--wide'] }, [
      h('label', { class: 'field-label', for: inputId }, props.label),
      h('textarea', {
        id: inputId,
        class: 'input-field textarea-field',
        rows: 2,
        placeholder: `${props.label}…`,
        value: props.modelValue,
        onInput: (e) => emit('update:modelValue', e.target.value),
      }),
    ]);
  },
});

// ValidationError
const ValidationError = defineComponent({
  name: 'ValidationError',
  props: { msg: String },
  setup(props) {
    return () => props.msg
      ? h('p', { class: 'validation-error', role: 'alert' }, [
          h(FontAwesomeIcon, { icon: 'fa-solid fa-triangle-exclamation' }), ' ', props.msg,
        ])
      : null;
  },
});

// ─────────────────────────────────────────────────────────
// Main page logic
// ─────────────────────────────────────────────────────────

const props = defineProps({
  tab: {
    type: String,
    required: true,
    validator: (value) => ['laufzettel', 'evaluierung', 'eventreport'].includes(value),
  },
});

const theme = useTheme();
const isDark = computed(() => theme.isDark);
const iconLaufzettel  = computed(() => isDark.value ? laufzettelDarkImg  : laufzettelImg);
const iconEvaluierung = computed(() => isDark.value ? evaluierungDarkImg : evaluierungImg);
const iconEventreport = computed(() => isDark.value ? eventreportDarkImg : eventreportImg);

const activeTab = computed(() => props.tab);

// Shared
const todayStr = computed(() => new Date().toISOString().slice(0, 10));
const sessionHistory = ref([]);

const success = ref({ laufzettel: false, evaluierung: false, eventreport: false });
const loading = ref({ laufzettel: false, evaluierung: false, eventreport: false });
const errors  = ref({ laufzettel: '',    evaluierung: '',    eventreport: '' });
const locations = ref([]);

function locationName(locationId) {
  return locations.value.find((location) => String(location._id) === String(locationId))?.nameFull || '';
}

function locationIdForGeschSt(geschSt) {
  return locations.value.find((location) => String(location.externalId) === String(geschSt || ''))?._id || '';
}

async function fetchLocations() {
  try {
    const { data } = await api.get('/api/locations');
    locations.value = data || [];
  } catch (error) {
    console.error('Standorte konnten nicht geladen werden:', error);
    locations.value = [];
  }
}

// ── Laufzettel form state ──
const lz = ref({ ma: null, tl: null, datum: todayStr.value, locationV2: '', auftragNr: '' });
const lzValid = computed(() => !!auftragData.value.laufzettel && !!lz.value.ma && !!lz.value.tl && !!lz.value.datum && !!lz.value.locationV2);

async function submitLaufzettel() {
  if (loading.value.laufzettel || !lzValid.value) return;
  errors.value.laufzettel = '';
  if (lz.value.ma?._id === lz.value.tl?._id)
    return (errors.value.laufzettel = 'Mitarbeiter und Teamleitung dürfen nicht identisch sein.');
  loading.value.laufzettel = true;
  try {
    const payload = { mitarbeiter_id: lz.value.ma._id, teamleiter_id: lz.value.tl._id, datum: lz.value.datum, locationV2: lz.value.locationV2 };
    if (lz.value.auftragNr) payload.auftragNr = lz.value.auftragNr;
    await api.post('/api/personal/laufzettel/manual', payload);
    sessionHistory.value.unshift({
      id: Date.now(), type: 'laufzettel',
      title: `${lz.value.ma.vorname} ${lz.value.ma.nachname}`,
      tl: `${lz.value.tl.vorname} ${lz.value.tl.nachname}`,
      standort: locationName(lz.value.locationV2), datum: lz.value.datum, auftragNr: lz.value.auftragNr || null,
    });
    success.value.laufzettel = true;
  } catch (e) { errors.value.laufzettel = e.response?.data?.msg || 'Fehler beim Erstellen.'; }
  finally { loading.value.laufzettel = false; }
}

// ── Evaluierung form state ──
const ev = ref({ ma: null, tl: null, datum: todayStr.value, locationV2: '', auftragNr: '', kunde: '', puenktlichkeit: '', grooming: '', motivation: '', technische_fertigkeiten: '', lernbereitschaft: '', sonstiges: '' });
const evValid = computed(() => !!auftragData.value.evaluierung && !!ev.value.ma && !!ev.value.tl && !!ev.value.datum && !!ev.value.locationV2);

async function submitEvaluierung() {
  if (loading.value.evaluierung || !evValid.value) return;
  errors.value.evaluierung = '';
  if (ev.value.ma?._id === ev.value.tl?._id)
    return (errors.value.evaluierung = 'Mitarbeiter und Teamleitung dürfen nicht identisch sein.');
  loading.value.evaluierung = true;
  try {
    const payload = { mitarbeiter_id: ev.value.ma._id, teamleiter_id: ev.value.tl._id, datum: ev.value.datum, locationV2: ev.value.locationV2 };
    ['auftragNr','kunde','puenktlichkeit','grooming','motivation','technische_fertigkeiten','lernbereitschaft','sonstiges']
      .forEach(k => { if (ev.value[k]) payload[k] = ev.value[k]; });
    await api.post('/api/personal/evaluierung/manual', payload);
    sessionHistory.value.unshift({
      id: Date.now(), type: 'evaluierung',
      title: `${ev.value.ma.vorname} ${ev.value.ma.nachname}`,
      tl: `${ev.value.tl.vorname} ${ev.value.tl.nachname}`,
      standort: locationName(ev.value.locationV2), datum: ev.value.datum, auftragNr: ev.value.auftragNr || null,
    });
    success.value.evaluierung = true;
  } catch (e) { errors.value.evaluierung = e.response?.data?.msg || 'Fehler beim Erstellen.'; }
  finally { loading.value.evaluierung = false; }
}

// ── EventReport form state ──
const er = ref({ tl: null, datum: todayStr.value, locationV2: '', kunde: '', auftragNr: '', mitarbeiter_anzahl: '', puenktlichkeit: '', erscheinungsbild: '', team: '', mitarbeiter_job: '', feedback_auftraggeber: '', sonstiges: '' });
const erMaRows = ref([]); // [{ _id, name, text }]
const erMaAvailable = computed(() =>
  erEinsatzMAs.value.filter(ma => !erMaRows.value.some(r => r._id === ma._id))
);
function addErMaRow(ma) {
  if (loading.value.eventreport || erMaRows.value.some(row => row._id === ma._id)) return;
  erMaRows.value.push({ _id: ma._id, name: `${ma.vorname} ${ma.nachname}`, text: '' });
}
function removeErMaRow(row) {
  if (loading.value.eventreport) return;
  erMaRows.value = erMaRows.value.filter(r => r._id !== row._id);
}
const erValid = computed(() => !!auftragData.value.eventreport && !!er.value.tl && !!er.value.datum && !!er.value.locationV2 && !!er.value.kunde);

async function submitEventReport() {
  if (loading.value.eventreport || !erValid.value) return;
  errors.value.eventreport = '';
  loading.value.eventreport = true;
  try {
    const payload = { teamleiter_id: er.value.tl._id, datum: er.value.datum, locationV2: er.value.locationV2, kunde: er.value.kunde };
    ['auftragNr','mitarbeiter_anzahl','puenktlichkeit','erscheinungsbild','team','feedback_auftraggeber','sonstiges']
      .forEach(k => { if (er.value[k]) payload[k] = er.value[k]; });
    // Per-MA feedback rows take priority over generic mitarbeiter_job field
    const maFeedback = erMaRows.value.filter(r => r.text.trim()).map(r => ({ mitarbeiterId: r._id, name: r.name, text: r.text.trim() }));
    if (maFeedback.length) payload.mitarbeiter_feedback = maFeedback;
    else if (er.value.mitarbeiter_job) payload.mitarbeiter_job = er.value.mitarbeiter_job;
    await api.post('/api/personal/eventreport/manual', payload);
    sessionHistory.value.unshift({
      id: Date.now(), type: 'eventreport',
      title: er.value.kunde,
      tl: `${er.value.tl.vorname} ${er.value.tl.nachname}`,
      standort: locationName(er.value.locationV2), datum: er.value.datum, auftragNr: er.value.auftragNr || null,
    });
    success.value.eventreport = true;
  } catch (e) { errors.value.eventreport = e.response?.data?.msg || 'Fehler beim Erstellen.'; }
  finally { loading.value.eventreport = false; }
}

function resetForm(type) {
  if (loading.value[type]) return;
  clearTimeout(_auftragTimers[type]);
  auftragRevision[type]++;
  success.value[type] = false;
  errors.value[type] = '';
  auftragData.value[type] = null;
  const d = todayStr.value;
  if (type === 'laufzettel') lz.value = { ma: null, tl: null, datum: d, locationV2: '', auftragNr: '' };
  if (type === 'evaluierung') ev.value = { ma: null, tl: null, datum: d, locationV2: '', auftragNr: '', kunde: '', puenktlichkeit: '', grooming: '', motivation: '', technische_fertigkeiten: '', lernbereitschaft: '', sonstiges: '' };
  if (type === 'eventreport') {
    er.value = { tl: null, datum: d, locationV2: '', kunde: '', auftragNr: '', mitarbeiter_anzahl: '', puenktlichkeit: '', erscheinungsbild: '', team: '', mitarbeiter_job: '', feedback_auftraggeber: '', sonstiges: '' };
    erMaRows.value = [];
  }
}

// ── Auftrag/Einsatz Lookup ──────────────────────────────
const geschStToStandort = { '1': 'Berlin', '2': 'Hamburg', '3': 'Köln' };
const auftragData = ref({ laufzettel: null, evaluierung: null, eventreport: null });
const auftragLoading = ref({ laufzettel: false, evaluierung: false, eventreport: false });
const _auftragTimers = {};
const auftragRevision = { laufzettel: 0, evaluierung: 0, eventreport: 0 };

function debouncedAuftragFetch(formType, nr) {
  clearTimeout(_auftragTimers[formType]);
  const revision = ++auftragRevision[formType];
  if (!nr || String(nr).length < 3) { auftragData.value[formType] = null; auftragLoading.value[formType] = false; return; }
  _auftragTimers[formType] = setTimeout(async () => {
    auftragLoading.value[formType] = true;
    try {
      const { data } = await api.get(`/api/auftraege/${nr}/details`);
      if (revision !== auftragRevision[formType]) return;
      auftragData.value[formType] = data;
      applyAuftragAutoFill(formType, data);
    } catch { if (revision === auftragRevision[formType]) auftragData.value[formType] = null; }
    finally { if (revision === auftragRevision[formType]) auftragLoading.value[formType] = false; }
  }, 400);
}

function applyAuftragAutoFill(formType, data) {
  const locationV2 = data.locationV2?._id || data.locationV2 || locationIdForGeschSt(data.geschSt);
  const kundeLabel = data.kundeData?.kundName || data.eventTitel || '';
  const datum = data.vonDatum ? data.vonDatum.slice(0, 10) : '';

  if (formType === 'laufzettel') {
    if (locationV2) lz.value.locationV2 = locationV2;
    if (datum) lz.value.datum = datum;
  } else if (formType === 'evaluierung') {
    if (locationV2) ev.value.locationV2 = locationV2;
    if (datum) ev.value.datum = datum;
    if (kundeLabel) ev.value.kunde = kundeLabel;
  } else if (formType === 'eventreport') {
    if (locationV2) er.value.locationV2 = locationV2;
    if (datum) er.value.datum = datum;
    if (kundeLabel) er.value.kunde = kundeLabel;
    erMaRows.value = []; // Clear MA rows when a new Auftrag is loaded
    if (data.einsaetze?.length) {
      const uniqueNrs = new Set(data.einsaetze.filter(e => e.personalNr && !e.isPseudo).map(e => e.personalNr));
      if (uniqueNrs.size) er.value.mitarbeiter_anzahl = String(uniqueNrs.size);
    }
  }
}

function getEinsatzMAs(formType) {
  const d = auftragData.value[formType];
  if (!d?.einsaetze?.length) return [];
  const seen = new Set();
  return d.einsaetze
    .filter(e => {
      if (!e.mitarbeiterData?._id || seen.has(e.mitarbeiterData._id)) return false;
      seen.add(e.mitarbeiterData._id);
      return true;
    })
    .map(e => e.mitarbeiterData);
}

const lzEinsatzMAs = computed(() => getEinsatzMAs('laufzettel'));
const evEinsatzMAs = computed(() => getEinsatzMAs('evaluierung'));
const erEinsatzMAs = computed(() => getEinsatzMAs('eventreport'));

function auftragDisplayTitle(formType) {
  const d = auftragData.value[formType];
  if (!d) return '';
  return d.eventTitel || d.kundeData?.kundName || `Auftrag #${d.auftragNr}`;
}

function auftragDisplayMeta(formType) {
  const d = auftragData.value[formType];
  if (!d) return '';
  const parts = [];
  if (d.vonDatum) {
    const von = formatDate(d.vonDatum);
    const bis = d.bisDatum ? formatDate(d.bisDatum) : '';
    parts.push(bis && bis !== von ? `${von} – ${bis}` : von);
  }
  if (d.eventOrt) parts.push(d.eventOrt);
  if (d.eventLocation) parts.push(d.eventLocation);
  const standort = geschStToStandort[d.geschSt];
  if (standort) parts.push(standort);
  return parts.join(' · ');
}

watch(() => lz.value.auftragNr, (v) => debouncedAuftragFetch('laufzettel', v));
watch(() => ev.value.auftragNr, (v) => debouncedAuftragFetch('evaluierung', v));
watch(() => er.value.auftragNr, (v) => debouncedAuftragFetch('eventreport', v));

onMounted(fetchLocations);
onBeforeUnmount(() => {
  Object.values(_auftragTimers).forEach(clearTimeout);
  Object.keys(auftragRevision).forEach(type => { auftragRevision[type]++; });
});

function typeIcon(type) {
  if (type === 'laufzettel') return 'fa-solid fa-file-lines';
  if (type === 'evaluierung') return 'fa-solid fa-star-half-stroke';
  return 'fa-solid fa-clipboard-list';
}
function typeLabel(type) {
  if (type === 'laufzettel') return 'Laufzettel';
  if (type === 'evaluierung') return 'Evaluierung';
  return 'Event Report';
}
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<style scoped lang="scss">
.page-subtitle {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0;
}

/* ── Content ── */
.content-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Card ── */
.card {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.5rem;
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  svg { color: var(--primary); }
}

.card-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
}

.card-desc {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 1.25rem;
}

.count-badge {
  background: var(--hover);
  color: var(--text);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
}

/* ── Form ── */
.form-body {
  margin-top: 1.25rem;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

:deep(.field-group) {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  position: relative;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  @media (max-width: 560px) { grid-template-columns: 1fr; }
}

/* Rating grid: 2-col, wide items span full width */
.rating-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  @media (max-width: 560px) { grid-template-columns: 1fr; }
}

:deep(.field-group--wide) {
  grid-column: 1 / -1;
}

:deep(.field-label) {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

:deep(.field-hint) {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.75rem;
  color: var(--muted);
  opacity: 0.7;
}

/* ── Search field ── */
:deep(.search-field) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 9px;
  padding: 0 0.75rem;
  transition: border-color 0.15s;

  &:focus-within {
    border-color: var(--primary);
    outline: 2px solid var(--control-focus-ring);
    outline-offset: 1px;
  }
}

:deep(.search-field .search-icon) {
  color: var(--muted);
  font-size: 0.85rem;
  flex-shrink: 0;
}

:deep(.search-field .app-text-input) {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-size: 0.9rem;
  color: var(--text);
  padding: 0.65rem 0;
  min-width: 0;
  &::placeholder { color: var(--muted); }
}

:deep(.clear-btn) {
  --app-button-icon-size: 28px;
  min-height: 28px;
  flex-shrink: 0;
}

:deep(.loading-icon) {
  color: var(--muted);
  font-size: 0.8rem;
}

/* ── Dropdown ── */
:deep(.search-dropdown) {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 50;
  max-height: 260px;
  overflow-y: auto;
}

:deep(.dropdown-item) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.6rem 0.875rem;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  gap: 0.5rem;
  &:hover, &.highlighted, &:focus-visible { background: var(--hover); }
  &:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: -2px; }
}

:deep(.dropdown-name) {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
}

:deep(.dropdown-meta) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted);
  flex-shrink: 0;
}

:deep(.dropdown-email) {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.dropdown-empty) {
  padding: 0.875rem 1rem;
  font-size: 0.85rem;
  color: var(--muted);
  font-style: italic;
}

/* ── Selected chip ── */
:deep(.selected-chip) {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: color-mix(in oklab, var(--primary) 12%, transparent);
  border: 1px solid color-mix(in oklab, var(--primary) 35%, transparent);
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  border-radius: 20px;
  width: fit-content;
}

:deep(.chip-meta) {
  font-weight: 400;
  opacity: 0.75;
}

/* ── Inputs ── */
.input-field,
:deep(.input-field) {
  width: 100%;
  box-sizing: border-box;
  background: var(--control-input-bg);
  border: 1px solid var(--control-input-border);
  border-radius: var(--control-radius);
  padding: 8px 10px;
  color: var(--text);
  font: inherit;
  font-size: 0.875rem;
  &:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 1px; }
  &:disabled { background: var(--control-disabled-bg); color: var(--control-disabled-text); }
}

.input-narrow { max-width: 200px; }
.field-group > .app-select { width: 100%; }

:deep(.textarea-field) {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

/* ── Validation error ── */
:deep(.validation-error) {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  color: var(--status-danger-text);
  margin: 0;
}

/* ── Form actions ── */
.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.25rem;
}

/* ── Success banner ── */
.success-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: color-mix(in srgb, var(--status-success-text) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--status-success-text) 30%, transparent);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  strong { display: block; font-size: 0.95rem; color: var(--text); margin-bottom: 0.2rem; }
  p { font-size: 0.82rem; color: var(--muted); margin: 0; }
}

.success-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--status-success-text) 15%, transparent);
  color: var(--status-success-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

/* ── History ── */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.history-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;

  &--laufzettel  { background: color-mix(in srgb, var(--status-success-text) 10%, transparent); color: var(--status-success-text); }
  &--evaluierung { background: color-mix(in srgb, var(--status-warning) 12%, transparent); color: var(--status-warning-text); }
  &--eventreport { background: var(--action-ghost-hover); color: var(--action-accent-text); }
}

.history-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.history-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.history-meta {
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;

  &--laufzettel  { background: color-mix(in srgb, var(--status-success-text) 15%, transparent); color: var(--status-success-text); }
  &--evaluierung { background: color-mix(in srgb, var(--status-warning) 15%, transparent); color: var(--status-warning-text); }
  &--eventreport { background: var(--action-ghost-hover); color: var(--action-accent-text); }
}

/* ── Auftrag Lookup ── */
.auftrag-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.auftrag-spinner {
  color: var(--primary);
  font-size: 0.9rem;
}

/* ── Einsatz Panel ── */
.einsatz-panel {
  background: color-mix(in oklab, var(--primary) 6%, var(--bg));
  border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
  border-radius: 10px;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.einsatz-panel-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.einsatz-panel-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: color-mix(in oklab, var(--primary) 15%, transparent);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.einsatz-panel-title {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.einsatz-panel-meta {
  display: block;
  font-size: 0.78rem;
  color: var(--muted);
}

.einsatz-ma-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.einsatz-ma-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.einsatz-ma-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.einsatz-ma-btn {
  min-height: 30px;
  border-radius: 20px;

  svg { font-size: 0.7rem; color: var(--muted); }

  &.selected {
    border-color: var(--primary);
    color: var(--action-accent-text);
    background: var(--action-ghost-hover);
    svg { color: var(--action-accent-text); }
  }
}

.einsatz-ma-nr {
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 400;
}

/* ── Per-MA feedback rows (Event Report) ── */
.er-ma-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.6rem;
}

.er-ma-chip {
  min-height: 30px;
  border-radius: 20px;

  svg { font-size: 0.65rem; }
}

.er-ma-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.er-ma-row-field {
  position: relative;
  border: 1.5px solid var(--border);
  border-radius: 9px;
  padding: 1.1rem 0.65rem 0.5rem;
  background: var(--tile-bg);
  transition: border-color 0.15s;

  &:focus-within { border-color: var(--primary); }
}

.er-ma-row-legend {
  position: absolute;
  top: 0;
  left: 0.65rem;
  transform: translateY(-50%);
  background: var(--tile-bg);
  color: var(--action-accent-text);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0 0.25rem;
  line-height: 1;
  pointer-events: none;
  white-space: nowrap;
}

.er-ma-row-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  padding: 0.1rem 1.8rem 0 0;
  font-size: 0.85rem;
  color: var(--text);
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  line-height: 1.45;
  display: block;

  &::placeholder { color: var(--muted); }
}

.er-ma-row-remove {
  position: absolute;
  top: 0.3rem;
  right: 0.4rem;
  --app-button-icon-size: 28px;
  min-height: 28px;
}
</style>
