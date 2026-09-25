<template>
  <div class="record-chronik-composer">
    <span class="record-chronik-composer__avatar">{{ initials(currentUserName) }}</span>
    <div class="record-chronik-composer__controls">
      <textarea
        :value="draft"
        rows="1"
        placeholder="Kommentar hinzufügen…"
        @input="$emit('update:draft', $event.target.value)"
        @keydown.ctrl.enter.prevent="$emit('add')"
      />
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!draft.trim() || adding"
        @click="$emit('add')"
      >
        <font-awesome-icon :icon="['fas', adding ? 'spinner' : 'paper-plane']" :spin="adding" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPaperPlane, faSpinner } from '@fortawesome/free-solid-svg-icons';

library.add(faPaperPlane, faSpinner);

defineProps({
  draft: { type: String, default: '' },
  adding: { type: Boolean, default: false },
  currentUserName: { type: String, default: '' },
});
defineEmits(['update:draft', 'add']);

function initials(name) {
  return String(name || '?').split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?';
}
</script>

<style scoped lang="scss">
.record-chronik-composer { align-items: flex-start; border-top: 1px solid var(--border); display: flex; gap: 8px; padding-top: 12px; }
.record-chronik-composer__avatar { align-items: center; background: var(--primary); border-radius: 50%; color: #fff; display: inline-flex; flex: 0 0 22px; font-size: 9px; font-weight: 700; height: 22px; justify-content: center; }
.record-chronik-composer__controls { display: flex; flex: 1; gap: 6px; }
.record-chronik-composer textarea { background: var(--tile-bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); flex: 1; font: inherit; min-height: 34px; padding: 7px 9px; resize: vertical; }
.record-chronik-composer .btn { align-self: flex-end; padding: 7px 10px; }
</style>
