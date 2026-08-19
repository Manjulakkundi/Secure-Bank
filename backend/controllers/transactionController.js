/**
 * controllers/transactionController.js
 * Handles: deposit, withdraw, transfer, history, statement, mini-statement.
 */
const db = require('../config/database');
const { sendSuccess, sendBadRequest, sendNotFound, sendError } = require('../utils/response');
const { logAudit, ACTIONS } = require('../middleware/auditLogger');
const { evaluateTransaction, saveFraudAlert } = require('../services/fraudService');
const { sendTransferSentEmail, sendTransferReceivedEmail, sendWithdrawEmail } = require('../services/notificationService');
const { generateStatement } = require('../services/pdfService');
const logger = require('../utils/logger');

/** POST /customer/withdraw */
const withdraw = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { withdrawAmount } = req.body;
    const accountNumber = req.user.AccNumber;
    const amount = parseFloat(withdrawAmount);

    const [rows] = await conn.query(
      'SELECT Balance, AccountStatus, customerEmail, customerName FROM Customer WHERE AccountNumber=?',
      [accountNumber]
    );
    if (rows.length === 0) return sendNotFound(res, 'Account not found');
    if (rows[0].AccountStatus === 'Frozen') return sendBadRequest(res, 'Account is frozen');

    const currentBalance = parseFloat(rows[0].Balance);
    if (currentBalance < amount) return sendBadRequest(res, 'Insufficient balance');

    const newBalance = parseFloat((currentBalance - amount).toFixed(2));

    await conn.query('UPDATE Customer SET Balance=? WHERE AccountNumber=?', [newBalance, accountNumber]);
    const [txnResult] = await conn.query(
      `INSERT INTO transactions (sender_account, transaction_type, amount, status, description, balance_after)
       VALUES (?, 'WITHDRAW', ?, 'SUCCESS', ?, ?)`,
      [accountNumber, amount, `Withdrawal of ₹${amount}`, newBalance]
    );

    await conn.commit();

    // Send withdrawal email notification asynchronously (non-blocking)
    if (rows[0].customerEmail) {
      sendWithdrawEmail({
        toEmail:       rows[0].customerEmail,
        customerName:  rows[0].customerName,
        accountNumber,
        amount,
        newBalance,
        description:   `Withdrawal of ₹${amount}`,
      }).catch((e) => logger.warn(`Withdrawal email failed: ${e.message}`));
    }

    await logAudit(accountNumber, ACTIONS.WITHDRAW,
      `Withdrew ₹${amount}. New balance: ₹${newBalance}`, req.ip);
    logger.info(`Withdraw: ${accountNumber} ₹${amount}`);

    return sendSuccess(res, { newBalance, transactionId: txnResult.insertId }, 'Withdrawal successful');

  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** POST /customer/transfer */
const transfer = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { toAccount, transferAmount } = req.body;
    const accountNumber = req.user.AccNumber;
    const amount = parseFloat(parseFloat(transferAmount).toFixed(2));

    if (accountNumber === toAccount) return sendBadRequest(res, 'Cannot transfer to your own account');

    // Fetch sender
    const [senderRows] = await conn.query(
      'SELECT Balance, AccountStatus, customerEmail, customerName FROM Customer WHERE AccountNumber=?',
      [accountNumber]
    );
    if (senderRows.length === 0) return sendNotFound(res, 'Sender account not found');
    if (senderRows[0].AccountStatus === 'Frozen') return sendBadRequest(res, 'Your account is frozen');

    const senderBalance = parseFloat(senderRows[0].Balance);
    if (senderBalance < amount) {
      // Log failed transfer attempt
      await conn.query(
        `INSERT INTO transactions (sender_account, receiver_account, transaction_type, amount, status, description)
         VALUES (?, ?, 'TRANSFER', ?, 'FAILED', 'Insufficient balance')`,
        [accountNumber, toAccount, amount]
      );
      await conn.commit();
      return sendBadRequest(res, 'Insufficient balance');
    }

    // Fetch receiver
    const [receiverRows] = await conn.query(
      'SELECT Balance, AccountStatus, customerEmail, customerName FROM Customer WHERE AccountNumber=?',
      [toAccount]
    );
    if (receiverRows.length === 0) {
      await conn.query(
        `INSERT INTO transactions (sender_account, receiver_account, transaction_type, amount, status, description)
         VALUES (?, ?, 'TRANSFER', ?, 'FAILED', 'Receiver account not found')`,
        [accountNumber, toAccount, amount]
      );
      await conn.commit();
      return sendNotFound(res, 'Receiver account not found');
    }
    if (receiverRows[0].AccountStatus === 'Frozen') return sendBadRequest(res, 'Receiver account is frozen');

    // Fraud evaluation BEFORE committing
    const fraudResult = await evaluateTransaction(accountNumber, amount, toAccount, conn);

    const newSenderBalance   = parseFloat((senderBalance - amount).toFixed(2));
    const newReceiverBalance = parseFloat((parseFloat(receiverRows[0].Balance) + amount).toFixed(2));

    await conn.query('UPDATE Customer SET Balance=? WHERE AccountNumber=?', [newSenderBalance, accountNumber]);
    await conn.query('UPDATE Customer SET Balance=? WHERE AccountNumber=?', [newReceiverBalance, toAccount]);

    const [txnResult] = await conn.query(
      `INSERT INTO transactions
        (sender_account, receiver_account, transaction_type, amount, status, description, balance_after)
       VALUES (?, ?, 'TRANSFER', ?, 'SUCCESS', ?, ?)`,
      [accountNumber, toAccount, amount,
       `Transfer to ${toAccount}`, newSenderBalance]
    );
    await conn.query(
      `INSERT INTO transactions
        (sender_account, receiver_account, transaction_type, amount, status, description, balance_after)
       VALUES (?, ?, 'RECEIVE', ?, 'SUCCESS', ?, ?)`,
      [toAccount, accountNumber, amount,
       `Received from ${accountNumber}`, newReceiverBalance]
    );

    // Save fraud alert if triggered
    if (fraudResult.triggeredRules.length > 0) {
      await saveFraudAlert(txnResult.insertId, accountNumber, fraudResult.riskScore,
        fraudResult.triggeredRules, conn);
    }

    await conn.commit();

    // Email notifications (non-blocking)
    sendTransferSentEmail({
      toEmail:         senderRows[0].customerEmail,
      senderName:      senderRows[0].customerName,
      amount,
      receiverAccount: toAccount,
      senderBalance:   newSenderBalance,
      transactionId:   txnResult.insertId,
    }).catch(() => {});
    sendTransferReceivedEmail({
      toEmail:          receiverRows[0].customerEmail,
      receiverName:     receiverRows[0].customerName,
      amount,
      senderAccount:    accountNumber,
      receiverBalance:  newReceiverBalance,
      transactionId:    txnResult.insertId,
    }).catch(() => {});

    await logAudit(accountNumber, ACTIONS.TRANSFER,
      `Transferred ₹${amount} to ${toAccount}`, req.ip);
    logger.info(`Transfer: ${accountNumber} → ${toAccount} ₹${amount}`);

    return sendSuccess(res, {
      transactionId:    txnResult.insertId,
      newBalance:       newSenderBalance,
      receiverAccount:  toAccount,
      amount,
      fraudAlert:       fraudResult.triggeredRules.length > 0 ? {
        riskLevel:      fraudResult.riskLevel,
        riskScore:      fraudResult.riskScore,
        message:        'Transaction flagged for review',
      } : null,
    }, 'Transfer successful');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** GET /customer/account-info */
