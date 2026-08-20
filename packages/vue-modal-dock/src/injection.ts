import type { InjectionKey } from 'vue'
import type { ModalDockContext } from './core/types'

export const modalDockInjectionKey: InjectionKey<ModalDockContext> = Symbol(
  '@bleck-it/vue-modal-dock',
)
