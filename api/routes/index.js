const express = require('express');
const router = express.Router();

// A simple GET route
router.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

module.exports = router;
