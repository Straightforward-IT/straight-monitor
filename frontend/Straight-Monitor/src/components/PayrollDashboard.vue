<template>
  <section class="payroll-page">
    <header class="payroll-heading">
      <div>
        <p class="eyebrow">GVP · AÜG · Paychex</p>
        <h1 data-page-title>Payroll</h1>
        <p class="subtitle">
          Operative Bruttokomponenten berechnen, prüfen und kontrolliert an Paychex übergeben.
        </p>
      </div>

      <form class="new-run" @submit.prevent="createRun">
        <label>
          Abrechnungsmonat
          <input v-model="newMonth" type="month" required />
        </label>
        <button class="button button--primary" :disabled="payroll.action === 'create'">
          {{ payroll.action === 'create' ? 'Wird angelegt …' : 'Lauf anlegen' }}
        </button>
      </form>
    </header>

    <div v-if="payroll.error" class="notice notice--error" role="alert">
      <strong>Aktion nicht möglich</strong>
      <span>{{ payroll.error }}</span>
      <button type="button" aria-label="Fehlermeldung schließen" @click="payroll.clearError">×</button>
    </div>

    <div class="provider-banner" :class="providerReady ? 'provider-banner--ready' : 'provider-banner--safe'">
      <div>
        <strong>{{ providerReady ? 'Paychex-Schreibzugriff aktiv' : 'Sicherer Vorbereitungsmodus' }}</strong>
        <span v-if="providerReady">
          Übertragungen sind freigeschaltet. Jeder Export bleibt validierungs- und auditpflichtig.
        </span>
        <span v-else>
          Berechnen und validieren ist möglich. Paychex-Schreibzugriffe bleiben über den Kill Switch gesperrt.
        </span>
      </div>
      <span class="provider-pill">{{ providerLabel }}</span>
    </div>

    <nav class="payroll-tabs" aria-label="Payroll-Bereiche">
      <button type="button" :class="{ active: section === 'runs' }" @click="section = 'runs'">Monatsläufe</button>
      <button type="button" :class="{ active: section === 'readiness' }" @click="section = 'readiness'">Payroll-Readiness</button>
      <button type="button" :class="{ active: section === 'time' }" @click="section = 'time'">Ist-Zeit-Freigabe</button>
    </nav>

    <PayrollReadinessWorkbench
      v-if="section === 'readiness'"
      :month="payroll.selectedRun?.month || newMonth"
    />
    <PayrollTimeApproval v-else-if="section === 'time'" :month="payroll.selectedRun?.month || newMonth" />

    <div v-else class="workspace">
      <aside class="run-list" aria-label="Payroll-Läufe">
        <div class="panel-title">
          <div>
            <span class="eyebrow">Abrechnungen</span>
            <strong>{{ payroll.runs.length }} Läufe</strong>
          </div>
          <button class="icon-button" type="button" title="Aktualisieren" @click="refresh">↻</button>
        </div>

        <div v-if="payroll.loading && !payroll.runs.length" class="empty-small">Läufe werden geladen …</div>
        <button
          v-for="run in payroll.runs"
          :key="run._id"
          type="button"
          class="run-card"
          :class="{ 'run-card--active': run._id === payroll.selectedRun?._id }"
          @click="selectRun(run._id)"
        >
          <span>
            <strong>{{ formatMonth(run.month) }}</strong>
            <small>{{ scopeLabel(run) }}</small>
          </span>
          <span class="status" :class="statusClass(run.status)">{{ statusLabel(run.status) }}</span>
        </button>

        <div v-if="!payroll.loading && !payroll.runs.length" class="empty-small">
          Noch kein Payroll-Lauf. Lege oben den ersten Abrechnungsmonat an.
        </div>
      </aside>

      <main class="run-workspace">
        <div v-if="payroll.loading && !payroll.selectedRun" class="empty-state">Payroll-Daten werden geladen …</div>
        <div v-else-if="!payroll.selectedRun" class="empty-state">
          <span class="empty-icon">✓</span>
          <h2>Payroll-Readiness beginnt mit einem Monatslauf</h2>
          <p>Der Lauf friert die freigegebenen Quellen je Mitarbeiter als nachvollziehbaren Snapshot ein.</p>
        </div>

        <template v-else>
          <section class="run-header">
            <div>
              <span class="eyebrow">{{ scopeLabel(payroll.selectedRun) }}</span>
              <h2>{{ formatMonth(payroll.selectedRun.month) }}</h2>
            </div>
            <span class="status status--large" :class="statusClass(payroll.selectedRun.status)">
              {{ statusLabel(payroll.selectedRun.status) }}
            </span>
          </section>

          <ol class="pipeline" aria-label="Abrechnungsfortschritt">
            <li
              v-for="(step, index) in pipeline"
              :key="step.value"
              :class="{
                complete: statusIndex > index,
                current: statusIndex === index,
              }"
            >
              <span>{{ statusIndex > index ? '✓' : index + 1 }}</span>
              <small>{{ step.short }}</small>
            </li>
          </ol>

          <section class="metrics" aria-label="Laufkennzahlen">
            <article>
              <span>Mitarbeiter im Cohort</span>
              <strong>{{ counter('employeeCount', 'employees') }}</strong>
            </article>
            <article>
              <span>Berechnet</span>
              <strong>{{ counter('calculated') }}</strong>
            </article>
            <article>
              <span>Validiert</span>
              <strong>{{ counter('validated') }}</strong>
            </article>
            <article :class="{ 'metric--danger': errorCount > 0 }">
              <span>Blocker</span>
              <strong>{{ errorCount }}</strong>
            </article>
            <article>
              <span>Paychex Sync</span>
              <strong>{{ counter('synced') }}</strong>
            </article>
          </section>

          <section class="action-bar">
            <div>
              <button
                class="button button--primary"
                type="button"
                :disabled="busy || !canCalculate"
                @click="perform('calculate')"
              >
                {{ actionText('calculate', 'Berechnen') }}
              </button>
              <button
                class="button"
                type="button"
                :disabled="busy || !canValidate"
                @click="perform('validate')"
              >
                {{ actionText('validate', 'Validieren') }}
              </button>
              <button
                class="button button--paychex"
                type="button"
                :disabled="busy || !canSync"
                :title="syncTitle"
                @click="perform('sync-paychex')"
              >
                {{ actionText('sync-paychex', 'An Paychex übertragen') }}
              </button>
              <button
                class="button"
                type="button"
                :disabled="busy || !canSyncDocuments"
                :title="documentSyncTitle"
                @click="perform('sync-documents')"
              >
                {{ actionText('sync-documents', 'Dokumente importieren') }}
              </button>
            </div>
            <button
              class="button button--quiet"
              type="button"
              :disabled="busy || !canClose"
              @click="perform('close')"
            >
              Lauf schließen
            </button>
          </section>

          <section
            v-if="['SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED'].includes(payroll.selectedRun.status)"
            class="reconciliation-panel"
            aria-labelledby="gross-reconciliation-heading"
          >
            <div class="reconciliation-heading">
              <div>
                <span class="eyebrow">Vier-Augen-Prüfung</span>
                <h3 id="gross-reconciliation-heading">Paychex-Bruttoabgleich</h3>
              </div>
              <div class="expected-total">
                <small>StraightMonitor Expected Gross</small>
                <strong>{{ formatCurrency(expectedRunGrossCents / 100) }}</strong>
              </div>
            </div>

            <div
              v-if="payroll.selectedRun.reconciliation?.status === 'FAILED'"
              class="notice notice--error notice--static"
            >
              <strong>Abweichung {{ formatCurrency((payroll.selectedRun.reconciliation.differenceCents || 0) / 100) }}</strong>
              <span>Der Lauf bleibt offen. Prüfe Paychex-Lohnarten und korrigiere die Ursache vor einem neuen Abgleich.</span>
            </div>

            <dl v-if="payroll.selectedRun.status === 'PAYROLL_COMPLETED'" class="reconciliation-result">
              <div><dt>Paychex-Brutto</dt><dd>{{ formatCurrency(payroll.selectedRun.reconciliation.providerGrossCents / 100) }}</dd></div>
              <div><dt>Differenz</dt><dd>{{ formatCurrency(payroll.selectedRun.reconciliation.differenceCents / 100) }}</dd></div>
              <div><dt>Finalisierung</dt><dd>{{ payroll.selectedRun.reconciliation.providerFinalizationReference }}</dd></div>
              <div><dt>Evidenz-Hash</dt><dd class="hash-value">{{ payroll.selectedRun.reconciliation.evidenceHash }}</dd></div>
            </dl>

            <form v-else class="reconciliation-form" @submit.prevent="submitReconciliation">
              <label>
                Paychex-Brutto in EUR
                <input
                  v-model.trim="reconciliationForm.providerGrossEuro"
                  inputmode="decimal"
                  placeholder="z. B. 124500,37"
                  required
                />
              </label>
              <label>
                Paychex-Finalisierungsreferenz
                <input v-model.trim="reconciliationForm.providerFinalizationReference" maxlength="500" required />
              </label>
              <label class="field-wide">
                Evidenzverweise (einer je Zeile)
                <textarea
                  v-model="reconciliationForm.evidenceRefs"
                  rows="2"
                  placeholder="z. B. privater R2-Dokumentpfad oder revisionssichere Export-ID"
                  required
                ></textarea>
              </label>
              <label class="field-wide">
                SHA-256 der Evidenz
                <input
                  v-model.trim="reconciliationForm.evidenceHash"
                  minlength="64"
                  maxlength="64"
                  pattern="[A-Fa-f0-9]{64}"
                  autocomplete="off"
                  required
                />
              </label>
              <label class="field-wide">
                Prüfgrund
                <textarea v-model.trim="reconciliationForm.reason" rows="2" maxlength="2000" required></textarea>
              </label>
              <p v-if="reconciliationError" class="form-error" role="alert">{{ reconciliationError }}</p>
              <div class="field-wide reconciliation-submit">
                <p>Der Prüfer muss eine andere Person als der Paychex-Synchronisierer sein. Der Abschluss ist nur bei exakt 0,00 € Differenz möglich.</p>
                <button class="button button--primary" type="submit" :disabled="busy || !canMarkComplete">
                  {{ actionText('mark-payroll-complete', 'Brutto abgleichen und Abschluss bestätigen') }}
                </button>
              </div>
            </form>
          </section>

          <section v-if="errorCount" class="notice notice--error notice--static">
            <strong>{{ errorCount }} blockierende Prüfungen</strong>
            <span>
              Der Lauf kann nicht exportiert werden. Öffne die betroffenen Mitarbeiter und vervollständige die Quelle in StraightMonitor.
            </span>
          </section>

          <section class="employee-section">
            <div class="panel-title employee-title">
              <div>
                <span class="eyebrow">Vollständigkeitsprüfung</span>
                <strong>Mitarbeiterergebnisse</strong>
              </div>
              <label class="search">
                <span class="sr-only">Mitarbeiter suchen</span>
                <input v-model.trim="search" type="search" placeholder="Name oder Personalnummer" />
              </label>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mitarbeiter</th>
                    <th>EG</th>
                    <th>Expected Gross</th>
                    <th>Prüfung</th>
                    <th>Paychex</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="employee in filteredEmployees" :key="employee._id">
                    <td>
                      <strong>{{ employeeName(employee) }}</strong>
                      <small>{{ personalNumber(employee) }}</small>
                    </td>
                    <td>{{ tariffGroup(employee) }}</td>
                    <td class="money">{{ formatCurrency(expectedGross(employee)) }}</td>
                    <td>
                      <span class="check" :class="employeeBlocking(employee) ? 'check--error' : 'check--ok'">
                        {{ employeeBlocking(employee) ? `${employeeBlocking(employee)} Blocker` : 'Freigegeben' }}
                      </span>
                    </td>
                    <td>
                      <span class="check" :class="providerSyncClass(employee)">{{ providerSyncLabel(employee) }}</span>
                    </td>
                    <td>
                      <button class="link-button" type="button" @click="openEmployee(employee)">Details</button>
                    </td>
                  </tr>
                  <tr v-if="!filteredEmployees.length">
                    <td colspan="6" class="empty-table">
                      {{ payroll.employees.length ? 'Keine Treffer.' : 'Der Lauf wurde noch nicht berechnet.' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </main>
    </div>

    <div v-if="detail" class="drawer-backdrop" @click.self="detail = null">
      <aside class="employee-drawer" role="dialog" aria-modal="true" aria-label="Payroll-Mitarbeiterdetails">
        <header>
          <div>
            <span class="eyebrow">{{ personalNumber(detail) }}</span>
            <h2>{{ employeeName(detail) }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="Details schließen" @click="detail = null">×</button>
        </header>

        <div class="drawer-meta">
          <span><small>Monat</small>{{ formatMonth(payroll.selectedRun?.month) }}</span>
          <span><small>Tarif</small>{{ tariffVersion(detail) }}</span>
          <span><small>Entgeltgruppe</small>{{ tariffGroup(detail) }}</span>
        </div>

        <section>
          <h3>Lohnarten</h3>
          <div v-if="components(detail).length" class="component-list">
            <div v-for="component in components(detail)" :key="component._id || component.componentKey || component.type">
              <span>
                <strong>{{ componentLabel(component.componentKey || component.type) }}</strong>
                <small>{{ componentTrace(component) }}</small>
              </span>
              <strong>{{ formatCurrency(componentAmountEuro(component)) }}</strong>
            </div>
            <div class="component-total">
              <span>Expected Gross</span>
              <strong>{{ formatCurrency(expectedGross(detail)) }}</strong>
            </div>
          </div>
          <p v-else class="empty-small">Noch keine Komponenten berechnet.</p>
        </section>

        <section>
          <h3>Validierung</h3>
          <ul v-if="validationIssues(detail).length" class="issue-list">
            <li v-for="issue in validationIssues(detail)" :key="issue.code || issue.message || issue">
              <span>!</span>
              <div>
                <strong>{{ issue.code || 'BLOCKING_ERROR' }}</strong>
                <small>{{ issue.message || issue }}</small>
              </div>
            </li>
          </ul>
          <p v-else class="check check--ok">Alle Pflichtprüfungen bestanden.</p>
        </section>

        <footer>
          <button class="button" type="button" :disabled="busy" @click="recalculate(detail)">
            {{ payroll.action?.startsWith('recalculate:') ? 'Wird neu berechnet …' : 'Neu berechnen' }}
          </button>
          <button class="button button--quiet" type="button" @click="detail = null">Schließen</button>
        </footer>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { usePayroll } from '@/stores/payroll';
import PayrollTimeApproval from './PayrollTimeApproval.vue';

const PayrollReadinessWorkbench = defineAsyncComponent(() => import('./PayrollReadinessWorkbench.vue'));
const payroll = usePayroll();
const newMonth = ref(new Date().toISOString().slice(0, 7));
const search = ref('');
const detail = ref(null);
const section = ref('runs');
const reconciliationError = ref('');
const reconciliationForm = ref({
  providerGrossEuro: '',
  providerFinalizationReference: '',
  evidenceRefs: '',
  evidenceHash: '',
  reason: '',
});

const pipeline = [
  { value: 'DRAFT', short: 'Entwurf' },
  { value: 'CALCULATED', short: 'Berechnet' },
  { value: 'VALIDATED', short: 'Validiert' },
  { value: 'READY_FOR_EXPORT', short: 'Exportbereit' },
  { value: 'SYNCED_TO_PAYCHEX', short: 'Paychex' },
  { value: 'DOCUMENTS_IMPORTED', short: 'Dokumente' },
  { value: 'CLOSED', short: 'Geschlossen' },
];

const statusAliases = {
  PAYROLL_COMPLETED: 4,
  CALCULATING: 0,
  VALIDATING: 2,
};

const statusIndex = computed(() => {
  const index = pipeline.findIndex((step) => step.value === payroll.selectedRun?.status);
  return index >= 0 ? index : (statusAliases[payroll.selectedRun?.status] ?? 0);
});

const busy = computed(() => Boolean(payroll.action));
const providerReady = computed(() => Boolean(
  payroll.providerStatus?.canWrite,
));
const providerLabel = computed(() => {
  if (!payroll.providerStatus) return 'Konfiguration wird geprüft';
  if (!payroll.providerStatus.enabled) return 'PAYCHEX_ENABLED=false';
  if (!payroll.providerStatus.writeEnabled) return 'PAYCHEX_WRITE_ENABLED=false';
  if (!payroll.providerStatus.company?.configured) return 'Company UID fehlt';
  return 'Live-Write aktiv';
});
const errorCount = computed(() => (
  payroll.selectedRun?.counters?.errors
  ?? payroll.selectedRun?.counters?.blockingErrors
  ?? payroll.blockingCount
  ?? 0
));
const canCalculate = computed(() => ['DRAFT', 'CALCULATED', 'VALIDATED', 'READY_FOR_EXPORT'].includes(payroll.selectedRun?.status));
const canValidate = computed(() => ['CALCULATED', 'VALIDATED', 'READY_FOR_EXPORT'].includes(payroll.selectedRun?.status));
const canSync = computed(() => providerReady.value && payroll.selectedRun?.status === 'READY_FOR_EXPORT' && errorCount.value === 0);
const canMarkComplete = computed(() => payroll.selectedRun?.status === 'SYNCED_TO_PAYCHEX');
const canSyncDocuments = computed(() => (
  payroll.selectedRun?.status === 'PAYROLL_COMPLETED'
  && payroll.providerStatus?.documentSync?.canImport === true
));
const canClose = computed(() => payroll.selectedRun?.status === 'DOCUMENTS_IMPORTED');
const syncTitle = computed(() => {
  if (!providerReady.value) return 'Paychex ist durch die Server-Konfiguration gesperrt.';
  if (errorCount.value) return 'Blockierende Prüfungen müssen zuerst behoben werden.';
  if (payroll.selectedRun?.status !== 'READY_FOR_EXPORT') return 'Der Lauf muss zuerst vollständig validiert werden.';
  return 'Validierte Lohnarten idempotent an Paychex übertragen.';
});
const documentSyncTitle = computed(() => {
  if (!payroll.providerStatus?.documentSyncEnabled) return 'PAYROLL_DOCUMENT_SYNC_ENABLED=false';
  if (!payroll.providerStatus?.documentSync?.configured) {
    return `Freigegebene Paychex-Dokumentkategorien fehlen (${(payroll.providerStatus?.documentSync?.missing || []).join(', ')}).`;
  }
  if (payroll.selectedRun?.status !== 'PAYROLL_COMPLETED') return 'Zuerst den Abschluss der Abrechnung in Paychex bestätigen.';
  return 'Paychex-Dokumente privat importieren und die Mitarbeiterabdeckung prüfen.';
});

const filteredEmployees = computed(() => {
  const needle = search.value.toLocaleLowerCase('de');
  if (!needle) return payroll.employees;
  return payroll.employees.filter((employee) => (
    `${employeeName(employee)} ${personalNumber(employee)}`.toLocaleLowerCase('de').includes(needle)
  ));
});
const expectedRunGrossCents = computed(() => payroll.employees.reduce(
  (total, employee) => total + Number(employee?.totals?.expectedGrossCents || 0),
  0,
));

const formatMonth = (month) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || '–';
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(year, value - 1, 1)));
};
const formatCurrency = (amount) => new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
}).format(Number(amount || 0));
const statusLabel = (status) => ({
  DRAFT: 'Entwurf', CALCULATED: 'Berechnet', VALIDATED: 'Validiert',
  READY_FOR_EXPORT: 'Exportbereit', SYNCED_TO_PAYCHEX: 'An Paychex übertragen',
  PAYROLL_COMPLETED: 'In Paychex abgeschlossen', DOCUMENTS_IMPORTED: 'Dokumente importiert',
  CLOSED: 'Geschlossen', REVISION_REQUIRED: 'Korrektur erforderlich',
}[status] || status || 'Unbekannt');
const statusClass = (status) => `status--${String(status || 'unknown').toLowerCase().replaceAll('_', '-')}`;
const companyLabel = (companyKey) => ({
  straightforward: 'H. & P. Straightforward GmbH',
}[companyKey] || companyKey || 'Arbeitgeber unbekannt');
const scopeLabel = (run) => {
  const locationCount = run?.scope?.locationIds?.length || 0;
  const selectedEmployeeCount = run?.scope?.employeeIds?.length || 0;
  const cohortCount = run?.cohort?.employeeIds?.length
    ?? run?.coverage?.expectedCount
    ?? run?.employeeCount;
  const parts = [companyLabel(run?.companyKey)];
  if (locationCount) {
    parts.push(`${locationCount} ${locationCount === 1 ? 'Standort' : 'Standorte'}`);
  }
  if (selectedEmployeeCount) {
    parts.push(`${selectedEmployeeCount} gezielt ausgewählte ${selectedEmployeeCount === 1 ? 'Person' : 'Personen'}`);
  }
  if (!locationCount && !selectedEmployeeCount) parts.push('Gesamtbelegschaft');
  if (cohortCount != null) {
    parts.push(`Cohort: ${cohortCount} Mitarbeiter eingefroren`);
  } else {
    parts.push('Cohort noch nicht verfügbar');
  }
  return parts.join(' · ');
};
const counter = (...keys) => {
  for (const key of keys) {
    const value = payroll.selectedRun?.counters?.[key] ?? payroll.selectedRun?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return 0;
};
const employeeName = (employee) => employee?.employee?.displayName
  || employee?.employeeSnapshot?.displayName
  || [employee?.employeeIdentity?.firstName, employee?.employeeIdentity?.lastName].filter(Boolean).join(' ')
  || employee?.mitarbeiter?.fullName
  || [employee?.mitarbeiter?.vorname, employee?.mitarbeiter?.name || employee?.mitarbeiter?.nachname].filter(Boolean).join(' ')
  || employee?.displayName
  || 'Unbekannter Mitarbeiter';
const personalNumber = (employee) => employee?.employee?.personalNumber
  || employee?.employeeSnapshot?.personalNumber
  || employee?.employeeIdentity?.personalNr
  || employee?.mitarbeiter?.personalnr
  || employee?.personalNumber
  || 'ohne Personalnummer';
const tariffGroup = (employee) => employee?.inputSnapshot?.employment?.tariff?.group
  || employee?.inputSnapshot?.employment?.tariffGroup
  || employee?.tariffGroup
  || '–';
const tariffVersion = (employee) => employee?.inputSnapshot?.tariffVersion?.code
  || employee?.inputSnapshot?.tariffVersions?.[0]?.code
  || employee?.tariffVersion?.code
  || employee?.tariffVersionCode
  || '–';
const components = (employee) => employee?.components || [];
const expectedGross = (employee) => employee?.totals?.expectedGrossCents != null
  ? Number(employee.totals.expectedGrossCents) / 100
  : employee?.totals?.expectedGross
  ?? employee?.expectedGross
  ?? components(employee).reduce((sum, entry) => sum + componentAmountEuro(entry), 0);
const validationIssues = (employee) => employee?.validation?.blockingErrors
  || employee?.blockingErrors
  || employee?.issues?.filter((issue) => issue.blocking)
  || [];
const employeeBlocking = (employee) => validationIssues(employee).length;
const providerSyncLabel = (employee) => {
  const status = employee?.providerSync?.status || employee?.paychexSync?.status || employee?.status;
  if (status === 'SYNCED_TO_PAYCHEX' || status === 'PAYROLL_COMPLETED') return 'Synchronisiert';
  if (status === 'SYNC_PENDING') return 'Wird übertragen';
  return ({ SYNCED: 'Synchronisiert', FAILED: 'Fehler', DIRTY: 'Änderung offen', NOT_SYNCED: 'Nicht übertragen' }[status] || status || 'Nicht übertragen');
};
const providerSyncClass = (employee) => {
  const status = employee?.providerSync?.status || employee?.paychexSync?.status || employee?.status;
  if (['SYNCED', 'SYNCED_TO_PAYCHEX', 'PAYROLL_COMPLETED'].includes(status)) return 'check--ok';
  if (['FAILED', 'ERROR', 'VALIDATION_FAILED'].includes(status)) return 'check--error';
  return 'check--neutral';
};
const componentLabel = (key) => ({
  BASE_WAGE: 'GVP Basislohn', EXPERIENCE_BONUS: 'Erfahrungszuschlag',
  INDUSTRY_SURCHARGE: 'Branchenzuschlag', NIGHT_PREMIUM: 'Nachtzuschlag',
  SUNDAY_PREMIUM: 'Sonntagszuschlag', HOLIDAY_PREMIUM: 'Feiertagszuschlag',
  OVERTIME_PREMIUM: 'Mehrarbeitszuschlag', EQUAL_PAY_ADJUSTMENT: 'Equal Pay',
  AZK_ACCRUAL: 'AZK Aufbau', AZK_REDUCTION: 'AZK Abbau', AZK_PAYOUT: 'AZK Auszahlung',
  VACATION_PAY: 'Urlaubsentgelt', SICK_PAY: 'Entgeltfortzahlung', CORRECTION: 'Korrektur',
  TEMP_HIGHER_GRADE_DIFFERENTIAL: 'Höherwertige Tätigkeit', TRAVEL_TIME: 'Reisezeit',
  SPECIAL_PAYMENT: 'Sonderzahlung',
}[key] || key || 'Lohnart');
const componentTrace = (component) => {
  const parts = [];
  const quantity = decimalValue(component.quantity);
  if (quantity != null) parts.push(`${quantity} ${component.unit === 'DAYS' ? 'Tage' : component.unit === 'HOURS' ? 'Std.' : component.unit || ''}`.trim());
  if (component.rateCents != null) parts.push(`${formatCurrency(component.rateCents / 100)}/Std.`);
  else if (component.rate !== undefined) parts.push(`${formatCurrency(component.rate)}/Std.`);
  if (component.percentBasisPoints != null) parts.push(`${component.percentBasisPoints / 100} %`);
  else if (component.percent !== undefined) parts.push(`${component.percent} %`);
  if (component.rule?.clause || component.clause) parts.push(component.rule?.clause || component.clause);
  return parts.join(' · ') || 'Betragskomponente';
};
const decimalValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'object' && value.$numberDecimal != null) return Number(value.$numberDecimal);
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const componentAmountEuro = (entry) => entry?.amountCents != null
  ? Number(entry.amountCents) / 100
  : Number(entry?.expectedAmount ?? entry?.amount ?? 0);

