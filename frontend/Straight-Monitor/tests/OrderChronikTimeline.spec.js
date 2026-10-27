import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import OrderChronikTimeline from '../src/components/orders/OrderChronikTimeline.vue';
import OrderChronikDrawer from '../src/components/orders/OrderChronikDrawer.vue';
import AuftragDetailsSidePanel from '../src/components/orders/AuftragDetailsSidePanel.vue';
import { notifyAuftragMutation } from '../src/utils/auftragChanges.js';

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

  it('shows stable names and field differences, and appends older pages without duplicates in top-to-bottom chronological order', async () => {
    mocks.api.get.mockResolvedValueOnce(page([change('new', 'Neueste Änderung')], 'cursor-1'))
      .mockResolvedValueOnce(page([change('new', 'Neueste Änderung'), change('old', 'Älteste Änderung')]));
    render();
    await flushPromises();
    expect(wrapper.text()).toContain('Anna Planung');
    expect(wrapper.find('time').attributes('datetime')).toBe('2026-09-11T08:30:00.000Z');
    expect(wrapper.find('table').text()).toContain('Kai Test (#122)');
    expect(wrapper.find('table').text()).toContain('Mara Muster (#123)');
    await wrapper.find('.chronik-more').trigger('click');
    await flushPromises();
    expect(mocks.api.get.mock.calls[1][1].params).toEqual({ limit: 30, cursor: 'cursor-1' });
    const items = wrapper.findAll('.chronik-entry');
    expect(items).toHaveLength(2);
    expect(items[0].text()).toContain('Älteste Änderung');
    expect(items[1].text()).toContain('Neueste Änderung');
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
    expect(wrapper.findAll('.chronik-note').map(item => item.text())).toEqual(['Abgesprochen mit dem Kunden.', text]);
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

  it('displays the loaded entry count in OrderChronikDrawer and aligns offset with the leftmost open side panel', async () => {
    const pageContainer = document.createElement('div');
    pageContainer.className = 'auftraege-page';
    const detailPanel = document.createElement('aside');
    detailPanel.className = 'sp-panel';
    detailPanel.getBoundingClientRect = () => ({ left: 680, width: 420, top: 0, bottom: 800, right: 1100, height: 800 });
    const staffingPanel = document.createElement('aside');
    staffingPanel.className = 'admin-staffing-panel';
    staffingPanel.getBoundingClientRect = () => ({ left: 1100, width: 380, top: 0, bottom: 800, right: 1480, height: 800 });
    pageContainer.append(detailPanel, staffingPanel);
    document.body.appendChild(pageContainer);
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 1480, configurable: true });

    mocks.api.get.mockResolvedValueOnce(page([change('c1'), note('n1')]));
    wrapper = mount(OrderChronikDrawer, {
      attachTo: pageContainer,
      props: { auftragNr: 123, orderTitle: 'Messe Nord', revision: 0 },
    });
    await flushPromises();

    expect(wrapper.find('.cdf-count').text()).toBe('2');
    expect(wrapper.find('.cdf-context-title').text()).toBe('#123 · Messe Nord');
    expect(wrapper.find('.cdf-drawer').attributes('style')).toContain('--cdf-side-panel-offset: 800px');

    pageContainer.remove();
  });

  it('exposes the Admin Chronik toggle button in AuftragDetailsSidePanel only when enabled', async () => {
    const baseProps = {
      modelValue: true,
      event: { auftragNr: 123, eventTitel: 'Messe Nord', auftStatus: 2, vonDatum: '2026-09-11', bisDatum: '2026-09-11' },
      formatRange: () => '11.09.2026',
      statusClass: () => 'status-confirmed',
      statusText: () => 'Bestätigt',
    };
    wrapper = mount(AuftragDetailsSidePanel, {
      props: baseProps,
      global: { stubs: { 'font-awesome-icon': true } },
    });
    expect(wrapper.find('button[aria-label="Auftragschronik"]').exists()).toBe(false);

    await wrapper.setProps({ showChronikToggle: true, chronikOpen: true });
    const btn = wrapper.get('button[aria-label="Auftragschronik"]');
    expect(btn.attributes('aria-expanded')).toBe('true');
    expect(btn.attributes('aria-controls')).toBe('order-chronik-panel');
    await btn.trigger('click');
    expect(wrapper.emitted('toggle-chronik')).toHaveLength(1);
  });

  it('reloads OrderChronikDrawer when notifyAuftragMutation announces a change for the active order', async () => {
    mocks.api.get
      .mockResolvedValueOnce(page([change('c1', 'Erste Änderung')]))
      .mockResolvedValueOnce(page([change('c2', 'Zweite Änderung'), change('c1', 'Erste Änderung')]));

    const revision = reactive({ value: 0 });
    const activeAuftragNr = 123;
    const { onAuftragMutation } = await import('../src/utils/auftragChanges.js');
    const stop = onAuftragMutation((nr) => {
      if (Number(nr) === activeAuftragNr) revision.value++;
    });

    wrapper = mount(OrderChronikDrawer, {
      props: { auftragNr: activeAuftragNr, orderTitle: 'Messe Nord', revision: revision.value },
    });
    await flushPromises();
    expect(wrapper.find('.cdf-count').text()).toBe('1');
    expect(wrapper.text()).toContain('Erste Änderung');

    notifyAuftragMutation({ method: 'patch', url: '/api/auftraege/123/schichten/s1' });
    await wrapper.setProps({ revision: revision.value });
    await flushPromises();

    expect(wrapper.find('.cdf-count').text()).toBe('2');
    expect(wrapper.text()).toContain('Zweite Änderung');
    stop();
  });

  it('displays the Zvoove icon badge for Zvoove import entries and strips legacy Liste 7001 suffixes', async () => {
    mocks.api.get.mockResolvedValueOnce(
      page([
        {
          ...change('z1', 'Auftrag angelegt: Messe (Liste 7001)'),
          source: 'zvoove',
          actor: { id: 'zvoove', name: 'M. Dispo (Liste 7001)' },
        },
      ]),
    );
    render();
    await flushPromises();
    expect(wrapper.find('.chronik-author').text()).toBe('M. Dispo');
    expect(wrapper.find('.chronik-zvoove-badge img.chronik-zvoove-icon').exists()).toBe(true);
    expect(wrapper.find('.chronik-summary').text()).toContain('Auftrag angelegt: Messe');
  });

  it('renders interactive links for SignaturVorgang and Mitarbeiter in Chronik entries', async () => {
    mocks.api.get.mockResolvedValueOnce(
      page([
        {
          _id: 'sig-entry',
          kind: 'change',
          action: 'SignaturVorgang.completed',
          actor: { id: 'admin', name: 'Admin Test' },
          createdAt: '2026-09-11T10:00:00.000Z',
          summary: 'Stundenliste Signatur: Abgeschlossen (Stundenliste Messe)',
          changes: [{
            entity: 'SignaturVorgang',
            entityId: 'vorgang-1',
            signaturVorgangId: 'vorgang-1',
            typKey: 'stundenliste',
            label: 'Stundenliste Messe',
            action: 'updated',
            fields: [{ field: 'status', label: 'Status', before: 'open', after: 'completed', beforeLabel: 'Gestartet (Offen)', afterLabel: 'Abgeschlossen' }],
          }],
        },
        change('emp-entry', 'Einsatz geändert: Mara Muster (#123)'),
      ]),
    );
    render();
    await flushPromises();

    // Summary link chips for both the employee and the Stundenliste
    expect(wrapper.find('.chronik-inline-link--employee').text()).toContain('Mara Muster (#123)');
    expect(wrapper.find('.chronik-inline-link--signatur').text()).toContain('Stundenliste');
    // Clickable buttons in the expanded details and diff table
    expect(wrapper.findAll('.chronik-link-btn').length).toBeGreaterThanOrEqual(3);
  });

  it('differentiates Angelegt, Geändert, Gelöscht and Notiz pills and uses compact CustomTooltip rows for created/deleted items', async () => {
    mocks.api.get.mockResolvedValueOnce(
      page([
        note('n1', 'admin', 'Kurze Info'),
        {
          _id: 'del-entry',
          kind: 'change',
          action: 'Einsatz.deleted',
          actor: { id: 'admin', name: 'Admin Test' },
          createdAt: '2026-09-11T09:30:00.000Z',
          summary: 'Einsatz gelöscht: Kai Test (#122)',
          changes: [{
            entity: 'Einsatz',
            entityId: 'e-del',
            label: 'Kai Test (#122) · Service · 18:00',
            action: 'deleted',
            fields: [
              { field: 'personalNr', label: 'Mitarbeiter', before: 122, beforeLabel: 'Kai Test (#122)', after: null, afterLabel: '—' },
              { field: 'uhrzeitVon', label: 'Uhrzeit von', before: '18:00', beforeLabel: '18:00', after: null, afterLabel: '—' },
              { field: 'uhrzeitBis', label: 'Uhrzeit bis', before: '23:00', beforeLabel: '23:00', after: null, afterLabel: '—' },
            ],
          }],
        },
        change('upd-entry', 'Einsatz geändert'),
        {
          _id: 'create-entry',
          kind: 'change',
          action: 'Auftrag.created',
          actor: { id: 'admin', name: 'Admin Test' },
          createdAt: '2026-09-11T08:00:00.000Z',
          summary: 'Auftrag angelegt: Messe Nord',
          changes: [{
            entity: 'Schicht',
            entityId: 's-1',
            label: 'Service',
            action: 'created',
            fields: [
              { field: 'bezeichnung', label: 'Bezeichnung', before: null, beforeLabel: '—', after: 'Service', afterLabel: 'Service' },
              { field: 'uhrzeitVon', label: 'Uhrzeit von', before: null, beforeLabel: '—', after: '18:00', afterLabel: '18:00' },
              { field: 'uhrzeitBis', label: 'Uhrzeit bis', before: null, beforeLabel: '—', after: '23:00', afterLabel: '23:00' },
              { field: 'bedarf', label: 'Bedarf', before: null, beforeLabel: '—', after: 3, afterLabel: '3' },
            ],
          }],
        },
      ]),
    );
    render();
    await flushPromises();

    // Chronological order (oldest top -> newest bottom): Angelegt, Geändert, Gelöscht, Notiz
    const metaPills = wrapper.findAll('.chronik-action-pill--meta').map(p => p.text());
    expect(metaPills).toEqual(['Angelegt', 'Geändert', 'Gelöscht', 'Notiz']);

    // Only the 'updated' change renders a Vorher/Nachher table; 'created' and 'deleted' render compact rows with hover buttons
    expect(wrapper.findAll('table')).toHaveLength(1);
    expect(wrapper.findAll('.chronik-change--compact')).toHaveLength(2);
    expect(wrapper.findAll('.chronik-hover-btn').length).toBeGreaterThanOrEqual(2);
    expect(wrapper.text()).toContain('18:00–23:00');
    expect(wrapper.text()).toContain('Bedarf: 3');
  });
});
