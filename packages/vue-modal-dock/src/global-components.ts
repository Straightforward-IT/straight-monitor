declare module 'vue' {
  export interface GlobalComponents {
    ModalWorkspace: typeof import('./components/ModalWorkspace.vue')['default']
    MinimizableRegion: typeof import('./components/MinimizableRegion.vue')['default']
    MinimizeButton: typeof import('./components/MinimizeButton.vue')['default']
    MinimizedDock: typeof import('./components/MinimizedDock.vue')['default']
    DockedModalHost: typeof import('./components/DockedModalHost.vue')['default']
  }
}

export {}
