import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import LinkedScopeToggle from '@/components/ui-elements/LinkedScopeToggle.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';

describe('linked-information convention', () => {
  it('defaults to on for all linked days, with a link icon and accessible explanation', async () => {
    const wrapper = mount(LinkedScopeToggle, { props: { label: 'Bedarf' } });
    const button = wrapper.get('button');
    expect(button.classes()).toContain('active');
    expect(button.attributes('aria-pressed')).toBe('true');
    expect(button.attributes('aria-label')).toContain('Alle verknüpften Tage');
    expect(wrapper.get('svg').attributes('data-icon')).toBe('link');
    expect(wrapper.getComponent(CustomTooltip).props('text')).toContain('Ausschalten');
    await button.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    wrapper.unmount();
  });
  it('shows a broken link when local and enables common inheritance on click', async () => {
    const wrapper = mount(LinkedScopeToggle, { props: { label: 'Einsatzort', modelValue: false } });
    const button = wrapper.get('button');
    expect(button.classes()).not.toContain('active');
    expect(button.attributes('aria-pressed')).toBe('false');
    expect(button.attributes('aria-label')).toContain('Nur das aktuelle Datum');
    expect(wrapper.get('svg').attributes('data-icon')).toBe('link-slash');
    await button.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
    wrapper.unmount();
  });
  it('does not change scope when disabled', async () => {
    const wrapper = mount(LinkedScopeToggle, { props: { label: 'Bestellung', disabled: true } });
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });
});
