import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import EventModal from '@/components/Modals/EventModal.vue';
import AppTabs from '@/components/ui-elements/AppTabs.vue';
import DatePicker from '@/components/ui-elements/DatePicker.vue';
import AppFileDropzone from '@/components/ui-elements/AppFileDropzone.vue';
import { defineComponent, h, nextTick } from 'vue';
import { createModalDock, DockedModalHost, MinimizedModalDock, useDockedModals } from '@bleck-it/vue-modal-dock';
import { useEventModals } from '@/composables/useEventModals';
import { draftDifferences, editorDay, useAuftragEditor } from '@/composables/useAuftragEditor';
import api from '@/utils/api';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { locationV2: 'hh' } }) }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
const day = '2026-10-13';
const next = '2026-10-15';
const order = (number = 42, date = day) => ({
  auftragNr: number, eventTitel: 'Bankett', kundenNr: 10, locationV2: 'hh', day: date,
  vonDatum: `${date}T18:00:00Z`, bisDatum: `${date}T23:00:00Z`, einsatzort: 'site',
  updatedAt: '2026-10-01T12:00:00Z', planningVersion: 2, auftStatus: 2, bestelltext: 'Bestellung',
  kundeData: { _id: 'customer', kundenNr: 10, kundName: 'Hotel' },
  schichten: [{ _id: `shift-${number}`, bezeichnung: 'Service', datumVon: date, datumBis: date, uhrzeitVon: '18:00', uhrzeitBis: '23:00', bedarf: 3, berufSchl: '', qualSchl: '', groupShiftKey: 'common', overrides: [], einsatzinformation: { sourceHtml: '<p>Service</p>', renderedHtml: '<p>Service</p>' } }],
  einsaetze: [],
});
const group = { _id: 'group', revision: 1, eventTitel: 'Bankett', referenz: '', bestDatum: null, einsatzort: 'site', bestelltext: 'Bestellung', shifts: [{ groupShiftKey: 'common', bezeichnung: 'Service', bedarf: 3 }] };
let wrappers = [];
function setupApi(linked = false) {
  api.get.mockImplementation(url => {
    if (url.includes('/editor/context/')) {
      const number = Number(url.split('/').pop());
      return Promise.resolve({ data: { order: order(number, number === 42 ? day : next), group: linked ? group : null, members: [{ auftragNr: 42, day }, { auftragNr: 43, day: next }], nextCursor: null } });
    }
    if (url === '/api/locations') return Promise.resolve({ data: [{ _id: 'hh', shortName: 'HH' }] });
    if (url.includes('/api/import/')) return Promise.resolve({ data: { data: [] } });
    if (url.endsWith('/einsatzorte')) return Promise.resolve({ data: [{ _id: 'site', bezeichnung: 'Hotel', adresse: { strasse: 'Straße', ort: 'Hamburg' } }] });
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: { candidates: [] } });
}
function render(props = {}) {
  const wrapper = mount(EventModal, {
    props, attachTo: document.body,
    global: { stubs: {
      ModalFrame: { name: 'ModalFrame', props: ['title', 'size'], template: '<section><h2>{{ title }}</h2><slot name="actions" /><slot /><button data-close @click="$emit(\'close\')">Frame schließen</button></section>' },
      KundeSearch: { template: '<input aria-label="Kunde suchen">' },
      OrderDocuments: true, RichTextTemplateEditor: true, 'font-awesome-icon': true,
    } },
  });
  wrappers.push(wrapper); return wrapper;
}
beforeEach(() => { vi.clearAllMocks(); setupApi(); });
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); wrappers = []; vi.useRealTimers(); document.body.innerHTML = ''; });

