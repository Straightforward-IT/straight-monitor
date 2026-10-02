import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import AddressAutocomplete from '../src/components/ui-elements/AddressAutocomplete.vue';

const stubs = { 'font-awesome-icon': true };
const list = () => new DOMWrapper(document.querySelector('[role="listbox"]'));
let wrapper;

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.useRealTimers();
});

function render(props = {}) {
  wrapper = mount(AddressAutocomplete, {
    attachTo: document.body,
    props: { modelValue: '', localSuggestions: ['Hamburg Hbf', 'Berlin Hbf'], ...props },
    global: { stubs },
  });
  return wrapper.get('input');
}

describe('shared address autocomplete', () => {
  it('uses the common input and lets keyboard users select a local suggestion', async () => {
    const input = render({ id: 'journey-start' });
    expect(input.classes()).toContain('app-text-input');
    expect(input.attributes('id')).toBe('journey-start');
    await input.trigger('focus');
    expect(input.attributes('role')).toBe('combobox');
    expect(input.attributes('aria-expanded')).toBe('true');
    expect(list().findAll('[role="option"]')).toHaveLength(2);
    expect(input.attributes('aria-controls')).toBe(list().attributes('id'));
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(input.attributes('aria-activedescendant')).toBe(list().get('[role="option"]').attributes('id'));
    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toBe('Hamburg Hbf');
    expect(input.attributes('aria-expanded')).toBe('false');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('lets Escape dismiss suggestions before it reaches an enclosing modal', async () => {
    const input = render();
    const outerKeydown = vi.fn();
    window.addEventListener('keydown', outerKeydown);
    await input.trigger('focus');
    await input.trigger('keydown', { key: 'Escape' });
    expect(input.attributes('aria-expanded')).toBe('false');
    expect(outerKeydown).not.toHaveBeenCalled();
    await input.trigger('keydown', { key: 'Escape' });
    expect(outerKeydown).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', outerKeydown);
  });

  it('keeps local results first and ignores an older asynchronous search response', async () => {
    vi.useFakeTimers();
    let resolveFirst;
    const first = new Promise(resolve => { resolveFirst = resolve; });
    const searchSuggestions = vi.fn(query => query === 'Ham'
      ? first
      : Promise.resolve(['Berlin Mitte', 'Hamburg Hbf']));
    const input = render({ searchSuggestions });
    await input.setValue('Ham');
    await wrapper.setProps({ modelValue: 'Ham' });
    await vi.advanceTimersByTimeAsync(300);
    expect(searchSuggestions).toHaveBeenCalledWith('Ham');
    await input.setValue('Ber');
    await wrapper.setProps({ modelValue: 'Ber' });
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(list().findAll('[role="option"]').map(option => option.text())).toEqual(['Berlin Hbf', 'Berlin Mitte', 'Hamburg Hbf']);
    resolveFirst(['Stale address']);
    await flushPromises();
    expect(list().text()).not.toContain('Stale address');
  });

  it('cancels pending results when disabled and exposes no dropdown', async () => {
    vi.useFakeTimers();
    let resolveSearch;
    const searchSuggestions = vi.fn(() => new Promise(resolve => { resolveSearch = resolve; }));
    const input = render({ searchSuggestions });
    await input.setValue('Hamburg');
    await wrapper.setProps({ modelValue: 'Hamburg' });
    await vi.advanceTimersByTimeAsync(300);
    await wrapper.setProps({ disabled: true });
    expect(input.attributes('disabled')).toBeDefined();
    expect(input.attributes('aria-expanded')).toBe('false');
    resolveSearch(['Remote result']);
    await flushPromises();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('does not show results for an address replaced externally by the parent', async () => {
    vi.useFakeTimers();
    let resolveSearch;
    const input = render({ searchSuggestions: () => new Promise(resolve => { resolveSearch = resolve; }) });
    await input.setValue('Hamburg');
    await wrapper.setProps({ modelValue: 'Hamburg' });
    await vi.advanceTimersByTimeAsync(300);
    await wrapper.setProps({ modelValue: 'Berlin' });
    resolveSearch(['Alter Treffer']);
    await flushPromises();
    expect(list().text()).not.toContain('Alter Treffer');
  });
});
