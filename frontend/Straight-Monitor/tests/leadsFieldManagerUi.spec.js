import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import LeadsTab from '@/components/LeadsTab.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  auth: { user: { name: 'Test', roles: ['ADMIN'] } },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));

let wrapper;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.removeItem('leads_col_config');
  mocks.api.get.mockImplementation(url => Promise.resolve({ data:
    url === '/api/leads' || url === '/api/leads/labels' ? []
      : url === '/api/leads/config' ? { quelleOptions: [] }
        : url === '/api/locations' ? [{ _id: 'hh', nameFull: 'Hamburg' }]
          : url === '/api/graph/contacts' ? { contacts: [] } : [] }));
});

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  localStorage.removeItem('leads_col_config');
});

async function render() {
  wrapper = mount(LeadsTab, {
    attachTo: document.body,
    global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } },
  });
  await flushPromises();
}

describe('Leads field and column management', () => {
  it('uses shared buttons for field and source-option actions', async () => {
    const fallbackGet = mocks.api.get.getMockImplementation();
    mocks.api.get.mockImplementation(url => {
      if (url === '/api/leads/labels') return Promise.resolve({ data: [{ _id: 'field-1', name: 'Branche', fieldType: 'dropdown', options: [{ label: 'Hotel', value: 'hotel' }], isActive: true }] });
      if (url === '/api/leads/config') return Promise.resolve({ data: { quelleOptions: [{ label: 'Website', value: 'website' }] } });
      return fallbackGet(url);
    });
    await render();
    await wrapper.get('button[aria-label="Spalten und eigene Felder verwalten"]').trigger('click');
    await flushPromises();

    const body = document.querySelector('.lead-field-manager-body');
    expect(body.querySelectorAll('button:not(.app-button)')).toHaveLength(0);
    expect(body.querySelector('button[aria-label="Branche bearbeiten"].app-icon-button')).not.toBeNull();
    expect(body.querySelector('button[aria-label="Branche deaktivieren"].app-icon-button')).not.toBeNull();
    expect(body.querySelector('button[aria-label="Website bearbeiten"].app-icon-button')).not.toBeNull();
    expect(body.querySelector('button[aria-label="Website löschen"].app-icon-button')).not.toBeNull();
    expect([...body.querySelectorAll('button.app-button')].filter(button => button.textContent.includes('Hinzufügen'))).toHaveLength(2);
    expect(body.querySelectorAll('.app-text-input')).toHaveLength(2);
    expect(body.querySelectorAll('.app-select')).toHaveLength(1);
    expect(body.querySelector('input[aria-label="Pflichtfeldstatus für Branche"][type="checkbox"]')).not.toBeNull();

    body.querySelector('button[aria-label="Branche bearbeiten"]').click();
    await flushPromises();
    expect(body.querySelectorAll('.app-text-input')).toHaveLength(3);
    expect(body.querySelectorAll('.app-select')).toHaveLength(2);
    expect(body.querySelector('.app-textarea')?.value).toBe('Hotel');
  });

  it('uses ModalFrame for the field manager and guards dismissal while saving', async () => {
    await render();
    await wrapper.get('button[aria-label="Spalten und eigene Felder verwalten"]').trigger('click');
    await flushPromises();
    const dialog = document.querySelector('.lead-field-manager-modal');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog.querySelector(`#${dialog.getAttribute('aria-labelledby')}`).textContent).toBe('Eigene Felder verwalten');
    expect(dialog.querySelector('.lead-field-manager-body')).not.toBeNull();

    let resolveCreate;
    mocks.api.post.mockReturnValue(new Promise(resolve => { resolveCreate = resolve; }));
    const nameInput = dialog.querySelector('input[placeholder="Feldname (z.B. Quellenherkunft)"]');
    nameInput.value = 'Branche';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();
    dialog.querySelector('.new-field-row button').click();
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/leads/labels', expect.objectContaining({ name: 'Branche' }));
    expect(dialog.querySelector('.mf-close')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(document.querySelector('.lead-field-manager-modal')).not.toBeNull();

    resolveCreate({ data: { _id: 'field-1', name: 'Branche', fieldType: 'text', isActive: true } });
    await flushPromises();
    expect(dialog.querySelector('.mf-close')).not.toBeNull();
    dialog.querySelector('.mf-close').click();
    await flushPromises();
    expect(document.querySelector('.lead-field-manager-modal')).toBeNull();
  });

  it('uses the reusable popover while keeping Leads visibility and order persistence', async () => {
    await render();
    await wrapper.get('button[aria-label="Spalten anpassen"]').trigger('click');
    await flushPromises();
    const panel = document.querySelector('.column-customizer');
    expect(panel?.getAttribute('role')).toBe('dialog');
    const firstCheckbox = panel.querySelector('.column-customizer__row input[type="checkbox"]');
    expect(firstCheckbox.checked).toBe(true);
    firstCheckbox.click();
    await flushPromises();
    expect(JSON.parse(localStorage.getItem('leads_col_config'))[0]).toMatchObject({ _id: 'std_stufe', visible: false });
    panel.querySelector('button[aria-label="Stufe nach unten"]').click();
    await flushPromises();
    expect(JSON.parse(localStorage.getItem('leads_col_config'))[1]._id).toBe('std_stufe');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(document.querySelector('.column-customizer')).toBeNull();
  });
});
