import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import InventoryOverviewTab from '../src/components/InventoryOverviewTab.vue';
import { useAuth } from '../src/stores/auth';
import { useDataCache } from '../src/stores/dataCache';
import { useInventoryFilters } from '../src/stores/inventoryFilters';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  push: vi.fn(),
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));

const locations = [
  { _id: 'hh', shortName: 'HH', nameFull: 'Hamburg', color: '#ffeedd' },
  { _id: 'be', shortName: 'BE', nameFull: 'Berlin', color: '#123456' },
];
function fixture() {
  return ['T-Shirt', 'Jacke'].flatMap((bezeichnung, itemIndex) => locations.map((location, locationIndex) => ({
    _id: `stock-${itemIndex}-${locationIndex}`,
    itemId: `item-${itemIndex}`, bezeichnung,
    locationId: location._id, standort: location.nameFull, standortKurz: location.shortName,
    standortColor: location.color, anzahl: 5 + locationIndex, soll: 10,
    groesseKey: 'onesize', groesse: 'onesize', groesseOrder: 0,
  })));
}
const slotStub = { template: '<div><slot /></div>' };
let wrapper;
let pinia;
let cache;
let auth;
beforeEach(() => {
  vi.clearAllMocks();
  pinia = createPinia();
  setActivePinia(pinia);
  auth = useAuth();
  auth.user = { role: 'ADMIN', highlightedInventoryItems: [] };
  cache = useDataCache();
  cache.items = fixture();
  vi.spyOn(cache, 'loadItems').mockResolvedValue(cache.items);
  mocks.api.get.mockResolvedValue({ data: locations });
  mocks.api.put.mockResolvedValue({ data: { highlightedInventoryItems: ['item-0'] } });
  mocks.api.delete.mockResolvedValue({ data: {} });
});
afterEach(() => wrapper?.unmount());
async function render() {
  wrapper = mount(InventoryOverviewTab, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
      stubs: {
        'font-awesome-icon': true,
        Toolbar: { template: '<div><slot /><slot name="actions" /><slot name="bottom-actions" /></div>' },
        ToolbarFilter: slotStub, ToolbarGroup: slotStub, FilterGroup: slotStub,
        ToolbarPageControls: true, SearchBar: true,
        InventoryItemModal: { name: 'InventoryItemModal', props: ['modelValue', 'item'], template: '<div />' },
        InventoryTransactionModal: { name: 'InventoryTransactionModal', props: ['modelValue'], template: '<div />' },
        InventoryReportModal: { name: 'InventoryReportModal', props: ['mode', 'stocks', 'locations', 'initialLocationIds'], template: '<div />' },
        ContextMenu: { name: 'ContextMenu', props: ['options'], emits: ['select', 'close'], template: '<div />' },
      },
    },
  });
  await flushPromises();
}
const card = name => wrapper.findAll('.item-card').find(item => item.get('h3').text() === name);

