<template>
  <div class="dp-root" ref="rootEl">
    <slot :toggle="toggleOpen" />
    <Teleport to="body">
      <Transition name="dp-fade">
        <div v-if="isOpen" class="dp-layer">
          <div class="dp-backdrop" @click="close" />
          <div class="dp-popup" :style="popupStyle" @click.stop>
            <!-- Header -->
            <div class="dp-header">
              <button class="dp-nav-btn" @click="prevMonth" title="Vorheriger Monat">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="10" height="10" fill="currentColor"><path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"/></svg>
              </button>
              <span class="dp-month-label">{{ monthLabel }}</span>
              <button class="dp-nav-btn" @click="nextMonth" title="Nächster Monat">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" width="10" height="10" fill="currentColor"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>
              </button>
            </div>

            <!-- Weekday labels -->
            <div class="dp-weekdays">
              <span v-for="d in WEEKDAYS" :key="d">{{ d }}</span>
            </div>

            <!-- Day cells -->
            <div class="dp-cells">
              <button
                v-for="cell in cells"
                :key="cell.key"
                class="dp-cell"
                :class="{
                  'dp-cell--other': !cell.current,
                  'dp-cell--today': cell.isToday,
                  'dp-cell--selected': cell.isSelected,
                }"
                @click="selectDate(cell.date)"
              >{{ cell.day }}</button>
            </div>

            <!-- Footer -->
            <div class="dp-footer">
              <button class="dp-today-btn" @click="selectToday">Heute</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: Date, default: null },
});
const emit = defineEmits(['update:modelValue']);

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const isOpen = ref(false);
const rootEl = ref(null);
const popupStyle = ref({});

// The month currently displayed in the picker
const viewDate = ref(props.modelValue ? new Date(props.modelValue) : new Date());

watch(() => props.modelValue, (val) => {
  if (val) viewDate.value = new Date(val);
});

const monthLabel = computed(() =>
  `${MONTHS[viewDate.value.getMonth()]} ${viewDate.value.getFullYear()}`
);

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const today = new Date();

const cells = computed(() => {
  const year = viewDate.value.getFullYear();
  const month = viewDate.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday-first offset (0=Mon … 6=Sun)
  let startOffset = firstDay.getDay();
  startOffset = startOffset === 0 ? 6 : startOffset - 1;

  const result = [];

  // Padding from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, 0 - i);
    result.push({ key: `p${i}`, date: d, day: d.getDate(), current: false, isToday: false, isSelected: false });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    result.push({
      key: `c${d}`,
      date,
      day: d,
      current: true,
      isToday: isSameDay(date, today),
      isSelected: isSameDay(date, props.modelValue),
    });
  }

  // Padding to next month (fill up to 42 cells = 6 rows)
  const remaining = 42 - result.length;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d);
    result.push({ key: `n${d}`, date, day: d, current: false, isToday: false, isSelected: false });
  }

  return result;
});

function prevMonth() {
  viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() - 1, 1);
}

function nextMonth() {
  viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + 1, 1);
}

function selectDate(date) {
  emit('update:modelValue', new Date(date));
  close();
}

function selectToday() {
  selectDate(new Date());
}

async function toggleOpen() {
  if (isOpen.value) { close(); return; }
  await nextTick();
  computePosition();
  isOpen.value = true;
}

function close() {
  isOpen.value = false;
}

function computePosition() {
  if (!rootEl.value) return;
  const rect = rootEl.value.getBoundingClientRect();
  const popupW = 280;
  const vpW = window.innerWidth;
  let left = rect.left + rect.width / 2 - popupW / 2;
  left = Math.max(8, Math.min(left, vpW - popupW - 8));
  const top = rect.bottom + 6;
  popupStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${popupW}px`,
    zIndex: 9999,
  };
}
</script>

<style scoped lang="scss">
.dp-root {
  display: contents;
}

// ── Layer (backdrop + popup) ─────────────────────────────────────────────────
.dp-layer {
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
}

.dp-backdrop {
  position: fixed;
  inset: 0;
  pointer-events: auto;
}

// ── Popup ────────────────────────────────────────────────────────────────────
.dp-popup {
  pointer-events: auto;
  background: var(--tile-bg, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  overflow: hidden;
  user-select: none;
}

// ── Header ───────────────────────────────────────────────────────────────────
.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.dp-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  background: transparent;
  color: var(--text, #333);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--primary, #eeaf67);
    color: var(--primary, #eeaf67);
    background: color-mix(in oklab, var(--primary, #eeaf67) 8%, transparent);
  }
}

.dp-month-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text, #333);
}

// ── Weekday row ───────────────────────────────────────────────────────────────
.dp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 6px 8px 2px;

  span {
    text-align: center;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--muted, #888);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

// ── Day cells ─────────────────────────────────────────────────────────────────
.dp-cells {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 2px 8px 8px;
  gap: 2px;
}

.dp-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text, #333);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;

  &:hover {
    background: color-mix(in oklab, var(--primary, #eeaf67) 14%, transparent);
    color: var(--primary, #eeaf67);
  }

  &--other {
    color: var(--muted, #aaa);
    opacity: 0.5;
  }

  &--today {
    font-weight: 800;
    color: var(--primary, #eeaf67);
  }

  &--selected {
    background: var(--primary, #eeaf67) !important;
    color: #fff !important;
    font-weight: 700;
  }
}

// ── Footer ────────────────────────────────────────────────────────────────────
.dp-footer {
  border-top: 1px solid var(--border, #e5e7eb);
  padding: 8px 12px;
  display: flex;
  justify-content: center;
}

.dp-today-btn {
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  background: transparent;
  color: var(--text, #333);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 16px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;

  &:hover {
    border-color: var(--primary, #eeaf67);
    color: var(--primary, #eeaf67);
  }
}

// ── Transition ────────────────────────────────────────────────────────────────
.dp-fade-enter-active,
.dp-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  .dp-popup { transition: opacity 0.15s ease, transform 0.15s ease; }
}

.dp-fade-enter-from,
.dp-fade-leave-to {
  .dp-popup {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }
}
</style>
