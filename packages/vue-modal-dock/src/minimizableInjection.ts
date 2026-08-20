import type { ComputedRef, InjectionKey } from 'vue'

export interface MinimizableRegionContext {
  readonly id: ComputedRef<string>
  readonly title: ComputedRef<string>
  minimize(): boolean
  restore(): boolean
  remove(): boolean
}

export const minimizableRegionInjectionKey: InjectionKey<MinimizableRegionContext> =
  Symbol('@bleck-it/vue-modal-dock/minimizable-region')
