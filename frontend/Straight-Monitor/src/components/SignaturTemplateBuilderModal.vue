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
              :custom-css="builderCustomCss"
              :autosave="!isNewTemplate"
              @load="onTemplateEvent"
              @upload="onUpload"
              @save="onSave"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPenRuler, faXmark, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { DocusealBuilder } from '@docuseal/vue';
import api from '@/utils/api';
import { useSignaturBuilder } from '@/stores/signaturBuilder';
import { useTheme } from '@/stores/theme';

library.add(faPenRuler, faXmark, faSpinner, faTriangleExclamation);

const builder = useSignaturBuilder();
const theme = useTheme();

// Inject dark-mode daisyUI variables into the builder's shadow DOM
const builderCustomCss = computed(() => {
  if (!theme.isDark) return '';
  return `
    :host {
      color-scheme: dark;
      --b1: 222 16% 16%;
      --b2: 222 15% 12%;
      --b3: 222 14% 9%;
      --bc: 220 14% 82%;
      --n: 218 18% 24%;
      --nf: 218 18% 18%;
      --nc: 218 12% 85%;
      --p: 262 72% 60%;
      --pf: 262 72% 50%;
      --pc: 0 0% 100%;
      --s: 316 60% 55%;
      --sf: 316 60% 45%;
      --sc: 0 0% 100%;
      --a: 174 55% 45%;
      --af: 174 55% 35%;
      --ac: 0 0% 100%;
      --in: 198 80% 55%;
      --su: 158 60% 48%;
      --wa: 43 90% 52%;
      --er: 0 85% 65%;
    }
    .menu li > *:not(ul):not(details):not(.menu-title):active,
    .menu li > *:not(ul):not(details):not(.menu-title).active,
    .menu li > details > summary:active {
      background-color: hsl(var(--p) / 0.2);
      color: hsl(var(--pc));
    }
  `;
});

const token = ref('');
const loading = ref(false);
const error = ref('');
const isNewTemplate = ref(false);
const hasUploadedDocument = ref(false);
const createdTemplateId = ref(null);

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

function getTemplate(detail) {
  const payload = detail?.detail || detail || {};
  return payload.template || payload.data?.template || payload.data || payload;
}

function captureTemplateId(detail) {
  const template = getTemplate(detail);
  const id = Number(template.id || template.template_id);
  if (id) createdTemplateId.value = id;
  return template;
}

function onTemplateEvent(detail) {
  captureTemplateId(detail);
}

function onUpload(detail) {
  hasUploadedDocument.value = true;
  captureTemplateId(detail);
}

async function onSave(detail) {
  // DocuSeal emits the saved template payload; surface id/name to the caller.
  const tpl = captureTemplateId(detail);
  if (isNewTemplate.value && !hasUploadedDocument.value) {
    try {
      if (createdTemplateId.value) await api.delete(`/api/docuseal/templates/${createdTemplateId.value}`);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Leere Vorlage verworfen', type: 'info' },
      }));
    } catch (e) {
      console.error('Leere Vorlage verwerfen fehlgeschlagen', e);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Leere Vorlage konnte nicht verworfen werden', type: 'error' },
      }));
    } finally {
      builder.closeBuilder();
    }
    return;
  }
  const resolvedId = createdTemplateId.value || tpl.id;
  if (builder.defaultTypId && resolvedId) {
    try {
      await api.patch(`/api/docuseal/templates/${resolvedId}`, { defaultTypId: builder.defaultTypId });
    } catch (e) {
      console.error('Standard-Dokumenttyp speichern fehlgeschlagen', e);
    }
  }
  builder.notifySaved({ id: resolvedId, name: tpl.name || builder.name });
  if (builder.closeAfterSave) builder.closeBuilder();
}

async function close() {
  if (isNewTemplate.value && !hasUploadedDocument.value && createdTemplateId.value) {
    try {
      await api.delete(`/api/docuseal/templates/${createdTemplateId.value}`);
    } catch (e) {
      console.error('Leere Vorlage verwerfen fehlgeschlagen', e);
    }
  }
  builder.closeBuilder();
}

watch(() => builder.open, (open) => {
  if (open) {
    isNewTemplate.value = !builder.templateId;
    hasUploadedDocument.value = false;
    createdTemplateId.value = builder.templateId || null;
    loadToken();
  } else {
    token.value = '';
    error.value = '';
    isNewTemplate.value = false;
    hasUploadedDocument.value = false;
    createdTemplateId.value = null;
  }
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
