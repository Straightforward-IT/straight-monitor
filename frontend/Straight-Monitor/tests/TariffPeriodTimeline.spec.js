import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TariffPeriodTimeline from '../src/components/tariffs/TariffPeriodTimeline.vue';

const period = (legacyId, validFrom, validUntil, rates = []) => ({ legacyId, validFrom, validUntil, rates });
const rate = (value, stagePosition = 1, groupPosition = 0) => ({ stagePosition, groupPosition, value });

describe('TariffPeriodTimeline', () => {
  it('orders all periods by real dates and emits only a clicked period id', async () => {
    const wrapper = mount(TariffPeriodTimeline, { props: { periods: [period('latest', '2026-09-01', null), period('oldest', '2025-01-01', '2025-12-31'), period('middle', '2026-01-01', '2026-08-31')], modelValue: 'latest', date: '2026-09-01' } });
    const buttons = wrapper.findAll('button');
    expect(buttons.map((button) => button.text())).toEqual(expect.arrayContaining([expect.stringContaining('Tarifzeit oldest'), expect.stringContaining('Tarifzeit middle'), expect.stringContaining('Tarifzeit latest')]));
    expect(buttons[0].text()).toContain('Tarifzeit oldest');
    expect(buttons[1].text()).toContain('Tarifzeit middle');
    expect(buttons[2].text()).toContain('Tarifzeit latest');
    expect(buttons[2].attributes('aria-pressed')).toBe('true');
    expect(buttons[0].attributes('aria-pressed')).toBe('false');
    expect(buttons[2].text()).toContain('offen');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await buttons[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['oldest']]);
    await wrapper.setProps({ date: '2025-06-01' });
    expect(wrapper.emitted('update:modelValue')).toEqual([['oldest']]);
    wrapper.unmount();
  });

  it('marks every inclusive date match rather than choosing among overlapping periods', () => {
    const wrapper = mount(TariffPeriodTimeline, { props: { periods: [period('one', '2026-01-01', '2026-09-01'), period('two', '2026-09-01', null), period('future', '2027-01-01', null)], date: '2026-09-01', modelValue: 'one' } });
    expect(wrapper.findAll('.tariff-period-timeline__entry--matching')).toHaveLength(2);
    expect(wrapper.text()).toContain('2 Tarifperioden gelten am 01.09.2026');
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(1);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });

  it('keeps the selected period visible when filtering other years and resets the filter on variant change', async () => {
    const wrapper = mount(TariffPeriodTimeline, { props: { periods: [period('old', '2020-01-01', '2020-12-31'), period('middle', '2025-01-01', '2025-12-31'), period('selected', '2026-09-01', null)], modelValue: 'selected', date: '2026-10-06' } });
    await wrapper.find('select').setValue('2020');
    expect(wrapper.findAll('button')).toHaveLength(2);
    expect(wrapper.find('button').text()).toContain('Tarifzeit old');
    expect(wrapper.find('[aria-pressed="true"]').text()).toContain('Tarifzeit selected');
    expect(wrapper.find('.tariff-period-timeline__selection').text()).toContain('selected');
    expect(wrapper.find('.tariff-period-timeline__selection').text()).toContain('außerhalb des Jahresfilters');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await wrapper.setProps({ periods: [period('new-old', '2021-01-01', '2021-12-31'), period('new-latest', '2027-01-01', null)], modelValue: 'new-latest' });
    expect(wrapper.find('select').element.value).toBe('');
    expect(wrapper.findAll('button')).toHaveLength(2);
    wrapper.unmount();
  });

  it('shows exact IX/IY values, missing cells, and ambiguous cells without estimates', () => {
    const wrapper = mount(TariffPeriodTimeline, { props: { periods: [period('exact', '2024-01-01', '2024-12-31', [rate('12345678901234567.8901'), rate('100.00', 2, 0)]), period('missing', '2025-01-01', '2025-12-31', [rate('200.00', 1, 1)]), period('ambiguous', '2026-01-01', null, [rate('15.33'), rate('16.08')])], stagePosition: '1', groupPosition: 0 } });
    expect(wrapper.findAll('.tariff-period-timeline__rate').map((entry) => entry.text())).toEqual(['12.345.678.901.234.567,8901 €', 'Grundwert fehlt', 'Nicht eindeutig']);
    expect(wrapper.text()).toContain('IX 1 / IY 0');
    wrapper.unmount();
  });

  it('hides values until both matrix positions exist and handles a date without matches', () => {
    const wrapper = mount(TariffPeriodTimeline, { props: { periods: [period('old', '2025-01-01', '2025-12-31', [rate('15.33')])], stagePosition: 1, date: '2026-10-06' } });
    expect(wrapper.find('.tariff-period-timeline__rate').exists()).toBe(false);
    expect(wrapper.text()).toContain('Keine Tarifperiode gilt am 06.10.2026');
    expect(wrapper.find('button').attributes('aria-label')).toContain('Tarifzeit old');
    expect(wrapper.find('button').attributes('type')).toBe('button');
    wrapper.unmount();
  });
});
