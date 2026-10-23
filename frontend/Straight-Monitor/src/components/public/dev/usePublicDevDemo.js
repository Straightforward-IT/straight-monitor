import { reactive, watch } from 'vue';

function isoDay(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString();
}

function createInitialState() {
  return {
    applications: {},
    applicationSteps: {},
    availability: Array.from({ length: 7 }, (_, index) => ({
      date: isoDay(index),
      type: index === 2 ? 'unavailable' : index === 3 ? 'partial' : 'available',
      from: index === 3 ? '18:00' : '',
      to: '',
    })),
    timeEntry: {
      status: 'idle',
      startedAt: null,
      stoppedAt: null,
      elapsedMs: 0,
      pauseStartedAt: null,
      pauseMs: 0,
      correction: null,
      history: [],
    },
    documents: [
      { id: 'contract', name: 'Arbeitsvertrag', status: 'approved', validity: null, fileName: 'Arbeitsvertrag.pdf' },
      { id: 'personnel', name: 'Personalbogen', status: 'approved', validity: null, fileName: 'Personalbogen.pdf' },
      { id: 'tax-id', name: 'Steuer-ID', status: 'approved', validity: null, fileName: 'Steuer-ID.pdf' },
      { id: 'study', name: 'Immatrikulationsbescheinigung', status: 'expiring', validity: '2026-09-30', fileName: 'Immatrikulation.pdf' },
      { id: 'residence', name: 'Aufenthaltstitel', status: 'missing', validity: null, fileName: null },
    ],
  };
}

function storageKey(email) {
  return `public_dev_portal:${String(email || 'debug').trim().toLowerCase()}`;
}

export function usePublicDevDemo(email) {
  const fallback = createInitialState();
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(storageKey(email)) || 'null');
  } catch {
    stored = null;
  }

  const storedTimeEntry = { ...fallback.timeEntry, ...(stored?.timeEntry || {}) };
  if (['running', 'paused'].includes(storedTimeEntry.status)) {
    Object.assign(storedTimeEntry, fallback.timeEntry);
  }

  const state = reactive({
    ...fallback,
    ...(stored || {}),
    timeEntry: storedTimeEntry,
    availability: Array.isArray(stored?.availability) ? stored.availability : fallback.availability,
    documents: Array.isArray(stored?.documents) ? stored.documents : fallback.documents,
    applications: stored?.applications || {},
    applicationSteps: stored?.applicationSteps || {},
  });

  watch(state, (value) => {
    localStorage.setItem(storageKey(email), JSON.stringify(value));
  }, { deep: true });

  function reset() {
    const initial = createInitialState();
    state.applications = initial.applications;
    state.applicationSteps = initial.applicationSteps;
    state.availability = initial.availability;
    state.timeEntry = initial.timeEntry;
    state.documents = initial.documents;
    localStorage.removeItem(storageKey(email));
  }

  return { state, reset };
}