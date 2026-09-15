<template>
  <span
    v-if="!inline"
    ref="anchor"
    class="hover-data-card-anchor"
    :class="{ 'hover-data-card-anchor--block': block }"
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

  <Teleport
    to="body"
    :disabled="inline"
  >
    <Transition name="hover-data-card">
      <div
        v-if="inline || isOpen"
        :id="cardId"
        ref="card"
        class="hover-data-card"
        :class="{ 'hover-data-card--inline': inline }"
        :role="inline ? 'region' : 'tooltip'"
        :aria-label="inline ? 'Monatsstunden' : undefined"
        :style="inline ? undefined : cardStyle"
        @pointerenter="onCardEnter"
        @pointerleave="onCardLeave"
      >
        <div
          v-if="view.eyebrow || view.employeeName"
          class="hover-data-card__header"
        >
          <span
            class="hover-data-card__indicator"
            aria-hidden="true"
          />
          <span
            v-if="view.employeeName"
            class="hover-data-card__employee-name"
          >
            {{ view.employeeName }}
          </span>
          <span
            v-if="view.eyebrow"
            class="hover-data-card__eyebrow"
          >
            {{ view.eyebrow }}
          </span>
        </div>

        <div v-if="loading" class="hover-data-card__loading" aria-live="polite">
          <span class="hover-data-card__loading-chart" aria-hidden="true" />
          <div class="hover-data-card__loading-details">
            <span class="hover-data-card__loading-line hover-data-card__loading-line--title" />
            <span class="hover-data-card__loading-line" />
            <span class="hover-data-card__loading-line" />
            <span class="hover-data-card__loading-line hover-data-card__loading-line--short" />
          </div>
          <span class="sr-only">Arbeitszeitdaten werden geladen</span>
        </div>
        <div v-else class="hover-data-card__body">
          <div class="hover-data-card__visual">
            <div
              class="hover-data-card__view-toggle"
              role="group"
              aria-label="Diagrammansicht"
            >
              <button
                type="button"
                :aria-pressed="chartView === 'ring'"
                title="Ringdiagramm"
                @click="chartView = 'ring'"
              >
                <font-awesome-icon icon="circle-notch" />
                <span class="sr-only">Ringdiagramm</span>
              </button>
              <button
                type="button"
                :aria-pressed="chartView === 'column'"
                title="Säulendiagramm"
                @click="chartView = 'column'"
              >
                <font-awesome-icon icon="chart-column" />
                <span class="sr-only">Säulendiagramm</span>
              </button>
            </div>
            <figure
              class="hover-data-card__chart"
              :class="`hover-data-card__chart--${chartView}`"
              :aria-label="chartDescription"
            >
              <template v-if="chartView === 'ring'">
            <svg
              class="hover-data-card__ring"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <g transform="rotate(-90 50 50)">
                <circle
                  class="hover-data-card__ring-track"
                  cx="50"
                  cy="50"
                  r="40"
                />
                <circle
                  v-for="slice in ring.slices"
                  :key="slice.id"
                  class="hover-data-card__ring-slice"
                  :class="{
                    'hover-data-card__ring-slice--faint': slice.role === 'remaining',
                    'hover-data-card__ring-slice--muted': activeSegment && activeSegment !== slice.id,
                  }"
                  cx="50"
                  cy="50"
                  r="40"
                  :style="sliceStyle(slice)"
                  @pointerenter="activeSegment = slice.id"
                  @pointerleave="activeSegment = null"
                >
                  <title>{{ slice.label }} · {{ metricLabel(slice.value) }}</title>
                </circle>
                <template v-if="ring.over">
                  <circle
                    class="hover-data-card__ring-over"
                    cx="50"
                    cy="50"
                    r="47.5"
                    :style="sliceStyle(ring.over)"
                  />
                  <line
                    class="hover-data-card__ring-limit hover-data-card__ring-limit--halo"
                    x1="83"
                    y1="50"
                    x2="99"
                    y2="50"
                    :transform="`rotate(${ring.over.angle} 50 50)`"
                  />
                  <line
                    class="hover-data-card__ring-limit"
                    x1="83"
                    y1="50"
                    x2="99"
                    y2="50"
                    :transform="`rotate(${ring.over.angle} 50 50)`"
                  />
                </template>
              </g>
            </svg>
            <figcaption class="hover-data-card__ring-center">
              <strong :class="{ 'hover-data-card__ring-value--over': ring.over }">{{ formatMetric(view.metric?.value) }}</strong>
              <span>von {{ metricLabel(view.metric?.limit) }}</span>
            </figcaption>
              </template>
              <template v-else>
                <figcaption class="hover-data-card__column-caption">
                  <strong :class="{ 'hover-data-card__ring-value--over': ring.over }">{{ formatMetric(view.metric?.value) }}</strong>
                  <span>von {{ metricLabel(view.metric?.limit) }}</span>
                </figcaption>
                <div class="hover-data-card__column-track" aria-hidden="true">
                  <div
                    v-for="segment in columnSegments"
                    :key="segment.id"
                    class="hover-data-card__column-segment"
                    :class="{
                      'hover-data-card__column-segment--faint': segment.role === 'remaining',
                      'hover-data-card__column-segment--muted': activeSegment && activeSegment !== segment.id,
                    }"
                    :style="columnStyle(segment)"
                    @pointerenter="activeSegment = segment.id"
                    @pointerleave="activeSegment = null"
                  />
                  <span v-if="ring.over" class="hover-data-card__column-limit" :style="columnLimitStyle" />
                </div>
              </template>
            </figure>
          </div>

          <div class="hover-data-card__details">
            <p
              v-if="view.title"
              class="hover-data-card__title"
            >
              {{ view.title }}
            </p>
            <dl
              v-if="view.metadata?.length"
              class="hover-data-card__metadata"
            >
              <div
                v-for="row in view.metadata"
                :key="row.label"
                class="hover-data-card__row"
              >
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>

            <section
              v-for="(section, index) in view.sections || []"
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
                  :class="{
                    'hover-data-card__row--emphasis': row.emphasis,
                    'hover-data-card__row--linked': segmentColor(row.segment),
                    'hover-data-card__row--active': row.segment && row.segment === activeSegment,
                  }"
                  @pointerenter="activeSegment = row.segment || null"
                  @pointerleave="activeSegment = null"
                >
                  <dt>
                    <span
                      v-if="segmentColor(row.segment)"
                      class="hover-data-card__swatch"
                      :class="{ 'hover-data-card__swatch--faint': segmentById(row.segment)?.role === 'remaining' }"
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
              v-if="!view.sections?.length"
              class="hover-data-card__empty"
            >
              Keine Daten vorhanden.
            </p>
            <p
              v-if="view.note"
              class="hover-data-card__note"
            >
              {{ view.note }}
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { buildHoverDataCard, formatEuro, formatHoverNumber } from '@/utils/hoverDataCard';

