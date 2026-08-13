<template>
  <section class="readiness-workbench">
    <header class="workbench-heading">
      <div>
        <p class="eyebrow">Canonical data · four eyes</p>
        <h2>Payroll-Readiness</h2>
        <p>
          Fehlende Abrechnungsquellen je Mitarbeiter erkennen, als validierten Entwurf erfassen
          und kontrolliert freigeben.
        </p>
      </div>
      <form class="employee-filters" @submit.prevent="loadEmployees">
        <label>
          Abrechnungsmonat
          <input v-model="selectedMonth" type="month" required />
        </label>
        <label>
          Mitarbeiter suchen
          <input v-model.trim="employeeSearch" type="search" placeholder="Name oder Personalnummer" />
        </label>
        <button class="button" type="submit" :disabled="employeeLoading">Aktualisieren</button>
      </form>
    </header>

    <div v-if="error" class="notice notice--error" role="alert">
      <strong>Aktion nicht möglich</strong>
      <span>{{ error }}</span>
      <button type="button" aria-label="Fehlermeldung schließen" @click="error = ''">×</button>
    </div>
    <div v-if="success" class="notice notice--success" role="status">
      <strong>Gespeichert</strong>
      <span>{{ success }}</span>
      <button type="button" aria-label="Erfolgsmeldung schließen" @click="success = ''">×</button>
    </div>

    <div class="readiness-layout">
      <aside class="employee-panel" aria-label="Mitarbeiter im Abrechnungsmonat">
        <div class="panel-title">
          <div>
            <span class="eyebrow">Monatskohorte</span>
            <strong>{{ employees.length }} Mitarbeiter</strong>
          </div>
          <span v-if="employeeLoading" class="mini-loader">lädt …</span>
        </div>

        <div v-if="!employeeLoading && !employees.length" class="empty-small">
          Keine Mitarbeiter für diese Auswahl gefunden.
        </div>
        <button
          v-for="employee in employees"
          :key="employee._id"
          type="button"
          class="employee-row"
          :class="{ 'employee-row--active': employee._id === selectedEmployeeId }"
          @click="selectEmployee(employee._id)"
        >
          <span>
            <strong>{{ employeeName(employee) }}</strong>
            <small>{{ employee.personalnr || 'ohne Personalnummer' }}</small>
          </span>
          <span class="employee-signals">
            <i :class="employee.paychexLinked ? 'signal--ok' : 'signal--error'">
              {{ employee.paychexLinked ? 'Paychex' : 'Paychex fehlt' }}
            </i>
            <i :class="employee.payrollEmployment?.status === 'active' ? 'signal--ok' : 'signal--error'">
              {{ employee.payrollEmployment?.status === 'active' ? `EG ${employee.payrollEmployment?.tariff?.group || '–'}` : 'Vertrag fehlt' }}
            </i>
          </span>
        </button>
      </aside>

      <main class="readiness-main">
        <div v-if="!selectedEmployeeId" class="empty-state">
          <span>✓</span>
          <h3>Mitarbeiter auswählen</h3>
          <p>Die vollständige Prüfung wird nur für den ausgewählten Mitarbeiter geladen.</p>
        </div>
        <div v-else-if="readinessLoading" class="empty-state">
          <span class="spinner">↻</span>
          <h3>Readiness wird geprüft …</h3>
        </div>

        <template v-else>
          <section class="readiness-summary">
            <div>
              <span class="eyebrow">{{ selectedEmployee?.personalnr || 'Personalnummer fehlt' }}</span>
              <h3>{{ employeeName(selectedEmployee) }}</h3>
              <p>{{ formatMonth(selectedMonth) }} · serverseitige Vollständigkeitsprüfung</p>
            </div>
            <span class="readiness-state" :class="readiness?.ready ? 'readiness-state--ready' : 'readiness-state--blocked'">
              {{ readiness?.ready ? 'Payroll-ready' : `${blockingIssues.length} Blocker` }}
            </span>
          </section>

          <section class="source-counts" aria-label="Abrechnungswirksame Quellen">
            <article v-for="source in sourceCards" :key="source.key" :class="{ 'source-card--missing': source.required && source.count === 0 }">
              <span>{{ source.label }}</span>
              <strong>{{ source.count }}</strong>
              <small>{{ source.note }}</small>
            </article>
          </section>

          <section class="validation-panel">
            <div class="panel-title">
              <div>
                <span class="eyebrow">Hard validation</span>
                <strong>Blocker und Hinweise</strong>
              </div>
              <button class="button button--quiet" type="button" :disabled="readinessLoading" @click="loadSelected">
                Neu prüfen
              </button>
            </div>
            <ul v-if="allIssues.length" class="issue-list">
              <li v-for="(issue, index) in allIssues" :key="`${issue.code}-${index}`" :class="{ 'issue--warning': !issue.blocking }">
                <span>{{ issue.blocking ? '!' : 'i' }}</span>
                <div>
                  <strong>{{ issue.code || 'PAYROLL_VALIDATION' }}</strong>
                  <p>{{ issue.message }}</p>
                  <small v-if="issue.fieldPath">Quelle: {{ issue.fieldPath }}</small>
                </div>
              </li>
            </ul>
            <p v-else class="all-clear">Alle aktuell geladenen Eingangsquellen bestehen die Readiness-Prüfung.</p>
          </section>

          <section class="data-workspace">
            <header>
              <div>
                <span class="eyebrow">Expertenerfassung</span>
                <h3>Kanonische Datenquellen</h3>
                <p>Vorlagen enthalten keine Freigabeidentitäten. Der Server setzt Erfasser, Hash und Status.</p>
              </div>
              <label class="resource-picker">
                Datenquelle
                <select :value="selectedResource" @change="changeResource">
                  <option v-for="(definition, key) in resourceDefinitions" :key="key" :value="key">
                    {{ definition.label }}
                  </option>
                </select>
              </label>
            </header>

            <div class="resource-guide">
              <div>
                <strong>{{ activeDefinition.label }}</strong>
                <p>{{ activeDefinition.description }}</p>
              </div>
              <dl>
                <div><dt>Scope</dt><dd>{{ activeDefinition.scope }}</dd></div>
                <div><dt>Pflichtfelder</dt><dd>{{ activeDefinition.required.join(', ') }}</dd></div>
                <div v-if="activeDefinition.enums?.length">
                  <dt>Zulässige Werte</dt>
                  <dd>{{ activeDefinition.enums.map((entry) => `${entry.path}: ${entry.values.join(' | ')}`).join(' · ') }}</dd>
                </div>
              </dl>
            </div>

            <div class="records-editor-grid">
              <section class="records-panel">
                <div class="panel-title">
                  <div>
                    <span class="eyebrow">Aktuelle Datensätze</span>
                    <strong>{{ activeRecords.length }} Einträge</strong>
                  </div>
                  <button class="icon-button" type="button" title="Datenquelle aktualisieren" @click="loadSelected">↻</button>
                </div>
                <div v-if="!activeRecords.length" class="empty-small">
                  Kein aktueller Datensatz in dieser Auswahl.
                </div>
                <article v-for="record in activeRecords" :key="record._id" class="record-card">
                  <header>
                    <div>
                      <strong>{{ recordTitle(record) }}</strong>
                      <small>{{ recordSubtitle(record) }}</small>
                    </div>
                    <span class="record-status" :class="recordStatusClass(record.status)">{{ record.status || '–' }}</span>
                  </header>
                  <code>{{ record._id }}</code>
                  <div class="record-actions">
                    <button
                      v-if="selectedResource === 'absences' && record.status === 'DRAFT'"
                      class="button"
                      type="button"
                      :disabled="Boolean(action)"
                      @click="submitAbsence(record)"
                    >
                      Einreichen
                    </button>
                    <button
                      v-if="canApprove(record)"
                      class="button button--approve"
                      type="button"
                      :disabled="Boolean(action)"
                      @click="beginApproval(record)"
                    >
                      Vier-Augen-Freigabe
                    </button>
                    <button
                      v-if="activeDefinition.revisable && record.isCurrent !== false"
                      class="button button--quiet"
                      type="button"
                      :disabled="Boolean(action)"
                      @click="beginRevision(record)"
                    >
                      Revision anlegen
                    </button>
                  </div>
                </article>
                <p class="workflow-note">
                  Eine generische Ablehnung kanonischer Datensätze ist im API-Vertrag nicht vorgesehen.
                  Fehler werden als evidenzbasierte Revision korrigiert; Ist-Zeiten können separat abgelehnt werden.
                </p>
              </section>

              <section class="editor-panel">
                <div class="panel-title">
                  <div>
                    <span class="eyebrow">{{ editorMode === 'revise' ? 'Immutable revision' : 'Validated draft' }}</span>
                    <strong>{{ editorMode === 'revise' ? `Revision von ${editingRecordId}` : `${activeDefinition.label} erfassen` }}</strong>
                  </div>
                  <div class="editor-tools">
                    <button
                      v-if="selectedResource === 'reference-months'"
                      class="button button--quiet"
                      type="button"
                      :disabled="Boolean(action)"
                      @click="loadReferencePreview"
                    >
                      Quellsnapshot laden
                    </button>
                    <button class="button button--quiet" type="button" @click="formatEditor">Formatieren</button>
                    <button class="button button--quiet" type="button" @click="resetEditor()">Vorlage laden</button>
                  </div>
                </div>

                <label class="json-editor-label">
                  JSON-Payload
                  <textarea
                    v-model="editorText"
                    rows="28"
                    spellcheck="false"
                    aria-describedby="editor-validation"
                    @input="editorTouched = true"
                  />
                </label>

                <div id="editor-validation" class="editor-validation" :class="editorErrors.length ? 'editor-validation--error' : 'editor-validation--ok'">
                  <strong>{{ editorErrors.length ? `${editorErrors.length} Schemafehler` : 'Client-Schema vollständig' }}</strong>
                  <ul v-if="editorErrors.length">
                    <li v-for="entry in editorErrors" :key="entry">{{ entry }}</li>
                  </ul>
                  <span v-else>Beim Speichern folgen serverseitige Fach-, Referenz- und Mongoose-Prüfungen.</span>
                </div>

                <div class="editor-actions">
                  <button v-if="editorMode === 'revise'" class="button" type="button" :disabled="Boolean(action)" @click="resetEditor()">
                    Revision abbrechen
                  </button>
                  <button
                    class="button button--primary"
                    type="button"
                    :disabled="Boolean(action) || editorErrors.length > 0"
                    @click="saveEditor"
                  >
                    {{ action === 'save' ? 'Wird validiert …' : editorMode === 'revise' ? 'Neue Revision speichern' : 'Entwurf validieren & speichern' }}
                  </button>
                </div>
              </section>
            </div>
          </section>
        </template>
      </main>
    </div>

    <div v-if="approvalTarget" class="modal-backdrop" @click.self="approvalTarget = null">
      <form class="approval-dialog" @submit.prevent="approveRecord">
        <header>
          <div>
            <span class="eyebrow">Vier-Augen-Prinzip</span>
            <h3>{{ activeDefinition.label }} freigeben</h3>
          </div>
          <button class="icon-button" type="button" aria-label="Dialog schließen" @click="approvalTarget = null">×</button>
        </header>
        <p>
          Der Server lehnt die Freigabe ab, wenn der angemeldete Benutzer den Entwurf selbst erfasst
          oder eingereicht hat.
        </p>
        <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>
        <template v-if="['tariffs', 'reference-months'].includes(selectedResource)">
          <label>Fachlicher Freigabegrund<textarea v-model.trim="approval.reason" rows="3" required /></label>
          <template v-if="selectedResource === 'tariffs'">
            <label>Evidenzverweise, eine Zeile je Verweis<textarea v-model.trim="approval.evidenceRefs" rows="3" required /></label>
            <label>Evidenz-Hash<input v-model.trim="approval.evidenceHash" type="text" required placeholder="SHA-256" /></label>
          </template>
        </template>
        <div v-else class="approval-facts">
          <span>Datensatz <code>{{ approvalTarget._id }}</code></span>
          <span>Aktueller Status: {{ approvalTarget.status }}</span>
        </div>
        <footer>
          <button class="button" type="button" :disabled="Boolean(action)" @click="approvalTarget = null">Abbrechen</button>
          <button class="button button--approve" type="submit" :disabled="Boolean(action) || !approvalComplete">
            {{ action === 'approve' ? 'Freigabe wird geprüft …' : 'Verbindlich freigeben' }}
          </button>
        </footer>
      </form>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import api from '@/utils/api';

