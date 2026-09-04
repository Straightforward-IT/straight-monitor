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
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.98));
  box-shadow: 0 10px 28px rgba(30, 64, 175, 0.08);
}

.public-einsatzinfo__heading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.public-einsatzinfo__heading span:not(.public-einsatzinfo__icon) {
  display: block;
  color: #2563eb;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.public-einsatzinfo__heading h3 {
  margin: 0.1rem 0 0;
  color: #172554;
  font-size: 1rem;
}

.public-einsatzinfo__icon {
  display: grid;
  flex: 0 0 2.25rem;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: #2563eb;
}

.public-einsatzinfo__content {
  color: #273449;
  font-size: 0.94rem;
  line-height: 1.62;
  overflow-wrap: anywhere;
}

.public-einsatzinfo__content :deep(p:first-child) { margin-top: 0; }
.public-einsatzinfo__content :deep(p:last-child) { margin-bottom: 0; }
.public-einsatzinfo__content :deep(ul),
.public-einsatzinfo__content :deep(ol) { padding-left: 1.35rem; }
.public-einsatzinfo__content :deep(a) { color: #1d4ed8; font-weight: 700; }
</style>