function euroToCents(value) {
  const normalized = String(value || '').trim().replace(/\s/g, '');
  const match = normalized.match(/^(-?)(\d+)(?:[.,](\d{1,2}))?$/);
  if (!match) throw new Error('Das Paychex-Brutto muss als EUR-Betrag mit höchstens zwei Nachkommastellen eingegeben werden.');
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] || '').padEnd(2, '0'));
  const signed = match[1] ? -cents : cents;
  const numeric = Number(signed);
  if (!Number.isSafeInteger(numeric)) throw new Error('Der eingegebene Bruttobetrag ist zu groß.');
  return numeric;
}

async function submitReconciliation() {
  reconciliationError.value = '';
  try {
    const evidenceRefs = reconciliationForm.value.evidenceRefs
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    await payroll.markPayrollComplete(payroll.selectedRun._id, {
      providerGrossCents: euroToCents(reconciliationForm.value.providerGrossEuro),
      providerFinalizationReference: reconciliationForm.value.providerFinalizationReference,
      evidenceRefs,
      evidenceHash: reconciliationForm.value.evidenceHash,
      reason: reconciliationForm.value.reason,
    });
  } catch (error) {
    reconciliationError.value = error?.response?.data?.message || error?.message || 'Bruttoabgleich fehlgeschlagen.';
  }
}

