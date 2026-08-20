import { flushPromises, mount } from '@vue/test-utils'
import {
  defineComponent,
  h,
  nextTick,
  onUnmounted,
  ref,
  type Component,
} from 'vue'
import {
  createMemoryHistory,
  createRouter,
  RouterView,
} from 'vue-router'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createModalDock,
  DockedModalHost,
  MinimizeButton,
  MinimizedDock,
  MinimizableRegion,
  ModalWorkspace,
  type MinimizeDockManager,
  type ModalManager,
  useModalDock,
  useCurrentDockedModal,
  useDockedModals,
  useMinimizeDock,
} from '../src'

function click(element: Element | null): void {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Expected a clickable element.')
  }
  element.click()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('modal workspace lifecycle', () => {
  it('preserves component state while minimized, restores focus, and unmounts on close', async () => {
    let manager!: ModalManager
    let unmountCount = 0
    const StatefulContent = defineComponent({
      name: 'StatefulContent',
      setup() {
        const value = ref('')
        onUnmounted(() => {
          unmountCount += 1
        })
        return () =>
          h('input', {
            'data-testid': 'stateful-input',
            value: value.value,
            onInput: (event: Event) => {
              value.value = (event.target as HTMLInputElement).value
            },
          })
      },
    })
    const Harness = defineComponent({
      setup() {
        manager = useModalDock()
        return () => h(ModalWorkspace)
      },
    })
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [createModalDock()] },
    })

    manager.open({
      id: 'stateful',
      title: 'Stateful modal',
      component: StatefulContent,
    })
    await nextTick()
    await flushPromises()

    const originalInput = document.querySelector<HTMLInputElement>(
      '[data-testid="stateful-input"]',
    )
    expect(originalInput).not.toBeNull()
    originalInput!.value = 'preserved value'
    originalInput!.dispatchEvent(new Event('input', { bubbles: true }))

    const frame = document.querySelector<HTMLElement>('.vmd-frame')
    expect(frame?.getAttribute('role')).toBe('dialog')
    expect(frame?.querySelector('.vmd-frame__header')).toBeNull()
    expect(frame?.querySelector('.vmd-visually-hidden')?.textContent).toBe(
      'Stateful modal',
    )
    expect(
      document.querySelector('[aria-label="Minimize Stateful modal"]'),
    ).not.toBeNull()
    expect(
      document.querySelector('[aria-label="Close Stateful modal"]'),
    ).not.toBeNull()

    click(document.querySelector('[aria-label="Minimize Stateful modal"]'))
    await nextTick()

    expect(manager.get('stateful')?.status).toBe('minimized')
    expect(frame?.style.display).toBe('none')
    expect(
      document.querySelector('nav[aria-label="Minimized modals"]'),
    ).not.toBeNull()
    expect(unmountCount).toBe(0)

    click(document.querySelector('[aria-label="Restore Stateful modal"]'))
    await nextTick()
    await flushPromises()

    const restoredInput = document.querySelector<HTMLInputElement>(
      '[data-testid="stateful-input"]',
    )
    expect(restoredInput).toBe(originalInput)
    expect(restoredInput?.value).toBe('preserved value')
    expect(document.activeElement).toBe(frame)

    click(document.querySelector('[aria-label="Close Stateful modal"]'))
    await nextTick()

    expect(manager.get('stateful')).toBeUndefined()
    expect(document.querySelector('[data-testid="stateful-input"]')).toBeNull()
    expect(unmountCount).toBe(1)
    wrapper.unmount()
  })

  it('closes the focused frame with Escape', async () => {
    let manager!: ModalManager
    const Content: Component = defineComponent({
      setup: () => () => h('p', 'Escape content'),
    })
    const Harness = defineComponent({
      setup() {
        manager = useModalDock()
        return () => h(ModalWorkspace)
      },
    })
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [createModalDock()] },
    })

    manager.open({ id: 'escape', title: 'Escape modal', component: Content })
    await nextTick()
    await flushPromises()

    document.querySelector('.vmd-frame')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await nextTick()

    expect(manager.get('escape')).toBeUndefined()
    wrapper.unmount()
  })

  it('renders multiple minimized records as compact dock items', async () => {
    let manager!: ModalManager
    const Content: Component = defineComponent({
      setup: () => () => h('p', 'Dock content'),
    })
    const Harness = defineComponent({
      setup() {
        manager = useModalDock()
        return () => h(ModalWorkspace)
      },
    })
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [createModalDock()] },
    })

    for (let index = 1; index <= 4; index += 1) {
      const id = `dock-${index}`
      manager.open({ id, title: `Dock modal ${index}`, component: Content })
      manager.minimize(id)
    }
    await nextTick()
    await flushPromises()

    expect(document.querySelectorAll('.vmd-dock__item')).toHaveLength(4)
    expect(
      document.querySelectorAll('.vmd-dock__restore'),
    ).toHaveLength(4)
    wrapper.unmount()
  })

  it('keeps a minimized modal alive while Vue Router changes pages', async () => {
    let manager!: ModalManager
    const StatefulRouteModal = defineComponent({
      setup() {
        const value = ref('')
        return () =>
          h('input', {
            'data-testid': 'route-modal-input',
            value: value.value,
            onInput: (event: Event) => {
              value.value = (event.target as HTMLInputElement).value
            },
          })
      },
    })
    const FirstRoute = defineComponent({
      setup() {
        const dock = useModalDock()
        return () =>
          h(
            'button',
            {
              'data-testid': 'open-route-modal',
              onClick: () =>
                dock.open({
                  id: 'route-modal',
                  title: 'Route modal',
                  component: StatefulRouteModal,
                }),
            },
            'Open route modal',
          )
      },
    })
    const SecondRoute = defineComponent({
      setup: () => () => h('h1', 'Second route'),
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: FirstRoute },
        { path: '/second', component: SecondRoute },
      ],
    })
    const Root = defineComponent({
      setup() {
        manager = useModalDock()
        return () => h('div', [h(RouterView), h(ModalWorkspace)])
      },
    })

    await router.push('/')
    const wrapper = mount(Root, {
      attachTo: document.body,
      global: { plugins: [router, createModalDock()] },
    })
    await router.isReady()
    await wrapper.get('[data-testid="open-route-modal"]').trigger('click')
    await nextTick()
    await flushPromises()

    const originalInput = document.querySelector<HTMLInputElement>(
      '[data-testid="route-modal-input"]',
    )!
    originalInput.value = 'survives navigation'
    originalInput.dispatchEvent(new Event('input', { bubbles: true }))
    manager.minimize('route-modal')
    await nextTick()

    await router.push('/second')
    await nextTick()
    expect(wrapper.text()).toContain('Second route')
    expect(
      document.querySelector('[aria-label="Restore Route modal"]'),
    ).not.toBeNull()

    manager.restore('route-modal')
    await nextTick()
    await flushPromises()

    const restoredInput = document.querySelector<HTMLInputElement>(
      '[data-testid="route-modal-input"]',
    )
    expect(restoredInput).toBe(originalInput)
    expect(restoredInput?.value).toBe('survives navigation')
    wrapper.unmount()
  })
})

