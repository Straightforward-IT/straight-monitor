<template>
  <teleport to="body">
    <transition name="ann-fade">
      <div v-if="current" class="ann-overlay">
        <div class="ann-modal" role="dialog" :aria-labelledby="`ann-title-${current.id}`">
          <h2 :id="`ann-title-${current.id}`" class="ann-title">{{ current.title }}</h2>
          <p class="ann-text" v-html="current.text" />
          <div class="ann-footer">
            <span v-if="queue.length > 1" class="ann-step">{{ currentIndex + 1 }} / {{ queue.length }}</span>
            <button class="ann-dismiss-btn" @click="dismiss">Verstanden</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  /**
   * Array of announcement objects:
   * { id: string, title: string, text: string }
   * `text` may contain simple HTML (bold, links).
   */
  announcements: {
    type: Array,
    required: true,
  },
  storageKey: {
    type: String,
    default: 'sm_dismissed_announcements',
  },
});

const STORAGE_KEY = props.storageKey;

function getDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* storage unavailable */ }
}

const dismissed = ref(getDismissed());

// Only show announcements the user hasn't dismissed yet
const queue = computed(() =>
  props.announcements.filter(a => !dismissed.value.has(a.id))
);

const currentIndex = ref(0);
const current = computed(() => queue.value[currentIndex.value] ?? null);

onMounted(() => { currentIndex.value = 0; });

function dismiss() {
  if (!current.value) return;
  const next = new Set(dismissed.value);
  next.add(current.value.id);
  dismissed.value = next;
  saveDismissed(next);
  currentIndex.value = 0;
}
</script>

<style scoped lang="scss">
.ann-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(3px);
}

.ann-modal {
  background: var(--modal-bg, #fff);
  border-radius: 14px;
  width: 420px;
  max-width: 95vw;
  padding: 28px 28px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
}

.ann-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
}

.ann-text {
  margin: 0;
  font-size: 13.5px;
  color: var(--muted);
  line-height: 1.6;

  :deep(strong) { font-weight: 600; color: var(--text); }
}

.ann-step {
  font-size: 11px;
  color: var(--muted);
}

.ann-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.ann-dismiss-btn {
  padding: 9px 24px;
  background: linear-gradient(90deg, #3b82f6, var(--primary));
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;

  &:hover { opacity: 0.88; }
  &:active { transform: scale(0.97); }
}

.ann-fade-enter-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.ann-fade-leave-active {
  transition: opacity 0.15s ease;
}
.ann-fade-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}
.ann-fade-leave-to {
  opacity: 0;
}
</style>
