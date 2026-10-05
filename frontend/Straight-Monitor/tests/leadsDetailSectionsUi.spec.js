import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import LeadsTab from '@/components/LeadsTab.vue';

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
