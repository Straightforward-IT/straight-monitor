<template>
  <div class="page-wrapper">
    <div class="page-header">
      <h1 class="page-title">
        <font-awesome-icon icon="fa-solid fa-file-pen" />
        Dokumente nachpflegen
      </h1>
      <p class="page-subtitle">Laufzettel, Evaluierungen und Event Reports manuell erstellen</p>
    </div>

    <!-- ── TABS ──────────────────────────────────────────── -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="switchTab(tab.id)"
      >
        <font-awesome-icon :icon="tab.icon" />
        {{ tab.label }}
      </button>
    </div>

    <div class="content-grid">
      <!-- ── LAUFZETTEL FORM ─────────────────────────────── -->
      <div class="card form-card" v-if="activeTab === 'laufzettel'">
        <h2 class="card-title">
          <font-awesome-icon icon="fa-solid fa-file-lines" />
          Neuer Laufzettel
        </h2>

        <div v-if="success.laufzettel" class="success-banner">
          <div class="success-icon"><font-awesome-icon icon="fa-solid fa-circle-check" /></div>
          <div>
            <strong>Laufzettel erstellt!</strong>
            <p>Angelegt und dem Teamleiter in Flip zugewiesen.</p>
          </div>
          <button class="btn-outline btn-sm" @click="resetForm('laufzettel')">Weiteren erstellen</button>
        </div>

        <form v-else @submit.prevent="submitLaufzettel" class="form-body">
          <PersonSearch label="Mitarbeiter *" hint="Vorname, Nachname oder Personalnr." v-model="lz.ma" />
          <PersonSearch label="Teamleitung *" hint="Vorname, Nachname oder Personalnr." v-model="lz.tl" />

          <div class="field-row">
            <div class="field-group">
              <label class="field-label">Datum *</label>
              <input v-model="lz.datum" type="date" class="input-field" :max="todayStr" required />
            </div>
            <div class="field-group">
              <label class="field-label">Niederlassung *</label>
              <StandortChips v-model="lz.standort" />
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">
              Auftragsnummer
              <span class="field-hint">Optional – aber wäre hilfreich wenn du die auch mit angibst.</span>
            </label>
            <input v-model="lz.auftragNr" type="number" class="input-field input-narrow" placeholder="z.B. 12345" min="1" />
          </div>

          <ValidationError :msg="errors.laufzettel" />
          <div class="form-actions">
            <SubmitBtn :loading="loading.laufzettel" :disabled="!lzValid">Laufzettel erstellen</SubmitBtn>
          </div>
        </form>
      </div>

      <!-- ── EVALUIERUNG FORM ───────────────────────────── -->
      <div class="card form-card" v-if="activeTab === 'evaluierung'">
        <h2 class="card-title">
          <font-awesome-icon icon="fa-solid fa-star-half-stroke" />
          Neue Evaluierung
        </h2>
        <p class="card-desc">Erstellt einen abgeschlossenen Laufzettel mit Bewertungsfeldern.</p>

        <div v-if="success.evaluierung" class="success-banner">
          <div class="success-icon"><font-awesome-icon icon="fa-solid fa-circle-check" /></div>
          <div>
            <strong>Evaluierung erstellt!</strong>
            <p>Der Laufzettel wurde mit Status „Bewertet" angelegt.</p>
          </div>
          <button class="btn-outline btn-sm" @click="resetForm('evaluierung')">Weiteren erstellen</button>
        </div>

        <form v-else @submit.prevent="submitEvaluierung" class="form-body">
          <PersonSearch label="Mitarbeiter *" hint="Person die bewertet wird" v-model="ev.ma" />
          <PersonSearch label="Teamleitung *" hint="Person die bewertet" v-model="ev.tl" />

          <div class="field-row">
            <div class="field-group">
              <label class="field-label">Datum *</label>
              <input v-model="ev.datum" type="date" class="input-field" :max="todayStr" required />
            </div>
            <div class="field-group">
              <label class="field-label">Niederlassung *</label>
              <StandortChips v-model="ev.standort" />
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label">Auftragsnummer <span class="field-hint">Optional</span></label>
              <input v-model="ev.auftragNr" type="number" class="input-field" placeholder="z.B. 12345" min="1" />
            </div>
            <div class="field-group">
              <label class="field-label">Kunde / Event <span class="field-hint">Optional</span></label>
              <input v-model="ev.kunde" type="text" class="input-field" placeholder="z.B. Messe Berlin" />
            </div>
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
            <SubmitBtn :loading="loading.evaluierung" :disabled="!evValid">Evaluierung erstellen</SubmitBtn>
          </div>
        </form>
      </div>

      <!-- ── EVENT REPORT FORM ──────────────────────────── -->
      <div class="card form-card" v-if="activeTab === 'eventreport'">
        <h2 class="card-title">
          <font-awesome-icon icon="fa-solid fa-clipboard-list" />
          Neuer Event Report
        </h2>

        <div v-if="success.eventreport" class="success-banner">
          <div class="success-icon"><font-awesome-icon icon="fa-solid fa-circle-check" /></div>
          <div>
            <strong>Event Report erstellt!</strong>
            <p>Der Report wurde angelegt und dem Teamleiter zugeordnet.</p>
          </div>
          <button class="btn-outline btn-sm" @click="resetForm('eventreport')">Weiteren erstellen</button>
        </div>

        <form v-else @submit.prevent="submitEventReport" class="form-body">
          <PersonSearch label="Teamleitung *" hint="Vorname, Nachname oder Personalnr." v-model="er.tl" />

          <div class="field-row">
            <div class="field-group">
              <label class="field-label">Datum *</label>
              <input v-model="er.datum" type="date" class="input-field" :max="todayStr" required />
            </div>
            <div class="field-group">
              <label class="field-label">Niederlassung *</label>
              <StandortChips v-model="er.standort" />
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label">Kunde / Event *</label>
              <input v-model="er.kunde" type="text" class="input-field" placeholder="z.B. Messe Berlin" required />
            </div>
            <div class="field-group">
              <label class="field-label">Auftragsnummer <span class="field-hint">Optional</span></label>
              <input v-model="er.auftragNr" type="number" class="input-field" placeholder="z.B. 12345" min="1" />
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Mitarbeiter Anzahl <span class="field-hint">Optional</span></label>
            <input v-model="er.mitarbeiter_anzahl" type="text" class="input-field input-narrow" placeholder="z.B. 12" />
          </div>

          <div class="rating-grid">
            <RatingField label="Pünktlichkeit" v-model="er.puenktlichkeit" />
            <RatingField label="Erscheinungsbild" v-model="er.erscheinungsbild" />
            <RatingField label="Team" v-model="er.team" />
            <RatingField label="Mitarbeiter / Job" v-model="er.mitarbeiter_job" />
            <RatingField label="Feedback Auftraggeber" v-model="er.feedback_auftraggeber" :wide="true" />
            <RatingField label="Sonstiges" v-model="er.sonstiges" :wide="true" />
          </div>

          <ValidationError :msg="errors.eventreport" />
          <div class="form-actions">
            <SubmitBtn :loading="loading.eventreport" :disabled="!erValid">Event Report erstellen</SubmitBtn>
          </div>
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
import { ref, computed, defineComponent, h } from 'vue';
import api from '@/utils/api';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

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
    const query = ref(props.modelValue ? `${props.modelValue.vorname} ${props.modelValue.nachname}` : '');
    const results = ref([]);
    const loading = ref(false);
    const focused = ref(false);
    const showDrop = ref(false);
    const highlight = ref(-1);
    let timer = null;

    const selected = computed(() => props.modelValue);

    function onInput() {
      emit('update:modelValue', null);
      highlight.value = -1;
      clearTimeout(timer);
      if (query.value.trim().length < 2) { results.value = []; return; }
      timer = setTimeout(search, 280);
    }

    async function search() {
      loading.value = true;
      try {
        const { data } = await api.get('/api/personal/mitarbeiter/search', { params: { q: query.value } });
        results.value = data;
        showDrop.value = true;
      } catch { results.value = []; }
      finally { loading.value = false; }
    }

    function pick(ma) {
      emit('update:modelValue', ma);
      query.value = `${ma.vorname} ${ma.nachname}`;
      results.value = [];
      showDrop.value = false;
    }

    function clear() {
      emit('update:modelValue', null);
      query.value = '';
      results.value = [];
    }

    function onBlur() {
      focused.value = false;
      setTimeout(() => { showDrop.value = false; }, 150);
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
        h('input', {
          value: query.value,
          type: 'text',
          placeholder: 'Name oder Personalnr. suchen…',
          autocomplete: 'off',
          onInput: (e) => { query.value = e.target.value; onInput(); },
          onFocus: () => { focused.value = true; showDrop.value = true; },
          onBlur,
          onKeydown: (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); nav(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); nav(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); enter(); }
            else if (e.key === 'Escape') showDrop.value = false;
          },
        }),
        selected.value && h('button', { type: 'button', class: 'clear-btn', onClick: clear, tabindex: -1 },
          [h(FontAwesomeIcon, { icon: 'fa-solid fa-times' })]
        ),
        loading.value && h(FontAwesomeIcon, { icon: 'fa-solid fa-spinner', spin: true, class: 'loading-icon' }),
      ]);

      const dropItems = showDrop.value && results.value.length > 0
        ? h('div', { class: 'search-dropdown' },
            results.value.map((ma, i) =>
              h('div', {
                key: ma._id,
                class: ['dropdown-item', highlight.value === i && 'highlighted'],
                onMousedown: (e) => { e.preventDefault(); pick(ma); },
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
        h('label', { class: 'field-label' }, [
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

// StandortChips
const StandortChips = defineComponent({
  name: 'StandortChips',
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const standorte = ['Hamburg', 'Berlin', 'Köln'];
    return () => h('div', { class: 'standort-chips' },
      standorte.map(s =>
        h('button', {
          key: s,
          type: 'button',
          class: ['standort-chip', props.modelValue === s && 'active'],
          onClick: () => emit('update:modelValue', s),
        }, s)
      )
    );
  },
});

// RatingField
const RatingField = defineComponent({
  name: 'RatingField',
  props: { label: String, modelValue: String, wide: { type: Boolean, default: false } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('div', { class: ['field-group', props.wide && 'field-group--wide'] }, [
      h('label', { class: 'field-label' }, props.label),
      h('textarea', {
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
      ? h('p', { class: 'validation-error' }, [
          h(FontAwesomeIcon, { icon: 'fa-solid fa-triangle-exclamation' }), ' ', props.msg,
        ])
      : null;
  },
});

// SubmitBtn
const SubmitBtn = defineComponent({
  name: 'SubmitBtn',
  props: { loading: Boolean, disabled: Boolean },
  slots: ['default'],
  setup(props, { slots }) {
    return () => h('button', {
      type: 'submit',
      class: 'btn-primary',
      disabled: props.disabled || props.loading,
    }, [
      h(FontAwesomeIcon, { icon: props.loading ? 'fa-solid fa-spinner' : 'fa-solid fa-paper-plane', spin: props.loading }),
      ' ',
      props.loading ? 'Wird erstellt…' : (slots.default ? slots.default() : 'Erstellen'),
    ]);
  },
});

// ─────────────────────────────────────────────────────────
// Main page logic
// ─────────────────────────────────────────────────────────

const tabs = [
  { id: 'laufzettel',  label: 'Laufzettel',   icon: 'fa-solid fa-file-lines' },
  { id: 'evaluierung', label: 'Evaluierung',  icon: 'fa-solid fa-star-half-stroke' },
  { id: 'eventreport', label: 'Event Report', icon: 'fa-solid fa-clipboard-list' },
];

const activeTab = ref('laufzettel');
function switchTab(id) {
  activeTab.value = id;
}

// Shared
const todayStr = computed(() => new Date().toISOString().slice(0, 10));
const sessionHistory = ref([]);

const success = ref({ laufzettel: false, evaluierung: false, eventreport: false });
const loading = ref({ laufzettel: false, evaluierung: false, eventreport: false });
const errors  = ref({ laufzettel: '',    evaluierung: '',    eventreport: '' });

// ── Laufzettel form state ──
const lz = ref({ ma: null, tl: null, datum: todayStr.value, standort: '', auftragNr: '' });
const lzValid = computed(() => !!lz.value.ma && !!lz.value.tl && !!lz.value.datum && !!lz.value.standort);

async function submitLaufzettel() {
  errors.value.laufzettel = '';
  if (lz.value.ma?._id === lz.value.tl?._id)
    return (errors.value.laufzettel = 'Mitarbeiter und Teamleitung dürfen nicht identisch sein.');
  loading.value.laufzettel = true;
  try {
    const payload = { mitarbeiter_id: lz.value.ma._id, teamleiter_id: lz.value.tl._id, datum: lz.value.datum, standort: lz.value.standort };
    if (lz.value.auftragNr) payload.auftragNr = lz.value.auftragNr;
    await api.post('/api/personal/laufzettel/manual', payload);
    sessionHistory.value.unshift({
      id: Date.now(), type: 'laufzettel',
      title: `${lz.value.ma.vorname} ${lz.value.ma.nachname}`,
      tl: `${lz.value.tl.vorname} ${lz.value.tl.nachname}`,
      standort: lz.value.standort, datum: lz.value.datum, auftragNr: lz.value.auftragNr || null,
    });
    success.value.laufzettel = true;
  } catch (e) { errors.value.laufzettel = e.response?.data?.msg || 'Fehler beim Erstellen.'; }
  finally { loading.value.laufzettel = false; }
}

// ── Evaluierung form state ──
const ev = ref({ ma: null, tl: null, datum: todayStr.value, standort: '', auftragNr: '', kunde: '', puenktlichkeit: '', grooming: '', motivation: '', technische_fertigkeiten: '', lernbereitschaft: '', sonstiges: '' });
const evValid = computed(() => !!ev.value.ma && !!ev.value.tl && !!ev.value.datum && !!ev.value.standort);

async function submitEvaluierung() {
  errors.value.evaluierung = '';
  if (ev.value.ma?._id === ev.value.tl?._id)
    return (errors.value.evaluierung = 'Mitarbeiter und Teamleitung dürfen nicht identisch sein.');
  loading.value.evaluierung = true;
  try {
    const payload = { mitarbeiter_id: ev.value.ma._id, teamleiter_id: ev.value.tl._id, datum: ev.value.datum, standort: ev.value.standort };
    ['auftragNr','kunde','puenktlichkeit','grooming','motivation','technische_fertigkeiten','lernbereitschaft','sonstiges']
      .forEach(k => { if (ev.value[k]) payload[k] = ev.value[k]; });
    await api.post('/api/personal/evaluierung/manual', payload);
    sessionHistory.value.unshift({
      id: Date.now(), type: 'evaluierung',
      title: `${ev.value.ma.vorname} ${ev.value.ma.nachname}`,
      tl: `${ev.value.tl.vorname} ${ev.value.tl.nachname}`,
      standort: ev.value.standort, datum: ev.value.datum, auftragNr: ev.value.auftragNr || null,
    });
    success.value.evaluierung = true;
  } catch (e) { errors.value.evaluierung = e.response?.data?.msg || 'Fehler beim Erstellen.'; }
  finally { loading.value.evaluierung = false; }
}

// ── EventReport form state ──
const er = ref({ tl: null, datum: todayStr.value, standort: '', kunde: '', auftragNr: '', mitarbeiter_anzahl: '', puenktlichkeit: '', erscheinungsbild: '', team: '', mitarbeiter_job: '', feedback_auftraggeber: '', sonstiges: '' });
const erValid = computed(() => !!er.value.tl && !!er.value.datum && !!er.value.standort && !!er.value.kunde);

async function submitEventReport() {
  errors.value.eventreport = '';
  loading.value.eventreport = true;
  try {
    const payload = { teamleiter_id: er.value.tl._id, datum: er.value.datum, standort: er.value.standort, kunde: er.value.kunde };
    ['auftragNr','mitarbeiter_anzahl','puenktlichkeit','erscheinungsbild','team','mitarbeiter_job','feedback_auftraggeber','sonstiges']
      .forEach(k => { if (er.value[k]) payload[k] = er.value[k]; });
    await api.post('/api/personal/eventreport/manual', payload);
    sessionHistory.value.unshift({
      id: Date.now(), type: 'eventreport',
      title: er.value.kunde,
      tl: `${er.value.tl.vorname} ${er.value.tl.nachname}`,
      standort: er.value.standort, datum: er.value.datum, auftragNr: er.value.auftragNr || null,
    });
    success.value.eventreport = true;
  } catch (e) { errors.value.eventreport = e.response?.data?.msg || 'Fehler beim Erstellen.'; }
  finally { loading.value.eventreport = false; }
}

function resetForm(type) {
  success.value[type] = false;
  errors.value[type] = '';
  const d = todayStr.value;
  if (type === 'laufzettel') lz.value = { ma: null, tl: null, datum: d, standort: '', auftragNr: '' };
  if (type === 'evaluierung') ev.value = { ma: null, tl: null, datum: d, standort: '', auftragNr: '', kunde: '', puenktlichkeit: '', grooming: '', motivation: '', technische_fertigkeiten: '', lernbereitschaft: '', sonstiges: '' };
  if (type === 'eventreport') er.value = { tl: null, datum: d, standort: '', kunde: '', auftragNr: '', mitarbeiter_anzahl: '', puenktlichkeit: '', erscheinungsbild: '', team: '', mitarbeiter_job: '', feedback_auftraggeber: '', sonstiges: '' };
}

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
.page-wrapper {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  svg { color: var(--primary); }
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0;
}

/* ── Tabs ── */
.tabs {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: none;
  border: none;
  border-bottom: 2.5px solid transparent;
  padding: 0.55rem 1rem 0.65rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;

  &:hover { color: var(--text); }
  &.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }
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
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 1.25rem;
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

  &.focused { border-color: var(--primary); }
}

:deep(.search-field .search-icon) {
  color: var(--muted);
  font-size: 0.85rem;
  flex-shrink: 0;
}

:deep(.search-field input) {
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
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 0.8rem;
  flex-shrink: 0;
  &:hover { color: var(--text); }
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
  padding: 0.6rem 0.875rem;
  cursor: pointer;
  gap: 0.5rem;
  &:hover, &.highlighted { background: var(--hover); }
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
  color: var(--primary);
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
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 9px;
  padding: 0.65rem 0.75rem;
  font-size: 0.9rem;
  color: var(--text);
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
  &:focus { border-color: var(--primary); }
  &[type="date"] { cursor: pointer; color-scheme: dark; }
}

.input-narrow { max-width: 200px; }

:deep(.textarea-field) {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

/* ── Standort chips ── */
:deep(.standort-chips) {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

:deep(.standort-chip) {
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 0.4rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: color-mix(in oklab, var(--primary) 12%, transparent);
  }
  &:hover:not(.active) { background: var(--hover); }
}

/* ── Validation error ── */
:deep(.validation-error) {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  color: #dc3545;
  margin: 0;
}

/* ── Form actions ── */
.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.25rem;
}

/* ── Buttons ── */
:deep(.btn-primary) {
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 9px;
  padding: 0.65rem 1.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: opacity 0.15s;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
  &:not(:disabled):hover { opacity: 0.9; }
}

.btn-outline {
  background: none;
  border: 1.5px solid var(--primary);
  color: var(--primary);
  border-radius: 8px;
  padding: 0.45rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: color-mix(in oklab, var(--primary) 10%, transparent); }
}

.btn-sm { padding: 0.35rem 0.875rem; font-size: 0.8rem; }

/* ── Success banner ── */
.success-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(40, 167, 69, 0.08);
  border: 1px solid rgba(40, 167, 69, 0.3);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  strong { display: block; font-size: 0.95rem; color: var(--text); margin-bottom: 0.2rem; }
  p { font-size: 0.82rem; color: var(--muted); margin: 0; }
}

.success-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(40, 167, 69, 0.15);
  color: #28a745;
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

  &--laufzettel  { background: rgba(40, 167, 69, 0.1);  color: #28a745; }
  &--evaluierung { background: rgba(255, 193, 7, 0.12); color: #d4a017; }
  &--eventreport { background: rgba(238, 175, 103, 0.15); color: var(--primary); }
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

  &--laufzettel  { background: rgba(40, 167, 69, 0.15);  color: #28a745; }
  &--evaluierung { background: rgba(255, 193, 7, 0.15);  color: #d4a017; }
  &--eventreport { background: rgba(238, 175, 103, 0.15); color: var(--primary); }
}
</style>
