import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import OrderDocuments from '../src/components/ui-elements/OrderDocuments.vue';

const mocks = vi.hoisted(() => ({ openDocument: vi.fn(), openDocumentPreview: vi.fn(), api: { post: vi.fn(), get: vi.fn() } }));

vi.mock('@/composables/useDocumentModals', () => ({ useDocumentModals: () => ({ openDocument: mocks.openDocument }) }));
vi.mock('@/composables/useDocumentPreviewModals', () => ({ useDocumentPreviewModals: () => ({ openDocumentPreview: mocks.openDocumentPreview }) }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));

const items = [
  { id: 'eventreport-report-1', kind: 'eventreport', recordId: 'report-1', category: 'EventReport', title: 'EventReport · Testleitung', teamLeader: 'Testleitung', status: 'Eingereicht', date: '2026-09-09', preview: 'pdf' },
  { id: 'signature-hours-1', kind: 'signature', recordId: 'hours-1', category: 'Stundenliste', title: 'Stundenliste', status: 'Ausgefüllt', filename: 'stundenliste.pdf', preview: 'url' },
];

describe('OrderDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.post.mockResolvedValue({ data: { success: true } });
    mocks.api.get.mockResolvedValue({ data: { documents: [] } });
  });

  it('opens Event Reports in DocumentCard and leaves other documents in the preview', async () => {
    const wrapper = mount(OrderDocuments, { props: { auftragNr: 2510171, items } });
    const buttons = wrapper.findAll('.order-documents__item');

    await buttons[0].trigger('click');
    expect(mocks.openDocument).toHaveBeenCalledWith({
      _id: 'report-1',
      docType: 'Event-Bericht',
      bezeichnung: 'EventReport · Testleitung',
      datum: '2026-09-09',
      status: 'Eingereicht',
      details: { _id: 'report-1', auftragnummer: '2510171', name_teamleiter: 'Testleitung' },
    });
    expect(mocks.openDocumentPreview).not.toHaveBeenCalled();

    await buttons[1].trigger('click');
    expect(mocks.openDocumentPreview).toHaveBeenCalledOnce();
  });

  it('uploads selected and dropped files as typeless Public Monitor documents', async () => {
    const wrapper = mount(OrderDocuments, { props: { auftragNr: 2510171, items } });
    expect(wrapper.find('ul > li:first-child').classes()).toContain('order-documents__upload-item');
    const selected = new File(['info'], 'einsatzinfo.pdf', { type: 'application/pdf' });
    const input = wrapper.find('.order-documents__upload-zone input');
    Object.defineProperty(input.element, 'files', { configurable: true, value: [selected] });
    await input.trigger('change');
    expect(mocks.api.post).toHaveBeenCalledOnce();
    let [url, form] = mocks.api.post.mock.calls[0];
    expect(url).toBe('/api/auftraege/2510171/einsatzdokumente');
    expect(form.get('file')).toBe(selected);
    expect(form.get('scope')).toBe('public');
    expect(form.get('publicRecipientFilter')).toBe('false');
    expect(form.has('type')).toBe(false);

    const dropped = new File(['info'], 'einsatzinfo-neu.pdf', { type: 'application/pdf' });
    await wrapper.find('.order-documents__upload-zone').trigger('drop', { dataTransfer: { files: [dropped] } });
    expect(mocks.api.post).toHaveBeenCalledTimes(2);
    [, form] = mocks.api.post.mock.calls[1];
    expect(form.get('file')).toBe(dropped);
    expect(form.get('scope')).toBe('public');
    expect(form.get('publicRecipientFilter')).toBe('false');
    expect(form.has('type')).toBe(false);
  });

  it('reloads uploaded documents and previews them with the correct order and filename', async () => {
    const document = { id: 'upload-upload-1', kind: 'upload', recordId: 'upload-1', category: 'Weitere',
      title: 'Stundenliste Oktoberfest', filename: 'original.pdf', mimeType: 'application/pdf', status: 'Einsatznachweis', preview: 'url' };
    mocks.api.get.mockResolvedValueOnce({ data: { documents: [] } })
      .mockResolvedValueOnce({ data: { documents: [document] } })
      .mockResolvedValueOnce({ data: { url: '/signed-upload.pdf' } });
    const wrapper = mount(OrderDocuments, { props: { auftragNr: 2510171 } });
    await flushPromises();
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [new File(['pdf'], 'original.pdf')] });
    await input.trigger('change'); await flushPromises();
    expect(mocks.api.get.mock.calls.filter(([url]) => url.endsWith('/documents'))).toHaveLength(2);
    expect(wrapper.get('.order-documents__item').text()).toContain(document.title);
    await wrapper.get('.order-documents__item').trigger('click');
    const source = mocks.openDocumentPreview.mock.calls[0][0];
    expect(source.filename).toBe('original.pdf');
    expect(await source.resolveUrl({ download: true })).toBe('/signed-upload.pdf');
    expect(mocks.api.get).toHaveBeenLastCalledWith('/api/working-times/orders/2510171/documents/upload/upload-1/preview',
      { signal: undefined, params: { attachmentId: undefined, download: true } });
    wrapper.unmount();
  });
});