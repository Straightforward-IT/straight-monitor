const crypto = require("crypto");
const axios = require("axios");

const payrollConfig = require("./config/payroll");
const logger = require("./utils/logger");

const PAYCHEX_AUTH_MODES = payrollConfig.PAYCHEX_AUTH_MODES;

const PAYCHEX_ERROR_CODES = Object.freeze({
  AUTH: "PAYCHEX_AUTH_ERROR",
  VALIDATION: "PAYCHEX_VALIDATION_ERROR",
  RATE_LIMIT: "PAYCHEX_RATE_LIMIT",
  CONFLICT: "PAYCHEX_CONFLICT",
  NOT_FOUND: "PAYCHEX_NOT_FOUND",
  UNAVAILABLE: "PAYCHEX_UNAVAILABLE",
  DISABLED: "PAYCHEX_DISABLED",
  WRITE_DISABLED: "PAYCHEX_WRITE_DISABLED",
  CONFIGURATION: "PAYCHEX_CONFIGURATION_ERROR",
  UNSUPPORTED_OPERATION: "PAYCHEX_UNSUPPORTED_OPERATION",
});

const SALARY_COMPONENT_MODES = Object.freeze({
  AMOUNT_ONLY: "AMOUNT_ONLY",
  QUANTITY_FACTOR_PERCENT: "QUANTITY_FACTOR_PERCENT",
});

class PaychexError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "PaychexError";
    this.code = options.code || PAYCHEX_ERROR_CODES.UNAVAILABLE;
    this.status = options.status || null;
    this.operation = options.operation || null;
    this.requestId = options.requestId || null;
    this.retryable = Boolean(options.retryable);
    this.providerMessage = options.providerMessage || null;
    if (options.cause) this.cause = options.cause;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      operation: this.operation,
      requestId: this.requestId,
      retryable: this.retryable,
    };
  }
}

function providerMessageFrom(error) {
  const data = error?.response?.data;
  let message = null;

  if (typeof data === "string") message = data;
  else if (typeof data?.detail === "string") message = data.detail;
  else if (typeof data?.message === "string") message = data.message;
  else if (Array.isArray(data?.errors)) {
    message = data.errors
      .slice(0, 3)
      .map((entry) => entry?.description || entry?.detail || entry?.message || entry?.code)
      .filter(Boolean)
      .join("; ");
  }

  return message ? String(message).slice(0, 500) : null;
}

function isNetworkError(error) {
  return (
    !error?.response &&
    [
      "ECONNABORTED",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ETIMEDOUT",
      "ERR_NETWORK",
      "ERR_BAD_RESPONSE",
    ].includes(error?.code)
  );
}

function normalizePaychexError(error, { operation = null } = {}) {
  if (error instanceof PaychexError) return error;

  const status = Number(error?.response?.status) || null;
  const requestId =
    error?.response?.headers?.["x-request-id"] ||
    error?.response?.headers?.["request-id"] ||
    null;

  let code = PAYCHEX_ERROR_CODES.UNAVAILABLE;
  if (status === 401 || status === 403) code = PAYCHEX_ERROR_CODES.AUTH;
  else if (status === 429) code = PAYCHEX_ERROR_CODES.RATE_LIMIT;
  else if (status === 409) code = PAYCHEX_ERROR_CODES.CONFLICT;
  else if (status === 404) code = PAYCHEX_ERROR_CODES.NOT_FOUND;
  else if (status === 400 || status === 405 || status === 406 || status === 422) {
    code = PAYCHEX_ERROR_CODES.VALIDATION;
  }

  const retryable = status === 408 || status === 429 || status >= 500 || isNetworkError(error);
  const providerMessage = providerMessageFrom(error);
  const fallbackMessage = status
    ? `Paychex request failed with HTTP ${status}.`
    : "Paychex is currently unavailable.";

  return new PaychexError(providerMessage || fallbackMessage, {
    code,
    status,
    operation,
    requestId,
    retryable,
    providerMessage,
    cause: error,
  });
}

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PaychexError(`${name} is required.`, {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }
  return value.trim();
}

