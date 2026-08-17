/**
 * controllers/investmentController.js
 * Comprehensive backend controller for Fixed Deposits (FD), Recurring Deposits (RD),
 * and Investment Portfolio Management.
 * 
 * Rules:
 * - Strict backend validation and financial calculation authority
 * - ACID MySQL transactions with SELECT ... FOR UPDATE row-locking
 * - Zero auto-debit on RD creation or monthly installments
 * - Complete rollback on insufficient balance
 */
const db = require('../config/database');
const {
  INVESTMENT_RATES,
  calculateFd,
  calculateRdSchedule,
  calculateActualRdMaturity,
  addMonths,
} = require('../config/investmentRates');
const {
  sendFdCreatedEmail,
  sendRdCreatedEmail,
  sendRdContributionEmail,
} = require('../services/emailService');
const { sendSuccess, sendBadRequest, sendNotFound, sendError } = require('../utils/response');
const { logAudit, ACTIONS } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/**
 * GET /customer/investments/rates
 * Returns the centralized rate sheet and tenure options.
 */
const getRates = async (req, res) => {
  return sendSuccess(res, {
    rates: INVESTMENT_RATES,
    minFdAmount: 1000,
    minRdMonthly: 500,
    disclaimer: 'Investment values, interest rates and returns shown in this application are simulated for demonstration purposes and do not represent guaranteed real-world returns or financial advice.',
  }, 'Investment rates fetched successfully');
};

/**
 * GET /customer/investments
 * Returns customer investment overview, active/matured FDs, and RDs with full contribution roadmap.
 */
