/**
 * controllers/adminController.js
 * Admin-only operations: customer management, deposits, loans, fraud alerts, audit logs.
 * ALL routes protected by verifyAdmin middleware.
 */
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { createTokenForAdmin } = require('../services/authService');
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendUnauthorized } = require('../utils/response');
const { logAudit, ACTIONS } = require('../middleware/auditLogger');
const logger = require('../utils/logger');
const { sendDepositEmail, sendWithdrawEmail, sendLoanApprovedEmail, sendLoanRejectedEmail, sendFreezeEmail, sendUnfreezeEmail } = require('../services/notificationService');
const { sendAccountCreatedEmail } = require('../services/emailService');
const { checkAndCreateFraudAlert } = require('../services/fraudService');


/** POST /admin/login */
const adminLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.query(
      'SELECT * FROM admins WHERE username=? LIMIT 1', [username]
    );
    if (rows.length === 0) return sendUnauthorized(res, 'Invalid credentials');

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      logger.warn(`Admin login failed: ${username} | IP: ${req.ip}`);
      return sendUnauthorized(res, 'Invalid credentials');
    }

    const token = createTokenForAdmin(admin);
    await logAudit(admin.id, ACTIONS.ADMIN_LOGIN, `Admin logged in: ${username}`, req.ip);
    logger.info(`Admin login: ${username}`);
    return sendSuccess(res, { token, username: admin.username, role: 'admin' }, 'Admin login successful');
  } catch (err) {
    next(err);
  }
};

