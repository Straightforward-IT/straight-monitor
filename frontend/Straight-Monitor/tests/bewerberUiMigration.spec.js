import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import BewerberCreate from '../src/components/BewerberCreate.vue';
import BewerberDetailCard from '../src/components/BewerberDetailCard.vue';
import BewerberCard from '../src/components/BewerberCard.vue';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  router: { push: vi.fn(), back: vi.fn() },
}));
vi.mock('@/utils/api', () => ({ default: mocks.api }));

function applicant() {
  return {
    _id: 'applicant-1', vorname: 'Anna', nachname: 'Muster', email: 'anna@example.com',
    asana_id: 'task-1', asana_permalink: 'https://app.asana.com/task-1', status: 'eingeladen',
    locationV2: { _id: 'hh' }, geburtsdatum: '2000-05-10T00:00:00.000Z',
    verfuegbarAb: '2026-10-01', verfuegbarBis: null, fuehrerscheine: ['B'],
    eigenesAuto: false, nutzungsberechtigung: true, hat70TageGearbeitet: false, tage70Regelung: 12,
    documents: [{ _id: 'proof-1', name: 'Studiennachweis.pdf', size: 1024, category: 'studienbescheinigung' }],
  };
}
const wrappers = [];
function render(component, options = {}) {
  const wrapper = mount(component, {
    attachTo: document.body,
    global: {
      mocks: { $route: { params: { id: 'task-1' } }, $router: mocks.router },
      stubs: { 'font-awesome-icon': true },
    },
    ...options,
  });
  wrappers.push(wrapper);
  return wrapper;
}
const inputFor = (wrapper, label) => wrapper.findAll('label').find(field => field.text().trim() === label).get('input');

beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.get.mockImplementation(url => {
    if (url === '/api/asana/task/task-1') return Promise.resolve({ data: { task: {
      name: 'Muster, Anna - S', notes: 'anna@example.com', permalink_url: 'https://app.asana.com/task-1',
    } } });
    if (url === '/api/bewerber/asana/task-1') return Promise.reject({ response: { status: 404 } });
    if (url.endsWith('/stories')) return Promise.resolve({ data: { stories: [] } });
    if (url === '/api/bewerber/applicant-1') return Promise.resolve({ data: { data: applicant() } });
    if (url === '/api/locations') return Promise.resolve({ data: [{ _id: 'hh', nameFull: 'Hamburg' }] });
    if (url.endsWith('/download')) return Promise.resolve({ data: { data: { url: 'https://example.com/proof.pdf' } } });
    throw new Error(`Unexpected API request: ${url}`);
  });
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

describe('applicant creation shared actions', () => {
  it('submits once through a native submit button and keeps the route/payload contract', async () => {
    let resolve;
    mocks.api.post.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const wrapper = render(BewerberCreate);
    await flushPromises();
    await wrapper.get('input[autocomplete="given-name"]').setValue(' Anna Maria ');
    const submit = wrapper.get('.app-button--primary');
    expect(submit.attributes('type')).toBe('submit');
    submit.element.click();
    await nextTick();
    expect(submit.attributes('disabled')).toBeDefined();
    expect(submit.attributes('aria-busy')).toBe('true');
    submit.element.click();
    expect(mocks.api.post).toHaveBeenCalledTimes(1);
    expect(mocks.api.post).toHaveBeenCalledWith('/api/bewerber', expect.objectContaining({
      asana_id: 'task-1', teamKey: 'hamburg', vorname: 'Anna Maria', nachname: 'Muster', email: 'anna@example.com',
    }));
    resolve({ data: { data: { _id: 'created-1' } } });
    await flushPromises();
    expect(mocks.router.push).toHaveBeenCalledWith({ path: '/personal', query: { tab: 'bewerber', bewerber_id: 'created-1' } });
    expect(submit.attributes('disabled')).toBeUndefined();
  });

  it('opens an existing applicant after a duplicate conflict without attempting a second creation', async () => {
    mocks.api.post.mockRejectedValueOnce({ response: { status: 409, data: { id: 'existing-1', message: 'Bereits vorhanden' } } });
    const wrapper = render(BewerberCreate);
    await flushPromises();
    wrapper.get('.app-button--primary').element.click();
    await flushPromises();
    expect(wrapper.find('form').exists()).toBe(false);
    const open = wrapper.get('.app-button--ghost');
    expect(open.text()).toBe('Bewerber öffnen');
    expect(open.attributes('type')).toBe('button');
    await open.trigger('click');
    expect(mocks.router.push).toHaveBeenCalledWith({ path: '/personal', query: { tab: 'bewerber', bewerber_id: 'existing-1' } });
    expect(mocks.api.post).toHaveBeenCalledTimes(1);
  });

  it('cancels without submitting the form', async () => {
    const wrapper = render(BewerberCreate);
    await flushPromises();
    wrapper.get('.app-button--secondary').element.click();
    expect(mocks.router.back).toHaveBeenCalledTimes(1);
    expect(mocks.api.post).not.toHaveBeenCalled();
  });
});