function normalizeMonth(value, name, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  const month = requireNonEmptyString(value, name);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new PaychexError(`${name} must use YYYY-MM format.`, {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }
  return month;
}

function normalizeDecimal(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new PaychexError(`${name} is required.`, {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }

  const raw = String(value).trim();
  const match = raw.match(/^(-?)(\d{1,8})(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new PaychexError(`${name} must be a decimal with at most two decimal places.`, {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }

  const whole = BigInt(match[2]).toString();
  const fraction = (match[3] || "").padEnd(2, "0");
  const negative = match[1] === "-" && (whole !== "0" || fraction !== "00");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Convert a decimal Euro value into safe integer Euro cents without float rounding. */
function toIntegerCents(euros) {
  const raw = String(euros).trim();
  const match = raw.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new PaychexError("Euro amount must have at most two decimal places.", {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }

  const absolute = BigInt(match[2]) * 100n + BigInt((match[3] || "").padEnd(2, "0"));
  const cents = match[1] === "-" ? -absolute : absolute;
  const asNumber = Number(cents);
  if (!Number.isSafeInteger(asNumber)) {
    throw new PaychexError("Euro amount exceeds the safe integer-cent range.", {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }
  return asNumber;
}

function requireIntegerCents(value) {
  if (!Number.isSafeInteger(value)) {
    throw new PaychexError("amountCents must be a safe integer containing Euro cents.", {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }
  return value;
}

/**
 * Build a Paychex EmployeeSalaryComponent v1.3 payload.
 *
 * Monthly components default valid_till_month to valid_from_month, preventing
 * an accidental recurring wage component. Passing null explicitly keeps it
 * open-ended.
 */
function buildSalaryComponentPayload(input = {}) {
  const mode = requireNonEmptyString(input.mode, "mode").toUpperCase();
  if (!Object.values(SALARY_COMPONENT_MODES).includes(mode)) {
    throw new PaychexError(`Unsupported salary component mode: ${mode}.`, {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }

  const companySalaryComponent = requireNonEmptyString(
    input.companySalaryComponent || input.company_salary_component,
    "companySalaryComponent"
  );
  const validFromMonth = normalizeMonth(
    input.validFromMonth || input.valid_from_month,
    "validFromMonth"
  );
  const rawValidTill = Object.prototype.hasOwnProperty.call(input, "validTillMonth")
    ? input.validTillMonth
    : Object.prototype.hasOwnProperty.call(input, "valid_till_month")
      ? input.valid_till_month
      : validFromMonth;
  const validTillMonth = normalizeMonth(rawValidTill, "validTillMonth", { nullable: true });

  if (validTillMonth !== null && validTillMonth < validFromMonth) {
    throw new PaychexError("validTillMonth cannot precede validFromMonth.", {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }

  const payload = {
    company_salary_component: companySalaryComponent,
    valid_from_month: validFromMonth,
    valid_till_month: validTillMonth,
  };

  if (mode === SALARY_COMPONENT_MODES.AMOUNT_ONLY) {
    if ([input.quantity, input.factor, input.percent].some((value) => value !== undefined)) {
      throw new PaychexError("AMOUNT_ONLY does not accept quantity, factor, or percent.", {
        code: PAYCHEX_ERROR_CODES.VALIDATION,
        operation: "BUILD_PAYLOAD",
      });
    }
    payload.amount = requireIntegerCents(input.amountCents);
    return payload;
  }

  if (input.amountCents !== undefined) {
    throw new PaychexError("QUANTITY_FACTOR_PERCENT does not accept amountCents.", {
      code: PAYCHEX_ERROR_CODES.VALIDATION,
      operation: "BUILD_PAYLOAD",
    });
  }
  payload.quantity = normalizeDecimal(input.quantity, "quantity");
  payload.factor = normalizeDecimal(input.factor, "factor");
  payload.percent = normalizeDecimal(input.percent, "percent");
  return payload;
}

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Cannot hash a non-finite number.");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  throw new TypeError(`Cannot hash value of type ${typeof value}.`);
}

function canonicalJson(payload) {
  return JSON.stringify(canonicalize(payload));
}

function createPayloadHash(payload) {
  return crypto.createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function hasSamePayload(payload, expectedHash) {
  if (!/^[a-f0-9]{64}$/i.test(String(expectedHash || ""))) return false;
  const actual = Buffer.from(createPayloadHash(payload), "hex");
  const expected = Buffer.from(String(expectedHash), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function buildIdempotencyKey({ companyUid, employeeUid, localComponentId, payload }) {
  return createPayloadHash({
    provider: "paychex",
    companyUid: requireNonEmptyString(companyUid, "companyUid"),
    employeeUid: requireNonEmptyString(employeeUid, "employeeUid"),
    localComponentId: requireNonEmptyString(String(localComponentId || ""), "localComponentId"),
    payload,
  });
}

function planIdempotentWrite({ remoteComponentId = null, previousPayloadHash = null, payload }) {
  const payloadHash = createPayloadHash(payload);
  if (!remoteComponentId) return { action: "CREATE", payloadHash, remoteComponentId: null };
  if (hasSamePayload(payload, previousPayloadHash)) {
    return { action: "SKIP", payloadHash, remoteComponentId };
  }
  return { action: "UPDATE", payloadHash, remoteComponentId };
}

function decodeJwtExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class PaychexService {
  constructor(options = {}) {
    this.config = options.config?.paychex || options.config || payrollConfig.paychex;
    this.log = options.logger || logger;
    this.sleep = options.sleep || delay;
    this.now = options.now || (() => Date.now());
    this.http =
      options.httpClient ||
      axios.create({
        baseURL: this.config.baseURL,
        timeout: this.config.timeoutMs,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
    this.cachedToken = null;
    this.cachedTokenExpiresAt = 0;
    this.tokenPromise = null;
  }

  configurationStatus() {
    const missing = [];
    const authMode = this.config.auth?.mode;
    if (!this.config.baseURL) missing.push("PAYCHEX_API_BASE_URL");
    if (!this.config.company?.key) missing.push("PAYCHEX_COMPANY_KEY");
    if (!this.config.company?.uid) missing.push("PAYCHEX_COMPANY_UID");
    if (!Object.values(PAYCHEX_AUTH_MODES).includes(authMode)) {
      missing.push("PAYCHEX_AUTH_MODE");
    } else if (authMode === PAYCHEX_AUTH_MODES.API_KEY && !this.config.auth?.apiKey) {
      missing.push("PAYCHEX_API_KEY");
    } else if (authMode === PAYCHEX_AUTH_MODES.JWT && !this.config.auth?.jwt) {
      missing.push("PAYCHEX_JWT");
    }

    const configured = missing.length === 0;
    const canRead = Boolean(this.config.enabled && configured);
    const canWrite = Boolean(canRead && this.config.writeEnabled);
    const status = !this.config.enabled
      ? "DISABLED"
      : !configured
        ? "MISCONFIGURED"
        : !this.config.writeEnabled
          ? "READ_ONLY"
          : "READY";

    return {
      provider: "paychex",
      apiVersion: this.config.apiVersion || "v1.3",
      status,
      enabled: Boolean(this.config.enabled),
      writeEnabled: Boolean(this.config.writeEnabled),
      configured,
      canRead,
      canWrite,
      authMode,
      baseURL: this.config.baseURL || null,
      company: {
        key: this.config.company?.key || null,
        configured: Boolean(this.config.company?.uid),
      },
      missing,
    };
  }

  getConfigurationStatus() {
    return this.configurationStatus();
  }

  _ensureReadEnabled() {
    const status = this.configurationStatus();
    if (!status.enabled) {
      throw new PaychexError("Paychex integration is disabled.", {
        code: PAYCHEX_ERROR_CODES.DISABLED,
        operation: "CONFIGURATION",
      });
    }
    if (!status.configured) {
      throw new PaychexError(`Paychex configuration is incomplete: ${status.missing.join(", ")}.`, {
        code: PAYCHEX_ERROR_CODES.CONFIGURATION,
        operation: "CONFIGURATION",
      });
    }
  }

  _ensureWriteEnabled() {
    this._ensureReadEnabled();
    if (!this.config.writeEnabled) {
      throw new PaychexError("Paychex write operations are disabled.", {
        code: PAYCHEX_ERROR_CODES.WRITE_DISABLED,
        operation: "CONFIGURATION",
      });
    }
  }

  _companyUid(companyKey) {
    const configuredKey = this.config.company?.key;
    const requestedKey = companyKey || configuredKey;
    if (requestedKey !== configuredKey) {
      throw new PaychexError(`Unknown Paychex company mapping: ${requestedKey}.`, {
        code: PAYCHEX_ERROR_CODES.CONFIGURATION,
        operation: "COMPANY_MAPPING",
      });
    }
    if (!this.config.company?.uid) {
      throw new PaychexError("PAYCHEX_COMPANY_UID is required.", {
        code: PAYCHEX_ERROR_CODES.CONFIGURATION,
        operation: "COMPANY_MAPPING",
      });
    }
    return String(this.config.company.uid).trim();
  }

  _pathSegment(value, name) {
    return encodeURIComponent(requireNonEmptyString(value, name));
  }

  clearCachedToken() {
    this.cachedToken = null;
    this.cachedTokenExpiresAt = 0;
  }

  async _authenticateWithApiKey() {
    const response = await this._sendWithRetry(
      {
        method: "post",
        url: "/auth/authenticate/",
        data: { apikey: this.config.auth.apiKey },
        timeout: this.config.timeoutMs,
      },
      { operation: "AUTHENTICATE", retryUnsafe: true }
    );
    const token =
      response?.data?.token ||
      response?.data?.access ||
      response?.data?.jwt ||
      response?.data?.apikey;
    if (!token || typeof token !== "string") {
      throw new PaychexError("Paychex authentication returned no JWT.", {
        code: PAYCHEX_ERROR_CODES.AUTH,
        operation: "AUTHENTICATE",
      });
    }

    const jwtExpiry = decodeJwtExpiry(token);
    const fallbackExpiry = this.now() + this.config.auth.tokenTtlMs;
    this.cachedToken = token;
    this.cachedTokenExpiresAt = Math.max(
      this.now() + 1,
      (jwtExpiry || fallbackExpiry) - this.config.auth.tokenExpirySkewMs
    );
    return token;
  }

  async _authToken() {
    if (this.config.auth.mode === PAYCHEX_AUTH_MODES.JWT) return this.config.auth.jwt;
    if (this.cachedToken && this.cachedTokenExpiresAt > this.now()) return this.cachedToken;
    if (!this.tokenPromise) {
      this.tokenPromise = this._authenticateWithApiKey().finally(() => {
        this.tokenPromise = null;
      });
    }
    return this.tokenPromise;
  }

  _retryDelay(error, retryIndex) {
    const header =
      error?.response?.headers?.["retry-after"] ?? error?.response?.headers?.["Retry-After"];
    if (header !== undefined) {
      const seconds = Number(header);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, this.config.retry.maxDelayMs);
      }
      const dateMs = Date.parse(header);
      if (Number.isFinite(dateMs)) {
        return Math.min(Math.max(0, dateMs - this.now()), this.config.retry.maxDelayMs);
      }
    }
    return Math.min(
      this.config.retry.baseDelayMs * 2 ** retryIndex,
      this.config.retry.maxDelayMs
    );
  }

  _shouldRetry(error, method, retryUnsafe) {
    const status = Number(error?.response?.status) || null;
    if (status === 429) return true;

    const transient = status === 408 || status >= 500 || isNetworkError(error);
    if (!transient) return false;

    const safeMethod = ["get", "head", "options", "put", "patch", "delete"].includes(
      String(method).toLowerCase()
    );
    return safeMethod || retryUnsafe;
  }

  async _sendWithRetry(requestConfig, { operation, retryUnsafe = false } = {}) {
    const maxRetries = this.config.retry?.maxRetries || 0;
    let lastError;

    for (let retryIndex = 0; retryIndex <= maxRetries; retryIndex += 1) {
      try {
        return await this.http.request({
          timeout: this.config.timeoutMs,
          ...requestConfig,
        });
      } catch (error) {
        lastError = error;
        if (
          retryIndex >= maxRetries ||
          !this._shouldRetry(error, requestConfig.method, retryUnsafe)
        ) {
          break;
        }
        const waitMs = this._retryDelay(error, retryIndex);
        this.log.warn("Paychex request retry", {
          operation,
          status: error?.response?.status || null,
          retry: retryIndex + 1,
          waitMs,
        });
        await this.sleep(waitMs);
      }
    }

    throw normalizePaychexError(lastError, { operation });
  }

  async _request({ method, url, data, params, operation, write = false, retryUnsafe = false }) {
    if (write) this._ensureWriteEnabled();
    else this._ensureReadEnabled();

    let authRetry = false;
    while (true) {
      const token = await this._authToken();
      try {
        const response = await this._sendWithRetry(
          {
            method,
            url,
            data,
            params,
            headers: {
              Authorization: `${this.config.auth.scheme} ${token}`,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          },
          { operation, retryUnsafe }
        );
        return response.data;
      } catch (error) {
        if (
          !authRetry &&
          error.code === PAYCHEX_ERROR_CODES.AUTH &&
          this.config.auth.mode === PAYCHEX_AUTH_MODES.API_KEY
        ) {
          authRetry = true;
          this.clearCachedToken();
          continue;
        }
        throw error;
      }
    }
  }

  async listCompanySalaryComponents({ companyKey, limit, offset, ordering } = {}) {
    const companyUid = this._companyUid(companyKey);
    return this._request({
      method: "get",
      url: `/companies/${this._pathSegment(companyUid, "companyUid")}/salary-components/`,
      params: { limit, offset, ordering },
      operation: "LIST_COMPANY_SALARY_COMPONENTS",
    });
  }

  _employeePath(employeeUid, companyKey) {
    const companyUid = this._companyUid(companyKey);
    const base = `/companies/${this._pathSegment(companyUid, "companyUid")}/employees/`;
    return employeeUid ? `${base}${this._pathSegment(employeeUid, "employeeUid")}/` : base;
  }

  async listEmployees({ companyKey, limit, offset, ordering } = {}) {
    return this._request({
      method: "get",
      url: this._employeePath(null, companyKey),
      params: { limit, offset, ordering },
      operation: "LIST_EMPLOYEES",
    });
  }

  async getEmployee(employeeUid, { companyKey } = {}) {
    return this._request({
      method: "get",
      url: this._employeePath(employeeUid, companyKey),
      operation: "GET_EMPLOYEE",
    });
  }

  async createEmployee(payload, { companyKey } = {}) {
    this._ensureWriteEnabled();
    return this._request({
      method: "post",
      url: this._employeePath(null, companyKey),
      data: payload,
      operation: "CREATE_EMPLOYEE",
      write: true,
    });
  }

  async updateEmployee(employeeUid, payload, { companyKey, partial = false } = {}) {
    this._ensureWriteEnabled();
    return this._request({
      method: partial ? "patch" : "put",
      url: this._employeePath(employeeUid, companyKey),
      data: payload,
      operation: partial ? "PATCH_EMPLOYEE" : "UPDATE_EMPLOYEE",
      write: true,
    });
  }

  async patchEmployee(employeeUid, payload, options = {}) {
    return this.updateEmployee(employeeUid, payload, { ...options, partial: true });
  }

  async deleteEmployee() {
    this._ensureWriteEnabled();
    throw new PaychexError(
      "Paychex Public API v1.3 does not document an employee DELETE operation.",
      {
        code: PAYCHEX_ERROR_CODES.UNSUPPORTED_OPERATION,
        operation: "DELETE_EMPLOYEE",
      }
    );
  }

  _employeeContractPath(employeeUid, companyKey) {
    return `${this._employeePath(employeeUid, companyKey)}contract/`;
  }

  async getEmployeeContract(employeeUid, { companyKey, validAt } = {}) {
    const requestedMonth = normalizeMonth(validAt, "validAt");
    return this._request({
      method: "get",
      url: this._employeeContractPath(employeeUid, companyKey),
      params: { valid_at: requestedMonth },
      operation: "GET_EMPLOYEE_CONTRACT",
    });
  }

  async putEmployeeContract(
    employeeUid,
    payload,
    { companyKey, validFrom, validTill } = {}
  ) {
    this._ensureWriteEnabled();
    return this._request({
      method: "put",
      url: this._employeeContractPath(employeeUid, companyKey),
      params: { valid_from: validFrom, valid_till: validTill },
      data: payload,
      operation: "PUT_EMPLOYEE_CONTRACT",
      write: true,
    });
  }

  async patchEmployeeContract(
    employeeUid,
    payload,
    { companyKey, validFrom, validTill } = {}
  ) {
    this._ensureWriteEnabled();
    return this._request({
      method: "patch",
      url: this._employeeContractPath(employeeUid, companyKey),
      params: { valid_from: validFrom, valid_till: validTill },
      data: payload,
      operation: "PATCH_EMPLOYEE_CONTRACT",
      write: true,
    });
  }

  async deleteEmployeeContract() {
    this._ensureWriteEnabled();
    throw new PaychexError(
      "Paychex Public API v1.3 does not document an employee-contract DELETE operation.",
      {
        code: PAYCHEX_ERROR_CODES.UNSUPPORTED_OPERATION,
        operation: "DELETE_EMPLOYEE_CONTRACT",
      }
    );
  }

  _employeeSalaryComponentPath(employeeUid, componentUid, companyKey) {
    const companyUid = this._companyUid(companyKey);
    const base = `/companies/${this._pathSegment(companyUid, "companyUid")}/employees/${this._pathSegment(employeeUid, "employeeUid")}/salary-components/`;
    return componentUid ? `${base}${this._pathSegment(componentUid, "componentUid")}/` : base;
  }

  async listEmployeeSalaryComponents(employeeUid, { companyKey } = {}) {
    return this._request({
      method: "get",
      url: this._employeeSalaryComponentPath(employeeUid, null, companyKey),
      operation: "LIST_EMPLOYEE_SALARY_COMPONENTS",
    });
  }

  async getEmployeeSalaryComponent(employeeUid, componentUid, { companyKey } = {}) {
    return this._request({
      method: "get",
      url: this._employeeSalaryComponentPath(employeeUid, componentUid, companyKey),
      operation: "GET_EMPLOYEE_SALARY_COMPONENT",
    });
  }

  async createEmployeeSalaryComponent(employeeUid, payload, { companyKey } = {}) {
    this._ensureWriteEnabled();
    return this._request({
      method: "post",
      url: this._employeeSalaryComponentPath(employeeUid, null, companyKey),
      data: payload,
      operation: "CREATE_EMPLOYEE_SALARY_COMPONENT",
      write: true,
    });
  }

  async updateEmployeeSalaryComponent(
    employeeUid,
    componentUid,
    payload,
    { companyKey, partial = false } = {}
  ) {
    this._ensureWriteEnabled();
    return this._request({
      method: partial ? "patch" : "put",
      url: this._employeeSalaryComponentPath(employeeUid, componentUid, companyKey),
      data: payload,
      operation: partial
        ? "PATCH_EMPLOYEE_SALARY_COMPONENT"
        : "UPDATE_EMPLOYEE_SALARY_COMPONENT",
      write: true,
    });
  }

  async patchEmployeeSalaryComponent(employeeUid, componentUid, payload, options = {}) {
    return this.updateEmployeeSalaryComponent(employeeUid, componentUid, payload, {
      ...options,
      partial: true,
    });
  }

  async deleteEmployeeSalaryComponent(employeeUid, componentUid, { companyKey } = {}) {
    this._ensureWriteEnabled();
    return this._request({
      method: "delete",
      url: this._employeeSalaryComponentPath(employeeUid, componentUid, companyKey),
      operation: "DELETE_EMPLOYEE_SALARY_COMPONENT",
      write: true,
    });
  }

  _absencePath(employeeUid, absenceUid, companyKey) {
    const companyUid = this._companyUid(companyKey);
    const base = `/companies/${this._pathSegment(companyUid, "companyUid")}/employees/${this._pathSegment(employeeUid, "employeeUid")}/absence/`;
    return absenceUid ? `${base}${this._pathSegment(absenceUid, "absenceUid")}/` : base;
  }

  async listAbsences(employeeUid, { companyKey, limit, offset } = {}) {
    return this._request({
      method: "get",
      url: this._absencePath(employeeUid, null, companyKey),
      params: { limit, offset },
      operation: "LIST_EMPLOYEE_ABSENCES",
    });
  }

  async listEmployeeAbsences(employeeUid, options = {}) {
    return this.listAbsences(employeeUid, options);
  }

  async getAbsence(employeeUid, absenceUid, { companyKey } = {}) {
    return this._request({
      method: "get",
      url: this._absencePath(employeeUid, absenceUid, companyKey),
      operation: "GET_EMPLOYEE_ABSENCE",
    });
  }

  async getEmployeeAbsence(employeeUid, absenceUid, options = {}) {
    return this.getAbsence(employeeUid, absenceUid, options);
  }

  async createAbsence(employeeUid, payload, { companyKey } = {}) {
    this._ensureWriteEnabled();
    return this._request({
      method: "post",
      url: this._absencePath(employeeUid, null, companyKey),
      data: payload,
      operation: "CREATE_EMPLOYEE_ABSENCE",
      write: true,
    });
  }

  async createEmployeeAbsence(employeeUid, payload, options = {}) {
    return this.createAbsence(employeeUid, payload, options);
  }

  async updateAbsence(employeeUid, absenceUid, payload, { companyKey, partial = false } = {}) {
    this._ensureWriteEnabled();
    return this._request({
      method: partial ? "patch" : "put",
      url: this._absencePath(employeeUid, absenceUid, companyKey),
      data: payload,
      operation: partial ? "PATCH_EMPLOYEE_ABSENCE" : "UPDATE_EMPLOYEE_ABSENCE",
      write: true,
    });
  }

  async updateEmployeeAbsence(employeeUid, absenceUid, payload, options = {}) {
    return this.updateAbsence(employeeUid, absenceUid, payload, options);
  }

  async patchAbsence(employeeUid, absenceUid, payload, options = {}) {
    return this.updateAbsence(employeeUid, absenceUid, payload, {
      ...options,
      partial: true,
    });
  }

  async patchEmployeeAbsence(employeeUid, absenceUid, payload, options = {}) {
    return this.patchAbsence(employeeUid, absenceUid, payload, options);
  }

  async deleteAbsence() {
    this._ensureWriteEnabled();
    throw new PaychexError(
      "Paychex Public API v1.3 does not document an employee-absence DELETE operation.",
      {
        code: PAYCHEX_ERROR_CODES.UNSUPPORTED_OPERATION,
        operation: "DELETE_EMPLOYEE_ABSENCE",
      }
    );
  }

  async deleteEmployeeAbsence(employeeUid, absenceUid, options = {}) {
    return this.deleteAbsence(employeeUid, absenceUid, options);
  }

  async listDocuments({ companyKey, startDate, endDate, limit, offset } = {}) {
    const companyUid = this._companyUid(companyKey);
    requireNonEmptyString(startDate, "startDate");
    return this._request({
      method: "get",
      url: `/companies/${this._pathSegment(companyUid, "companyUid")}/documents/`,
      params: {
        start_date: startDate,
        end_date: endDate,
        limit,
        offset,
      },
      operation: "LIST_DOCUMENTS",
    });
  }

  async getDocument(documentUid, { companyKey } = {}) {
    const companyUid = this._companyUid(companyKey);
    return this._request({
      method: "get",
      url: `/companies/${this._pathSegment(companyUid, "companyUid")}/documents/${this._pathSegment(documentUid, "documentUid")}/`,
      operation: "GET_DOCUMENT",
    });
  }

  async downloadDocument(documentUid, options = {}) {
    const document = await this.getDocument(documentUid, options);
    if (!document || typeof document.file !== "string" || document.file.trim() === "") {
      throw new PaychexError("Paychex document response contains no base64 file.", {
        code: PAYCHEX_ERROR_CODES.VALIDATION,
        operation: "DOWNLOAD_DOCUMENT",
      });
    }

    const normalizedBase64 = document.file.replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedBase64) || normalizedBase64.length % 4 !== 0) {
      throw new PaychexError("Paychex document response contains invalid base64 data.", {
        code: PAYCHEX_ERROR_CODES.VALIDATION,
        operation: "DOWNLOAD_DOCUMENT",
      });
    }

    const { file, ...metadata } = document;
    const buffer = Buffer.from(normalizedBase64, "base64");
    const contentType = String(document.name || "").toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream";
    return { metadata, buffer, contentType };
  }
}

const paychexService = new PaychexService();

module.exports = paychexService;
module.exports.PaychexService = PaychexService;
module.exports.PaychexError = PaychexError;
module.exports.PAYCHEX_ERROR_CODES = PAYCHEX_ERROR_CODES;
module.exports.SALARY_COMPONENT_MODES = SALARY_COMPONENT_MODES;
module.exports.normalizePaychexError = normalizePaychexError;
module.exports.buildSalaryComponentPayload = buildSalaryComponentPayload;
module.exports.toIntegerCents = toIntegerCents;
module.exports.canonicalJson = canonicalJson;
module.exports.createPayloadHash = createPayloadHash;
module.exports.hasSamePayload = hasSamePayload;
module.exports.buildIdempotencyKey = buildIdempotencyKey;
module.exports.planIdempotentWrite = planIdempotentWrite;
