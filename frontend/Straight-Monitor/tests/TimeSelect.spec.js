import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TimeSelect from '../src/components/ui-elements/TimeSelect.vue';

let wrapper;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe('TimeSelect', () => {
  it('selects an hour and one of four quarter-hour values', async () => {
    wrapper = mount(TimeSelect, { props: { modelValue: '', ariaLabel: 'Beginn' } });
    const selects = wrapper.findAll('select');

    expect(selects[1].findAll('option').map(option => option.element.value)).toEqual(['00', '15', '30', '45']);
    await selects[0].setValue('09');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['09:00']);

    await wrapper.setProps({ modelValue: '09:00' });
    await selects[1].setValue('30');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['09:30']);
  });

  it('shows an existing off-grid minute without offering it as a new choice', () => {
    wrapper = mount(TimeSelect, { props: { modelValue: '12:10' } });
    const legacyOption = wrapper.findAll('select')[1].find('option[value="10"]');

    expect(legacyOption.exists()).toBe(true);
    expect(legacyOption.attributes('disabled')).toBeDefined();
  });
});