import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TimeManagement from '../src/components/ui-elements/TimeManagement.vue';
import TimeDayEntryModal from '../src/components/Modals/TimeDayEntryModal.vue';
import HoverDataCard from '../src/components/ui-elements/HoverDataCard.vue';
import { timeManagementEmployee, timeManagementFixture } from '../src/components/dev/timeManagementFixture.js';

let wrapper;
function render(initialData = timeManagementFixture()) {
  wrapper = mount(TimeManagement, { attachTo: document.body, global: { stubs: { 'font-awesome-icon': true } }, props: {
    employee: timeManagementEmployee, month: '2026-09', initialData,
  } });
  return wrapper;
}
const target = id => {
  const detailTarget = wrapper.find(`.tm-details [data-time-target="${id}"]`);
  return detailTarget.exists() ? detailTarget : wrapper.get(`[data-time-target="${id}"]`);
};
const button = text => wrapper.findAll('button').find(item => item.text().includes(text));
const bucket = () => wrapper.get('[data-testid="bucket-total"]').text();
async function key(type, options) { window.dispatchEvent(new KeyboardEvent(type, options)); await nextTick(); }
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = ''; });

describe('TimeManagement interactions', () => {
  it('shows all 30 days, fixed employee HoverDataCard and untouched fixture inputs', async () => {
    render(); expect(wrapper.findAll('[data-day]')).toHaveLength(30);
    expect(wrapper.get('[aria-label="Monatsstunden"]').text()).toContain('Max Mustermann');
    expect(wrapper.get('[aria-label="Monatsstunden"]').text()).toContain('110:00 h');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
    await target('shift-a').trigger('contextmenu', { button: 2 });
    expect(wrapper.props('initialData').entries.find(e => e.id === 'shift-a').minutes).toBe(480);
  });

  it('right collects, left drops one hour, Shift drops all and updates fixed projection', async () => {
    render();
    await target('shift-a').trigger('contextmenu', { button: 2 });
    await target('shift-a').trigger('contextmenu', { button: 2 });
    expect(bucket()).toContain('2:00 h');
    expect(button('Demo speichern').attributes('disabled')).toBeDefined();
    await target('bank').trigger('click'); expect(bucket()).toContain('1:00 h');
    expect(target('bank').text()).toContain('25:00 h');
    await target('bank').trigger('click', { shiftKey: true }); expect(bucket()).toContain('leer');
    expect(wrapper.get('[aria-label="Monatsstunden"]').text()).toContain('108:00 h');
    await button('Rückgängig').trigger('click'); expect(target('bank').text()).toContain('24:00 h');
    expect(target('shift-a').text()).toContain('8:00 h');
  });

  it('changes an entry type through the left type control without changing minutes', async () => {
    render();
    const entry = wrapper.get('.time-month-matrix [data-time-target="shift-09"]');
    await entry.get('.tm-entry__type').trigger('click');
    const menu = wrapper.get('[role="menu"]');
    await menu.findAll('button').find(button => button.text().includes('Krank (mit Lohnfortzahlung)')).trigger('click');
    expect(entry.get('.tm-entry__type').text()).toBe('K');
    expect(entry.text()).toContain('7:00');
    expect(wrapper.get('[aria-label="Monatsstunden"]').text()).toContain('110:00 h');
  });

  it('opens related time capture when a locked assignment is clicked', async () => {
    render({
      ...timeManagementFixture(),
      entries: [{ id: 'pending-shift', einsatzId: 'pending-shift', auftragNr: 9100001, date: '2026-09-09', code: 'O', label: 'Ausstehender Einsatz', kind: 'planned', credited: false, minutes: 480, locked: true }],
    });
    expect(wrapper.get('[aria-label="Monatsstunden"]').text()).toContain('8:00 h');
    await wrapper.get('.tm-entry--locked .tm-entry__hours').trigger('click');
    expect(wrapper.emitted('openCapture')[0][0]).toMatchObject({ auftragNr: 9100001, einsatzId: 'pending-shift' });
  });

  it('Escape returns a mixed bucket and partial drops, including new empty-day destinations', async () => {
    render();
    await target('shift-a').trigger('contextmenu', { button: 2, shiftKey: true });
    await target('shift-b').trigger('contextmenu', { button: 2 });
    await target('day:2026-09-06').trigger('click');
    expect(wrapper.find('[data-time-target="correction-2026-09-06"]').exists()).toBe(true);
    await key('keydown', { key: 'Escape' });
    expect(target('shift-a').text()).toContain('8:00 h');
    expect(target('shift-b').text()).toContain('6:00 h');
    expect(bucket()).toContain('leer');
    expect(wrapper.find('[data-time-target="correction-2026-09-06"]').exists()).toBe(false);
  });

  it.each(['Meta', 'Control'])('modifier %s slider stages minutes and commits only on release', async modifier => {
    render();
    const flag = modifier === 'Meta' ? 'metaKey' : 'ctrlKey';
    await target('shift-a').trigger('contextmenu', { button: 2, [flag]: true });
    let range = document.querySelector('[aria-label="Minuten"]');
    expect(range).not.toBeNull(); expect(bucket()).toContain('leer');
    range.value = '37'; range.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
    await key('keyup', { key: modifier });
    expect(bucket()).toContain('0:37 h'); expect(document.querySelector('[aria-label="Minuten"]')).toBeNull();
    await target('bank').trigger('click', { [flag]: true });
    range = document.querySelector('[aria-label="Minuten"]');
    expect(range.max).toBe('37'); range.value = '17'; range.dispatchEvent(new Event('input', { bubbles: true }));
    await key('keyup', { key: modifier });
    expect(bucket()).toContain('0:20 h'); expect(target('bank').text()).toContain('24:17 h');
    await key('keydown', { key: 'Escape' }); expect(target('bank').text()).toContain('24:00 h');
  });

  it('focus loss cancels a staged slider without silently committing', async () => {
    render(); await target('shift-a').trigger('contextmenu', { button: 2, metaKey: true });
    window.dispatchEvent(new Event('blur')); await nextTick();
    await key('keyup', { key: 'Meta' }); expect(bucket()).toContain('leer');
  });

  it('normal click mode works without right-click and exact minutes can be confirmed by button', async () => {
    render(); await button('Sammeln').trigger('click'); await button('Minuten').trigger('click');
    await target('shift-a').trigger('click');
    const input = document.querySelector('[aria-label="Exakte Minuten"]');
    input.value = '45'; input.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
    document.querySelector('.tm-minute-picker .tm-button').click(); await nextTick();
    expect(bucket()).toContain('0:45 h');
    await button('Minuten').trigger('click'); await button('Ablegen').trigger('click');
    await target('bank').trigger('click'); expect(target('bank').text()).toContain('24:45 h');
  });

  it('saves a detached payload and reverts to that saved baseline', async () => {
    render(); await target('shift-a').trigger('contextmenu', { button: 2 }); await target('bank').trigger('click');
    await button('Demo speichern').trigger('click');
    const payload = wrapper.emitted('save')[0][0];
    expect(payload.bankMinutes).toBe(1500); expect(payload.employeeId).toBe(timeManagementEmployee.id);
    await target('bank').trigger('contextmenu', { button: 2 }); await target('shift-b').trigger('click');
    await button('Verwerfen').trigger('click'); expect(target('bank').text()).toContain('25:00 h');
    expect(payload.bankMinutes).toBe(1500);
  });

  it('opens a day-entry modal and adds a zero-hour absence as a bucket target', async () => {
    render(); await button('Tageseintrag').trigger('click');
    const modal = wrapper.getComponent(TimeDayEntryModal);
    modal.vm.$emit('create', { date: '2026-09-16', code: 'U', label: 'Urlaub (bezahlt)', kind: 'vacation', minutes: 0, credited: true });
    await nextTick();
    const created = wrapper.get('.tm-data-table tbody tr');
    expect(created.text()).toContain('Urlaub (bezahlt)');
    await target('bank').trigger('contextmenu', { button: 2 }); await created.get('.tm-table-time').trigger('click');
    expect(created.text()).toContain('1:00 h');
  });
});

