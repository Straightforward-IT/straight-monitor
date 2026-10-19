<template>
  <div class="payroll-order-details">
    <header>
      <span class="payroll-order-details__eyebrow">Produktive Stunden</span>
      <h3>
        <RouterLink v-if="calendarLink" :to="calendarLink" title="Auftrag im Kalender öffnen">Auftrag {{ orderNumber }}</RouterLink>
        <template v-else>{{ orderNumber ? `Auftrag ${orderNumber}` : 'Auftrag nicht zugeordnet' }}</template>
      </h3>
      <p v-if="order?.title" class="payroll-order-details__title">{{ order.title }}</p>
    </header>
    <dl v-if="order" class="payroll-order-details__facts">
      <div v-if="order.customerName || order.customerNumber"><dt>Kunde</dt><dd>{{ [order.customerNumber, order.customerName].filter(Boolean).join(' · ') }}</dd></div>
      <div v-if="order.site"><dt>Einsatzort</dt><dd>{{ order.site }}</dd></div>
      <div v-if="order.town"><dt>Ort</dt><dd>{{ order.town }}</dd></div>
    </dl>
    <p v-else class="payroll-order-details__notice" role="status">{{ contextNotice }}</p>

    <section aria-label="Gebuchte Arbeitszeit">
      <h4>Gebuchte Arbeitszeit</h4>
      <dl class="payroll-order-details__facts">
        <div><dt>Produktive Stunden</dt><dd>{{ entry.hours == null ? 'Ungeklärt' : `${formatImportedHours(entry.hours, 2)} Std.` }}</dd></div>
        <template v-if="entry.booking">
          <div><dt>Von / bis</dt><dd>{{ clock(entry.booking.start) }}–{{ clock(entry.booking.end) }}</dd></div>
          <div><dt>Pause</dt><dd>{{ entry.booking.breakMinutes == null ? 'Ungeklärt' : `${entry.booking.breakMinutes} Min.` }}</dd></div>
          <div v-for="(pause, index) in entry.booking.breaks || []" :key="index"><dt>Pause {{ index + 1 }}</dt><dd>{{ clock(pause.start) }}–{{ clock(pause.end) }}{{ pause.paid ? ' · bezahlt' : '' }}</dd></div>
        </template>
      </dl>
      <p v-if="entry.booking?.breakLocationKnown === false" class="payroll-order-details__notice">Die Pausendauer ist bekannt, die genaue Pausenlage fehlt.</p>
    </section>

    <template v-if="order">
      <section aria-label="Schicht">
        <h4>Schicht <span v-if="shift?.externalId">{{ shift.externalId }}</span></h4>
        <p v-if="shift?.label" class="payroll-order-details__title">{{ shift.label }}</p>
        <p v-if="shift?.status !== 'MATCHED'" class="payroll-order-details__notice" role="status">{{ shiftNotice }}</p>
        <dl v-if="shift" class="payroll-order-details__facts">
          <div v-if="shift.from"><dt>Datum</dt><dd>{{ period(shift.from, shift.until) }}</dd></div>
          <div v-if="shift.start || shift.end"><dt>Geplante Zeit</dt><dd>{{ plannedTime(shift.start, shift.end) }}</dd></div>
          <div v-if="shift.meetingTime || shift.meetingPoint"><dt>Treffpunkt</dt><dd>{{ [shift.meetingTime, shift.meetingPoint].filter(Boolean).join(' · ') }}</dd></div>
          <div v-if="shift.contactName || shift.contactPhone"><dt>Ansprechpartner</dt><dd>{{ [shift.contactName, shift.contactPhone].filter(Boolean).join(' · ') }}</dd></div>
        </dl>
      </section>
      <section aria-label="Einsatz">
        <h4>Einsatz <span v-if="assignment?.externalNumber">{{ assignment.externalNumber }}</span></h4>
        <template v-if="assignment?.status === 'MATCHED'">
          <p v-if="assignment.title" class="payroll-order-details__title">{{ assignment.title }}</p>
          <dl class="payroll-order-details__facts">
            <div v-if="assignment.from"><dt>Datum</dt><dd>{{ period(assignment.from, assignment.until) }}</dd></div>
            <div v-if="assignment.start || assignment.end"><dt>Geplante Zeit</dt><dd>{{ plannedTime(assignment.start, assignment.end) }}</dd></div>
            <div v-if="assignment.guaranteedHours != null"><dt>Garantiestunden Lohn</dt><dd>{{ formatImportedHours(String(assignment.guaranteedHours), 2) }} Std.</dd></div>
          </dl>
        </template>
        <p v-else class="payroll-order-details__notice" role="status">{{ assignment?.status === 'AMBIGUOUS' ? 'Mehrere Einsätze passen zur Buchung. Eine eindeutige Zuordnung fehlt.' : 'Kein passender Einsatz zur Buchung vorhanden.' }}</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { formatImportedHours } from '@/utils/importedHours';

