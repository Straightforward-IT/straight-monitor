<template>
  <span
    ref="anchor"
    class="hover-data-card-anchor"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @pointerdown="pointerType = $event.pointerType"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @click="onClick"
  >
    <slot
      :trigger-props="triggerProps"
      :open="isOpen"
    >
      <button
        type="button"
        class="hover-data-card-trigger"
        v-bind="triggerProps"
      >
        Monatsübersicht
      </button>
    </slot>
  </span>

  <Teleport to="body">
    <Transition name="hover-data-card">
      <div
        v-if="isOpen"
        :id="cardId"
        ref="card"
        class="hover-data-card"
        role="tooltip"
        :style="cardStyle"
        @pointerenter="onCardEnter"
        @pointerleave="onCardLeave"
      >
        <div
          v-if="data.eyebrow || data.employeeName"
          class="hover-data-card__header"
        >
          <span
            class="hover-data-card__indicator"
            aria-hidden="true"
          />
          <span
            v-if="data.employeeName"
            class="hover-data-card__employee-name"
          >
            {{ data.employeeName }}
          </span>
          <span
            v-if="data.eyebrow"
            class="hover-data-card__eyebrow"
          >
            {{ data.eyebrow }}
          </span>
        </div>

        <div class="hover-data-card__body">
          <figure
            class="hover-data-card__chart"
            :aria-label="chartDescription"
          >
            <figcaption>
              <strong>{{ numberFormat.format(total) }}</strong>
              <span>{{ data.unit || 'Std.' }}</span>
            </figcaption>
            <div
              class="hover-data-card__track"
              aria-hidden="true"
            >
              <div
                v-for="segment in segments"
                :key="segment.id"
                class="hover-data-card__segment"
                :style="{ flexGrow: segment.value, background: segment.color }"
              />
            </div>
          </figure>

          <div class="hover-data-card__details">
            <p
              v-if="data.title"
              class="hover-data-card__title"
            >
              {{ data.title }}
            </p>
            <dl
              v-if="data.metadata?.length"
              class="hover-data-card__metadata"
            >
              <div
                v-for="row in data.metadata"
                :key="row.label"
                class="hover-data-card__row"
              >
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>

            <section
              v-for="(section, index) in data.sections || []"
              :key="section.id || index"
              class="hover-data-card__section"
            >
              <h3 v-if="section.label">
                {{ section.label }}
              </h3>
              <dl>
                <div
                  v-for="row in section.rows"
                  :key="row.label"
                  class="hover-data-card__row"
                  :class="{ 'hover-data-card__row--emphasis': row.emphasis }"
                >
                  <dt>
                    <span
                      v-if="segmentColor(row.segment)"
                      class="hover-data-card__swatch"
                      :style="{ background: segmentColor(row.segment) }"
                      aria-hidden="true"
                    />
                    {{ row.label }}
                  </dt>
                  <dd>{{ row.value }}</dd>
                </div>
              </dl>
            </section>
            <p
              v-if="!data.sections?.length"
              class="hover-data-card__empty"
            >
              Keine Daten vorhanden.
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  data: {
    type: Object,
    default: () => ({
      eyebrow: 'September 2026',
      employeeName: 'Max Mustermann',
      title: 'Teilzeit beschäftigt',
      unit: 'Std.',
      metadata: [{ label: 'Stundenlohn', value: '16,00 €' }],
      segments: [
        { id: 'worked', label: 'Eingesetzt', value: 11.25, color: '#94a3b8' },
        { id: 'planned', label: 'Geplant', value: 94, color: 'var(--primary)' },
        { id: 'free', label: 'Frei', value: 3, color: '#62b58f' },
      ],
      sections: [
        { label: 'Arbeitszeiten', rows: [
          { label: 'Monatsstunden', value: '108,25 Std.' },
          { label: 'Eingesetzt', value: '11,25 Std.', segment: 'worked' },
          { label: 'Geplant', value: '94,00 Std.', segment: 'planned' },
        ] },
        { rows: [
          { label: 'Belegt', value: '105,25 Std.', emphasis: true },
          { label: 'Frei', value: '3,00 Std.', segment: 'free' },
        ] },
      ],
    }),
  },
  placement: { type: String, default: 'right', validator: value => ['top', 'right', 'bottom', 'left'].includes(value) },
  openDelay: { type: Number, default: 180 },
  closeDelay: { type: Number, default: 160 },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['open', 'close']);