describe('planning-first Auftrag modal', () => {
  it('opens confirmed orders on one combined planning tab with supported sizing', async () => {
    const wrapper = render({ auftragNr: 42 }); await flushPromises();
    expect(wrapper.getComponent(AppTabs).props('modelValue')).toBe('planning');
    expect(wrapper.findAll('[role="tab"]').map(tab => tab.text())).toEqual(['Schichten & Personal', 'Auftragsdaten', 'Prüfen']);
    expect(wrapper.find('[role="tabpanel"]').attributes('aria-labelledby')).toContain('-planning');
    expect(wrapper.getComponent({ name: 'ModalFrame' }).props('size')).toBe('xl');
    expect(wrapper.text()).not.toContain('Entwurf speichern');
    expect(wrapper.text()).not.toContain('Auftrag freigeben');
  });
  it('uses four creation stages and no label or one-off-address controls', async () => {
    const wrapper = render(); await flushPromises();
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(4);
    expect(wrapper.text()).toContain('Ein Tag');
    expect(wrapper.text()).not.toContain('Labels');
    expect(wrapper.text()).not.toContain('Einmalige Auftragsadresse');
    expect(wrapper.find('.section-heading').exists()).toBe(false);
    expect(wrapper.findAll('.context-grid > .editor-card:first-child > .field').map(field => field.text().trim().split(/\s+/)[0])).toEqual(['Standort', 'Kunde', 'Titel']);
    expect(wrapper.get('.bestellung .form-row').text()).toContain('Bestelldatum');
    expect(wrapper.get('.bestellung .form-row').text()).toContain('Referenz');
    expect(api.post.mock.calls.every(([url]) => !url.includes('/submissions'))).toBe(true);
  });
  it('uses the custom calendar for single and nonconsecutive multi-day start dates', async () => {
    const wrapper = render(); await flushPromises();
    expect(wrapper.findAllComponents(DatePicker)).toHaveLength(1);
    await wrapper.get('button[aria-label="Auftragstag wählen"]').trigger('click');
    const singleCalendar = new DOMWrapper(document.body).get('.dp-popup');
    await singleCalendar.findAll('.dp-cell').find(cell => cell.text() === '15' && !cell.classes().includes('dp-cell--other')).trigger('click');
    expect(wrapper.get('button[aria-label="Auftragstag wählen"]').text()).toMatch(/^15\./);
    expect(document.querySelector('.dp-popup')).toBeNull();
    await wrapper.findAll('button').find(button => button.text() === 'Mehrere Tage').trigger('click');
    await wrapper.get('button[aria-label="Auftragstage wählen"]').trigger('click');
    const multiCalendar = new DOMWrapper(document.body).get('.dp-popup');
    await multiCalendar.findAll('.dp-cell').find(cell => cell.text() === '20' && !cell.classes().includes('dp-cell--other')).trigger('click');
    expect(document.querySelector('.dp-popup')).not.toBeNull();
    await multiCalendar.findAll('.dp-cell').find(cell => cell.text() === '22' && !cell.classes().includes('dp-cell--other')).trigger('click');
    await multiCalendar.findAll('.dp-cell').find(cell => cell.text() === '20' && !cell.classes().includes('dp-cell--other')).trigger('click');
    expect(wrapper.get('button[aria-label="Auftragstage wählen"]').text()).toBe('2 Tage ausgewählt');
    expect(wrapper.find('.selected-dates-summary').exists()).toBe(false);
    expect(wrapper.findAll('button').some(button => button.text() === 'Tag hinzufügen')).toBe(false);
    await multiCalendar.findAll('button').find(button => button.text() === 'Fertig').trigger('click');
    expect(document.querySelector('.dp-popup')).toBeNull();
    const dayTabs = wrapper.get('[role="tablist"][aria-label="Tag planen"]');
    expect(dayTabs.classes()).toContain('app-tabs--compact');
    expect(wrapper.find('.day-navigation select').exists()).toBe(false);
    await dayTabs.findAll('[role="tab"]')[1].trigger('click');
    expect(dayTabs.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true');
    await dayTabs.findAll('[role="tab"]')[1].trigger('keydown', { key: 'Home' });
    expect(dayTabs.findAll('[role="tab"]')[0].attributes('aria-selected')).toBe('true');
    expect(api.post.mock.calls.some(([url]) => url.includes('/submissions'))).toBe(false);
  });
  it('uses compact linked-day tabs and preserves edits when switching orders', async () => {
    setupApi(true);
    const wrapper = render({ auftragNr: 42 }); await flushPromises();
    await wrapper.getComponent(AppTabs).findAll('[role="tab"]').find(tab => tab.text() === 'Auftragsdaten').trigger('click');
    await wrapper.get('button[aria-label^="Titel:"]').trigger('click');
    await wrapper.get('input[aria-label="Auftragstitel"]').setValue('Behalten');
    const days = wrapper.get('[role="tablist"][aria-label="Verknüpfte Aufträge"]');
    expect(days.classes()).toContain('app-tabs--compact');
    expect(wrapper.find('.day-navigation select').exists()).toBe(false);
    await days.findAll('[role="tab"]')[1].trigger('click'); await flushPromises();
    expect(wrapper.get('input[aria-label="Auftragstitel"]').element.value).toBe('Bankett');
    expect(days.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true');
    await days.findAll('[role="tab"]')[0].trigger('click'); await flushPromises();
    expect(wrapper.get('input[aria-label="Auftragstitel"]').element.value).toBe('Behalten');
    expect(days.findAll('[role="tab"]')[0].attributes('aria-selected')).toBe('true');
    expect(api.post.mock.calls.some(([url]) => url.includes('/submissions'))).toBe(false);
  });
  it('uses the same on-by-default link toggle for fields, Bestellung and Einsatzort', async () => {
    setupApi(true);
    api.post.mockImplementation(async url => ({ data: url.endsWith('/review') ? { orders: [], totalAffected: 0, errors: [] } : { candidates: [] } }));
    const wrapper = render({ auftragNr: 42 }); await flushPromises();
    const demand = wrapper.get('button[aria-label^="Bedarf:"]');
    expect(demand.attributes('aria-pressed')).toBe('true');
    await demand.trigger('click');
    expect(demand.attributes('aria-pressed')).toBe('false');
    await wrapper.get('input[aria-label="Personalbedarf"]').setValue(0);
    await wrapper.getComponent(AppTabs).findAll('[role="tab"]').find(tab => tab.text() === 'Auftragsdaten').trigger('click');
    const note = wrapper.get('button[aria-label^="Bestellungstext:"]');
    const site = wrapper.get('button[aria-label^="Einsatzort:"]');
    const attachments = wrapper.get('button[aria-label^="Neue Bestellungsanlagen:"]');
    expect([note, site, attachments].every(button => button.attributes('aria-pressed') === 'true')).toBe(true);
    await note.trigger('click'); await site.trigger('click'); await attachments.trigger('click');
    await wrapper.get('textarea').setValue('Nur für diesen Tag');
    wrapper.getComponent(AppFileDropzone).vm.$emit('select', new File(['file'], 'bestellung.pdf'));
    await wrapper.getComponent(AppTabs).findAll('[role="tab"]').find(tab => tab.text() === 'Prüfen').trigger('click');
    await flushPromises();
    const body = api.post.mock.calls.find(([url]) => url.endsWith('/review'))[1];
    expect(body.order).toMatchObject({ bestelltextOverride: true, einsatzortOverride: true, bestelltext: 'Nur für diesen Tag' });
    expect(body.shifts[0]).toMatchObject({ bedarf: 0, overrides: ['bedarf'] });
    expect(body.attachments[0].relationTarget).toBe('order');
    expect(api.post.mock.calls.some(([url]) => url.endsWith('/submissions'))).toBe(false);
  });
  it('places independent linked-scope controls inside title and Bestellung fields', async () => {
    setupApi(true);
    api.post.mockImplementation(async url => ({ data: url.endsWith('/review') ? { orders: [], totalAffected: 0, errors: [] } : { candidates: [] } }));
    const wrapper = render({ auftragNr: 42 }); await flushPromises();
    await wrapper.getComponent(AppTabs).findAll('[role="tab"]').find(tab => tab.text() === 'Auftragsdaten').trigger('click');
    for (const label of ['Titel', 'Referenz', 'Bestelldatum', 'Bestellungstext']) {
      const button = wrapper.get(`button[aria-label^="${label}:"]`);
      expect(button.attributes('aria-pressed')).toBe('true');
      expect(button.element.closest('.linked-field-control')).not.toBeNull();
      await button.trigger('click');
      expect(button.attributes('aria-pressed')).toBe('false');
    }
    expect(wrapper.get('.bestellung > .card-heading').find('.linked-scope-toggle').exists()).toBe(false);
    await wrapper.get('input[aria-label="Auftragstitel"]').setValue('Titel nur heute');
    await wrapper.get('input[placeholder="Bestellung / PO"]').setValue('PO nur heute');
    await wrapper.get('.bestellung input[type="date"]').setValue('2026-10-16');
    await wrapper.get('textarea').setValue('Text nur heute');
    await wrapper.getComponent(AppTabs).findAll('[role="tab"]').find(tab => tab.text() === 'Prüfen').trigger('click');
    await flushPromises();
    const body = api.post.mock.calls.find(([url]) => url.endsWith('/review'))[1];
    expect(body.order).toMatchObject({
      eventTitel: 'Titel nur heute', eventTitelOverride: true, referenz: 'PO nur heute', referenzOverride: true,
      bestDatum: '2026-10-16', bestDatumOverride: true, bestelltext: 'Text nur heute', bestelltextOverride: true,
    });
  });
  it('guards frame close and allows explicit discard without any mutation', async () => {
    const wrapper = render({ auftragNr: 42 }); await flushPromises();
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'Auftragsdaten').trigger('click');
    await wrapper.get('input[aria-label="Auftragstitel"]').setValue('Änderung');
    await wrapper.get('[data-close]').trigger('click');
    expect(wrapper.find('[role="alertdialog"]').text()).toContain('Änderungen verwerfen?');
    expect(wrapper.emitted('close')).toBeUndefined();
    await wrapper.findAll('button').find(button => button.text() === 'Weiter bearbeiten').trigger('click');
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
    await wrapper.get('[data-close]').trigger('click');
    await wrapper.findAll('button').find(button => button.text() === 'Verwerfen').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(api.post.mock.calls.some(([url]) => /submissions|planning|einsaetze/.test(url))).toBe(false);
  });
  it('keeps Kunde read-only and shows an actual before/after review', async () => {
    const wrapper = render({ auftragNr: 42 }); await flushPromises();
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'Auftragsdaten').trigger('click');
    expect(wrapper.find('input[aria-label="Kunde suchen"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Nach Erstellung nicht änderbar');
    await wrapper.get('input[aria-label="Auftragstitel"]').setValue('Neues Bankett');
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === 'Prüfen').trigger('click');
    expect(wrapper.get('.review-changes').text()).toContain('Bankett');
    expect(wrapper.get('.review-changes').text()).toContain('Neues Bankett');
    expect(api.post.mock.calls.some(([url]) => url.includes('/submissions'))).toBe(false);
  });
  it('retains dirty state through real dock minimize/restore and guards dock close', async () => {
    let manager, launchers;
    const Root = defineComponent({ setup() {
      manager = useDockedModals(); launchers = useEventModals();
      return () => h('div', [h(DockedModalHost), h(MinimizedModalDock)]);
    } });
    const wrapper = mount(Root, { attachTo: document.body, global: {
      plugins: [createModalDock()], stubs: { 'font-awesome-icon': true, OrderDocuments: true, RichTextTemplateEditor: true, KundeSearch: true },
    } });
    wrappers.push(wrapper);
    launchers.openEvent(order());
    await flushPromises();
    const modal = wrapper.getComponent(EventModal);
    await modal.getComponent(AppTabs).findAll('[role="tab"]').find(tab => tab.text() === 'Auftragsdaten').trigger('click');
    await modal.get('input[aria-label="Auftragstitel"]').setValue('Behalten');
    manager.minimize('event-42'); await nextTick();
    manager.restore('event-42'); await nextTick();
    expect(wrapper.getComponent(EventModal).get('input[aria-label="Auftragstitel"]').element.value).toBe('Behalten');
    manager.minimize('event-42'); await nextTick();
    manager.requestClose('event-42'); await nextTick();
    expect(manager.get('event-42').status).toBe('open');
    expect(wrapper.getComponent(EventModal).get('[role="alertdialog"]').text()).toContain('Änderungen verwerfen?');
    await wrapper.getComponent(EventModal).findAll('button').find(button => button.text() === 'Verwerfen').trigger('click');
    expect(manager.get('event-42')).toBeUndefined();
  });
  it('reviews exact inherited changes on sibling days and blocks confirmation on failed review', async () => {
    setupApi(true);
    let fail = false;
    api.post.mockImplementation(async url => {
      if (url.endsWith('/review')) {
        if (fail) throw new Error('Review unavailable');
        return { data: { totalAffected: 2, orders: [42, 43].map(number => ({ auftragNr: number, day: number === 42 ? day : next, changes: [{ label: 'Service · Bedarf', before: 3, after: 0, kind: 'shift' }] })) } };
      }
      return { data: { candidates: [] } };
    });
    const wrapper = render({ auftragNr: 42 }); await flushPromises();
    await wrapper.get('input[aria-label="Personalbedarf"]').setValue(0);
    const reviewTab = wrapper.getComponent(AppTabs).findAll('[role="tab"]').find(tab => tab.text() === 'Prüfen');
    await reviewTab.trigger('click'); await flushPromises();
    expect(wrapper.findAll('.review-changes')).toHaveLength(2);
    expect(wrapper.text()).toContain('#43');
    expect(wrapper.findAll('button').find(button => button.text() === 'Änderungen übernehmen').attributes('disabled')).toBeUndefined();
    await wrapper.getComponent(AppTabs).findAll('[role="tab"]').find(tab => tab.text() === 'Schichten & Personal').trigger('click');
    fail = true;
    await reviewTab.trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('Review unavailable');
    expect(wrapper.findAll('button').find(button => button.text() === 'Änderungen übernehmen').attributes('disabled')).toBeDefined();
    expect(api.post.mock.calls.some(([url]) => url.endsWith('/submissions'))).toBe(false);
  });
});