describe('applicant detail shared actions', () => {
  it('saves only editable fields and retains normalized dates/location and qualification rules', async () => {
    let resolve;
    mocks.api.patch.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const wrapper = render(BewerberDetailCard, { props: { bewerberId: 'applicant-1' } });
    await flushPromises();
    await inputFor(wrapper, 'Vorname').setValue(' Annika ');
    const save = wrapper.get('.app-button--primary');
    await save.trigger('click');
    expect(save.attributes('disabled')).toBeDefined();
    expect(save.attributes('aria-busy')).toBe('true');
    save.element.click();
    expect(mocks.api.patch).toHaveBeenCalledTimes(1);
    expect(mocks.api.patch).toHaveBeenCalledWith('/api/bewerber/applicant-1', expect.objectContaining({
      vorname: 'Annika', locationV2: 'hh', geburtsdatum: '2000-05-10', verfuegbarBis: null,
      nutzungsberechtigung: false, tage70Regelung: null, fuehrerscheine: ['B'],
    }));
    expect(mocks.api.patch.mock.calls[0][1]).not.toHaveProperty('asana_id');
    resolve({ data: { data: { ...applicant(), vorname: 'Annika' } } });
    await flushPromises();
    expect(wrapper.emitted('saved')[0][0].vorname).toBe('Annika');
    expect(wrapper.get('.save-ok').text()).toBe('Änderungen gespeichert.');
    expect(save.attributes('disabled')).toBeUndefined();
  });

  it('retains field validation and input after an unsuccessful save', async () => {
    const wrapper = render(BewerberDetailCard, { props: { bewerberId: 'applicant-1' } });
    await flushPromises();
    await inputFor(wrapper, 'Vorname').setValue('');
    await wrapper.get('.app-button--primary').trigger('click');
    expect(mocks.api.patch).not.toHaveBeenCalled();
    expect(wrapper.get('.save-error').text()).toContain('erforderlich');
    await inputFor(wrapper, 'Vorname').setValue('Annika');
    mocks.api.patch.mockRejectedValueOnce({ response: { data: { message: 'Speichern fehlgeschlagen' } } });
    await wrapper.get('.app-button--primary').trigger('click');
    await flushPromises();
    expect(wrapper.get('.save-error').text()).toBe('Speichern fehlgeschlagen');
    expect(inputFor(wrapper, 'Vorname').element.value).toBe('Annika');
    expect(wrapper.emitted('saved')).toBeUndefined();
    expect(wrapper.get('.app-button--primary').attributes('disabled')).toBeUndefined();
  });

  it('invites, opens documents, and closes without submitting incidental actions', async () => {
    const wrapper = render(BewerberDetailCard, { props: { bewerberId: 'applicant-1' } });
    await flushPromises();
    await wrapper.findAll('.header-actions button').find(button => button.text() === 'Einladung senden').trigger('click');
    expect(wrapper.emitted('invite')[0][0]._id).toBe('applicant-1');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    wrapper.get('button[aria-label="Nachweis Studiennachweis.pdf öffnen"]').element.click();
    await flushPromises();
    expect(mocks.api.get).toHaveBeenCalledWith('/api/bewerber/applicant-1/documents/proof-1/download');
    expect(open).toHaveBeenCalledWith('https://example.com/proof.pdf', '_blank', 'noopener,noreferrer');
    expect(mocks.api.patch).not.toHaveBeenCalled();
    expect(mocks.api.post).not.toHaveBeenCalled();
    await wrapper.findAll('.footer-actions button').find(button => button.text() === 'Schließen').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.get('a.asana-link').attributes()).toMatchObject({ target: '_blank', href: 'https://app.asana.com/task-1' });
  });
});

describe('applicant card shared icon actions', () => {
  const cardOptions = {
    props: { bewerber: applicant() },
    global: { stubs: {
      'font-awesome-icon': true,
      ContextMenu: { name: 'ContextMenu', props: ['x', 'y', 'options'], emits: ['select', 'close'], template: '<div />' },
      BewerberDetailCard: { name: 'BewerberDetailCard', props: { bewerberId: String, embedded: Boolean }, emits: ['close', 'saved'], template: '<div />' },
    } },
  };
  it('opens the menu at the native button bounds without toggling the card and emits the invitation', async () => {
    const wrapper = render(BewerberCard, cardOptions);
    const action = wrapper.get('button[aria-label="Aktionen für Anna Muster"]');
    vi.spyOn(action.element, 'getBoundingClientRect').mockReturnValue({ right: 320, bottom: 150 });
    await action.trigger('click');
    const menu = wrapper.getComponent({ name: 'ContextMenu' });
    expect(menu.props()).toMatchObject({ x: 160, y: 154 });
    expect(action.attributes('aria-expanded')).toBe('true');
    expect(wrapper.findComponent({ name: 'BewerberDetailCard' }).exists()).toBe(false);
    menu.vm.$emit('select', 'invite');
    expect(wrapper.emitted('invite')).toEqual([[cardOptions.props.bewerber]]);
    menu.vm.$emit('close');
    await nextTick();
    expect(action.attributes('aria-expanded')).toBe('false');
  });

  it('loads embedded details lazily, toggles once, and forwards saved data', async () => {
    const wrapper = render(BewerberCard, cardOptions);
    const disclosure = wrapper.get('.chevron');
    expect(disclosure.attributes('aria-expanded')).toBe('false');
    await disclosure.trigger('click');
    expect(disclosure.attributes('aria-expanded')).toBe('true');
    expect(disclosure.attributes('aria-controls')).toBe(wrapper.get('.card-body').attributes('id'));
    const detail = wrapper.getComponent({ name: 'BewerberDetailCard' });
    expect(detail.props()).toMatchObject({ bewerberId: 'applicant-1', embedded: true });
    detail.vm.$emit('saved', { _id: 'applicant-1', vorname: 'Annika' });
    expect(wrapper.emitted('saved')).toEqual([[{ _id: 'applicant-1', vorname: 'Annika' }]]);
    detail.vm.$emit('close');
    await nextTick();
    expect(disclosure.attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('.card-body').isVisible()).toBe(false);
    await disclosure.trigger('click');
    expect(wrapper.getComponent({ name: 'BewerberDetailCard' }).vm).toBe(detail.vm);
  });
});
