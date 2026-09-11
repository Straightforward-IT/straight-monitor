import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import OrderChronikTimeline from '../src/components/orders/OrderChronikTimeline.vue';

const mocks = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() }, auth: null }));
vi.mock('@/utils/api', () => ({ default: mocks.api }));
vi.mock('@/stores/auth', () => ({ useAuth: () => mocks.auth }));

const change = (id, summary = `Änderung ${id}`) => ({
  _id: id, kind: 'change', actor: { id: 'planner', name: 'Anna Planung' }, createdAt: '2026-09-11T08:30:00.000Z', summary,
  changes: [{ entity: 'Einsatz', entityId: 'assignment', label: 'Mara Muster (#123)', action: 'updated',
    fields: [{ field: 'personalNr', label: 'Mitarbeiter', before: 122, beforeLabel: 'Kai Test (#122)', after: 123, afterLabel: 'Mara Muster (#123)' }] }],
});
const note = (id, owner = 'admin', text = 'Abgesprochen mit dem Kunden.') => ({
  _id: id, kind: 'note', actor: { id: owner, name: owner === 'admin' ? 'Admin Test' : 'Anderer Admin' }, createdAt: '2026-09-11T09:00:00.000Z', text,
});
const page = (entries, nextCursor = null) => ({ data: { entries, nextCursor } });
function deferred() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
let wrapper;
function render(props = {}) { wrapper = mount(OrderChronikTimeline, { props: { auftragNr: 123, ...props } }); return wrapper; }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth = reactive({ user: { _id: 'admin', name: 'Admin Test', role: 'Admin', roles: [] } });
  mocks.api.get.mockResolvedValue(page([]));
});
afterEach(() => { wrapper?.unmount(); wrapper = undefined; });