async function refresh() {
  const currentId = payroll.selectedRun?._id;
  await payroll.fetchRuns();
  const target = currentId || payroll.runs[0]?._id;
  if (target) await payroll.fetchRun(target);
}

async function createRun() {
  try {
    const run = await payroll.createRun({
      month: newMonth.value,
      companyKey: 'straightforward',
      scope: {},
    });
    await payroll.fetchRun(run._id);
  } catch {
    // Store exposes a user-facing error.
  }
}

async function selectRun(runId) {
  detail.value = null;
  try { await payroll.fetchRun(runId); } catch { /* Store owns the message. */ }
}

async function perform(action) {
  const runId = payroll.selectedRun?._id;
  if (!runId) return;
  if (action === 'sync-paychex') {
    const confirmed = window.confirm(
      'Alle validierten Lohnarten dieses Laufs idempotent an Paychex übertragen?',
    );
    if (!confirmed) return;
  }
  if (action === 'close') {
    const confirmed = window.confirm(
      'Den Payroll-Lauf schließen? Änderungen erfordern danach eine dokumentierte Revision.',
    );
    if (!confirmed) return;
  }
  try {
    if (action === 'calculate') await payroll.calculate(runId);
    if (action === 'validate') await payroll.validate(runId);
    if (action === 'sync-paychex') await payroll.syncPaychex(runId);
    if (action === 'sync-documents') await payroll.syncDocuments(runId);
    if (action === 'close') await payroll.closeRun(runId);
  } catch {
    // Store owns the message.
  }
}