const props = defineProps({
  month: { type: String, default: '' },
});

const FEDERAL_STATES = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
const OPERATIONAL_SECTORS = ['GASTRONOMY', 'HOSPITALITY', 'EVENTS', 'CATERING', 'EVENT_CATERING', 'OTHER_VERIFIED'];
const OBJECT_ID = /^[a-f\d]{24}$/i;

const selectedMonth = ref(props.month || new Date().toISOString().slice(0, 7));
const employeeSearch = ref('');
const employees = ref([]);
const employeeLoading = ref(false);
const selectedEmployeeId = ref('');
const readiness = ref(null);
const readinessLoading = ref(false);
const records = ref({});
const selectedResource = ref('employments');
const editorText = ref('');
const editorMode = ref('create');
const editingRecordId = ref('');
const editorTouched = ref(false);
const action = ref('');
const error = ref('');
const success = ref('');
const approvalTarget = ref(null);
const approval = ref({ reason: '', evidenceRefs: '', evidenceHash: '' });
let employeeRequest = 0;
let readinessRequest = 0;

const startOfMonth = (month) => `${month}-01`;
const endOfMonth = (month) => {
  const [year, value] = String(month).split('-').map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
};
const priorMonthStart = (month, offset) => {
  const [year, value] = String(month).split('-').map(Number);
  return new Date(Date.UTC(year, value - 1 - offset, 1)).toISOString().slice(0, 10);
};
const placeholder = (label) => `<${label}>`;
const idOf = (value) => value?._id || value || '';
const decimal = (value) => Number(value?.$numberDecimal ?? value ?? 0);

function tariffRateSet(month) {
  if (month < '2026-09') return { validFrom: '2026-01-01', id: 'GVP_2026_01', version: 1, rates: { '2A': [1529, 1552, 1575], '2B': [1569, 1593, 1616], 3: [1669, 1694, 1719] } };
  if (month < '2027-04') return { validFrom: '2026-09-01', id: 'GVP_2026_09', version: 2, rates: { '2A': [1567, 1591, 1614], '2B': [1608, 1632, 1656], 3: [1711, 1737, 1762] } };
  return { validFrom: '2027-04-01', id: 'GVP_2027_04', version: 3, rates: { '2A': [1622, 1646, 1671], '2B': [1664, 1689, 1714], 3: [1771, 1798, 1824] } };
}

function templateContext() {
  const input = readiness.value?.input || {};
  const employeeRecord = selectedEmployee.value || {};
  const employment = input.employment || records.value.employments?.[0];
  const assignment = input.assignments?.[0] || records.value.assignments?.[0];
  const customerRule = input.customerRules?.[0] || records.value['customer-rules']?.[0];
  const tariff = idOf(employment?.tariff?.ruleVersion)
    || idOf(records.value.tariffs?.find((entry) => entry.status === 'APPROVED'))
    || idOf(records.value.tariffs?.[0]);
  return {
    month: selectedMonth.value,
    monthStart: startOfMonth(selectedMonth.value),
    monthEnd: endOfMonth(selectedMonth.value),
    referenceFrom: priorMonthStart(selectedMonth.value, 3),
    referenceTill: endOfMonth(priorMonthStart(selectedMonth.value, 1).slice(0, 7)),
    employee: selectedEmployeeId.value || placeholder('MITARBEITER_OBJECT_ID'),
    personalNr: employeeRecord.personalnr || placeholder('PERSONALNUMMER'),
    firstName: employeeRecord.vorname || placeholder('VORNAME'),
    lastName: employeeRecord.nachname || employeeRecord.name || placeholder('NACHNAME'),
    employment: idOf(employment) || placeholder('PAYROLL_EMPLOYMENT_OBJECT_ID'),
    employmentFrom: employment?.validFrom ? new Date(employment.validFrom).toISOString().slice(0, 10) : startOfMonth(selectedMonth.value),
    employmentTill: employment?.validTill ? new Date(employment.validTill).toISOString().slice(0, 10) : null,
    assignment: idOf(assignment) || placeholder('ASSIGNMENT_LEDGER_OBJECT_ID'),
    customer: idOf(assignment?.kunde) || placeholder('KUNDE_OBJECT_ID'),
    order: idOf(assignment?.auftrag) || placeholder('AUFTRAG_OBJECT_ID'),
    customerRule: idOf(customerRule) || placeholder('CUSTOMER_PAYROLL_RULE_OBJECT_ID'),
    siteKey: customerRule?.siteKey || 'hamburg-event-location-…',
    tariff: tariff || placeholder('APPROVED_TARIFF_VERSION_OBJECT_ID'),
  };
}