/** GET /admin/customers */
const getAllCustomers = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ` AND (customerName LIKE ? OR AccountNumber LIKE ? OR customerEmail LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) { where += ` AND AccountStatus=?`; params.push(status); }

    const [customers] = await db.query(
      `SELECT AccountNumber, customerName, AccountType, customerPhone, customerEmail,
              customerCity, Balance, AccountVerify, AccountStatus, CreatedAt
       FROM Customer ${where} ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM Customer ${where}`, params
    );
    return sendSuccess(res, { customers, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
};

/** GET /admin/customers/:accountNumber */
const getCustomerDetail = async (req, res, next) => {
  try {
    const { accountNumber } = req.params;
    const [rows] = await db.query(
      `SELECT AccountNumber, customerName, AccountType, customerPhone, customerEmail,
              customerAddress, customerCity, Balance, AccountVerify, AccountStatus, CreatedAt
       FROM Customer WHERE AccountNumber=? LIMIT 1`,
      [accountNumber]
    );
    if (rows.length === 0) return sendNotFound(res, 'Customer not found');
    return sendSuccess(res, { customer: rows[0] });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/customers/:accountNumber/freeze */
const freezeAccount = async (req, res, next) => {
  try {
    const { accountNumber } = req.params;
    const [rows] = await db.query(
      'SELECT AccountStatus, customerEmail, customerName FROM Customer WHERE AccountNumber=?',
      [accountNumber]
    );
    if (rows.length === 0) return sendNotFound(res, 'Customer not found');
    if (rows[0].AccountStatus === 'Frozen') return sendBadRequest(res, 'Account is already frozen');

    await db.query(`UPDATE Customer SET AccountStatus='Frozen' WHERE AccountNumber=?`, [accountNumber]);
    await logAudit(req.user.adminId || 'admin', ACTIONS.ACCOUNT_FREEZE,
      `Froze account: ${accountNumber}`, req.ip);
    logger.warn(`Account FROZEN: ${accountNumber} by admin ${req.user.username}`);

    // Email notification — non-blocking
    if (rows[0].customerEmail) {
      sendFreezeEmail({
        toEmail:       rows[0].customerEmail,
        customerName:  rows[0].customerName,
        accountNumber,
      }).catch(e => logger.warn(`Freeze email failed: ${e.message}`));
    }

    return sendSuccess(res, {}, 'Account frozen successfully');
  } catch (err) {
    next(err);
  }
};

/** POST /admin/customers/:accountNumber/unfreeze */
const unfreezeAccount = async (req, res, next) => {
  try {
    const { accountNumber } = req.params;
    const [rows] = await db.query(
      'SELECT customerEmail, customerName FROM Customer WHERE AccountNumber=?',
      [accountNumber]
    );
    if (rows.length === 0) return sendNotFound(res, 'Customer not found');

    await db.query(`UPDATE Customer SET AccountStatus='Active' WHERE AccountNumber=?`, [accountNumber]);
    await logAudit(req.user.adminId || 'admin', ACTIONS.ACCOUNT_UNFREEZE,
      `Unfroze account: ${accountNumber}`, req.ip);
    logger.info(`Account UNFROZEN: ${accountNumber} by admin ${req.user.username}`);

    // Email notification — non-blocking
    if (rows[0].customerEmail) {
      sendUnfreezeEmail({
        toEmail:      rows[0].customerEmail,
        customerName: rows[0].customerName,
        accountNumber,
      }).catch(e => logger.warn(`Unfreeze email failed: ${e.message}`));
    }

    return sendSuccess(res, {}, 'Account unfrozen successfully');
  } catch (err) {
    next(err);
  }
};

/** POST /admin/deposit */
const depositMoney = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { accountNumber, depositAmount, description } = req.body;
    const amount = parseFloat(depositAmount);
    const txnDescription = description?.trim() || 'Cash Deposit';

    const [rows] = await conn.query(
      'SELECT customerName, customerEmail, Balance, AccountStatus FROM Customer WHERE AccountNumber=?',
      [accountNumber]
    );
    if (rows.length === 0) return sendNotFound(res, 'Account not found');
    if (rows[0].AccountStatus !== 'Active') return sendBadRequest(res, 'Account is not active');

    const customer = rows[0];
    const newBalance = parseFloat((parseFloat(customer.Balance) + amount).toFixed(2));

    await conn.query('UPDATE Customer SET Balance=? WHERE AccountNumber=?', [newBalance, accountNumber]);

    const [txnResult] = await conn.query(
      `INSERT INTO transactions (sender_account, receiver_account, transaction_type, amount, status, description, balance_after)
       VALUES ('BANK', ?, 'DEPOSIT', ?, 'SUCCESS', ?, ?)`,
      [accountNumber, amount, txnDescription, newBalance]
    );

    await conn.commit();

    await logAudit(
      req.user?.adminId || req.user?.username || 'admin',
      ACTIONS.ADMIN_DEPOSIT,
      `Admin deposited ₹${amount} into account ${accountNumber}`,
      req.ip
    );

    // Fraud detection — non-blocking
    if (amount > 50000) {
      checkAndCreateFraudAlert({
        accountId: accountNumber,
        transactionId: txnResult.insertId,
        amount,
        type: 'DEPOSIT',
        reason: 'Large Transaction Detected',
      }).catch(e => logger.error(`Fraud alert failed: ${e.message}`));
    }

    // Email notification — non-blocking
    if (customer.customerEmail) {
      sendDepositEmail({
        toEmail:      customer.customerEmail,
        customerName: customer.customerName,
        accountNumber,
        amount,
        newBalance,
        description:  txnDescription,
      }).catch(e => logger.warn(`Deposit email failed: ${e.message}`));
    }

    logger.info(`Admin DEPOSIT ₹${amount} → ${accountNumber} | new balance ₹${newBalance}`);

    return sendSuccess(res, {
      customerName: customer.customerName,
      accountNumber,
      newBalance,
      depositAmount: amount,
      description: txnDescription,
    }, 'Deposit successful');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** POST /admin/withdraw */
const withdrawMoney = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { accountNumber, withdrawAmount, description } = req.body;
    const amount = parseFloat(withdrawAmount);
    const txnDescription = description?.trim() || 'Cash Withdrawal';

    const [rows] = await conn.query(
      'SELECT customerName, customerEmail, Balance, AccountStatus FROM Customer WHERE AccountNumber=?',
      [accountNumber]
    );
    if (rows.length === 0) return sendNotFound(res, 'Account not found');

    const customer = rows[0];
    if (customer.AccountStatus !== 'Active') return sendBadRequest(res, 'Account is not active');
    if (parseFloat(customer.Balance) < amount)
      return sendBadRequest(res, `Insufficient balance. Available: ₹${parseFloat(customer.Balance).toLocaleString('en-IN')}`);

    const newBalance = parseFloat((parseFloat(customer.Balance) - amount).toFixed(2));

    await conn.query('UPDATE Customer SET Balance=? WHERE AccountNumber=?', [newBalance, accountNumber]);

    const [txnResult] = await conn.query(
      `INSERT INTO transactions (sender_account, receiver_account, transaction_type, amount, status, description, balance_after)
       VALUES (?, 'BANK', 'WITHDRAW', ?, 'SUCCESS', ?, ?)`,
      [accountNumber, amount, txnDescription, newBalance]
    );

    await conn.commit();

    await logAudit(
      req.user?.adminId || req.user?.username || 'admin',
      ACTIONS.ADMIN_WITHDRAW,
      `Admin withdrew ₹${amount} from account ${accountNumber}`,
      req.ip
    );

    // Fraud detection — non-blocking
    if (amount > 50000) {
      checkAndCreateFraudAlert({
        accountId: accountNumber,
        transactionId: txnResult.insertId,
        amount,
        type: 'WITHDRAW',
        reason: 'Large Transaction Detected',
      }).catch(e => logger.error(`Fraud alert failed: ${e.message}`));
    }

    // Email notification — non-blocking
    if (customer.customerEmail) {
      sendWithdrawEmail({
        toEmail:      customer.customerEmail,
        customerName: customer.customerName,
        accountNumber,
        amount,
        newBalance,
        description:  txnDescription,
      }).catch(e => logger.warn(`Withdrawal email failed: ${e.message}`));
    }

    logger.info(`Admin WITHDRAW ₹${amount} ← ${accountNumber} | new balance ₹${newBalance}`);

    return sendSuccess(res, {
      customerName: customer.customerName,
      accountNumber,
      newBalance,
      withdrawAmount: amount,
      description: txnDescription,
    }, 'Withdrawal successful');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** GET /admin/loans */
const getAllLoans = async (req, res, next) => {
  try {
    const { status } = req.query;
    let where = '';
    const params = [];
    if (status) { where = 'WHERE l.ApprovalStatus=?'; params.push(status); }

    const [loans] = await db.query(
      `SELECT l.*, c.customerName, c.customerEmail, c.AccountType, c.Balance
       FROM Loan l JOIN Customer c ON l.AccountNumber=c.AccountNumber
       ${where} ORDER BY l.AppliedDate DESC`,
      params
    );
    return sendSuccess(res, { loans });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/loans/:loanId/approve */
const approveLoan = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { loanId } = req.params;
    const { approvalStatus } = req.body;  // 'Approved' | 'Denied'

    if (!['Approved', 'Denied'].includes(approvalStatus)) {
      return sendBadRequest(res, 'approvalStatus must be Approved or Denied');
    }

    const [loanRows] = await conn.query('SELECT l.*, c.customerEmail, c.customerName, c.Balance FROM Loan l JOIN Customer c ON l.AccountNumber=c.AccountNumber WHERE l.LoanID=?', [loanId]);
    if (loanRows.length === 0) return sendNotFound(res, 'Loan not found');
    if (loanRows[0].ApprovalStatus !== 'Pending') return sendBadRequest(res, 'Loan is already processed');

    const loan = loanRows[0];
    let totalPayable = 0;

    if (approvalStatus === 'Approved') {
      const interest = (parseFloat(loan.LoanAmount) * parseFloat(loan.LoanInterest) / 100)
                       * (loan.LoanDurationMonths / 12);
      totalPayable = parseFloat((parseFloat(loan.LoanAmount) + interest).toFixed(2));
    }

    await conn.query(
      `UPDATE Loan SET ApprovalStatus=?, TotalPayableAmount=?, ApprovalDate=NOW() WHERE LoanID=?`,
      [approvalStatus, totalPayable, loanId]
    );

    const action = approvalStatus === 'Approved' ? ACTIONS.LOAN_APPROVAL : ACTIONS.LOAN_REJECTION;
    await logAudit(req.user.adminId || 'admin', action,
      `Loan #${loanId} ${approvalStatus} for ${loan.AccountNumber}`, req.ip);

    await conn.commit();

    // Email notification — non-blocking
    if (loan.customerEmail) {
      if (approvalStatus === 'Approved') {
        sendLoanApprovedEmail({
          toEmail:      loan.customerEmail,
          customerName: loan.customerName,
          loanAmount:   loan.LoanAmount,
          interestRate: loan.LoanInterest,
          durationMonths: loan.LoanDurationMonths,
          newBalance:   parseFloat(loan.Balance) + parseFloat(loan.LoanAmount),
        }).catch(e => logger.warn(`Loan approved email failed: ${e.message}`));
      } else {
        sendLoanRejectedEmail({
          toEmail:      loan.customerEmail,
          customerName: loan.customerName,
        }).catch(e => logger.warn(`Loan rejected email failed: ${e.message}`));
      }
    }

    return sendSuccess(res, { loanId, approvalStatus, totalPayable }, `Loan ${approvalStatus}`);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** GET /admin/stats */