describe('inventory overview shared controls', () => {
  it('keeps favorite, disclosure, edit, create, and history actions independent', async () => {
    await render();
    const shirt = card('T-Shirt');
    expect(wrapper.find('button button').exists()).toBe(false);
    await shirt.get('.favorite-star-button').trigger('click');
    await flushPromises();
    expect(mocks.api.put).toHaveBeenCalledWith('/api/users/me/highlighted-inventory-items/toggle', { itemId: 'item-0' });
    expect(shirt.find('.item-card__details').exists()).toBe(false);
    await shirt.get('button[aria-label="Artikel T-Shirt bearbeiten"]').trigger('click');
    const editor = wrapper.getComponent({ name: 'InventoryItemModal' });
    expect(editor.props('modelValue')).toBe(true);
    expect(editor.props('item').stocks).toHaveLength(2);
    expect(shirt.find('.item-card__details').exists()).toBe(false);
    await shirt.get('button[aria-label="Bestandsverlauf für T-Shirt als Graph öffnen"]').trigger('click');
    expect(mocks.push).toHaveBeenCalledWith({ path: '/verlauf', query: { tab: 'graph', itemId: 'item-0' } });
    expect(shirt.find('.item-card__details').exists()).toBe(false);
    await shirt.get('.item-card__details-trigger').trigger('click');
    const details = shirt.get('.item-card__details');
    expect(shirt.get('.item-card__details-trigger').attributes('aria-controls')).toBe(details.attributes('id'));
    expect(shirt.get('.item-card__details-trigger').attributes('aria-expanded')).toBe('true');
    await shirt.get('button[aria-label="Details für T-Shirt schließen"]').trigger('click');
    expect(shirt.find('.item-card__details').exists()).toBe(false);
    await wrapper.findAll('.toolbar-btn').find(button => button.text() === 'Neu').trigger('click');
    expect(editor.props('item')).toBeNull();
  });

  it('changes only the selected item location by keyboard and opens that stock transaction', async () => {
    await render();
    await card('T-Shirt').get('.item-card__details-trigger').trigger('click');
    await card('Jacke').get('.item-card__details-trigger').trigger('click');
    const shirt = card('T-Shirt');
    const choices = shirt.findAll('[role="radio"]');
    expect(choices.map(choice => choice.text())).toEqual(['BE', 'HH']);
    expect(choices.map(choice => choice.attributes('tabindex'))).toEqual(['0', '-1']);
    expect(shirt.get('.stock-matrix-section h4').text()).toBe('Berlin');
    await choices[0].trigger('keydown', { key: 'ArrowRight' });
    expect(document.activeElement).toBe(choices[1].element);
    expect(shirt.get('.stock-matrix-section h4').text()).toBe('Hamburg');
    expect(card('Jacke').get('.stock-matrix-section h4').text()).toBe('Berlin');
    expect(shirt.get('.matrix-cell').text()).toContain('5');
    await shirt.get('.matrix-cell').trigger('click');
    expect(wrapper.getComponent({ name: 'InventoryTransactionModal' }).props('modelValue')).toMatchObject({
      _id: 'stock-0-0', locationId: 'hh', anzahl: 5, soll: 10,
    });
    await choices[1].trigger('keydown', { key: 'ArrowRight' });
    expect(shirt.get('.stock-matrix-section h4').text()).toBe('Berlin');
  });

  it('falls back to a visible location after filtering and edits all stocks rather than the filtered subset', async () => {
    await render();
    await card('T-Shirt').get('.item-card__details-trigger').trigger('click');
    await card('T-Shirt').findAll('[role="radio"]')[1].trigger('click');
    useInventoryFilters().setLocations(['be']);
    await flushPromises();
    const shirt = card('T-Shirt');
    expect(shirt.find('[role="radiogroup"]').exists()).toBe(false);
    expect(shirt.get('.stock-matrix-section h4').text()).toBe('Berlin');
    await shirt.get('button[aria-label="Artikel T-Shirt bearbeiten"]').trigger('click');
    expect(wrapper.getComponent({ name: 'InventoryItemModal' }).props('item').stocks).toHaveLength(2);
  });

  it('preserves admin-only deletion and the confirmation boundary', async () => {
    auth.user.role = 'USER';
    await render();
    expect(wrapper.find('button[aria-label="Artikel T-Shirt löschen"]').exists()).toBe(false);
    auth.user.role = 'ADMIN';
    await flushPromises();
    const remove = card('T-Shirt').get('button[aria-label="Artikel T-Shirt löschen"]');
    expect(remove.classes()).toContain('app-button--danger');
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await remove.trigger('click');
    expect(mocks.api.delete).not.toHaveBeenCalled();
    await remove.trigger('click');
    await flushPromises();
    expect(mocks.api.delete).toHaveBeenCalledWith('/api/inventory/items/item-0');
    expect(cache.loadItems).toHaveBeenCalledTimes(2);
    expect(card('T-Shirt').find('.item-card__details').exists()).toBe(false);
  });

  it('still opens the shared report dialogs from the actions menu', async () => {
    await render();
    await wrapper.get('button[title="Bestandsaktionen"]').trigger('click');
    const menu = wrapper.getComponent({ name: 'ContextMenu' });
    expect(menu.props('options').map(option => option.action)).toEqual(['refresh', 'email', 'excel']);
    menu.vm.$emit('select', 'excel');
    await flushPromises();
    const report = wrapper.getComponent({ name: 'InventoryReportModal' });
    expect(report.props('mode')).toBe('excel');
    expect(report.props('stocks')).toHaveLength(4);
    menu.vm.$emit('select', 'email');
    await flushPromises();
    expect(report.props('mode')).toBe('email');
  });
});
