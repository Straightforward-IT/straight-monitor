import { defineStore } from 'pinia';
import api from '@/utils/api';

const messageFromError = (error) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || 'Payroll-Aktion fehlgeschlagen.'
);

/**
 * @typedef {Object} PayrollRunScope
 * @property {string[]} [locationIds]
 * @property {string[]} [employeeIds]
 *
 * @typedef {Object} CreatePayrollRunInput
 * @property {string} month
 * @property {string} [companyKey]
 * @property {'REGULAR'|'CORRECTION'|'SHADOW'} [runType]
 * @property {string} [parentRun]
 * @property {string|Date} [inputCutoffAt]
 * @property {PayrollRunScope} [scope]
 */

const normalizedIds = (values) => [...new Set(
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean),
)];

/** @param {CreatePayrollRunInput} input */
const normalizeCreateRunPayload = (input = {}) => {
  if (input.scope?.companyKey) {
    throw new Error('companyKey muss beim Payroll-Lauf auf oberster Ebene angegeben werden.');
  }
  if (input.scope?.teamKeys?.length) {
    throw new Error('Team-basierte Payroll-Scopes werden nicht unterstützt.');
  }
  const scope = {};
  const locationIds = normalizedIds(input.scope?.locationIds);
  const employeeIds = normalizedIds(input.scope?.employeeIds);
  if (locationIds.length) scope.locationIds = locationIds;
  if (employeeIds.length) scope.employeeIds = employeeIds;
  const companyKey = String(input.companyKey || 'straightforward').trim().toLowerCase()
    || 'straightforward';

  const payload = {
    month: input.month,
    companyKey,
    scope,
  };
  if (input.runType) payload.runType = input.runType;
  if (input.parentRun) payload.parentRun = input.parentRun;
  if (input.inputCutoffAt) payload.inputCutoffAt = input.inputCutoffAt;
  return payload;
};

export const usePayroll = defineStore('payroll', {
  state: () => ({
    runs: [],
    selectedRun: null,
    employees: [],
    selectedEmployee: null,
    providerStatus: null,
    loading: false,
    action: null,
    error: '',
  }),

  getters: {
    blockingCount: (state) => state.employees.reduce(
      (count, employee) => count + (employee.validation?.blockingErrors?.length || 0),
      0,
    ),
  },

  actions: {
    clearError() {
      this.error = '';
    },

    async withAction(action, callback) {
      this.action = action;
      this.error = '';
      try {
        return await callback();
      } catch (error) {
        this.error = messageFromError(error);
        throw error;
      } finally {
        this.action = null;
      }
    },

    async fetchRuns() {
      this.loading = true;
      this.error = '';
      try {
        const { data } = await api.get('/api/payroll/runs');
        this.runs = data.runs || data;
        return this.runs;
      } catch (error) {
        this.error = messageFromError(error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    /** @param {CreatePayrollRunInput} input */
    async createRun(input) {
      return this.withAction('create', async () => {
        const payload = normalizeCreateRunPayload(input);
        const { data } = await api.post('/api/payroll/runs', payload);
        const run = data.run || data;
        this.runs = [run, ...this.runs.filter((item) => item._id !== run._id)];
        this.selectedRun = run;
        return run;
      });
    },

    async fetchRun(runId) {
      this.loading = true;
      this.error = '';
      try {
        const [{ data: runData }, { data: employeeData }] = await Promise.all([
          api.get(`/api/payroll/runs/${runId}`),
          api.get(`/api/payroll/runs/${runId}/employees`),
        ]);
        this.selectedRun = runData.run || runData;
        this.employees = employeeData.employees || employeeData.results || employeeData;
        return this.selectedRun;
      } catch (error) {
        this.error = messageFromError(error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchEmployee(runId, mitarbeiterId) {
      const { data } = await api.get(`/api/payroll/runs/${runId}/employees/${mitarbeiterId}`);
      this.selectedEmployee = data.employee || data.result || data;
      return this.selectedEmployee;
    },

    async runAction(runId, actionName, payload = undefined) {
      return this.withAction(actionName, async () => {
        const { data } = await api.post(`/api/payroll/runs/${runId}/${actionName}`, payload);
        await this.fetchRun(runId);
        return data;
      });
    },

    calculate(runId) {
      return this.runAction(runId, 'calculate');
    },

    validate(runId) {
      return this.runAction(runId, 'validate');
    },

    syncPaychex(runId) {
      return this.runAction(runId, 'sync-paychex');
    },

    markPayrollComplete(runId, reconciliation) {
      return this.runAction(runId, 'mark-payroll-complete', reconciliation);
    },

    syncDocuments(runId) {
      return this.runAction(runId, 'sync-documents');
    },

    closeRun(runId) {
      return this.runAction(runId, 'close');
    },

    async recalculateEmployee(runId, mitarbeiterId) {
      return this.withAction(`recalculate:${mitarbeiterId}`, async () => {
        const { data } = await api.post(
          `/api/payroll/runs/${runId}/employees/${mitarbeiterId}/recalculate`,
        );
        await this.fetchRun(runId);
        return data;
      });
    },

    async fetchProviderStatus() {
      const { data } = await api.get('/api/payroll/paychex/configuration-status');
      this.providerStatus = data;
      return data;
    },
  },
});