describe('staged editor state', () => {
  it('keeps business-day identity at midnight and compares zero/empty values', () => {
    expect(editorDay('2026-10-12T22:30:00Z')).toBe(day);
    const baseline = { order: {}, shifts: [{ clientId: 's', bezeichnung: 'A', bedarf: 2, overrides: [] }], planning: [] };
    const draft = { order: {}, shifts: [{ ...baseline.shifts[0], bedarf: 0, bezeichnung: '' }], planning: [] };
    expect(draftDifferences(draft, baseline).map(change => change.after)).toEqual(['', 0]);
  });
  it('preserves edits across linked-day reads and sends only changed fields', async () => {
    setupApi(true);
    const model = useAuftragEditor({ auftragNr: 42 }); await model.load(42);
    model.order.value.referenz = 'PO-42';
    model.setShift(model.shifts.value[0], 'bedarf', 0);
    await model.load(43);
    expect(model.shifts.value[0].bedarf).toBe(0);
    await model.load(42);
    expect(model.order.value.referenz).toBe('PO-42');
    const payload = model.submissionPayload();
    expect(payload.shifts[0]).toMatchObject({ _id: 'shift-42', bedarf: 0 });
    expect(payload.shifts[0].bezeichnung).toBeUndefined();
    model.order.value.referenz = '';
    model.setShift(model.shifts.value[0], 'bedarf', 3);
    expect(model.dirty.value).toBe(false);
  });
  it('preserves explicit overrides equal to common values until reset', async () => {
    setupApi(true);
    const model = useAuftragEditor({ auftragNr: 42 }); await model.load(42);
    const shift = model.shifts.value[0];
    model.toggleOverride(shift, 'bedarf');
    expect(shift.overrides).toEqual(['bedarf']);
    model.setShift(shift, 'bedarf', 3);
    expect(model.dirty.value).toBe(true);
    model.toggleOverride(shift, 'bedarf');
    expect(shift.overrides).toEqual([]);
    expect(model.dirty.value).toBe(false);
  });
  it('restores group site and note inheritance, including an empty common note', async () => {
    setupApi(true);
    const model = useAuftragEditor({ auftragNr: 42 }); await model.load(42);
    model.toggleOrderOverride('einsatzort'); model.setOrder('einsatzort', 'local-site');
    expect(model.order.value.einsatzort).toBe('local-site');
    model.toggleOrderOverride('einsatzort');
    expect(model.order.value.einsatzort).toBe('site');
    model.setOrder('bestelltext', '');
    model.toggleOrderOverride('bestelltext'); model.setOrder('bestelltext', 'Nur heute');
    model.toggleOrderOverride('bestelltext');
    expect(model.order.value.bestelltext).toBe('');
  });
  it('supports more than ninety individual dates, overnight templates and per-day staffing', () => {
    const model = useAuftragEditor({ locationV2: 'hh' });
    const first = model.order.value.day;
    const dates = Array.from({ length: 125 }, (_, index) => {
      const value = new Date(`${first}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + index * 2); return value.toISOString().slice(0, 10);
    });
    model.multiDay.value = true; model.dates.value = dates;
    model.setOrder('kundenNr', 10); model.setOrder('einsatzort', 'site'); model.setOrder('eventTitel', 'Nacht');
    const end = new Date(`${first}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
    const shift = model.addShift({ bezeichnung: 'Nacht', uhrzeitVon: '23:00', uhrzeitBis: '03:00', datumBis: end.toISOString().slice(0, 10) });
    model.stageAssignment({ _id: 'alice', vorname: 'Alice', nachname: 'Test' }, shift);
    model.selectCreationDay(dates[1]);
    expect(model.assignmentsFor(model.shifts.value[0])).toHaveLength(0);
    expect(model.shifts.value[0].datumBis > model.shifts.value[0].datumVon).toBe(true);
    model.stageAssignment({ _id: 'bob', vorname: 'Bob', nachname: 'Test' }, model.shifts.value[0]);
    const payload = model.submissionPayload();
    expect(payload.dates).toHaveLength(125);
    expect(payload.planning.map(item => item.mitarbeiterId)).toEqual(['bob']);
    expect(payload.dayOverrides.find(item => item.day === first).planning.map(item => item.mitarbeiterId)).toEqual(['alice']);
  });
  it('stages assignment add/cancel and shift deletion without network writes', async () => {
    const model = useAuftragEditor({ auftragNr: 42 }); await model.load(42);
    const shift = model.shifts.value[0];
    model.stageAssignment({ _id: 'person', vorname: 'Ada', nachname: 'Test' }, shift);
    expect(model.assignmentsFor(shift)).toHaveLength(1);
    model.removeAssignment(model.assignmentsFor(shift)[0]);
    expect(model.draft.value.planning).toHaveLength(0);
    model.deleteShift(shift);
    expect(model.submissionPayload().shifts[0].deleted).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });
  it('resumes incomplete batches, uploads only failed files, and never submits edits twice', async () => {
    const updated = order();
    const onUpdated = vi.fn();
    const model = useAuftragEditor({ auftragNr: 42, onUpdated }); await model.load(42);
    model.order.value.referenz = 'PO';
    model.queueFiles([new File(['one'], 'one.pdf'), new File(['two'], 'two.pdf')], 'order');
    let processCount = 0, secondFileAttempts = 0;
    api.post.mockImplementation(async (url, body) => {
      if (url.endsWith('/submissions')) return { data: { id: 'submission', status: 'pending', total: 2, completed: 0 } };
      if (url.endsWith('/process')) {
        processCount++;
        return { data: processCount === 1
          ? { id: 'submission', status: 'incomplete', total: 2, completed: 1, failedDays: [next], errors: ['Failure'], orders: [updated] }
          : { id: 'submission', status: 'completed', total: 2, completed: 2, orders: [updated] } };
      }
      if (url.endsWith('/complete')) return { data: { ready: true } };
      if (body.get('file').name === 'two.pdf' && secondFileAttempts++ === 0) throw new Error('R2 unavailable');
      return { data: { success: true } };
    });
    await model.submit();
    expect(model.pending.value).toBe(true);
    expect(model.progress.value.completed).toBe(1);
    await model.submit();
    expect(model.files.map(file => file.status)).toEqual(['completed', 'failed']);
    expect(model.error.value).toContain('Anlagen fehlen');
    await model.submit();
    expect(model.files.map(file => file.status)).toEqual(['completed', 'completed']);
    expect(api.post.mock.calls.filter(([url]) => url.endsWith('/submissions'))).toHaveLength(1);
    expect(api.post.mock.calls.filter(([url]) => url.endsWith('/process'))).toHaveLength(2);
    expect(api.post.mock.calls.filter(([url, body]) => url.includes('/einsatzdokumente') && body.get('file').name === 'one.pdf')).toHaveLength(1);
    expect(model.pending.value).toBe(false);
    expect(model.dirty.value).toBe(false);
    expect(onUpdated).toHaveBeenCalled();
  });
  it('recovers an interrupted operation and reselects missing attachments using their original IDs', async () => {
    let finished = false;
    api.get.mockImplementation(async url => {
      if (url.includes('/editor/context/')) return { data: { order: order(), group, members: [{ auftragNr: 42, day }], pendingSubmission: finished ? null : {
        id: 'stored-operation', status: 'completed', ready: false, completed: 1, total: 1,
        attachments: [{ clientUploadId: 'original-upload', relationTarget: 'group', day, auftragNr: 42, filename: 'order.pdf', size: 3, uploaded: false }],
      } } };
      return { data: [] };
    });
    api.post.mockImplementation(async url => {
      if (url.endsWith('/complete')) { finished = true; return { data: { ready: true } }; }
      return { data: { success: true } };
    });
    const model = useAuftragEditor({ auftragNr: 42 }); await model.load(42);
    expect(model.pending.value).toBe(true);
    expect(model.files[0].status).toBe('missing');
    expect(model.submissionPayload().attachments[0].filename).toBe('order.pdf');
    model.restoreFile(model.files[0], new File(['bad'], 'different.pdf'));
    expect(model.files[0].file).toBeNull();
    expect(model.files[0].error).toContain('stimmen nicht');
    model.restoreFile(model.files[0], new File(['pdf'], 'order.pdf'));
    await model.submit();
    expect(api.post.mock.calls.some(([url]) => url.endsWith('/submissions') || url.endsWith('/process'))).toBe(false);
    const upload = api.post.mock.calls.find(([url]) => url.endsWith('/einsatzdokumente'));
    expect(upload[1].get('clientUploadId')).toBe('original-upload');
    expect(upload[1].get('relationTarget')).toBe('group');
    expect(model.pending.value).toBe(false);
  });
  it('allows saving a draft without shifts, but surfaces incomplete dates on an edited shift', async () => {
    const model = useAuftragEditor({ auftragNr: 42 }); await model.load(42);
    model.draft.value.shifts = [];
    expect(model.validation.value).toEqual([]);
    const shift = model.addShift({ bezeichnung: 'Service' });
    model.setShift(shift, 'datumBis', '');
    expect(model.validation.value.join(' ')).toContain('Start- und Enddatum');
  });
  it('uses canonical end-day overrides and restores the relative common date', async () => {
    setupApi(true); group.shifts[0].endDayOffset = 0;
    const model = useAuftragEditor({ auftragNr: 42 }); await model.load(42);
    const shift = model.shifts.value[0];
    model.toggleOverride(shift, 'datumBis');
    expect(shift.overrides).toEqual(['endDayOffset']);
    model.setShift(shift, 'datumBis', next);
    expect(shift.endDayOffset).toBe(2);
    expect(model.submissionPayload().shifts[0].endDayOffset).toBe(2);
    model.toggleOverride(shift, 'datumBis');
    expect(shift.datumBis).toBe(day);
    expect(model.dirty.value).toBe(false);
  });
  it('keeps new edit shifts unbound and separates a shared seed from a day override', async () => {
    setupApi(true);
    const model = useAuftragEditor({ auftragNr: 42 }); await model.load(42);
    const shift = model.addShift({ bezeichnung: 'Neue Schicht', bedarf: 2 });
    expect(shift.groupShiftKey).toBeUndefined();
    model.toggleOverride(shift, 'bedarf'); model.setShift(shift, 'bedarf', 4);
    const payload = model.submissionPayload();
    expect(payload.shifts.find(item => item.clientId === shift.clientId)).toMatchObject({ bedarf: 4, overrides: ['bedarf'] });
    expect(payload.commonShifts.find(item => item.clientId === shift.clientId).bedarf).toBe(2);
    const extra = model.addShift({ bezeichnung: 'Nur heute', dayOnly: true });
    expect(extra.groupShiftKey).toBeUndefined();
    expect(model.submissionPayload().commonShifts.some(item => item.clientId === extra.clientId)).toBe(false);
  });
  it('shares order fields independently and restores common title, reference and date values', async () => {
    setupApi(true);
    const model = useAuftragEditor({ auftragNr: 42 }); await model.load(42);
    model.setOrder('eventTitel', 'Gemeinsamer Titel');
    model.setOrder('referenz', 'Gemeinsame Referenz');
    model.setOrder('bestDatum', '2026-10-16');
    await model.load(43);
    expect(model.order.value).toMatchObject({ eventTitel: 'Gemeinsamer Titel', referenz: 'Gemeinsame Referenz', bestDatum: '2026-10-16' });
    for (const field of ['eventTitel', 'referenz', 'bestDatum']) model.toggleOrderOverride(field);
    model.setOrder('eventTitel', 'Nur dieser Tag'); model.setOrder('referenz', ''); model.setOrder('bestDatum', '');
    await model.load(42);
    expect(model.order.value).toMatchObject({ eventTitel: 'Gemeinsamer Titel', referenz: 'Gemeinsame Referenz', bestDatum: '2026-10-16' });
    await model.load(43);
    expect(model.order.value).toMatchObject({ eventTitel: 'Nur dieser Tag', referenz: '', bestDatum: '' });
    for (const field of ['eventTitel', 'referenz', 'bestDatum']) model.toggleOrderOverride(field);
    expect(model.order.value).toMatchObject({ eventTitel: 'Gemeinsamer Titel', referenz: 'Gemeinsame Referenz', bestDatum: '2026-10-16', eventTitelOverride: false, referenzOverride: false, bestDatumOverride: false });
  });
  it('rejects oversized files visibly without losing valid files', () => {
    const model = useAuftragEditor({});
    const oversized = new File([], 'large.pdf'); Object.defineProperty(oversized, 'size', { value: 30 * 1024 * 1024 + 1 });
    model.queueFiles([oversized, new File(['ok'], 'valid.pdf')]);
    expect(model.files).toHaveLength(1);
    expect(model.error.value).toContain('30 MB');
  });
});
