<script setup lang="ts">
import { MinimizeButton, useCurrentDockedModal } from '../src'

defineProps<{
  message: string
}>()

const modal = useCurrentDockedModal()
</script>

<template>
  <div class="demo-modal-overlay">
    <section class="demo-modal" role="dialog" aria-modal="true">
      <header class="demo-modal__header">
        <strong>{{ modal?.title.value }}</strong>
        <div class="demo-modal__controls">
          <MinimizeButton />
          <button type="button" aria-label="Close modal" @click="modal?.remove()">
            ×
          </button>
        </div>
      </header>
      <p>{{ message }}</p>
      <label>
        Stateful value
        <input data-testid="demo-modal-input" placeholder="Type before minimizing" />
      </label>
      <p class="demo-modal__hint">
        Minimize this window, change routes, and restore it. The input value stays.
      </p>
    </section>
  </div>
</template>