const props = defineProps({ entry: { type: Object, required: true } });
const context = computed(() => props.entry.orderContext);
const order = computed(() => context.value?.status === 'AVAILABLE' ? context.value.order : null);
const shift = computed(() => order.value ? context.value.shift : null);
const assignment = computed(() => order.value ? context.value.assignment : null);
const orderNumber = computed(() => order.value?.number || props.entry.booking?.auftragNr || null);
const calendarLink = computed(() => orderNumber.value && context.value?.status !== 'FORBIDDEN'
  ? { path: '/auftraege', query: { tab: 'calendar', auftragnr: String(orderNumber.value), focusDate: props.entry.date } } : null);
const contextNotice = computed(() => context.value?.status === 'FORBIDDEN' ? 'Keine Berechtigung für die Auftragsdetails.'
  : orderNumber.value ? 'Die Auftragsdetails sind im aktuellen Datenstand nicht vorhanden.'
    : 'Der Stundenwert enthält keine eindeutige Auftrags-, Schicht- oder Einsatzzuordnung.');
const shiftNotice = computed(() => shift.value?.status === 'FROM_ASSIGNMENT' ? 'Schichtangaben aus dem zugeordneten Einsatz.'
  : shift.value?.status === 'AMBIGUOUS' ? 'Mehrere Schichten passen zur Buchung. Eine eindeutige Zuordnung fehlt.'
    : 'Keine passende Schicht zur Buchung vorhanden.');
const clock = value => value ? new Date(value).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }) : 'Ungeklärt';
const date = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
const period = (from, until) => until && until !== from ? `${date(from)}–${date(until)}` : date(from);
const plannedTime = (from, until) => `${from || 'Offen'}–${until || 'Offen'}`;
</script>

<style scoped>
.payroll-order-details { display: grid; gap: 14px; min-width: 0; }
.payroll-order-details__eyebrow { color: var(--muted); font-size: 11px; }
.payroll-order-details h3 { margin: 4px 0 0; font-size: 16px; }
.payroll-order-details h3 a { color: var(--primary, #329fe5); text-decoration: underline; text-underline-offset: 3px; }
.payroll-order-details h3 a:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.payroll-order-details h4 { margin: 0 0 10px; font-size: 12px; }
.payroll-order-details h4 span { color: var(--muted); font-weight: normal; }
.payroll-order-details section { border-top: 1px solid var(--border); padding-top: 12px; }
.payroll-order-details__title { margin: 6px 0 10px; font-size: 13px; overflow-wrap: anywhere; }
.payroll-order-details__facts { margin: 0; display: grid; gap: 8px; }
.payroll-order-details__facts > div { display: grid; grid-template-columns: minmax(100px, 40%) minmax(0, 1fr); gap: 10px; font-size: 12px; }
.payroll-order-details__facts dt { color: var(--muted); }.payroll-order-details__facts dd { margin: 0; overflow-wrap: anywhere; }
.payroll-order-details__notice { margin: 8px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
</style>
