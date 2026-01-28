const axios = require("axios");
require("dotenv").config();

const BASE_URL = "https://api.zvoove.cloud/temp-staffing-de/v3";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.ZVOOVE_API_KEY}`,
    "Content-Type": "application/json",
    ...(process.env.ZVOOVE_MANDANT_ID && { "X-MANDANT-ID": process.env.ZVOOVE_MANDANT_ID }),
  },
});

/**
 * Get all employees overview
 * Endpoint: GET /temp-staffing-de/v3/employees
 * @param {Object} params - Query parameters (PageNumber, PageSize, SearchTerm, OfficeIds)
 */
async function getEmployees(params = {}) {
  try {
    const response = await axiosInstance.get("/employees", { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching employees from Zvoove:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  getEmployees,
};
