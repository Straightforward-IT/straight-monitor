import { afterEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import DocumentCard from '../src/components/Modals/DocumentCard.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  loadDocuments: vi.fn(),
}));

vi.mock('@bleck-it/vue-modal-dock', () => ({ useCurrentDockedModal: () => null }));
vi.mock('@/stores/theme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/stores/dataCache', () => ({
  useDataCache: () => ({
    auftraege: [], kunden: [], loadAuftraege: vi.fn(), loadKunden: vi.fn(), loadDocuments: mocks.loadDocuments,
  }),
}));
vi.mock('@/composables/useCustomerModals', () => ({ useCustomerModals: () => ({ openCustomer: vi.fn() }) }));
vi.mock('@/utils/api', () => ({ default: { post: mocks.post, get: mocks.get } }));

const frameStub = {
  name: 'ModalFrame',
  props: ['title', 'showClose', 'closeOnBackdrop', 'closeOnEscape'],
  emits: ['close'],
  template: '<div role="dialog" aria-labelledby="document-title"><slot name="header" title-id="document-title"/><slot name="actions"/><slot/><slot name="footer"/></div>',
};

let wrapper;
const render = doc => {
  wrapper = shallowMount(DocumentCard, {
    attachTo: document.body,
    props: { doc },
    global: {
      mocks: { $route: { query: {} }, $router: { replace: vi.fn(), push: vi.fn() } },
      stubs: {
        ModalFrame: frameStub,
        AppButton: false,
        AppIconButton: false,
        AppTextInput: false,
        EmployeeCardModal: true,
        'font-awesome-icon': true,
      },
    },
  });
  return wrapper;
};

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('DocumentCard shared modal controls', () => {
  it('names its frame and renders labelled shared actions', async () => {
    render({ _id: 'doc-1', docType: 'Laufzettel', bezeichnung: 'Probe', details: {} });
    expect(wrapper.get('[role="dialog"]').attributes('aria-labelledby')).toBe('document-title');
    expect(wrapper.get('#document-title').text()).toBe('Probe');
    expect(wrapper.get('button[aria-label="Dokumentlink kopieren"]').classes()).toContain('app-button');
    expect(wrapper.get('button[aria-label="Weitere Dokumentaktionen"]').classes()).toContain('app-button');
    expect(wrapper.findAll('button').some(button => button.text().includes('Zuweisen') && button.classes().includes('app-button'))).toBe(true);
    await wrapper.get('button[aria-label="Weitere Dokumentaktionen"]').trigger('click');
    expect(wrapper.get('[role="menuitem"]').text()).toContain('Als PDF exportieren');
    expect(wrapper.get('button[aria-label="Weitere Dokumentaktionen"]').attributes('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(wrapper.get('[role="menuitem"]').element);
  });

  it('locks dismissal and duplicate comment actions during submission', async () => {
    let resolvePost;
    mocks.post.mockReturnValue(new Promise(resolve => { resolvePost = resolve; }));
    render({ _id: 'doc-2', docType: 'Event-Bericht', bezeichnung: 'Bericht', details: { comments: [] } });
    await wrapper.get('textarea[aria-label="Kommentar schreiben"]').setValue('Neuer Kommentar');
    await wrapper.findAll('button').find(button => button.text().includes('Senden')).trigger('click');

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({ showClose: false, closeOnBackdrop: false, closeOnEscape: false });
    expect(wrapper.get('textarea[aria-label="Kommentar schreiben"]').attributes('disabled')).toBeDefined();
    expect(wrapper.findAll('button').find(button => button.text().includes('An alle ausliefern')).attributes('disabled')).toBeDefined();
    wrapper.getComponent(ModalFrame).vm.$emit('close');
    expect(wrapper.emitted('close')).toBeUndefined();

    resolvePost({ data: { comment: { text: 'Neuer Kommentar' } } });
    await vi.waitFor(() => expect(wrapper.getComponent(ModalFrame).props('showClose')).toBe(true));
    expect(wrapper.text()).toContain('Neuer Kommentar');
    wrapper.getComponent(ModalFrame).vm.$emit('close');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('keeps the employee picker open while assignment is pending', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());
    mocks.get.mockResolvedValue({ data: { data: [{ _id: 'employee-1', vorname: 'Ada', nachname: 'Test' }] } });
    mocks.loadDocuments.mockResolvedValue();
    let resolvePost;
    mocks.post.mockReturnValue(new Promise(resolve => { resolvePost = resolve; }));
    render({ _id: 'doc-3', docType: 'Laufzettel', bezeichnung: 'Probe', details: {} });

    await wrapper.findAll('button').find(button => button.text().includes('Zuweisen')).trigger('click');
    await vi.waitFor(() => expect(wrapper.find('.employee-item').exists()).toBe(true));
    expect(wrapper.get('input[aria-label="Mitarbeiter suchen"]').classes()).toContain('app-text-input');
    await wrapper.get('.employee-item').trigger('click');
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(wrapper.get('.employee-item').attributes('disabled')).toBeDefined();
    expect(wrapper.getComponent(ModalFrame).props('showClose')).toBe(false);
    wrapper.findAllComponents(ModalFrame)[1].vm.$emit('close');
    expect(wrapper.findAllComponents(ModalFrame)).toHaveLength(2);

    resolvePost({ data: { success: true } });
    await vi.waitFor(() => expect(wrapper.findAllComponents(ModalFrame)).toHaveLength(1));
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