const resourceDefinitions = {
  employments: {
    label: 'Beschäftigung & Tarifbindung',
    scope: 'Mitarbeiter · effective-dated',
    description: 'Vertragliche Sollzeit, Entgeltgruppe, GVP-Übergang und signierte Tarif-Einbeziehung.',
    required: ['mitarbeiter', 'validFrom', 'employmentType', 'weeklyHours', 'monthlyTargetHours', 'workingDaysPerWeek', 'tariff.group', 'tariff.ruleVersion', 'tariff.transitionRule', 'experiencePolicy.policy.policyId', 'experiencePolicy.evidenceHash', 'contractEvidence.contractDocumentId', 'contractEvidence.signatureHash', 'contractEvidence.evidenceHash'],
    objectIds: ['mitarbeiter', 'tariff.ruleVersion'],
    enums: [
      { path: 'employmentType', values: ['regular', 'minijob', 'short_term', 'student'] },
      { path: 'tariff.system', values: ['GVP', 'BAP', 'IGZ', 'OTHER'] },
      { path: 'tariff.group', values: ['1', '2A', '2B', '3', '4', '5', '6', '7', '8', '9'] },
      { path: 'tariff.transitionRule', values: ['standard', 'legacy_igz', 'legacy_bap', 'custom'] },
    ],
    revisable: true,
    template: (ctx) => ({
      mitarbeiter: ctx.employee,
      validFrom: ctx.monthStart,
      validTill: null,
      employmentType: 'regular',
      contractNumber: 'AUEV-2026-…',
      weeklyHours: 35,
      monthlyTargetHours: 151.67,
      workingDaysPerWeek: 5,
      tariff: { system: 'GVP', group: '2A', ruleVersion: ctx.tariff, transitionRule: 'standard' },
      overtimeModel: 'fixed_115_percent',
      experiencePolicy: {
        policy: {
          policyId: 'GVP_ERFAHRUNGSZUSCHLAG_V1_REVIEWED',
          mode: 'GVP_STANDARD',
          generalTier: null,
          sameCustomerTiers: [
            { afterMonths: 9, tier: 'P1_5' },
            { afterMonths: 12, tier: 'P3_0' },
          ],
          interruptionMonths: 3,
        },
        evidenceRefs: ['document:gvp-experience-interpretation'],
        evidenceHash: placeholder('SHA256_EXPERIENCE_POLICY'),
      },
      periodTargetOverrides: [],
      source: 'monitor',
      sourceRef: 'contract:AUEV-2026-…',
      contractEvidence: {
        contractDocumentId: 'document:AUEV-2026-…',
        collectiveAgreementIncorporated: true,
        collectiveAgreementCode: 'GVP_2026',
        declarationSignedAt: ctx.monthStart,
        declarationSigner: 'Vorname Nachname',
        evidenceRefs: ['document:AUEV-2026-…'],
        signatureHash: placeholder('SHA256_CONTRACT_SIGNATURE'),
        evidenceHash: placeholder('SHA256_CONTRACT_EVIDENCE'),
      },
      changeReason: 'Erstaufnahme aus geprüftem Arbeitsvertrag',
    }),
  },
  'provider-profiles': {
    label: 'Paychex-Mitarbeiterprofil',
    scope: 'Mitarbeiter + Beschäftigung · effective-dated',
    description: 'Vier-Augen-geprüfte Public-API-v1.3-Stammdaten. Steuer, SV, Krankenkasse und Bank bleiben providergeführt und müssen mit Paychex-Evidenz vollständig bestätigt sein.',
    required: [
      'mitarbeiter', 'employment', 'employeePayload.firstName', 'employeePayload.surname',
      'employeePayload.birthCountry', 'employeePayload.gender', 'employeePayload.nationality',
      'employeePayload.graduation', 'employeePayload.professionalQualification',
      'contractPayload.personalNumber', 'contractPayload.startDate', 'contractPayload.employingCompany',
      'contractPayload.employedEastOrWest', 'contractPayload.employmentType',
      'contractPayload.limitedEmployment', 'contractPayload.paymentReductionType',
      'providerOwnedStatutoryData.status', 'providerOwnedStatutoryData.verifiedInPaychexAt',
      'providerOwnedStatutoryData.paychexEvidenceReference', 'providerOwnedStatutoryData.evidenceRefs',
      'providerOwnedStatutoryData.evidenceHash', 'providerReferenceDataHash', 'changeReason',
      'evidenceRefs', 'evidenceHash',
    ],
    objectIds: ['mitarbeiter', 'employment'],
    enums: [
      { path: 'providerOwnedStatutoryData.status', values: ['COMPLETE_IN_PAYCHEX'] },
    ],
    revisable: true,
    template: (ctx) => ({
      mitarbeiter: ctx.employee,
      employment: ctx.employment,
      employeePayload: {
        formOfAddress: null,
        firstName: ctx.firstName,
        surname: ctx.lastName,
        title: null,
        surnamePrefix: null,
        surnameSuffix: null,
        birthSurname: null,
        birthSurnamePrefix: null,
        birthSurnameSuffix: null,
        birthDate: null,
        birthCountry: 'DE',
        birthCity: null,
        gender: placeholder('PAYCHEX_GENDER_VALUE'),
        nationality: 'DE',
        graduation: placeholder('PAYCHEX_GRADUATION_VALUE'),
        professionalQualification: placeholder('PAYCHEX_PROFESSIONAL_QUALIFICATION_VALUE'),
      },
      contractPayload: {
        jobDescription: 'Servicekraft Veranstaltung / Catering',
        personalNumber: ctx.personalNr,
        startDate: ctx.employmentFrom,
        endDate: ctx.employmentTill,
        reasonForLeaving: null,
        terminationDate: null,
        employingCompany: placeholder('PAYCHEX_EMPLOYING_COMPANY_VALUE'),
        employedEastOrWest: placeholder('PAYCHEX_EAST_WEST_VALUE'),
        performedOccupation: null,
        employmentType: placeholder('PAYCHEX_EMPLOYMENT_TYPE_VALUE'),
        limitedEmployment: placeholder('PAYCHEX_LIMITED_EMPLOYMENT_VALUE'),
        paymentReductionType: placeholder('PAYCHEX_PAYMENT_REDUCTION_VALUE'),
      },
      providerOwnedStatutoryData: {
        status: 'COMPLETE_IN_PAYCHEX',
        includesTaxData: true,
        includesSocialInsuranceData: true,
        includesBankData: true,
        includesHealthInsuranceData: true,
        verifiedInPaychexAt: `${ctx.monthStart}T12:00:00.000Z`,
        paychexEvidenceReference: 'paychex-review:…',
        evidenceRefs: ['document:paychex-statutory-master-data-review'],
        evidenceHash: placeholder('SHA256_PAYCHEX_STATUTORY_EVIDENCE'),
      },
      providerReferenceDataHash: placeholder('SHA256_PAYCHEX_REFERENCE_DATA'),
      changeReason: 'Geprüfter Paychex-v1.3-Stammdatenabgleich',
      evidenceRefs: ['document:paychex-provider-profile-review'],
      evidenceHash: placeholder('SHA256_PAYCHEX_PROFILE_EVIDENCE'),
    }),
  },
  'reference-months': {
    label: 'GVP-Referenzmonat',
    scope: 'Mitarbeiter + abgerechneter Kalendermonat',
    description: 'Einzeln geprüfter und hashgebundener Quellmonat für Urlaub/Krankheit. Die Vorschau leitet Cent-, Minuten- und Tageskandidaten ausschließlich aus einem abgeschlossenen StraightMonitor-Snapshot ab.',
    required: [
      'mitarbeiterId', 'period', 'normalized.eligibleBaseEarningsCents',
      'normalized.eligibleSupplementEarningsCents', 'normalized.eligibleActualMinutes',
      'normalized.eligibleReferenceDays', 'mehrarbeitPremiumExcluded',
      'normalizationPolicyId', 'normalizationClause', 'evidenceRefs', 'evidenceHash',
    ],
    objectIds: ['mitarbeiterId'],
    enums: [],
    revisable: false,
    template: (ctx) => ({
      mitarbeiterId: ctx.employee,
      period: priorMonthStart(ctx.month, 1).slice(0, 7),
      normalized: {
        eligibleBaseEarningsCents: 0,
        eligibleSupplementEarningsCents: 0,
        eligibleActualMinutes: 0,
        eligibleReferenceDays: 0,
      },
      exclusions: [],
      mehrarbeitPremiumExcluded: true,
      normalizationPolicyId: 'GVP_REFERENCE_NORMALIZATION_V1_REVIEWED',
      normalizationClause: 'GVP Manteltarifvertrag: Urlaub/Krankheit aus den drei abgerechneten Vormonaten; Mehrarbeitszuschlag ausgeschlossen.',
      evidenceRefs: ['document:reference-month-review'],
      evidenceHash: placeholder('SHA256_REFERENCE_MONTH_EVIDENCE'),
    }),
  },
  'customer-rules': {
    label: 'Kunden-/Standortregel',
    scope: 'Kunde + Standort · effective-dated',
    description: 'Operativer Sektor, Feiertagsort, explizites Branchenzuschlag-NONE, Kundenprämien und Equal-Pay-Vergleich.',
    required: ['kunde', 'validFrom', 'siteKey', 'siteDeclaration.siteName', 'siteDeclaration.federalState', 'siteDeclaration.signatureHash', 'siteDeclaration.evidenceHash', 'holidayCalendar.calendarId', 'holidayCalendar.evidenceHash', 'industryCode', 'industrySurchargeTariffCode', 'equalPay.status', 'premiumOverrides.decision', 'holidayFederalState'],
    objectIds: ['kunde'],
    enums: [
      { path: 'industryCode', values: OPERATIONAL_SECTORS },
      { path: 'premiumOverrides.decision', values: ['NONE', 'CUSTOMER_RULES'] },
      { path: 'holidayFederalState', values: FEDERAL_STATES },
      { path: 'equalPay.status', values: ['not_applicable', 'pending', 'verified', 'expired'] },
    ],
    revisable: true,
    template: (ctx) => ({
      kunde: ctx.customer,
      validFrom: ctx.monthStart,
      validTill: null,
      siteKey: 'hamburg-event-location-…',
      siteDeclaration: {
        siteName: 'Veranstaltungsort / Betrieb', street: 'Straße', houseNumber: '1', postalCode: '20095', city: 'Hamburg', federalState: 'HH',
        declaredByName: 'Vorname Nachname', declaredByRole: 'Vertretungsberechtigte Person', declaredAt: ctx.monthStart,
        evidenceRefs: ['document:signed-site-declaration'],
        signatureHash: placeholder('SHA256_SITE_SIGNATURE'), evidenceHash: placeholder('SHA256_SITE_DECLARATION'),
      },
      holidayCalendar: {
        calendarId: `DE-HH-${ctx.month.slice(0, 4)}`, dates: [], source: 'Amtlicher Feiertagskalender Hamburg',
        sourceVersion: ctx.month.slice(0, 4), evidenceHash: placeholder('SHA256_HOLIDAY_CALENDAR'),
      },
      industryCode: 'EVENT_CATERING',
      industrySurchargeTariffCode: 'NONE',
      industrySurchargeRuleVersion: null,
      equalPay: {
        status: 'verified', comparisonHourlyRateCents: 1700, comparisonMonthlyAmountCents: null,
        regularComponents: [], comparisonGroup: 'Vergleichbare Stammkraft Service',
        source: 'Unterzeichnete Kunden-Auskunft zum Vergleichsentgelt', evidenceIds: ['document:equal-pay-comparator'],
        declarationSigner: 'Vorname Nachname', declarationSignedAt: ctx.monthStart,
        signatureHash: placeholder('SHA256_EQUAL_PAY_SIGNATURE'), evidenceHash: placeholder('SHA256_EQUAL_PAY_EVIDENCE'),
        expiresAt: `${Number(ctx.month.slice(0, 4)) + 1}-${ctx.month.slice(5)}-01`, notes: 'Bei Vergütungsänderung vorzeitig erneuern.',
      },
      premiumOverrides: {
        decision: 'NONE', nightBasisPoints: 0, sundayBasisPoints: 0, holidayBasisPoints: 0,
        nightWindowStart: null, nightWindowEnd: null, overlapPolicy: 'highest_only', source: 'Unterzeichnete Standort-Erklärung',
      },
      holidayFederalState: 'HH',
      source: 'customer_confirmation', sourceRef: 'document:signed-site-declaration',
      changeReason: 'Erstaufnahme der unterschriebenen Standort- und Vergütungserklärung',
    }),
  },
  assignments: {
    label: 'Einsatz & Kontinuität',
    scope: 'Mitarbeiter + Kunde + Auftrag',
    description: 'Tatsächliche Tätigkeit, EG-Entscheidung und vollständige Einsatzhistorie – auch bei anderen Verleihern.',
    required: ['mitarbeiter', 'kunde', 'auftrag', 'customerPayrollRule', 'siteKey', 'employeeTariffDecision.declaredActivity', 'employeeTariffDecision.entgeltgruppe', 'employeeTariffDecision.signatureHash', 'employeeTariffDecision.evidenceHash', 'assignmentFrom', 'continuityKey', 'continuityEvidence.historyCompleteness', 'continuityEvidence.signatureHash', 'continuityEvidence.evidenceHash'],
    objectIds: ['mitarbeiter', 'kunde', 'auftrag', 'customerPayrollRule'],
    enums: [
      { path: 'employeeTariffDecision.entgeltgruppe', values: ['1', '2A', '2B', '3', '4', '5', '6', '7', '8', '9'] },
      { path: 'continuityEvidence.historyCompleteness', values: ['EMPLOYEE_DECLARED_COMPLETE', 'PROVIDER_VERIFIED_COMPLETE'] },
    ],
    revisable: true,
    template: (ctx) => ({
      mitarbeiter: ctx.employee, kunde: ctx.customer, auftrag: ctx.order, einsatz: null,
      customerPayrollRule: ctx.customerRule,
      siteKey: ctx.siteKey,
      activityCode: 'EVENT_SERVICE', activityLabel: 'Servicekraft Veranstaltung / Catering',
      employeeTariffDecision: {
        declaredActivity: 'Service, Gästebetreuung und Veranstaltungslogistik nach konkretem Einsatzprofil',
        entgeltgruppe: '2A', decisionReason: 'Bewertung anhand der tatsächlich geschuldeten Tätigkeit und GVP-Eingruppierungsmerkmale',
        evidenceRefs: ['document:signed-activity-declaration'], declaredBy: 'Disposition / Kunde', declaredAt: ctx.monthStart,
        signatureHash: placeholder('SHA256_ACTIVITY_SIGNATURE'), evidenceHash: placeholder('SHA256_ACTIVITY_EVIDENCE'),
      },
      professionCode: 'EVENT_SERVICE', qualificationCode: 'INSTRUCTED',
      workLocation: { name: 'Veranstaltungsort', postalCode: '20095', city: 'Hamburg', federalState: 'HH', timeZone: 'Europe/Berlin' },
      assignmentFrom: ctx.monthStart, assignmentTill: null, plannedStart: null, plannedEnd: null,
      plannedBreakHours: null, guaranteedHours: 0, payrollEligible: true,
      continuityKey: `customer:${ctx.customer}:employee:${ctx.employee}`,
      continuityEvidence: {
        historyCompleteness: 'EMPLOYEE_DECLARED_COMPLETE', priorAssignments: [],
        declarationSource: 'Unterzeichnete Mitarbeiter- und Provider-Erklärung', declaredBy: 'Vorname Nachname', declaredAt: ctx.monthStart,
        evidenceRefs: ['document:assignment-history-declaration'],
        signatureHash: placeholder('SHA256_CONTINUITY_SIGNATURE'), evidenceHash: placeholder('SHA256_CONTINUITY_EVIDENCE'),
      },
      countsTowardIndustryTenure: true, countsTowardEqualPay: true,
      interruption: { type: 'none', from: null, till: null, resetsIndustryTenure: false, resetsEqualPayTenure: false, reason: null },
      source: 'monitor', sourceRef: 'assignment:…', sourceUpdatedAt: `${ctx.monthStart}T00:00:00.000Z`,
      changeReason: 'Erstaufnahme aus unterzeichneter Einsatz- und Tätigkeitserklärung',
    }),
  },
  absences: {
    label: 'Abwesenheit',
    scope: 'Mitarbeiter + Beschäftigung + Zeitraum',
    description: 'Urlaub, Krankheit und weitere Abwesenheiten mit geprüfter Entgeltbehandlung und Paychex-Mapping.',
    required: ['mitarbeiter', 'employment', 'absenceType', 'dateFrom', 'dateTill', 'unit', 'quantity', 'payrollHours', 'azkCreditTreatment', 'payTreatment', 'paychexAbsenceType', 'paychexStatus', 'treatmentEvidence.decisionSource', 'treatmentEvidence.evidenceHash', 'source'],
    objectIds: ['mitarbeiter', 'employment'],
    enums: [
      { path: 'absenceType', values: ['VACATION', 'SICKNESS', 'PUBLIC_HOLIDAY', 'AZK_WITHDRAWAL', 'UNPAID_LEAVE', 'SHORT_TIME', 'SPECIAL_LEAVE', 'OTHER'] },
      { path: 'unit', values: ['HOURS', 'DAYS'] },
      { path: 'payTreatment', values: ['PAID_REFERENCE_AVERAGE', 'PAID_BASE', 'UNPAID'] },
      { path: 'azkCreditTreatment', values: ['CREDIT', 'NO_CREDIT'] },
    ],
    revisable: true,
    template: (ctx) => ({
      mitarbeiter: ctx.employee, employment: ctx.employment, assignmentLedger: null, kunde: null,
      absenceType: 'VACATION', reasonCode: 'VACATION', dateFrom: ctx.monthStart, dateTill: ctx.monthStart,
      timeZone: 'Europe/Berlin', unit: 'DAYS', quantity: 1, payrollHours: 7,
      dayAllocations: [{ date: ctx.monthStart, creditedMinutes: 420, quantityHundredths: 100, amountCents: null }],
      azkCreditTreatment: 'CREDIT',
      payTreatment: 'PAID_REFERENCE_AVERAGE', paychexAbsenceType: 'vacation paid', paychexStatus: 'approved',
      paychexPayloadDetails: { start_date_is_half_day: false, end_date_is_half_day: false },
      treatmentEvidence: {
        decisionSource: 'GVP Drei-Monats-Referenz und genehmigter Urlaubsantrag',
        evidenceRefs: ['document:approved-vacation-request'], evidenceHash: placeholder('SHA256_ABSENCE_TREATMENT'),
      },
      entitlementYear: Number(ctx.month.slice(0, 4)), holidayFederalState: 'HH',
      referencePeriodFrom: ctx.referenceFrom, referencePeriodTill: ctx.referenceTill,
      source: 'office', sourceRef: 'absence:…', evidenceRefs: ['document:approved-vacation-request'],
      changeReason: 'Genehmigte Abwesenheit erfasst',
    }),
  },
  azk: {
    label: 'AZK-Eröffnung / Bewegung',
    scope: 'Mitarbeiter + Beschäftigung + Monat',
    description: 'Expliziter Eröffnungssaldo mit Ausgleichszyklus, Cap und Insolvenzschutzstatus. Korrekturen erfolgen als neue Buchung.',
    required: ['mitarbeiter', 'employment', 'effectiveDate', 'payrollMonth', 'movementType', 'hoursDelta', 'balanceAfterHours', 'policyContext.openingBalanceAsserted', 'policyContext.openingBalanceEvidenceHash', 'policyContext.balancingCycleKey', 'policyContext.capType', 'policyContext.partTimeNumerator', 'policyContext.partTimeDenominator', 'policyContext.applicableCapHours', 'policyContext.insolvencyProtectionStatus', 'policyContext.policyVersion', 'source', 'reason'],
    objectIds: ['mitarbeiter', 'employment'],
    enums: [
      { path: 'movementType', values: ['OPENING_BALANCE', 'NO_CHANGE', 'ACCRUAL', 'WITHDRAWAL', 'EXPIRY', 'CORRECTION', 'REVERSAL'] },
      { path: 'policyContext.capType', values: ['REGULAR', 'SEASONAL', 'PART_TIME_PRORATED'] },
      { path: 'policyContext.insolvencyProtectionStatus', values: ['NOT_REQUIRED', 'REQUIRED_PENDING', 'PROTECTED'] },
    ],
    revisable: false,
    template: (ctx) => ({
      idempotencyKey: `manual-opening:${ctx.employee}:${ctx.month}`,
      mitarbeiter: ctx.employee, employment: ctx.employment, effectiveDate: ctx.monthStart, payrollMonth: ctx.month,
      movementType: 'OPENING_BALANCE', hoursDelta: 0, balanceAfterHours: 0,
      payoutRateCents: null, payoutAmountCents: null, tariffVersion: ctx.tariff,
      policyContext: {
        openingBalanceAsserted: true, openingBalanceEvidenceRefs: ['document:azk-opening-balance'],
        openingBalanceEvidenceHash: placeholder('SHA256_AZK_OPENING'), balancingCycleKey: `GVP-${ctx.month.slice(0, 4)}`,
        balancingCycleFrom: `${ctx.month.slice(0, 4)}-01-01`, balancingCycleTill: `${ctx.month.slice(0, 4)}-12-31`,
        capType: 'REGULAR', applicableCapHours: 200, seasonalApprovalRef: null,
        partTimeNumerator: 1, partTimeDenominator: 1,
        insolvencyProtectionStatus: 'NOT_REQUIRED', insolvencyProtectionEvidenceRefs: [],
        insolvencyProtectionEvidenceHash: null, policyVersion: 'GVP_AZK_V1',
      },
      sourceWorkingTime: null, sourceAbsence: null, reversalOf: null,
      source: 'office', sourceRef: 'azk-opening:…', reason: 'Geprüfter AZK-Eröffnungssaldo für die Payroll-Migration',
    }),
  },
  'azk-dispositions': {
    label: 'AZK-Monatsdisposition',
    scope: 'Mitarbeiter + Beschäftigung + Abrechnungsmonat',
    description: 'Pflichtentscheidung für jeden Monat: ausdrücklich NONE oder evidenzbasierter Auszahlungsgrund. Betrag und Tariflohn berechnet ausschließlich der Payroll Core.',
    required: ['mitarbeiter', 'employment', 'payrollMonth', 'kind', 'reason', 'evidenceRefs', 'evidenceHash', 'source', 'sourceRef'],
    objectIds: ['mitarbeiter', 'employment'],
    enums: [
      { path: 'kind', values: ['NONE', 'EMPLOYEE_OVER_91', 'MONTHLY_AGREEMENT', 'CYCLE_AGREEMENT', 'CYCLE_OVERFLOW', 'TERMINATION'] },
      { path: 'source', values: ['employee_request', 'mutual_agreement', 'cycle_review', 'termination', 'office_confirmation'] },
    ],
    revisable: true,
    template: (ctx) => ({
      mitarbeiter: ctx.employee,
      employment: ctx.employment,
      payrollMonth: ctx.month,
      kind: 'NONE',
      requestedHours: null,
      reconciliationDue: false,
      terminationDate: null,
      reason: 'Für diesen Abrechnungsmonat liegt kein Auszahlungsauftrag vor.',
      evidenceRefs: ['document:monthly-azk-none-confirmation'],
      evidenceHash: placeholder('SHA256_AZK_DISPOSITION_EVIDENCE'),
      source: 'office_confirmation',
      sourceRef: `azk-disposition:${ctx.month}:…`,
    }),
  },
  tariffs: {
    label: 'Tarifversion',
    scope: 'Unternehmensweit · effective-dated',
    description: 'Ausführbare GVP-Regeln. Bevorzugt über den geprüften Seed anlegen; Aktivierung benötigt separate Evidenzfreigabe.',
    required: ['code', 'system', 'version', 'validFrom', 'standardMonthlyHours', 'entgeltgruppen', 'premiumRules', 'overtimeThresholdBasisPoints', 'azkRules.regularMaxPlusHours', 'calculationVersion', 'source.title', 'source.reference', 'source.checksum'],
    objectIds: [],
    enums: [
      { path: 'system', values: ['GVP', 'BAP', 'IGZ', 'OTHER'] },
      { path: 'premiumOverlapPolicy', values: ['HIGHEST_ONLY', 'STACK'] },
    ],
    revisable: false,
    template: (ctx) => {
      const table = tariffRateSet(ctx.month);
      return {
        code: table.id, system: 'GVP', version: table.version,
        previousVersion: null, validFrom: table.validFrom, validTill: null,
        standardMonthlyHours: 151.67, alternativeMonthlyHours: null,
        entgeltgruppen: Object.entries(table.rates).map(([code, rates]) => ({ code, label: `Entgeltgruppe ${code}`, hourlyRateCents: rates[0] })),
        experienceBonusRules: Object.entries(table.rates).flatMap(([code, rates]) => [
          { groupCode: code, afterCompletedMonths: 9, mode: 'FIXED_CENTS', hourlyAmountCents: rates[1] - rates[0] },
          { groupCode: code, afterCompletedMonths: 12, mode: 'FIXED_CENTS', hourlyAmountCents: rates[2] - rates[0] },
        ]),
        industrySurchargeStages: [],
        premiumRules: [
          { premiumType: 'NIGHT', percentBasisPoints: 2500, windowStart: '23:00', windowEnd: '06:00' },
          { premiumType: 'SUNDAY', percentBasisPoints: 5000 },
          { premiumType: 'PUBLIC_HOLIDAY', percentBasisPoints: 10000 },
          { premiumType: 'CHRISTMAS_EVE', percentBasisPoints: 10000, startsAfterLocalTime: '14:00' },
          { premiumType: 'NEW_YEARS_EVE', percentBasisPoints: 10000, startsAfterLocalTime: '14:00' },
          { premiumType: 'OVERTIME', percentBasisPoints: 2500 },
        ],
        premiumOverlapPolicy: 'HIGHEST_ONLY', overtimeThresholdBasisPoints: 11500,
        azkRules: {
          regularMaxPlusHours: 200, seasonalMaxPlusHours: 230, insolvencyProtectionThresholdHours: 150,
          annualCarryoverMaxHours: 150, reconciliationMonths: 12, graceMonths: 3,
        },
        vacationEntitlements: [
          { fromServiceYear: 1, throughServiceYear: 1, daysPerYear: 25 },
          { fromServiceYear: 2, throughServiceYear: 3, daysPerYear: 27 },
          { fromServiceYear: 4, throughServiceYear: null, daysPerYear: 30 },
        ],
        absenceAverageReferenceMonths: 3,
        additionalRules: { operationalSectorIsNotIndustrySurchargeAgreement: true, legalPayrollReviewRequired: true },
        calculationVersion: 'payroll-core-1.2.0',
        source: {
          title: 'DGB/GVP Basistarifwerk 2026', reference: 'Documentation/Payroll/251112_GVP-Basistarifwerk.md',
          publishedAt: '2025-11-12', checksum: placeholder('SHA256_PRIMARY_TARIFF_SOURCE'),
        },
      };
    },
  },
  adjustments: {
    label: 'Entgeltanpassung',
    scope: 'Mitarbeiter + Monat · immutable',
    description: 'Höherwertige Tätigkeit, Reisezeit, Sonderzahlung oder Korrektur mit Lohnarten-Mapping und Evidenz.',
    required: ['mitarbeiter', 'employment', 'payrollMonth', 'adjustmentType', 'mappingKey', 'unit', 'amountCents', 'evidenceRefs', 'evidenceHash', 'clause', 'ruleVersion', 'reason', 'source'],
    objectIds: ['mitarbeiter', 'employment'],
    enums: [
      { path: 'adjustmentType', values: ['TEMP_HIGHER_GRADE_DIFFERENTIAL', 'TRAVEL_TIME', 'SPECIAL_PAYMENT', 'CORRECTION', 'OTHER'] },
      { path: 'unit', values: ['HOURS', 'DAYS', 'UNITS', 'AMOUNT', 'PERCENT'] },
    ],
    revisable: true,
    template: (ctx) => ({
      mitarbeiter: ctx.employee, employment: ctx.employment, assignmentLedger: null, payrollMonth: ctx.month,
      adjustmentType: 'TRAVEL_TIME', componentType: 'TRAVEL_TIME', mappingKey: 'TRAVEL_TIME',
      quantity: 2, unit: 'HOURS', rateCents: 1669, factor: 1, percentBasisPoints: null, amountCents: 3338,
      evidenceRefs: ['document:approved-travel-time'], evidenceHash: placeholder('SHA256_ADJUSTMENT_EVIDENCE'),
      clause: 'Geprüfte arbeits-/tarifvertragliche Anspruchsgrundlage', ruleVersion: 'TRAVEL_TIME_POLICY_V1',
      reason: 'Freigegebene Reisezeit für den Einsatz', source: 'office', sourceRef: 'adjustment:…',
    }),
  },
};

