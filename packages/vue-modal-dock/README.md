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
<template>
  <RouterView />
  <DockedModalHost />
  <MinimizedDock />
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
