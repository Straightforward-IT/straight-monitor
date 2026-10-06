import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import LeadDetailSectionHeading from '@/components/leads/LeadDetailSectionHeading.vue';

describe('Lead detail section heading', () => {
  it('renders a semantic mobile disclosure and emits toggles', async () => {
    const wrapper = mount(LeadDetailSectionHeading, {
      props: { title: 'Dateien', icon: ['fas', 'paperclip'], mobile: true, expanded: false, count: 2 },
      global: { stubs: { 'font-awesome-icon': true } },
    });
    const button = wrapper.get('h4 button');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.text()).toContain('Dateien');
    expect(button.text()).toContain('2');
    await button.trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('keeps desktop headings noninteractive', () => {
    const wrapper = mount(LeadDetailSectionHeading, {
      props: { title: 'Kontakte', icon: ['fas', 'address-book'], mobile: false },
      global: { stubs: { 'font-awesome-icon': true } },
    });
    expect(wrapper.get('h4').text()).toContain('Kontakte');
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
