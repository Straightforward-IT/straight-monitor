const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/AsyncHandler");
const { getEmployees } = require("../ZvooveService");

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

module.exports = router;
