<template>
  <svg
    viewBox="0 0 92 88"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="clipId"><path d="M15 30H77L69 76Q46 84 23 76Z" /></clipPath>
    </defs>
    <path
      d="M22 33V24a24 24 0 0 1 48 0v9"
      stroke="currentColor"
      stroke-width="3.5"
    />
    <path
      d="M15 30H77L69 76Q46 84 23 76Z"
      fill="var(--surface, #fff)"
    />
    <g :clip-path="`url(#${clipId})`">
      <rect
        x="14"
        :y="waterY"
        width="64"
        height="55"
        fill="var(--primary, #eeaf67)"
        opacity=".7"
      />
      <path
        :d="`M14 ${waterY} Q30 ${waterY - 5} 46 ${waterY} T80 ${waterY}`"
        stroke="var(--primary, #eeaf67)"
        stroke-width="3"
      />
    </g>
    <path
      d="M15 30H77L69 76Q46 84 23 76Z"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linejoin="round"
    />
    <path
      d="M13 30H79"
      stroke="currentColor"
      stroke-width="4"
      stroke-linecap="round"
    />
    <text
      x="46"
      y="58"
      text-anchor="middle"
      fill="var(--text, #222)"
      font-size="14"
      font-weight="700"
    >{{ amount }}</text>
    <text
      x="46"
      y="71"
      text-anchor="middle"
      fill="var(--text, #222)"
      font-size="8"
      letter-spacing="1"
    >STUNDEN</text>
  </svg>
</template>

<script setup>
import { computed, getCurrentInstance } from 'vue';
const props = defineProps({ minutes: { type: Number, default: 0 } });
const clipId = `hour-bucket-${getCurrentInstance().uid}`;
const waterY = computed(() => props.minutes ? 66 - Math.min(1, props.minutes / 480) * 30 : 81);
const amount = computed(() => `${Math.floor(props.minutes / 60)}:${String(props.minutes % 60).padStart(2, '0')}`);
</script>