const actionText = (action, idle) => payroll.action === action ? 'Wird verarbeitet …' : idle;

async function openEmployee(employee) {
  detail.value = employee;
  const mitarbeiterId = employee?.mitarbeiter?._id || employee?.mitarbeiter || employee?.employeeId;
  if (!mitarbeiterId) return;
  try {
    detail.value = await payroll.fetchEmployee(payroll.selectedRun._id, mitarbeiterId);
  } catch {
    // Keep the row snapshot visible when the detail request fails.
  }
}

async function recalculate(employee) {
  const mitarbeiterId = employee?.mitarbeiter?._id || employee?.mitarbeiter || employee?.employeeId;
  if (!mitarbeiterId) return;
  try {
    await payroll.recalculateEmployee(payroll.selectedRun._id, mitarbeiterId);
    await openEmployee(payroll.employees.find((item) => (
      (item?.mitarbeiter?._id || item?.mitarbeiter || item?.employeeId) === mitarbeiterId
    )) || employee);
  } catch {
    // Store owns the message.
  }
}

onMounted(async () => {
  try {
    await Promise.allSettled([payroll.fetchProviderStatus(), payroll.fetchRuns()]);
    if (payroll.runs[0]?._id) await payroll.fetchRun(payroll.runs[0]._id);
  } catch {
    // Store owns the message.
  }
});
</script>

