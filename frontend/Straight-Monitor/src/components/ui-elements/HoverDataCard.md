# HoverDataCard

Reusable read-only hover card: a proportional, segmented column on the left and grouped text data on the right. It supports hours, short-term employment days, and monthly earnings. It uses the shared theme variables, including light and dark surfaces. No API, store, or employee logic is connected.

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

`data` replaces the entire dummy object. Pass one of the three typed data shapes; the card calculates the segments, reached amount, and remaining capacity from the values.

```js
const overview = {
  type: 'hours', // 'hours' | 'days' | 'earnings'
  eyebrow: 'September 2026',
  employeeName: 'Max Mustermann',
  title: 'Stundenbezogen beschäftigt',
  monthlyHours: 108.25,
  workedHours: 11.25,
  plannedHours: 94,
  hourlyRate: 16,
};
```

- `hours` is for hour-based employment. Required facts are `monthlyHours`, `workedHours`, and `plannedHours`; `hourlyRate` is optional and shown as context.
- `days` is for short-term employment. Set `workedDays`, `plannedDays`, and optional `dayLimit` (default: 70). The card compares all days used or planned in the calendar year with the limit.
- `earnings` is for marginal employment. Set `workedHours`, `plannedHours`, `hourlyRate`, and optional `earningsLimit` (default: 603). It calculates worked and planned earnings from hours × hourly rate for the displayed month.
- Negative, missing, and non-finite values are treated as zero. An overage is shown in red. Earnings figures are a front-end estimate only: premiums, allowances, variable wage types, payroll rules, and statutory decisions are not included.
- Existing presentation data with `segments` and no `type` remains supported during migration.
- `placement`: `right` (default), `left`, `top`, or `bottom`. The card chooses an alternate side or stays within the viewport when space is limited, and follows scrolling/resizing.
- `openDelay`: 180 ms on hover. Keyboard focus opens immediately. `closeDelay`: 160 ms so the pointer can cross into the card. It remains visible while hovered or while its trigger has focus.
- Escape, an outside pointer press, or scrolling the trigger out of view dismisses the card. Touch taps toggle it. `disabled` prevents opening and dismisses an open card.
- Emits `open` and `close`. The scoped slot also receives the `open` boolean.

Local preview: `/dev/hover-data-card` while running Vite. This route is excluded from production routing.
