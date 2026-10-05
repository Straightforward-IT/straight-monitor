# @bleck-it/vue-modal-dock

Headless, app-scoped minimization and restore primitives for Vue 3.

## Development inside MEVN_Neu

The package source lives at `packages/vue-modal-dock`. Straight Monitor links
this directory through `file:../../packages/vue-modal-dock`, so there is no
external package copy to keep in sync.

```sh
cd packages/vue-modal-dock
npm test
npm run typecheck
npm run build
```

Run `npm run build` after changing package source so Straight Monitor receives
the updated `dist` files. The standalone playground can be started with
`npm run dev -- --port 5190`.

## Current architecture

The package supports two complementary modes:

- `DockedModalHost` owns dynamic component instances above the router. It adds
  no modal frame or visual styling, so each application keeps its own overlay,
  frame, buttons, and content design.
- `MinimizableRegion` adds minimization to UI whose lifetime is still owned by
  a page or another parent component.

Both modes appear in the same `MinimizedDock`.

Straight Monitor uses hosted modals only. Every dockable window is registered
through `useDockedModals().open(...)`, with one `DockedModalHost` in `App.vue`
outside the router and a `MinimizedModalDock` for hosted records. Pages request
opening windows but do not render them or remove them when navigating away.
The region API remains available for other consumers and compatibility.

Pinia preserves application state, not component instances. The app-level host
and `KeepAlive` preserve a modal's local state across navigation and minimization.
Browser refresh is separate: only records with an application-supported
`persistence` descriptor can be recreated after reload.

## Foundation usage

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { createModalDock } from '@bleck-it/vue-modal-dock'
import '@bleck-it/vue-modal-dock/style.css'

createApp(App)
  .use(createModalDock({
    maxModals: 10,
    theme: {
      accent: 'var(--brand)',
      surface: 'var(--surface)',
      surfaceMuted: 'var(--surface-hover)',
      text: 'var(--text)',
      textMuted: 'var(--text-muted)',
      border: 'var(--border)',
      fontFamily: 'inherit',
    },
  }))
  .mount('#app')
```

Mount the persistent host and dock once, outside route-owned content:

```vue
<script setup>
import { computed } from 'vue'
import {
  DockedModalHost,
  MinimizedModalDock,
  createModalDockThemeStyle,
  useModalDockOptions,
} from '@bleck-it/vue-modal-dock'

const options = useModalDockOptions()
const themeStyle = computed(() => createModalDockThemeStyle(options.theme))
</script>

<template>
  <RouterView />
  <DockedModalHost />
  <div class="vmd-workspace vmd-headless-workspace" :style="themeStyle">
    <MinimizedModalDock />
  </div>
</template>
```

Open application-owned modal components through the injected manager:

```ts
import DocumentModal from './DocumentModal.vue'
import { useDockedModals } from '@bleck-it/vue-modal-dock'

const modals = useDockedModals()
const id = `document-${document.id}`

modals.open({
  id,
  title: `${document.type} · ${document.name}`,
  component: DocumentModal,
  props: {
    document,
    // DocumentModal declares and emits `close`.
    onClose: () => modals.remove(id),
  },
})
```

The component renders its own existing modal frame. A button anywhere inside
the hosted component automatically targets that instance:

```vue
<script setup lang="ts">
import { MinimizeButton, useCurrentDockedModal } from '@bleck-it/vue-modal-dock'

const modal = useCurrentDockedModal()
</script>

<template>
  <YourExistingModalFrame>
    <MinimizeButton />
    <button type="button" @click="modal?.remove()">Close</button>
    <!-- existing content -->
  </YourExistingModalFrame>
