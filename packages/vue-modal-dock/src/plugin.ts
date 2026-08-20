import type { Plugin } from 'vue'
import { createModalManager } from './core/createModalManager'
import { createMinimizeDockManager } from './core/createMinimizeDockManager'
import type {
  ModalDockContext,
  ModalDockOptions,
  ResolvedModalDockOptions,
} from './core/types'
import { modalDockInjectionKey } from './injection'
import ModalWorkspace from './components/ModalWorkspace.vue'
import MinimizableRegion from './components/MinimizableRegion.vue'
import MinimizeButton from './components/MinimizeButton.vue'
import MinimizedDock from './components/MinimizedDock.vue'
import DockedModalHost from './components/DockedModalHost.vue'

export const DEFAULT_MODAL_TELEPORT_TARGET = 'body'

function resolveOptions(options: ModalDockOptions): ResolvedModalDockOptions {
  const maxModals = options.maxModals ?? Number.POSITIVE_INFINITY
  if (!Number.isInteger(maxModals) && maxModals !== Number.POSITIVE_INFINITY) {
    throw new Error('maxModals must be a positive integer.')
  }
  if (maxModals < 1) {
    throw new Error('maxModals must be a positive integer.')
  }

  const teleportTo = options.teleportTo?.trim() || DEFAULT_MODAL_TELEPORT_TARGET
  const theme = Object.freeze({ ...options.theme })
  return Object.freeze({ maxModals, teleportTo, theme })
}

export function createModalDock(options: ModalDockOptions = {}): Plugin {
  const resolvedOptions = resolveOptions(options)

  return {
    install(app) {
      const context: ModalDockContext = Object.freeze({
        manager: createModalManager({ maxModals: resolvedOptions.maxModals }),
        minimizeManager: createMinimizeDockManager(),
        options: resolvedOptions,
      })
      app.provide(modalDockInjectionKey, context)
      app.component('ModalWorkspace', ModalWorkspace)
      app.component('MinimizableRegion', MinimizableRegion)
      app.component('MinimizeButton', MinimizeButton)
      app.component('MinimizedDock', MinimizedDock)
      app.component('DockedModalHost', DockedModalHost)
    },
  }
}
