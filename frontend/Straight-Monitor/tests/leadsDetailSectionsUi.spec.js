import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import LeadsTab from '@/components/LeadsTab.vue';
import AddressModal from '@/components/Modals/AddressModal.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  auth: { user: { name: 'Test', roles: ['ADMIN'] } },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));

const lead = {
  _id: 'lead-1', title: 'Testfirma', stufe: 'neu', locationV2: 'hh',
  aktivitaeten: [{ _id: 'akt-1', type: 'anruf', titel: 'Rückruf', datum: '2099-01-01T10:00:00.000Z', erledigt: false }],
  attachments: [{ id: 'att-1', filename: 'Angebot.pdf', contentType: 'application/pdf', size: 1234 }],
};
let wrapper;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockImplementation(url => Promise.resolve({ data:
    url === '/api/leads' ? [{ ...lead, aktivitaeten: lead.aktivitaeten.map(activity => ({ ...activity })) }]
      : url === '/api/leads/config' ? { quelleOptions: [] }
        : url === '/api/locations' ? [{ _id: 'hh', nameFull: 'Hamburg' }]
          : url === '/api/graph/contacts' ? { contacts: [] } : [] }));
});

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
});

async function render() {
  wrapper = mount(LeadsTab, {
    attachTo: document.body,
    props: { initialLeadId: 'lead-1' },
    global: { plugins: [createModalDock()], stubs: {
      'font-awesome-icon': true, ContactCard: true,
      RecordChronikDrawer: true, RecordChronikTimeline: true, RecordChronikComposer: true,
    } },
  });
  await flushPromises();
}

