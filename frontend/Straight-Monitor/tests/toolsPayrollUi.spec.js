import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import Lohnabrechnungen from '@/components/Lohnabrechnungen.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
  router: { push: vi.fn() },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }));

let wrapper;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('token', 'test-token');
  mocks.api.get.mockResolvedValue({ data: { _id: 'user-1', location: 'Hamburg' } });
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  localStorage.removeItem('token');
});

it('uses shared payroll controls and a ModalFrame preview without sending', async () => {
  wrapper = mount(Lohnabrechnungen, {
    attachTo: document.body,
    global: { plugins: [createModalDock()], mocks: { $router: mocks.router }, stubs: { 'font-awesome-icon': true } },
  });
  await flushPromises();
  expect(wrapper.find('h1').text()).toBe('Lohnabrechnungen');
  expect(wrapper.find('select#payroll-document-type.app-select').exists()).toBe(true);
  expect(wrapper.find('select#payroll-city.app-select').element.value).toBe('HH');
  expect(wrapper.find('input[aria-label="Testmodus (E-Mails an IT)"]').exists()).toBe(true);
  expect(wrapper.find('button.app-button--primary').element.disabled).toBe(true);

  wrapper.vm.showPreviewModal = true;
  wrapper.vm.previewTotalPages = 2;
  await flushPromises();
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain('Vorschau Seite 1 von 2');
  expect(dialog.querySelector('button[aria-label="Vorschau vergrößern"]')).not.toBeNull();
  expect(dialog.querySelector('input[aria-label="Name in Lohnabrechnungen suchen"]')).not.toBeNull();
  dialog.querySelector('button[aria-label="Schließen"]').click();
  await flushPromises();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(mocks.api.post).not.toHaveBeenCalled();
});
