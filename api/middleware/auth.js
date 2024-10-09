const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load environment variables from .env

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if token is present
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify the token
  try {
    const jwtSecret = process.env.JWT_SECRET; // Retrieve JWT secret from .env
    const decoded = jwt.verify(token, jwtSecret); // Verify token with secret
    req.user = decoded.user; // Decoded payload has the user ID
    next(); // Proceed to the next middleware or route
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};