import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppTextarea from '@/components/ui-elements/AppTextarea.vue';
import AppToggleChip from '@/components/ui-elements/AppToggleChip.vue';
import AppFileDropzone from '@/components/ui-elements/AppFileDropzone.vue';

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
  it('retains single-file behavior and supports multiple queued files from selection and drop', async () => {
    const first = new File(['first'], 'first.pdf');
    const second = new File(['second'], 'second.pdf');
    const single = mount(AppFileDropzone, { props: { label: 'Datei' } });
    await single.trigger('drop', { dataTransfer: { files: [first, second] } });
    expect(single.emitted('select')).toEqual([[first]]);
    const multiple = mount(AppFileDropzone, { props: { label: 'Anlagen', multiple: true } });
    const input = multiple.get('input');
    Object.defineProperty(input.element, 'files', { value: [first, second] });
    await input.trigger('change');
    expect(multiple.emitted('select')).toEqual([[[first, second]]]);
    await multiple.trigger('drop', { dataTransfer: { files: [first, second] } });
    expect(multiple.emitted('select')).toHaveLength(2);
    await multiple.setProps({ disabled: true });
    await multiple.trigger('drop', { dataTransfer: { files: [first] } });
    expect(multiple.emitted('select')).toHaveLength(2);
    single.unmount(); multiple.unmount();
  });
});