describe('OrderChronikTimeline', () => {
  it('renders no controls and sends no requests for non-Admins, and accepts normalized roles', async () => {
    mocks.auth.user.role = 'Disponent';
    render();
    await flushPromises();
    expect(mocks.api.get).not.toHaveBeenCalled();
    expect(wrapper.find('.order-chronik').exists()).toBe(false);
    mocks.auth.user.roles = ['aDmIn'];
    await flushPromises();
    expect(mocks.api.get).toHaveBeenCalledTimes(1);
    expect(wrapper.find('textarea').exists()).toBe(true);
  });

  it('shows stable names and field differences, and appends older pages without duplicates', async () => {
    mocks.api.get.mockResolvedValueOnce(page([change('new')], 'cursor-1'))
      .mockResolvedValueOnce(page([change('new'), change('old')]));
    render();
    await flushPromises();
    expect(wrapper.text()).toContain('Anna Planung');
    expect(wrapper.find('time').attributes('datetime')).toBe('2026-09-11T08:30:00.000Z');
    expect(wrapper.find('table').text()).toContain('Kai Test (#122)');
    expect(wrapper.find('table').text()).toContain('Mara Muster (#123)');
    await wrapper.find('.chronik-more').trigger('click');
    await flushPromises();
    expect(mocks.api.get.mock.calls[1][1].params).toEqual({ limit: 30, cursor: 'cursor-1' });
    expect(wrapper.findAll('.chronik-entry')).toHaveLength(2);
    expect(wrapper.find('.chronik-more').exists()).toBe(false);
  });

  it('discards an old order response even when the transport ignores abort', async () => {
    const old = deferred();
    mocks.api.get.mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([change('second', 'Neuer Auftrag')]));
    render();
    const signal = mocks.api.get.mock.calls[0][1].signal;
    await wrapper.find('textarea').setValue('Unsaved old note');
    await wrapper.setProps({ auftragNr: 456 });
    await flushPromises();
    expect(signal.aborted).toBe(true);
    old.resolve(page([change('first', 'Alter Auftrag')]));
    await flushPromises();
    expect(wrapper.text()).toContain('Neuer Auftrag');
    expect(wrapper.text()).not.toContain('Alter Auftrag');
    expect(wrapper.find('textarea').element.value).toBe('');
  });

  it('retains the latest refresh when an earlier request finishes last', async () => {
    const first = deferred();
    mocks.api.get.mockReturnValueOnce(first.promise).mockResolvedValueOnce(page([change('new', 'Aktueller Stand')]));
    render();
    await wrapper.setProps({ revision: 1 });
    await flushPromises();
    first.resolve(page([change('stale', 'Veralteter Stand')]));
    await flushPromises();
    expect(wrapper.text()).toContain('Aktueller Stand');
    expect(wrapper.text()).not.toContain('Veralteter Stand');
    expect(wrapper.attributes('aria-busy')).toBe('false');
  });

  it('clears history and cancels pending reads when Admin access is revoked', async () => {
    const pending = deferred();
    mocks.api.get.mockResolvedValueOnce(page([change('old')])).mockReturnValueOnce(pending.promise);
    render();
    await flushPromises();
    await wrapper.setProps({ revision: 1 });
    const signal = mocks.api.get.mock.calls[1][1].signal;
    mocks.auth.user.role = 'Disponent';
    await nextTick();
    expect(signal.aborted).toBe(true);
    pending.resolve(page([change('private')]));
    await flushPromises();
    expect(wrapper.find('.order-chronik').exists()).toBe(false);
    expect(mocks.api.get).toHaveBeenCalledTimes(2);
  });

  it('clears previously loaded rows on a server-side permission denial', async () => {
    mocks.api.get.mockResolvedValueOnce(page([change('old')], 'cursor'))
      .mockRejectedValueOnce({ response: { status: 403, data: { message: 'Nur für Admins.' } } });
    render();
    await flushPromises();
    await wrapper.setProps({ revision: 1 });
    await flushPromises();
    expect(wrapper.findAll('.chronik-entry')).toHaveLength(0);
    expect(wrapper.find('.chronik-more').exists()).toBe(false);
    expect(wrapper.find('[role="alert"]').text()).toBe('Nur für Admins.');
  });

  it('saves trimmed plain-text notes and exposes deletion only for the author', async () => {
    const text = '<img src=x onerror=alert(1)> Besprochen';
    mocks.api.get.mockResolvedValueOnce(page([note('other', 'other-admin'), change('automatic')]))
      .mockResolvedValueOnce(page([note('mine', 'admin', text), note('other', 'other-admin'), change('automatic')]));
    mocks.api.post.mockResolvedValue({ data: note('mine', 'admin', text) });
    render();
    await flushPromises();
    expect(wrapper.find('.chronik-delete').exists()).toBe(false);
    await wrapper.find('textarea').setValue(`  ${text}  `);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(mocks.api.post).toHaveBeenCalledWith('/api/auftraege/123/chronik/notes', { text });
    expect(wrapper.find('textarea').element.value).toBe('');
    expect(wrapper.find('.chronik-note').text()).toBe(text);
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.findAll('.chronik-delete')).toHaveLength(1);
  });

  it('prevents an in-flight read from resurrecting a deleted note', async () => {
    const stale = deferred();
    mocks.api.get.mockResolvedValueOnce(page([note('mine')])).mockReturnValueOnce(stale.promise).mockResolvedValueOnce(page([]));
    mocks.api.delete.mockResolvedValue({ data: { ok: true } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render();
    await flushPromises();
    await wrapper.setProps({ revision: 1 });
    await wrapper.find('.chronik-delete').trigger('click');
    await flushPromises();
    stale.resolve(page([note('mine')]));
    await flushPromises();
    expect(mocks.api.delete).toHaveBeenCalledWith('/api/auftraege/123/chronik/mine');
    expect(wrapper.findAll('.chronik-entry')).toHaveLength(0);
  });

  it('aborts its request on unmount', () => {
    mocks.api.get.mockReturnValueOnce(deferred().promise);
    render();
    const signal = mocks.api.get.mock.calls[0][1].signal;
    wrapper.unmount(); wrapper = undefined;
    expect(signal.aborted).toBe(true);
  });
});
