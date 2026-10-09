import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import PdfDocumentPreview from '../src/components/ui-elements/PdfDocumentPreview.vue';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(() => ({ promise: new Promise(() => {}), destroy: vi.fn() })),
}));

let wrapper;

afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
});

const render = props => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  wrapper = mount(PdfDocumentPreview, { props });
  return wrapper;
};

describe('PDF preview initial zoom', () => {
  it('starts at 50% and resets after changing the document', async () => {
    render({ blob: new Blob(['first']), initialZoom: 0.5 });
    const zoomButton = wrapper.get('button[aria-label="An Breite anpassen"]');
    expect(zoomButton.text()).toBe('50 %');
    await wrapper.get('button[aria-label="Vergrößern"]').trigger('click');
    expect(zoomButton.text()).toBe('75 %');
    await wrapper.setProps({ blob: new Blob(['second']) });
    expect(zoomButton.text()).toBe('50 %');
  });

  it('preserves the fit-to-width default for other viewers', () => {
    render({ blob: new Blob(['pdf']) });
    expect(wrapper.get('button[aria-label="An Breite anpassen"]').text()).toBe('100 %');
  });

  it('uses a scrollable continuous-page viewport without page navigation buttons', () => {
    render({ blob: new Blob(['pdf']) });
    expect(wrapper.get('.pdf-preview-viewport').classes()).toContain('pdf-preview-viewport');
    expect(wrapper.find('button[aria-label="Vorherige Seite"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="Nächste Seite"]').exists()).toBe(false);
  });
});