</template>
```

Component type does not define identity. Multiple instances of the same modal
component can coexist when they have different IDs. Opening an existing ID
updates its title and props, restores it, and keeps the existing component
instance. Use stable entity IDs when one window per entity is desired, or add
an instance suffix when duplicate windows for the same entity are desired.

`DockedModalHost` uses `KeepAlive`, so local component state survives minimize
and route navigation. The hosted component's visible DOM must remain in its
logical component tree while dock-managed. If its frame normally Teleports to
`body`, disable that internal Teleport while hosted; a parent cannot hide a
child-owned Teleport target automatically.

## Titles, close requests, and icons

Use `modals.updateTitle(id, title)` to change a title without restoring a
minimized window or changing its order. Calling `open()` again intentionally
restores the existing window and updates its props.

The dock calls `modals.requestClose(id)`. Without a handler this removes the
record. A hosted form can register its existing close-confirmation flow:

```ts
import { onBeforeUnmount } from 'vue'
import { useCurrentDockedModal } from '@bleck-it/vue-modal-dock'

const modal = useCurrentDockedModal()
const unregister = modal?.setCloseHandler(requestFormClose)
onBeforeUnmount(() => unregister?.())
```

When a handler exists, a close request restores the window so it can show its
confirmation, then calls the handler. `requestClose()` returns whether the
record was removed synchronously, not whether the user will confirm later.
After confirmation, use `remove()` for unconditional removal; do not call
`requestClose()` again. Minimization and navigation must not trigger removal.
Straight Monitor's `ModalFrame` registers this handler for hosted windows.

`ModalDefinition.icon` is an optional application-defined string, not an icon
library dependency. `MinimizedModalDock` exposes an `icon` slot with `icon`,
`id`, and `title`; render the application's SVG there. The default is a window
outline. Straight Monitor resolves its keys to existing FontAwesome SVGs.
Each item sizes to its content with a maximum width and title ellipsis, rather
than reserving the same horizontal space for every title.

## Page-local regions

Wrap exactly the existing region that should disappear and put the button
wherever it belongs inside that region:

```vue
<MinimizableRegion
  id="customer-42"
  title="Customer details"
  persist-on-unmount
  :restore-request="returnToCustomer"
  @remove="closeCustomer"
>
  <div class="existing-modal">
    <MinimizeButton />
    <CustomerDetails :customer-id="42" />
  </div>
</MinimizableRegion>
```

`MinimizableRegion` uses `display: contents`, so it adds no visible box,
spacing, color, or sizing. Its title is used by the dock and accessibility
only. `MinimizeButton` can also target a registered region from elsewhere with
`for="customer-42"`.

## Legacy framed workspace

`ModalWorkspace` remains available for compatibility and demos that want the
package's own generic modal frame. It is an alternative renderer for the same
manager and must not be mounted together with `DockedModalHost`:

```ts
import CustomerDetails from './CustomerDetails.vue'
import { useModalDock } from '@bleck-it/vue-modal-dock'

const modals = useModalDock()

modals.open({
  id: 'customer-42',
  title: 'Customer details',
  component: CustomerDetails,
  props: { customerId: 42 },
})

modals.minimize('customer-42')
modals.restore('customer-42')
modals.remove('customer-42')
```

`useModalDock()` remains a compatibility alias for the manager returned by
`useDockedModals()`.

## Theme variables

Pass semantic tokens to `createModalDock({ theme })` to theme every package
control. Token values can reference host-app CSS variables, so light/dark theme
changes are automatic. `MinimizedDock`, `MinimizeButton`, and `ModalWorkspace`
also accept a `theme` prop for per-instance overrides.

Available tokens cover palette (`accent`, `surface`, `surfaceMuted`, `text`,
`textMuted`, `border`), typography (`fontFamily`, `fontSize`,
`titleFontWeight`), geometry (`radius`, `dockRadius`, `itemRadius`,
`controlRadius`, `dockBottom`, `zIndex`), and effects
(`shadow`, `dockShadow`, `controlShadow`, `dockBackground`, `itemBackground`,
`controlBackground`, `focusRing`, `backdropFilter`).

Plain CSS remains supported. Override the equivalent `--vmd-*` custom
properties on `.vmd-workspace` or a specific package component when that fits
the host application's styling architecture better.