const cardId = `hover-data-card-${getCurrentInstance().uid}`;
const anchor = ref(null);
const card = ref(null);
const isOpen = ref(false);
const positioned = ref(false);
const coordinates = ref({ top: 0, left: 0 });
const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const segments = computed(() => (props.data.segments || []).filter(segment => Number.isFinite(segment.value) && segment.value > 0));
const total = computed(() => segments.value.reduce((sum, segment) => sum + segment.value, 0));
const chartDescription = computed(() => segments.value.map(segment => `${segment.label}: ${numberFormat.format(segment.value)} ${props.data.unit || 'Std.'}`).join(', ') || 'Keine Werte');
const triggerProps = computed(() => ({ 'aria-describedby': isOpen.value ? cardId : undefined }));
const cardStyle = computed(() => ({
  top: `${coordinates.value.top}px`,
  left: `${coordinates.value.left}px`,
  visibility: positioned.value ? 'visible' : 'hidden',
}));

let openTimer;
let closeTimer;
let resizeObserver;
let pointerType = '';
let overAnchor = false;
let overCard = false;
let hasFocus = false;

function segmentColor(id) {
  return props.data.segments?.find(segment => segment.id === id)?.color;
}

function updatePosition() {
  if (!anchor.value || !card.value) return;
  const target = anchor.value.getBoundingClientRect();
  const { width, height } = card.value.getBoundingClientRect();
  const inset = 12;
  const gap = 10;
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight;
  if (target.bottom <= 0 || target.top >= viewportHeight || target.right <= 0 || target.left >= viewportWidth) {
    close();
    return;
  }
  const positions = {
    right: { left: target.right + gap, top: target.top + (target.height - height) / 2 },
    left: { left: target.left - width - gap, top: target.top + (target.height - height) / 2 },
    bottom: { left: target.left + (target.width - width) / 2, top: target.bottom + gap },
    top: { left: target.left + (target.width - width) / 2, top: target.top - height - gap },
  };
  const opposite = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' };
  const order = [...new Set([props.placement, opposite[props.placement], 'bottom', 'top', 'right', 'left'])];
  // Shift along the cross axis before judging a side, so a narrow screen can
  // still use the space below its trigger without covering the trigger itself.
  for (const side of order) {
    if (side === 'top' || side === 'bottom') {
      positions[side].left = Math.max(inset, Math.min(positions[side].left, viewportWidth - width - inset));
    } else {
      positions[side].top = Math.max(inset, Math.min(positions[side].top, viewportHeight - height - inset));
    }
  }
  const fits = position => position.left >= inset && position.top >= inset
    && position.left + width <= viewportWidth - inset && position.top + height <= viewportHeight - inset;
  const candidate = order.map(side => positions[side]).find(fits) || positions[props.placement];
  coordinates.value = {
    left: Math.max(inset, Math.min(candidate.left, viewportWidth - width - inset)),
    top: Math.max(inset, Math.min(candidate.top, viewportHeight - height - inset)),
  };
  positioned.value = true;
}

async function open() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  if (props.disabled || isOpen.value) return;
  positioned.value = false;
  isOpen.value = true;
  await nextTick();
  if (!isOpen.value) return;
  updatePosition();
  if (!isOpen.value) return;
  resizeObserver = new ResizeObserver(updatePosition);
  resizeObserver.observe(card.value);
  resizeObserver.observe(anchor.value);
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, true);
  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('pointerdown', onOutsidePointerDown, true);
  emit('open');
}

function close() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  resizeObserver?.disconnect();
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
  document.removeEventListener('keydown', onKeydown, true);
  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  overCard = false;
  if (isOpen.value) {
    isOpen.value = false;
    emit('close');
  }
}

function scheduleClose() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  if (!overAnchor && !overCard && !hasFocus) closeTimer = setTimeout(close, props.closeDelay);
}

function onPointerEnter(event) {
  if (event.pointerType === 'touch') return;
  overAnchor = true;
  clearTimeout(closeTimer);
  clearTimeout(openTimer);
  openTimer = setTimeout(open, props.openDelay);
}

