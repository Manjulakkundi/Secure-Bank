/**
 * controllers/loanController.js
 * Customer loan application and loan history.
 */
const db = require('../config/database');
const { sendSuccess, sendBadRequest, sendNotFound, sendCreated } = require('../utils/response');
const { logAudit, ACTIONS } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/** POST /customer/apply-loan */
const applyLoan = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { loanAmount, loanDurationMonths } = req.body;
    const accountNumber = req.user.AccNumber;

    const [customerData] = await conn.query(
      'SELECT AccountType FROM Customer WHERE AccountNumber=?', [accountNumber]
    );
    if (customerData.length === 0) return sendNotFound(res, 'Account not found');

    const interestRate = customerData[0].AccountType === 'Savings' ? 5 : 6;

    const [result] = await conn.query(
      `INSERT INTO Loan (AccountNumber, LoanAmount, LoanDurationMonths, LoanInterest, ApprovalStatus)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [accountNumber, loanAmount, loanDurationMonths, interestRate]
    );

    await conn.commit();
    await logAudit(accountNumber, ACTIONS.LOAN_REQUEST,
      `Loan applied: ₹${loanAmount} for ${loanDurationMonths} months`, req.ip);

    return sendCreated(res, { loanId: result.insertId, interestRate }, 'Loan application submitted successfully');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/** GET /customer/my-loans */
const getMyLoans = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const [loans] = await db.query(
      'SELECT * FROM Loan WHERE AccountNumber=? ORDER BY AppliedDate DESC', [accountNumber]
    );
    return sendSuccess(res, { loans });
  } catch (err) {
    next(err);
  }
};

module.exports = { applyLoan, getMyLoans };
