<template>
  <section
    class="order-documents"
    :aria-labelledby="titleId"
  >
    <div class="order-documents-header">
      <h3 :id="titleId">
        <font-awesome-icon icon="fa-solid fa-folder-open" /> Einsatzdokumente
      </h3>
      <AppButton
        variant="outlined"
        size="sm"
        aria-label="Neues Einsatzdokument"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        @click.stop="emit('toggle-menu', $event)"
      >
        <font-awesome-icon icon="fa-solid fa-plus" /> Neu
        <font-awesome-icon icon="fa-solid fa-chevron-down" />
      </AppButton>
    </div>
    <div
      v-if="hoursLoading"
      class="order-document-loading"
      role="status"
    >
      Lade Stundenliste…
    </div>
    <article
      v-else-if="hoursList"
      class="order-document order-document--hours"
      :class="`order-document--${hoursList.status}`"
    >
      <AppButton
        variant="ghost"
        size="sm"
        class="order-document-title-action"
        aria-label="Stundenlisten-Vorgang öffnen"
        @click="emit('open-signature', hoursList._id)"
      >
        Stundenliste
      </AppButton>
      <div class="order-document-meta">
        <span class="order-document-filename">{{ hoursList.fileName || `${hoursList.name}.pdf` }}</span>
        <span>{{ completedSigners }}/{{ (hoursList.submitters || []).length }} unterschrieben</span>
      </div>
      <div class="order-document-actions order-document-actions--hours">
        <span
          class="order-document-badge"
          :class="`order-document-badge--${hoursList.status}`"
        >{{ hoursStatusText }}</span>
        <a
          v-if="hoursStatus?.signedPdfUrl"
          :href="hoursStatus.signedPdfUrl"
          target="_blank"
          rel="noopener"
          class="order-document-link"
          aria-label="Unterzeichnete Stundenliste öffnen"
          title="Unterzeichnete Stundenliste öffnen"
        >
          <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" />
        </a>
        <AppIconButton
          v-if="hoursStatus?.signedPdfUrl"
          variant="ghost"
          size="sm"
          label="Unterzeichnete Stundenliste herunterladen"
          @click="emit('download-hours', true)"
        >
          <font-awesome-icon icon="fa-solid fa-download" />
        </AppIconButton>
        <AppButton
          v-if="hoursList.status === 'completed' && canSign"
          variant="outlined"
          size="sm"
          title="Stundenliste neu ausstellen"
          @click="emit('edit-hours', { allowReplacement: true })"
        >
          <font-awesome-icon icon="fa-solid fa-file-signature" /> Neu ausstellen
        </AppButton>
        <AppIconButton
          v-if="hoursList.status === 'open' && canSign"
          variant="ghost"
          size="sm"
          label="Signaturprozess anzeigen"
          @click="emit('open-signature', hoursList._id)"
        >
          <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" />
        </AppIconButton>
        <template v-if="hoursList.status === 'draft'">
          <a
            v-if="hoursStatus?.unsignedPdfUrl"
            :href="hoursStatus.unsignedPdfUrl"
            target="_blank"
            rel="noopener"
            class="order-document-link"
            aria-label="Stundenliste öffnen"
            title="Stundenliste öffnen"
          >
            <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" />
          </a>
          <AppIconButton
            v-if="hoursStatus?.unsignedPdfUrl"
            variant="ghost"
            size="sm"
            label="Stundenliste herunterladen"
            @click="emit('download-hours', false)"
          >
            <font-awesome-icon icon="fa-solid fa-download" />
          </AppIconButton>
          <AppIconButton
            variant="ghost"
            size="sm"
            label="Signaturentwurf löschen"
            class="order-document-delete"
            @click="emit('delete-hours')"
          >
            <font-awesome-icon icon="fa-solid fa-trash" />
          </AppIconButton>
          <AppButton
            variant="outlined"
            size="sm"
            title="Signaturentwurf bearbeiten"
            @click="emit('edit-hours')"
          >
            <font-awesome-icon icon="fa-solid fa-file-signature" /> Signieren
          </AppButton>
        </template>
      </div>
    </article>

    <article
      v-for="expense in expenses"
      :key="expense._id"
      class="order-document"
      :class="`order-document--${expense.status}`"
    >
      <font-awesome-icon
        icon="fa-solid fa-car"
        class="order-document-icon"
      />
      <div class="order-document-info">
        <div class="order-document-name">
          Reisekostenabrechnung
        </div>
        <div class="order-document-meta">
          {{ expenseName(expense) }} · {{ expense.status === 'signature_pending' ? 'Signatur ausstehend' : expense.status === 'completed' ? 'Unterschrieben' : 'Entwurf' }}
        </div>
      </div>
      <div class="order-document-actions">
        <AppIconButton
          v-if="expense.signaturVorgang?._id"
          variant="ghost"
          size="sm"
          :label="`Signaturvorgang für ${expenseName(expense)} öffnen`"
          @click="emit('open-signature', expense.signaturVorgang._id)"
        >
          <font-awesome-icon icon="fa-solid fa-file-signature" />
        </AppIconButton>
        <AppIconButton
          variant="ghost"
          size="sm"
          :label="`Reisekosten-PDF für ${expenseName(expense)} öffnen`"
          @click="emit('open-expense-pdf', expense)"
        >
          <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" />
        </AppIconButton>
        <AppIconButton
          v-if="expense.status === 'draft'"
          variant="ghost"
          size="sm"
          :label="`Reisekosten für ${expenseName(expense)} bearbeiten`"
          @click="emit('edit-expense', expense._id)"
        >
          <font-awesome-icon icon="fa-solid fa-pencil" />
        </AppIconButton>
        <AppButton
          v-if="expense.status === 'draft' && canSign"
          variant="outlined"
          size="sm"
          title="Zur Signatur senden"
          @click="emit('sign-expense', expense)"
        >
          <font-awesome-icon icon="fa-solid fa-file-signature" /> Signieren
        </AppButton>
        <AppIconButton
          v-if="expense.status !== 'signature_pending'"
          variant="ghost"
          size="sm"
          :label="`Reisekosten für ${expenseName(expense)} löschen`"
          class="order-document-delete"
          @click="emit('delete-expense', expense)"
        >
          <font-awesome-icon icon="fa-solid fa-trash" />
        </AppIconButton>
      </div>
    </article>

    <div
      v-if="documentsLoading"
      class="order-document-loading"
      role="status"
    >
      Lade Dokumente…
    </div>
    <template v-else>
      <article
        v-for="document in documents"
        :key="document._id || document.key"
        class="order-document order-document--upload"
      >
        <font-awesome-icon
          icon="fa-solid fa-file"
          class="order-document-icon"
        />
        <div class="order-document-info">
          <div class="order-document-name">
            {{ document.filename }}
          </div>
          <div class="order-document-meta">
            {{ formatSize(document.size) }}
          </div>
        </div>
        <div class="order-document-actions">
          <AppIconButton
            variant="ghost"
            size="sm"
            :label="`${document.filename} öffnen`"
            @click="emit('preview-document', document)"
          >
            <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" />
          </AppIconButton>
          <AppIconButton
            variant="ghost"
            size="sm"
            :label="`${document.filename} herunterladen`"
            @click="emit('download-document', document)"
          >
            <font-awesome-icon icon="fa-solid fa-download" />
          </AppIconButton>
          <AppIconButton
            variant="ghost"
            size="sm"
            :label="`${document.filename} löschen`"
            class="order-document-delete"
            @click="emit('delete-document', document)"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </AppIconButton>
        </div>
      </article>
      <div
        v-if="uploading"
        class="order-document-loading"
        role="status"
      >
        Wird hochgeladen…
      </div>
      <AppButton
        variant="outlined"
        class="order-document-upload"
        :disabled="uploading"
        @click="fileInput?.click()"
      >
        <font-awesome-icon icon="fa-solid fa-upload" /> Dokument hochladen
      </AppButton>
      <input
        ref="fileInput"
        type="file"
        hidden
        aria-label="Dokument auswählen"
        @change="emit('upload', $event)"
      >
    </template>
  </section>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faFolderOpen, faPlus, faChevronDown, faArrowUpRightFromSquare, faDownload, faFileSignature, faTrash, faCar, faPencil, faFile, faXmark, faUpload } from '@fortawesome/free-solid-svg-icons';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
