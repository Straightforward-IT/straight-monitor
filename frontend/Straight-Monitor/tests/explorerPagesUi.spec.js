import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createModalDock } from '@bleck-it/vue-modal-dock';
import GraphMailboxDashboard from '@/components/GraphMailboxDashboard.vue';
import OneDriveDashboard from '@/components/OneDriveDashboard.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn() },
  route: { query: {} },
  router: { replace: vi.fn().mockResolvedValue() },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/utils/htmlToPdfService', () => ({ exportElementToPdf: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => mocks.route, useRouter: () => mocks.router }));

let wrapper;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.route.query = {};
  mocks.router.replace.mockResolvedValue();
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
});

describe('Graph explorer pages', () => {
  it('keeps mailbox tree selection and uses a shared refresh action', async () => {
    mocks.api.get.mockImplementation(url => Promise.resolve({ data:
      url.endsWith('/accounts') ? { accounts: [{ key: 'team', displayName: 'Team', upn: 'team@example.com' }] }
        : url.endsWith('/tree') ? { folders: [{ id: 'folder', displayName: 'Inbox', totalItemCount: 2, unreadItemCount: 1, children: [] }] }
          : { folder: { id: 'folder', displayName: 'Inbox', totalItemCount: 2, unreadItemCount: 1, childFolderCount: 0 }, recentMessages: [], largestMessages: [] },
    }));
    wrapper = mount(GraphMailboxDashboard, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find('button.app-button--secondary').text()).toBe('Neu laden');
    expect(wrapper.find('button.folder-tree__item[aria-pressed="true"]').text()).toContain('Inbox');
    await wrapper.find('button.app-button--secondary').trigger('click');
    await flushPromises();
    expect(mocks.api.get).toHaveBeenCalledWith('/api/graph/mailboxes/tree', expect.any(Object));
  });

  it('opens OneDrive previews in ModalFrame and keeps upload controls', async () => {
    mocks.api.get.mockImplementation(url => Promise.resolve({ data:
      url.endsWith('/accounts') ? { accounts: [{ key: 'team', displayName: 'Team', upn: 'team@example.com' }] }
        : url.endsWith('/tree') ? { items: [{ id: 'folder', name: 'Ablage', childCount: 0 }] }
          : url.endsWith('/children') ? { items: [{ id: 'image', name: 'bild.png', isFolder: false, mimeType: 'image/png', downloadUrl: 'https://example.com/bild.png', size: 1024 }] }
            : { previewUrl: '' },
    }));
    wrapper = mount(OneDriveDashboard, {
      attachTo: document.body,
      global: { plugins: [createModalDock()], stubs: { 'font-awesome-icon': true } },
    });
    await flushPromises();
    expect(wrapper.find('button.app-button--secondary').text()).toBe('Neu laden');
    expect(wrapper.find('input[aria-label="Datei für OneDrive-Upload auswählen"]').exists()).toBe(true);
    await wrapper.find('button[aria-label="bild.png als Vorschau öffnen"]').trigger('click');
    await flushPromises();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('bild.png');
    expect(dialog.querySelector('img.preview-modal__img')).not.toBeNull();
    dialog.querySelector('button[aria-label="Schließen"]').click();
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
