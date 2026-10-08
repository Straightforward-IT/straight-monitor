import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import EmployeeCard from '../src/components/EmployeeCard.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';
import AppIconButton from '../src/components/ui-elements/AppIconButton.vue';
import R2FileBrowser from '../src/components/R2FileBrowser.vue';
import KuendigungModal from '../src/components/Modals/KuendigungModal.vue';
import HoverDataCard from '../src/components/ui-elements/HoverDataCard.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  updateEmployee: vi.fn(),
  openDocument: vi.fn(),
  openEmployeeContingent: vi.fn(),
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { roles: ['ADMIN'] } }) }));
vi.mock('@/stores/theme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/stores/flipAll', () => ({ useFlipAll: () => ({ enablePhotos: false, ensurePhoto: vi.fn() }) }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => ({ updateOneMitarbeiter: mocks.updateEmployee }) }));
vi.mock('@/stores/signaturModal', () => ({ useSignaturModal: () => ({}) }));
vi.mock('@/composables/useDocumentModals', () => ({ useDocumentModals: () => ({ openDocument: mocks.openDocument }) }));
vi.mock('@/composables/useAdditionalModals', () => ({ useAdditionalModals: () => ({ openEmployeeEdit: vi.fn() }) }));
vi.mock('@/composables/useTimeCaptureModals', () => ({ useTimeCaptureModals: () => ({ openTimeCapture: vi.fn() }) }));
vi.mock('@/composables/useEmployeeContingentModals', () => ({ useEmployeeContingentModals: () => ({ openEmployeeContingent: mocks.openEmployeeContingent }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), resolve: vi.fn() }) }));

const frameStub = {
  props: ['title', 'showClose', 'closeOnBackdrop', 'closeOnEscape', 'layer'],
  emits: ['close'],
  template: '<div role="dialog" aria-labelledby="reactivation-title"><slot name="header" title-id="reactivation-title" /><slot /><slot name="footer" /></div>',
};
const employee = () => ({ _id: 'employee-1', vorname: 'Ada', nachname: 'Test', isActive: false, flip: { id: 'flip-1' }, qualifikationen: [] });
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
let wrapper;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockResolvedValue({ data: { data: [] } });
  mocks.api.patch.mockResolvedValue({ data: { success: true } });
  mocks.api.post.mockResolvedValue({ data: {} });
  mocks.api.put.mockResolvedValue({ data: { data: {} } });
  mocks.api.delete.mockResolvedValue({ data: {} });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});
function render(props = {}) {
  wrapper = shallowMount(EmployeeCard, {
    attachTo: document.body,
    props: { ma: employee(), ...props },
    global: { stubs: { ModalFrame: frameStub, CustomTooltip: { template: '<span><slot /></span>' }, AppIconButton: false, AppButton: false, AppTextInput: false, AppSelect: false, 'font-awesome-icon': true } },
  });
  return wrapper;
}

