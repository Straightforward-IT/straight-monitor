import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount, shallowMount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import api from '@/utils/api';
import { useSignaturModal } from '@/stores/signaturModal';
import OrderDocumentsPanel from '@/components/orders/OrderDocumentsPanel.vue';
import OrderDocumentUploadDialog from '@/components/orders/dialogs/OrderDocumentUploadDialog.vue';
import AuftragCalendarWorkspace from '@/components/orders/calendar/AuftragCalendarWorkspace.vue';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
const wrappers = [];
const documentRecord = { _id: 'document-1', key: 'r2-key', filename: 'Ablauf.pdf', size: 2048 };
const file = () => new File(['document'], 'Ablauf.pdf', { type: 'application/pdf' });
const order = () => ({ _id: 'order-42', auftragNr: 42, eventTitel: 'Konferenz', labels: [], einsaetze: [], schichten: [] });
const assignment = (id, firstName, shift) => ({
  _id: id,
  schicht: { _id: shift, bezeichnung: `Schicht ${shift}` },
  mitarbeiterData: { vorname: firstName, nachname: 'Beispiel' },
  berufData: { designation: 'Service' },
});
const hoursStatus = status => ({ vorgang: { _id: 'hours-1', name: 'Stundenliste Konferenz', status, submitters: [{ status: 'completed' }, { status: 'awaiting' }] }, signedPdfUrl: '/signed.pdf', unsignedPdfUrl: '/unsigned.pdf' });
const dialog = () => new DOMWrapper(document.querySelector('[role="dialog"]'));
const button = (wrapper, label) => wrapper.get(`button[aria-label="${label}"]`);
async function submit() { dialog().get('button[type="submit"]').element.click(); await flushPromises(); }
function escape() {
  document.querySelectorAll('.mf-overlay').forEach(overlay => { overlay.getClientRects = () => [{}]; });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}