library.add(faFolderOpen, faPlus, faChevronDown, faArrowUpRightFromSquare, faDownload, faFileSignature, faTrash, faCar, faPencil, faFile, faXmark, faUpload);
const props = defineProps({
  hoursStatus: { type: Object, default: null }, hoursLoading: { type: Boolean, default: false },
  documents: { type: Array, default: () => [] }, documentsLoading: { type: Boolean, default: false },
  expenses: { type: Array, default: () => [] }, uploading: { type: Boolean, default: false },
  canSign: { type: Boolean, default: false }, menuOpen: { type: Boolean, default: false },
  expenseName: { type: Function, required: true }, formatSize: { type: Function, required: true },
});
const emit = defineEmits(['toggle-menu', 'open-signature', 'download-hours', 'edit-hours', 'delete-hours', 'open-expense-pdf', 'edit-expense', 'sign-expense', 'delete-expense', 'preview-document', 'download-document', 'delete-document', 'upload']);
const fileInput = ref(null);
const titleId = `order-documents-${getCurrentInstance().uid}`;
const hoursList = computed(() => props.hoursStatus?.vorgang);
const completedSigners = computed(() => (hoursList.value?.submitters || []).filter(signer => signer.status === 'completed').length);
const hoursStatusText = computed(() => ({ open: 'Ausstehend', completed: 'Unterschrieben', draft: 'Entwurf', cancelled: 'Storniert' })[hoursList.value?.status] || hoursList.value?.status);
</script>

