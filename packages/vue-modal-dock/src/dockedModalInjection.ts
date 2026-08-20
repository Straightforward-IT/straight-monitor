import type { ComputedRef, InjectionKey } from 'vue'
import type { ModalRecord, ModalStatus } from './core/types'

/** Controls for the modal instance currently rendered by DockedModalHost. */
export interface DockedModalContext {
  readonly record: ComputedRef<ModalRecord>
  readonly id: ComputedRef<string>
  readonly title: ComputedRef<string>
  readonly status: ComputedRef<ModalStatus>
  readonly minimized: ComputedRef<boolean>
  readonly topmost: ComputedRef<boolean>
  minimize(): boolean
  restore(): boolean
  remove(): boolean
}

export const dockedModalInjectionKey: InjectionKey<DockedModalContext> = Symbol(
  '@bleck-it/vue-modal-dock/docked-modal',
)