describe('headless minimization', () => {
  it('hides exactly the registered region and restores it from the dock', async () => {
    let manager!: MinimizeDockManager
    const removedIds: string[] = []
    const Harness = defineComponent({
      setup() {
        manager = useMinimizeDock()
        return () =>
          h('div', [
            h(
              MinimizableRegion,
              {
                id: 'headless-card',
                title: 'Headless card',
                onRemove: (id: string) => removedIds.push(id),
              },
              {
                default: () =>
                  h('section', { 'data-testid': 'original-card' }, [
                    h('p', 'Original card content'),
                    h(MinimizeButton),
                  ]),
              },
            ),
            h(MinimizedDock),
          ])
      },
    })
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [createModalDock()] },
    })
    await nextTick()

    const region = document.querySelector<HTMLElement>(
      '.vmd-minimizable-region',
    )!
    expect(region.style.display).not.toBe('none')
    click(document.querySelector('[aria-label="Minimize Headless card"]'))
    await nextTick()

    expect(region.style.display).toBe('none')
    expect(manager.minimizedItems.value).toHaveLength(1)
    click(document.querySelector('[aria-label="Restore Headless card"]'))
    await nextTick()

    expect(region.style.display).not.toBe('none')
    click(document.querySelector('[aria-label="Minimize Headless card"]'))
    await nextTick()
    click(document.querySelector('[aria-label="Close Headless card"]'))
    await nextTick()

    expect(manager.get('headless-card')).toBeUndefined()
    expect(region.style.display).toBe('none')
    expect(removedIds).toEqual(['headless-card'])
    wrapper.unmount()
  })

  it('maps app and component theme tokens to package CSS variables', async () => {
    let manager!: MinimizeDockManager
    const Harness = defineComponent({
      setup() {
        manager = useMinimizeDock()
        return () =>
          h('div', [
            h(
              MinimizableRegion,
              { id: 'themed-card', title: 'Themed card' },
              {
                default: () =>
                  h(MinimizeButton, { theme: { accent: '#f0a050' } }),
              },
            ),
            h(MinimizedDock, { theme: { surface: 'var(--app-surface)' } }),
          ])
      },
    })
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: {
        plugins: [
          createModalDock({
            theme: {
              accent: 'var(--brand)',
              fontFamily: 'inherit',
              titleFontWeight: 500,
            },
          }),
        ],
      },
    })
    await nextTick()

    const minimizeButton = document.querySelector<HTMLElement>(
      '.vmd-minimize-button',
    )!
    expect(minimizeButton.style.getPropertyValue('--vmd-accent')).toBe(
      '#f0a050',
    )
    expect(minimizeButton.style.getPropertyValue('--vmd-font-family')).toBe(
      'inherit',
    )

    manager.minimize('themed-card')
    await nextTick()
    const workspace = document.querySelector<HTMLElement>('.vmd-workspace')!
    expect(workspace.style.getPropertyValue('--vmd-accent')).toBe('var(--brand)')
    expect(workspace.style.getPropertyValue('--vmd-surface')).toBe(
      'var(--app-surface)',
    )
    expect(workspace.style.getPropertyValue('--vmd-title-font-weight')).toBe(
      '500',
    )
    wrapper.unmount()
  })
})