const selectedEmployee = computed(() => employees.value.find((entry) => entry._id === selectedEmployeeId.value) || readiness.value?.employee || null);
const activeDefinition = computed(() => resourceDefinitions[selectedResource.value]);
const activeRecords = computed(() => records.value[selectedResource.value] || []);
const blockingIssues = computed(() => readiness.value?.validation?.errors || []);
const warningIssues = computed(() => readiness.value?.validation?.warnings || []);
const allIssues = computed(() => [...blockingIssues.value, ...warningIssues.value]);
const approvalComplete = computed(() => {
  if (selectedResource.value === 'reference-months') return Boolean(approval.value.reason);
  if (selectedResource.value !== 'tariffs') return true;
  return Boolean(approval.value.reason && approval.value.evidenceHash
    && approval.value.evidenceRefs.split(/\r?\n/).some((entry) => entry.trim()));
});

const sourceCards = computed(() => {
  const input = readiness.value?.input || {};
  return [
    { key: 'employment', label: 'Beschäftigung', count: input.employment ? 1 : 0, note: 'aktiv & freigegeben', required: true },
    { key: 'providerProfile', label: 'Paychex-Profil', count: input.providerProfile ? 1 : 0, note: 'Stamm & Vertrag', required: true },
    { key: 'tariff', label: 'Tarifversion', count: input.employment?.tariff?.ruleVersion ? 1 : 0, note: 'am Vertrag', required: true },
    { key: 'assignments', label: 'Einsätze', count: input.assignments?.length || 0, note: 'im Monat', required: false },
    { key: 'workingTimes', label: 'Ist-Zeiten', count: input.workingTimes?.length || 0, note: 'freigegeben', required: false },
    { key: 'absences', label: 'Abwesenheiten', count: input.absences?.length || 0, note: 'freigegeben', required: false },
    { key: 'customerRules', label: 'Standortregeln', count: input.customerRules?.length || 0, note: 'aktiv', required: Boolean(input.assignments?.length) },
    { key: 'azk', label: 'AZK-Buchungen', count: input.azk?.length || 0, note: 'inkl. Eröffnung', required: true },
    { key: 'azkDisposition', label: 'AZK-Disposition', count: input.azkDisposition ? 1 : 0, note: 'monatlich & freigegeben', required: true },
    { key: 'adjustments', label: 'Anpassungen', count: input.adjustments?.length || 0, note: 'freigegeben', required: false },
    {
      key: 'averages', label: 'Referenzmonate', count: input.referenceMonths?.length || 0,
      note: '3 geprüft & hashgebunden',
      required: Boolean(input.absences?.some((entry) => (
        ['VACATION', 'SICKNESS'].includes(entry.absenceType)
        && entry.payTreatment === 'PAID_REFERENCE_AVERAGE'
      ))),
    },
  ];
});

