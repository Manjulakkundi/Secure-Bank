/**
 * middleware/errorHandler.js
 * Global error handling middleware.
 * Catches all errors passed via next(err) from route handlers.
 * Never exposes stack traces in production.
 */
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  // Log full error internally
  logger.error(`${err.message} | ${req.method} ${req.originalUrl} | IP: ${req.ip}`, err);

  // Determine status code
  let statusCode = err.statusCode || err.status || 500;
  let message    = err.message || 'Internal server error';

  // Handle specific MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'A record with this value already exists';
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Referenced record does not exist';
  }

  // Never leak internal details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred. Please try again later.';
  }

  return sendError(res, message, statusCode, process.env.NODE_ENV !== 'production' ? err.stack : undefined);
};

// 404 handler — must be mounted before errorHandler
const notFoundHandler = (req, res) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

module.exports = { errorHandler, notFoundHandler };
