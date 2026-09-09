<template>
  <section class="public-monitor-page public-monitor-appearance-page">
    <div class="intro-row">
      <div>
        <h2>Darstellung</h2>
        <p>Wähle, wie dein Public Monitor aussehen soll.</p>
      </div>
    </div>

    <section class="appearance-settings" aria-label="Farbdarstellung">
      <h3>Farbschema</h3>
      <button
        type="button"
        class="appearance-option active"
        @click="$emit('set-theme', themeIsDark ? 'light' : 'dark')"
      >
        <font-awesome-icon :icon="themeIsDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun'" />
        <span>
          <strong>{{ themeIsDark ? 'Dunkler Modus' : 'Heller Modus' }}</strong>
          <small>{{ themeIsDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln' }}</small>
        </span>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="appearance-option__check" />
      </button>
    </section>
  </section>
</template>

<script setup>
defineProps({
  themeIsDark: { type: Boolean, default: false },
});

defineEmits(['set-theme']);
</script>
