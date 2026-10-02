import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import BewerberManagementTab from '../src/components/BewerberManagementTab.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
const documents = [{
  _id: 'doc-1', name: 'Anhang.pdf', contentType: 'application/pdf', size: 1024,
  locationV2: { _id: 'hh', nameFull: 'Hamburg', color: '#ffeeee' },
}];
const effective = () => ({
  source: 'global', templateId: 'template-1',
  template: { subjectTemplate: 'Einladung', htmlTemplate: '<p>Hallo</p>' },
  placeholders: { vorname: 'Vorname des Bewerbers' },
});
let wrapper;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockImplementation(url => {
    if (url.endsWith('/download')) return Promise.resolve({ data: { data: { url: 'https://example.com/file.pdf' } } });
    if (url.endsWith('/email-documents')) return Promise.resolve({ data: { data: documents } });
    if (url.endsWith('/effective')) return Promise.resolve({ data: { data: effective() } });
    throw new Error(`Unexpected request: ${url}`);
  });
  mocks.api.delete.mockResolvedValue({ data: {} });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});
async function render() {
  wrapper = mount(BewerberManagementTab, {
    attachTo: document.body,
    props: { locations: [{ _id: 'hh', nameFull: 'Hamburg' }] },
    global: { stubs: { 'font-awesome-icon': true, CustomTooltip: { template: '<div><slot /></div>' } } },
  });
  await flushPromises();
}
const dialog = className => new DOMWrapper(document.querySelector(`.${className}`));
const byText = (scope, text) => scope.findAll('button').find(button => button.text().trim() === text);
async function templates() {
  await wrapper.findAll('[role="radio"]')[1].trigger('click');
}
async function selectFile(input, file) {
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
}

