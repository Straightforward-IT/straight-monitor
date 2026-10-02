import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import SignaturNeuModal from '../src/components/Modals/SignaturNeuModal.vue';
import SignaturTypAnlegenModal from '../src/components/SignaturTypAnlegenModal.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';
import { useSignaturModal } from '../src/stores/signaturModal';
import { useSignaturBuilder } from '../src/stores/signaturBuilder';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
  auth: { user: { roles: ['ADMIN'], locationV2: 'hh' } },
  cache: { kunden: [{ _id: 'kunde', kuerzel: 'ACME', kundName: 'Acme' }], mitarbeiter: [], loadKunden: vi.fn(), loadMitarbeiter: vi.fn() },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => mocks.cache }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));

const typ = { _id: 'typ', key: 'vereinbarung', label: 'Vereinbarung', linkedTo: 'Both' };
const templates = [{ id: 42, name: 'Vertrag', defaultTypId: 'typ', submitters: [{ name: 'Partei' }] }];
const signer = { role: 'Partei', name: 'Erika', email: 'erika@example.com', embedded: false };
let wrapper;
let store;
let pinia;
const stubs = {
  'font-awesome-icon': true,
  CustomTooltip: { template: '<div><slot /></div>' },
  MinimizableRegion: { template: '<div><slot :minimized="false" /></div>' },
  MinimizeButton: true,
  KundeSearch: true,
  ContactSearchPicker: { props: ['modelValue', 'roleName'], emits: ['update:modelValue', 'selected', 'remove'], template: '<div class="picker-stub" />' },
  DocuSealSigningModal: { props: ['title', 'signers'], template: '<div class="signing-session" />' },
};
const byText = (scope, text) => scope.findAll('button').find(button => button.text().trim() === text);
const dialog = () => new DOMWrapper(document.querySelector('[role="dialog"]'));
const footer = () => dialog().get('.sig-footer');
const selectStep = async index => { await dialog().findAll('.sig-step')[index].trigger('click'); await flushPromises(); };
const draftData = () => ({ name: 'Entwurf', locationV2: 'hh', typ, docusealTemplateId: 42, submitters: [{ ...signer }] });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.resetAllMocks();
  pinia = createPinia();
  mocks.auth.user = { roles: ['ADMIN'], locationV2: 'hh' };
  mocks.api.get.mockImplementation(url => {
    if (url === '/api/signatur-typen') return Promise.resolve({ data: [typ, { _id: 'kunden-typ', key: 'kunde', label: 'Kundenvertrag', linkedTo: 'Kunde' }] });
    if (url === '/api/locations') return Promise.resolve({ data: [{ _id: 'hh', nameFull: 'Hamburg' }] });
    if (url === '/api/docuseal/templates') return Promise.resolve({ data: templates });
    if (url === '/api/graph/contacts') return Promise.resolve({ data: { contacts: [{ displayName: 'Empfänger', companyName: 'ACME', emailAddresses: [{ address: 'kontakt@example.com' }] }] } });
    if (url === '/api/signaturen/folge-defaults') return Promise.resolve({ data: {} });
    throw new Error(`Unexpected request: ${url}`);
  });
  mocks.api.post.mockResolvedValue({ data: { _id: 'vorgang' } });
  mocks.api.patch.mockResolvedValue({ data: { _id: 'draft' } });
  mocks.api.put.mockResolvedValue({ data: {} });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.useRealTimers();
});
async function render(context = {}, callback = null) {
  wrapper = mount(SignaturNeuModal, { attachTo: document.body, global: { plugins: [pinia], stubs } });
  store = useSignaturModal(pinia);
  store.openModal(context, callback);
  await flushPromises();
}
async function renderType() {
  wrapper = mount(SignaturTypAnlegenModal, { attachTo: document.body, props: { modelValue: false }, global: { stubs } });
  await wrapper.setProps({ modelValue: true });
}