function render(component, props) {
  const wrapper = mount(component, { attachTo: document.body, props, global: { stubs: { 'font-awesome-icon': true } } });
  wrappers.push(wrapper); return wrapper;
}
function panel(props = {}) {
  return render(OrderDocumentsPanel, { expenseName: record => record.name, formatSize: bytes => `${bytes} B`, ...props });
}
// Real parent contracts and child controls/teleports; only startup, unrelated
// dock launchers and sidebar async refreshes are isolated for this offline fixture.
function workspace(data = {}, methods = {}) {
  const pinia = createPinia();
  const wrapper = shallowMount({
    ...AuftragCalendarWorkspace,
    setup: () => ({ formatEmployeeName: record => record.name, restoreMinimizedStundenliste: () => false }),
    mounted() { document.addEventListener('keydown', this.handleEscapeKey); },
    methods: {
      ...AuftragCalendarWorkspace.methods, loadStundenlisteStatus: vi.fn(), loadEinsatzDoks: vi.fn(),
      loadReisekosten: vi.fn(), fetchAuftragDocs: vi.fn(), ...methods,
    },
  }, {
    attachTo: document.body, data: () => ({ selectedEvent: order(), auftraege: [order()], ...data }),
    global: {
      plugins: [pinia], mocks: { $route: { query: {} }, $router: { push: vi.fn(), replace: vi.fn() } },
      stubs: {
        'font-awesome-icon': true, CustomTooltip: { template: '<div><slot /></div>' }, RouterLink: true,
        AuftragDetailsSidePanel: { template: '<aside><slot /></aside>' },
        OrderDocumentsPanel: false, OrderDocumentUploadDialog: false, OrderActionDialog: false,
        AppButton: false, AppIconButton: false, AppTextInput: false, AppSegmentedControl: false, FilterChip: false, ModalFrame: false, PassThrough: false, Teleport: false,
        BerufSearch: false,
      },
    },
  });
  wrappers.push(wrapper); return { wrapper, pinia };
}
beforeEach(() => {
  sessionStorage.clear(); vi.resetAllMocks();
  api.get.mockResolvedValue({ data: [] }); api.post.mockResolvedValue({ data: { data: documentRecord } });
  api.delete.mockResolvedValue({ data: {} });
  vi.stubGlobal('alert', vi.fn()); vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
});
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('shared order document overview', () => {
  it('uses a dedicated keyboard-accessible hours action without nesting the other controls', async () => {
    const wrapper = panel({ hoursStatus: hoursStatus('draft'), canSign: true });
    const section = wrapper.get('section');
    expect(section.attributes('aria-labelledby')).toBe(wrapper.get('h3').attributes('id'));
    expect(wrapper.find('button button').exists()).toBe(false);
    await button(wrapper, 'Stundenlisten-Vorgang öffnen').trigger('click');
    expect(wrapper.emitted('open-signature')).toEqual([['hours-1']]);
    await button(wrapper, 'Stundenliste herunterladen').trigger('click');
    await button(wrapper, 'Unterzeichnete Stundenliste herunterladen').trigger('click');
    expect(wrapper.emitted('download-hours')).toEqual([[false], [true]]);
    expect(wrapper.emitted('open-signature')).toHaveLength(1);
    expect(wrapper.text()).toContain('1/2 unterschrieben');
    await button(wrapper, 'Stundenliste öffnen').trigger('click');
    await button(wrapper, 'Unterzeichnete Stundenliste öffnen').trigger('click');
    expect(wrapper.emitted('preview-hours')).toEqual([[false], [true]]);
  });

  it.each(['draft', 'open', 'completed', 'cancelled'])('retains hours action/status visibility for %s', async status => {
    const wrapper = panel({ hoursStatus: hoursStatus(status), canSign: true });
    expect(wrapper.find('button[aria-label="Signaturentwurf löschen"]').exists()).toBe(status === 'draft');
    expect(wrapper.find('button[aria-label="Signaturprozess anzeigen"]').exists()).toBe(status === 'open');
    expect(wrapper.find('button[title="Stundenliste neu ausstellen"]').exists()).toBe(status === 'completed');
    expect(wrapper.get('.order-document-badge').text()).toBe({ draft: 'Entwurf', open: 'Ausstehend', completed: 'Unterschrieben', cancelled: 'Storniert' }[status]);
    if (status === 'completed') {
      await wrapper.get('button[title="Stundenliste neu ausstellen"]').trigger('click');
      expect(wrapper.emitted('edit-hours')).toEqual([[{ allowReplacement: true }]]);
    }
    await wrapper.setProps({ canSign: false });
    expect(wrapper.find('button[aria-label="Signaturentwurf löschen"]').exists()).toBe(status === 'draft');
    expect(wrapper.find('button[title="Stundenliste neu ausstellen"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Signaturprozess anzeigen"]').exists()).toBe(false);
  });

  it('forwards document actions separately and contextualizes accessible names', async () => {
    const wrapper = panel({ documents: [documentRecord] });
    await button(wrapper, 'Ablauf.pdf öffnen').trigger('click');
    await button(wrapper, 'Ablauf.pdf herunterladen').trigger('click');
    await button(wrapper, 'Ablauf.pdf löschen').trigger('click');
    for (const event of ['preview-document', 'download-document', 'delete-document']) expect(wrapper.emitted(event)).toEqual([[documentRecord]]);
    expect(wrapper.emitted('open-signature')).toBeUndefined();
  });

  it('retains travel-expense actions and does not allow deleting a pending signature', async () => {
    const expenses = [{ _id: 'draft', name: 'Anna', status: 'draft' }, { _id: 'pending', name: 'Tom', status: 'signature_pending', signaturVorgang: { _id: 'signature-1' } }];
    const wrapper = panel({ expenses, canSign: true });
    await button(wrapper, 'Reisekosten für Anna bearbeiten').trigger('click');
    await button(wrapper, 'Reisekosten-PDF für Anna öffnen').trigger('click');
    await wrapper.get('button[title="Zur Signatur senden"]').trigger('click');
    await button(wrapper, 'Reisekosten für Anna löschen').trigger('click');
    await button(wrapper, 'Signaturvorgang für Tom öffnen').trigger('click');
    expect(wrapper.emitted('edit-expense')).toEqual([['draft']]);
    for (const event of ['open-expense-pdf', 'sign-expense', 'delete-expense']) expect(wrapper.emitted(event)).toEqual([[expenses[0]]]);
    expect(wrapper.emitted('open-signature')).toEqual([['signature-1']]);
    expect(wrapper.find('button[aria-label="Reisekosten für Tom löschen"]').exists()).toBe(false);
    await wrapper.setProps({ canSign: false });
    expect(wrapper.find('button[title="Zur Signatur senden"]').exists()).toBe(false);
  });

  it('forwards the native menu target and opens the single-file picker from a shared button', async () => {
    const wrapper = panel();
    let target;
    await wrapper.setProps({ onToggleMenu: event => { target = event.currentTarget; } });
    await button(wrapper, 'Neues Einsatzdokument').trigger('click');
    expect(target).toBe(button(wrapper, 'Neues Einsatzdokument').element);
    expect(button(wrapper, 'Neues Einsatzdokument').attributes('aria-expanded')).toBe('false');
    await wrapper.setProps({ menuOpen: true });
    expect(button(wrapper, 'Neues Einsatzdokument').attributes('aria-expanded')).toBe('true');
    const input = wrapper.get('input[type="file"]');
    expect(input.element.multiple).toBe(false);
    const click = vi.spyOn(input.element, 'click');
    await wrapper.findAll('button').find(item => item.text().includes('Dokument hochladen')).trigger('click');
    expect(click).toHaveBeenCalledOnce();
  });

  it('keeps loading/empty states and disables file replacement during upload', async () => {
    const wrapper = panel({ hoursLoading: true, documentsLoading: true });
    expect(wrapper.findAll('[role="status"]').map(item => item.text())).toEqual(['Lade Stundenliste…', 'Lade Dokumente…']);
    await wrapper.setProps({ hoursLoading: false, documentsLoading: false, uploading: true });
    expect(wrapper.get('[role="status"]').text()).toBe('Wird hochgeladen…');
    expect(wrapper.findAll('button').find(item => item.text().includes('Dokument hochladen')).element.disabled).toBe(true);
    expect(wrapper.find('.order-document').exists()).toBe(false);
  });
});

