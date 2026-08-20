/**
 * controllers/authController.js
 * Handles: signup, login (account/email/phone), OTP verification, password reset,
 * forgot account number.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { createTokenForUser } = require('../services/authService');
const { sendOtpEmail, sendWelcomeEmail, sendAccountNumberEmail } = require('../services/emailService');
const { generateAccountNumber } = require('../utils/accountNumber');
const { sendSuccess, sendCreated, sendBadRequest, sendUnauthorized, sendNotFound, sendError } = require('../utils/response');
const { logAudit, ACTIONS } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/** POST /customer/signup */
const signup = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { customerName, AccountType, customerPhone, customerEmail,
            customerAddress, customerCity, CustomerPassword } = req.body;

    const cleanEmail = customerEmail ? customerEmail.trim().toLowerCase() : '';
    const cleanPhone = customerPhone ? customerPhone.trim() : '';
    const cleanName  = customerName ? customerName.trim() : '';
    const cleanAddress = customerAddress ? customerAddress.trim() : '';
    const cleanCity  = customerCity ? customerCity.trim() : '';

    const [existing] = await conn.query(
      'SELECT 1 FROM Customer WHERE LOWER(customerEmail)=LOWER(?) OR customerPhone=? LIMIT 1',
      [cleanEmail, cleanPhone]
    );
    if (existing.length > 0) {
      return sendBadRequest(res, 'Email or phone number already registered');
    }

    const hashedPassword = await bcrypt.hash(CustomerPassword, 12);
    const accountNumber  = await generateAccountNumber();

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO Customer
        (AccountNumber, customerName, AccountType, customerPhone, customerEmail,
         customerAddress, customerCity, CustomerPassword, Balance, AccountVerify, AccountStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Active')`,
      [accountNumber, cleanName, AccountType || 'Savings', cleanPhone, cleanEmail,
       cleanAddress, cleanCity, hashedPassword]
    );

    await conn.commit();


    await logAudit(accountNumber, ACTIONS.SIGNUP, `New account registered (Pending Admin Verification): ${cleanEmail}`, req.ip);
    logger.info(`Customer Registered: ${accountNumber} (${cleanEmail}) — Status: Pending Verification`);

    return sendCreated(res, { accountNumber, email: cleanEmail },
      'Registration submitted successfully. Your account will be activated after admin verification.');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** POST /customer/login — supports identifier, accountNumber, email, or phone */
