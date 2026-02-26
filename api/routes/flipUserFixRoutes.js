const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const { flipAxios } = require('../flipAxios');
const logger = require('../utils/logger');

// GET /api/flip-user-fix/attribute-definitions
// Returns all user attribute definitions from Flip
router.get('/attribute-definitions', auth, asyncHandler(async (req, res) => {
  const response = await flipAxios.get('/api/admin/users/v4/user-attribute-definitions');
  const defs = (response.data?.attribute_definitions || []).map(d => ({
    id: d.definition?.id,
    technical_name: d.definition?.technical_name,
    title: d.definition?.title?.text || d.definition?.technical_name,
    attribute_type: d.definition?.attribute_type,
  }));
  res.json(defs);
}));

// GET /api/flip-user-fix/users
// Fetches all active Flip users (paginates automatically), optionally filtered by attribute
// Query: attribute_technical_name, attribute_value, status (default ACTIVE)
router.get('/users', auth, asyncHandler(async (req, res) => {
  const { attribute_technical_name, attribute_value, status } = req.query;

  let allUsers = [];
  let currentPage = 1;
  let totalPages = 1;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  do {
    const params = {
      page_number: currentPage,
      page_limit: 100,
      status: status ? status.split(',') : ['ACTIVE'],
    };
    if (attribute_technical_name) params.attribute_technical_name = attribute_technical_name;
    if (attribute_value !== undefined) params.attribute_value = attribute_value;

    try {
      const response = await flipAxios.get('/api/admin/users/v4/users', { params });
      if (response.data?.users) allUsers.push(...response.data.users);
      const p = response.data?.pagination;
      if (p) { totalPages = p.total_pages; currentPage++; }
      else break;
    } catch (err) {
      if (err.response?.status === 429) { await sleep(2000); continue; }
      throw err;
    }
    await sleep(150);
  } while (currentPage <= totalPages);

  // Return a leaner shape: id, first_name, last_name, email, status, attributes (as flat object)
  const users = allUsers.map(u => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    username: u.username,
    status: u.status,
    attributes: Object.fromEntries((u.attributes || []).map(a => [a.technical_name || a.name, a.value])),
  }));

  res.json(users);
}));

// PATCH /api/flip-user-fix/users/batch
// Proxies a batch attribute update to Flip
// Body: { items: [{ id, attributes: { technicalName: value, ... } }, ...] }
router.patch('/users/batch', auth, asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'items array required' });
  }
  if (items.length > 100) {
    return res.status(400).json({ success: false, message: 'Max 100 users per batch' });
  }

  // Transform: our format { id, attributes: { isService: "true" } }
  //        → Flip format { id, body: { attributes: [{ name: "isService", value: "true" }] } }
  const flipItems = items.map(item => ({
    id: item.id,
    body: {
      attributes: Object.entries(item.attributes || {}).map(([name, value]) => ({ name, value })),
    },
  }));

  const response = await flipAxios.patch('/api/admin/users/v4/users/batch', { items: flipItems });

  const results = (response.data?.items || []).map(r => ({
    id: r.id,
    success: r.status === 200,
    status: r.status,
    error: r.error ? (r.error.title || r.error.code) : null,
  }));

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  logger.info(`[FlipUserFix] Batch update: ${succeeded} ok, ${failed} failed`);

  res.json({ success: true, succeeded, failed, results });
}));

module.exports = router;
