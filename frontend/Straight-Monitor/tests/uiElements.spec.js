import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppButton from '../src/components/ui-elements/AppButton.vue';
import AppHiddenItemsButton from '../src/components/ui-elements/AppHiddenItemsButton.vue';
import AppIconButton from '../src/components/ui-elements/AppIconButton.vue';
import AppSegmentedControl from '../src/components/ui-elements/AppSegmentedControl.vue';
import AppTextInput from '../src/components/ui-elements/AppTextInput.vue';
import AppSelect from '../src/components/ui-elements/AppSelect.vue';

describe('shared UI controls', () => {
  it('renders a semantic button with a safe loading state', () => {
    const wrapper = mount(AppButton, {
      props: { variant: 'danger', loading: true },
      slots: { default: 'Löschen' },
    });

    const button = wrapper.get('button');
    expect(button.classes()).toContain('app-button--danger');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.attributes('aria-busy')).toBe('true');
    expect(button.text()).toContain('Löschen');
  });

  it('requires a readable label for icon-only actions', () => {
    const wrapper = mount(AppIconButton, {
      props: { label: 'Ansicht aktualisieren' },
      slots: { default: '↻' },
    });

    expect(wrapper.get('button').attributes('aria-label')).toBe('Ansicht aktualisieren');
    expect(wrapper.get('button').attributes('title')).toBe('Ansicht aktualisieren');
  });

  it('shares the hidden-items toggle with readable inactive and return states', async () => {
    const wrapper = mount(AppHiddenItemsButton, {
      props: {
        inactiveLabel: '2 ausgeblendet',
        inactiveAriaLabel: '2 ausgeblendete Mitarbeiter anzeigen',
        activeAriaLabel: 'Alle Mitarbeiter anzeigen',
      },
      global: { stubs: { 'font-awesome-icon': true } },
    });

    const button = wrapper.get('button');
    expect(button.classes()).toContain('app-button--secondary');
    expect(button.attributes('aria-pressed')).toBe('false');
    expect(button.attributes('aria-label')).toBe('2 ausgeblendete Mitarbeiter anzeigen');
    await button.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);

    await wrapper.setProps({ active: true });
    expect(button.classes()).toContain('is-active');
    expect(button.attributes('aria-pressed')).toBe('true');
    expect(button.attributes('aria-label')).toBe('Alle Mitarbeiter anzeigen');
    expect(button.text()).toContain('Zurück');
  });

  it('emits selected segmented values with radio semantics', async () => {
    const wrapper = mount(AppSegmentedControl, {
      props: {
        modelValue: 'light',
        label: 'Farbschema',
        options: [{ value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }],
      },
    });

    const options = wrapper.findAll('[role="radio"]');
    expect(options[0].attributes('aria-checked')).toBe('true');
    await options[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['dark']]);
  });

  it('forwards native input attributes and model updates', async () => {
    const wrapper = mount(AppTextInput, {
      props: { modelValue: 'Alt' },
      attrs: { id: 'test-input', type: 'text', autocomplete: 'name' },
    });

    const input = wrapper.get('input');
    expect(input.attributes('id')).toBe('test-input');
    expect(input.element.value).toBe('Alt');
    await input.setValue('Neu');
    expect(wrapper.emitted('update:modelValue')).toEqual([['Neu']]);
  });

  it('exposes focus for inline editors using the shared input', () => {
    const wrapper = mount(AppTextInput, { attachTo: document.body });
    wrapper.vm.focus();
    expect(document.activeElement).toBe(wrapper.get('input').element);
    wrapper.unmount();
  });

  it('keeps native select options and emits a changed value', async () => {
    const wrapper = mount(AppSelect, {
      props: { modelValue: 'all', size: 'sm' },
      attrs: { 'aria-label': 'Standort filtern' },
      slots: { default: '<option value="all">Alle</option><option value="hh">Hamburg</option>' },
    });
    const select = wrapper.get('select');
    expect(select.classes()).toContain('app-select--sm');
    expect(select.attributes('aria-label')).toBe('Standort filtern');
    expect(select.element.value).toBe('all');
    await select.setValue('hh');
    expect(wrapper.emitted('update:modelValue')).toEqual([['hh']]);
    wrapper.unmount();
  });

  it('navigates enabled radio choices with one tab stop and wraps keyboard selection', async () => {
    const wrapper = mount(AppSegmentedControl, {
      attachTo: document.body,
      props: {
        modelValue: 'a', label: 'Modus',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
          { value: 'c', label: 'C' },
        ],
        'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }),
      },
    });
    try {
      const options = wrapper.findAll('[role="radio"]');
      expect(options.map(option => option.attributes('tabindex'))).toEqual(['0', '-1', '-1']);
      await options[0].trigger('keydown', { key: 'ArrowRight' });
      expect(document.activeElement).toBe(options[2].element);
      expect(options[2].attributes('aria-checked')).toBe('true');
      expect(options.map(option => option.attributes('tabindex'))).toEqual(['-1', '-1', '0']);
      await options[2].trigger('keydown', { key: 'ArrowRight' });
      expect(document.activeElement).toBe(options[0].element);
      await options[0].trigger('keydown', { key: 'End' });
      expect(document.activeElement).toBe(options[2].element);
      await options[2].trigger('keydown', { key: 'Home' });
      expect(document.activeElement).toBe(options[0].element);
      await options[0].trigger('keydown', { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(options[2].element);
      await wrapper.setProps({ disabled: true });
      expect(options.every(option => option.attributes('tabindex') === '-1')).toBe(true);
      await options[2].trigger('keydown', { key: 'Home' });
      expect(wrapper.emitted('update:modelValue')).toEqual([['c'], ['a'], ['c'], ['a'], ['c']]);
    } finally {
      wrapper.unmount();
    }
  });

  it('keeps an emptied numeric input empty instead of emitting zero', async () => {
    const wrapper = mount(AppTextInput, { props: { type: 'number', modelValue: 5 } });
    await wrapper.get('input').setValue('12');
    await wrapper.get('input').setValue('');
    expect(wrapper.emitted('update:modelValue')).toEqual([[12], ['']]);
    wrapper.unmount();
  });

  it('waits for IME composition to end and applies trim/number modifiers', async () => {
    const wrapper = mount(AppTextInput, {
      props: { modelValue: '', modelModifiers: { trim: true } },
    });
    const input = wrapper.get('input');
    await input.trigger('compositionstart');
    await input.setValue(' 東京 ');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await input.trigger('compositionend');
    expect(wrapper.emitted('update:modelValue')).toEqual([['東京']]);
    await wrapper.setProps({ modelModifiers: { number: true } });
    await input.setValue('12.5');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([12.5]);
    wrapper.unmount();
  });
});
