import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { h } from 'vue';
import LinkedFieldControl from '@/components/ui-elements/LinkedFieldControl.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppTextarea from '@/components/ui-elements/AppTextarea.vue';

describe('inline linked-field controls', () => {
  it('places the scope control after the input inside the same field', async () => {
    const wrapper = mount(LinkedFieldControl, {
      props: { linked: true, label: 'Titel' },
      slots: { default: () => h(AppTextInput, { modelValue: 'Auftrag', 'aria-label': 'Titel' }) },
    });
    expect(wrapper.classes()).toContain('linked-field-control--linked');
    expect(wrapper.element.children[0].tagName).toBe('INPUT');
    expect(wrapper.element.children[1].classList.contains('linked-field-control__scope')).toBe(true);
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    wrapper.unmount();
  });
  it('supports a multiline suffix without showing controls for unlinked fields', async () => {
    const wrapper = mount(LinkedFieldControl, {
      props: { linked: true, multiline: true, label: 'Bestellungstext', modelValue: false },
      slots: { default: () => h(AppTextarea, { modelValue: 'Text' }) },
    });
    expect(wrapper.classes()).toContain('linked-field-control--multiline');
    expect(wrapper.get('textarea').exists()).toBe(true);
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false');
    await wrapper.setProps({ linked: false });
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.find('textarea').exists()).toBe(true);
    wrapper.unmount();
  });
});
