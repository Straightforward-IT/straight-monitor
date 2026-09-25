import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import RecordChronikTimeline from '../src/components/workflow/RecordChronikTimeline.vue';
import { useRecordChronik } from '../src/composables/useRecordChronik';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));

const items = [
  { kind: 'comment', key: 'comment:one', entry: { _id: 'one', author: 'Ada Admin', authorId: 'admin', createdAt: '2026-09-24T09:00:00.000Z', text: 'Manuelle Notiz' } },
  { kind: 'divider', key: '__divider__' },
  { kind: 'activity', key: 'activity:one', activity: { _id: 'activity-one' } },
];

function render(props = {}) {
  return mount(RecordChronikTimeline, {
    props: { items, draft: '', currentUserName: 'Ada Admin', canDelete: (entry) => entry.authorId === 'admin', ...props },
    global: { stubs: { 'font-awesome-icon': true } },
    slots: { item: '<div class="supplemental">{{ item.kind }}</div>' },
  });
}

describe('RecordChronikTimeline', () => {
  it('renders comment and supplemental items through one shared timeline', () => {
    const wrapper = render();
    expect(wrapper.text()).toContain('Manuelle Notiz');
    expect(wrapper.text()).toContain('Jetzt');
    expect(wrapper.find('.supplemental').text()).toBe('activity');
  });

  it('emits composer and deletion intents without owning persistence', async () => {
    const wrapper = render({ draft: 'Neue Notiz' });
    await wrapper.find('button[title="Löschen"]').trigger('click');
    await wrapper.find('button.btn').trigger('click');
    expect(wrapper.emitted('delete')).toEqual([['one']]);
    expect(wrapper.emitted('add')).toHaveLength(1);
    await wrapper.find('textarea').setValue('Geändert');
    expect(wrapper.emitted('update:draft')).toEqual([['Geändert']]);
  });

  it('keeps loading and empty states reusable', () => {
    const wrapper = render({ items: [], loading: true, composer: false });
    expect(wrapper.text()).not.toContain('Noch keine Einträge.');
    expect(wrapper.find('textarea').exists()).toBe(false);
  });
});

describe('useRecordChronik', () => {
  it('clears the old record and ignores a late response after a record switch', async () => {
    let resolveFirst;
    mocks.api.get.mockReset();
    mocks.api.get.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [{ _id: 'second', text: 'Aktuelle Chronik' }] });
    const recordId = ref('first');
    let chronik;
    const wrapper = mount(defineComponent({ setup() { chronik = useRecordChronik({ recordId, scope: 'test', resourceType: 'Test', currentUserId: 'user' }); return () => null; } }));
    await flushPromises();
    recordId.value = 'second';
    await flushPromises();
    resolveFirst({ data: [{ _id: 'first', text: 'Veraltete Chronik' }] });
    await flushPromises();
    expect(mocks.api.get.mock.calls.map((call) => call[1].params.resourceId)).toEqual(['first', 'second']);
    expect(chronik.entries.value).toEqual([{ _id: 'second', text: 'Aktuelle Chronik' }]);
    wrapper.unmount();
  });

  it('normalizes a selected record object before it reaches the comments API', async () => {
    mocks.api.get.mockReset();
    mocks.api.get.mockResolvedValue({ data: [] });
    const selectedRecord = ref({ _id: '66f558ed3d8b9cde0c9b7f2d' });
    const wrapper = mount(defineComponent({ setup() { useRecordChronik({ recordId: selectedRecord, scope: 'test', resourceType: 'Test' }); return () => null; } }));
    await flushPromises();
    expect(mocks.api.get).toHaveBeenCalledWith('/api/comments', { params: { scope: 'test', resourceId: '66f558ed3d8b9cde0c9b7f2d' } });
    wrapper.unmount();
  });
});
