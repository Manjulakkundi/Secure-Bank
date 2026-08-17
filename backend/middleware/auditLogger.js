/**
 * middleware/auditLogger.js
 * Utility to log user actions into the audit_logs table.
 * Tracks: login, logout, deposit, withdraw, transfer, loan, freeze, OTP events, etc.
 */
const db = require('../config/database');
const logger = require('../utils/logger');

const ACTIONS = {
  LOGIN:              'LOGIN',
  LOGOUT:             'LOGOUT',
  SIGNUP:             'SIGNUP',
  PASSWORD_CHANGE:    'PASSWORD_CHANGE',
  PASSWORD_RESET:     'PASSWORD_RESET',
  DEPOSIT:            'DEPOSIT',
  WITHDRAW:           'WITHDRAW',
  ADMIN_DEPOSIT:      'ADMIN_DEPOSIT',
  ADMIN_WITHDRAW:     'ADMIN_WITHDRAW',
  TRANSFER:           'TRANSFER',
  LOAN_REQUEST:       'LOAN_REQUEST',
  LOAN_APPROVAL:      'LOAN_APPROVAL',
  LOAN_REJECTION:     'LOAN_REJECTION',
  ACCOUNT_FREEZE:     'ACCOUNT_FREEZE',
  ACCOUNT_UNFREEZE:   'ACCOUNT_UNFREEZE',
  BENEFICIARY_ADD:    'BENEFICIARY_ADD',
  BENEFICIARY_REMOVE: 'BENEFICIARY_REMOVE',
  OTP_SENT:           'OTP_SENT',
  OTP_VERIFIED:       'OTP_VERIFIED',
  ADMIN_LOGIN:        'ADMIN_LOGIN',
  CUSTOMER_LOGIN:     'CUSTOMER_LOGIN',
  FRAUD_ALERT:        'FRAUD_ALERT',
};

/**
 * Log an audit event.
 * @param {string} userId      - Account number or admin ID
 * @param {string} action      - One of ACTIONS constants
 * @param {string} description - Human-readable detail
 * @param {string} ipAddress   - Request IP
 * @param {object} [conn]      - Optional DB connection (for transactional context)
 */
const logAudit = async (userId, action, description, ipAddress = 'unknown', conn = null) => {
  try {
    const executor = conn || db;
    await executor.query(
      `INSERT INTO audit_logs (user_id, action, description, ip_address) VALUES (?, ?, ?, ?)`,
      [userId, action, description, ipAddress]
    );
  } catch (err) {
    // Audit failure must never crash business operations
    logger.error(`Audit log failed: ${err.message} | action=${action} user=${userId}`);
  }
};

module.exports = { logAudit, ACTIONS };
