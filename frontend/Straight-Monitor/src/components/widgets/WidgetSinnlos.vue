<template>
  <DashboardWidget title="Sinnloser Knopf" :icon="['fas', 'circle-exclamation']">
    <div class="ws-body">
      <button
        class="ws-btn"
        :class="{ 'ws-btn--pressed': pressed }"
        @mousedown="onPress"
        @mouseup="onRelease"
        @mouseleave="onRelease"
        @touchstart.prevent="onPress"
        @touchend.prevent="onRelease"
      >
        <span class="ws-btn-label">DRÜCKEN</span>
      </button>
    </div>
  </DashboardWidget>
</template>

<script setup>
import { ref } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import DashboardWidget from "./DashboardWidget.vue";

const pressed = ref(false);

const onPress   = () => { pressed.value = true; };
const onRelease = () => { pressed.value = false; };
</script>

<style scoped lang="scss">
:deep(.dash-widget__icon) {
  color: var(--muted);
}

.ws-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  height: 100%;
}

.ws-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  padding: 5px 12px;
}

.ws-warn-icon {
  font-size: 12px;
}

.ws-btn {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: radial-gradient(circle at 35% 35%, #ff6b6b, #cc0000);
  box-shadow:
    0 8px 0 #8b0000,
    0 10px 16px rgba(0, 0, 0, 0.4);
  transition: transform 0.06s ease, box-shadow 0.06s ease;
  position: relative;
  outline: none;

  &::before {
    content: '';
    position: absolute;
    top: 12%;
    left: 18%;
    width: 40%;
    height: 22%;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    transform: rotate(-20deg);
    pointer-events: none;
  }

  &--pressed {
    transform: translateY(6px);
    box-shadow:
      0 2px 0 #8b0000,
      0 4px 8px rgba(0, 0, 0, 0.4);
  }
}

.ws-btn-label {
  font-size: 13px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.08em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  user-select: none;
}
</style>
