<template>
  <div class="addr-ac" @focusout="onFocusOut">
    <AppTextInput
      ref="inputComponent"
      v-bind="$attrs"
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="showList"
      :aria-controls="showList ? listId : undefined"
      :aria-activedescendant="showList && active >= 0 ? `${listId}-option-${active}` : undefined"
      @update:model-value="onInput"
      @focus="onFocus"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter="onEnter"
      @keydown.esc="onEscape"
    />
    <Teleport to="body">
      <ul v-if="showList" :id="listId" class="addr-ac-list" :style="dropStyle" role="listbox">
        <li
          v-for="(suggestion, index) in list"
          :id="`${listId}-option-${index}`"
          :key="suggestion"
          class="addr-ac-item"
          :class="{ active: index === active }"
          role="option"
          :aria-selected="index === active"
          @pointerdown.prevent="choose(index)"
          @click="choose(index)"
          @mouseenter="active = index"
        >
          <font-awesome-icon :icon="['fas', 'location-dot']" aria-hidden="true" /> {{ suggestion }}
        </li>
        <li v-if="loading" class="addr-ac-item addr-ac-item--muted" role="presentation" aria-live="polite">
          <font-awesome-icon :icon="['fas', 'spinner']" spin aria-hidden="true" /> Suche…
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faLocationDot, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';

library.add(faLocationDot, faSpinner);
defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  localSuggestions: { type: Array, default: () => [] },
  // The caller owns the data source. Return an array of address labels.
  searchSuggestions: { type: Function, default: null },
  minSearchLength: { type: Number, default: 3 },
  debounceMs: { type: Number, default: 300 },
});
const emit = defineEmits(['update:modelValue']);

const listId = `addr-ac-list-${useId()}`;
const inputComponent = ref(null);
const open = ref(false);
const active = ref(-1);
const loading = ref(false);
const remote = ref([]);
const dropStyle = ref({});
let debounceTimer = null;
let requestSequence = 0;
let lastEmittedValue = props.modelValue;

const inputEl = computed(() => inputComponent.value?.$el);
const normalizedLocal = computed(() => props.localSuggestions.filter((value) => typeof value === 'string' && value.trim()));
const localMatches = computed(() => {
  const query = props.modelValue.trim().toLocaleLowerCase('de');
  const suggestions = query
    ? normalizedLocal.value.filter((value) => value.toLocaleLowerCase('de').includes(query))
    : normalizedLocal.value;
  return suggestions.slice(0, 5);
});
const list = computed(() => {
  const seen = new Set();
  return [...localMatches.value, ...remote.value]
    .filter((value) => {
      if (typeof value !== 'string' || !value.trim()) return false;
      const key = value.toLocaleLowerCase('de');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
});
const showList = computed(() => open.value && !props.disabled && (list.value.length > 0 || loading.value));

function updatePosition() {
  const rect = inputEl.value?.getBoundingClientRect();
  if (!rect) return;
  dropStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 2}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  };
}

function cancelSearch() {
  clearTimeout(debounceTimer);
  requestSequence += 1;
  loading.value = false;
}

function scheduleSearch(value) {
  cancelSearch();
  remote.value = [];
  const query = value.trim();
  if (!props.searchSuggestions || query.length < props.minSearchLength || props.disabled) return;
  const sequence = requestSequence;
  loading.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      const suggestions = await props.searchSuggestions(query);
      if (sequence === requestSequence) remote.value = Array.isArray(suggestions) ? suggestions : [];
    } catch {
      if (sequence === requestSequence) remote.value = [];
    } finally {
      if (sequence === requestSequence) {
        loading.value = false;
        nextTick(updatePosition);
      }
    }
  }, props.debounceMs);
}

function onInput(value) {
  lastEmittedValue = value;
  emit('update:modelValue', value);
  open.value = true;
  active.value = -1;
  scheduleSearch(value);
  nextTick(updatePosition);
}

function onFocus() {
  if (props.disabled) return;
  open.value = true;
  if (props.modelValue.trim().length >= props.minSearchLength && !remote.value.length) scheduleSearch(props.modelValue);
  nextTick(updatePosition);
}

function move(direction) {
  if (props.disabled || !list.value.length) return;
  open.value = true;
  active.value = active.value < 0 && direction < 0
    ? list.value.length - 1
    : (active.value + direction + list.value.length) % list.value.length;
  nextTick(updatePosition);
}

function choose(index) {
  if (props.disabled) return;
  const value = list.value[index];
  if (!value) return;
  cancelSearch();
  remote.value = [];
  lastEmittedValue = value;
  emit('update:modelValue', value);
  open.value = false;
  active.value = -1;
}

function onEnter(event) {
  if (showList.value && active.value >= 0) {
    event.preventDefault();
    choose(active.value);
  }
}

function onEscape(event) {
  if (!showList.value) return;
  event.preventDefault();
  event.stopPropagation();
  open.value = false;
  active.value = -1;
  cancelSearch();
}

function onFocusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    open.value = false;
    active.value = -1;
  }
}

function onScrollResize() {
  if (showList.value) updatePosition();
}

watch(() => props.modelValue, (value) => {
  if (!value || value !== lastEmittedValue) {
    cancelSearch();
    remote.value = [];
    active.value = -1;
  }
  lastEmittedValue = value;
});
watch(() => props.disabled, (disabled) => {
  if (disabled) {
    cancelSearch();
    remote.value = [];
    open.value = false;
    active.value = -1;
  }
});

onMounted(() => {
  window.addEventListener('scroll', onScrollResize, true);
  window.addEventListener('resize', onScrollResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollResize, true);
  window.removeEventListener('resize', onScrollResize);
  cancelSearch();
});
</script>

<style scoped lang="scss">
.addr-ac { position: relative; min-width: 0; }
</style>

<style lang="scss">
.addr-ac-list {
  z-index: 3000;
  margin: 0;
  padding: 4px;
  list-style: none;
  max-height: 300px;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--control-input-border);
  border-radius: var(--control-radius);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
}
.addr-ac-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: var(--control-radius);
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--text);
  cursor: pointer;
}
.addr-ac-item svg { color: var(--action-accent-text); flex-shrink: 0; }
.addr-ac-item.active { background: var(--action-ghost-hover); }
.addr-ac-item--muted { color: var(--muted); cursor: default; }
</style>