const props = defineProps({
  data: {
    type: Object,
    default: () => ({
      type: 'hours',
      eyebrow: 'September 2026',
      employeeName: 'Max Mustermann',
      title: 'Stundenbezogen beschäftigt',
      monthlyHours: 108.25,
      workedHours: 11.25,
      plannedHours: 94,
      hourlyRate: 16,
    }),
  },
  placement: { type: String, default: 'right', validator: value => ['top', 'right', 'bottom', 'left'].includes(value) },
  openDelay: { type: Number, default: 180 },
  closeDelay: { type: Number, default: 160 },
  disabled: { type: Boolean, default: false },
  inline: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  keepOpen: { type: Boolean, default: false },
  suppressed: { type: Boolean, default: false },
});

const emit = defineEmits(['open', 'close']);
const cardId = `hover-data-card-${getCurrentInstance().uid}`;
const anchor = ref(null);
const card = ref(null);
const isOpen = ref(false);
const positioned = ref(false);
const activeSegment = ref(null);
const chartView = ref('column');
const coordinates = ref({ top: 0, left: 0 });
const view = computed(() => buildHoverDataCard(props.data));
const segments = computed(() => (view.value.segments || []).filter(segment => Number.isFinite(segment.value) && segment.value > 0));
const chartDescription = computed(() => {
  const split = segments.value.map(segment => `${segment.label}: ${metricLabel(segment.value)}`).join(', ');
  return `${metricLabel(view.value.metric?.value)} von ${metricLabel(view.value.metric?.limit)}${split ? ` – ${split}` : ''}`;
});

