import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MinuteSelect from '../src/components/ui-elements/MinuteSelect.vue';

let wrapper;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe('MinuteSelect', () => {
  it('offers quarter-hour values from zero through 150 and emits numbers', async () => {
    wrapper = mount(MinuteSelect, { props: { modelValue: 0, ariaLabel: 'Pause' } });
    const select = wrapper.get('select');

    expect(select.findAll('option').map(option => Number(option.element.value))).toEqual([0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150]);
    await select.setValue('45');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([45]);
  });

  it('keeps an existing off-grid value visible until it is changed', () => {
    wrapper = mount(MinuteSelect, { props: { modelValue: 20 } });
    const legacyOption = wrapper.get('option[value="20"]');

    expect(legacyOption.attributes('disabled')).toBeDefined();
  });

  it('disables selection for calculated pause-block totals', () => {
    wrapper = mount(MinuteSelect, { props: { modelValue: 30, readonly: true } });
    expect(wrapper.get('select').attributes('disabled')).toBeDefined();
  });
});