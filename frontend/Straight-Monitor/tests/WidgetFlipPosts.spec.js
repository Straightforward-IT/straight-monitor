import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import WidgetFlipPosts from '../src/components/widgets/WidgetFlipPosts.vue';
import { getWidgetById, getWidgetsForRoles } from '../src/components/widgets/widgetRegistry';

const mocks = vi.hoisted(() => ({ get: vi.fn(), locations: vi.fn() }));
vi.mock('@/utils/api', () => ({
  default: { get: (url, ...args) => url === '/api/locations' ? mocks.locations() : mocks.get(url, ...args) },
}));
const hamburgAuthor = '17e0c1c5-6b27-4bac-b0df-93711b993e64';
const berlinAuthor = '4c10c6b2-4c08-4334-abf3-31f55d7529df';
const cologneAuthor = 'aa5e08cd-3c47-4cf5-a544-071f463fd6d8';

const page = (posts = [], next = null) => ({
  data: { posts, pagination: { has_more: Boolean(next), next_cursor: next } },
});
const post = (id, publishedAt, extra = {}) => ({
  id,
  author_id: hamburgAuthor,
  info: { status: 'PUBLISHED', published_at: publishedAt },
  content: [{ language: 'de-DE', title: `Post ${id}` }],
  author: { first_name: 'Ada', last_name: 'Lovelace' },
  views_count: 0,
  ...extra,
});
const render = () => mount(WidgetFlipPosts, {
  global: { stubs: { 'font-awesome-icon': true } },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 8, 12));
  mocks.get.mockReset();
  mocks.locations.mockReset();
  mocks.locations.mockResolvedValue({ data: [{ flipOfficeUserId: hamburgAuthor }] });
  mocks.get.mockResolvedValue(page());
});
afterEach(() => vi.useRealTimers());