const getMyInvestments = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;

    // 1. Fetch Fixed Deposits
    const [fds] = await db.query(
      `SELECT * FROM fixed_deposits WHERE account_id=? ORDER BY created_at DESC`,
      [accountNumber]
    );

    // 2. Fetch Recurring Deposits
    const [rds] = await db.query(
      `SELECT * FROM recurring_deposits WHERE account_id=? ORDER BY created_at DESC`,
      [accountNumber]
    );

    // 3. Fetch all RD Contributions for this account
    const [contribs] = await db.query(
      `SELECT * FROM rd_contributions WHERE account_id=? ORDER BY contribution_number ASC`,
      [accountNumber]
    );

    // Map contributions by rd_id
    const contribMap = {};
    for (const c of contribs) {
      if (!contribMap[c.rd_id]) contribMap[c.rd_id] = [];
      contribMap[c.rd_id].push(c);
    }

    // Build enriched RD list with full month-by-month status (PAID, PENDING, MISSED)
    const now = new Date();
    const enrichedRds = rds.map((rd) => {
      const paidList = contribMap[rd.id] || [];
      const totalExpected = parseInt(rd.total_contributions_expected, 10);
      const monthlyAmount = parseFloat(rd.monthly_amount);
      const startDate = new Date(rd.start_date);

      const schedule = [];
      for (let m = 1; m <= totalExpected; m++) {
        const paidRecord = paidList.find((p) => parseInt(p.contribution_number, 10) === m);
        const installmentDueDate = addMonths(startDate, m);

        let status = 'PENDING';
        if (paidRecord) {
          status = 'PAID';
        } else if (now > installmentDueDate && rd.status === 'ACTIVE') {
          // If installment due date has passed without payment
          status = 'MISSED';
        }

        schedule.push({
          monthNumber: m,
          amount: monthlyAmount,
          dueDate: installmentDueDate,
          status,
          paidAt: paidRecord ? paidRecord.paid_at : null,
          transactionId: paidRecord ? paidRecord.transaction_id : null,
        });
      }

      // Calculate actual maturity preview
      const actualCalc = calculateActualRdMaturity(
        rd.monthly_amount,
        rd.tenure_months,
        rd.interest_rate,
        paidList
      );

      return {
        ...rd,
        contributions: schedule,
        actualCalculation: actualCalc,
      };
    });

    // 4. Calculate Portfolio Aggregate KPIs
    let activeFdPrincipal = 0;
    let activeFdEstimatedMaturity = 0;
    for (const fd of fds) {
      if (fd.status === 'ACTIVE') {
        activeFdPrincipal += parseFloat(fd.principal_amount);
        activeFdEstimatedMaturity += parseFloat(fd.maturity_amount);
      }
    }

    let activeRdMonthly = 0;
    let totalRdAmountPaid = 0;
    let activeRdEstimatedMaturity = 0;
    for (const rd of enrichedRds) {
      if (rd.status === 'ACTIVE') {
        activeRdMonthly += parseFloat(rd.monthly_amount);
        totalRdAmountPaid += parseFloat(rd.total_amount_paid);
        activeRdEstimatedMaturity += parseFloat(rd.estimated_maturity_amount);
      }
    }

    const totalInvested = parseFloat((activeFdPrincipal + totalRdAmountPaid).toFixed(2));
    const expectedMaturityValue = parseFloat((activeFdEstimatedMaturity + activeRdEstimatedMaturity).toFixed(2));

    return sendSuccess(res, {
      overview: {
        totalInvested,
        activeFdPrincipal: parseFloat(activeFdPrincipal.toFixed(2)),
        totalRdAmountPaid: parseFloat(totalRdAmountPaid.toFixed(2)),
        activeRdMonthly: parseFloat(activeRdMonthly.toFixed(2)),
        expectedMaturityValue,
        activeFdCount: fds.filter((f) => f.status === 'ACTIVE').length,
        activeRdCount: enrichedRds.filter((r) => r.status === 'ACTIVE').length,
      },
      fixedDeposits: fds,
      recurringDeposits: enrichedRds,
    }, 'Investments portfolio fetched successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /customer/investments/fd/create
 * Creates a Fixed Deposit with strict backend balance verification & row locking.
 */
const createFD = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const accountNumber = req.user.AccNumber;
    const { principalAmount, tenureMonths } = req.body;

    const principal = parseFloat(principalAmount);
    const months = parseInt(tenureMonths, 10);

    if (isNaN(principal) || principal < 1000) {
      return sendBadRequest(res, 'Minimum Fixed Deposit amount is ₹1,000.00');
    }

    // Authoritative backend rate calculation & validation
    let fdCalc;
    try {
      fdCalc = calculateFd(principal, months);
    } catch (calcErr) {
      return sendBadRequest(res, calcErr.message);
    }

    // 1. Lock customer row for balance verification
    const [custRows] = await conn.query(
      `SELECT Balance, AccountStatus, customerEmail, customerName FROM Customer WHERE AccountNumber=? FOR UPDATE`,
      [accountNumber]
    );

    if (custRows.length === 0) {
      await conn.rollback();
      return sendNotFound(res, 'Account not found');
    }

    const customer = custRows[0];
    if (customer.AccountStatus === 'Frozen') {
      await conn.rollback();
      return sendBadRequest(res, 'Your account is frozen. Fixed deposit creation is disabled.');
    }

    const currentBalance = parseFloat(customer.Balance);

    // 2. Strict Balance Verification
    if (currentBalance < principal) {
      await conn.rollback();
      return sendBadRequest(
        res,
        `Insufficient balance. Your available balance is ₹${currentBalance.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
        })}, but the FD amount is ₹${principal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`
      );
    }

    // 3. Deduct Principal from Customer Core Account
    const newBalance = parseFloat((currentBalance - principal).toFixed(2));
    await conn.query(`UPDATE Customer SET Balance=? WHERE AccountNumber=?`, [newBalance, accountNumber]);

    // 4. Create Fixed Deposit Record
    const [fdResult] = await conn.query(
      `INSERT INTO fixed_deposits (
        customer_id, account_id, principal_amount, interest_rate, tenure_months,
        interest_amount, maturity_amount, start_date, maturity_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        accountNumber,
        accountNumber,
        fdCalc.principalAmount,
        fdCalc.interestRate,
        fdCalc.tenureMonths,
        fdCalc.interestAmount,
        fdCalc.maturityAmount,
        fdCalc.startDate,
        fdCalc.maturityDate,
      ]
    );
    const fdId = fdResult.insertId;

    // 5. Create Transaction Record
    const [txnResult] = await conn.query(
      `INSERT INTO transactions (
        sender_account, receiver_account, transaction_type, amount, status, description, balance_after
      ) VALUES (?, 'BANK', 'FD_CREATED', ?, 'SUCCESS', ?, ?)`,
      [
        accountNumber,
        principal,
        `Fixed Deposit #${fdId} Created (${fdCalc.tenureMonths} Mo @ ${fdCalc.interestRate}%)`,
        newBalance,
      ]
    );

    await conn.commit();

    // 6. Non-blocking Post-Commit Audit & Email Notification
    const tenureLabel = fdCalc.tenureMonths >= 12 ? `${fdCalc.tenureMonths / 12} Year(s)` : `${fdCalc.tenureMonths} Months`;
    await logAudit(
      accountNumber,
      'FD_CREATED',
      `Created FD #${fdId} of ₹${principal} for ${tenureLabel}. New balance: ₹${newBalance}`,
      req.ip
    );
    logger.info(`FD Created: Account ${accountNumber}, FD #${fdId}, Amount ₹${principal}`);

    sendFdCreatedEmail(customer.customerEmail, customer.customerName, {
      ...fdCalc,
      id: fdId,
    }).catch((e) => logger.warn(`FD confirmation email dispatch error: ${e.message}`));

    return sendSuccess(
      res,
      {
        fdId,
        principalAmount: fdCalc.principalAmount,
        tenureMonths: fdCalc.tenureMonths,
        interestRate: fdCalc.interestRate,
        interestAmount: fdCalc.interestAmount,
        maturityAmount: fdCalc.maturityAmount,
        startDate: fdCalc.startDate,
        maturityDate: fdCalc.maturityDate,
        newBalance,
        transactionId: txnResult.insertId,
      },
      'Fixed Deposit created successfully',
      201
    );
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/**
 * POST /customer/investments/rd/create
 * Creates a Recurring Deposit schedule with ZERO initial deduction.
 */
