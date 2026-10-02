<template>
  <ModalFrame
    :model-value="builder.open"
    :title="builder.templateId ? 'Vorlage bearbeiten' : 'Neue Vorlage'"
    size="full"
    layer="elevated"
    :style="{ '--mf-max-width': '95vw', '--mf-max-height': '95vh', '--mf-body-padding': '0' }"
    @close="close"
  >
    <template #header="{ titleId }">
      <div class="sigb-title">
        <font-awesome-icon :icon="['fas', 'pen-ruler']" />
        <h2 :id="titleId">{{ builder.templateId ? 'Vorlage bearbeiten' : 'Neue Vorlage' }}</h2>
      </div>
    </template>

    <div class="sigb-body">
      <div v-if="loading" class="sigb-state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
        <p>Builder wird geladen…</p>
      </div>
      <div v-else-if="error" class="sigb-state sigb-state--error">
        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" size="2x" />
        <p>{{ error }}</p>
        <AppButton variant="secondary" @click="loadToken">Erneut versuchen</AppButton>
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
  </ModalFrame>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPenRuler, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { DocusealBuilder } from '@docuseal/vue';
import api from '@/utils/api';
import { useSignaturBuilder } from '@/stores/signaturBuilder';
import { useTheme } from '@/stores/theme';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';

library.add(faPenRuler, faSpinner, faTriangleExclamation);

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
.sigb-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--action-accent-text);
  h2 { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
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

  &--error { color: var(--status-danger-text); }
}
</style>