function pathValue(object, path) {
  return String(path).split('.').reduce((value, key) => value?.[key], object);
}

function isMissing(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function parseEditor() {
  try {
    const payload = JSON.parse(editorText.value);
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('Payload muss ein JSON-Objekt sein.');
    return { payload, error: null };
  } catch (caught) {
    return { payload: null, error: caught.message };
  }
}

const editorErrors = computed(() => {
  const parsed = parseEditor();
  if (parsed.error) return [`Ungültiges JSON: ${parsed.error}`];
  const payload = parsed.payload;
  const definition = activeDefinition.value;
  const issues = [];
  for (const path of definition.required) {
    if (isMissing(pathValue(payload, path))) issues.push(`Pflichtfeld fehlt: ${path}`);
  }
  for (const rule of definition.enums || []) {
    const value = pathValue(payload, rule.path);
    if (!isMissing(value) && !rule.values.includes(String(value))) issues.push(`${rule.path}: ${value} ist nicht zulässig.`);
  }
  for (const path of definition.objectIds || []) {
    const value = idOf(pathValue(payload, path));
    if (!isMissing(value) && !OBJECT_ID.test(String(value))) issues.push(`${path}: gültige MongoDB ObjectId erforderlich.`);
  }
  if (/<[A-Z0-9_ -]+>/.test(editorText.value)) issues.push('Alle Platzhalter in spitzen Klammern müssen ersetzt werden.');
  if (payload.mitarbeiter && selectedEmployeeId.value && String(idOf(payload.mitarbeiter)) !== selectedEmployeeId.value) {
    issues.push('mitarbeiter stimmt nicht mit dem ausgewählten Mitarbeiter überein.');
  }
  if (selectedResource.value === 'customer-rules' && payload.industrySurchargeTariffCode === 'NONE') {
    const values = ['nightBasisPoints', 'sundayBasisPoints', 'holidayBasisPoints'].map((key) => payload.premiumOverrides?.[key]);
    if (values.some((value) => value !== 0)) issues.push('Branchen-/Prämienentscheidung NONE benötigt für alle Prämien exakt 0 Basispunkte.');
  }
  if (selectedResource.value === 'adjustments' && !Number.isInteger(payload.amountCents)) issues.push('amountCents muss eine ganze Cent-Zahl sein.');
  if (selectedResource.value === 'azk-dispositions') {
    const requestedKinds = ['MONTHLY_AGREEMENT', 'CYCLE_AGREEMENT'];
    if (requestedKinds.includes(payload.kind) && !(Number(payload.requestedHours) > 0)) {
      issues.push(`${payload.kind} benötigt positive requestedHours.`);
    }
    if (!requestedKinds.includes(payload.kind) && payload.kind !== 'EMPLOYEE_OVER_91' && payload.requestedHours != null) {
      issues.push(`${payload.kind} akzeptiert keine manuell eingegebene Auszahlungsmenge.`);
    }
    if (payload.kind === 'EMPLOYEE_OVER_91' && payload.requestedHours != null && !(Number(payload.requestedHours) > 0)) {
      issues.push('EMPLOYEE_OVER_91 akzeptiert nur positive requestedHours oder null für den vollständig verfügbaren Betrag.');
    }
  }
  if (['azk', 'azk-dispositions', 'adjustments'].includes(selectedResource.value) && payload.payrollMonth !== selectedMonth.value) {
    issues.push(`payrollMonth muss dem ausgewählten Monat ${selectedMonth.value} entsprechen.`);
  }
  if (editorMode.value === 'revise') {
    if (!String(payload.changeReason || '').trim()) issues.push('Revision benötigt changeReason.');
    if (!Array.isArray(payload.evidenceRefs) || !payload.evidenceRefs.length) issues.push('Revision benötigt mindestens einen Evidenzverweis.');
    if (selectedResource.value === 'adjustments' && !String(payload.evidenceHash || '').trim()) issues.push('Anpassungsrevision benötigt evidenceHash.');
  }
  return [...new Set(issues)];
});

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value, (key, entry) => (
    entry && typeof entry === 'object' && Object.keys(entry).length === 1 && entry.$numberDecimal !== undefined
      ? Number(entry.$numberDecimal)
      : entry
  )));
}

