<template>
  <ModalFrame
    :title="title || 'Dokument unterschreiben'"
    size="xl"
    :close-on-backdrop="false"
    style="--mf-max-width: 1040px; --mf-max-height: 94dvh; --mf-body-padding: 0; --mf-body-overflow: auto"
    @close="emit('close')"
  >
    <div v-if="!completed && currentSigner" class="signing-modal">
      <div class="signing-meta">
        <div>
          <strong>{{ currentSigner.name || currentSigner.role || 'Unterzeichner' }}</strong>
          <span v-if="currentSigner.email">{{ currentSigner.email }}</span>
        </div>
        <span v-if="signers.length > 1">{{ currentIndex + 1 }} von {{ signers.length }}</span>
      </div>

      <DocusealForm
        :key="currentSigner.src"
        :src="currentSigner.src"
        host="cdn.docuseal.eu"
        language="de"
        :with-title="false"
        :send-copy-email="false"
        class="signing-form"
        @complete="onComplete"
      />
    </div>

    <div v-else class="signing-complete">
      <font-awesome-icon :icon="['fas', 'circle-check']" />
      <h3>Unterschrift abgeschlossen</h3>
      <button type="button" @click="emit('close')">Schließen</button>
    </div>
  </ModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue';
import { DocusealForm } from '@docuseal/vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';

const props = defineProps({
  title: { type: String, default: '' },
  signers: { type: Array, required: true },
});

const emit = defineEmits(['close', 'complete']);
const currentIndex = ref(0);
const completed = ref(false);
const currentSigner = computed(() => props.signers[currentIndex.value] || null);

function onComplete() {
  if (currentIndex.value < props.signers.length - 1) {
    currentIndex.value += 1;
    return;
  }
  completed.value = true;
  emit('complete');
}
</script>

<style scoped lang="scss">
.signing-modal {
  min-height: min(760px, 80dvh);
  background: var(--surface);
}

.signing-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  strong { color: var(--text); font-size: 0.9rem; }
  span { color: var(--muted); font-size: 0.78rem; }
}

.signing-form {
  display: block;
  min-height: 700px;
}

.signing-complete {
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--text);

  svg { color: #16a34a; font-size: 3rem; }
  h3 { font-size: 1.2rem; }

  button {
    border: 0;
    border-radius: 8px;
    padding: 10px 18px;
    background: var(--primary);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }
}

@media (max-width: 700px) {
  .signing-modal { min-height: 82dvh; }
  .signing-form { min-height: 76dvh; }
  .signing-meta { align-items: flex-start; }
}
</style>