// Ring geometry in viewBox units (r = 40). The ring always represents
// max(total, limit): below the limit the free capacity shows faint, above it
// the slices fill the whole ring and a marker plus outer arc flag the overage.
const RING_LENGTH = 2 * Math.PI * 40;
const RING_GAP = 1.6;
const RING_MIN_SLICE = 3.5;
const RING_STAGGER = 70;

function spreadLengths(lengths, min) {
  const small = lengths.filter(length => length < min);
  const pool = lengths.filter(length => length >= min).reduce((sum, length) => sum + length, 0);
  const deficit = small.reduce((sum, length) => sum + min - length, 0);
  if (!small.length || deficit >= pool) return lengths;
  return lengths.map(length => length < min ? min : length - deficit * (length / pool));
}

const ring = computed(() => {
  const total = Math.max(0, Number(view.value.metric?.value) || 0);
  const limit = Math.max(0, Number(view.value.metric?.limit) || 0);
  const drawn = segments.value.filter(segment => segment.role !== 'over');
  const scale = Math.max(total, limit, drawn.reduce((sum, segment) => sum + segment.value, 0)) || 1;
  const gap = drawn.length > 1 ? RING_GAP : 0;
  let cursor = 0;
  const slices = spreadLengths(drawn.map(segment => segment.value / scale * RING_LENGTH), RING_MIN_SLICE).map((length, index) => {
    const slice = { ...drawn[index], length: length - gap, offset: cursor + gap / 2, delay: index * RING_STAGGER };
    cursor += length;
    return slice;
  });
  const over = total > limit ? {
    offset: limit / scale * RING_LENGTH,
    length: (total - limit) / scale * RING_LENGTH,
    angle: limit / scale * 360,
    delay: slices.length * RING_STAGGER + 120,
  } : null;
  return { slices, over };
});

const columnSegments = computed(() => ring.value.slices);
const columnLimitStyle = computed(() => ({
  top: `${(ring.value.over?.angle || 0) / 3.6}%`,
}));

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

function segmentById(id) {
  return view.value.segments?.find(segment => segment.id === id);
}

function segmentColor(id) {
  return segmentById(id)?.color;
}

function sliceStyle(slice) {
  return {
    '--slice-length': slice.length,
    '--slice-offset': -slice.offset,
    '--slice-delay': `${slice.delay}ms`,
    ...(slice.color ? { stroke: slice.color } : {}),
  };
}

function columnStyle(segment) {
  return {
    flexGrow: Math.max(0, segment.length),
    background: segment.color,
  };
}

function formatMetric(value) {
  return view.value.metric?.currency ? formatEuro(value) : formatHoverNumber(value, view.value.type === 'days' ? 0 : 2);
}

function metricLabel(value) {
  return view.value.metric?.currency ? formatMetric(value) : `${formatMetric(value)} ${view.value.metric?.unit || 'Std.'}`;
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
  if (props.inline || props.disabled || props.suppressed || isOpen.value) return;
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
  activeSegment.value = null;
  if (isOpen.value) {
    isOpen.value = false;
    emit('close');
  }
}

function scheduleClose() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  if (!props.keepOpen && !overAnchor && !overCard && !hasFocus) closeTimer = setTimeout(close, props.closeDelay);
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
watch(() => props.inline, () => close());
watch(() => props.placement, () => { if (isOpen.value) nextTick(updatePosition); });
watch(() => props.keepOpen, keepOpen => { if (!keepOpen) scheduleClose(); });
onBeforeUnmount(close);
</script>

