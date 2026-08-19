/**
 * services/authService.js
 * JWT token creation for customers and admins.
 * Secrets come from .env — never hardcoded.
 */
const JWT = require('jsonwebtoken');

/**
 * Create JWT for authenticated customer.
 * Payload is minimal — no full PII stored in token.
 */
const createTokenForUser = (user) => {
  const payload = {
    AccNumber:     user.accountNumber,
    accountNumber: user.accountNumber,
    customerName:  user.customerName,
    AccountType:   user.AccountType,
    role:          'user',
  };
  return JWT.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
};


/**
 * Create JWT for authenticated admin.
 */
const createTokenForAdmin = (admin) => {
  const payload = {
    adminId:   admin.id,
    username:  admin.username,
    role:      'admin',
  };
  return JWT.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
};

module.exports = { createTokenForUser, createTokenForAdmin };