describe('Lead detail activity and file sections', () => {
  it('uses shared controls for core data and manual contact fields', async () => {
    await render();
    const detail = document.querySelector('.detail-sidebar');
    expect(detail.querySelector('input[aria-label="Organisation"].app-text-input')).not.toBeNull();
    expect(detail.querySelector('select[aria-label="Standort"].app-select')).not.toBeNull();
    expect(detail.querySelector('input[aria-label="Erwarteter Abschluss"].app-text-input')).not.toBeNull();
    expect(detail.querySelector('input[aria-label="Firma"].app-text-input')).not.toBeNull();
    expect(detail.querySelector('.stufe-step[aria-pressed="true"]')).not.toBeNull();

    const contactSection = [...detail.querySelectorAll('.info-section')].find(section => section.textContent.includes('Kontakte'));
    contactSection.querySelector('button.app-button').click();
    await flushPromises();
    expect(contactSection.querySelector('input[aria-label="Kontakt suchen"].app-text-input')).not.toBeNull();
    expect(contactSection.querySelector('button[aria-label="Kontaktsuche abbrechen"].app-icon-button')).not.toBeNull();
  });

  it('persists edits from shared text and select controls', async () => {
    const baseGet = mocks.api.get.getMockImplementation();
    mocks.api.get.mockImplementation(url => url === '/api/leads/config'
      ? Promise.resolve({ data: { quelleOptions: [{ value: 'website', label: 'Website' }] } })
      : baseGet(url));
    mocks.api.patch.mockImplementation((_url, payload) => Promise.resolve({ data: { ...lead, ...payload } }));
    await render();

    const title = wrapper.find('input[aria-label="Organisation"]');
    await title.setValue('Neue Organisation');
    await title.trigger('blur');
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/leads/lead-1', expect.objectContaining({ title: 'Neue Organisation' }));

    await wrapper.find('select[aria-label="Quelle"]').setValue('website');
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenLastCalledWith('/api/leads/lead-1', expect.objectContaining({ quelle: 'website' }));
  });

  it('uses labelled shared controls for linked contacts and custom fields', async () => {
    const baseGet = mocks.api.get.getMockImplementation();
    mocks.api.get.mockImplementation(url => {
      if (url === '/api/leads') return Promise.resolve({ data: [{
        ...lead,
        msContacts: [{ id: 'contact-1', displayName: 'Celina Kirsten', email: 'celina@example.com' }],
        customFields: { flag: true, category: 'hotel', tags: ['warm'], office: { street: 'Teststraße 1', city: 'Berlin' } },
      }] });
      if (url === '/api/leads/labels') return Promise.resolve({ data: [
        { _id: 'flag', key: 'flag', name: 'Wichtig', fieldType: 'checkbox', isActive: true },
        { _id: 'category', key: 'category', name: 'Kategorie', fieldType: 'dropdown', options: [{ value: 'hotel', label: 'Hotel' }], isActive: true },
        { _id: 'tags', key: 'tags', name: 'Tags', fieldType: 'multiselect', options: [{ value: 'warm', label: 'Warm' }], isActive: true },
        { _id: 'office', key: 'office', name: 'Büro', fieldType: 'address', isActive: true },
      ] });
      return baseGet(url);
    });
    await render();
    const detail = document.querySelector('.detail-sidebar');
    expect(detail.querySelector('input[type="checkbox"][aria-label="Wichtig"]')?.checked).toBe(true);
    expect(detail.querySelector('input[type="checkbox"][aria-label="Tags: Warm"]')?.checked).toBe(true);
    expect(detail.querySelector('select[aria-label="Kategorie"].app-select')?.value).toBe('hotel');
    expect(detail.querySelector('button[aria-label="Büro bearbeiten"].app-button')).not.toBeNull();
    expect(detail.querySelector('button[aria-label="Celina Kirsten öffnen"]')).not.toBeNull();
    expect(detail.querySelector('button[aria-label="Verknüpfung mit Celina Kirsten lösen"].app-icon-button')).not.toBeNull();
  });

  it('opens the global address modal and persists its submitted value as a lead custom field', async () => {
    const baseGet = mocks.api.get.getMockImplementation();
    mocks.api.get.mockImplementation(url => {
      if (url === '/api/leads') return Promise.resolve({ data: [{
        ...lead, customFields: { office: { street: 'Alte Straße', city: 'Berlin' } },
      }] });
      if (url === '/api/leads/labels') return Promise.resolve({ data: [
        { _id: 'office', key: 'office', name: 'Büro', fieldType: 'address', isActive: true },
      ] });
      return baseGet(url);
    });
    mocks.api.patch.mockImplementation((_url, payload) => Promise.resolve({ data: { ...lead, ...payload } }));
    await render();

    await wrapper.get('button[aria-label="Büro bearbeiten"]').trigger('click');
    const modal = wrapper.getComponent(AddressModal);
    expect(modal.props('modelValue')).toBe(true);
    expect(modal.props('address')).toMatchObject({ street: 'Alte Straße', city: 'Berlin' });
    modal.vm.$emit('save', { street: 'Neue Straße', zip: '12345', city: 'Hamburg', country: 'Deutschland' });
    await flushPromises();

    expect(mocks.api.patch).toHaveBeenCalledWith('/api/leads/lead-1', expect.objectContaining({
      customFields: { office: { street: 'Neue Straße', zip: '12345', city: 'Hamburg', country: 'Deutschland' } },
    }));
    expect(modal.props('modelValue')).toBe(false);
  });

  it('uses shared, labelled controls for existing activity and file actions', async () => {
    await render();
    const detail = document.querySelector('.detail-sidebar');
    expect(detail.querySelector('button[aria-label="Aktivität als erledigt markieren"].app-icon-button')).not.toBeNull();
    expect(detail.querySelector('button[aria-label="Rückruf bearbeiten"].app-icon-button')).not.toBeNull();
    expect(detail.querySelector('button[aria-label="Rückruf löschen"].app-icon-button')).not.toBeNull();
    expect(detail.querySelector('button[aria-label="Angebot.pdf herunterladen"].app-icon-button')).not.toBeNull();
    expect(detail.querySelector('button[aria-label="Angebot.pdf löschen"].app-icon-button')).not.toBeNull();
    expect(detail.querySelector('.attach-upload-area button.app-button')).not.toBeNull();
  });

  it('keeps activity creation and optional Asana state while saving', async () => {
    await render();
    const detail = document.querySelector('.detail-sidebar');
    const activity = [...detail.querySelectorAll('.info-section')].find(section => section.querySelector('.akt-list'));
    activity.querySelector('.add-contact-row button').click();
    await flushPromises();
    expect(activity.querySelector('input[aria-label="Titel der Aktivität"].app-text-input')).not.toBeNull();
    const asanaButton = activity.querySelector('button[aria-label="Asana-Task-Erstellung deaktivieren"]');
    expect(asanaButton.getAttribute('aria-pressed')).toBe('true');
    asanaButton.click();
    await flushPromises();
    expect(activity.querySelector('button[aria-label="Asana-Task-Erstellung aktivieren"]').getAttribute('aria-pressed')).toBe('false');

    let resolveSave;
    mocks.api.post.mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));
    activity.querySelector('.akt-form-actions button.app-button--primary').click();
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/leads/lead-1/aktivitaeten', expect.objectContaining({ type: 'anruf' }));
    expect(activity.querySelector('.akt-form-actions button.app-button--secondary').disabled).toBe(true);
    resolveSave({ data: { _id: 'akt-2', type: 'anruf', titel: '', datum: '2099-01-01T10:00:00.000Z' } });
    await flushPromises();
    expect(activity.querySelector('.akt-form')).toBeNull();
  });
});