const login = async (req, res, next) => {
  try {
    const { identifier, accountNumber, email, phone, password } = req.body;

    // Detect login type & normalize parameters
    let query, param, idType;
    if (accountNumber && typeof accountNumber === 'string' && accountNumber.trim()) {
      query = 'SELECT * FROM Customer WHERE AccountNumber = ? LIMIT 1';
      param = accountNumber.trim();
      idType = 'accountNumber';
    } else if (email && typeof email === 'string' && email.trim()) {
      query = 'SELECT * FROM Customer WHERE LOWER(customerEmail) = LOWER(?) LIMIT 1';
      param = email.trim().toLowerCase();
      idType = 'email';
    } else if (phone && typeof phone === 'string' && phone.trim()) {
      query = 'SELECT * FROM Customer WHERE customerPhone = ? LIMIT 1';
      param = phone.trim();
      idType = 'phone';
    } else if (identifier && typeof identifier === 'string' && identifier.trim()) {
      const cleanId = identifier.trim();
      if (cleanId.includes('@')) {
        query = 'SELECT * FROM Customer WHERE LOWER(customerEmail) = LOWER(?) LIMIT 1';
        param = cleanId.toLowerCase();
        idType = 'email';
      } else if (/^[0-9]{10}$/.test(cleanId)) {
        query = 'SELECT * FROM Customer WHERE customerPhone = ? OR AccountNumber = ? LIMIT 1';
        param = cleanId;
        idType = 'phone/accountNumber';
      } else {
        query = 'SELECT * FROM Customer WHERE AccountNumber = ? OR customerPhone = ? OR LOWER(customerEmail) = LOWER(?) LIMIT 1';
        param = cleanId;
        idType = 'identifier';
      }
    } else {
      return sendBadRequest(res, 'Provide account number, email, or phone number');
    }

    const [rows] = await db.query(query, query.includes('OR') ? [param, param, param].slice(0, (query.match(/\?/g) || []).length) : [param]);

    if (rows.length === 0) {
      logger.warn(`Login attempt [${idType}]: user found = false | IP: ${req.ip}`);
      return sendUnauthorized(res, 'Invalid credentials');
    }

    const user = rows[0];

    // Password must always be checked securely
    const passwordMatch = await bcrypt.compare(password, user.CustomerPassword);
    if (!passwordMatch) {
      logger.warn(`Login failed: wrong password for account ${user.AccountNumber} | IP: ${req.ip}`);
      return sendUnauthorized(res, 'Invalid credentials');
    }

    // Account status & verification checks
    if (user.AccountStatus === 'Frozen') {
      return sendUnauthorized(res, 'Your account has been frozen. Contact support.');
    }

    if (Number(user.AccountVerify) !== 1 || user.AccountStatus !== 'Active') {
      return sendUnauthorized(res, 'Your account is pending admin verification. You will be able to log in after your account is approved.');
    }



    const token = createTokenForUser({
      accountNumber: user.AccountNumber,
      customerName:  user.customerName,
      AccountType:   user.AccountType,
    });

    await logAudit(user.AccountNumber, ACTIONS.CUSTOMER_LOGIN, 'Customer logged in', req.ip);
    logger.info(`Login success: ${user.AccountNumber} (${user.customerEmail})`);
    return sendSuccess(res, {
      token,
      accountNumber:   user.AccountNumber,
      customerName:    user.customerName,
      AccountType:     user.AccountType,
      accountVerified: user.AccountVerify === 1,
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};


/** POST /customer/verify-otp */
const verifyOtp = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { email, otp } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    const [rows] = await conn.query(
      `SELECT * FROM otp_verifications WHERE LOWER(email)=LOWER(?) AND purpose='SIGNUP' AND used=0 ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail]
    );

    if (rows.length === 0) return sendBadRequest(res, 'No pending OTP found for this email');
    const record = rows[0];

    if (new Date() > new Date(record.expires_at)) {
      return sendBadRequest(res, 'OTP has expired. Please request a new one.');
    }

    const match = await bcrypt.compare(otp, record.otp_hash);
    if (!match) return sendBadRequest(res, 'Invalid OTP');

    await conn.beginTransaction();
    await conn.query(`UPDATE Customer SET AccountVerify=1 WHERE LOWER(customerEmail)=LOWER(?)`, [cleanEmail]);
    await conn.query(`UPDATE otp_verifications SET used=1 WHERE id=?`, [record.id]);

    // Fetch full customer details for welcome email
    const [custRows] = await conn.query(
      'SELECT AccountNumber, customerName, AccountType, CreatedAt FROM Customer WHERE LOWER(customerEmail)=LOWER(?)',
      [cleanEmail]
    );

    await conn.commit();

    await logAudit(cleanEmail, ACTIONS.OTP_VERIFIED, 'Email verified', req.ip);

    // Send welcome email AFTER verification — account is now confirmed active
    if (custRows.length > 0) {
      const c = custRows[0];
      sendWelcomeEmail(cleanEmail, c.customerName, c.AccountNumber, c.AccountType, c.CreatedAt)
        .catch(e => logger.warn(`Welcome email failed: ${e.message}`));
    }

    return sendSuccess(res, {}, 'Email verified successfully. You can now login.');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** POST /customer/resend-otp */
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    const [users] = await db.query('SELECT AccountNumber FROM Customer WHERE LOWER(customerEmail)=LOWER(?)', [cleanEmail]);
    if (users.length === 0) return sendNotFound(res, 'Email not found');

    const otp       = crypto.randomInt(100000, 999999).toString();
    const otpHash   = await bcrypt.hash(otp, 8);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60000);

    await db.query(
      `INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at)
       VALUES (?, ?, 'SIGNUP', ?)
       ON DUPLICATE KEY UPDATE otp_hash=?, expires_at=?, used=0`,
      [cleanEmail, otpHash, expiresAt, otpHash, expiresAt]
    );

    sendOtpEmail(cleanEmail, otp, 'SIGNUP')
      .catch(e => logger.warn(`Resend OTP email error for ${cleanEmail}: ${e.message}`));

    await logAudit(users[0].AccountNumber, ACTIONS.OTP_SENT, 'OTP resent', req.ip);
    return sendSuccess(res, {}, 'OTP resent to your email');
  } catch (err) {
    next(err);
  }
};

/** POST /customer/forgot-password */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    const [users] = await db.query('SELECT AccountNumber FROM Customer WHERE LOWER(customerEmail)=LOWER(?)', [cleanEmail]);
    if (users.length === 0) return sendSuccess(res, {}, 'If this email exists, an OTP has been sent.');

    const otp       = crypto.randomInt(100000, 999999).toString();
    const otpHash   = await bcrypt.hash(otp, 8);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60000);

    await db.query(
      `INSERT INTO otp_verifications (email, otp_hash, purpose, expires_at)
       VALUES (?, ?, 'PASSWORD_RESET', ?)
       ON DUPLICATE KEY UPDATE otp_hash=?, expires_at=?, used=0`,
      [cleanEmail, otpHash, expiresAt, otpHash, expiresAt]
    );

    sendOtpEmail(cleanEmail, otp, 'PASSWORD_RESET')
      .catch(e => logger.warn(`Password reset OTP email error for ${cleanEmail}: ${e.message}`));

    await logAudit(users[0].AccountNumber, ACTIONS.OTP_SENT, 'Password reset OTP sent', req.ip);
    return sendSuccess(res, {}, 'If this email exists, an OTP has been sent.');
  } catch (err) {
    next(err);
  }
};

/** POST /customer/reset-password */
const resetPassword = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { email, otp, newPassword } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    const [rows] = await conn.query(
      `SELECT * FROM otp_verifications WHERE LOWER(email)=LOWER(?) AND purpose='PASSWORD_RESET' AND used=0 ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail]
    );
    if (rows.length === 0) return sendBadRequest(res, 'No pending password reset request');
    const record = rows[0];

    if (new Date() > new Date(record.expires_at)) return sendBadRequest(res, 'OTP expired');
    const match = await bcrypt.compare(otp, record.otp_hash);
    if (!match) return sendBadRequest(res, 'Invalid OTP');

    const hashed = await bcrypt.hash(newPassword, 12);
    await conn.beginTransaction();
    await conn.query(`UPDATE Customer SET CustomerPassword=? WHERE LOWER(customerEmail)=LOWER(?)`, [hashed, cleanEmail]);
    await conn.query(`UPDATE otp_verifications SET used=1 WHERE id=?`, [record.id]);
    await conn.commit();

    const [users] = await db.query('SELECT AccountNumber FROM Customer WHERE LOWER(customerEmail)=LOWER(?)', [cleanEmail]);
    await logAudit(users[0]?.AccountNumber || cleanEmail, ACTIONS.PASSWORD_RESET, 'Password reset via OTP', req.ip);
    return sendSuccess(res, {}, 'Password reset successfully. Please login.');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** POST /customer/forgot-account-number */
const forgotAccountNumber = async (req, res, next) => {
  try {
    const { email } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    const [users] = await db.query(
      'SELECT AccountNumber, customerName, AccountStatus FROM Customer WHERE LOWER(customerEmail)=LOWER(?)', [cleanEmail]
    );
    // Always generic response — don't leak existence
    if (users.length === 0) {
      return sendSuccess(res, {}, 'If this email is registered, your account number has been sent.');
    }

    const { AccountNumber, customerName, AccountStatus } = users[0];
    sendAccountNumberEmail(cleanEmail, customerName, AccountNumber, AccountStatus)
      .catch(e => logger.warn(`Account recovery email error for ${cleanEmail}: ${e.message}`));

    await logAudit(AccountNumber, 'ACCOUNT_RECOVERY', 'Account number recovery requested', req.ip);
    return sendSuccess(res, {}, 'If this email is registered, your account number has been sent.');
  } catch (err) {
    next(err);
  }
};


/** GET /customer/profile — return full profile for logged-in customer */
const getProfile = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const [rows] = await db.query(
      `SELECT AccountNumber, customerName, AccountType, customerPhone, customerEmail,
              customerAddress, customerCity, Balance, AccountVerify, AccountStatus, CreatedAt
       FROM Customer WHERE AccountNumber=? LIMIT 1`,
      [accountNumber]
    );
    if (rows.length === 0) return sendNotFound(res, 'Account not found');
    return sendSuccess(res, rows[0]);
  } catch (err) {
    next(err);
  }
};

