<template>
  <teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click="$emit('update:modelValue', false)">
      <div class="help-modal" @click.stop>
        <div class="help-modal-header">
          <h3><slot name="title">Hilfe</slot></h3>
          <button class="close-btn" @click="$emit('update:modelValue', false)">
            <font-awesome-icon icon="fa-solid fa-times" />
          </button>
        </div>
        <div v-if="$slots.toc" ref="tocRef" class="help-modal-toc">
          <slot name="toc" />
        </div>
        <div ref="bodyRef" class="help-modal-body">
          <slot />
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue';

const props = defineProps({ modelValue: { type: Boolean, required: true } });
defineEmits(['update:modelValue']);

const tocRef = ref(null);
const bodyRef = ref(null);
const activeSection = ref(null);
let observer = null;
let scrollListener = null;

function scrollTocToButton(id) {
  if (!tocRef.value) return;
  const btn = tocRef.value.querySelector(`[data-section="${id}"]`);
  if (!btn) return;
  const cRect = tocRef.value.getBoundingClientRect();
  const bRect = btn.getBoundingClientRect();
  const relLeft = bRect.left - cRect.left + tocRef.value.scrollLeft;
  tocRef.value.scrollTo({ left: relLeft - cRect.width / 2 + bRect.width / 2, behavior: 'smooth' });
}

function setActive(id) {
  if (activeSection.value === id) return;
  if (activeSection.value && tocRef.value)
    tocRef.value.querySelector(`[data-section="${activeSection.value}"]`)?.classList.remove('toc-active');
  activeSection.value = id;
  if (id && tocRef.value) {
    tocRef.value.querySelector(`[data-section="${id}"]`)?.classList.add('toc-active');
    scrollTocToButton(id);
  }
}

function setupObserver() {
  // Tear down previous
  if (observer) { observer.disconnect(); observer = null; }
  if (scrollListener) { bodyRef.value?.removeEventListener('scroll', scrollListener); scrollListener = null; }
  if (!bodyRef.value) return;
  const sections = [...bodyRef.value.querySelectorAll('[id]')];
  if (!sections.length) return;
  const lastId = sections[sections.length - 1].id;

  // Scroll-end guard: short trailing sections can never reach the threshold,
  // so force the last one active whenever we're at the very bottom.
  scrollListener = () => {
    const b = bodyRef.value;
    if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 5) setActive(lastId);
  };
  bodyRef.value.addEventListener('scroll', scrollListener, { passive: true });

  observer = new IntersectionObserver(
    (entries) => {
      // Skip if already handled by the scroll-end guard
      const b = bodyRef.value;
      if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 5) return;
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.target.compareDocumentPosition(b.target) & 4 ? -1 : 1);
      if (visible.length) setActive(visible[0].target.id);
    },
    { root: bodyRef.value, rootMargin: '0px 0px -70% 0px', threshold: 0 }
  );
  sections.forEach(s => observer.observe(s));
}

function teardown() {
  if (observer) { observer.disconnect(); observer = null; }
  if (scrollListener && bodyRef.value) { bodyRef.value.removeEventListener('scroll', scrollListener); scrollListener = null; }
  activeSection.value = null;
}

watch(() => props.modelValue, (val) => {
  if (val) nextTick(setupObserver);
  else teardown();
});

onUnmounted(teardown);
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.close-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;

  &:hover { color: var(--text); }
}

.help-modal {
  background: var(--modal-bg);
  border-radius: 12px;
  width: 520px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.help-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.help-modal-toc {
  border-bottom: 1px solid var(--border);
  padding: 8px 16px;
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  :deep(.help-toc) {
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
    width: max-content;

    .help-toc-label {
      font-size: 0.75rem;
      color: var(--muted);
      margin-right: 4px;
      flex-shrink: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    button {
      background: none;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 3px 11px;
      font-size: 0.78rem;
      color: var(--text);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
      font-family: inherit;
      white-space: nowrap;
      flex-shrink: 0;

      &:hover {
        border-color: var(--primary);
        color: var(--primary);
      }

      &.toc-active {
        border-color: var(--primary);
        color: var(--primary);
        background: rgba(253, 126, 20, 0.12);
      }
    }
  }
}

.help-modal-body {
  padding: 20px;
  overflow-y: auto;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  gap: 18px;

  :deep(.help-section) {
    h4 {
      margin: 0 0 6px;
      font-size: 0.95rem;
      color: var(--text);
    }

    p {
      margin: 0 0 4px;
      font-size: 0.88rem;
      color: var(--muted);
      line-height: 1.5;
    }

    kbd {
      display: inline-block;
      padding: 1px 6px;
      font-size: 0.8rem;
      font-family: inherit;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text);
    }

    .help-shortcuts {
      border-collapse: collapse;
      width: 100%;
      font-size: 0.88rem;

      td {
        padding: 4px 8px 4px 0;
        color: var(--muted);
        vertical-align: middle;

        &:first-child {
          width: 1%;
          white-space: nowrap;
          padding-right: 16px;
        }
      }
    }
  }

  :deep(.help-legend) {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 6px;
  }

  :deep(.help-legend-item) {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: var(--muted);
  }

  :deep(.legend-dot) {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  :deep(.legend-available)  { background: #10b98140; border: 1px solid #10b981; }
  :deep(.legend-partially)  { background: #f59e0b40; border: 1px solid #f59e0b; }
  :deep(.legend-blocked)    { background: #ef444440; border: 1px solid #ef4444; }
  :deep(.legend-planned)    { background: #6366f140; border: 1px solid #6366f1; }
  :deep(.legend-angefragt)  { background: #a855f740; border: 1px solid #a855f7; }
}
</style>