describe('HoverDataCard inline presentation', () => {
  it('can switch from inline to normal hover mode without losing the trigger', async () => {
    wrapper = mount(HoverDataCard, { props: { inline: true } });
    expect(wrapper.get('[aria-label="Monatsstunden"]').text()).toContain('Max Mustermann');
    await wrapper.setProps({ inline: false });
    expect(wrapper.find('[aria-label="Monatsstunden"]').exists()).toBe(false);
    expect(wrapper.get('button').text()).toBe('Monatsübersicht');
  });
});

describe('day-entry form', () => {
  it('validates FA bank availability and emits exact minutes and chosen credit', async () => {
    wrapper = mount(TimeDayEntryModal, { props: { month: '2026-09', initialDate: '2026-09-16', bankMinutes: 30 },
      global: { stubs: { ModalFrame: { template: '<div><slot /><slot name="footer" /></div>' } } } });
    await wrapper.get('select').setValue('FA');
    await wrapper.findAll('input[type="number"]')[0].setValue(1); await wrapper.get('form').trigger('submit');
    expect(wrapper.get('[role="alert"]').text()).toContain('reicht das Zeitkonto nicht');
    expect(wrapper.emitted('create')).toBeUndefined();
    await wrapper.findAll('input[type="number"]')[0].setValue(0);
    await wrapper.findAll('input[type="number"]')[1].setValue(15); await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('create')[0][0]).toMatchObject({ code: 'FA', minutes: 15, credited: true });
  });
});
