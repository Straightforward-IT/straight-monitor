import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import WorkflowBoard from '../src/components/workflow/WorkflowBoard.vue';

const columns = [{ id: 'new', label: 'New' }, { id: 'done', label: 'Done' }];
const records = [{ _id: 'one', stage: 'new' }, { _id: 'two', stage: 'done' }];

const DraggableStub = {
  name: 'draggable',
  props: ['modelValue'],
  emits: ['change'],
  template: '<div class="draggable-stub"><slot v-for="(record, index) in modelValue" :element="record" :index="index" /></div>',
};

function render(props = {}) {
  return mount(WorkflowBoard, {
    props: { records, columns, stageKey: 'stage', fallbackColumnId: 'new', ...props },
    global: { stubs: { draggable: DraggableStub } },
    slots: { card: '<span class="card">Card</span>' },
  });
}

describe('WorkflowBoard', () => {
  it('groups records by configured column without mutating the records', () => {
    const source = records.map((record) => ({ ...record }));
    const wrapper = render({ records: source });
    expect(wrapper.findAll('.workflow-board__column')).toHaveLength(2);
    expect(wrapper.findAllComponents(DraggableStub).map((body) => body.props('modelValue').map((record) => record._id))).toEqual([['one'], ['two']]);
    expect(source).toEqual(records);
  });

  it('emits a persistence-neutral move only for an inter-column drag', async () => {
    const wrapper = render();
    const bodies = wrapper.findAllComponents(DraggableStub);
    bodies[1].vm.$emit('change', { added: { element: records[0] } });
    expect(wrapper.emitted('move')).toEqual([[{ record: records[0], fromColumnId: 'new', toColumnId: 'done' }]]);
    bodies[0].vm.$emit('change', { added: { element: records[0] } });
    expect(wrapper.emitted('move')).toHaveLength(1);
  });
});
