import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import UserManagement from '@/components/UserManagement.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { _id: 'admin', roles: ['ADMIN'] } }) }));
vi.mock('@/composables/useCustomerModals', () => ({ useCustomerModals: () => ({ openCustomer: vi.fn() }) }));

const officeId = '17e0c1c5-6b27-4bac-b0df-93711b993e64';
const location = { _id: 'hamburg', nameFull: 'Hamburg', shortName: 'HH', isActive: true, flipOfficeUserId: officeId };
let wrapper;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.get.mockImplementation(async url => ({
    data: url === '/api/locations' ? [location]
      : ['/api/users/admin/all', '/api/kunden', '/api/signatur-typen'].includes(url) ? [] : { data: [] },
  }));
  mocks.api.patch.mockImplementation(async (_url, payload) => ({ data: { ...location, ...payload } }));
  mocks.api.post.mockImplementation(async (_url, payload) => ({ data: { _id: 'new', ...payload } }));
});
afterEach(() => wrapper?.unmount());

it('loads and saves office IDs in the location editor and resets them for new locations', async () => {
  wrapper = mount(UserManagement, {
    global: { stubs: {
      'font-awesome-icon': true,
      ModalFrame: {
        props: ['modelValue'],
        template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>',
      },
    } },
  });
  await flushPromises();
  await wrapper.get('button[data-tab-id="locations"]').trigger('click');
  await wrapper.get('button[aria-label="Standort bearbeiten"]').trigger('click');
  const otherTab = () => wrapper.findAll('.location-modal-tabs button').find(button => button.text() === 'Sonstiges');
  await otherTab().trigger('click');
  expect(wrapper.get('#location-flip-office-user').element.value).toBe(officeId);
  await wrapper.get('#location-flip-office-user').setValue('');
  await wrapper.get('#location-form').trigger('submit');
  await flushPromises();
  expect(mocks.api.patch).toHaveBeenCalledWith('/api/locations/hamburg', expect.objectContaining({ flipOfficeUserId: '' }));
  await wrapper.findAll('button').find(button => button.text().includes('Standort anlegen')).trigger('click');
  await otherTab().trigger('click');
  expect(wrapper.get('#location-flip-office-user').element.value).toBe('');
  await wrapper.get('#location-flip-office-user').setValue(officeId);
  await wrapper.findAll('.location-modal-tabs button').find(button => button.text() === 'Stammdaten').trigger('click');
  await wrapper.get('#location-name').setValue('New location');
  await wrapper.get('#location-short').setValue('NL');
  await wrapper.get('#location-form').trigger('submit');
  await flushPromises();
  expect(mocks.api.post).toHaveBeenCalledWith('/api/locations', expect.objectContaining({ flipOfficeUserId: officeId }));
});
