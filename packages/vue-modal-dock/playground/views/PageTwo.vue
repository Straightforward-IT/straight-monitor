<script setup lang="ts">
import { useDockedModals } from '../../src'

const modalDock = useDockedModals()
</script>

<template>
  <section class="route-card">
    <h2>Second route</h2>
    <p>The workspace and minimized dock survive this route change.</p>
    <div class="route-actions">
      <button type="button" @click="modalDock.restore('foundation-demo')">
        Restore modal
      </button>
      <button type="button" @click="modalDock.remove('foundation-demo')">
        Close modal
      </button>
    </div>
  </section>
</template>