describe('signature wizard shared-control migration', () => {
  it('keeps prerequisite gates and skips disallowed link modes during keyboard selection', async () => {
    await render();
    const modal = dialog();
    expect(modal.attributes('aria-labelledby')).toBe(modal.get('h2').attributes('id'));
    expect(modal.findAll('.sig-step').map(step => step.attributes('disabled') !== undefined)).toEqual([false, true, true, true]);
    expect(byText(footer(), 'Weiter').attributes('disabled')).toBeDefined();
    await modal.get('#sig-name').setValue('Vertrag');
    await modal.findAll('.sig-type-card').find(card => card.get('.sig-type-label').text() === 'Kundenvertrag').trigger('click');
    expect(byText(footer(), 'Weiter').attributes('disabled')).toBeUndefined();
    await byText(footer(), 'Weiter').trigger('click');
    const choices = modal.findAll('[role="radio"]');
    expect(choices.map(choice => choice.attributes('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(choices[1].attributes('disabled')).toBeDefined();
    expect(byText(footer(), 'Weiter').attributes('disabled')).toBeDefined();
    await choices[0].trigger('keydown', { key: 'ArrowRight' });
    expect(choices[2].attributes('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(choices[2].element);
    expect(byText(footer(), 'Weiter').attributes('disabled')).toBeUndefined();
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it('preserves template selection and builder context, and blocks a missing signer email', async () => {
    await render({ name: 'Vertrag', typKey: 'vereinbarung', submitters: [{ ...signer, email: '' }] });
    await dialog().get('.sig-tpl-chip').trigger('click');
    expect(dialog().get('.sig-tpl-chip').attributes('aria-pressed')).toBe('true');
    await selectStep(2);
    await byText(dialog(), 'Bearbeiten').trigger('click');
    expect(useSignaturBuilder(pinia).templateId).toBe(42);
    expect(useSignaturBuilder(pinia).name).toBe('Vertrag');
    await selectStep(3);
    expect(byText(footer(), 'Signatur erstellen').attributes('disabled')).toBeDefined();
    expect(footer().text()).toContain('muss eine E-Mail-Adresse haben');
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it('creates a generic signature once and keeps callback and embedded-signing handoff', async () => {
    const callback = vi.fn();
    await render({ name: ' Vertrag ', typKey: 'vereinbarung', templateId: 42, submitters: [{ ...signer }] }, callback);
    await selectStep(3);
    const pending = deferred();
    mocks.api.post.mockReturnValueOnce(pending.promise);
    await byText(footer(), 'Signatur erstellen').trigger('click');
    expect(byText(footer(), 'Erstelle…').attributes('aria-busy')).toBe('true');
    expect(byText(footer(), 'Als Entwurf speichern').attributes('disabled')).toBeDefined();
    await dialog().get('button[aria-label="Schließen"]').trigger('click');
    await byText(footer(), 'Erstelle…').trigger('click');
    expect(store.open).toBe(true);
    expect(mocks.api.post).toHaveBeenCalledTimes(1);
    expect(mocks.api.post).toHaveBeenCalledWith('/api/signaturen', expect.objectContaining({
      name: 'Vertrag', typId: 'typ', locationId: 'hh', templateId: 42,
      submitters: [signer], folgeaktionen: expect.objectContaining({ ausliefernAn: [{ displayName: 'Erika', email: 'erika@example.com' }] }),
    }));
    const response = { _id: 'vorgang', name: 'Vertrag', submitters: [{ ...signer, embedded: true, embedSrc: 'https://example.com/sign', status: 'pending' }] };
    pending.resolve({ data: response });
    await flushPromises();
    expect(callback).toHaveBeenCalledWith(response);
    expect(store.open).toBe(false);
    expect(wrapper.getComponent(stubs.DocuSealSigningModal).props('signers')).toEqual([expect.objectContaining({ src: 'https://example.com/sign', name: 'Erika' })]);
  });

  it('retains an existing draft on submit failure and retries via PATCH with submit true', async () => {
    await render({ draftId: 'draft', draftData: draftData() });
    await selectStep(3);
    mocks.api.patch.mockRejectedValueOnce({ response: { data: { message: 'Bitte erneut versuchen' } } });
    await byText(footer(), 'Signatur erstellen').trigger('click');
    await flushPromises();
    expect(store.open).toBe(true);
    expect(footer().text()).toContain('Bitte erneut versuchen');
    expect(dialog().get('#sig-name').element.value).toBe('Entwurf');
    expect(mocks.api.post).not.toHaveBeenCalled();
    await byText(footer(), 'Signatur erstellen').trigger('click');
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenLastCalledWith('/api/signaturen/draft', expect.objectContaining({ submit: true, templateId: 42, submitters: [signer] }));
    expect(store.open).toBe(false);
  });

  it('saves existing drafts without promoting them or notifying the submission callback', async () => {
    const callback = vi.fn();
    const data = draftData();
    await render({ draftId: 'draft', draftData: data }, callback);
    await dialog().get('#sig-name').setValue('Überarbeiteter Entwurf');
    mocks.api.patch.mockRejectedValueOnce({ response: { data: { message: 'Entwurf konnte nicht gespeichert werden' } } });
    await byText(footer(), 'Änderungen speichern').trigger('click');
    await flushPromises();
    expect(store.open).toBe(true);
    expect(footer().text()).toContain('Entwurf konnte nicht gespeichert werden');
    mocks.api.patch.mockResolvedValueOnce({ data: { name: 'Überarbeiteter Entwurf' } });
    const save = byText(footer(), 'Änderungen speichern');
    save.element.click();
    save.element.click();
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledTimes(2);
    expect(mocks.api.patch).toHaveBeenLastCalledWith('/api/signaturen/draft', expect.objectContaining({ name: 'Überarbeiteter Entwurf', draft: true, templateId: 42 }));
    expect(data.name).toBe('Überarbeiteter Entwurf');
    expect(callback).not.toHaveBeenCalled();
    expect(store.open).toBe(false);
  });

  it('closes an empty wizard by Escape without a request and preserves frame/dock configuration', async () => {
    await render();
    const modal = dialog();
    expect(modal.element.style.getPropertyValue('--mf-body-padding')).toBe('0');
    expect(wrapper.getComponent(ModalFrame).props('minimizable')).toBe(true);
    expect(wrapper.getComponent(ModalFrame).props('minimizeId')).toBe('signature-new');
    // Minimizable frames intentionally keep the page scrollable while docked.
    expect(document.body.style.overflow).toBe('');
    Object.defineProperty(document.querySelector('.mf-overlay'), 'getClientRects', { value: () => [{}] });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(store.open).toBe(false);
    expect(mocks.api.post).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps the custom generated-document endpoint, locked fields, and additional invitation recipients', async () => {
    await render({
      locked: true, customEndpoint: '/api/docuseal/stundenliste/123', draftId: 'generated',
      typKey: 'stundenliste',
      draftData: { ...draftData(), typKey: 'stundenliste', docusealTemplateId: null, kunde: 'kunde', entleiherInvitationRecipients: [{ name: 'Team', email: 'team@example.com' }] },
    });
    expect(dialog().find('[role="radiogroup"]').exists()).toBe(false);
    expect(dialog().get('#sig-name').attributes('readonly')).toBeDefined();
    await selectStep(3);
    await byText(footer(), 'Signatur erstellen').trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/docuseal/stundenliste/123', expect.objectContaining({
      draftId: 'generated', kundeId: 'kunde', submitters: [signer],
      entleiherInvitationRecipients: [{ name: 'Team', email: 'team@example.com', embedded: false }],
    }));
    expect(mocks.api.patch).not.toHaveBeenCalled();
  });

  it('keeps the save/discard boundary and prevents closing or parallel actions while saving a new draft', async () => {
    const callback = vi.fn();
    await render({ name: 'Vertrag', typKey: 'vereinbarung' }, callback);
    await byText(footer(), 'Abbrechen').trigger('click');
    const confirmation = dialog().get('.sig-close-confirm');
    expect(store.open).toBe(true);
    await byText(confirmation, 'Weiter bearbeiten').trigger('click');
    expect(dialog().find('.sig-close-confirm').exists()).toBe(false);
    await dialog().get('button[aria-label="Schließen"]').trigger('click');
    const pending = deferred();
    mocks.api.post.mockReturnValueOnce(pending.promise);
    await byText(dialog().get('.sig-close-confirm'), 'Als Entwurf speichern').trigger('click');
    expect(byText(dialog().get('.sig-close-confirm'), 'Verwerfen').attributes('disabled')).toBeDefined();
    await dialog().get('button[aria-label="Schließen"]').trigger('click');
    expect(store.open).toBe(true);
    expect(mocks.api.post).toHaveBeenCalledWith('/api/signaturen', expect.objectContaining({ draft: true, templateId: null }));
    pending.resolve({ data: {} });
    await flushPromises();
    expect(store.open).toBe(false);
    expect(callback).not.toHaveBeenCalled();
    store.openModal({ name: 'Anderer Entwurf', typKey: 'vereinbarung' });
    await flushPromises();
    await byText(footer(), 'Abbrechen').trigger('click');
    await byText(dialog().get('.sig-close-confirm'), 'Verwerfen').trigger('click');
    expect(store.open).toBe(false);
    expect(mocks.api.post).toHaveBeenCalledTimes(1);
  });

  it('uses labelled removal controls and persists customer delivery defaults without submitting a signature', async () => {
    await render({ name: 'Vertrag', typKey: 'vereinbarung', kundeId: 'kunde', submitters: [{ ...signer }] });
    await selectStep(3);
    const chip = dialog().get('.sig-follower-chip');
    expect(chip.attributes('aria-pressed')).toBe('false');
    await chip.trigger('click');
    expect(chip.attributes('aria-pressed')).toBe('true');
    await dialog().get('button[aria-label="Empfänger Empfänger entfernen"]').trigger('click');
    expect(chip.attributes('aria-pressed')).toBe('false');
    const pending = deferred();
    mocks.api.put.mockReturnValueOnce(pending.promise);
    await byText(dialog(), 'Als Standard speichern').trigger('click');
    expect(byText(dialog(), 'Als Standard speichern').attributes('aria-busy')).toBe('true');
    expect(mocks.api.put).toHaveBeenCalledWith('/api/signaturen/folge-defaults', expect.objectContaining({ kundeId: 'kunde', typId: 'typ' }));
    pending.resolve({ data: {} });
    await flushPromises();
    expect(mocks.api.post).not.toHaveBeenCalled();
    await selectStep(1);
    await dialog().get('button[aria-label="Verknüpfung mit Acme entfernen"]').trigger('click');
    expect(byText(footer(), 'Weiter').attributes('disabled')).toBeDefined();
  });

  it('retains Asana action building/removal and sends remaining actions only with the signature', async () => {
    await render({ name: 'Vertrag', typKey: 'vereinbarung', submitters: [{ ...signer }] });
    await selectStep(3);
    vi.useFakeTimers();
    mocks.api.get.mockImplementation(url => {
      if (url === '/api/asana/tasks/search') return Promise.resolve({ data: { data: [{ gid: 'task', name: 'Vertrag prüfen' }] } });
      throw new Error(`Unexpected request: ${url}`);
    });
    await byText(dialog(), 'Asana-Aktion hinzufügen').trigger('click');
    await dialog().get('input[placeholder="Asana-Task suchen…"]').setValue('Vertrag');
    await vi.advanceTimersByTimeAsync(350);
    await flushPromises();
    await dialog().get('.sig-asana-builder .sig-typeahead-item').trigger('click');
    await dialog().get('.sig-select--inline').setValue('comment');
    await dialog().get('textarea').setValue('Freigegeben');
    await byText(dialog(), 'Aktion hinzufügen').trigger('click');
    const remove = dialog().get('button[aria-label="Kommentieren für Vertrag prüfen entfernen"]');
    expect(dialog().get('.sig-asana-comment-preview').text()).toContain('Freigegeben');
    expect(mocks.api.post).not.toHaveBeenCalled();
    await remove.trigger('click');
    expect(dialog().find('.sig-asana-item').exists()).toBe(false);
    await byText(footer(), 'Signatur erstellen').trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/signaturen', expect.objectContaining({ folgeaktionen: expect.objectContaining({ asanaActions: [] }) }));
  });
});

describe('signature type shared controls', () => {
  it('keeps automatic/manual keys, keyboard choices and numeric order in the create payload', async () => {
    await renderType();
    expect(byText(dialog(), 'Anlegen').attributes('disabled')).toBeDefined();
    await dialog().get('#sigt-label-input').setValue(' Grüße & Vertrag ');
    expect(dialog().get('#sigt-key-input').element.value).toBe('gru-e-vertrag');
    await dialog().get('#sigt-key-input').setValue('Eigener Schlüssel');
    await dialog().get('#sigt-label-input').setValue(' Neuer Typ ');
    expect(dialog().get('#sigt-key-input').element.value).toBe('Eigener Schlüssel');
    await dialog().get('#sigt-order-input').setValue('3');
    const choices = dialog().findAll('[role="radio"]');
    await choices[0].trigger('keydown', { key: 'End' });
    expect(choices[3].attributes('aria-checked')).toBe('true');
    const pending = deferred();
    mocks.api.post.mockReturnValueOnce(pending.promise);
    await byText(dialog(), 'Anlegen').trigger('click');
    expect(byText(dialog(), 'Anlegen').attributes('aria-busy')).toBe('true');
    await dialog().get('button[aria-label="Schließen"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/signatur-typen', { label: 'Neuer Typ', key: 'eigener-schlussel', linkedTo: 'None', order: 3 });
    pending.resolve({ data: { ...typ, label: 'Neuer Typ' } });
    await flushPromises();
    expect(wrapper.emitted('created')).toEqual([[{ ...typ, label: 'Neuer Typ' }]]);
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('retains a failed type draft and resets the form on reopening', async () => {
    await renderType();
    await dialog().get('#sigt-label-input').setValue('Vertrag');
    mocks.api.post.mockRejectedValueOnce({ response: { data: { message: 'Schlüssel schon vorhanden' } } });
    await byText(dialog(), 'Anlegen').trigger('click');
    await flushPromises();
    expect(dialog().get('.sigt-error').text()).toContain('Schlüssel schon vorhanden');
    expect(dialog().get('#sigt-label-input').element.value).toBe('Vertrag');
    expect(byText(dialog(), 'Anlegen').attributes('disabled')).toBeUndefined();
    await byText(dialog(), 'Abbrechen').trigger('click');
    expect(wrapper.emitted('created')).toBeUndefined();
    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    expect(dialog().get('#sigt-label-input').element.value).toBe('');
    expect(dialog().get('[role="radio"]').attributes('aria-checked')).toBe('true');
    expect(dialog().find('.sigt-error').exists()).toBe(false);
  });
});
