<script setup lang="ts">
import { useDockedModals } from '../src'

const modalDock = useDockedModals()
</script>

<template>
  <main class="playground">
    <h1>Vue Modal Dock</h1>
    <nav>
      <RouterLink to="/">First route</RouterLink>
      <RouterLink to="/second">Second route</RouterLink>
    </nav>

    <RouterView />

    <aside class="foundation-state">
      Foundation state: {{ modalDock.openModals.value.length }} open /
      {{ modalDock.minimizedModals.value.length }} minimized.
    </aside>
  </main>

  <DockedModalHost />
  <MinimizedDock />
</template>