describe('order document upload integration', () => {
  it('keeps the file/reset defaults and associates every field and the footer with the native form', async () => {
    const { wrapper } = workspace();
    const nativeInput = wrapper.get('input[type="file"]');
    const upload = file(); Object.defineProperty(nativeInput.element, 'files', { value: [upload] });
    await nativeInput.trigger('change');
    expect(wrapper.vm.pendingEinsatzDokFile).toBe(upload);
    expect(nativeInput.element.value).toBe('');
    expect(wrapper.vm.einsatzDokScope).toBe('public');
    expect(dialog().get('button[type="submit"]').element.form).toBe(dialog().get('form').element);
    expect(dialog().attributes('aria-labelledby')).toBe(dialog().get('h2').attributes('id'));
    for (const label of dialog().findAll('label').filter(item => item.attributes('for'))) {
      expect(document.getElementById(label.attributes('for'))).not.toBeNull();
    }
    expect(dialog().text()).toContain('0 Mitarbeiter eingeschlossen');
    await dialog().get('button[data-label="Monitor"]').trigger('click');
    expect(wrapper.vm.einsatzDokScope).toBe('monitor');
    expect(dialog().get('select').element.value).toBe('einsatznachweis');
  });

  it('preserves the public recipient filter and title payload and appends the uploaded record', async () => {
    const selectedEvent = { ...order(), einsaetze: [assignment('einsatz-1', 'Anna', 'A'), assignment('einsatz-2', 'Tom', 'B')] };
    const { wrapper } = workspace({ selectedEvent, showEinsatzDokDialog: true, pendingEinsatzDokFile: file() });
    await dialog().get('input[placeholder="z. B. Ablauf Oktoberfest"]').setValue('Ablauf Oktoberfest');
    await dialog().get('.filter-chip:nth-child(2)').trigger('click');
    await dialog().find('.order-recipient-assignment input').setValue(true);
    await submit();
    const [url, body, config] = api.post.mock.calls[0];
    expect(url).toBe('/api/auftraege/42/einsatzdokumente');
    expect(body.get('file').name).toBe('Ablauf.pdf');
    expect(Object.fromEntries([...body.entries()].filter(([key]) => key !== 'file'))).toEqual({ title: 'Ablauf Oktoberfest', scope: 'public', publicEinsatzIds: 'einsatz-1', publicRecipientFilter: 'true' });
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(wrapper.vm.einsatzDoks).toEqual([documentRecord]);
    expect(wrapper.vm.showEinsatzDokDialog).toBe(false); expect(wrapper.vm.pendingEinsatzDokFile).toBeNull();
  });

  it('uses every assignment when no public filter is selected and clears recipients for monitor documents', async () => {
    const selectedEvent = { ...order(), einsaetze: [assignment('einsatz-1', 'Anna', 'A'), assignment('einsatz-2', 'Tom', 'A')] };
    const { wrapper } = workspace({ selectedEvent, showEinsatzDokDialog: true, pendingEinsatzDokFile: file() });
    expect(dialog().text()).toContain('2 Mitarbeiter eingeschlossen');
    await dialog().get('.filter-chip:nth-child(2)').trigger('click');
    await dialog().find('.order-recipient-shift input').setValue(true);
    expect(wrapper.vm.einsatzDokPublicEinsatzIds).toEqual(['einsatz-1', 'einsatz-2']);
    await dialog().get('button[data-label="Monitor"]').trigger('click');
    expect(wrapper.vm.einsatzDokPublicEinsatzIds).toEqual([]);
    await dialog().get('select').setValue('ablauf');
    await submit();
    expect(api.post.mock.calls[0][1].get('scope')).toBe('monitor');
    expect(api.post.mock.calls[0][1].get('type')).toBe('ablauf');
    expect(api.post.mock.calls[0][1].get('publicEinsatzIds')).toBe('');
  });

  it('allows individual recipient selection after switching from all employees', async () => {
    const selectedEvent = { ...order(), einsaetze: [assignment('einsatz-1', 'Anna', 'A'), assignment('einsatz-2', 'Tom', 'A')] };
    const { wrapper } = workspace({ selectedEvent, showEinsatzDokDialog: true, pendingEinsatzDokFile: file() });
    const assignments = dialog().findAll('.order-recipient-assignment input');
    expect(assignments.map(input => input.element.checked)).toEqual([true, true]);
    await dialog().get('.filter-chip:nth-child(2)').trigger('click');
    expect(assignments.map(input => input.element.checked)).toEqual([false, false]);
    await assignments[0].setValue(true);
    expect(wrapper.vm.einsatzDokPublicEinsatzIds).toEqual(['einsatz-1']);
    expect(assignments.map(input => input.element.checked)).toEqual([true, false]);
  });

  it('selects only teamleaders and allows subsequent individual changes', async () => {
    const leader = assignment('einsatz-1', 'Anna', 'A');
    leader.mitarbeiterData.qualifikationen = [{ qualificationKey: 50055 }];
    const selectedEvent = { ...order(), einsaetze: [leader, assignment('einsatz-2', 'Tom', 'B')] };
    const { wrapper } = workspace({ selectedEvent, showEinsatzDokDialog: true, pendingEinsatzDokFile: file() });
    await dialog().get('.filter-chip:nth-child(3)').trigger('click');
    expect(wrapper.vm.einsatzDokPublicRecipientFilter).toBe(true);
    expect(wrapper.vm.einsatzDokPublicEinsatzIds).toEqual(['einsatz-1']);
    expect(dialog().get('.filter-chip:nth-child(3)').classes()).toContain('active');
    const inputs = dialog().findAll('.order-recipient-assignment input');
    expect(inputs.map(input => input.element.checked)).toEqual([true, false]);
    await inputs[1].setValue(true);
    expect(dialog().get('.filter-chip:nth-child(3)').classes()).not.toContain('active');
    expect(wrapper.vm.einsatzDokPublicEinsatzIds).toEqual(['einsatz-1', 'einsatz-2']);
  });

  it('shows an indeterminate shift checkbox only while some employees are selected', async () => {
    const selectedEvent = { ...order(), einsaetze: [assignment('einsatz-1', 'Anna', 'A'), assignment('einsatz-2', 'Tom', 'A')] };
    workspace({ selectedEvent, showEinsatzDokDialog: true, pendingEinsatzDokFile: file() });
    const shift = dialog().get('.order-recipient-shift input');
    expect(shift.element.checked).toBe(true);
    expect(shift.element.indeterminate).toBe(false);
    await dialog().get('.filter-chip:nth-child(2)').trigger('click');
    expect(shift.element.checked).toBe(false);
    expect(shift.element.indeterminate).toBe(false);
    await dialog().findAll('.order-recipient-assignment input')[0].setValue(true);
    expect(shift.element.checked).toBe(false);
    expect(shift.element.indeterminate).toBe(true);
    await shift.setValue(true);
    expect(shift.element.checked).toBe(true);
    expect(shift.element.indeterminate).toBe(false);
    expect(dialog().findAll('.order-recipient-assignment input').every(input => input.element.checked)).toBe(true);
    await shift.setValue(false);
    expect(shift.element.checked).toBe(false);
    expect(shift.element.indeterminate).toBe(false);
  });

  it('collapses shifts independently without changing recipient selections', async () => {
    const selectedEvent = { ...order(), einsaetze: [assignment('einsatz-1', 'Anna', 'A'), assignment('einsatz-2', 'Tom', 'B')] };
    const { wrapper } = workspace({ selectedEvent, showEinsatzDokDialog: true, pendingEinsatzDokFile: file() });
    await dialog().get('.filter-chip:nth-child(2)').trigger('click');
    await dialog().get('.order-recipient-assignment input').setValue(true);
    const collapse = button(dialog(), 'Schicht A einklappen');
    expect(collapse.attributes('aria-expanded')).toBe('true');
    await collapse.trigger('click');
    expect(collapse.attributes('aria-expanded')).toBe('false');
    expect(dialog().findAll('.order-recipient-assignment')[0].isVisible()).toBe(false);
    expect(dialog().findAll('.order-recipient-assignment')[1].isVisible()).toBe(true);
    expect(wrapper.vm.einsatzDokPublicEinsatzIds).toEqual(['einsatz-1']);
    await button(dialog(), 'Schicht A ausklappen').trigger('click');
    expect(dialog().findAll('.order-recipient-assignment')[0].isVisible()).toBe(true);
    expect(dialog().get('.order-recipient-assignment input').element.checked).toBe(true);
  });

  it('keeps the teamleader preset restricted when there are no teamleaders', async () => {
    const selectedEvent = { ...order(), einsaetze: [assignment('einsatz-1', 'Anna', 'A')] };
    const { wrapper } = workspace({ selectedEvent, showEinsatzDokDialog: true, pendingEinsatzDokFile: file() });
    await dialog().get('.filter-chip:nth-child(3)').trigger('click');
    expect(wrapper.vm.einsatzDokPublicRecipientFilter).toBe(true);
    expect(wrapper.vm.einsatzDokPublicEinsatzIds).toEqual([]);
    expect(dialog().get('.order-recipient-assignment input').element.checked).toBe(false);
    await submit();
    expect(api.post.mock.calls[0][1].get('publicRecipientFilter')).toBe('true');
    expect(api.post.mock.calls[0][1].get('publicEinsatzIds')).toBe('');
  });

  it('locks pending upload against edits, close, Escape, duplicate requests and file replacement', async () => {
    let resolve; api.post.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const upload = file(); const { wrapper } = workspace({ showEinsatzDokDialog: true, pendingEinsatzDokFile: upload });
    await submit();
    expect(dialog().get('fieldset').element.disabled).toBe(true);
    expect(dialog().get('button[type="submit"]').attributes('aria-busy')).toBe('true');
    await button(dialog(), 'Schließen').trigger('click');
    await new DOMWrapper(document.querySelector('.mf-overlay')).trigger('mousedown'); escape(); await flushPromises();
    await wrapper.vm.confirmEinsatzDokUpload();
    await wrapper.vm.onEinsatzDokUpload({ target: { files: [new File(['new'], 'other.pdf')], value: 'other.pdf' } });
    expect(wrapper.vm.pendingEinsatzDokFile).toBe(upload);
    expect(wrapper.vm.showEinsatzDokDialog).toBe(true); expect(wrapper.vm.selectedEvent.auftragNr).toBe(42);
    expect(api.post).toHaveBeenCalledOnce();
    resolve({ data: { data: documentRecord } }); await flushPromises();
    expect(wrapper.vm.einsatzDokUploading).toBe(false); expect(wrapper.vm.showEinsatzDokDialog).toBe(false);
  });

  it('retains metadata/file and exposes an accessible error for retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Upload abgelehnt' } } });
    const upload = file(); const { wrapper } = workspace({ showEinsatzDokDialog: true, pendingEinsatzDokFile: upload, einsatzDokTitle: 'Entwurf' });
    await submit();
    expect(dialog().get('[role="alert"]').text()).toBe('Upload abgelehnt');
    expect(wrapper.vm.pendingEinsatzDokFile).toBe(upload); expect(wrapper.vm.einsatzDokTitle).toBe('Entwurf');
    expect(wrapper.vm.einsatzDokUploading).toBe(false);
    await submit(); expect(api.post).toHaveBeenCalledTimes(2); expect(wrapper.vm.einsatzDoks).toEqual([documentRecord]);
  });

  it('locks the public recipient picker while an upload is in flight', async () => {
    let resolveUpload;
    api.post.mockReturnValueOnce(new Promise(done => { resolveUpload = done; }));
    const selectedEvent = { ...order(), einsaetze: [assignment('einsatz-1', 'Anna', 'A')] };
    const { wrapper } = workspace({ selectedEvent, showEinsatzDokDialog: true, pendingEinsatzDokFile: file() });
    await submit();
    expect(dialog().get('.order-recipient-assignment input').element.disabled).toBe(true);
    expect(wrapper.vm.einsatzDokPublicEinsatzIds).toEqual([]);
    resolveUpload({ data: { data: documentRecord } }); await flushPromises();
  });

  it.each(['header', 'backdrop', 'escape'])('cancels the idle upload via %s without closing the underlying order', async action => {
    const { wrapper } = workspace({ showEinsatzDokDialog: true, pendingEinsatzDokFile: file(), einsatzDokUploadError: 'Alter Fehler' });
    if (action === 'header') await button(dialog(), 'Schließen').trigger('click');
    if (action === 'backdrop') await new DOMWrapper(document.querySelector('.mf-overlay')).trigger('mousedown');
    if (action === 'escape') escape();
    await flushPromises();
    expect(wrapper.vm.showEinsatzDokDialog).toBe(false); expect(wrapper.vm.pendingEinsatzDokFile).toBeNull();
    expect(wrapper.vm.einsatzDokUploadError).toBe(''); expect(wrapper.vm.selectedEvent.auftragNr).toBe(42);
  });

  it('disables submission without a file', () => {
    render(OrderDocumentUploadDialog, { modelValue: true });
    expect(dialog().get('button[type="submit"]').element.disabled).toBe(true);
  });
});

