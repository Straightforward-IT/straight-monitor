# HoverDataCard

Reusable read-only hover card: a proportional, segmented column on the left and grouped text data on the right. It uses the shared theme variables, including light and dark surfaces. No API, store, or employee logic is connected.

The component includes September 2026 dummy data and a default button:

```vue
<script setup>
import HoverDataCard from '@/components/ui-elements/HoverDataCard.vue';
</script>

<template>
  <HoverDataCard />
</template>
```

Use the default scoped slot to attach it to a specific element. Bind `triggerProps` to one focusable trigger so assistive technology can associate it with the tooltip. A button or link is preferred; add `tabindex="0"` when using a non-interactive element. Keep actions outside the read-only card.

```vue
<HoverDataCard :data="overview" placement="right">
  <template #default="{ triggerProps }">
    <button type="button" v-bind="triggerProps">Monatsübersicht</button>
  </template>
</HoverDataCard>
```

`data` replaces the entire dummy object and accepts this shape:

```js
const overview = {
  eyebrow: 'September 2026',
  employeeName: 'Max Mustermann',
  title: 'Teilzeit beschäftigt',
  unit: 'Std.',
  metadata: [{ label: 'Stundenlohn', value: '16,00 €' }],
  segments: [
    { id: 'planned', label: 'Geplant', value: 94, color: 'var(--primary)' },
    { id: 'free', label: 'Frei', value: 14.25, color: '#62b58f' },
  ],
  sections: [
    { label: 'Arbeitszeiten', rows: [
      { label: 'Monatsstunden', value: '108,25 Std.', emphasis: true },
      { label: 'Geplant', value: '94,00 Std.', segment: 'planned' },
      { label: 'Frei', value: '14,25 Std.', segment: 'free' },
    ] },
  ],
};
```

- Segments stack from top to bottom in array order. Use unique IDs and positive finite numeric values in the same unit. The column represents their sum; zero, negative, and non-finite values are omitted.
- Row values are preformatted text. `segment` links a row's color marker to a segment ID. Keep values and segment totals consistent when supplying real data later.
- `placement`: `right` (default), `left`, `top`, or `bottom`. The card chooses an alternate side or stays within the viewport when space is limited, and follows scrolling/resizing.
- `openDelay`: 180 ms on hover. Keyboard focus opens immediately. `closeDelay`: 160 ms so the pointer can cross into the card. It remains visible while hovered or while its trigger has focus.
- Escape, an outside pointer press, or scrolling the trigger out of view dismisses the card. Touch taps toggle it. `disabled` prevents opening and dismisses an open card.
- Emits `open` and `close`. The scoped slot also receives the `open` boolean.

Local preview: `/dev/hover-data-card` while running Vite. This route is excluded from production routing.
