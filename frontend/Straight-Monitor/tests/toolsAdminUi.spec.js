import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import FlipCreate from '@/components/FlipCreate.vue';
import UserManagement from '@/components/UserManagement.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(), defaults: { headers: { common: {} } } },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { _id: 'admin-1', roles: ['ADMIN'] } }) }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));

let wrapper;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('hasSeenPersonalnrHinweis', 'true');
  mocks.api.get.mockImplementation(url => Promise.resolve({ data:
    ['/api/users/admin/all', '/api/locations', '/api/kunden', '/api/signatur-typen'].includes(url) ? [] : { data: [] },
  }));
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  localStorage.removeItem('hasSeenPersonalnrHinweis');
});

it('uses shared form controls and ModalFrame for Flip user creation hints', async () => {
  wrapper = mount(FlipCreate, {
    attachTo: document.body,
    global: { plugins: [createModalDock()], mocks: { $route: { params: {} }, $router: { push: vi.fn() } }, stubs: { 'font-awesome-icon': true } },
  });
  await flushPromises();
  expect(wrapper.find('h1').text()).toBe('Bewerber erstellen');
  expect(wrapper.find('input#flip-vorname.app-text-input').exists()).toBe(true);
  expect(wrapper.find('select#flip-location.app-select').exists()).toBe(true);
  expect(wrapper.findAll('.app-toggle-chip')).toHaveLength(6);

  wrapper.vm.showReentryModal = true;
  await flushPromises();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Wiedereintritt MA');
  document.querySelector('[role="dialog"] button[aria-label="Schließen"]').click();
  await flushPromises();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(mocks.api.post).not.toHaveBeenCalled();
});

it('uses ModalFrame and shared actions for location and user dialogs without saving', async () => {
  wrapper = mount(UserManagement, {
    attachTo: document.body,
    global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } },
  });
  await flushPromises();
  expect(wrapper.find('h1').text()).toBe('Monitorverwaltung');
  await wrapper.findAll('button').find(button => button.text().includes('Standort anlegen')).trigger('click');
  await flushPromises();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Standort anlegen');
  expect(document.querySelector('#location-name.app-text-input')).not.toBeNull();
  expect(document.querySelector('#location-manager.app-select')).not.toBeNull();
  document.querySelector('[role="dialog"] button[aria-label="Schließen"]').click();
  await flushPromises();

  await wrapper.find('button[data-tab-id="users"]').trigger('click');
  await wrapper.findAll('button').find(button => button.text().includes('Neuer Benutzer')).trigger('click');
  await flushPromises();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Neuen Benutzer anlegen');
  expect(document.querySelector('#user-email.app-text-input')).not.toBeNull();
  expect(document.querySelector('#user-location.app-select')).not.toBeNull();
  document.querySelector('[role="dialog"] button[aria-label="Schließen"]').click();
  await flushPromises();

  await wrapper.find('button[data-tab-id="qualifikationen"]').trigger('click');
  await wrapper.findAll('button').find(button => button.text().includes('Qualifikation anlegen')).trigger('click');
  await flushPromises();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Qualifikation anlegen');
  expect(document.querySelector('#quali-designation.app-text-input')).not.toBeNull();
  expect(mocks.api.post).not.toHaveBeenCalled();
});
