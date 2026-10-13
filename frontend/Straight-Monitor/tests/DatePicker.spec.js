import { afterEach, describe, expect, it } from 'vitest';
import { DOMWrapper, mount } from '@vue/test-utils';
import { h } from 'vue';
import DatePicker from '@/components/ui-elements/DatePicker.vue';

const wrappers = [];
const popup = () => new DOMWrapper(document.body).get('.dp-popup');
const dateButton = label => popup().get(`button[aria-label="${label}"]`);
async function render(modelValue, multiple = false) {
  const wrapper = mount(DatePicker, {
    attachTo: document.body,
    props: { modelValue, multiple, 'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }) },
    slots: { default: ({ toggle }) => h('button', { type: 'button', onClick: toggle }, 'Kalender') },
  });
  wrappers.push(wrapper);
  await wrapper.get('button').trigger('click');
  return wrapper;
}
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = ''; });

describe('custom calendar selection', () => {
  it('preserves single-date emission and closes after selection', async () => {
    const wrapper = await render(new Date(2026, 9, 13));
    await dateButton('15. Oktober 2026').trigger('click');
    expect(wrapper.emitted('update:modelValue')[0][0]).toBeInstanceOf(Date);
    expect(wrapper.props('modelValue').getDate()).toBe(15);
    expect(document.querySelector('.dp-popup')).toBeNull();
  });
  it('toggles several dates without mutating the original selection and closes only on Fertig', async () => {
    const original = [new Date(2026, 9, 13), new Date(2026, 9, 15)];
    const wrapper = await render(original, true);
    expect(dateButton('13. Oktober 2026').attributes('aria-pressed')).toBe('true');
    await dateButton('20. Oktober 2026').trigger('click');
    expect(wrapper.props('modelValue').map(date => date.getDate())).toEqual([13, 15, 20]);
    expect(document.querySelector('.dp-popup')).not.toBeNull();
    await dateButton('13. Oktober 2026').trigger('click');
    expect(wrapper.props('modelValue').map(date => date.getDate())).toEqual([15, 20]);
    expect(original.map(date => date.getDate())).toEqual([13, 15]);
    expect(popup().get('[role="status"]').text()).toBe('2 ausgewählt');
    await popup().findAll('button').find(button => button.text() === 'Fertig').trigger('click');
    expect(document.querySelector('.dp-popup')).toBeNull();
  });
  it('keeps the viewed month and highlights selected adjacent-month dates', async () => {
    const wrapper = await render([new Date(2026, 9, 31)], true);
    await popup().get('button[title="Nächster Monat"]').trigger('click');
    expect(popup().get('.dp-month-label').text()).toBe('November 2026');
    expect(dateButton('31. Oktober 2026').classes()).toContain('dp-cell--other');
    expect(dateButton('31. Oktober 2026').attributes('aria-pressed')).toBe('true');
    await dateButton('10. November 2026').trigger('click');
    expect(popup().get('.dp-month-label').text()).toBe('November 2026');
    expect(wrapper.props('modelValue').map(date => [date.getMonth(), date.getDate()])).toEqual([[9, 31], [10, 10]]);
    expect(dateButton('10. November 2026').attributes('aria-pressed')).toBe('true');
  });
  it('allows clearing all days while keeping the calendar open for a new selection', async () => {
    const wrapper = await render([new Date(2026, 9, 13)], true);
    await dateButton('13. Oktober 2026').trigger('click');
    expect(wrapper.props('modelValue')).toEqual([]);
    expect(document.querySelector('.dp-popup')).not.toBeNull();
    await dateButton('22. Oktober 2026').trigger('click');
    expect(wrapper.props('modelValue').map(date => date.getDate())).toEqual([22]);
    expect(popup().findAll('button').every(button => button.attributes('type') === 'button')).toBe(true);
  });
});
