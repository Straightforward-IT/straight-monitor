import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import DashboardOverviewTab from '../src/components/DashboardOverviewTab.vue';
import WidgetConfigurator from '../src/components/widgets/WidgetConfigurator.vue';
import WidgetAuftraege from '../src/components/widgets/WidgetAuftraege.vue';
import WidgetChangelog from '../src/components/widgets/WidgetChangelog.vue';
import WidgetSinnlos from '../src/components/widgets/WidgetSinnlos.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';
import AppSelect from '../src/components/ui-elements/AppSelect.vue';

const mocks = vi.hoisted(() => ({
  prefs: {
    allowedWidgetOrder: [{ id: 'auftraege', visible: true }],
    setVisible: vi.fn(), resetToDefaults: vi.fn(), reorderWidgetByIds: vi.fn(),
  },
  cache: { loading: { auftraege: false }, auftraege: [], loadAuftraege: vi.fn() },
  api: { get: vi.fn() },
}));
vi.mock('@/stores/dashboardPrefs', () => ({ useDashboardPrefs: () => mocks.prefs }));
vi.mock('@/stores/dataCache', () => ({ useDataCache: () => mocks.cache }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: {} }) }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));

const frameStub = {
  props: ['modelValue', 'title'],
  emits: ['close'],
  template: '<div v-if="modelValue" role="dialog" aria-labelledby="config-title"><slot name="header" title-id="config-title" /><slot /><slot name="footer" /></div>',
};
const widgetStub = {
  props: ['title', 'loading'],
  template: '<section><header><slot name="title" /><slot name="actions" /></header><slot /><slot name="footer" /></section>',
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockResolvedValue({ data: [{ _id: 'hamburg', shortName: 'HH' }] });
  mocks.cache.loadAuftraege.mockResolvedValue();
  mocks.cache.auftraege = [];
});

describe('dashboard and widget controls', () => {
  it('opens the configurator from the shared dashboard tile', async () => {
    const wrapper = mount(DashboardOverviewTab, {
      props: { activeWidgets: [] },
      global: { stubs: { WidgetConfigurator: { props: ['visible'], emits: ['close'], template: '<div v-if="visible" class="config-stub" />' }, 'font-awesome-icon': true } },
    });
    expect(wrapper.find('.config-stub').exists()).toBe(false);
    await wrapper.get('button[aria-label="Dashboard-Widgets anpassen"]').trigger('click');
    expect(wrapper.find('.config-stub').exists()).toBe(true);
    wrapper.getComponent(WidgetConfigurator).vm.$emit('close');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.config-stub').exists()).toBe(false);
    wrapper.unmount();
  });

  it('uses ModalFrame for widget preferences and preserves reset and finish actions', async () => {
    const wrapper = mount(WidgetConfigurator, {
      props: { visible: true },
      global: { stubs: { ModalFrame: frameStub, 'font-awesome-icon': true } },
    });
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({ modelValue: true, title: 'Dashboard anpassen' });
    expect(wrapper.get('[role="dialog"]').attributes('aria-labelledby')).toBe(wrapper.get('h2').attributes('id'));
    await wrapper.findAll('button').find(button => button.text().includes('Zurücksetzen')).trigger('click');
    expect(mocks.prefs.resetToDefaults).toHaveBeenCalledOnce();
    await wrapper.findAll('button').find(button => button.text().includes('Fertig')).trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('keeps order date navigation and the location filter with shared controls', async () => {
    const wrapper = mount(WidgetAuftraege, {
      global: { stubs: { DashboardWidget: widgetStub, 'font-awesome-icon': true, RouterLink: true } },
    });
    await flushPromises();
    expect(wrapper.get('button[aria-label="Vorheriger Tag"]')).toBeTruthy();
    expect(wrapper.get('button[aria-label="Nächster Tag"]')).toBeTruthy();
    const select = wrapper.getComponent(AppSelect);
    expect(select.attributes('aria-label')).toBe('Aufträge nach Standort filtern');
    await select.get('select').setValue('hamburg');
    expect(select.props('modelValue')).toBe('hamburg');
    await wrapper.get('button[aria-label="Vorheriger Tag"]').trigger('click');
    expect(wrapper.get('.wa-date-label').text()).not.toBe('Heute');
    await wrapper.get('.wa-date-label').trigger('click');
    expect(wrapper.get('.wa-date-label').text()).toBe('Heute');
    wrapper.unmount();
  });

  it('switches changelog categories and resets the expanded list', async () => {
    const wrapper = mount(WidgetChangelog, { global: { stubs: { DashboardWidget: widgetStub, 'font-awesome-icon': true } } });
    await wrapper.findAll('button').find(button => button.text().includes('weitere')).trigger('click');
    expect(wrapper.findAll('.changelog__item').length).toBeGreaterThan(2);
    await wrapper.get('[role="radio"][aria-checked="false"]').trigger('click');
    expect(wrapper.findAll('.changelog__item')).toHaveLength(1);
    expect(wrapper.get('[role="radio"][aria-checked="true"]').text()).toBe('In Entwicklung');
    wrapper.unmount();
  });

  it('keeps the specialized press button keyboard-operable', async () => {
    const wrapper = mount(WidgetSinnlos, { global: { stubs: { DashboardWidget: widgetStub, 'font-awesome-icon': true } } });
    const button = wrapper.get('.ws-btn');
    await button.trigger('keydown', { key: ' ' });
    expect(button.attributes('aria-pressed')).toBe('true');
    await button.trigger('keyup', { key: ' ' });
    expect(button.attributes('aria-pressed')).toBe('false');
    wrapper.unmount();
  });
});
