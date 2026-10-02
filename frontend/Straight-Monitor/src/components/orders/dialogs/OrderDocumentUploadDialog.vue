<template>
  <OrderActionDialog
    :model-value="modelValue"
    title="Dokument hochladen"
    icon="fa-solid fa-upload"
    :saving="uploading"
    :can-submit="!!file"
    submit-label="Hochladen"
    @close="emit('close')"
    @submit="emit('submit')"
  >
    <template #default="{ formId }">
      <p class="order-upload-filename">
        {{ file?.name }}
      </p>
      <div class="order-dialog-field">
        <label
          class="order-dialog-label"
          :for="`${formId}-type`"
        >Dokumenttyp</label>
        <select
          :id="`${formId}-type`"
          v-model="typeModel"
          class="order-dialog-native"
        >
          <option value="einsatznachweis">
            Einsatznachweis
          </option>
          <option value="einsatzinformation">
            Einsatzinformation
          </option>
          <option value="ablauf">
            Ablaufplan
          </option>
          <option value="wegbeschreibung">
            Wegbeschreibung
          </option>
          <option value="sicherheit">
            Sicherheitsdokument
          </option>
          <option value="kunde">
            Kundendokument
          </option>
          <option value="sonstiges">
            Sonstiges
          </option>
        </select>
      </div>
      <div class="order-dialog-field">
        <label
          class="order-dialog-label"
          :for="`${formId}-audience`"
        >Sichtbar für</label>
        <select
          :id="`${formId}-audience`"
          v-model="audienceModel"
          class="order-dialog-native"
        >
          <option value="job">
            Mitarbeiter im Auftrag
          </option>
          <option value="teamleiter">
            Teamleiter im Auftrag
          </option>
          <option value="office">
            Alle App-Nutzer
          </option>
          <option value="office_roles">
            Bestimmte App-Rollen
          </option>
        </select>
      </div>
      <div
        v-if="audience === 'job'"
        class="order-dialog-field"
      >
        <label
          class="order-dialog-label"
          :for="`${formId}-jobs`"
        >Berufe einschränken (optional)</label>
        <BerufSearch
          :disabled="uploading"
          :input-id="`${formId}-jobs`"
          :model-value="berufKeys"
          @update:model-value="emit('update:berufKeys', $event)"
        />
      </div>
      <div
        v-if="audience === 'office_roles'"
        class="order-dialog-field"
      >
        <label
          class="order-dialog-label"
          :for="`${formId}-roles`"
        >App-Rollen (kommagetrennt)</label>
        <AppTextInput
          :id="`${formId}-roles`"
          v-model="rolesModel"
          placeholder="ADMIN, VERTRIEB"
        />
      </div>
      <div class="order-dialog-field">
        <label
          class="order-dialog-label"
          :for="`${formId}-emails`"
        >E-Mail-Benachrichtigung (optional)</label>
        <AppTextInput
          :id="`${formId}-emails`"
          v-model="emailsModel"
          inputmode="email"
          placeholder="name@beispiel.de"
        />
      </div>
      <div class="order-dialog-field">
        <label
          class="order-dialog-label"
          :for="`${formId}-message`"
        >Mitteilung (optional)</label>
        <textarea
          :id="`${formId}-message`"
          v-model="messageModel"
          rows="3"
          class="order-dialog-native order-upload-message"
        />
      </div>
      <p
        v-if="error"
        role="alert"
        class="order-upload-error"
      >
        {{ error }}
      </p>
    </template>
  </OrderActionDialog>
</template>

<script setup>
import { computed } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faUpload } from '@fortawesome/free-solid-svg-icons';
import OrderActionDialog from './OrderActionDialog.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import BerufSearch from '@/components/ui-elements/BerufSearch.vue';
library.add(faUpload);
const props = defineProps({
  modelValue: { type: Boolean, default: false }, file: { type: Object, default: null },
  uploading: { type: Boolean, default: false }, error: { type: String, default: '' },
  type: { type: String, default: 'einsatznachweis' }, audience: { type: String, default: 'job' },
  berufKeys: { type: Array, default: () => [] }, allowedRoles: { type: String, default: '' },
  deliveryEmails: { type: String, default: '' }, deliveryMessage: { type: String, default: '' },
});
const emit = defineEmits(['close', 'submit', 'update:type', 'update:audience', 'update:berufKeys', 'update:allowedRoles', 'update:deliveryEmails', 'update:deliveryMessage']);
const model = key => computed({ get: () => props[key], set: value => emit(`update:${key}`, value) });
const typeModel = model('type'), audienceModel = model('audience'), rolesModel = model('allowedRoles');
const emailsModel = model('deliveryEmails'), messageModel = model('deliveryMessage');
</script>

<style scoped>
.order-upload-filename { margin: 0; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--control-radius); background: var(--control-input-bg); color: var(--text); font-size: .8rem; overflow-wrap: anywhere; }
.order-upload-message { resize: vertical; }
.order-upload-error { margin: 0; color: var(--status-danger-text); font-size: .85rem; }
:deep(.beruf-search__input-wrap) { min-height: 38px; height: auto; box-sizing: border-box; border-color: var(--control-input-border); border-radius: var(--control-radius); background: var(--control-input-bg); }
:deep(.beruf-search__input-wrap:focus-within) { outline: 2px solid var(--control-focus-ring); outline-offset: 1px; box-shadow: none; }
</style>