<style scoped>
.payroll-page { display: grid; gap: 16px; max-width: 1680px; margin: 0 auto; color: var(--text, #152026); }
.payroll-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 18px 20px; border: 1px solid var(--border, #dce4e7); border-radius: 16px; background: var(--panel, #fff); }
.payroll-heading h1, .run-header h2, .employee-drawer h2 { margin: 2px 0; letter-spacing: -.025em; }
.payroll-heading h1 { font-size: clamp(1.7rem, 2.5vw, 2.25rem); }
.subtitle { margin: 5px 0 0; color: var(--text-muted, #64747c); max-width: 720px; }
.eyebrow { display: block; color: #237a5b; font-size: .7rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.new-run { display: flex; align-items: end; gap: 10px; flex: 0 0 auto; }
.new-run label { display: grid; gap: 5px; color: var(--text-muted, #64747c); font-size: .75rem; font-weight: 700; }
input { min-height: 38px; padding: 8px 10px; border: 1px solid var(--border, #ccd7db); border-radius: 9px; background: var(--bg, #fff); color: var(--text, #152026); font: inherit; }
input:focus { outline: 2px solid rgba(35, 122, 91, .25); border-color: #237a5b; }
.button { min-height: 38px; padding: 8px 14px; border: 1px solid var(--border, #cbd6da); border-radius: 9px; background: var(--panel, #fff); color: var(--text, #152026); font-weight: 750; cursor: pointer; }
.button:hover:not(:disabled) { border-color: #237a5b; transform: translateY(-1px); }
.button:disabled { opacity: .46; cursor: not-allowed; }
.button--primary { border-color: #176447; background: #176447; color: #fff; }
.button--paychex { border-color: #215aa8; background: #215aa8; color: #fff; }
.button--quiet { background: transparent; }
.icon-button, .link-button { border: 0; background: transparent; color: #237a5b; font: inherit; font-weight: 750; cursor: pointer; }
.icon-button { width: 34px; height: 34px; border-radius: 8px; font-size: 1.25rem; }
.notice { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 11px; }
.notice strong { flex: 0 0 auto; }
.notice span { flex: 1; }
.notice button { border: 0; background: none; color: inherit; font-size: 1.2rem; cursor: pointer; }
.notice--error { border: 1px solid #e8b9b5; background: #fff2f1; color: #8f2922; }
.notice--static { margin-top: 14px; }
.provider-banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-radius: 12px; }
.provider-banner > div { display: grid; gap: 2px; }
.provider-banner span { font-size: .84rem; }
.provider-banner--safe { border: 1px solid #e5d39b; background: #fff9e8; color: #705716; }
.provider-banner--ready { border: 1px solid #9ed3bd; background: #ecfaf3; color: #176447; }
.provider-pill { flex: 0 0 auto; padding: 5px 9px; border: 1px solid currentColor; border-radius: 99px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .7rem !important; }
.payroll-tabs { display: flex; width: fit-content; gap: 4px; border: 1px solid var(--border, #dce4e7); border-radius: 11px; background: var(--panel, #fff); padding: 4px; }
.payroll-tabs button { border: 0; border-radius: 8px; background: transparent; color: var(--text-muted, #64747c); padding: 8px 12px; font: inherit; font-weight: 750; cursor: pointer; }
.payroll-tabs button.active { background: #176447; color: white; }
.workspace { display: grid; grid-template-columns: minmax(220px, 270px) minmax(0, 1fr); gap: 16px; align-items: start; }
.run-list, .run-workspace { border: 1px solid var(--border, #dce4e7); border-radius: 15px; background: var(--panel, #fff); }
.run-list { display: grid; gap: 7px; padding: 13px; position: sticky; top: calc(var(--header-h, 56px) + 12px); max-height: calc(100dvh - var(--header-h, 56px) - 70px); overflow-y: auto; }
.panel-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 3px 3px 9px; }
.panel-title > div { display: grid; gap: 2px; }
.run-card { display: flex; align-items: center; justify-content: space-between; gap: 9px; width: 100%; padding: 11px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--text, #152026); text-align: left; cursor: pointer; }
.run-card:hover { background: var(--bg, #f4f7f8); }
.run-card--active { border-color: #82bea6; background: rgba(35, 122, 91, .09); }
.run-card > span:first-child { display: grid; min-width: 0; }
.run-card small { overflow: hidden; color: var(--text-muted, #64747c); text-overflow: ellipsis; text-transform: capitalize; }
.run-workspace { min-height: 540px; padding: 18px; overflow: hidden; }
.empty-state { min-height: 460px; display: grid; place-content: center; justify-items: center; text-align: center; color: var(--text-muted, #64747c); }
.empty-state h2 { margin: 10px 0 4px; color: var(--text, #152026); }
.empty-state p { max-width: 520px; }
.empty-icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: #e8f6ef; color: #176447; font-size: 1.5rem; font-weight: 800; }
.empty-small { padding: 18px 9px; color: var(--text-muted, #64747c); font-size: .85rem; text-align: center; }
.run-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.run-header h2 { font-size: 1.55rem; text-transform: capitalize; }
.status { display: inline-flex; align-items: center; width: fit-content; padding: 4px 7px; border-radius: 99px; background: #edf1f2; color: #5f6f76; font-size: .67rem; font-weight: 850; line-height: 1; white-space: nowrap; }
.status--large { padding: 7px 10px; font-size: .72rem; }
.status--calculated, .status--validated { background: #e8f1fb; color: #245f9a; }
.status--ready-for-export { background: #fff4d4; color: #785b00; }
.status--synced-to-paychex, .status--payroll-completed, .status--documents-imported { background: #e7f7ef; color: #176447; }
.status--closed { background: #e9ecee; color: #36484f; }
.status--revision-required { background: #fff0ef; color: #9b2c25; }
.pipeline { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; margin: 22px 0; padding: 0; list-style: none; }
.pipeline li { position: relative; display: grid; justify-items: center; gap: 6px; color: #87959b; font-weight: 750; text-align: center; }
.pipeline li::before { content: ''; position: absolute; z-index: 0; top: 13px; left: -50%; width: 100%; height: 2px; background: #dde4e7; }
.pipeline li:first-child::before { display: none; }
.pipeline li > span { z-index: 1; display: grid; place-items: center; width: 28px; height: 28px; border: 2px solid #d3dcdf; border-radius: 50%; background: var(--panel, #fff); font-size: .7rem; }
.pipeline li.complete, .pipeline li.current { color: #176447; }
.pipeline li.complete::before, .pipeline li.current::before { background: #64a98c; }
.pipeline li.complete > span { border-color: #176447; background: #176447; color: #fff; }
.pipeline li.current > span { border-color: #176447; box-shadow: 0 0 0 4px rgba(35, 122, 91, .12); }
.metrics { display: grid; grid-template-columns: repeat(5, minmax(100px, 1fr)); gap: 9px; }
.metrics article { display: grid; gap: 4px; padding: 13px; border: 1px solid var(--border, #dce4e7); border-radius: 10px; background: var(--bg, #f7f9fa); }
.metrics span { color: var(--text-muted, #64747c); font-size: .74rem; font-weight: 700; }
.metrics strong { font-size: 1.3rem; }
.metrics .metric--danger { border-color: #e8b9b5; background: #fff2f1; color: #9b2c25; }
.action-bar { display: flex; justify-content: space-between; gap: 14px; margin-top: 14px; padding: 13px; border-radius: 11px; background: var(--bg, #f5f8f8); }
.action-bar > div { display: flex; flex-wrap: wrap; gap: 8px; }
.reconciliation-panel { display: grid; gap: 14px; margin-top: 14px; padding: 16px; border: 1px solid #a8c8df; border-radius: 12px; background: #f5faff; }
.reconciliation-heading { display: flex; align-items: start; justify-content: space-between; gap: 18px; }
.reconciliation-heading h3 { margin: 3px 0 0; font-size: 1.05rem; }
.expected-total { display: grid; justify-items: end; gap: 2px; font-variant-numeric: tabular-nums; }
.expected-total small { color: var(--text-muted, #64747c); }
.expected-total strong { font-size: 1.2rem; }
.reconciliation-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.reconciliation-form label { display: grid; align-content: start; gap: 5px; color: var(--text-muted, #64747c); font-size: .75rem; font-weight: 750; }
.reconciliation-form textarea { width: 100%; min-height: 68px; resize: vertical; padding: 8px 10px; border: 1px solid var(--border, #ccd7db); border-radius: 9px; background: var(--bg, #fff); color: var(--text, #152026); font: inherit; }
.reconciliation-form textarea:focus { outline: 2px solid rgba(35, 122, 91, .25); border-color: #237a5b; }
.field-wide { grid-column: 1 / -1; }
.reconciliation-submit { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.reconciliation-submit p { margin: 0; color: var(--text-muted, #64747c); font-size: .78rem; }
.form-error { grid-column: 1 / -1; margin: 0; color: #9b2c25; font-size: .82rem; font-weight: 750; }
.reconciliation-result { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
.reconciliation-result > div { display: grid; gap: 3px; padding: 10px; border-radius: 8px; background: #fff; }
.reconciliation-result dt { color: var(--text-muted, #64747c); font-size: .7rem; font-weight: 750; text-transform: uppercase; }
.reconciliation-result dd { margin: 0; font-weight: 750; }
.hash-value { overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .72rem; }
.employee-section { margin-top: 17px; border: 1px solid var(--border, #dce4e7); border-radius: 12px; overflow: hidden; }
.employee-title { padding: 13px 14px; }
.search input { width: min(260px, 35vw); }
.table-wrap { overflow-x: auto; border-top: 1px solid var(--border, #dce4e7); }
table { width: 100%; border-collapse: collapse; font-size: .84rem; }
th { padding: 9px 12px; background: var(--bg, #f5f8f8); color: var(--text-muted, #64747c); font-size: .68rem; letter-spacing: .035em; text-align: left; text-transform: uppercase; white-space: nowrap; }
td { padding: 11px 12px; border-top: 1px solid var(--border, #e5eaec); vertical-align: middle; }
tbody tr:first-child td { border-top: 0; }
td:first-child { display: grid; }
td small { color: var(--text-muted, #64747c); }
.money { font-variant-numeric: tabular-nums; white-space: nowrap; }
.check { display: inline-flex; width: fit-content; padding: 4px 7px; border-radius: 6px; font-size: .72rem; font-weight: 750; }
.check--ok { background: #e7f7ef; color: #176447; }
.check--error { background: #fff0ef; color: #9b2c25; }
.check--neutral { background: #edf1f2; color: #5d6c72; }
.empty-table { display: table-cell !important; padding: 32px; color: var(--text-muted, #64747c); text-align: center; }
.drawer-backdrop { position: fixed; z-index: 1200; inset: 0; display: flex; justify-content: flex-end; background: rgba(10, 20, 25, .46); }
.employee-drawer { width: min(540px, 100%); height: 100%; overflow-y: auto; padding: 22px; background: var(--panel, #fff); color: var(--text, #152026); box-shadow: -16px 0 48px rgba(0, 0, 0, .18); }
.employee-drawer > header { display: flex; align-items: start; justify-content: space-between; }
.drawer-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 18px 0; }
.drawer-meta > span { display: grid; gap: 2px; padding: 10px; border-radius: 9px; background: var(--bg, #f5f8f8); font-weight: 750; }
.drawer-meta small { color: var(--text-muted, #64747c); font-size: .68rem; text-transform: uppercase; }
.employee-drawer section { margin-top: 22px; }
.employee-drawer h3 { margin: 0 0 9px; font-size: .9rem; }
.component-list { display: grid; gap: 1px; border: 1px solid var(--border, #dce4e7); border-radius: 10px; overflow: hidden; background: var(--border, #dce4e7); }
.component-list > div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 12px; background: var(--panel, #fff); }
.component-list span { display: grid; }
.component-list small { color: var(--text-muted, #64747c); }
.component-total { background: var(--bg, #f5f8f8) !important; font-size: 1rem; }
.issue-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.issue-list li { display: flex; gap: 9px; padding: 10px; border: 1px solid #e8b9b5; border-radius: 9px; background: #fff5f4; color: #8f2922; }
.issue-list li > span { display: grid; place-items: center; flex: 0 0 23px; height: 23px; border-radius: 50%; background: #9b2c25; color: #fff; font-weight: 900; }
.issue-list div { display: grid; }
.employee-drawer footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border, #dce4e7); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 1000px) {
  .payroll-heading { align-items: stretch; flex-direction: column; }
  .new-run { align-self: start; }
  .workspace { grid-template-columns: 1fr; }
  .run-list { position: static; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); max-height: none; }
  .run-list .panel-title, .run-list .empty-small { grid-column: 1 / -1; }
  .metrics { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 650px) {
  .payroll-page { gap: 10px; }
  .payroll-heading, .run-workspace { padding: 13px; border-radius: 12px; }
  .new-run { width: 100%; align-items: stretch; flex-direction: column; }
  .new-run input, .new-run button { width: 100%; }
  .provider-banner { align-items: flex-start; flex-direction: column; }
  .pipeline { overflow-x: auto; grid-template-columns: repeat(7, minmax(72px, 1fr)); padding: 4px; }
  .metrics { grid-template-columns: repeat(2, 1fr); }
  .action-bar { align-items: stretch; flex-direction: column; }
  .action-bar > div { display: grid; }
  .action-bar .button { width: 100%; }
  .reconciliation-heading, .reconciliation-submit { align-items: stretch; flex-direction: column; }
  .expected-total { justify-items: start; }
  .reconciliation-form, .reconciliation-result { grid-template-columns: 1fr; }
  .reconciliation-submit .button { width: 100%; }
  .employee-title { align-items: stretch; flex-direction: column; }
  .search input { width: 100%; }
  .drawer-meta { grid-template-columns: 1fr; }
}
</style>
