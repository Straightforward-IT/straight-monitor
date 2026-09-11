<template>
  <SignaturR2Browser
    :root-label="rootLabel"
    :list-url="listUrl"
    :file-url-endpoint="fileUrlEndpoint"
    :upload-url="uploadUrl"
    :delete-url="deleteUrl"
    :root-prefix="rootPrefix"
    :enable-entity-links="enableEntityLinks"
    :allow-upload="allowUpload"
    :allow-delete="allowDelete"
    :non-deletable-prefixes="nonDeletablePrefixes"
    :archive-deleted="archiveDeleted"
  />
</template>

<script setup>
import SignaturR2Browser from '@/components/SignaturR2Browser.vue';

defineProps({
  rootLabel: { type: String, required: true },
  listUrl: { type: String, required: true },
  fileUrlEndpoint: { type: String, required: true },
  uploadUrl: { type: String, default: '' },
  deleteUrl: { type: String, default: '' },
  rootPrefix: { type: String, default: '' },
  enableEntityLinks: { type: Boolean, default: false },
  allowUpload: { type: Boolean, default: false },
  allowDelete: { type: Boolean, default: false },
  nonDeletablePrefixes: { type: Array, default: () => [] },
  archiveDeleted: { type: Boolean, default: false },
});
</script>