function normalizeReference(value) {
  if (value && typeof value === 'object' && value._id) return String(value._id);
  return value;
}

function resetEditor(force = false) {
  if (!force && editorTouched.value && !window.confirm('Ungespeicherte Änderungen verwerfen und die Vorlage neu laden?')) return;
  editorMode.value = 'create';
  editingRecordId.value = '';
  editorTouched.value = false;
  editorText.value = JSON.stringify(activeDefinition.value.template(templateContext()), null, 2);
}

function changeResource(event) {
  const nextResource = event.target.value;
  if (editorTouched.value && !window.confirm('Ungespeicherte Änderungen verwerfen und die Datenquelle wechseln?')) {
    event.target.value = selectedResource.value;
    return;
  }
  selectedResource.value = nextResource;
  resetEditor(true);
}

function formatEditor() {
  const parsed = parseEditor();
  if (parsed.error) {
    error.value = `JSON kann nicht formatiert werden: ${parsed.error}`;
    return;
  }
  editorText.value = JSON.stringify(parsed.payload, null, 2);
}

function beginRevision(record) {
  const template = activeDefinition.value.template(templateContext());
  const editable = {};
  for (const key of Object.keys(template)) {
    if (record[key] !== undefined) editable[key] = jsonClone(record[key]);
  }
  for (const refKey of ['mitarbeiter', 'employment', 'assignmentLedger', 'kunde', 'auftrag', 'customerPayrollRule', 'tariffVersion']) {
    if (editable[refKey] !== undefined) editable[refKey] = normalizeReference(editable[refKey]);
  }
  editable.changeReason = 'Dokumentierte Korrektur: …';
  editable.evidenceRefs = [...new Set([...(editable.evidenceRefs || []), 'document:revision-evidence'])];
  if (selectedResource.value === 'adjustments') editable.evidenceHash = placeholder('SHA256_REVISION_EVIDENCE');
  editorMode.value = 'revise';
  editingRecordId.value = record._id;
  editorTouched.value = false;
  editorText.value = JSON.stringify(editable, null, 2);
  document.querySelector('.editor-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const message = (caught) => caught?.response?.data?.message || caught?.message || 'Aktion fehlgeschlagen.';

async function loadEmployees() {
  const request = ++employeeRequest;
  employeeLoading.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/api/payroll/data/employees', {
      params: { month: selectedMonth.value, search: employeeSearch.value, limit: 250 },
    });
    if (request !== employeeRequest) return;
    employees.value = data.employees || [];
    const stillPresent = employees.value.some((entry) => entry._id === selectedEmployeeId.value);
    selectedEmployeeId.value = stillPresent ? selectedEmployeeId.value : employees.value[0]?._id || '';
    if (selectedEmployeeId.value) await loadSelected({ reset: true });
    else { readiness.value = null; records.value = {}; }
  } catch (caught) {
    if (request === employeeRequest) error.value = message(caught);
  } finally {
    if (request === employeeRequest) employeeLoading.value = false;
  }
}

async function selectEmployee(employeeId) {
  if (selectedEmployeeId.value === employeeId && readiness.value) return;
  if (editorTouched.value && !window.confirm('Ungespeicherte Änderungen verwerfen und den Mitarbeiter wechseln?')) return;
  selectedEmployeeId.value = employeeId;
  await loadSelected({ reset: true });
}

async function loadSelected({ reset = false } = {}) {
  if (!selectedEmployeeId.value) return;
  const request = ++readinessRequest;
  readinessLoading.value = true;
  error.value = '';
  try {
    const employeeParams = { mitarbeiter: selectedEmployeeId.value, month: selectedMonth.value, limit: 250 };
    const [readinessResponse, employmentResponse, providerProfileResponse, referenceMonthResponse, assignmentResponse, absenceResponse, azkResponse, azkDispositionResponse, tariffResponse, adjustmentResponse] = await Promise.all([
      api.get(`/api/payroll/data/employees/${selectedEmployeeId.value}/readiness`, { params: { month: selectedMonth.value } }),
      api.get('/api/payroll/data/employments', { params: employeeParams }),
      api.get('/api/payroll/data/provider-profiles', { params: employeeParams }),
      api.get('/api/payroll/reference-months', { params: { mitarbeiterId: selectedEmployeeId.value } }),
      api.get('/api/payroll/data/assignments', { params: employeeParams }),
      api.get('/api/payroll/data/absences', { params: employeeParams }),
      api.get('/api/payroll/data/azk', { params: employeeParams }),
      api.get('/api/payroll/data/azk-dispositions', { params: employeeParams }),
      api.get('/api/payroll/data/tariffs', { params: { limit: 100 } }),
      api.get('/api/payroll/data/adjustments', { params: employeeParams }),
    ]);
    if (request !== readinessRequest) return;
    const assignmentRecords = assignmentResponse.data.records || [];
    const customerIds = [...new Set(assignmentRecords.map((entry) => String(idOf(entry.kunde))).filter(Boolean))];
    const customerResponses = await Promise.all(customerIds.map((kunde) => (
      api.get('/api/payroll/data/customer-rules', { params: { kunde, current: true, limit: 100 } })
    )));
    if (request !== readinessRequest) return;
    readiness.value = readinessResponse.data.readiness || null;
    records.value = {
      employments: employmentResponse.data.records || [],
      'provider-profiles': providerProfileResponse.data.records || [],
      'reference-months': referenceMonthResponse.data.records || [],
      assignments: assignmentRecords,
      absences: absenceResponse.data.records || [],
      azk: azkResponse.data.records || [],
      'azk-dispositions': azkDispositionResponse.data.records || [],
      tariffs: tariffResponse.data.records || [],
      adjustments: adjustmentResponse.data.records || [],
      'customer-rules': customerResponses.flatMap((response) => response.data.records || []),
    };
    if (reset || !editorText.value) resetEditor(true);
  } catch (caught) {
    if (request === readinessRequest) error.value = message(caught);
  } finally {
    if (request === readinessRequest) readinessLoading.value = false;
  }
}

