<template>
  <SidePanelFrame
    :model-value="modelValue"
    :presentation="presentation"
    width="420px"
    :modal-minimizable="true"
    :modal-title="lead.title"
    :show-close="!isMobile"
    v-bind="$attrs"
    @update:model-value="$emit('update:modelValue', $event)"
    @update:presentation="$emit('update:presentation', $event)"
    @close="$emit('close')"
  >
    <template #header>
      <button v-if="isMobile" class="mobile-back-btn" title="Zurück" @click="$emit('close')"><font-awesome-icon :icon="['fas', 'chevron-left']" /></button>
      <div class="sidebar-title-area"><h3>{{ lead.title }}</h3><div class="sidebar-status"><span class="stufe-chip" :class="`stufe-${lead.stufe}`">{{ stageLabel(lead.stufe) }}</span><span v-if="ownerLabel" class="sidebar-owner"><font-awesome-icon :icon="['fas', 'user']" /> {{ ownerLabel }}</span></div></div>
    </template>
    <template #actions><slot name="actions" /></template>
    <slot />
    <template v-if="$slots['modal-footer']" #modal-footer><slot name="modal-footer" /></template>
  </SidePanelFrame>
</template>

<script setup>
import SidePanelFrame from '@/components/frames/SidePanelFrame.vue';
defineOptions({ inheritAttrs: false });
defineProps({ modelValue: { type: Boolean, default: false }, presentation: { type: String, default: 'panel' }, lead: { type: Object, required: true }, ownerLabel: { type: String, default: '' }, isMobile: { type: Boolean, default: false } });
defineEmits(['update:modelValue', 'update:presentation', 'close']);
function stageLabel(stage) { return { neu: 'Neu', qualifiziert: 'Qualifiziert', angebot: 'Angebot', verhandlung: 'Verhandlung', gewonnen: 'Gewonnen', verloren: 'Verloren' }[stage] || stage || 'Neu'; }
</script>

<style scoped lang="scss">
.sidebar-title-area { min-width: 0; }.sidebar-title-area h3 { color: var(--text); font-size: 1.1rem; margin: 0 0 6px; overflow-wrap: anywhere; }.sidebar-status { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }.sidebar-owner { align-items: center; color: var(--muted); display: inline-flex; font-size: .8rem; gap: 6px; line-height: 1.2; min-width: 0; }.sidebar-owner svg { flex: 0 0 auto; font-size: .75rem; }
.stufe-chip { background: var(--hover); border-radius: 4px; color: var(--text); display: inline-block; font-size: .72rem; font-weight: 600; padding: 3px 8px; }.stufe-chip.stufe-neu { background: #e0e7ff; color: #3730a3; }.stufe-chip.stufe-qualifiziert { background: #cffafe; color: #155e75; }.stufe-chip.stufe-angebot { background: #fef3c7; color: #92400e; }.stufe-chip.stufe-verhandlung { background: #fed7aa; color: #9a3412; }.stufe-chip.stufe-gewonnen { background: #d1fae5; color: #065f46; }.stufe-chip.stufe-verloren { background: #fee2e2; color: #991b1b; }
.mobile-back-btn { align-items: center; background: none; border: 0; border-radius: 6px; color: var(--text); cursor: pointer; display: inline-flex; font-size: 18px; justify-content: center; margin-right: 4px; min-height: 44px; min-width: 44px; padding: 8px 10px; }.mobile-back-btn:hover { background: var(--hover); }
</style>
