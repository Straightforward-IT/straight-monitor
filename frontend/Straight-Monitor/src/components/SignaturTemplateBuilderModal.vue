<template>
  <Teleport to="body">
    <Transition name="sigb-modal">
      <div v-if="builder.open" class="sigb-backdrop" @mousedown.self="close">
        <div class="sigb-dialog" role="dialog" aria-modal="true">
          <header class="sigb-header">
            <div class="sigb-title">
              <font-awesome-icon :icon="['fas', 'pen-ruler']" />
              <h2>{{ builder.templateId ? 'Vorlage bearbeiten' : 'Neue Vorlage' }}</h2>
            </div>
            <button class="sigb-close" type="button" title="Schließen" @click="close">
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </header>

          <div class="sigb-body">
            <div v-if="loading" class="sigb-state">
              <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
              <p>Builder wird geladen…</p>
            </div>
            <div v-else-if="error" class="sigb-state sigb-state--error">
              <font-awesome-icon :icon="['fas', 'triangle-exclamation']" size="2x" />
              <p>{{ error }}</p>
              <button class="sigb-retry" type="button" @click="loadToken">Erneut versuchen</button>
            </div>
            <DocusealBuilder
              v-else-if="token"
              :token="token"
              :host="docusealHost"
              language="de"
              @save="onSave"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPenRuler, faXmark, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { DocusealBuilder } from '@docuseal/vue';
import api from '@/utils/api';
import { useSignaturBuilder } from '@/stores/signaturBuilder';

library.add(faPenRuler, faXmark, faSpinner, faTriangleExclamation);

const builder = useSignaturBuilder();

const token = ref('');
const loading = ref(false);
const error = ref('');

// DocuSeal EU cloud host (the JWT is signed with the EU API key).
const docusealHost = 'cdn.docuseal.eu';

async function loadToken() {
  loading.value = true;
  error.value = '';
  token.value = '';
  try {
    const params = {};
    if (builder.templateId) params.templateId = builder.templateId;
    if (builder.name) params.name = builder.name;
    const { data } = await api.get('/api/signaturen/builder-token', { params });
    token.value = data.token;
  } catch (e) {
    console.error('Builder-Token laden fehlgeschlagen', e);
    error.value = e?.response?.data?.message || 'Der Vorlagen-Editor konnte nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

function onSave(detail) {
  // DocuSeal emits the saved template payload; surface id/name to the caller.
  const tpl = detail?.detail || detail || {};
  builder.notifySaved({ id: tpl.id, name: tpl.name });
}

function close() {
  builder.closeBuilder();
}

watch(() => builder.open, (open) => {
  if (open) loadToken();
  else { token.value = ''; error.value = ''; }
});
</script>

<style scoped lang="scss">
.sigb-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5vh 2.5vw;
}

.sigb-dialog {
  width: 95vw;
  height: 95vh;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sigb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  .sigb-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--primary);
    h2 { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
  }
}

.sigb-close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  &:hover { background: var(--hover); color: var(--text); }
}

.sigb-body {
  flex: 1;
  overflow: auto;
  position: relative;
}

.sigb-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--muted);

  &--error { color: #ef4444; }
}

.sigb-retry {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: none;
  color: var(--text);
  cursor: pointer;
  font-weight: 600;
  &:hover { background: var(--hover); }
}

.sigb-modal-enter-active, .sigb-modal-leave-active { transition: opacity 0.2s; }
.sigb-modal-enter-from, .sigb-modal-leave-to { opacity: 0; }
</style>