async function saveEditor() {
  if (editorErrors.value.length) return;
  const payload = parseEditor().payload;
  action.value = 'save';
  error.value = '';
  success.value = '';
  try {
    const url = selectedResource.value === 'reference-months'
      ? '/api/payroll/reference-months'
      : editorMode.value === 'revise'
        ? `/api/payroll/data/${selectedResource.value}/${editingRecordId.value}/revise`
        : `/api/payroll/data/${selectedResource.value}`;
    const { data } = await api.post(url, payload);
    const saved = data.record;
    success.value = `${activeDefinition.value.label} wurde als ${editorMode.value === 'revise' ? 'neue Revision' : 'Entwurf'} gespeichert (${saved?._id || 'ID folgt'}).`;
    await loadSelected({ reset: true });
  } catch (caught) {
    error.value = message(caught);
  } finally {
    action.value = '';
  }
}

async function loadReferencePreview() {
  const parsed = parseEditor();
  if (parsed.error) {
    error.value = `JSON kann nicht als Referenzvorschau verwendet werden: ${parsed.error}`;
    return;
  }
  const period = parsed.payload.period;
  if (!/^\d{4}-\d{2}$/.test(period || '')) {
    error.value = 'Für die Referenzvorschau ist ein Quellmonat im Format YYYY-MM erforderlich.';
    return;
  }
  action.value = 'preview';
  error.value = '';
  try {
    const { data } = await api.get('/api/payroll/reference-months/preview', {
      params: { mitarbeiterId: selectedEmployeeId.value, period },
    });
    const candidate = data.preview?.sourceCandidate;
    if (!candidate) throw new Error('Der Server lieferte keinen Referenzkandidaten.');
    editorText.value = JSON.stringify({
      ...parsed.payload,
      mitarbeiterId: selectedEmployeeId.value,
      period,
      normalized: {
        eligibleBaseEarningsCents: candidate.baseEarningsCents,
        eligibleSupplementEarningsCents: candidate.supplementEarningsCents,
        eligibleActualMinutes: candidate.actualMinutes,
        eligibleReferenceDays: candidate.referenceDays,
      },
      mehrarbeitPremiumExcluded: true,
    }, null, 2);
    editorTouched.value = true;
    success.value = `Quellsnapshot ${data.preview.sourceSnapshotId} wurde hashgeprüft vorgeladen. Prüfen Sie Ausschlüsse und Evidenz fachlich.`;
  } catch (caught) {
    error.value = message(caught);
  } finally {
    action.value = '';
  }
}

async function submitAbsence(record) {
  if (!window.confirm('Diese Abwesenheit verbindlich zur Prüfung einreichen? Danach ist für Änderungen eine Revision erforderlich.')) return;
  action.value = 'submit';
  error.value = '';
  try {
    await api.post(`/api/payroll/data/absences/${record._id}/submit`);
    success.value = 'Abwesenheit wurde zur Vier-Augen-Prüfung eingereicht.';
    await loadSelected();
  } catch (caught) {
    error.value = message(caught);
  } finally {
    action.value = '';
  }
}

function canApprove(record) {
  const status = {
    employments: 'draft', 'provider-profiles': 'DRAFT', 'customer-rules': 'draft', assignments: 'DRAFT', absences: 'SUBMITTED',
    azk: 'PENDING', 'azk-dispositions': 'DRAFT', 'reference-months': 'DRAFT', tariffs: 'DRAFT', adjustments: 'DRAFT',
  }[selectedResource.value];
  return record.status === status;
}

function beginApproval(record) {
  approvalTarget.value = record;
  approval.value = { reason: '', evidenceRefs: '', evidenceHash: '' };
}

async function approveRecord() {
  if (!approvalTarget.value || !approvalComplete.value) return;
  action.value = 'approve';
  error.value = '';
  try {
    const payload = selectedResource.value === 'tariffs' ? {
      reason: approval.value.reason,
      evidenceRefs: approval.value.evidenceRefs.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean),
      evidenceHash: approval.value.evidenceHash,
    } : selectedResource.value === 'reference-months'
      ? { approvalReason: approval.value.reason }
      : {};
    const url = selectedResource.value === 'reference-months'
      ? `/api/payroll/reference-months/${approvalTarget.value._id}/approve`
      : `/api/payroll/data/${selectedResource.value}/${approvalTarget.value._id}/approve`;
    await api.post(url, payload);
    approvalTarget.value = null;
    success.value = `${activeDefinition.value.label} wurde im Vier-Augen-Prinzip freigegeben.`;
    await loadSelected();
  } catch (caught) {
    error.value = message(caught);
  } finally {
    action.value = '';
  }
}

function employeeName(employee) {
  return [employee?.vorname, employee?.nachname || employee?.name].filter(Boolean).join(' ') || 'Unbekannter Mitarbeiter';
}

function formatMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return month || '–';
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, value - 1, 1)));
}

function shortDate(value) {
  if (!value) return 'offen';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

function cents(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(value || 0) / 100);
}

function recordTitle(record) {
  if (selectedResource.value === 'employments') return `EG ${record.tariff?.group || '–'} · ${decimal(record.monthlyTargetHours)} Std.`;
  if (selectedResource.value === 'provider-profiles') return `${record.employeePayload?.firstName || ''} ${record.employeePayload?.surname || ''}`.trim() || 'Paychex-Profil';
  if (selectedResource.value === 'reference-months') return `Referenz ${record.period || 'Monat fehlt'}`;
  if (selectedResource.value === 'customer-rules') return record.siteDeclaration?.siteName || record.siteKey || 'Standortregel';
  if (selectedResource.value === 'assignments') return record.activityLabel || record.employeeTariffDecision?.declaredActivity || 'Einsatz';
  if (selectedResource.value === 'absences') return record.absenceType || 'Abwesenheit';
  if (selectedResource.value === 'azk') return `${record.movementType || 'AZK'} · Saldo ${decimal(record.balanceAfterHours)} Std.`;
  if (selectedResource.value === 'azk-dispositions') return `AZK ${record.kind || 'Disposition fehlt'}`;
  if (selectedResource.value === 'tariffs') return record.code || 'Tarifversion';
  if (selectedResource.value === 'adjustments') return `${record.adjustmentType || 'Anpassung'} · ${cents(record.amountCents)}`;
  return record._id;
}

function recordSubtitle(record) {
  if (selectedResource.value === 'employments') return `${shortDate(record.validFrom)} – ${shortDate(record.validTill)} · Version ${record.version || 1}`;
  if (selectedResource.value === 'provider-profiles') return `Paychex ${record.apiVersion || 'v1.3'} · ${record.providerOwnedStatutoryData?.status || 'Stammdaten offen'} · Version ${record.version || 1}`;
  if (selectedResource.value === 'reference-months') return `${cents((record.eligibleBaseEarningsCents || 0) + (record.eligibleSupplementEarningsCents || 0))} · ${record.eligibleActualMinutes || 0} Minuten · Version ${record.version || 1}`;
  if (selectedResource.value === 'customer-rules') return `${record.industryCode || 'Sektor fehlt'} · Branchenzuschlag ${record.industrySurchargeTariffCode ?? 'UNKNOWN'}`;
  if (selectedResource.value === 'assignments') return `${shortDate(record.assignmentFrom)} – ${shortDate(record.assignmentTill)} · EG ${record.employeeTariffDecision?.entgeltgruppe || '–'}`;
  if (selectedResource.value === 'absences') return `${shortDate(record.dateFrom)} – ${shortDate(record.dateTill)} · ${record.payTreatment || 'Behandlung offen'}`;
  if (selectedResource.value === 'azk') return `${record.payrollMonth} · ${decimal(record.hoursDelta)} Std. Bewegung`;
  if (selectedResource.value === 'azk-dispositions') return `${record.payrollMonth} · ${record.requestedHours == null ? 'Menge wird berechnet' : `${decimal(record.requestedHours)} Std.`}`;
  if (selectedResource.value === 'tariffs') return `${shortDate(record.validFrom)} – ${shortDate(record.validTill)} · ${record.system}`;
  if (selectedResource.value === 'adjustments') return `${record.payrollMonth} · ${record.mappingKey || 'Mapping fehlt'} · Version ${record.version || 1}`;
  return '';
}

const recordStatusClass = (status) => `record-status--${String(status || 'unknown').toLowerCase().replaceAll('_', '-')}`;

watch(() => props.month, (value) => {
  if (value && value !== selectedMonth.value) selectedMonth.value = value;
});
watch(selectedMonth, () => loadEmployees());
onMounted(loadEmployees);
</script>

