import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import HeaderBar from '../src/components/HeaderBar.vue';
import ModalFrame from '../src/components/frames/ModalFrame.vue';

vi.mock('@/stores/ui', () => ({ useUi: () => ({ toggle: vi.fn() }) }));
vi.mock('@/stores/theme', () => ({ useTheme: () => ({ isDark: false, setForUser: vi.fn() }) }));
vi.mock('@/stores/auth', () => ({ useAuth: () => ({ user: { name: 'Test', roles: ['ADMIN'] }, token: 'test' }) }));
vi.mock('@/stores/comments', () => ({ useComments: () => ({ unreadCount: 0 }) }));
vi.mock('vue-router', async importOriginal => ({
  ...(await importOriginal()),
  useRoute: () => ({ name: 'Dashboard', fullPath: '/dashboard', query: {} }),
}));
vi.mock('@/utils/api', () => ({ default: { post: vi.fn() } }));

const frameStub = {
  props: ['modelValue', 'closeOnEscape', 'closeOnBackdrop', 'showClose'],
  template: '<section v-if="modelValue" role="dialog"><slot /><slot name="footer" /></section>',
};

let wrapper;
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = '';
});

describe('ticket modal shared buttons', () => {
  it('uses semantic shared actions for files and submission, including the sending lock', async () => {
    wrapper = mount(HeaderBar, {
      attachTo: document.body,
      global: {
        mocks: { $route: { name: 'Dashboard', query: {} }, $router: { push: vi.fn() } },
        stubs: {
          ModalFrame: frameStub,
          CustomTooltip: { template: '<span><slot /></span>' },
          RouterLink: { template: '<a><slot /></a>' },
          'font-awesome-icon': true,
          CommentBubbleBadge: true,
        },
      },
    });
    wrapper.vm.showSupportModal = true;
    await wrapper.vm.$nextTick();

    const dialog = wrapper.get('[role="dialog"]');
    const choose = dialog.get('button.support-file-button');
    expect(choose.classes()).toContain('app-button--secondary');
    const fileInput = dialog.get('#support-files');
    const clickFileInput = vi.spyOn(fileInput.element, 'click');
    await choose.trigger('click');
    expect(clickFileInput).toHaveBeenCalledOnce();

    wrapper.vm.supportForm.files.push(new File(['text'], 'hinweis.txt', { type: 'text/plain' }));
    await wrapper.vm.$nextTick();
    const remove = dialog.get('button[aria-label="hinweis.txt entfernen"]');
    expect(remove.classes()).toContain('app-icon-button');
    await remove.trigger('click');
    expect(wrapper.vm.supportForm.files).toHaveLength(0);

    expect(dialog.findAll('button').find(button => button.text() === 'Senden').classes()).toContain('app-button--primary');
    wrapper.vm.isSubmitting = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.getComponent(ModalFrame).props()).toMatchObject({
      closeOnEscape: false, closeOnBackdrop: false, showClose: false,
    });
    expect(dialog.findAll('button').find(button => button.text() === 'Abbrechen').attributes('disabled')).toBeDefined();
    expect(dialog.findAll('button').find(button => button.text() === 'Wird gesendet...').attributes('disabled')).toBeDefined();
  });
});
