/**
 * middleware/auth.js
 * JWT authentication and Role-Based Access Control middleware.
 * - verifyToken   : any valid JWT
 * - verifyUser    : role must be 'user'
 * - verifyAdmin   : role must be 'admin'
 */
const JWT = require('jsonwebtoken');
const { sendUnauthorized, sendForbidden } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Verifies JWT from Authorization: Bearer <token> header.
 * Attaches decoded payload to req.user.
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Access denied. No token provided.');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = JWT.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn(`Invalid token attempt | IP: ${req.ip} | ${err.message}`);
    return sendUnauthorized(res, err.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.');
  }
};

/**
 * Allows only authenticated customers.
 */
const verifyUser = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== 'user') {
      logger.warn(`Role violation: ${req.user.role} tried customer route | IP: ${req.ip}`);
      return sendForbidden(res, 'Access denied. Customer access only.');
    }
    next();
  });
};

/**
 * Allows only authenticated admins.
 */
const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') {
      logger.warn(`SECURITY: Non-admin tried admin route | User: ${req.user.AccNumber} | IP: ${req.ip}`);
      return sendForbidden(res, 'Access denied. Admin access only.');
    }
    next();
  });
};

module.exports = { verifyToken, verifyUser, verifyAdmin };