describe('headless persistent modal host', () => {
  it('keeps same-type instances independent across minimize, restore, and close', async () => {
    let manager!: ModalManager
    const unmounted: string[] = []
    const HostedDocument = defineComponent({
      name: 'HostedDocument',
      props: { label: { type: String, required: true } },
      setup(props) {
        const current = useCurrentDockedModal()
        const value = ref('')
        onUnmounted(() => unmounted.push(props.label))
        return () =>
          h('section', { 'data-document': props.label }, [
            h('input', {
              'data-input': props.label,
              value: value.value,
              onInput: (event: Event) => {
                value.value = (event.target as HTMLInputElement).value
              },
            }),
            h(MinimizeButton),
            h(
              'button',
              {
                'data-close': props.label,
                onClick: () => current?.remove(),
              },
              'Close',
            ),
            h('output', { 'data-topmost': props.label }, String(current?.topmost.value)),
          ])
      },
    })
    const Harness = defineComponent({
      setup() {
        manager = useDockedModals()
        return () => h('div', [h(DockedModalHost), h(MinimizedDock)])
      },
    })
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [createModalDock()] },
    })

    manager.open({
      id: 'document-a',
      title: 'Document A',
      component: HostedDocument,
      props: { label: 'A' },
    })
    await nextTick()
    const originalInput = document.querySelector<HTMLInputElement>('[data-input="A"]')!
    originalInput.value = 'state from A'
    originalInput.dispatchEvent(new Event('input', { bubbles: true }))
    click(document.querySelector('[aria-label="Minimize Document A"]'))
    await nextTick()

    manager.open({
      id: 'document-b',
      title: 'Document B',
      component: HostedDocument,
      props: { label: 'B' },
    })
    await nextTick()

    expect(manager.get('document-a')?.status).toBe('minimized')
    expect(manager.get('document-b')?.status).toBe('open')
    expect(document.querySelector('[data-document="A"]')).toBeNull()
    expect(document.querySelector('[data-document="B"]')).not.toBeNull()
    expect(unmounted).toEqual([])

    click(document.querySelector('[aria-label="Minimize Document B"]'))
    await nextTick()
    expect(document.querySelectorAll('.vmd-dock__item')).toHaveLength(2)

    click(document.querySelector('[aria-label="Restore Document A"]'))
    await nextTick()
    expect(manager.get('document-a')?.status).toBe('open')
    expect(manager.get('document-b')?.status).toBe('minimized')
    expect(document.querySelector<HTMLInputElement>('[data-input="A"]')).toBe(
      originalInput,
    )
    expect(originalInput.value).toBe('state from A')

    click(document.querySelector('[data-close="A"]'))
    await nextTick()
    expect(manager.get('document-a')).toBeUndefined()
    expect(manager.get('document-b')?.status).toBe('minimized')
    expect(unmounted).toEqual(['A'])
    wrapper.unmount()
  })

  it('keeps a minimized instance alive while Vue Router changes pages', async () => {
    let manager!: ModalManager
    const HostedRouteModal = defineComponent({
      setup() {
        const value = ref('')
        return () =>
          h('section', { 'data-testid': 'hosted-route-modal' }, [
            h('input', {
              'data-testid': 'hosted-route-input',
              value: value.value,
              onInput: (event: Event) => {
                value.value = (event.target as HTMLInputElement).value
              },
            }),
            h(MinimizeButton),
          ])
      },
    })
    const FirstRoute = defineComponent({ setup: () => () => h('h1', 'First route') })
    const SecondRoute = defineComponent({ setup: () => () => h('h1', 'Second route') })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: FirstRoute },
        { path: '/second', component: SecondRoute },
      ],
    })
    const Root = defineComponent({
      setup() {
        manager = useModalDock()
        return () =>
          h('div', [h(RouterView), h(DockedModalHost), h(MinimizedDock)])
      },
    })

    await router.push('/')
    const wrapper = mount(Root, {
      attachTo: document.body,
      global: { plugins: [router, createModalDock()] },
    })
    await router.isReady()

    manager.open({
      id: 'hosted-route',
      title: 'Hosted route modal',
      component: HostedRouteModal,
    })
    await nextTick()
    const originalInput = document.querySelector<HTMLInputElement>(
      '[data-testid="hosted-route-input"]',
    )!
    originalInput.value = 'preserved across routes'
    originalInput.dispatchEvent(new Event('input', { bubbles: true }))

    click(document.querySelector('[aria-label="Minimize Hosted route modal"]'))
    await nextTick()
    await router.push('/second')
    await nextTick()
    expect(wrapper.text()).toContain('Second route')
    expect(document.querySelector('[data-testid="hosted-route-modal"]')).toBeNull()

    click(document.querySelector('[aria-label="Restore Hosted route modal"]'))
    await nextTick()
    expect(
      document.querySelector<HTMLInputElement>('[data-testid="hosted-route-input"]'),
    ).toBe(originalInput)
    expect(originalInput.value).toBe('preserved across routes')
    wrapper.unmount()
  })
})