<style scoped>
.order-documents { margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--border); }
.order-documents-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.order-documents-header h3 { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--text); font-size: .95rem; }
.order-document { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 7px; padding: 8px 10px; border: 1px solid var(--border); border-left-width: 3px; border-radius: 9px; background: var(--tile-bg, var(--surface)); }
.order-document--completed { border-left-color: var(--status-success-text); }
.order-document--open, .order-document--signature_pending { border-left-color: var(--status-warning); }
.order-document--draft, .order-document--uploading { border-left-color: var(--muted); }
.order-document--cancelled { border-left-color: var(--status-danger-text); }
.order-document--upload { border-left-color: var(--primary); }
.order-document--hours { display: grid; gap: 7px; padding: 10px 12px; }
.order-document-title-action { justify-self: start; font-weight: 600; }
.order-document-info { flex: 1; min-width: 0; }
.order-document-icon { color: var(--action-accent-text); }
.order-document-name { color: var(--text); font-size: .83rem; font-weight: 600; overflow-wrap: anywhere; }
.order-document-meta { display: grid; gap: 2px; margin-top: 2px; color: var(--muted); font-size: .72rem; }
.order-document-filename { color: var(--text); overflow-wrap: anywhere; }
.order-document-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px; }
.order-document-actions--hours { gap: 6px; padding-top: 8px; border-top: 1px solid var(--border); }
.order-document-badge { margin-right: auto; padding: 2px 7px; border-radius: 10px; background: var(--hover); color: var(--muted); font-size: .7rem; font-weight: 600; }
.order-document-badge--completed { background: color-mix(in srgb, var(--status-success-text) 16%, transparent); color: var(--status-success-text); }
.order-document-badge--open { background: color-mix(in srgb, var(--status-warning) 14%, transparent); color: var(--status-warning-text); }
.order-document-badge--cancelled { background: color-mix(in srgb, var(--status-danger-text) 12%, transparent); color: var(--status-danger-text); }
.order-document-delete { --action-ghost-text: var(--status-danger-text); --action-ghost-hover: color-mix(in srgb, var(--status-danger-text) 12%, transparent); }
.order-document-link { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: var(--control-radius); color: var(--action-accent-text); }
.order-document-link:hover { background: var(--action-ghost-hover); }
.order-document-link:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 2px; }
.order-document-upload { width: 100%; margin-top: 7px; }
.order-document-loading { padding: 8px 0; color: var(--muted); font-size: .8rem; }
</style>