describe('today’s Flip posts widget', () => {
  it('is available by default only to admins through the dashboard registry', () => {
    expect(getWidgetById('flip-posts')).toMatchObject({
      defaultVisible: true, title: 'Flip Posts heute', requiresRole: ['ADMIN'],
    });
    expect(getWidgetsForRoles(['ADMIN']).some(widget => widget.id === 'flip-posts')).toBe(true);
    for (const roles of [[], ['USER'], ['VERTRIEB'], ['PAYROLL'], ['USER', 'VERTRIEB']]) {
      expect(getWidgetsForRoles(roles).some(widget => widget.id === 'flip-posts')).toBe(false);
    }
  });

  it('requests published posts within the local day with author and view embeds', async () => {
    let resolveRequest;
    mocks.get.mockReturnValueOnce(new Promise(resolve => { resolveRequest = resolve; }));
    const wrapper = render();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toContain('wird geladen');
    resolveRequest(page());
    await flushPromises();
    expect(mocks.get).toHaveBeenCalledWith('/api/flip-posts', {
      params: {
        status: ['PUBLISHED'],
        author_id: hamburgAuthor,
        date_from: new Date(2026, 9, 8).toISOString(),
        date_to: new Date(2026, 9, 8, 23, 59, 59, 999).toISOString(),
        sort: ['PUBLISHED_AT_DESC'],
        embed: ['AUTHOR', 'VIEWS_COUNT'],
        content_format: 'PLAIN',
        page_limit: 25,
      },
      paramsSerializer: { indexes: null },
      headers: { 'Accept-Language': 'de-DE' },
    });
    expect(wrapper.text()).toContain('Heute wurden noch keine Flip Posts der Team-Accounts gefunden.');
    wrapper.unmount();
  });

  it('loads all pages, deduplicates and sorts today’s posts, and displays the required fields', async () => {
    const early = post('early', new Date(2026, 9, 8).toISOString());
    const late = post('late', new Date(2026, 9, 8, 23, 59, 59, 999).toISOString(), {
      views_count: 1234,
      content: [
        { language: 'en-US', title: 'English', primary_language: true },
        { language: 'de-DE', title: 'Deutscher Titel' },
      ],
    });
    mocks.get.mockResolvedValueOnce(page([
      early,
      post('yesterday', new Date(2026, 9, 7, 23, 59, 59, 999).toISOString()),
      post('tomorrow', new Date(2026, 9, 9).toISOString()),
      post('scheduled', new Date(2026, 9, 8).toISOString(), { info: { status: 'SCHEDULED' } }),
    ], 'next')).mockResolvedValueOnce(page([late, early]));
    const wrapper = render();
    await flushPromises();
    expect(mocks.get.mock.calls[1][1].params.page_cursor).toBe('next');
    const rows = wrapper.findAll('.wfp-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('Deutscher Titel');
    expect(rows[0].text()).toContain('Ada Lovelace');
    expect(rows[0].text()).toContain('1.234 Aufrufe');
    expect(rows[1].text()).toContain('0 Aufrufe');
    wrapper.unmount();
  });

  it('uses primary content when German is absent and distinguishes unknown views from zero', async () => {
    mocks.get.mockResolvedValue(page([post('fallback', new Date(2026, 9, 8).toISOString(), {
      content: [{ title: 'Secondary' }, { title: 'Primary', primary_language: true }],
      author: null,
      views_count: undefined,
    })]));
    const wrapper = render();
    await flushPromises();
    expect(wrapper.text()).toContain('Primary');
    expect(wrapper.text()).toContain('Unbekannter Autor');
    expect(wrapper.text()).toContain('— Aufrufe');
    wrapper.unmount();
  });

  it('shows an explicit error rather than empty or partial results and allows retry', async () => {
    const failure = new Error('Upstream unavailable');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.get.mockResolvedValueOnce(page([post('partial', new Date(2026, 9, 8).toISOString())], 'next'))
      .mockRejectedValueOnce(failure);
    const wrapper = render();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('konnten nicht geladen werden');
    expect(wrapper.find('.wfp-empty').exists()).toBe(false);
    expect(wrapper.find('.wfp-row').exists()).toBe(false);
    expect(log).toHaveBeenCalledWith('WidgetFlipPosts fetch error:', failure);
    await wrapper.get('button[aria-label="Flip Posts aktualisieren"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('.wfp-empty').exists()).toBe(true);
    wrapper.unmount();
  });

  it.each([
    { data: { posts: [] } },
    page([], 'loop'),
  ])('reports malformed responses or repeated cursors without looping', async (response) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.get.mockResolvedValue(response);
    const wrapper = render();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(mocks.get.mock.calls.length).toBeLessThanOrEqual(2);
    wrapper.unmount();
  });

  it('uses calendar boundaries on a daylight-saving transition day and refreshes for the new day', async () => {
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    const wrapper = render();
    await flushPromises();
    expect(mocks.get.mock.calls[0][1].params).toMatchObject({
      date_from: new Date(2026, 9, 25).toISOString(),
      date_to: new Date(2026, 9, 25, 23, 59, 59, 999).toISOString(),
    });
    vi.setSystemTime(new Date(2026, 9, 26, 12));
    await wrapper.get('button[aria-label="Flip Posts aktualisieren"]').trigger('click');
    await flushPromises();
    expect(mocks.get.mock.calls[1][1].params.date_from).toBe(new Date(2026, 9, 26).toISOString());
    wrapper.unmount();
  });

  it('queries all configured active office authors with independent pagination and excludes other authors', async () => {
    mocks.locations.mockResolvedValue({ data: [
      { flipOfficeUserId: hamburgAuthor },
      { flipOfficeUserId: berlinAuthor },
      { flipOfficeUserId: cologneAuthor },
      { flipOfficeUserId: hamburgAuthor },
      { flipOfficeUserId: 'inactive', isActive: false },
      {},
    ] });
    const publishedAt = new Date(2026, 9, 8, 12).toISOString();
    mocks.get.mockImplementation(async (_url, { params }) => {
      if (params.author_id === hamburgAuthor) {
        return params.page_cursor
          ? page([post('hamburg', publishedAt)])
          : page([], 'hamburg-next');
      }
      if (params.author_id === berlinAuthor) return page([post('berlin', publishedAt, { author_id: berlinAuthor })]);
      return page([
        post('cologne', publishedAt, { author_id: cologneAuthor }),
        post('other', publishedAt, { author_id: 'other-account' }),
      ]);
    });
    const wrapper = render();
    await flushPromises();
    expect(mocks.get.mock.calls.map(([, { params }]) => [params.author_id, params.page_cursor])).toEqual([
      [hamburgAuthor, undefined],
      [hamburgAuthor, 'hamburg-next'],
      [berlinAuthor, undefined],
      [cologneAuthor, undefined],
    ]);
    expect(wrapper.findAll('.wfp-row')).toHaveLength(3);
    expect(wrapper.text()).not.toContain('Post other');
    wrapper.unmount();
  });

  it('explains missing office configuration instead of fetching unrelated posts', async () => {
    mocks.locations.mockResolvedValue({ data: [{}, { flipOfficeUserId: '' }] });
    const wrapper = render();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('keine Flip-Office-Benutzer-IDs');
    expect(mocks.get).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('reports location lookup failures rather than falling back to unfiltered posts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.locations.mockRejectedValue(new Error('Locations unavailable'));
    const wrapper = render();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(mocks.get).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
