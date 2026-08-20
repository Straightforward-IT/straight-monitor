import { hasInjectionContext, inject } from 'vue'
import type {
  ModalDockContext,
  ModalManager,
  MinimizeDockManager,
  ResolvedModalDockOptions,
} from '../core/types'
import { modalDockInjectionKey } from '../injection'
import {
  dockedModalInjectionKey,
  type DockedModalContext,
} from '../dockedModalInjection'

export function useModalDockContext(): ModalDockContext {
  if (!hasInjectionContext()) {
    throw new Error('useModalDock() must be called from a Vue setup context.')
  }

  const context = inject(modalDockInjectionKey, null)
  if (!context) {
    throw new Error(
      'Modal dock is not installed. Call app.use(createModalDock()) before mounting the app.',
    )
  }
  return context
}

export function useModalDock(): ModalManager {
  return useModalDockContext().manager
}

/** Clearer name for the programmatic, package-owned component registry. */
export function useDockedModals(): ModalManager {
  return useModalDock()
}

/** The current record when called inside a component hosted by DockedModalHost. */
export function useCurrentDockedModal(): DockedModalContext | null {
  if (!hasInjectionContext()) return null
  return inject(dockedModalInjectionKey, null)
}

export function useMinimizeDock(): MinimizeDockManager {
  return useModalDockContext().minimizeManager
}

export function useModalDockOptions(): ResolvedModalDockOptions {
  return useModalDockContext().options
}