describe('EmployeeCard shared shell controls', () => {
  it('opens the independent termination modal from both document menus and refreshes storage after saving', async () => {
    render();
    for (const options of [wrapper.vm.contextMenuOptions, wrapper.vm.quickActionsOptions]) {
      expect(options.find(option => option.label === 'Dokument').children).toEqual([
        { label: 'Kündigung', action: 'kuendigung', icon: ['fas', 'file-pdf'] },
      ]);
    }
    await wrapper.vm.handleContextMenuSelect('kuendigung');
    await wrapper.vm.$nextTick();
    expect(wrapper.getComponent(KuendigungModal).props('mitarbeiter')).toMatchObject(employee());
    wrapper.getComponent(KuendigungModal).vm.$emit('saved', { _id: 'doc-1' });
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.storageVersion).toBe(1);
    wrapper.getComponent(KuendigungModal).vm.$emit('update:modelValue', false);
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent(KuendigungModal).exists()).toBe(false);
    wrapper.vm.executeQuickAction('kuendigung');
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent(KuendigungModal).exists()).toBe(true);
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it('discards stale contingent responses after rapid month changes', async () => {
    render();
    await flushPromises();
    const oldMonth = deferred(), nextMonth = deferred();
    mocks.api.get.mockReturnValueOnce(oldMonth.promise).mockReturnValueOnce(nextMonth.promise);
    const firstRequest = wrapper.vm.loadEinsatzAnalytics();
    wrapper.vm.calendarMonth = (wrapper.vm.calendarMonth + 1) % 12;
    const secondRequest = wrapper.vm.loadEinsatzAnalytics();
    nextMonth.resolve({ data: { type: 'days', title: 'Neuer Monat', workedDays: 3 } });
    await secondRequest;
    oldMonth.resolve({ data: { type: 'days', title: 'Alter Monat', workedDays: 30 } });
    await firstRequest;
    expect(wrapper.vm.arbeitszeitHoverData.title).toBe('Neuer Monat');
    expect(wrapper.vm.loadingEinsatzAnalytics).toBe(false);
    expect(mocks.api.get).toHaveBeenCalledWith('/api/personal/employee-1/analytics/contingent', expect.objectContaining({ params: expect.objectContaining({ year: expect.any(Number), month: expect.any(Number) }) }));
    const card = wrapper.getComponent(HoverDataCard);
    expect(card.props('popout')).toBe(true);
    expect(mocks.openEmployeeContingent).not.toHaveBeenCalled();
    card.vm.$emit('popout');
    expect(mocks.openEmployeeContingent).toHaveBeenCalledWith(expect.objectContaining({ _id: 'employee-1' }),
      { year: wrapper.vm.calendarYear, month: wrapper.vm.calendarMonth + 1 },
      expect.objectContaining({ title: 'Neuer Monat', workedDays: 3, employeeName: wrapper.vm.formattedName }));
  });

  it('exposes contingent loading failures instead of an empty zero card', async () => {
    render();
    await flushPromises();
    mocks.api.get.mockRejectedValueOnce(new Error('offline'));
    await wrapper.vm.loadEinsatzAnalytics();
    expect(wrapper.vm.arbeitszeitHoverData.type).toBe('notice');
    expect(wrapper.vm.arbeitszeitHoverData.issues[0].code).toBe('LOAD_FAILED');
    expect(wrapper.vm.loadingEinsatzAnalytics).toBe(false);
  });
  it('connects the active tab to its panel and supports arrow, Home and End navigation', async () => {
    render();
    wrapper.vm.expanded = true;
    await wrapper.vm.$nextTick();
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.map(tab => tab.text())).toEqual(['Stammdaten', 'Ablage', 'Einsätze', 'Reports', 'Links', 'Inventar', 'Rohdaten']);
    expect(tabs[0].classes()).toContain('app-button');
    expect(tabs[0].attributes('aria-selected')).toBe('true');
    expect(wrapper.get('.hero-right[role="tabpanel"]').attributes('aria-labelledby')).toBe(tabs[0].attributes('id'));

    await tabs[0].trigger('keydown', { key: 'ArrowRight' });
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.view).toBe('ablage');
    expect(tabs[1].attributes('aria-selected')).toBe('true');
    expect(tabs[1].attributes('tabindex')).toBe('0');
    expect(wrapper.get('.card-body[role="tabpanel"]').attributes('aria-labelledby')).toBe(tabs[1].attributes('id'));
    expect(document.activeElement).toBe(tabs[1].element);

    await tabs[1].trigger('keydown', { key: 'End' });
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.view).toBe('raw');
    await tabs.at(-1).trigger('keydown', { key: 'Home' });
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.view).toBe('profile');

    const actions = wrapper.get('button[aria-haspopup="menu"]');
    await actions.trigger('click');
    expect(wrapper.vm.qaButton).toBe(actions.element);
    expect(actions.attributes('aria-expanded')).toBe('true');
    await actions.trigger('click');
    expect(actions.attributes('aria-expanded')).toBe('false');
  });

  it('uses shared inline controls for contact and nationality editing without changing the draft workflow', async () => {
    render({ ma: { ...employee(), email: 'ada@example.com', telefon: '040123', nationalitaet: '000' } });
    wrapper.vm.expanded = true;
    await wrapper.vm.$nextTick();

    await wrapper.get('button[aria-label="E-Mail bearbeiten"]').trigger('click');
    const emailInput = wrapper.get('input[aria-label="Primäre E-Mail"]');
    expect(emailInput.classes()).toContain('app-text-input');
    await emailInput.setValue(' neu@example.com ');
    expect(wrapper.vm.stammdatenDraft.email).toBe('neu@example.com');
    expect(wrapper.get('button[aria-label="E-Mail speichern"]').classes()).toContain('app-button');
    await wrapper.get('button[aria-label="E-Mail-Bearbeitung abbrechen"]').trigger('click');
    expect(wrapper.vm.editingStammdatenField).toBeNull();
    expect(mocks.api.patch).not.toHaveBeenCalled();

    await wrapper.get('button[aria-label="Staatsangehörigkeit bearbeiten"]').trigger('click');
    expect(wrapper.get('select[aria-label="Staatsangehörigkeit"]').classes()).toContain('app-select');
  });

  it('locks the inline editor during a pending save and closes it after success', async () => {
    render({ ma: { ...employee(), email: 'ada@example.com' } });
    wrapper.vm.expanded = true;
    await wrapper.vm.$nextTick();

    await wrapper.get('button[aria-label="E-Mail bearbeiten"]').trigger('click');
    await wrapper.get('input[aria-label="Primäre E-Mail"]').setValue('neu@example.com');
    const pending = deferred();
    mocks.api.patch.mockReturnValueOnce(pending.promise);
    await wrapper.get('button[aria-label="E-Mail speichern"]').trigger('click');

    expect(wrapper.get('input[aria-label="Primäre E-Mail"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button[aria-label="E-Mail speichern"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button[aria-label="E-Mail-Bearbeitung abbrechen"]').attributes('disabled')).toBeDefined();
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/personal/mitarbeiter/employee-1', {
      email: 'neu@example.com',
      additionalEmails: [],
    });

    pending.resolve({ data: { success: true, data: { email: 'neu@example.com' } } });
    await flushPromises();
    expect(wrapper.vm.editingStammdatenField).toBeNull();
    expect(mocks.updateEmployee).toHaveBeenCalledWith({ email: 'neu@example.com' });
  });

  it('uses shared Dispo note and Chronik actions and prevents duplicate writes', async () => {
    render({ ma: { ...employee(), dispoNotiz: 'Alt' } });
    wrapper.vm.expanded = true;
    wrapper.vm.view = 'straight';
    wrapper.vm.chronik = [{ _id: 'entry-1', author: 'Ada', createdAt: '2026-10-01', text: 'Eintrag' }];
    await wrapper.vm.$nextTick();

    expect(wrapper.get('button[aria-label="Dispo-Notiz bearbeiten"]').classes()).toContain('app-button');
    await wrapper.get('button[aria-label="Dispo-Notiz bearbeiten"]').trigger('click');
    const note = wrapper.get('textarea[aria-label="Interne Dispo-Notiz"]');
    await note.setValue('Neu');
    const pendingNote = deferred();
    mocks.api.patch.mockReturnValueOnce(pendingNote.promise);
    await wrapper.findAll('.dispo-notiz-actions button').find(button => button.text() === 'Speichern').trigger('click');
    expect(note.attributes('disabled')).toBeDefined();
    expect(wrapper.findAll('.dispo-notiz-actions button').find(button => button.text() === 'Abbrechen').attributes('disabled')).toBeDefined();
    await wrapper.vm.saveDispoNotiz();
    expect(mocks.api.patch).toHaveBeenCalledTimes(1);
    pendingNote.resolve({ data: { success: true } });
    await flushPromises();
    expect(wrapper.vm.editingDispoNotiz).toBe(false);
    expect(wrapper.get('.dispo-notiz-text').text()).toBe('Neu');

    const pendingDelete = deferred();
    mocks.api.delete.mockReturnValueOnce(pendingDelete.promise);
    await wrapper.get('button[aria-label^="Chronik-Eintrag"]').trigger('click');
    expect(wrapper.get('button[aria-label^="Chronik-Eintrag"]').attributes('disabled')).toBeDefined();
    pendingDelete.resolve({ data: {} });
    await flushPromises();
    expect(wrapper.vm.chronik).toEqual([]);
  });

  it('uses labelled shared feedback actions and locks the draft while saving', async () => {
    render();
    wrapper.vm.expanded = true;
    wrapper.vm.view = 'reports';
    wrapper.vm.eventreportFeedback = [{ _id: 'report-1', feedbackId: 'feedback-1', kunde: 'Kunde', feedback_text: 'Alt' }];
    await wrapper.vm.$nextTick();

    await wrapper.get('button[aria-label="Feedback zu Kunde bearbeiten"]').trigger('click');
    expect(wrapper.get('textarea[aria-label="Feedback-Text"]').element.value).toBe('Alt');
    const pending = deferred();
    mocks.api.patch.mockReturnValueOnce(pending.promise);
    await wrapper.findAll('.feedback-inline-edit-actions button').find(button => button.text() === 'Speichern').trigger('click');
    expect(wrapper.get('textarea[aria-label="Feedback-Text"]').attributes('disabled')).toBeDefined();
    expect(wrapper.findAll('.feedback-inline-edit-actions button').find(button => button.text() === 'Abbrechen').attributes('disabled')).toBeDefined();
    pending.resolve({ data: {} });
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/personal/eventreport/report-1/feedback/feedback-1', { text: 'Alt' });
    expect(wrapper.vm.editingFeedbackId).toBeNull();
  });

  it('opens report rows as native buttons and delegates Ablage and Inventar content', async () => {
    render({ ma: {
      ...employee(),
      eventreports: [{ _id: 'report-1', kunde: 'Kunde', location: 'Hamburg', datum: '2026-10-01' }],
      laufzettel_received: [{ _id: 'lauf-1', kunde: 'Kunde', datum: '2026-10-01' }],
      laufzettel_submitted: [{ _id: 'lauf-2', name_mitarbeiter: 'Bea', datum: '2026-10-01' }],
      evaluierungen_received: [{ _id: 'eval-1', name_teamleiter: 'Clara', datum: '2026-10-01' }],
      evaluierungen_submitted: [{ _id: 'eval-2', name_mitarbeiter: 'Dora', datum: '2026-10-01' }],
    } });
    wrapper.vm.expanded = true;
    wrapper.vm.view = 'reports';
    await wrapper.vm.$nextTick();
    const documents = wrapper.findAll('button.doc-item');
    expect(documents).toHaveLength(5);
    expect(documents[0].attributes('aria-label')).toBe('Event-Bericht Kunde öffnen');
    for (const document of documents) await document.trigger('click');
    expect(mocks.openDocument.mock.calls.map(([document]) => document.docType)).toEqual([
      'Event-Bericht', 'Laufzettel', 'Laufzettel', 'Evaluierung', 'Evaluierung',
    ]);
    expect(mocks.openDocument).toHaveBeenCalledWith(expect.objectContaining({ _id: 'report-1', docType: 'Event-Bericht' }), { layer: 'elevated' });

    wrapper.vm.view = 'ablage';
    await wrapper.vm.$nextTick();
    expect(wrapper.getComponent(R2FileBrowser).props('listUrl')).toContain('/api/personal/mitarbeiter/employee-1/storage');
    mocks.api.get.mockResolvedValueOnce({ data: [] });
    wrapper.vm.view = 'inventar';
    await flushPromises();
    expect(wrapper.get('.inventar-view').text()).toContain('Aktuell im Besitz');
  });

  it('uses shared Flip creation controls and keyboard-selectable link candidates', async () => {
    render({ ma: { ...employee(), flip: null, flip_id: null } });
    wrapper.vm.expanded = true;
    wrapper.vm.view = 'links';
    await wrapper.vm.$nextTick();
    await wrapper.findAll('.flip-action-buttons button').find(button => button.text().includes('Flip-User erstellen')).trigger('click');
    const location = wrapper.get('.flip-create-form select.app-select');
    expect(location.attributes('id')).toBe(wrapper.get('.flip-create-form label.fc-label').attributes('for'));
    await location.setValue('Hamburg');
    expect(wrapper.vm.flipCreateOptions.location).toBe('Hamburg');
    expect(wrapper.get('.flip-create-form input.app-text-input').attributes('id')).toBeDefined();
    wrapper.vm.flipActionLoading = true;
    await wrapper.vm.$nextTick();
    expect(location.attributes('disabled')).toBeDefined();
    wrapper.vm.flipActionLoading = false;
    wrapper.vm.showFlipCreateConfirm = false;
    wrapper.vm.showFlipLinkModal = true;
    wrapper.vm.flipUnlinkedUsers = [{ id: 'flip-2', first_name: 'Bea', last_name: 'Test', email: 'bea@example.com' }];
    await wrapper.vm.$nextTick();
    const candidate = wrapper.get('button.flip-link-item');
    expect(candidate.attributes('aria-pressed')).toBe('false');
    await candidate.trigger('click');
    expect(candidate.attributes('aria-pressed')).toBe('true');
    const pending = deferred();
    mocks.api.patch.mockReturnValueOnce(pending.promise);
    await wrapper.findAll('.flip-link-actions button').find(button => button.text().includes('Verknüpfen')).trigger('click');
    expect(candidate.attributes('disabled')).toBeDefined();
    expect(wrapper.findAll('.flip-link-actions button').find(button => button.text().includes('Abbrechen')).attributes('disabled')).toBeDefined();
    pending.resolve({ data: { success: true } });
    await flushPromises();
    expect(wrapper.vm.resolvedMa.flip_id).toBe('flip-2');
  });

  it('keeps Asana search results keyboard-selectable after using the shared search input', async () => {
    render({ ma: { ...employee(), asana_id: null } });
    wrapper.vm.expanded = true;
    wrapper.vm.view = 'links';
    wrapper.vm.showAsanaLinkForm = true;
    await wrapper.vm.$nextTick();
    mocks.api.get.mockResolvedValueOnce({ data: { success: true, data: [{ gid: '12345', name: 'Testtask' }] } });
    await wrapper.get('.search-group input.app-text-input').setValue('Testtask');
    await flushPromises();
    const result = wrapper.get('button.search-result-item');
    expect(result.attributes('aria-label')).toBe('Asana-Task Testtask verknüpfen');
    await result.trigger('click');
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/personal/mitarbeiter/employee-1', { asana_id: '12345' });
  });

  it('locks Asana linking while pending and preserves the selected GID', async () => {
    render({ ma: { ...employee(), asana_id: null } });
    wrapper.vm.expanded = true;
    wrapper.vm.view = 'links';
    await wrapper.vm.$nextTick();
    await wrapper.findAll('.asana-unlinked button').find(button => button.text().includes('Asana-Task verknüpfen')).trigger('click');
    const gid = wrapper.get('.asana-link-form input.app-text-input');
    expect(gid.attributes('id')).toBe(wrapper.get('.asana-link-form label').attributes('for'));
    await gid.setValue('1234567890123456');
    const pending = deferred();
    mocks.api.patch.mockReturnValueOnce(pending.promise);
    await wrapper.findAll('.input-group button').find(button => button.text().includes('Verknüpfen')).trigger('click');
    expect(gid.attributes('disabled')).toBeDefined();
    expect(wrapper.get('.form-actions button').attributes('disabled')).toBeDefined();
    await wrapper.vm.linkAsanaTaskById();
    expect(mocks.api.patch).toHaveBeenCalledTimes(1);
    pending.resolve({ data: { success: true } });
    await flushPromises();
    expect(wrapper.vm.resolvedMa.asana_id).toBe('1234567890123456');
  });

  it('guards raw-document loading and saving while keeping JSON editing labelled', async () => {
    render();
    const pendingLoad = deferred();
    mocks.api.get.mockReturnValueOnce(pendingLoad.promise);
    wrapper.vm.expanded = true;
    wrapper.vm.view = 'raw';
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.raw-actions button').find(button => button.text() === 'Speichern').attributes('disabled')).toBeDefined();
    pendingLoad.resolve({ data: { data: { _id: 'employee-1', vorname: 'Ada' } } });
    await flushPromises();
    const editor = wrapper.get('textarea[aria-label="Mitarbeiter-Rohdaten als JSON"]');
    expect(editor.element.value).toContain('employee-1');
    const pending = deferred();
    mocks.api.put.mockReturnValueOnce(pending.promise);
    await wrapper.findAll('.raw-actions button').find(button => button.text() === 'Speichern').trigger('click');
    expect(editor.attributes('disabled')).toBeDefined();
    await wrapper.vm.saveRawDocument();
    expect(mocks.api.put).toHaveBeenCalledTimes(1);
    pending.resolve({ data: { data: { _id: 'employee-1', vorname: 'Ada' } } });
    await flushPromises();
    expect(wrapper.get('.raw-success[role="status"]').text()).toContain('Gespeichert');
  });

  it('announces invalid raw JSON without sending an update', async () => {
    render();
    wrapper.vm.expanded = true;
    wrapper.vm.view = 'raw';
    wrapper.vm.rawLoaded = true;
    wrapper.vm.rawJson = '{invalid';
    await wrapper.vm.$nextTick();
    await wrapper.findAll('.raw-actions button').find(button => button.text() === 'Speichern').trigger('click');
    expect(wrapper.get('.raw-error[role="alert"]').text()).toContain('Ungültiges JSON');
    expect(wrapper.get('textarea[aria-label="Mitarbeiter-Rohdaten als JSON"]').attributes('aria-invalid')).toBe('true');
    expect(mocks.api.put).not.toHaveBeenCalled();
  });

  it('uses labelled shared header controls without toggling the card', async () => {
    render({ showClose: true });
    const close = wrapper.getComponent(AppIconButton);
    expect(close.props('label')).toBe('Schließen');
    await close.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.vm.expanded).toBe(false);

    await wrapper.setProps({ showClose: false });
    wrapper.vm.expanded = true;
    await wrapper.vm.$nextTick();
    const open = wrapper.getComponent(AppIconButton);
    expect(open.props('label')).toBe('Mitarbeiterprofil in Fenster öffnen');
    await open.trigger('click');
    expect(wrapper.emitted('open-profile-modal')?.[0]).toEqual(['employee-1']);
  });

  it('keeps the reactivation dialog open and non-dismissible while the request is pending', async () => {
    render();
    wrapper.vm.showReaktivierungModal = true;
    await wrapper.vm.$nextTick();
    const frame = wrapper.getComponent(ModalFrame);
    expect(frame.props()).toMatchObject({ title: 'Ada Test reaktivieren', layer: 'elevated' });
    expect(wrapper.get('[role="dialog"]').attributes('aria-labelledby')).toBe(wrapper.get('h3').attributes('id'));
    const pending = deferred();
    mocks.api.patch.mockReturnValueOnce(pending.promise);
    await wrapper.findAll('button').find(button => button.text().includes('Jetzt reaktivieren')).trigger('click');
    expect(frame.props()).toMatchObject({ showClose: false, closeOnBackdrop: false, closeOnEscape: false });
    frame.vm.$emit('close');
    await wrapper.vm.confirmReaktivierung();
    wrapper.vm.toggle();
    expect(mocks.api.patch).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.showReaktivierungModal).toBe(true);
    expect(wrapper.vm.expanded).toBe(false);
    pending.resolve({ data: { success: true } });
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/personal/mitarbeiter/employee-1', { isActive: true });
    expect(wrapper.emitted('reactivated')).toHaveLength(1);
    expect(wrapper.vm.showReaktivierungModal).toBe(false);
  });

  it('shows an inline error and permits retry when reactivation fails', async () => {
    render();
    wrapper.vm.showReaktivierungModal = true;
    mocks.api.patch.mockResolvedValueOnce({ data: { success: false } });
    await wrapper.vm.$nextTick();
    await wrapper.findAll('button').find(button => button.text().includes('Jetzt reaktivieren')).trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('erneut versuchen');
    expect(wrapper.emitted('reactivated')).toBeUndefined();
    expect(wrapper.vm.showReaktivierungModal).toBe(true);
    await wrapper.findAll('button').find(button => button.text().includes('Jetzt reaktivieren')).trigger('click');
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted('reactivated')).toHaveLength(1);
  });
});
