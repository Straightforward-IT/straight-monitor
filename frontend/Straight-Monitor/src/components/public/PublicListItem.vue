<template>
  <div class="public-list-item">
    <button
      v-if="clickable"
      class="public-list-item__button"
      type="button"
      @click="$emit('click')"
    >
      <font-awesome-icon
        v-if="icon"
        class="public-list-item__icon"
        :class="iconClass"
        :icon="icon"
      />
      <span class="public-list-item__content">
        <strong>{{ title }}</strong>
        <small v-if="description">{{ description }}</small>
      </span>
      <span v-if="badge" class="public-list-item__badge">{{ badge }}</span>
      <font-awesome-icon v-if="chevron" class="public-list-item__chevron" icon="fa-solid fa-chevron-right" />
    </button>
    <div v-else class="public-list-item__button">
      <font-awesome-icon
        v-if="icon"
        class="public-list-item__icon"
        :class="iconClass"
        :icon="icon"
      />
      <span class="public-list-item__content">
        <strong>{{ title }}</strong>
        <small v-if="description">{{ description }}</small>
      </span>
      <span v-if="badge" class="public-list-item__badge">{{ badge }}</span>
      <font-awesome-icon v-if="chevron" class="public-list-item__chevron" icon="fa-solid fa-chevron-right" />
    </div>
    <div v-if="$slots.actions" class="public-list-item__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  badge: { type: [Number, String], default: null },
  chevron: { type: Boolean, default: true },
  clickable: { type: Boolean, default: true },
  description: { type: String, default: '' },
  icon: { type: [Array, String], default: null },
  iconClass: { type: String, default: '' },
  title: { type: String, required: true },
});

defineEmits(['click']);
</script>

<style scoped>
.public-list-item { display:flex; align-items:center; width:100%; min-height:62px; border-bottom:1px solid var(--border); }
.public-list-item__button { display:flex; flex:1; width:100%; min-width:0; align-items:center; gap:.75rem; min-height:62px; padding:.65rem 0; border:0; background:transparent; color:var(--text); text-align:left; }
button.public-list-item__button { cursor:pointer; }
.public-list-item__icon { width:34px; flex:0 0 34px; color:var(--primary); }
.public-list-item__icon.document-status-approved,
.public-list-item__icon.document-status-in_review { color:var(--dev-green, #2e8b57); }
.public-list-item__icon.document-status-missing,
.public-list-item__icon.document-status-expiring,
.public-list-item__icon.document-status-expired { color:#b56200; }
.public-list-item__content { display:grid; flex:1 1 auto; min-width:0; gap:.15rem; }
.public-list-item__content strong { font-size:.82rem; font-weight:600; }
.public-list-item__content small { overflow:hidden; color:var(--muted); font-size:.72rem; text-overflow:ellipsis; white-space:nowrap; }
.public-list-item__badge { display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; box-sizing:border-box; min-width:22px; height:22px; padding:0 4px; border:1px solid var(--primary); border-radius:999px; color:var(--primary); font-size:.68rem; font-style:normal; font-weight:800; line-height:1; }
.public-list-item__chevron { flex-shrink:0; color:var(--muted); font-size:.72rem; }
.public-list-item__actions { display:flex; align-items:center; padding-left:.5rem; }
@media (max-width:390px) {
  .public-list-item__actions { padding-left:.25rem; }
  .public-list-item__actions :deep(.upload-button) { padding:.35rem .4rem; font-size:.62rem; }
}
</style>
