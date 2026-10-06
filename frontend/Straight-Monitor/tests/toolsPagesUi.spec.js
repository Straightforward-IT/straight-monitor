import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import * as XLSX from 'xlsx';
import FlipExit from '@/components/FlipExit.vue';
import FlipUserFix from '@/components/FlipUserFix.vue';
import MitarbeiterEinsatzortMapModal from '@/components/Modals/MitarbeiterEinsatzortMapModal.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { roles: ['ADMIN'] } }) }));

let wrapper;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockImplementation(url => Promise.resolve({ data:
    url.includes('attribute-definitions') ? [{ technical_name: 'department', title: 'Abteilung' }]
      : [{ id: '1', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', status: 'ACTIVE', attributes: { department: 'Alt' } }],
  }));
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Tools pages shared UI', () => {
  it('loads an Excel file and confirms Flip exits before sending the existing payload', async () => {
    wrapper = mount(FlipExit, { attachTo: document.body });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Personal-Nr', 'Nachname', 'Vorname'], ['12', 'Lovelace', 'Ada'],
    ]), 'Austritte');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const file = new File([bytes], 'austritte.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes) });
    const input = wrapper.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });
    await input.trigger('change');
    await flushPromises();
    expect(wrapper.text()).toContain('1 Person bereit');

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await wrapper.find('button.app-button--danger').trigger('click');
    expect(confirm).toHaveBeenCalled();
    expect(mocks.api.post).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    mocks.api.post.mockResolvedValue({ data: { notFound: [] } });
    await wrapper.find('button.app-button--danger').trigger('click');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/personal/flip/exit', [
      { personalnr: '12', nachname: 'Lovelace', vorname: 'Ada' },
    ], expect.any(Object));
    expect(wrapper.text()).toContain('Verarbeitung abgeschlossen');
  });

  it('uses shared controls and ModalFrame for the Quick Fix update', async () => {
    wrapper = mount(FlipUserFix, {
      attachTo: document.body,
      global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } },
    });
    await flushPromises();
    expect(wrapper.find('h1').text()).toBe('Quick Flip Fix');
    expect(wrapper.find('input[aria-label="Status ACTIVE"]').exists()).toBe(true);
    await wrapper.find('button.app-button--primary').trigger('click');
    await flushPromises();
    expect(wrapper.find('input[aria-label="Ada Lovelace auswählen"]').exists()).toBe(true);
    await wrapper.find('input[aria-label="Ada Lovelace auswählen"]').setValue(true);
    await wrapper.find('select[aria-label="Attribut für Bulk-Update"]').setValue('department');
    await wrapper.find('input[aria-label="Neuer Attributwert"]').setValue('Neu');
    await wrapper.find('.btn-apply').trigger('click');
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Bulk-Update bestätigen');
    expect(mocks.api.patch).not.toHaveBeenCalled();

    mocks.api.patch.mockResolvedValue({ data: { succeeded: 1, failed: 0, results: [{ id: '1', success: true }] } });
    const confirmButton = [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent.includes('Ja, anwenden'));
    confirmButton.click();
    await flushPromises();
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/flip-user-fix/users/batch', {
      items: [{ id: '1', attributes: { department: 'Neu' } }],
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps the map modes and searches on shared controls', async () => {
    mocks.api.get.mockImplementation(url => Promise.resolve({ data:
      url === '/api/locations' ? [{ _id: 'hh', nameFull: 'Hamburg' }]
        : url === '/api/users/me' ? { roles: ['ADMIN'], locationV2: 'hh' }
          : {
            configuration: { geocodingAvailable: true }, entries: [], origin: null,
            nearest: null, center: null, locations: [],
            summary: { total: 0, mapped: 0, unresolved: 0, pending: false },
          },
    }));
    wrapper = mount(MitarbeiterEinsatzortMapModal, {
      attachTo: document.body,
      global: { plugins: [createModalDock()], stubs: {
        'font-awesome-icon': true,
        EmployeeLocationMap: true,
        Toolbar: { template: '<div class="toolbar"><slot name="filter" /><slot /></div>' },
      } },
    });
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Mitarbeiter- und Einsatzortkarte');
    expect(document.querySelector('[role="radiogroup"][aria-label="Karteninhalt"]')).not.toBeNull();
    expect(document.querySelector('input#staff-map-site-search.app-text-input')).not.toBeNull();
    expect(document.querySelector('select#staff-map-site.app-select')).not.toBeNull();
    expect(document.querySelector('input#staff-map-entry-search.app-text-input')).not.toBeNull();
    document.querySelector('[role="radio"][data-label="Einsatzorte"]').click();
    await flushPromises();
    expect(mocks.api.get).toHaveBeenCalledWith('/api/personal/map-data', expect.objectContaining({
      params: expect.objectContaining({ entityType: 'einsatzort' }),
    }));
  });
});
