import type { Component, ComputedRef } from 'vue'

export type ModalProps = Record<string, unknown>
export type ModalStatus = 'open' | 'minimized'

export interface ModalDefinition<TProps extends ModalProps = ModalProps> {
  readonly id: string
  readonly title: string
  readonly component: Component
  readonly props?: TProps
  /** Called after the record is removed through either API or UI controls. */
  readonly onRemove?: (id: string) => void
}

export interface ModalRecord<TProps extends ModalProps = ModalProps>
  extends ModalDefinition<TProps> {
  readonly status: ModalStatus
  readonly createdAt: number
  readonly updatedAt: number
}

export interface ModalManagerOptions {
  /** Maximum number of records owned by one manager. Defaults to unlimited. */
  readonly maxModals?: number
}

export interface ModalManager {
  readonly modals: ComputedRef<readonly ModalRecord[]>
  readonly openModals: ComputedRef<readonly ModalRecord[]>
  readonly minimizedModals: ComputedRef<readonly ModalRecord[]>

  get(id: string): ModalRecord | undefined
  open<TProps extends ModalProps = ModalProps>(
    definition: ModalDefinition<TProps>,
  ): ModalRecord<TProps>
  minimize(id: string): boolean
  restore(id: string): boolean
  remove(id: string): boolean
  removeAll(): number
}

export interface MinimizableDefinition {
  readonly id: string
  readonly title: string
  /** Used to return to an owner that was unmounted while minimized. */
  readonly onRestoreRequest?: () => void
  /** Called when an attached region is removed from the dock. */
  readonly onRemove?: (id: string) => void
}

export interface MinimizableRecord extends MinimizableDefinition {
  readonly status: ModalStatus
  readonly attached: boolean
  readonly createdAt: number
  readonly updatedAt: number
}

export interface MinimizeDockManager {
  readonly items: ComputedRef<readonly MinimizableRecord[]>
  readonly minimizedItems: ComputedRef<readonly MinimizableRecord[]>

  get(id: string): MinimizableRecord | undefined
  register(definition: MinimizableDefinition): MinimizableRecord
  release(id: string): boolean
  unregister(id: string): boolean
  minimize(id: string): boolean
  restore(id: string): boolean
  remove(id: string): boolean
  removeAll(): number
}

/**
 * Visual design tokens used by every package-owned control.
 *
 * Values may reference CSS custom properties from the host application, which
 * keeps the dock in sync with runtime theme changes without reconfiguring Vue.
 */
export interface ModalDockTheme {
  readonly accent?: string
  readonly accentContrast?: string
  readonly surface?: string
  readonly surfaceMuted?: string
  readonly text?: string
  readonly textMuted?: string
  readonly border?: string
  readonly radius?: string
  readonly dockRadius?: string
  readonly itemRadius?: string
  readonly controlRadius?: string
  readonly shadow?: string
  readonly dockShadow?: string
  readonly controlShadow?: string
  readonly fontFamily?: string
  readonly fontSize?: string
  readonly titleFontWeight?: string | number
  readonly zIndex?: string | number
  readonly dockBottom?: string
  readonly dockBackground?: string
  readonly itemBackground?: string
  readonly controlBackground?: string
  readonly focusRing?: string
  readonly backdropFilter?: string
}

export interface ModalDockOptions extends ModalManagerOptions {
  /** Dedicated Teleport target used by the Step 6 workspace UI. */
  readonly teleportTo?: string
  /** App-wide visual tokens. Individual UI components can override these. */
  readonly theme?: ModalDockTheme
}

export interface ResolvedModalDockOptions {
  readonly maxModals: number
  readonly teleportTo: string
  readonly theme: Readonly<ModalDockTheme>
}

export interface ModalDockContext {
  readonly manager: ModalManager
  readonly minimizeManager: MinimizeDockManager
  readonly options: ResolvedModalDockOptions
}
