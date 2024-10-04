// middleware/auth.js

const jwt = require('jsonwebtoken');
const config = require('config');

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if token is present
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify the token
  try {
    const decoded = jwt.verify(token, config.get('jwtSecret'));
    req.user = decoded.user; // Decoded payload has the user ID
    next(); // Proceed to the next middleware or route
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