const createRD = async (req, res, next) => {
  try {
    const accountNumber = req.user.AccNumber;
    const { monthlyAmount, tenureMonths } = req.body;

    const monthly = parseFloat(monthlyAmount);
    const months = parseInt(tenureMonths, 10);

    if (isNaN(monthly) || monthly < 500) {
      return sendBadRequest(res, 'Minimum Recurring Deposit monthly contribution is ₹500.00');
    }

    // Authoritative backend rate calculation & validation
    let rdCalc;
    try {
      rdCalc = calculateRdSchedule(monthly, months);
    } catch (calcErr) {
      return sendBadRequest(res, calcErr.message);
    }

    // Fetch customer profile & status
    const [custRows] = await db.query(
      `SELECT AccountStatus, customerEmail, customerName FROM Customer WHERE AccountNumber=?`,
      [accountNumber]
    );

    if (custRows.length === 0) return sendNotFound(res, 'Account not found');
    const customer = custRows[0];
    if (customer.AccountStatus === 'Frozen') {
      return sendBadRequest(res, 'Your account is frozen. Recurring deposit creation is disabled.');
    }

    // Create RD Schedule (Zero Initial Balance Deduction)
    const [rdResult] = await db.query(
      `INSERT INTO recurring_deposits (
        customer_id, account_id, monthly_amount, interest_rate, tenure_months,
        total_contributions_expected, contributions_completed, total_amount_paid,
        estimated_interest, estimated_maturity_amount, start_date, maturity_date,
        next_due_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0.00, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        accountNumber,
        accountNumber,
        rdCalc.monthlyAmount,
        rdCalc.interestRate,
        rdCalc.tenureMonths,
        rdCalc.totalContributionsExpected,
        rdCalc.estimatedInterest,
        rdCalc.estimatedMaturityAmount,
        rdCalc.startDate,
        rdCalc.maturityDate,
        rdCalc.nextDueDate,
      ]
    );
    const rdId = rdResult.insertId;

    await logAudit(
      accountNumber,
      'RD_CREATED',
      `Created RD #${rdId} of ₹${monthly}/mo for ${months} months. Zero initial deduction.`,
      req.ip
    );
    logger.info(`RD Created: Account ${accountNumber}, RD #${rdId}, Monthly ₹${monthly}`);

    // Send RD Created confirmation email (explicitly states no deduction made)
    sendRdCreatedEmail(customer.customerEmail, customer.customerName, {
      ...rdCalc,
      id: rdId,
    }).catch((e) => logger.warn(`RD created email dispatch error: ${e.message}`));

    return sendSuccess(
      res,
      {
        rdId,
        monthlyAmount: rdCalc.monthlyAmount,
        tenureMonths: rdCalc.tenureMonths,
        interestRate: rdCalc.interestRate,
        totalContributionsExpected: rdCalc.totalContributionsExpected,
        totalScheduledDeposit: rdCalc.totalScheduledDeposit,
        estimatedInterest: rdCalc.estimatedInterest,
        estimatedMaturityAmount: rdCalc.estimatedMaturityAmount,
        startDate: rdCalc.startDate,
        maturityDate: rdCalc.maturityDate,
        nextDueDate: rdCalc.nextDueDate,
        totalAmountPaid: 0.0,
        contributionsCompleted: 0,
      },
      'Recurring Deposit schedule created successfully. No initial deduction was made.',
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /customer/investments/rd/:id/contribute
 * Executes a manual monthly installment contribution with strict balance checks & row locking.
 */
const makeRdContribution = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const accountNumber = req.user.AccNumber;
    const rdId = parseInt(req.params.id, 10);

    if (isNaN(rdId)) {
      await conn.rollback();
      return sendBadRequest(res, 'Invalid RD ID');
    }

    // 1. Lock and verify RD record
    const [rdRows] = await conn.query(
      `SELECT * FROM recurring_deposits WHERE id=? AND account_id=? FOR UPDATE`,
      [rdId, accountNumber]
    );

    if (rdRows.length === 0) {
      await conn.rollback();
      return sendNotFound(res, 'Recurring Deposit record not found or does not belong to your account');
    }

    const rd = rdRows[0];
    if (rd.status !== 'ACTIVE') {
      await conn.rollback();
      return sendBadRequest(res, `Cannot contribute: RD status is ${rd.status}`);
    }

    const totalExpected = parseInt(rd.total_contributions_expected, 10);
    const completed = parseInt(rd.contributions_completed, 10);

    if (completed >= totalExpected) {
      await conn.rollback();
      return sendBadRequest(res, 'All scheduled contributions for this RD have already been paid.');
    }

    const nextContributionNumber = completed + 1;
    const monthlyAmount = parseFloat(rd.monthly_amount);

    // 2. Lock customer row for balance verification
    const [custRows] = await conn.query(
      `SELECT Balance, AccountStatus, customerEmail, customerName FROM Customer WHERE AccountNumber=? FOR UPDATE`,
      [accountNumber]
    );

    if (custRows.length === 0) {
      await conn.rollback();
      return sendNotFound(res, 'Account not found');
    }

    const customer = custRows[0];
    if (customer.AccountStatus === 'Frozen') {
      await conn.rollback();
      return sendBadRequest(res, 'Your account is frozen. Payments are disabled.');
    }

    const currentBalance = parseFloat(customer.Balance);

    // 3. Strict Balance Check
    if (currentBalance < monthlyAmount) {
      await conn.rollback();
      return sendBadRequest(
        res,
        `Insufficient balance. You need ₹${monthlyAmount.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
        })} to make this RD contribution, but your available balance is ₹${currentBalance.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
        })}.`
      );
    }

    // 4. Deduct Monthly Contribution from Core Balance
    const newBalance = parseFloat((currentBalance - monthlyAmount).toFixed(2));
    await conn.query(`UPDATE Customer SET Balance=? WHERE AccountNumber=?`, [newBalance, accountNumber]);

    // 5. Create Transaction Record
    const [txnResult] = await conn.query(
      `INSERT INTO transactions (
        sender_account, receiver_account, transaction_type, amount, status, description, balance_after
      ) VALUES (?, 'BANK', 'RD_CONTRIBUTION', ?, 'SUCCESS', ?, ?)`,
      [
        accountNumber,
        monthlyAmount,
        `Recurring Deposit Contribution - Month ${nextContributionNumber} (RD #${rdId})`,
        newBalance,
      ]
    );
    const txnId = txnResult.insertId;

    // 6. Record RD Contribution in rd_contributions (Authoritative Ledger)
    await conn.query(
      `INSERT INTO rd_contributions (
        rd_id, customer_id, account_id, contribution_number, amount, transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [rdId, accountNumber, accountNumber, nextContributionNumber, monthlyAmount, txnId]
    );

    // 7. Update RD Aggregate Totals & Advance Next Due Date
    const newTotalPaid = parseFloat((parseFloat(rd.total_amount_paid) + monthlyAmount).toFixed(2));
    const nextDueDate = nextContributionNumber < totalExpected
      ? addMonths(new Date(rd.start_date), nextContributionNumber + 1)
      : rd.maturity_date;

    await conn.query(
      `UPDATE recurring_deposits SET 
        contributions_completed=?,
        total_amount_paid=?,
        next_due_date=?
      WHERE id=?`,
      [nextContributionNumber, newTotalPaid, nextDueDate, rdId]
    );

    await conn.commit();

    // 8. Post-Commit Audit & Email Notification
    await logAudit(
      accountNumber,
      'RD_CONTRIBUTION',
      `Paid RD #${rdId} Contribution #${nextContributionNumber} of ₹${monthlyAmount}. New balance: ₹${newBalance}`,
      req.ip
    );
    logger.info(`RD Contribution: Account ${accountNumber}, RD #${rdId}, Month #${nextContributionNumber}, ₹${monthlyAmount}`);

    sendRdContributionEmail(customer.customerEmail, customer.customerName, {
      ...rd,
      totalAmountPaid: newTotalPaid,
      nextDueDate,
    }, {
      contributionNumber: nextContributionNumber,
      amount: monthlyAmount,
    }).catch((e) => logger.warn(`RD contribution email dispatch error: ${e.message}`));

    return sendSuccess(
      res,
      {
        rdId,
        contributionNumber: nextContributionNumber,
        amountPaid: monthlyAmount,
        totalAmountPaid: newTotalPaid,
        contributionsCompleted: nextContributionNumber,
        totalContributionsExpected: totalExpected,
        nextDueDate,
        newBalance,
        transactionId: txnId,
      },
      `Recurring Deposit Month #${nextContributionNumber} contribution successful`
    );
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

module.exports = {
  getRates,
  getMyInvestments,
  createFD,
  createRD,
  makeRdContribution,
};
