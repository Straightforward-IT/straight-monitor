<template>
  <div class="range-slider">
    <div class="slider-track-bg"></div>
    <div 
      class="slider-track-fill"
      :style="{ left: leftPercent + '%', width: widthPercent + '%' }"
    ></div>
    
    <input 
      type="range" 
      :min="min" 
      :max="max" 
      step="1"
      v-model.number="localMin" 
      @input="onInputMin" 
      class="thumb thumb-left"
    />
    <input 
      type="range" 
      :min="min" 
      :max="max" 
      step="1"
      v-model.number="localMax" 
      @input="onInputMax" 
      class="thumb thumb-right"
    />

    <!-- Labels below -->
    <div class="slider-labels">
      <span class="label-min">{{ formatLabel(localMin) }}</span>
      <span class="label-max">{{ formatLabel(localMax) }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  modelValue: { type: Array, required: true }, // [start, end]
  formatLabel: { type: Function, default: (v) => v }
});

const emit = defineEmits(['update:modelValue', 'change']);

const localMin = ref(props.modelValue[0]);
const localMax = ref(props.modelValue[1]);

watch(() => props.modelValue, (newVal) => {
  localMin.value = newVal[0];
  localMax.value = newVal[1];
});

function onInputMin() {
  if (localMin.value > localMax.value) {
    localMin.value = localMax.value;
  }
  emitUpdate();
}

function onInputMax() {
  if (localMax.value < localMin.value) {
    localMax.value = localMin.value;
  }
  emitUpdate();
}

function emitUpdate() {
  emit('update:modelValue', [localMin.value, localMax.value]);
  emit('change', [localMin.value, localMax.value]);
}

const leftPercent = computed(() => {
  return ((localMin.value - props.min) / (props.max - props.min)) * 100;
});

const widthPercent = computed(() => {
  return ((localMax.value - localMin.value) / (props.max - props.min)) * 100;
});
</script>

<style scoped>
.range-slider {
  position: relative;
  width: 100%;
  height: 40px; /* Space for labels */
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Track Background */
.slider-track-bg {
  position: absolute;
  top: 10px;
  left: 0;
  width: 100%;
  height: 6px;
  background-color: var(--border);
  border-radius: 3px;
  z-index: 1;
}

/* Track Fill */
.slider-track-fill {
  position: absolute;
  top: 10px;
  height: 6px;
  background-color: var(--primary);
  border-radius: 3px;
  z-index: 2;
}

/* Thumbs */
input[type=range] {
  position: absolute;
  top: 10px; /* Aligned with track top */
  left: 0;
  width: 100%;
  height: 6px; /* Match track height to align nicely */
  -webkit-appearance: none;
  background: none; /* Transparent background */
  pointer-events: none; /* Let clicks pass through to validation/layers */
  z-index: 3;
  margin: 0;
}

/* Webkit Thumb */
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--primary);
  cursor: pointer;
  pointer-events: auto; /* Re-enable pointer events for the thumb */
  margin-top: -7px; /* Center vertically on track (6px height): (6 - 20)/2 = -7 */
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* Firefox Thumb */
input[type=range]::-moz-range-thumb {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--primary);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* Labels */
.slider-labels {
  position: absolute;
  bottom: 0px;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  pointer-events: none;
}
</style>
