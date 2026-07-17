const axios = require("axios");
require("dotenv").config();
const Kunde = require("./models/Kunde");
// We use the root URL because different endpoints require different version paths (e.g. /v3 vs /v5)
const BASE_URL = "https://api.zvoove.cloud/temp-staffing-de";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.ZVOOVE_API_KEY}`,
    "Content-Type": "application/json",
  },
});

/**
 * Helper to fetch all pages from a paginated Zvoove endpoint.
 */
async function fetchAllPages(endpoint, params = {}) {
  const allData = [];
  let currentPage = 0;
  let totalPages = 1;
  let latestMetadata = null;

  // Set PageSize to a safe default of 100 for all endpoints, unless explicitly overridden
  const combinedParams = {
    PageSize: 100,
    ...params,
  };

  while (currentPage < totalPages) {
    combinedParams.PageNumber = currentPage;

    try {
      const response = await axiosInstance.get(endpoint, { params: combinedParams });
      const { metadata, data } = response.data;

      if (data && Array.isArray(data)) {
        allData.push(...data);
      }

      if (metadata) {
        latestMetadata = metadata;
        totalPages = metadata.totalPages || 1;
      } else {
        break; // Break if endpoint doesn't return metadata
      }

      currentPage++;
    } catch (error) {
      console.error(`Error fetching page ${currentPage} from Zvoove ${endpoint}:`, error.response?.data || error.message);
      throw error;
    }
  }

  return {
    metadata: {
      ...latestMetadata,
      pageNumber: 0,
      totalPages: 1,
      totalRecords: allData.length,
    },
    data: allData,
  };
}

/**
 * Get all employees overview
 * Endpoint: GET /temp-staffing-de/v3/employees
 * @param {Object} params - Query parameters (PageNumber, PageSize, SearchTerm, OfficeIds)
 */
async function getEmployees(params = {}) {
  return await fetchAllPages("/v3/employees", params);
}

/**
 * Get all employees with their details (including qualifications, professions, wage types)
 * Endpoint: GET /temp-staffing-de/v5/employees/with-details
 * @param {Object} params - Query parameters (PageNumber, PageSize, SearchTerm, OfficeIds)
 */
async function getEmployeesWithDetails(params = {}) {
  return await fetchAllPages("/v5/employees/with-details", params);
}

/**
 * Get all orders
 * Endpoint: GET /temp-staffing-de/v1/orders
 * @param {Object} params - Query parameters: StartDate, EndDate, OrderStatus, Statuses, PageNumber, PageSize
 */
async function getOrders(params = {}) {
  return await fetchAllPages("/v1/orders", params);
}

/**
 * Get all positions for an order (lightweight list)
 * Endpoint: GET /temp-staffing-de/v1/orders/{orderId}/positions
 * @param {number} orderId
 * @param {Object} params - Query parameters: PageNumber, PageSize
 */
async function getOrderPositions(orderId, params = {}) {
  return await fetchAllPages(`/v1/orders/${orderId}/positions`, params);
}

/**
 * Get a single order position with full details
 * Endpoint: GET /temp-staffing-de/v2/orders/{orderId}/positions/{positionId}
 * @param {number} orderId
 * @param {number} positionId
 */
async function getOrderPosition(orderId, positionId) {
  const response = await axiosInstance.get(`/v2/orders/${orderId}/positions/${positionId}`);
  return response.data;
}

/**
 * Update an order position
 * Endpoint: PUT /temp-staffing-de/v5/orders/{orderId}/positions/{positionId}
 * Returns 204 No Content on success.
 * @param {number} orderId
 * @param {number} positionId
 * @param {Object} body - UpdateOrderPositionV5Request
 */
async function updateOrderPosition(orderId, positionId, body) {
  await axiosInstance.put(`/v5/orders/${orderId}/positions/${positionId}`, body);
}

/**
 * Get all companies overview (Kunden)
 * Endpoint: GET /temp-staffing-de/v3/companies
 * @param {Object} params - Query parameters: OfficeIds, CompanyGuids, Status, Statuses,
 *                          Active, Name, PageNumber, PageSize
 */
async function getCompanies(params = {}) {
  return await fetchAllPages("/v3/companies", {
    PageSize: 500,
    ...params,
  });
}

/**
 * Map Zvoove company status string to Kunde.kundStatus number.
 * Unmapped statuses return undefined (field is skipped in $set).
 */
const ZVOOVE_STATUS_MAP = {
  InterestedCustomer: 1,
  ActiveCustomer: 2,
  InactiveCustomer: 3,
};

/**
 * Fetch all companies from Zvoove and upsert them into the Kunde collection.
 * Only Zvoove-sourced fields are updated; manual fields (kontakte, bemerkung,
 * kuerzel, signaturKontakt*) are never overwritten.
 * @returns {{ fetched: number, upserted: number, modified: number }}
 */
async function syncCompanies() {
  const { data: companies } = await getCompanies();

  if (!companies.length) return { fetched: 0, upserted: 0, modified: 0 };

  const ops = companies.map((company) => {
    const fullName = [company.name, company.name2, company.name3]
      .filter((n) => n?.trim())
      .join(" ")
      .trim();

    const setFields = {
      kundName: fullName || null,
      geschSt: String(company.officeId),
      "adressen.0.strasse": company.address?.street || null,
      "adressen.0.plz": company.address?.postalCode || null,
      "adressen.0.ort": company.address?.city || null,
      "adressen.0.email": company.email || null,
    };

    const mappedStatus = ZVOOVE_STATUS_MAP[company.status];
    if (mappedStatus !== undefined) {
      setFields.kundStatus = mappedStatus;
    }

    return {
      updateOne: {
        filter: { kundenNr: company.id },
        update: { $set: setFields },
        upsert: true,
      },
    };
  });

  const result = await Kunde.bulkWrite(ops, { ordered: false });
  return {
    fetched: companies.length,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  };
}

/**
 * Get order assignments (Einsätze)
 * Endpoint: GET /temp-staffing-de/v1/assignments
 * @param {Object} params - Query parameters: From, To, OrderId, PositionId, EmployeeId,
 *                          CustomerId, AssignmentId, AssignmentId2, OfficeIds,
 *                          ProfessionId, QualificationId, PageNumber, PageSize
 */
async function getAssignments(params = {}) {
  return await fetchAllPages("/v1/assignments", {
    PageSize: 500,
    ...params,
  });
}

/**
 * Get order position changelog for a specific order
 * Endpoint: GET /temp-staffing-de/v4/orders/{orderId}/positions/changelog
 * Use either LastId (incremental sync) OR From/To (date range), not both.
 * Max PageSize = 40.
 * @param {number} orderId
 * @param {Object} params - Query parameters: From, To, LastId, OnlyLatestPerOrderPosition, PageNumber, PageSize
 */
async function getOrderPositionsChangelog(orderId, params = {}) {
  return await fetchAllPages(`/v4/orders/${orderId}/positions/changelog`, {
    PageSize: 40,
    ...params,
  });
}

/**
 * Get orders changelog (created/updated/deleted orders since a given date)
 * Endpoint: GET /temp-staffing-de/v4/orders/changelog
 * @param {Object} params - Query parameters: from (ISO date, required), to (ISO date), OfficeIds, PageNumber, PageSize
 *                          Defaults 'from' to 30 days ago if omitted.
 */
async function getOrdersChangelog(params = {}) {
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const mergedParams = {
    from: defaultFrom.toISOString(),
    ...params,
  };
  return await fetchAllPages("/v4/orders/changelog", mergedParams);
}

module.exports = {
  getEmployees,
  getEmployeesWithDetails,
  getCompanies,
  syncCompanies,
  getOrders,
  getOrderPositions,
  getOrderPosition,
  updateOrderPosition,
  getOrderPositionsChangelog,
  getAssignments,
  getOrdersChangelog,
};
