# Step 0-5 MVP boundary

The first milestone established the installable library foundation. Steps 6-8
now add the first usable, accessible UI on top of that foundation.

## Included

- A typed modal definition and record contract.
- An app-scoped modal manager.
- Open, minimize, restore, remove, and remove-all operations.
- Derived open and minimized collections.
- Duplicate-ID protection by restoring the existing record.
- A configurable maximum modal count.
- A Vue plugin using app-level provide/inject.
- Composables for accessing the manager and resolved options.
- ESM, CommonJS, and TypeScript declaration output.
- A two-route playground scaffold.

## Added in Steps 6-8

- `ModalFrame`, `ModalHost`, `MinimizedModalDock`, and `ModalWorkspace` UI.
- A globally registered `ModalWorkspace` tag plus named component exports.
- Teleport rendering after mount for SSR-safe module imports.
- A state-preserving `v-show` minimize lifecycle.
- Escape-to-close, labelled actions, focus-on-restore, and dock announcements.
- Themeable CSS custom properties and responsive layouts.
- A working two-route lifecycle demonstration.

## Added in the headless host refactor

- `DockedModalHost`, a frame-free persistent renderer mounted beside
  `RouterView`.
- Per-instance injected minimize, restore, remove, status, and topmost state.
- One dock for both persistent modal components and page-local regions.
- Multiple instances of one component, keyed by caller-provided instance IDs.
- `KeepAlive` state preservation across minimize and SPA route navigation.

## Still deferred

- Dragging, resizing, snapping, and geometry.
- Browser storage, Pinia, and Nuxt adapters.
- Bleck IT-specific styling.

The manager is deliberately independent from Vue Router. Route persistence is
achieved by mounting `DockedModalHost` outside `RouterView`. `ModalWorkspace`
remains the framed compatibility renderer and must not be mounted at the same
time as `DockedModalHost`.
