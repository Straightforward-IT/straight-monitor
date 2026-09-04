<template>
  <div ref="container" class="pill-multi-select" @click="focusInput">
    <span v-for="option in selectedOptions" :key="optionValue(option)" class="pill-multi-select__pill">
      <span class="pill-multi-select__pill-text">{{ optionLabel(option) }}</span>
      <button
        type="button"
        class="pill-multi-select__remove"
        :aria-label="`${optionLabel(option)} entfernen`"
        @click.stop="remove(option)"
      >
        <font-awesome-icon icon="fa-solid fa-xmark" />
      </button>
    </span>
    <input
      ref="input"
      v-model="query"
      class="pill-multi-select__input"
      type="search"
      :placeholder="selectedOptions.length ? '' : placeholder"
      autocomplete="off"
      @focus="open"
      @input="open"
      @blur="closeAfterPointerEvent"
      @keydown="onKeydown"
    />
  </div>

  <Teleport to="body">
    <div v-if="isOpen" class="pill-multi-select__dropdown" :style="dropdownStyle">
      <button
        v-for="option in suggestions"
        :key="optionValue(option)"
        type="button"
        class="pill-multi-select__option"
        @mousedown.prevent="add(option)"
      >
        <span v-if="optionMeta(option)" class="pill-multi-select__meta">{{ optionMeta(option) }}</span>
        <span>{{ optionLabel(option) }}</span>
      </button>
      <p v-if="!suggestions.length" class="pill-multi-select__empty">Keine Treffer</p>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] },
  valueKey: { type: String, default: '_id' },
  labelKey: { type: String, required: true },
  metaKey: { type: String, default: '' },
  emitObjects: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Suchen...' },
});
const emit = defineEmits(['update:modelValue', 'change']);

const container = ref(null);
const input = ref(null);
const query = ref('');
const isOpen = ref(false);
const dropdownStyle = ref({});

function optionValue(option) {
  return String(option?.[props.valueKey] ?? '');
}

function optionLabel(option) {
  return String(option?.[props.labelKey] ?? '');
}

function optionMeta(option) {
  return props.metaKey ? String(option?.[props.metaKey] ?? '') : '';
}

function modelValueForOption(option) {
  return props.emitObjects ? option : option[props.valueKey];
}

function selectedValue(value) {
  return String(props.emitObjects ? value?.[props.valueKey] : value);
}

const selectedValues = computed(() => new Set(props.modelValue.map(selectedValue)));
const selectedOptions = computed(() => props.options.filter((option) => selectedValues.value.has(optionValue(option))));
const suggestions = computed(() => {
  const search = query.value.trim().toLocaleLowerCase('de');
  return props.options.filter((option) => {
    if (selectedValues.value.has(optionValue(option))) return false;
    if (!search) return true;
    return `${optionLabel(option)} ${optionMeta(option)}`.toLocaleLowerCase('de').includes(search);
  });
});

function updateDropdownPosition() {
  if (!container.value) return;
  const rect = container.value.getBoundingClientRect();
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    minWidth: `${Math.max(rect.width, 260)}px`,
  };
}

function open() {
  updateDropdownPosition();
  isOpen.value = true;
}

function close() {
  isOpen.value = false;
}

function closeAfterPointerEvent() {
  window.setTimeout(close, 150);
}

function add(option) {
  const next = [...props.modelValue, modelValueForOption(option)];
  emit('update:modelValue', next);
  emit('change', next);
  query.value = '';
  open();
}

function remove(option) {
  const value = optionValue(option);
  const next = props.modelValue.filter((item) => selectedValue(item) !== value);
  emit('update:modelValue', next);
  emit('change', next);
}

function onKeydown(event) {
  if (event.key === 'Escape') close();
  if (event.key === 'Backspace' && !query.value && props.modelValue.length) {
    const value = props.modelValue[props.modelValue.length - 1];
    const option = props.options.find((item) => optionValue(item) === selectedValue(value));
    if (option) remove(option);
  }
}

function focusInput() {
  input.value?.focus();
}

onMounted(() => {
  window.addEventListener('scroll', updateDropdownPosition, true);
  window.addEventListener('resize', updateDropdownPosition);
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateDropdownPosition, true);
  window.removeEventListener('resize', updateDropdownPosition);
});
</script>

<style scoped lang="scss">
.pill-multi-select {
  display: flex;
  min-width: 160px;
  max-width: 400px;
  min-height: 28px;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  cursor: text;

  &:focus-within { border-color: var(--primary); }
}

.pill-multi-select__pill {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  padding: 1px 5px 1px 7px;
  border: 1px solid rgba(var(--primary-rgb, 253 126 20) / 0.35);
  border-radius: 20px;
  background: rgba(var(--primary-rgb, 253 126 20) / 0.12);
  color: var(--primary);
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.pill-multi-select__pill-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill-multi-select__remove {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 9px;
  opacity: 0.65;

  &:hover { opacity: 1; }
}

.pill-multi-select__input {
  width: 60px;
  min-width: 60px;
  flex: 1;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 12px;

  &::placeholder { color: var(--muted); opacity: 0.6; }
}

.pill-multi-select__dropdown {
  z-index: 9999;
  max-width: min(500px, calc(100vw - 32px));
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--modal-bg, var(--panel));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.pill-multi-select__option {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;

  &:hover { background: color-mix(in srgb, var(--primary) 10%, transparent); }
}

.pill-multi-select__meta {
  color: var(--primary);
  font-family: monospace;
  font-size: 10px;
  font-weight: 600;
}

.pill-multi-select__empty {
  margin: 0;
  padding: 10px 12px;
  color: var(--muted);
  font-size: 12px;
}
</style>