function onPointerLeave() {
  overAnchor = false;
  scheduleClose();
}

function onCardEnter(event) {
  if (event.pointerType === 'touch') return;
  overCard = true;
  clearTimeout(closeTimer);
}

function onCardLeave() {
  overCard = false;
  scheduleClose();
}

function onFocusIn() {
  hasFocus = true;
  if (pointerType !== 'touch') open();
}

function onFocusOut(event) {
  if (anchor.value?.contains(event.relatedTarget)) return;
  hasFocus = false;
  pointerType = '';
  scheduleClose();
}

function onClick(event) {
  // Touch has no hover; keyboard activation also lets a dismissed card reopen.
  if (pointerType === 'touch') {
    if (isOpen.value) close();
    else open();
  } else if (event.detail === 0) open();
}

function onKeydown(event) {
  if (event.key !== 'Escape') return;
  event.stopPropagation();
  close();
}

function onOutsidePointerDown(event) {
  if (!anchor.value?.contains(event.target) && !card.value?.contains(event.target)) close();
}

watch(() => props.disabled, disabled => { if (disabled) close(); });
watch(() => props.placement, () => { if (isOpen.value) nextTick(updatePosition); });
onBeforeUnmount(close);
</script>

<style scoped>
.hover-data-card-anchor { display: inline-flex; vertical-align: middle; min-width: 0; }
.hover-data-card-trigger {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
}
.hover-data-card-trigger:hover { border-color: var(--primary); }
.hover-data-card-trigger:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
.hover-data-card {
  position: fixed;
  z-index: calc(var(--z-modal-elevated, 1500) + 100);
  box-sizing: border-box;
  width: 380px;
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 24px);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  font-size: 13px;
  line-height: 1.5;
}
.hover-data-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--primary) 7%, var(--surface));
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.hover-data-card__indicator { width: 6px; height: 6px; border-radius: 50%; background: var(--primary); }
.hover-data-card__employee-name { min-width: 0; overflow: hidden; font-size: 12px; font-weight: 600; letter-spacing: normal; text-overflow: ellipsis; text-transform: none; white-space: nowrap; }
.hover-data-card__eyebrow { flex: 0 1 auto; min-width: 0; overflow: hidden; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
.hover-data-card__employee-name + .hover-data-card__eyebrow::before { content: '·'; margin: 0 7px; color: var(--border); }
.hover-data-card__body { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 20px; padding: 16px; }
.hover-data-card__chart { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 0; }
.hover-data-card__chart figcaption { text-align: center; }
.hover-data-card__chart strong { display: block; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.hover-data-card__chart figcaption span { display: block; color: var(--muted); font-size: 11px; }
.hover-data-card__track {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 32px;
  min-height: 150px;
  overflow: hidden;
  border-radius: 5px;
  background: var(--hover);
  outline: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
}
.hover-data-card__segment { flex-basis: 0; min-height: 0; }
.hover-data-card__details { min-width: 0; }
.hover-data-card__title { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
.hover-data-card__metadata { margin: 0; }
.hover-data-card__section { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.hover-data-card__section h3 { margin: 0 0 5px; color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.hover-data-card__section dl { margin: 0; }
.hover-data-card__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 8px; padding: 3px 0; }
.hover-data-card__row dt { color: var(--muted); overflow-wrap: anywhere; }
.hover-data-card__row dd { margin: 0; font-weight: 500; font-variant-numeric: tabular-nums; text-align: right; }
.hover-data-card__row--emphasis dt, .hover-data-card__row--emphasis dd { color: var(--text); font-weight: 600; }
.hover-data-card__swatch { display: inline-block; width: 7px; height: 7px; margin-right: 4px; border-radius: 2px; }
.hover-data-card__empty { color: var(--muted); margin-top: 12px; }
.hover-data-card-enter-active, .hover-data-card-leave-active { transition: opacity 0.12s ease; }
.hover-data-card-enter-from, .hover-data-card-leave-to { opacity: 0; }
@media (max-width: 400px) {
  .hover-data-card__body { grid-template-columns: 48px minmax(0, 1fr); gap: 12px; padding: 12px; }
  .hover-data-card__row { font-size: 12px; gap: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .hover-data-card-enter-active, .hover-data-card-leave-active { transition: none; }
}
</style>
