<template>
  <Teleport to="body">
    <transition name="cfg-fade">
      <div v-if="visible" class="cfg-overlay" @click.self="$emit('close')">
        <transition name="cfg-slide" appear>
          <div class="cfg">
            <header class="cfg__header">
              <h2>
                <font-awesome-icon :icon="['fas', 'sliders']" />
                Dashboard anpassen
              </h2>
              <button
                class="cfg__close"
                @click="$emit('close')"
                aria-label="Schließen"
              >
                <font-awesome-icon :icon="['fas', 'times']" />
              </button>
            </header>

            <p class="cfg__hint">
              Wähle aus, welche Widgets angezeigt werden sollen, und ziehe sie
              per Drag &amp; Drop in die gewünschte Reihenfolge.
            </p>

            <ul class="cfg__list">
              <li
                v-for="(w, idx) in prefs.widgetOrder"
                :key="w.id"
                class="cfg__item"
                :class="{ 'cfg__item--off': !w.visible, 'cfg__item--drag-over': dragOverIdx === idx }"
                draggable="true"
                @dragstart="onDragStart(idx, $event)"
                @dragover.prevent="onDragOver(idx)"
                @dragleave="onDragLeave"
                @drop.prevent="onDrop(idx)"
                @dragend="onDragEnd"
              >
                <font-awesome-icon
                  :icon="['fas', 'grip-vertical']"
                  class="cfg__grip"
                />

                <div class="cfg__item-info">
                  <font-awesome-icon
                    :icon="getDef(w.id)?.icon || ['fas', 'cube']"
                    class="cfg__item-icon"
                  />
                  <div>
                    <strong>{{ getDef(w.id)?.title || w.id }}</strong>
                    <small>{{ getDef(w.id)?.description }}</small>
                  </div>
                </div>

                <div class="cfg__item-actions">
                  <label class="cfg__toggle">
                    <input
                      type="checkbox"
                      :checked="w.visible"
                      @change="prefs.setVisible(w.id, $event.target.checked)"
                    />
                    <span class="cfg__toggle-track" />
                  </label>
                </div>
              </li>
            </ul>

            <footer class="cfg__footer">
              <button class="cfg__reset" @click="prefs.resetToDefaults()">
                <font-awesome-icon :icon="['fas', 'rotate-left']" />
                Zurücksetzen
              </button>
              <button class="cfg__done" @click="$emit('close')">Fertig</button>
            </footer>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useDashboardPrefs } from "@/stores/dashboardPrefs";
import { WIDGET_DEFINITIONS } from "./widgetRegistry";

defineProps({ visible: { type: Boolean, default: true } });
defineEmits(["close"]);

const prefs = useDashboardPrefs();
const getDef = (id) => WIDGET_DEFINITIONS.find((d) => d.id === id);

// ── Drag & Drop ──────────────────────────────────────────────────────────
const dragSrcIdx = ref(null);
const dragOverIdx = ref(null);

function onDragStart(idx, event) {
  dragSrcIdx.value = idx;
  event.dataTransfer.effectAllowed = 'move';
}

function onDragOver(idx) {
  if (dragSrcIdx.value === null || dragSrcIdx.value === idx) return;
  dragOverIdx.value = idx;
}

function onDragLeave() {
  dragOverIdx.value = null;
}

function onDrop(toIdx) {
  if (dragSrcIdx.value !== null && dragSrcIdx.value !== toIdx) {
    prefs.reorderWidget(dragSrcIdx.value, toIdx);
  }
  dragSrcIdx.value = null;
  dragOverIdx.value = null;
}

function onDragEnd() {
  dragSrcIdx.value = null;
  dragOverIdx.value = null;
}
</script>

<style scoped lang="scss">
/* ── Overlay ─────────────────────────────────────── */
.cfg-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

/* ── Card ────────────────────────────────────────── */
.cfg {
  background: var(--tile-bg);
  color: var(--text);
  border-radius: 14px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
  width: min(480px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────── */
.cfg__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 12px;

  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }
}

.cfg__close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hover);
    color: var(--text);
  }
}

/* ── Hint ────────────────────────────────────────── */
.cfg__hint {
  padding: 0 24px 12px;
  font-size: 13px;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
}

/* ── List ────────────────────────────────────────── */
.cfg__list {
  list-style: none;
  padding: 0 24px;
  margin: 0;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cfg__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--hover);
  transition: opacity 0.2s ease, background 0.15s ease, box-shadow 0.15s ease;
  cursor: grab;

  &:active { cursor: grabbing; }

  &--off {
    opacity: 0.45;
  }

  &--drag-over {
    background: color-mix(in srgb, var(--hover) 40%, var(--primary));
    box-shadow: 0 0 0 2px var(--primary);
  }

  &:hover:not(.cfg__item--drag-over) {
    background: color-mix(in srgb, var(--hover) 80%, var(--primary));
  }
}

.cfg__item-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;

  strong {
    display: block;
    font-size: 14px;
    font-weight: 600;
  }

  small {
    display: block;
    font-size: 12px;
    color: var(--muted);
    margin-top: 1px;
  }
}

.cfg__item-icon {
  font-size: 16px;
  color: var(--primary);
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

/* ── Grip handle ─────────────────────────────────── */
.cfg__grip {
  color: var(--muted);
  font-size: 13px;
  opacity: 0.4;
  flex-shrink: 0;
  transition: opacity 0.15s ease;

  .cfg__item:hover & {
    opacity: 0.8;
  }
}

/* ── Actions (toggle) ────────────────────────────── */
.cfg__item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.cfg__arrow {
  background: none;
  border: 1px solid var(--border);
  color: var(--muted);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
  }

  &:disabled {
    opacity: 0.25;
    cursor: default;
  }
}

/* ── Toggle switch ───────────────────────────────── */
.cfg__toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  margin-left: 6px;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }
}

.cfg__toggle-track {
  position: absolute;
  inset: 0;
  background: var(--border);
  border-radius: 11px;
  transition: background 0.2s ease;

  &::after {
    content: "";
    position: absolute;
    width: 16px;
    height: 16px;
    left: 3px;
    bottom: 3px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s ease;
  }
}

.cfg__toggle input:checked + .cfg__toggle-track {
  background: var(--primary);

  &::after {
    transform: translateX(18px);
  }
}

/* ── Footer ──────────────────────────────────────── */
.cfg__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

.cfg__reset {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.15s ease;

  &:hover {
    color: var(--text);
    background: var(--hover);
  }
}

.cfg__done {
  padding: 8px 24px;
  border-radius: 8px;
  border: none;
  background: var(--primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }
}

/* ── Transitions ─────────────────────────────────── */
.cfg-fade-enter-active,
.cfg-fade-leave-active {
  transition: opacity 0.2s ease;
}
.cfg-fade-enter-from,
.cfg-fade-leave-to {
  opacity: 0;
}

.cfg-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.cfg-slide-leave-active {
  transition: all 0.2s ease;
}
.cfg-slide-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.96);
}
.cfg-slide-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* ── Mobile ──────────────────────────────────────── */
@media (max-width: 520px) {
  .cfg {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 32px);
    border-radius: 12px;
  }

  .cfg__header {
    padding: 16px 16px 10px;
  }

  .cfg__hint {
    padding: 0 16px 10px;
  }

  .cfg__list {
    padding: 0 16px;
  }

  .cfg__item {
    padding: 10px 10px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .cfg__footer {
    padding: 12px 16px;
  }
}
</style>
