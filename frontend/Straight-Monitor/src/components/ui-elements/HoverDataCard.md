# HoverDataCard

Reusable read-only hover card: a segmented ring on the left and grouped text data on the right. The ring shows the split of the individual hour types as coloured slices, the free capacity as a faint slice, and — once the limit is exceeded — a marker at the limit plus a red outer arc covering the overage. The reached amount and the limit sit in the centre. Hovering a legend row (or a slice) highlights the matching slice. It supports hours, short-term employment days, and monthly earnings. It uses the shared theme variables, including light and dark surfaces. No API, store, or employee logic is connected.

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
- `days` is for short-term employment. Set `workedDays`, `plannedDays`, and optional `dayLimit` (default: 70). Use optional `periodLabel` when the counting period starts at an entry date; otherwise the card labels the values as calendar-year days.
- `earnings` is for marginal employment. Set `workedHours`, `plannedHours`, `hourlyRate`, and optional `earningsLimit` (default: 603). It calculates worked and planned earnings from hours × hourly rate for the displayed month.
- Negative, missing, and non-finite values are treated as zero. An overage is shown in red. Earnings figures are a front-end estimate only: premiums, allowances, variable wage types, payroll rules, and statutory decisions are not included.
- Existing presentation data with `segments` and no `type` remains supported during migration. Segments get a `role`: `remaining` (ids `remaining`) is drawn faint, `over` (ids `over`, `over-limit`) only feeds the legend and the outer overage arc, everything else fills the ring. Very small slices are widened to a minimum so every hour type stays visible.
- The ring size follows `--hover-data-card-ring-size` (default 112px); set it on the card to fit tighter layouts, e.g. `:deep(.hover-data-card--inline) { --hover-data-card-ring-size: 92px; }`.
- `inline`: renders the same card permanently in normal layout flow, without a trigger or body teleport. For example, `<HoverDataCard inline :data="overview" />` provides a fixed overview alongside an editor. Positioning and hover dismissal apply only to popup mode.
- `placement`: `right` (default), `left`, `top`, or `bottom`. The card chooses an alternate side or stays within the viewport when space is limited, and follows scrolling/resizing.
- `openDelay`: 180 ms on hover. Keyboard focus opens immediately. `closeDelay`: 160 ms so the pointer can cross into the card. It remains visible while hovered or while its trigger has focus.
- Escape, an outside pointer press, or scrolling the trigger out of view dismisses the card. Touch taps toggle it. `disabled` prevents opening and dismisses an open card.
- Emits `open` and `close`. The scoped slot also receives the `open` boolean.

Local preview: `/dev/hover-data-card` while running Vite. This route is excluded from production routing.

## Tarifgesteuerte EmployeeCard

Die EmployeeCard lädt ihre Kontingente über
`GET /api/personal/:id/analytics/contingent?year=2026&month=10`.
Die API liefert die am Gruppenstichtag gültige Tarifmitarbeitergruppe und die
bereits berechneten Fakten. Im aktuellen Monat ist der Gruppenstichtag heute,
in anderen Monaten der letzte Monatstag.

| Tarifmitarbeitergruppe | Kartentyp |
| --- | --- |
| 21015, 22436 | `days-hours`: Tage und Monatsstunden nebeneinander |
| 21195 | `hours`: Monatsstunden |
| 23437, 27356 | `days-earnings`: Tage und monatliche Verdienstprognose nebeneinander |

Die kombinierten Karten verwenden zwei unabhängige Säulen, auch im schmalen
Profilbereich. `monthlyHours` kommt aus `arbeitszeit.monat`. Fehlt der Wert oder
fehlen Einsatzstunden, zeigt die Stundenhälfte einen Hinweis; die Tageshälfte
bleibt verfügbar. Einzelkarten behalten die Auswahl zwischen Ring und Säule.

`selectionBasis` unterscheidet `TARIFF_GROUP` und `EMPLOYMENT_TYPE`. Nur bei
`ASSIGNMENT_MISSING` greift die bisherige Arbeitsverhältnis-Zuordnung:
Vollzeit (0) und Teilzeit (1) zeigen Monatsstunden, Kurzfristig (3) zeigt Tage.
Für Geringfügig (2) war bisher kein Kontingentmodell hinterlegt; die API zeigt
einen Hinweis. Mehrdeutige Tarifzuordnungen, unbekannte Tarifgruppen und fehlende
Tarifdatenstände werden nicht durch ein Arbeitsverhältnis ersetzt.
`fallbackReason` erklärt die Herkunft der Anzeige.

Die Verdienstprognose verwendet Einsatz-Sollstunden und den je Einsatzdatum
gültigen Tariflohn plus ÜTZ über `Mitarbeiter.getTariffHourlyWage(date, context)`.
Fehlende ÜTZ zählt als null Euro; überlappende Zuordnungen liefern einen Hinweis.
`workedEarnings`, `plannedEarnings`, `totalEarnings` und `earningsLimit` sind
Dezimalstrings, Geld wird erst am Ende kaufmännisch auf Cent gerundet. Die
Gesamtsumme ist maßgeblich; getrennt gerundete Teilsummen können um einen Cent
abweichen. `earningsStatus: 'UNRESOLVED'` ersetzt die Betragsgrafik durch einen
Klärungshinweis und darf nie als null Euro dargestellt werden.
