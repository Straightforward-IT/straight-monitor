import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import PublicJobDetail from '../src/components/public/PublicJobDetail.vue';

vi.mock('@/stores/theme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@getflip/bridge', () => ({ showToast: vi.fn() }));

let wrapper;
afterEach(() => { wrapper?.unmount(); wrapper = null; });

async function render({ hasUser, isTeamleiter = false, auftragNr = 2510447 }) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/auftraege', component: { template: '<div />' } },
  ] });
  await router.push('/');
  await router.isReady();
  wrapper = shallowMount(PublicJobDetail, {
    props: {
      einsatz: { _id: 'assignment-1', auftragNr, datumVon: '2026-06-29T00:00:00Z', auftrag: { eventTitel: 'Testauftrag', locationV2: { _id: 'location-1' } } },
      mitarbeiter: { hasUser }, isTeamleiter,
      email: 'employee@example.test',
      api: { get: vi.fn(async url => ({ data: url.includes('einsatzdokumente') ? { data: [] } : [] })) },
    },
    global: { plugins: [router], stubs: { RouterLink: false, 'font-awesome-icon': true } },
  });
  await flushPromises();
}

describe('public job Monitor link', () => {
  it('opens the order calendar in a new tab for a linked employee without requiring a team leader role', async () => {
    await render({ hasUser: true });
    const link = wrapper.get('.job-header a.job-monitor-link');
    const url = new URL(link.attributes('href'), 'http://localhost:5173');
    expect(url.pathname).toBe('/auftraege');
    expect(Object.fromEntries(url.searchParams)).toEqual({ tab: 'calendar', auftragnr: '2510447', focusDate: '2026-06-29', locationV2: 'location-1' });
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.text()).toBe('Monitor');
  });

  it.each([false, undefined])('hides the link without a linked user, including for team leaders (%s)', async hasUser => {
    await render({ hasUser, isTeamleiter: true });
    expect(wrapper.find('.job-monitor-link').exists()).toBe(false);
  });

  it('hides the link when no order number is available', async () => {
    await render({ hasUser: true, auftragNr: null });
    expect(wrapper.find('.job-monitor-link').exists()).toBe(false);
  });
});