<style scoped>
.hover-data-card-anchor { display: inline-flex; vertical-align: middle; min-width: 0; }
.hover-data-card-anchor--block { display: block; width: 100%; }
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
  --hover-data-card-ring-size: 112px;
  --hover-data-card-column-height: 232px;
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
.hover-data-card--inline { position: relative; z-index: auto; width: 100%; max-width: none; max-height: none; overflow: visible; overscroll-behavior: auto; box-shadow: none; }
.hover-data-card__indicator { width: 6px; height: 6px; border-radius: 50%; background: var(--primary); }
.hover-data-card__employee-name { min-width: 0; overflow: hidden; font-size: 12px; font-weight: 600; letter-spacing: normal; text-overflow: ellipsis; text-transform: none; white-space: nowrap; }
.hover-data-card__eyebrow { flex: 0 1 auto; min-width: 0; overflow: hidden; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
.hover-data-card__employee-name + .hover-data-card__eyebrow::before { content: '·'; margin: 0 7px; color: var(--border); }
.hover-data-card__body { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; padding: 16px; }
.hover-data-card__loading { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; min-height: 182px; padding: 16px; }
.hover-data-card__loading-chart, .hover-data-card__loading-line { background: linear-gradient(90deg, var(--soft) 25%, var(--hover) 50%, var(--soft) 75%); background-size: 200% 100%; animation: hover-data-card-loading 1.1s ease-in-out infinite; }
.hover-data-card__loading-chart { width: var(--hover-data-card-ring-size); aspect-ratio: 1; border-radius: 50%; -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 12px), #000 calc(100% - 11px)); mask: radial-gradient(farthest-side, transparent calc(100% - 12px), #000 calc(100% - 11px)); }
.hover-data-card__loading-details { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
.hover-data-card__loading-line { display: block; width: 100%; height: 12px; border-radius: 3px; }
.hover-data-card__loading-line--title { width: 58%; height: 16px; margin-bottom: 8px; }
.hover-data-card__loading-line--short { width: 70%; }
@keyframes hover-data-card-loading { to { background-position: -200% 0; } }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.hover-data-card__visual { display: grid; width: var(--hover-data-card-ring-size); gap: 6px; align-self: start; }
.hover-data-card__view-toggle { display: flex; justify-content: center; gap: 1px; width: max-content; margin: 0 auto; padding: 2px; border: 1px solid var(--border); border-radius: 4px; background: var(--hover); }
.hover-data-card__view-toggle button { display: grid; place-items: center; width: 22px; height: 20px; padding: 0; border: 0; border-radius: 2px; background: transparent; color: var(--muted); font-size: 10px; cursor: pointer; }
.hover-data-card__view-toggle button[aria-pressed=true] { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); }
.hover-data-card__view-toggle button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.hover-data-card__chart { position: relative; width: var(--hover-data-card-ring-size); aspect-ratio: 1; margin: 0; align-self: start; }
.hover-data-card__chart--column { height: var(--hover-data-card-column-height); aspect-ratio: auto; }
.hover-data-card__ring { display: block; width: 100%; height: 100%; overflow: visible; }
.hover-data-card__ring-track { fill: none; stroke: color-mix(in srgb, var(--border) 55%, transparent); stroke-width: 11; }
.hover-data-card__ring-slice, .hover-data-card__ring-over {
  fill: none;
  stroke-dasharray: var(--slice-length) 260;
  stroke-dashoffset: var(--slice-offset);
  animation: hover-data-card-draw 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
  animation-delay: var(--slice-delay, 0ms);
  transition: stroke-dasharray 0.45s ease, stroke-dashoffset 0.45s ease, opacity 0.15s ease;
}
.hover-data-card__ring-slice { stroke-width: 11; cursor: default; }
.hover-data-card__ring-slice--faint { opacity: 0.32; }
.hover-data-card__ring-slice--muted { opacity: 0.14; }
.hover-data-card__ring-over { stroke: #dc665e; stroke-width: 3; pointer-events: none; }
.hover-data-card__ring-limit { stroke: var(--text); stroke-width: 1.4; stroke-linecap: round; pointer-events: none; animation: hover-data-card-fade 0.3s ease backwards; animation-delay: var(--slice-delay, 0ms); }
.hover-data-card__ring-limit--halo { stroke: var(--surface); stroke-width: 3.6; }
.hover-data-card__ring-center { position: absolute; inset: 0; display: grid; place-content: center; padding: 0 17%; text-align: center; pointer-events: none; }
.hover-data-card__ring-center strong { display: block; font-size: 15px; font-weight: 600; line-height: 1.15; font-variant-numeric: tabular-nums; }
.hover-data-card__ring-center span { display: block; margin-top: 2px; color: var(--muted); font-size: 10px; line-height: 1.25; }
.hover-data-card__ring-value--over { color: #dc665e; }
.hover-data-card__column-caption { position: absolute; z-index: 1; top: 0; left: 0; width: 100%; text-align: center; pointer-events: none; }
.hover-data-card__column-caption strong { display: block; font-size: 15px; font-weight: 600; line-height: 1.15; font-variant-numeric: tabular-nums; }
.hover-data-card__column-caption span { display: block; margin-top: 2px; color: var(--muted); font-size: 10px; line-height: 1.25; }
.hover-data-card__column-track { position: absolute; bottom: 0; left: 50%; display: flex; flex-direction: column; width: 32px; height: 72%; overflow: visible; transform: translateX(-50%); border-radius: 5px; background: var(--hover); outline: 1px solid color-mix(in srgb, var(--border) 45%, transparent); }
.hover-data-card__column-segment { flex-basis: 0; min-height: 0; transition: opacity 0.15s ease; }
.hover-data-card__column-segment:first-child { border-radius: 4px 4px 0 0; }
.hover-data-card__column-segment:last-of-type { border-radius: 0 0 4px 4px; }
.hover-data-card__column-segment--faint { opacity: 0.32; }
.hover-data-card__column-segment--muted { opacity: 0.14; }
.hover-data-card__column-limit { position: absolute; bottom: 0; left: -8px; z-index: 1; width: 48px; border-top: 2px solid #dc665e; background: linear-gradient(to right, #dc665e 0 8px, color-mix(in srgb, #dc665e 18%, transparent) 8px 40px, #dc665e 40px 48px); filter: drop-shadow(0 0 2px color-mix(in srgb, #dc665e 50%, transparent)); pointer-events: none; }
@keyframes hover-data-card-draw { from { stroke-dasharray: 0 260; } }
@keyframes hover-data-card-fade { from { opacity: 0; } }
.hover-data-card__details { min-width: 0; }
.hover-data-card__title { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
.hover-data-card__metadata { margin: 0; }
.hover-data-card__section { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.hover-data-card__section h3 { margin: 0 0 5px; color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.hover-data-card__section dl { margin: 0; }
.hover-data-card__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 8px; padding: 3px 0; border-radius: 3px; transition: background 0.15s ease, box-shadow 0.15s ease; }
.hover-data-card__row dt { color: var(--muted); overflow-wrap: anywhere; }
.hover-data-card__row dd { margin: 0; font-weight: 500; font-variant-numeric: tabular-nums; text-align: right; }
.hover-data-card__row--emphasis dt, .hover-data-card__row--emphasis dd { color: var(--text); font-weight: 600; }
.hover-data-card__row--linked { cursor: default; }
.hover-data-card__row--active { background: var(--hover); box-shadow: 0 0 0 5px var(--hover); }
.hover-data-card__row--active dt { color: var(--text); }
.hover-data-card__swatch { display: inline-block; width: 8px; height: 8px; margin-right: 5px; border-radius: 50%; vertical-align: 0; }
.hover-data-card__swatch--faint { opacity: 0.4; }
.hover-data-card__empty { color: var(--muted); margin-top: 12px; }
.hover-data-card__note { margin: 12px 0 0; color: var(--muted); font-size: 11px; line-height: 1.4; }
.hover-data-card-enter-active, .hover-data-card-leave-active { transition: opacity 0.12s ease; }
.hover-data-card-enter-from, .hover-data-card-leave-to { opacity: 0; }
@media (max-width: 400px) {
  .hover-data-card { --hover-data-card-ring-size: 88px; --hover-data-card-column-height: 190px; }
  .hover-data-card__body { gap: 10px; padding: 12px; }
  .hover-data-card__ring-center strong { font-size: 13px; }
  .hover-data-card__ring-center span { font-size: 9px; }
  .hover-data-card__row { font-size: 12px; gap: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .hover-data-card-enter-active, .hover-data-card-leave-active { transition: none; }
  .hover-data-card__ring-slice, .hover-data-card__ring-over, .hover-data-card__ring-limit { animation: none; transition: opacity 0.15s ease; }
}
</style>
