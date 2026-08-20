import { createApp, defineComponent, h, type Component } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  createModalDock,
  type ModalManager,
  type MinimizeDockManager,
  type ResolvedModalDockOptions,
  useModalDock,
  useMinimizeDock,
  useModalDockOptions,
} from '../src'

const ModalContent: Component = defineComponent({ name: 'ModalContent' })

function createProbe(capture: {
  manager?: ModalManager
  minimizeManager?: MinimizeDockManager
  options?: ResolvedModalDockOptions
}) {
  return defineComponent({
    name: 'ModalDockProbe',
    setup() {
      capture.manager = useModalDock()
      capture.minimizeManager = useMinimizeDock()
      capture.options = useModalDockOptions()
      return () => h('div', 'probe')
    },
  })
}

describe('createModalDock plugin', () => {
  it('provides one manager and resolved options to the application', () => {
    const capture: {
      manager?: ModalManager
      minimizeManager?: MinimizeDockManager
      options?: ResolvedModalDockOptions
    } = {}
    const wrapper = mount(createProbe(capture), {
      global: {
        plugins: [
          createModalDock({
            maxModals: 3,
            teleportTo: '#custom-root',
            theme: { accent: 'var(--brand)', fontFamily: 'inherit' },
          }),
        ],
      },
    })

    expect(capture.options).toEqual({
      maxModals: 3,
      teleportTo: '#custom-root',
      theme: { accent: 'var(--brand)', fontFamily: 'inherit' },
    })
    capture.manager?.open({
      id: 'provided',
      title: 'Provided manager',
      component: ModalContent,
    })
    expect(capture.manager?.modals.value).toHaveLength(1)
    capture.minimizeManager?.register({ id: 'region', title: 'Region' })
    expect(capture.minimizeManager?.items.value).toHaveLength(1)
    wrapper.unmount()
  })

  it('creates isolated managers when the same plugin installs in two apps', () => {
    const plugin = createModalDock()
    const firstCapture: { manager?: ModalManager } = {}
    const secondCapture: { manager?: ModalManager } = {}
    const firstWrapper = mount(createProbe(firstCapture), {
      global: { plugins: [plugin] },
    })
    const secondWrapper = mount(createProbe(secondCapture), {
      global: { plugins: [plugin] },
    })

    expect(firstCapture.manager).not.toBe(secondCapture.manager)
    firstCapture.manager?.open({
      id: 'first-app',
      title: 'First app',
      component: ModalContent,
    })
    expect(firstCapture.manager?.modals.value).toHaveLength(1)
    expect(secondCapture.manager?.modals.value).toHaveLength(0)

    firstWrapper.unmount()
    secondWrapper.unmount()
  })

  it('fails clearly when the plugin was not installed', () => {
    const app = createApp({ render: () => null })

    expect(() => app.runWithContext(() => useModalDock())).toThrow(
      'Modal dock is not installed',
    )
  })
})