describe('applicant administration shared controls', () => {
  it('switches workspaces by keyboard and retains an unsaved template while filtering documents', async () => {
    await render();
    const choices = wrapper.findAll('[role="radio"]');
    expect(choices.map(choice => choice.attributes('tabindex'))).toEqual(['0', '-1']);
    await choices[0].trigger('keydown', { key: 'ArrowRight' });
    expect(document.activeElement).toBe(choices[1].element);
    await wrapper.get('.template-editor input').setValue('Entwurf');
    await choices[1].trigger('keydown', { key: 'ArrowLeft' });
    await wrapper.get('input[type="search"]').setValue(' kein Treffer ');
    expect(wrapper.get('.empty').text()).toContain('Keine passenden Dateien');
    await wrapper.get('input[type="search"]').setValue('Anhang');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    await choices[0].trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.get('.template-editor input').element.value).toBe('Entwurf');
    expect(mocks.api.put).not.toHaveBeenCalled();
  });

  it('opens a native file picker from the shared button and uploads to the selected location', async () => {
    await render();
    const fileInput = wrapper.get('input[aria-label="Datei für Anhangsbibliothek auswählen"]');
    const click = vi.spyOn(fileInput.element, 'click').mockImplementation(() => {});
    const upload = byText(wrapper, 'Datei hochladen');
    await upload.trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
    await wrapper.get('.filters select').setValue('hh');
    let resolve;
    mocks.api.post.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const file = new File(['PDF fixture'], 'Anhang.pdf', { type: 'application/pdf' });
    await selectFile(fileInput, file);
    expect(upload.attributes('disabled')).toBeDefined();
    expect(fileInput.attributes('disabled')).toBeDefined();
    const [url, payload] = mocks.api.post.mock.calls[0];
    expect(url).toBe('/api/bewerber/admin/email-documents');
    expect(payload.get('file')).toBe(file);
    expect(payload.get('locationId')).toBe('hh');
    resolve({ data: {} });
    await flushPromises();
    expect(upload.attributes('disabled')).toBeUndefined();
    expect(fileInput.element.value).toBe('');
    expect(mocks.api.get.mock.calls.filter(([request]) => request.endsWith('/email-documents'))).toHaveLength(2);
  });

  it('associates the dialog footer with its form, validates the name, and preserves replacement payloads on retry', async () => {
    await render();
    await wrapper.get('button[aria-label="Datei Anhang.pdf bearbeiten oder ersetzen"]').trigger('click');
    const modal = dialog('document-edit-modal');
    expect(document.body.style.overflow).toBe('hidden');
    const save = modal.get('button[type="submit"]');
    const form = modal.get('form');
    expect(save.element.form).toBe(form.element);
    expect(save.attributes('form')).toBe(form.attributes('id'));
    const name = modal.get('input[required]');
    await name.setValue('');
    save.element.click();
    expect(mocks.api.patch).not.toHaveBeenCalled();
    await name.setValue(' Neuer Anhang ');
    await modal.get('select').setValue('');
    const file = new File(['Replacement'], 'Neu.pdf', { type: 'application/pdf' });
    await selectFile(modal.get('input[type="file"]'), file);
    let reject;
    mocks.api.patch.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    save.element.click();
    await flushPromises();
    expect(save.attributes('aria-busy')).toBe('true');
    save.element.click();
    expect(mocks.api.patch).toHaveBeenCalledTimes(1);
    const [url, payload] = mocks.api.patch.mock.calls[0];
    expect(url).toBe('/api/bewerber/admin/email-documents/doc-1');
    expect(payload.get('name')).toBe('Neuer Anhang');
    expect(payload.get('locationId')).toBe('');
    expect(payload.get('file')).toBe(file);
    reject({ response: { data: { message: 'Datei konnte nicht gespeichert werden' } } });
    await flushPromises();
    expect(modal.get('.error').text()).toContain('nicht gespeichert');
    expect(name.element.value.trim()).toBe('Neuer Anhang');
    expect(save.attributes('disabled')).toBeUndefined();
    mocks.api.patch.mockResolvedValueOnce({ data: {} });
    save.element.click();
    await flushPromises();
    expect(document.querySelector('.document-edit-modal')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(mocks.api.patch.mock.calls[1][1].get('file')).toBe(file);
  });

  it('closes through the frame and Escape without saving a draft', async () => {
    await render();
    const edit = wrapper.get('button[aria-label="Datei Anhang.pdf bearbeiten oder ersetzen"]');
    await edit.trigger('click');
    await dialog('document-edit-modal').get('input[required]').setValue('Nicht speichern');
    await dialog('document-edit-modal').get('button[aria-label="Schließen"]').trigger('click');
    expect(document.querySelector('.document-edit-modal')).toBeNull();
    await edit.trigger('click');
    expect(dialog('document-edit-modal').get('input[required]').element.value).toBe('Anhang.pdf');
    vi.spyOn(document.querySelector('.mf-overlay'), 'getClientRects').mockReturnValue([{}]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(document.querySelector('.document-edit-modal')).toBeNull();
    expect(mocks.api.patch).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
  });

  it('downloads and retains the confirmation boundary before deleting a document', async () => {
    await render();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await wrapper.get('button[aria-label="Datei Anhang.pdf herunterladen"]').trigger('click');
    await flushPromises();
    expect(open).toHaveBeenCalledWith('https://example.com/file.pdf', '_blank', 'noopener,noreferrer');
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const remove = wrapper.get('button[aria-label="Datei Anhang.pdf löschen"]');
    await remove.trigger('click');
    expect(mocks.api.delete).not.toHaveBeenCalled();
    await remove.trigger('click');
    await flushPromises();
    expect(mocks.api.delete).toHaveBeenCalledWith('/api/bewerber/admin/email-documents/doc-1');
  });

  it('inserts placeholders without submitting and shows only the server preview in a sandboxed dialog', async () => {
    await render();
    await templates();
    await wrapper.get('.placeholder-action').trigger('click');
    expect(wrapper.get('textarea').element.value).toBe('<p>Hallo</p> {{vorname}}');
    expect(mocks.api.put).not.toHaveBeenCalled();
    const sanitizedHtml = '<p>Servervorschau</p>';
    mocks.api.post.mockResolvedValueOnce({ data: { data: { subject: 'Serverbetreff', html: sanitizedHtml } } });
    byText(wrapper, 'Vorschau').element.click();
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/bewerber/admin/email-templates/preview', {
      subjectTemplate: 'Einladung', htmlTemplate: '<p>Hallo</p> {{vorname}}', locationName: 'Global',
    });
    const preview = dialog('bewerber-template-preview-modal');
    expect(preview.get('h3').text()).toBe('Serverbetreff');
    expect(preview.get('iframe').attributes('sandbox')).toBe('');
    expect(preview.get('iframe').attributes('srcdoc')).toBe(sanitizedHtml);
    expect(mocks.api.put).not.toHaveBeenCalled();
    await preview.get('button[aria-label="Schließen"]').trigger('click');
    expect(document.querySelector('.bewerber-template-preview-modal')).toBeNull();
  });

  it('preserves inherited-template reset rules and submits the selected scope/type only once', async () => {
    await render();
    await templates();
    const selectors = wrapper.findAll('.template-selectors select');
    expect(byText(wrapper, 'Auf Standard zurücksetzen')).toBeDefined();
    await selectors[0].setValue('hh');
    await flushPromises();
    expect(byText(wrapper, 'Auf Standard zurücksetzen')).toBeUndefined();
    await selectors[1].setValue('vertrag_service');
    await flushPromises();
    expect(mocks.api.get).toHaveBeenLastCalledWith('/api/bewerber/admin/email-templates/effective', { params: { locationId: 'hh', type: 'vertrag_service' } });
    await wrapper.get('.template-editor input').setValue('Neuer Betreff');
    let resolve;
    mocks.api.put.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const save = wrapper.get('.template-editor button[type="submit"]');
    save.element.click();
    await flushPromises();
    expect(save.attributes('disabled')).toBeDefined();
    save.element.click();
    expect(mocks.api.put).toHaveBeenCalledTimes(1);
    expect(mocks.api.put).toHaveBeenCalledWith('/api/bewerber/admin/email-templates', {
      locationId: 'hh', type: 'vertrag_service', subjectTemplate: 'Neuer Betreff', htmlTemplate: '<p>Hallo</p>',
    });
    resolve({ data: {} });
    await flushPromises();
    await wrapper.findAll('.template-selectors select')[0].setValue('');
    await flushPromises();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await byText(wrapper, 'Auf Standard zurücksetzen').trigger('click');
    expect(mocks.api.delete).not.toHaveBeenCalled();
    await byText(wrapper, 'Auf Standard zurücksetzen').trigger('click');
    await flushPromises();
    expect(mocks.api.delete).toHaveBeenCalledWith('/api/bewerber/admin/email-templates/template-1');
  });
});
