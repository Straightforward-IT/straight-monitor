import './global-components'
import './style.css'

export { default as ModalFrame } from './components/ModalFrame.vue'
export { default as ModalHost } from './components/ModalHost.vue'
export { default as MinimizedModalDock } from './components/MinimizedModalDock.vue'
export { default as ModalWorkspace } from './components/ModalWorkspace.vue'
export { default as MinimizableRegion } from './components/MinimizableRegion.vue'
export { default as MinimizeButton } from './components/MinimizeButton.vue'
export { default as MinimizedDock } from './components/MinimizedDock.vue'
export { default as DockedModalHost } from './components/DockedModalHost.vue'
export { createMinimizeDockManager } from './core/createMinimizeDockManager'
export { createModalDockThemeStyle } from './core/theme'
export {
  createModalManager,
  ModalDockError,
  ModalLimitError,
} from './core/createModalManager'
export type {
  ModalDefinition,
  ModalDockContext,
  ModalDockOptions,
  ModalManager,
  ModalManagerOptions,
  MinimizableDefinition,
  MinimizableRecord,
  MinimizeDockManager,
  ModalDockTheme,
  ModalProps,
  ModalRecord,
  ModalStatus,
  ResolvedModalDockOptions,
} from './core/types'
export {
  useModalDock,
  useModalDockContext,
  useModalDockOptions,
  useMinimizeDock,
  useDockedModals,
  useCurrentDockedModal,
} from './composables/useModalDock'
export { modalDockInjectionKey } from './injection'
export {
  dockedModalInjectionKey,
  type DockedModalContext,
} from './dockedModalInjection'
export {
  minimizableRegionInjectionKey,
  type MinimizableRegionContext,
} from './minimizableInjection'
export {
  createModalDock,
  DEFAULT_MODAL_TELEPORT_TARGET,
} from './plugin'