const getStats = async (req, res, next) => {
  try {
    const [[{ totalCustomers }]]   = await db.query('SELECT COUNT(*) AS totalCustomers FROM Customer');
    const [[{ totalTransactions }]]= await db.query('SELECT COUNT(*) AS totalTransactions FROM transactions');
    const [[{ totalLoans }]]       = await db.query('SELECT COUNT(*) AS totalLoans FROM Loan');
    const [[{ pendingLoans }]]     = await db.query("SELECT COUNT(*) AS pendingLoans FROM Loan WHERE ApprovalStatus='Pending'");
    const [[{ frozenAccounts }]]   = await db.query("SELECT COUNT(*) AS frozenAccounts FROM Customer WHERE AccountStatus='Frozen'");
    const [[{ totalDeposited }]]   = await db.query("SELECT COALESCE(SUM(amount),0) AS totalDeposited FROM transactions WHERE transaction_type='DEPOSIT' AND status='SUCCESS'");
    const [[{ pendingAlerts }]]    = await db.query("SELECT COUNT(*) AS pendingAlerts FROM fraud_alerts WHERE status='PENDING'");

    return sendSuccess(res, {
      totalCustomers, totalTransactions, totalLoans,
      pendingLoans, frozenAccounts, totalDeposited, pendingAlerts,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /admin/fraud-alerts */
const getFraudAlerts = async (req, res, next) => {
  try {
    const { status, riskLevel, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ` AND fa.status=?`; params.push(status); }
    if (riskLevel === 'HIGH')   { where += ` AND fa.risk_score >= 71`; }
    if (riskLevel === 'MEDIUM') { where += ` AND fa.risk_score BETWEEN 31 AND 70`; }
    if (riskLevel === 'LOW')    { where += ` AND fa.risk_score <= 30`; }
    if (search) { where += ` AND (fa.account_id LIKE ? OR fa.fraud_reason LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

    const [alerts] = await db.query(
      `SELECT fa.*, c.customerName, c.customerEmail
       FROM fraud_alerts fa
       LEFT JOIN Customer c ON c.AccountNumber = fa.account_id
       ${where} ORDER BY fa.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM fraud_alerts fa ${where}`, params
    );

    // Metrics
    const [[metrics]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(risk_score>=71) AS high,
              SUM(risk_score BETWEEN 31 AND 70) AS medium,
              SUM(risk_score<=30) AS low,
              SUM(status='RESOLVED') AS resolved,
              SUM(status='PENDING') AS pending
       FROM fraud_alerts`
    );

    return sendSuccess(res, { alerts, total, page: parseInt(page), metrics });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/fraud-alerts/:alertId/resolve */
const resolveFraudAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { status, notes } = req.body;  // 'REVIEWED' | 'RESOLVED'
    if (!['REVIEWED', 'RESOLVED'].includes(status)) return sendBadRequest(res, 'Invalid status');

    const [rows] = await db.query('SELECT * FROM fraud_alerts WHERE alert_id=?', [alertId]);
    if (rows.length === 0) return sendNotFound(res, 'Alert not found');

    await db.query('UPDATE fraud_alerts SET status=?, resolved_at=NOW() WHERE alert_id=?', [status, alertId]);
    await logAudit(req.user.adminId || 'admin', ACTIONS.FRAUD_ALERT,
      `Alert #${alertId} marked ${status}. Notes: ${notes || 'N/A'}`, req.ip);

    return sendSuccess(res, {}, `Alert marked as ${status}`);
  } catch (err) {
    next(err);
  }
};

/** GET /admin/audit-logs */
const getAuditLogs = async (req, res, next) => {
  try {
    const { userId, action, startDate, endDate, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];

    if (userId) { where += ` AND user_id LIKE ?`; params.push(`%${userId}%`); }
    if (action) { where += ` AND action=?`; params.push(action); }
    if (startDate) { where += ` AND DATE(created_at)>=?`; params.push(startDate); }
    if (endDate)   { where += ` AND DATE(created_at)<=?`; params.push(endDate); }

    const [logs] = await db.query(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM audit_logs ${where}`, params);
    return sendSuccess(res, { logs, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
};

/** GET /admin/audit-logs/export — CSV export */
const exportAuditLogs = async (req, res, next) => {
  try {
    const [logs] = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC');
    const csv = [
      'log_id,user_id,action,description,ip_address,created_at',
      ...logs.map(l =>
        `${l.log_id},"${l.user_id}","${l.action}","${(l.description||'').replace(/"/g,'""')}","${l.ip_address}","${l.created_at}"`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

/** GET /admin/transactions */
const getAllTransactions = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (type) { where += ` AND transaction_type=?`; params.push(type); }

    const [txns] = await db.query(
      `SELECT t.*, c.customerName FROM transactions t
       LEFT JOIN Customer c ON c.AccountNumber=t.sender_account
       ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM transactions ${where}`, params
    );
    return sendSuccess(res, { transactions: txns, total });
  } catch (err) {
    next(err);
  }
};

/** POST /admin/verify-customer */
const verifyCustomer = async (req, res, next) => {
  try {
    const { accountNumber } = req.body;
    if (!accountNumber) {
      return sendBadRequest(res, 'Account number is required');
    }

    const [rows] = await db.query(
      'SELECT AccountNumber, customerName, customerEmail, customerPhone, AccountVerify, AccountStatus FROM Customer WHERE AccountNumber=? LIMIT 1',
      [accountNumber]
    );

    if (rows.length === 0) {
      return sendNotFound(res, 'Customer not found');
    }

    const customer = rows[0];

    // Update customer to Verified and Active
    await db.query(
      "UPDATE Customer SET AccountVerify=1, AccountStatus='Active' WHERE AccountNumber=?",
      [accountNumber]
    );

    await logAudit(
      req.user.adminId || 'admin',
      'CUSTOMER_VERIFICATION',
      `Customer approved and activated: ${accountNumber} (${customer.customerEmail})`,
      req.ip
    );
    logger.info(`Customer APPROVED & ACTIVATED: ${accountNumber} by admin ${req.user.username || 'admin'}`);

    // Send the post-approval Account Created email asynchronously (non-blocking for response)
    if (customer.customerEmail) {
      sendAccountCreatedEmail(
        customer.customerEmail,
        customer.customerName,
        customer.AccountNumber,
        customer.customerPhone
      ).catch(e => logger.warn(`Account created email error for ${customer.customerEmail}: ${e.message}`));
    }

    return sendSuccess(res, {
      accountNumber: customer.AccountNumber,
      customerEmail: customer.customerEmail,
      status: 'Active',
      verified: true,
    }, 'Customer approved successfully. Account activated and confirmation email queued.');
  } catch (err) {
    next(err);
  }
};


module.exports = {
  adminLogin, getAllCustomers, getCustomerDetail, freezeAccount, unfreezeAccount,
  depositMoney, withdrawMoney, getAllLoans, approveLoan, getStats, getFraudAlerts,
  resolveFraudAlert, getAuditLogs, exportAuditLogs, getAllTransactions, verifyCustomer,
};