<style scoped>
.readiness-workbench { display: grid; gap: 14px; color: var(--text, #152026); }
.workbench-heading, .readiness-main, .employee-panel { border: 1px solid var(--border, #dce4e7); border-radius: 15px; background: var(--panel, #fff); }
.workbench-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 18px; }
h2, h3, p { margin: 0; }
.workbench-heading h2 { margin: 2px 0 4px; }
.workbench-heading p, .readiness-summary p, .data-workspace > header p, .resource-guide p { color: var(--text-muted, #64747c); }
.eyebrow { display: block; color: #237a5b; font-size: .67rem; font-weight: 850; letter-spacing: .11em; text-transform: uppercase; }
.employee-filters { display: flex; align-items: end; gap: 8px; }
label { display: grid; gap: 5px; color: var(--text-muted, #64747c); font-size: .72rem; font-weight: 750; }
input, select, textarea { box-sizing: border-box; min-height: 38px; border: 1px solid var(--border, #ccd7db); border-radius: 9px; background: var(--bg, #fff); color: var(--text, #152026); padding: 8px 10px; font: inherit; }
input:focus, select:focus, textarea:focus { outline: 2px solid rgba(35, 122, 91, .22); border-color: #237a5b; }
.button { min-height: 38px; border: 1px solid var(--border, #cbd6da); border-radius: 9px; background: var(--panel, #fff); color: var(--text, #152026); padding: 8px 12px; font: inherit; font-weight: 750; cursor: pointer; }
.button:hover:not(:disabled) { border-color: #237a5b; }
.button:disabled { opacity: .48; cursor: not-allowed; }
.button--primary, .button--approve { border-color: #176447; background: #176447; color: #fff; }
.button--quiet { background: transparent; }
.icon-button { width: 34px; height: 34px; border: 0; border-radius: 8px; background: transparent; color: #237a5b; font-size: 1.2rem; cursor: pointer; }
.notice { display: flex; align-items: center; gap: 10px; border-radius: 11px; padding: 12px 14px; }
.notice strong { flex: 0 0 auto; }
.notice span { flex: 1; }
.notice button { border: 0; background: transparent; color: inherit; font-size: 1.2rem; cursor: pointer; }
.notice--error { border: 1px solid #e8b9b5; background: #fff2f1; color: #8f2922; }
.notice--success { border: 1px solid #9ed3bd; background: #ecfaf3; color: #176447; }
.readiness-layout { display: grid; grid-template-columns: minmax(230px, 290px) minmax(0, 1fr); gap: 14px; align-items: start; }
.employee-panel { position: sticky; top: calc(var(--header-h, 56px) + 12px); display: grid; gap: 6px; max-height: calc(100dvh - var(--header-h, 56px) - 70px); overflow-y: auto; padding: 12px; }
.panel-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.panel-title > div { display: grid; gap: 2px; min-width: 0; }
.mini-loader { color: var(--text-muted, #64747c); font-size: .72rem; }
.employee-row { display: grid; gap: 8px; width: 100%; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--text, #152026); padding: 10px; text-align: left; cursor: pointer; }
.employee-row:hover { background: var(--bg, #f5f8f8); }
.employee-row--active { border-color: #82bea6; background: rgba(35, 122, 91, .09); }
.employee-row > span:first-child { display: grid; }
.employee-row small { color: var(--text-muted, #64747c); }
.employee-signals { display: flex; flex-wrap: wrap; gap: 4px; }
.employee-signals i { border-radius: 99px; padding: 3px 6px; font-size: .62rem; font-style: normal; font-weight: 800; }
.signal--ok { background: #e7f7ef; color: #176447; }
.signal--error { background: #fff0ef; color: #9b2c25; }
.readiness-main { min-height: 620px; padding: 17px; overflow: hidden; }
.empty-state { display: grid; min-height: 520px; place-content: center; justify-items: center; gap: 7px; color: var(--text-muted, #64747c); text-align: center; }
.empty-state > span { display: grid; width: 48px; height: 48px; place-items: center; border-radius: 50%; background: #e8f6ef; color: #176447; font-size: 1.3rem; font-weight: 850; }
.spinner { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.readiness-summary { display: flex; align-items: center; justify-content: space-between; gap: 15px; }
.readiness-summary h3 { margin: 2px 0; font-size: 1.35rem; }
.readiness-state { border-radius: 99px; padding: 8px 11px; font-size: .72rem; font-weight: 850; white-space: nowrap; }
.readiness-state--ready { background: #e7f7ef; color: #176447; }
.readiness-state--blocked { background: #fff0ef; color: #9b2c25; }
.source-counts { display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 7px; margin-top: 14px; }
.source-counts article { display: grid; gap: 3px; border: 1px solid var(--border, #dce4e7); border-radius: 9px; background: var(--bg, #f7f9fa); padding: 10px; }
.source-counts span, .source-counts small { color: var(--text-muted, #64747c); font-size: .67rem; }
.source-counts strong { font-size: 1.22rem; }
.source-counts .source-card--missing { border-color: #e8b9b5; background: #fff7f6; color: #9b2c25; }
.validation-panel, .data-workspace { margin-top: 15px; border: 1px solid var(--border, #dce4e7); border-radius: 11px; padding: 13px; }
.issue-list { display: grid; gap: 6px; max-height: 340px; margin: 11px 0 0; padding: 0; overflow-y: auto; list-style: none; }
.issue-list li { display: flex; gap: 9px; border: 1px solid #e8b9b5; border-radius: 9px; background: #fff6f5; color: #8f2922; padding: 9px; }
.issue-list li > span { display: grid; flex: 0 0 22px; height: 22px; place-items: center; border-radius: 50%; background: #9b2c25; color: #fff; font-weight: 900; }
.issue-list li div { display: grid; gap: 2px; }
.issue-list p { font-size: .78rem; }
.issue-list small { opacity: .76; }
.issue-list .issue--warning { border-color: #e5d39b; background: #fff9e8; color: #705716; }
.issue-list .issue--warning > span { background: #8b6a13; }
.all-clear { margin-top: 11px; border-radius: 8px; background: #e7f7ef; color: #176447; padding: 10px; font-size: .8rem; font-weight: 750; }
.data-workspace > header { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
.data-workspace > header h3 { margin: 2px 0; }
.resource-picker { min-width: min(280px, 100%); }
.resource-guide { display: grid; grid-template-columns: minmax(180px, .6fr) minmax(0, 1.4fr); gap: 14px; margin-top: 12px; border-radius: 9px; background: var(--bg, #f5f8f8); padding: 11px; }
.resource-guide > div { display: grid; align-content: start; gap: 3px; }
.resource-guide p { font-size: .77rem; }
.resource-guide dl { display: grid; gap: 5px; margin: 0; }
.resource-guide dl > div { display: grid; grid-template-columns: 95px 1fr; gap: 7px; font-size: .69rem; }
.resource-guide dt { color: var(--text-muted, #64747c); font-weight: 800; }
.resource-guide dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.records-editor-grid { display: grid; grid-template-columns: minmax(240px, .72fr) minmax(360px, 1.28fr); gap: 12px; margin-top: 12px; align-items: start; }
.records-panel, .editor-panel { min-width: 0; border: 1px solid var(--border, #dce4e7); border-radius: 10px; padding: 11px; }
.records-panel { display: grid; gap: 7px; max-height: 760px; overflow-y: auto; }
.record-card { display: grid; gap: 8px; border: 1px solid var(--border, #dce4e7); border-radius: 9px; padding: 10px; }
.record-card header { display: flex; justify-content: space-between; gap: 8px; }
.record-card header > div { display: grid; gap: 2px; min-width: 0; }
.record-card small { color: var(--text-muted, #64747c); }
.record-card code, .approval-facts code { overflow: hidden; color: var(--text-muted, #64747c); font-size: .65rem; text-overflow: ellipsis; }
.record-status { align-self: start; border-radius: 99px; background: #edf1f2; color: #5d6c72; padding: 4px 7px; font-size: .62rem; font-weight: 850; text-transform: uppercase; white-space: nowrap; }
.record-status--active, .record-status--approved, .record-status--confirmed { background: #e7f7ef; color: #176447; }
.record-status--draft, .record-status--pending, .record-status--submitted { background: #fff4d4; color: #785b00; }
.record-status--locked { background: #e8f1fb; color: #245f9a; }
.record-actions { display: flex; flex-wrap: wrap; gap: 5px; }
.record-actions .button { min-height: 32px; padding: 5px 8px; font-size: .7rem; }
.workflow-note { border-radius: 8px; background: #fff9e8; color: #705716; padding: 9px; font-size: .7rem; }
.editor-panel { display: grid; gap: 9px; }
.editor-tools { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
.editor-tools .button { min-height: 32px; padding: 5px 8px; font-size: .7rem; }
.json-editor-label textarea { width: 100%; min-height: 480px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .72rem; line-height: 1.45; tab-size: 2; }
.editor-validation { display: grid; gap: 4px; border-radius: 8px; padding: 9px; font-size: .73rem; }
.editor-validation--error { border: 1px solid #e8b9b5; background: #fff6f5; color: #8f2922; }
.editor-validation--ok { border: 1px solid #9ed3bd; background: #ecfaf3; color: #176447; }
.editor-validation ul { margin: 2px 0 0; padding-left: 18px; }
.editor-actions { display: flex; justify-content: flex-end; gap: 7px; }
.empty-small { padding: 22px 8px; color: var(--text-muted, #64747c); font-size: .8rem; text-align: center; }
.modal-backdrop { position: fixed; z-index: 1300; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(10, 20, 25, .48); }
.approval-dialog { display: grid; gap: 13px; width: min(560px, 100%); max-height: calc(100dvh - 32px); overflow-y: auto; border-radius: 14px; background: var(--panel, #fff); color: var(--text, #152026); padding: 20px; box-shadow: 0 20px 70px rgba(0, 0, 0, .24); }
.approval-dialog header { display: flex; justify-content: space-between; gap: 12px; }
.approval-dialog p { color: var(--text-muted, #64747c); }
.approval-dialog textarea, .approval-dialog input { width: 100%; }
.approval-facts { display: grid; gap: 6px; border-radius: 9px; background: var(--bg, #f5f8f8); padding: 11px; }
.approval-dialog footer { display: flex; justify-content: flex-end; gap: 7px; }

@media (max-width: 1120px) {
  .workbench-heading { align-items: stretch; flex-direction: column; }
  .employee-filters { align-self: start; }
  .readiness-layout { grid-template-columns: 1fr; }
  .employee-panel { position: static; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); max-height: 300px; }
  .employee-panel .panel-title, .employee-panel .empty-small { grid-column: 1 / -1; }
  .records-editor-grid { grid-template-columns: 1fr; }
  .records-panel { max-height: 430px; }
}

@media (max-width: 700px) {
  .workbench-heading, .readiness-main { padding: 12px; border-radius: 11px; }
  .employee-filters { width: 100%; align-items: stretch; flex-direction: column; }
  .employee-filters input, .employee-filters button { width: 100%; }
  .readiness-summary, .data-workspace > header { align-items: stretch; flex-direction: column; }
  .readiness-state { align-self: start; }
  .source-counts { grid-template-columns: repeat(2, 1fr); }
  .resource-guide { grid-template-columns: 1fr; }
  .resource-guide dl > div { grid-template-columns: 1fr; gap: 1px; }
  .records-editor-grid { display: block; }
  .editor-panel { margin-top: 10px; }
  .panel-title { align-items: flex-start; }
  .editor-tools { display: grid; }
  .json-editor-label textarea { min-height: 420px; }
  .editor-actions, .approval-dialog footer { display: grid; }
}
</style>