/** PUT /customer/profile — update profile fields */
const updateProfile = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const { customerName, customerPhone, customerAddress, customerCity } = req.body;

    await db.query(
      `UPDATE Customer SET customerName=?, customerPhone=?, customerAddress=?, customerCity=?
       WHERE AccountNumber=?`,
      [customerName, customerPhone, customerAddress, customerCity, accountNumber]
    );

    await logAudit(accountNumber, 'PROFILE_UPDATE', 'Profile updated', req.ip);
    return sendSuccess(res, {}, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
};

/** PUT /customer/change-password */
const changePassword = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const { currentPassword, newPassword } = req.body;

    const [rows] = await db.query(
      'SELECT CustomerPassword FROM Customer WHERE AccountNumber=?', [accountNumber]
    );
    if (rows.length === 0) return sendNotFound(res, 'Account not found');

    const match = await bcrypt.compare(currentPassword, rows[0].CustomerPassword);
    if (!match) return sendBadRequest(res, 'Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE Customer SET CustomerPassword=? WHERE AccountNumber=?', [hashed, accountNumber]);
    await logAudit(accountNumber, 'PASSWORD_CHANGE', 'Password changed', req.ip);
    return sendSuccess(res, {}, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  signup, login, verifyOtp, resendOtp,
  forgotPassword, resetPassword,
  forgotAccountNumber,
  getProfile, updateProfile, changePassword,
};
