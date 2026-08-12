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

export function createDemoJobs() {
  return [
    {
      id: 'demo-hamburg-messe', title: 'Hamburg Messe', role: 'Service', dateFrom: isoDay(3), dateTo: isoDay(4),
      timeFrom: '17:00', timeTo: '02:00', locationName: 'Hamburg Messe', city: 'Hamburg',
      address: 'Messeplatz 1, 20357 Hamburg', meetingTime: '16:30', meetingPlace: 'Eingang Ost', openPlaces: 6,
      hourlyWage: '15,50 €', surcharges: 'Mögliche Nachtzuschläge', dressCode: 'Schwarze Hose · schwarze Schuhe', isFixture: true,
    },
    {
      id: 'demo-hotel-atlantic', title: 'Hotel Atlantic', role: 'Service', dateFrom: isoDay(6), dateTo: isoDay(7),
      timeFrom: '18:00', timeTo: '01:00', locationName: 'Hotel Atlantic', city: 'Hamburg',
      address: 'An der Alster 72, 20099 Hamburg', meetingTime: '17:30', meetingPlace: 'Personaleingang', openPlaces: 3,
      hourlyWage: '15,50 €', surcharges: null, dressCode: 'Schwarze Hose · weißes Hemd', isFixture: true,
    },
  ];
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
  });

  watch(state, (value) => {
    localStorage.setItem(storageKey(email), JSON.stringify(value));
  }, { deep: true });

  function reset() {
    const initial = createInitialState();
    state.applications = initial.applications;
    state.availability = initial.availability;
    state.timeEntry = initial.timeEntry;
    state.documents = initial.documents;
    localStorage.removeItem(storageKey(email));
  }

  return { state, reset };
}