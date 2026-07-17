const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/AsyncHandler");
const { getEmployees, getEmployeesWithDetails, getCompanies, getOrders, getOrderPositions, getOrderPosition, updateOrderPosition, getOrderPositionsChangelog, getAssignments, getOrdersChangelog } = require("../ZvooveService");

/**
 * Route: Get all employees overview from Zvoove
 * URL: /api/zvoove/employees
 */
router.get("/employees", asyncHandler(async (req, res) => {
    // Pass query parameters (PageNumber, PageSize, SearchTerm, etc.)
    const params = req.query;
    try {
        const data = await getEmployees(params);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching from Zvoove", error: error.message });
    }
}));

/**
 * Route: Get all employees with their details (including qualifications) from Zvoove
 * URL: /api/zvoove/employees/with-details
 */
router.get("/employees/with-details", asyncHandler(async (req, res) => {
    const params = req.query;
    try {
        const data = await getEmployeesWithDetails(params);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching details from Zvoove", error: error.message });
    }
}));

/**
 * Route: Get all companies (Kunden) from Zvoove
 * URL: /api/zvoove/companies
 * Query params: OfficeIds, CompanyGuids, Status, Statuses, Active, Name, PageNumber, PageSize
 */
router.get("/companies", asyncHandler(async (req, res) => {
    const params = req.query;
    try {
        const data = await getCompanies(params);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching companies from Zvoove", error: error.message });
    }
}));

/**
 * Route: Get all orders from Zvoove
 * URL: /api/zvoove/orders
 * Query params: StartDate (date), EndDate (date), OrderStatus, Statuses, PageNumber, PageSize
 */
router.get("/orders", asyncHandler(async (req, res) => {
    const params = req.query;
    try {
        const data = await getOrders(params);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching orders from Zvoove", error: error.message });
    }
}));

/**
 * Route: Get all positions for an order (lightweight list)
 * URL: /api/zvoove/orders/:orderId/positions
 */
router.get("/orders/:orderId/positions", asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    try {
        const data = await getOrderPositions(Number(orderId), req.query);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching order positions from Zvoove", error: error.message });
    }
}));

/**
 * Route: Get order position changelog for a specific order
 * URL: /api/zvoove/orders/:orderId/positions/changelog
 * Query params: From, To, LastId, OnlyLatestPerOrderPosition (use From/To OR LastId, not both)
 */
router.get("/orders/:orderId/positions/changelog", asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    try {
        const data = await getOrderPositionsChangelog(Number(orderId), req.query);
        res.status(200).json(data);
    } catch (error) {
        const status = error.response?.status === 400 ? 400 : 500;
        res.status(status).json({ message: "Error fetching order positions changelog from Zvoove", error: error.message });
    }
}));

/**
 * Route: Get a single order position with full details
 * URL: /api/zvoove/orders/:orderId/positions/:positionId
 */
router.get("/orders/:orderId/positions/:positionId", asyncHandler(async (req, res) => {
    const { orderId, positionId } = req.params;
    try {
        const data = await getOrderPosition(Number(orderId), Number(positionId));
        res.status(200).json(data);
    } catch (error) {
        const status = error.response?.status === 404 ? 404 : 500;
        res.status(status).json({ message: "Error fetching order position from Zvoove", error: error.message });
    }
}));

/**
 * Route: Update an order position
 * URL: /api/zvoove/orders/:orderId/positions/:positionId
 */
router.put("/orders/:orderId/positions/:positionId", asyncHandler(async (req, res) => {
    const { orderId, positionId } = req.params;
    try {
        await updateOrderPosition(Number(orderId), Number(positionId), req.body);
        res.status(204).send();
    } catch (error) {
        const status = error.response?.status === 404 ? 404 : 500;
        res.status(status).json({ message: "Error updating order position in Zvoove", error: error.message });
    }
}));

/**
 * Route: Get order assignments (Einsätze) from Zvoove
 * URL: /api/zvoove/assignments
 * Query params: From, To, OrderId, PositionId, EmployeeId, CustomerId,
 *              AssignmentId, AssignmentId2, OfficeIds, ProfessionId, QualificationId
 */
router.get("/assignments", asyncHandler(async (req, res) => {
    const params = req.query;
    try {
        const data = await getAssignments(params);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching assignments from Zvoove", error: error.message });
    }
}));

/**
 * Route: Get orders changelog from Zvoove
 * URL: /api/zvoove/orders/changelog
 * Query params: from (ISO, defaults to 30 days ago), to (ISO), OfficeIds, PageNumber, PageSize
 */
router.get("/orders/changelog", asyncHandler(async (req, res) => {
    const params = req.query;
    try {
        const data = await getOrdersChangelog(params);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching orders changelog from Zvoove", error: error.message });
    }
}));

module.exports = router;
