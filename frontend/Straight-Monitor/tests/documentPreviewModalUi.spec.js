import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { Blob as NodeBlob, Buffer } from 'node:buffer';
import * as XLSX from 'xlsx';
import DocumentPreviewModal from '../src/components/Modals/DocumentPreviewModal.vue';

vi.mock('../src/components/ui-elements/PdfDocumentPreview.vue', () => ({
  __esModule: true,
  default: {
    name: 'PdfDocumentPreview',
    props: ['blob', 'initialZoom'],
    template: '<div class="pdf-preview-stub"/>',
  },
}));

const frameStub = {
  name: 'ModalFrame',
  props: ['title', 'closeOnEscape'],
  template: '<div role="dialog"><slot name="actions"/><slot/></div>',
};
const menuStub = {
  name: 'ContextMenu',
  props: ['anchor', 'options'],
  template: '<div role="menu"/>',
};

let wrapper;
const render = props => {
  wrapper = mount(DocumentPreviewModal, {
    attachTo: document.body,
    props,
    global: { stubs: { ModalFrame: frameStub, ContextMenu: menuStub, FontAwesomeIcon: true } },
  });
  return wrapper;
};

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DocumentPreviewModal shared controls', () => {
  it('opens and reopens PDFs with a 50% initial zoom', async () => {
    vi.stubGlobal('URL', Object.assign(class extends URL {}, URL, {
      createObjectURL: vi.fn(() => 'blob:https://example.com/preview'),
      revokeObjectURL: vi.fn(),
    }));
    const loadBlob = vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    render({ filename: 'dokument.pdf', loadBlob });
    await flushPromises();
    expect(wrapper.getComponent({ name: 'PdfDocumentPreview' }).props('initialZoom')).toBe(0.5);
    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    await flushPromises();
    expect(wrapper.getComponent({ name: 'PdfDocumentPreview' }).props('initialZoom')).toBe(0.5);
    expect(loadBlob).toHaveBeenCalledTimes(2);
  });

  it('requests 50% zoom in the native PDF fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render({ filename: 'dokument.pdf', url: 'https://example.com/dokument.pdf#zoom=100' });
    await flushPromises();
    expect(wrapper.get('iframe').attributes('src')).toBe('https://example.com/dokument.pdf#zoom=50');
  });

  it('uses shared fallback actions and anchors the menu to its icon button', async () => {
    render({ filename: 'unbekannt.bin', url: 'https://example.com/unbekannt.bin' });
    await flushPromises();
    const menuButton = wrapper.get('button[aria-label="Dokumentaktionen"]');
    expect(menuButton.classes()).toContain('app-button');
    expect(wrapper.findAll('.document-preview-fallback-actions button').map(button => button.text())).toEqual([
      'Herunterladen', 'In neuem Tab öffnen',
    ]);
    expect(wrapper.findAll('.document-preview-fallback-actions button').every(button => button.classes().includes('app-button'))).toBe(true);
    await menuButton.trigger('click');
    expect(wrapper.getComponent({ name: 'ContextMenu' }).props('anchor')).toBe(menuButton.element);
    expect(menuButton.attributes('aria-expanded')).toBe('true');
    expect(menuButton.attributes('aria-pressed')).toBeUndefined();
  });

  it('retries a failed preview with a shared button', async () => {
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('URL', Object.assign(class extends URL {}, URL, {
      createObjectURL: vi.fn(() => 'blob:https://example.com/preview'),
      revokeObjectURL: vi.fn(),
    }));
    const loadBlob = vi.fn()
      .mockRejectedValueOnce(new Error('Temporär nicht verfügbar'))
      .mockResolvedValueOnce(new Blob(['Hallo'], { type: 'text/plain' }));
    render({ filename: 'hinweis.txt', loadBlob });
    await flushPromises();
    const retryButton = wrapper.get('.document-preview-state button');
    expect(retryButton.classes()).toContain('app-button');
    await retryButton.trigger('click');
    await vi.waitFor(() => expect(wrapper.get('.document-preview-text pre').text()).toBe('Hallo'));
    expect(loadBlob).toHaveBeenCalledTimes(2);
  });

  it('keeps workbook tabs linked and navigable with Arrow, Home and End', async () => {
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('URL', Object.assign(class extends URL {}, URL, {
      createObjectURL: vi.fn(() => 'blob:https://example.com/book'),
      revokeObjectURL: vi.fn(),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['A']]), 'Erstes');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['B']]), 'Zweites');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const binary = Buffer.from(new Uint8Array(bytes));
    const loadBlob = vi.fn().mockResolvedValue(new Blob([binary], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    render({ filename: 'buch.xlsx', loadBlob });
    await vi.waitFor(() => expect(wrapper.findAll('[role="tab"]')).toHaveLength(2));
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.every(tab => tab.classes().includes('app-button'))).toBe(true);
    expect(tabs[0].attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(tabs[0].attributes('id'));
    await tabs[0].trigger('keydown', { key: 'ArrowRight' });
    expect(tabs[1].attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(tabs[1].attributes('id'));
    await tabs[1].trigger('keydown', { key: 'Home' });
    expect(tabs[0].attributes('aria-selected')).toBe('true');
    await tabs[0].trigger('keydown', { key: 'End' });
    expect(tabs[1].attributes('aria-selected')).toBe('true');
  });
});
