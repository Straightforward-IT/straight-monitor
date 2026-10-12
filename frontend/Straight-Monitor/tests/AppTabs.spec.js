import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import AppTabs from '../src/components/ui-elements/AppTabs.vue';
import PageLayout from '../src/components/layout/PageLayout.vue';

const tabs = [
  { id: 'first', label: 'Erste', panelId: 'first-panel' },
  { id: 'disabled', label: 'Gesperrt', disabled: true },
  { id: 'last', label: 'Letzte', panelId: 'last-panel' },
];

describe('AppTabs', () => {
  it('links tab buttons to their panels and supports compact wrapping tabs', () => {
    const wrapper = mount(AppTabs, {
      props: { tabs, modelValue: 'first', label: 'Lohnarten', idPrefix: 'wages', size: 'sm', wrap: true },
    });
    const navigation = wrapper.get('[role="tablist"]');
    expect(navigation.attributes('aria-label')).toBe('Lohnarten');
    expect(navigation.classes()).toEqual(expect.arrayContaining(['app-tabs--sm', 'app-tabs--wrap']));
    const buttons = wrapper.findAll('[role="tab"]');
    expect(buttons[0].attributes('id')).toBe('wages-first');
    expect(buttons[0].attributes('aria-controls')).toBe('first-panel');
    expect(buttons.map(button => button.attributes('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(buttons[1].attributes('disabled')).toBeDefined();
    expect(buttons[1].attributes('aria-controls')).toBeUndefined();
    wrapper.unmount();
  });

  it('emits changed enabled selections and ignores active or disabled clicks', async () => {
    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'first' } });
    const buttons = wrapper.findAll('[role="tab"]');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    await buttons[2].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['last']]);
    expect(buttons[0].attributes('id')).toBeUndefined();
    expect(wrapper.find('[aria-label="Weitere Tabs anzeigen"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('moves selection and focus across enabled tabs with wrapping, Home, and End', async () => {
    const wrapper = mount(AppTabs, {
      attachTo: document.body,
      props: {
        tabs, modelValue: 'first',
        'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }),
      },
    });
    try {
      const buttons = wrapper.findAll('[role="tab"]');
      expect(buttons.map(button => button.attributes('tabindex'))).toEqual(['0', '-1', '-1']);
      await buttons[0].trigger('keydown', { key: 'ArrowRight' });
      expect(document.activeElement).toBe(buttons[2].element);
      expect(buttons.map(button => button.attributes('tabindex'))).toEqual(['-1', '-1', '0']);
      expect(buttons[2].attributes('aria-selected')).toBe('true');
      await buttons[2].trigger('keydown', { key: 'ArrowRight' });
      expect(document.activeElement).toBe(buttons[0].element);
      await buttons[0].trigger('keydown', { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(buttons[2].element);
      await buttons[2].trigger('keydown', { key: 'Home' });
      expect(document.activeElement).toBe(buttons[0].element);
      await buttons[0].trigger('keydown', { key: 'End' });
      expect(document.activeElement).toBe(buttons[2].element);
      await buttons[2].trigger('keydown', { key: 'Escape' });
      expect(wrapper.emitted('update:modelValue')).toEqual([['last'], ['first'], ['last'], ['first'], ['last']]);
    } finally {
      wrapper.unmount();
    }
  });

  it('keeps an enabled tab reachable when selection is absent and no disabled tab in the tab order', async () => {
    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'missing' } });
    expect(wrapper.findAll('[role="tab"]').map(button => button.attributes('tabindex'))).toEqual(['0', '-1', '-1']);
    await wrapper.setProps({ tabs: tabs.map(tab => ({ ...tab, disabled: true })), modelValue: 'first' });
    const buttons = wrapper.findAll('[role="tab"]');
    expect(buttons.every(button => button.attributes('tabindex') === '-1')).toBe(true);
    await buttons[0].trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });

  it('scrolls overflow with sibling arrow controls and refreshes their edge state', async () => {
    let observer;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) {
        observer = this;
        this.callback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
      }
    });
    const wrapper = mount(AppTabs, { props: { tabs, modelValue: 'first', scrollControls: true, size: 'sm' } });
    try {
      const navigation = wrapper.get('[role="tablist"]');
      const previous = wrapper.get('[aria-label="Vorherige Tabs anzeigen"]');
      const next = wrapper.get('[aria-label="Weitere Tabs anzeigen"]');
      let contentWidth = 300;
      let viewportWidth = 100;
      Object.defineProperties(navigation.element, {
        clientWidth: { configurable: true, get: () => viewportWidth },
        scrollWidth: { configurable: true, get: () => contentWidth },
      });
      navigation.element.scrollTo = vi.fn(({ left }) => { navigation.element.scrollLeft = left; });
      observer.callback();
      await nextTick();
      expect(observer.observe).toHaveBeenCalledWith(navigation.element);
      expect(observer.observe).toHaveBeenCalledWith(navigation.get('[data-tab-id="first"]').element);
      expect(navigation.find('[aria-label="Weitere Tabs anzeigen"]').exists()).toBe(false);
      expect(previous.element.parentElement).toBe(navigation.element.parentElement);
      expect(next.element.parentElement).toBe(navigation.element.parentElement);
      expect(previous.attributes('disabled')).toBeDefined();
      expect(next.attributes('disabled')).toBeUndefined();
      await next.trigger('click');
      expect(navigation.element.scrollTo).toHaveBeenLastCalledWith({ left: 80, behavior: 'smooth' });
      expect(previous.attributes('disabled')).toBeUndefined();
      await next.trigger('click');
      await next.trigger('click');
      expect(navigation.element.scrollLeft).toBe(200);
      expect(next.attributes('disabled')).toBeDefined();
      await previous.trigger('click');
      expect(navigation.element.scrollLeft).toBe(120);
      navigation.element.scrollLeft = 0;
      await navigation.trigger('scroll');
      expect(previous.attributes('disabled')).toBeDefined();
      contentWidth = 100;
      observer.callback();
      await nextTick();
      expect(next.attributes('disabled')).toBeDefined();
      contentWidth = 400;
      await wrapper.setProps({ tabs: tabs.map(tab => ({ ...tab, label: `${tab.label} ergänzt` })) });
      await nextTick();
      expect(next.attributes('disabled')).toBeUndefined();
      viewportWidth = 400;
      window.dispatchEvent(new Event('resize'));
      await nextTick();
      expect(next.attributes('disabled')).toBeDefined();
    } finally {
      const disconnects = observer.disconnect.mock.calls.length;
      wrapper.unmount();
      expect(observer.disconnect).toHaveBeenCalledTimes(disconnects + 1);
      vi.unstubAllGlobals();
    }
  });

  it('reveals tabs selected by keyboard while keeping focus and selection on the tab buttons', async () => {
    const wrapper = mount(AppTabs, {
      attachTo: document.body,
      props: {
        tabs, modelValue: 'first', scrollControls: true,
        'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }),
      },
    });
    try {
      const navigation = wrapper.get('[role="tablist"]');
      const buttons = navigation.findAll('[role="tab"]');
      Object.defineProperties(navigation.element, {
        clientWidth: { configurable: true, value: 100 },
        scrollWidth: { configurable: true, value: 300 },
      });
      navigation.element.scrollTo = vi.fn(({ left }) => { navigation.element.scrollLeft = left; });
      navigation.element.getBoundingClientRect = () => ({ left: 10, right: 110 });
      buttons[0].element.getBoundingClientRect = () => ({ left: 10 - navigation.element.scrollLeft, right: 60 - navigation.element.scrollLeft });
      buttons[2].element.getBoundingClientRect = () => ({ left: 210 - navigation.element.scrollLeft, right: 270 - navigation.element.scrollLeft });
      await buttons[0].trigger('keydown', { key: 'End' });
      expect(document.activeElement).toBe(buttons[2].element);
      expect(buttons[2].attributes('aria-selected')).toBe('true');
      expect(navigation.element.scrollTo).toHaveBeenLastCalledWith({ left: 160, behavior: 'auto' });
      await buttons[2].trigger('keydown', { key: 'Home' });
      expect(document.activeElement).toBe(buttons[0].element);
      expect(navigation.element.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' });
    } finally {
      wrapper.unmount();
    }
  });
});

describe('PageLayout tab delegation', () => {
  it('preserves the page API, default tab appearance, nav class, and selection events', async () => {
    const wrapper = mount(PageLayout, {
      props: { title: 'Stunden', tabs, modelValue: 'first', ariaLabel: 'Stundenbereiche', width: 'full', contentVariant: 'flush' },
      slots: { default: '<p>Seiteninhalt</p>' },
    });
    const navigation = wrapper.getComponent(AppTabs);
    expect(navigation.props()).toMatchObject({ tabs, modelValue: 'first', label: 'Stundenbereiche', size: 'md', wrap: false });
    expect(navigation.get('[role="tablist"]').classes()).toContain('page-layout__tabs');
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['page-layout--full', 'page-layout--tabbed']));
    expect(wrapper.get('.page-layout__content--flush').text()).toBe('Seiteninhalt');
    await navigation.get('[data-tab-id="last"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['last']]);
    await wrapper.setProps({ tabs: [] });
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
