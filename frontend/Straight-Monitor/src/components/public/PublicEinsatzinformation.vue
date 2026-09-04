<template>
  <section v-if="html" class="public-einsatzinfo" aria-labelledby="einsatzinfo-heading">
    <div class="public-einsatzinfo__heading">
      <span class="public-einsatzinfo__icon"><font-awesome-icon icon="fa-solid fa-circle-info" /></span>
      <div>
        <span>Vor deinem Einsatz</span>
        <h3 id="einsatzinfo-heading">Wichtige Einsatzinformationen</h3>
      </div>
    </div>
    <!-- Ausschließlich serverseitig gerenderte und bereinigte Ausgabe. -->
    <div class="public-einsatzinfo__content" v-html="html"></div>
  </section>
</template>

<script setup>
defineProps({
  html: { type: String, default: '' },
});
</script>

<style scoped>
.public-einsatzinfo {
  margin: 1.1rem 0;
  padding: 1rem 1.05rem;
  border: 1px solid color-mix(in srgb, var(--primary) 38%, var(--border));
  border-left: 3px solid var(--primary);
  border-radius: 8px;
  color: var(--text);
  background: color-mix(in srgb, var(--primary) 6%, var(--panel));
}

.public-einsatzinfo__heading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.public-einsatzinfo__heading span:not(.public-einsatzinfo__icon) {
  display: block;
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.public-einsatzinfo__heading h3 {
  margin: 0.1rem 0 0;
  color: var(--text);
  font-size: 1rem;
}

.public-einsatzinfo__icon {
  display: grid;
  flex: 0 0 2.25rem;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 6px;
  color: #fff;
  background: var(--primary);
}

.public-einsatzinfo__content {
  color: var(--text);
  font-size: 0.94rem;
  line-height: 1.62;
  overflow-wrap: anywhere;
}

.public-einsatzinfo__content :deep(p:first-child) { margin-top: 0; }
.public-einsatzinfo__content :deep(p:last-child) { margin-bottom: 0; }
.public-einsatzinfo__content :deep(ul),
.public-einsatzinfo__content :deep(ol) { padding-left: 1.35rem; }
.public-einsatzinfo__content :deep(a) { color: var(--primary); font-weight: 700; }
</style>
