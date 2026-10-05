import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTextarea from '@/components/ui-elements/AppTextarea.vue';
import AppToggleChip from '@/components/ui-elements/AppToggleChip.vue';

describe('shared form controls', () => {
  it('updates textarea values after IME composition', async () => {
    const wrapper = mount(AppTextarea, { props: { modelValue: '' } });
    const textarea = wrapper.get('textarea');
    await textarea.trigger('compositionstart');
    textarea.element.value = 'Beispiel';
    await textarea.trigger('input');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await textarea.trigger('compositionend');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Beispiel']);
  });

  it('keeps toggle chips as labelled, keyboard-focusable native checkboxes', async () => {
    const wrapper = mount(AppToggleChip, { props: { modelValue: false, label: 'Pflicht', accessibleLabel: 'Pflichtfeldstatus für Branche' } });
    const checkbox = wrapper.get('input[type="checkbox"]');
    expect(checkbox.attributes('aria-label')).toBe('Pflichtfeldstatus für Branche');
    expect(checkbox.attributes('tabindex')).toBeUndefined();
    await checkbox.setValue(true);
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
    await wrapper.setProps({ modelValue: true, disabled: true });
    expect(checkbox.element.checked).toBe(true);
    expect(checkbox.element.disabled).toBe(true);
  });
});