const getAccountInfo = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const [rows] = await db.query(
      `SELECT c.AccountNumber, c.customerName, c.AccountType, c.customerPhone,
              c.customerEmail, c.customerCity, c.Balance, c.AccountVerify, c.AccountStatus,
              COALESCE(SUM(l.LoanAmount), 0) AS totalLoans
       FROM Customer c
       LEFT JOIN Loan l ON l.AccountNumber = c.AccountNumber AND l.ApprovalStatus='Approved'
       WHERE c.AccountNumber=?
       GROUP BY c.AccountNumber`,
      [accountNumber]
    );
    if (rows.length === 0) return sendNotFound(res, 'Account not found');
    const { CustomerPassword, ...safeData } = rows[0];
    return sendSuccess(res, safeData);
  } catch (err) {
    next(err);
  }
};

/** GET /customer/transactions */
const getTransactions = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const { type, startDate, endDate, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = `WHERE (sender_account=? OR receiver_account=?)`;
    const params = [accountNumber, accountNumber];

    if (type) { where += ` AND transaction_type=?`; params.push(type); }
    if (startDate) { where += ` AND DATE(created_at) >= ?`; params.push(startDate); }
    if (endDate)   { where += ` AND DATE(created_at) <= ?`; params.push(endDate); }
    if (search)    { where += ` AND (description LIKE ? OR CAST(amount AS CHAR) LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

    const [txns] = await db.query(
      `SELECT * FROM transactions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM transactions ${where}`, params
    );

    return sendSuccess(res, { transactions: txns, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
};

/** GET /customer/mini-statement — last 10 transactions */
const getMiniStatement = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const [txns] = await db.query(
      `SELECT * FROM transactions WHERE sender_account=? OR receiver_account=?
       ORDER BY created_at DESC LIMIT 10`,
      [accountNumber, accountNumber]
    );
    return sendSuccess(res, { transactions: txns });
  } catch (err) {
    next(err);
  }
};

/** GET /customer/monthly-statement */
const getMonthlyStatement = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const { year, month } = req.query;
    const y = year || new Date().getFullYear();
    const m = month || (new Date().getMonth() + 1);

    const [txns] = await db.query(
      `SELECT * FROM transactions
       WHERE (sender_account=? OR receiver_account=?)
         AND YEAR(created_at)=? AND MONTH(created_at)=?
       ORDER BY created_at ASC`,
      [accountNumber, accountNumber, y, m]
    );

    const totalDebit  = txns.filter(t => t.sender_account === accountNumber).reduce((s, t) => s + parseFloat(t.amount), 0);
    const totalCredit = txns.filter(t => t.receiver_account === accountNumber).reduce((s, t) => s + parseFloat(t.amount), 0);

    return sendSuccess(res, { transactions: txns, totalDebit, totalCredit, year: y, month: m });
  } catch (err) {
    next(err);
  }
};

/** GET /customer/statement-pdf */
const downloadStatement = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const { startDate, endDate } = req.query;

    const [customers] = await db.query('SELECT * FROM Customer WHERE AccountNumber=?', [accountNumber]);
    if (customers.length === 0) return sendNotFound(res, 'Account not found');

    let where = `WHERE (sender_account=? OR receiver_account=?)`;
    const params = [accountNumber, accountNumber];
    if (startDate) { where += ` AND DATE(created_at)>=?`; params.push(startDate); }
    if (endDate)   { where += ` AND DATE(created_at)<=?`; params.push(endDate); }

    const [txns] = await db.query(
      `SELECT * FROM transactions ${where} ORDER BY created_at ASC`, params
    );

    generateStatement(res, customers[0], txns, startDate, endDate);
  } catch (err) {
    next(err);
  }
};

module.exports = { withdraw, transfer, getAccountInfo, getTransactions, getMiniStatement, getMonthlyStatement, downloadStatement };
