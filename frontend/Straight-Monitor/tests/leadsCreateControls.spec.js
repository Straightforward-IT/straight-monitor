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
  mocks.api.get.mockImplementation(url => Promise.resolve({ data:
    url === '/api/leads' ? [] : url === '/api/leads/config' ? { quelleOptions: [{ value: 'referral', label: 'Empfehlung' }] }
      : url === '/api/locations' ? [{ _id: 'hh', nameFull: 'Hamburg' }]
        : url === '/api/graph/contacts' ? { contacts: [{ id: 'contact-1', displayName: 'Alice Beispiel', givenName: 'Alice', surname: 'Beispiel' }] } : [] }));
});

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function openCreateDialog() {
  wrapper = mount(LeadsTab, {
    attachTo: document.body,
    global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } },
  });
  await flushPromises();
  await wrapper.get('.empty-list .app-button').trigger('click');
  await flushPromises();
  return document.querySelector('.lead-create-modal');
}

describe('Leads create controls', () => {
  it('uses labelled shared fields and a keyboard-operable contact mode', async () => {
    const dialog = await openCreateDialog();
    expect(dialog).not.toBeNull();
    for (const label of ['Standort', 'Organisation', 'Quelle']) {
      const fieldLabel = [...dialog.querySelectorAll('label')].find(node => node.textContent.includes(label));
      expect(dialog.querySelector(`#${fieldLabel.htmlFor}`)).not.toBeNull();
    }
    expect(dialog.querySelectorAll('.app-select')).toHaveLength(2);
    expect(dialog.querySelector('input[placeholder="z.B. EventRent"]').classList.contains('app-text-input')).toBe(true);
    const search = dialog.querySelector('input[aria-label="Microsoft Kontakt suchen"]');
    search.value = 'Alice';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();
    expect(dialog.querySelector('.contact-result-item').textContent).toContain('Alice Beispiel');
    dialog.querySelector('.contact-result-item').click();
    await flushPromises();
    expect(dialog.querySelector('.linked-contact-chip')).not.toBeNull();
    const modes = [...dialog.querySelectorAll('[role="radio"]')];
    expect(modes.map(mode => mode.textContent.trim())).toEqual(['Suchen', 'Neu anlegen', 'Überspringen']);
    modes[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flushPromises();
    expect(modes[1].getAttribute('aria-checked')).toBe('true');
    expect(dialog.querySelector('.linked-contact-chip')).toBeNull();
  });

  it('locks dismissal during creation and shows a retryable inline error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const dialog = await openCreateDialog();
    const title = dialog.querySelector('input[placeholder="z.B. EventRent"]');
    title.value = 'Beispiel';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await flushPromises();

    let rejectCreate;
    mocks.api.post.mockReturnValue(new Promise((_, reject) => { rejectCreate = reject; }));
    const createButton = [...dialog.querySelectorAll('.mf-footer button')].find(button => button.textContent.includes('Anlegen'));
    createButton.click();
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledTimes(1);
    expect(createButton.getAttribute('aria-busy')).toBe('true');
    expect(dialog.querySelector('.mf-footer button').disabled).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(document.querySelector('.lead-create-modal')).not.toBeNull();

    rejectCreate(new Error('temporär nicht verfügbar'));
    await flushPromises();
    expect(dialog.querySelector('[role="alert"]').textContent).toContain('erneut versuchen');
    expect(dialog.querySelector('.mf-footer button').disabled).toBe(false);
  });
});