describe('document and hours workspace contracts', () => {
  it('positions the new-document menu from the actual button and keeps preview/download separate', async () => {
    const downloadFile = vi.fn(); const { wrapper } = workspace({ einsatzDoks: [documentRecord], stundenlisteStatus: hoursStatus('draft') }, { downloadFile });
    const openDocumentPreview = vi.fn();
    wrapper.vm.openDocumentPreview = openDocumentPreview;
    const menu = button(wrapper, 'Neues Einsatzdokument');
    menu.element.getBoundingClientRect = () => ({ right: 500, bottom: 200 });
    await menu.trigger('click'); expect(wrapper.vm.neuMenuPosition).toEqual({ x: 280, y: 204 });
    await button(wrapper, 'Ablauf.pdf öffnen').trigger('click');
    expect(openDocumentPreview).toHaveBeenCalledWith(expect.objectContaining({
      id: 'order-42-document-1', filename: 'Ablauf.pdf',
    }), { minimizable: false });
    api.get.mockResolvedValueOnce({ data: { data: { url: '/resolved-r2.pdf' } } });
    await button(wrapper, 'Ablauf.pdf herunterladen').trigger('click'); await flushPromises();
    expect(api.get).toHaveBeenCalledWith('/api/auftraege/42/einsatzdokumente/document-1/download');
    expect(downloadFile).toHaveBeenCalledWith('/resolved-r2.pdf', 'Ablauf.pdf');
    await button(wrapper, 'Stundenliste herunterladen').trigger('click');
    expect(downloadFile).toHaveBeenCalledWith('/unsigned.pdf', wrapper.vm.stundenlistePdfFilename());
    await button(wrapper, 'Unterzeichnete Stundenliste herunterladen').trigger('click');
    expect(downloadFile).toHaveBeenCalledWith('/signed.pdf', wrapper.vm.stundenlistePdfFilename(true));
    await button(wrapper, 'Stundenliste öffnen').trigger('click');
    expect(openDocumentPreview).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'order-42-hours-draft', url: '/unsigned.pdf', filename: wrapper.vm.stundenlistePdfFilename(), mimeType: 'application/pdf',
    }), { minimizable: false });
    await button(wrapper, 'Unterzeichnete Stundenliste öffnen').trigger('click');
    expect(openDocumentPreview).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'order-42-hours-signed', url: '/signed.pdf', filename: wrapper.vm.stundenlistePdfFilename(true), mimeType: 'application/pdf',
    }), { minimizable: false });
  });

  it('preserves confirmation before deleting a hours draft or travel expense', async () => {
    const expense = { _id: 'expense-1', kopf: { vorname: 'Anna' }, status: 'draft' };
    const loadStatus = vi.fn();
    const { wrapper } = workspace({ stundenlisteStatus: hoursStatus('draft'), reisekostenListe: [expense] }, { loadStundenlisteStatus: loadStatus });
    await wrapper.vm.deleteStundenlisteDraft(); await button(wrapper, 'Reisekosten für Anna löschen').trigger('click');
    expect(api.delete).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await wrapper.vm.deleteStundenlisteDraft(); await button(wrapper, 'Reisekosten für Anna löschen').trigger('click'); await flushPromises();
    expect(api.delete).toHaveBeenCalledWith('/api/signaturen/hours-1');
    expect(api.delete).toHaveBeenCalledWith('/api/reisekosten/expense-1');
    expect(loadStatus).toHaveBeenCalledWith(42); expect(wrapper.vm.reisekostenListe).toEqual([]);
  });

  it('deletes an uploaded document through its existing endpoint and synchronizes the list', async () => {
    const { wrapper } = workspace({ einsatzDoks: [documentRecord] });
    await button(wrapper, 'Ablauf.pdf löschen').trigger('click'); await flushPromises();
    expect(api.delete).toHaveBeenCalledWith('/api/auftraege/42/einsatzdokumente/document-1');
    expect(wrapper.vm.einsatzDoks).toEqual([]);
  });

  it('hands an existing draft to the central signature modal without creating a new one', async () => {
    const { wrapper, pinia } = workspace({ stundenlisteStatus: hoursStatus('draft') });
    await wrapper.get('button[title="Signaturentwurf bearbeiten"]').trigger('click'); await flushPromises();
    expect(api.post).not.toHaveBeenCalled();
    expect(useSignaturModal(pinia).context).toMatchObject({ draftId: 'hours-1', auftragNr: 42, typKey: 'stundenliste', customEndpoint: '/api/signaturen/stundenliste/42' });
    expect(useSignaturModal(pinia).open).toBe(true);
  });

  it('keeps the missing-personnel-number confirmation before creating a hours draft', async () => {
    api.get.mockResolvedValue({ data: { missingPersonalNrEinsaetze: [{ _id: 'assignment-1' }] } });
    const loadStatus = vi.fn();
    const { wrapper } = workspace({}, { loadStundenlisteStatus: loadStatus });
    await wrapper.vm.handleDocumentMenuAction('stundenliste'); expect(api.post).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('keine Personalnummer'));
    confirm.mockReturnValue(true); api.post.mockResolvedValueOnce({ data: { _id: 'new-draft' } });
    await wrapper.vm.handleDocumentMenuAction('stundenliste');
    expect(api.post).toHaveBeenCalledWith('/api/signaturen/stundenliste/42/draft', { name: 'Stundenliste Konferenz', locationId: undefined });
    expect(loadStatus).toHaveBeenCalledWith(42);
  });
});
