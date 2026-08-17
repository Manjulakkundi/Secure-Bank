/**
 * services/investmentScheduler.js
 * Dual-role background engine for:
 *   1. Investment Maturity Settlement (FD & RD) — Safe, ACID & Idempotent
 *   2. RD Monthly Payment Reminders — Zero auto-debit, duplicate-safe
 */
const db = require('../config/database');
const { calculateActualRdMaturity } = require('../config/investmentRates');
const {
  sendFdMaturedEmail,
  sendRdMonthlyReminderEmail,
  sendRdMaturedEmail,
} = require('./emailService');
const logger = require('../utils/logger');

let schedulerInterval = null;

/**
 * Settle all matured Fixed Deposits where maturity_date <= NOW() and status = 'ACTIVE'.
 */
const processFdMaturity = async () => {
  try {
    const [dueFds] = await db.query(
      `SELECT f.*, c.customerEmail, c.customerName, c.Balance as customerBalance 
       FROM fixed_deposits f 
       JOIN Customer c ON c.AccountNumber = f.account_id 
       WHERE f.status = 'ACTIVE' AND f.maturity_date <= NOW()`
    );

    if (dueFds.length === 0) return { processed: 0 };

    let processedCount = 0;
    for (const fd of dueFds) {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        // 1. Lock FD record to prevent race conditions
        const [lockedFdRows] = await conn.query(
          `SELECT status, maturity_amount FROM fixed_deposits WHERE id=? FOR UPDATE`,
          [fd.id]
        );

        if (lockedFdRows.length === 0 || lockedFdRows[0].status !== 'ACTIVE') {
          await conn.rollback();
          continue; // Already processed
        }

        // 2. Lock Customer row
        const [custRows] = await conn.query(
          `SELECT Balance, customerEmail, customerName FROM Customer WHERE AccountNumber=? FOR UPDATE`,
          [fd.account_id]
        );

        if (custRows.length === 0) {
          await conn.rollback();
          continue;
        }

        const maturityAmount = parseFloat(lockedFdRows[0].maturity_amount);
        const currentBalance = parseFloat(custRows[0].Balance);
        const newBalance = parseFloat((currentBalance + maturityAmount).toFixed(2));

        // 3. Credit core balance
        await conn.query(`UPDATE Customer SET Balance=? WHERE AccountNumber=?`, [newBalance, fd.account_id]);

        // 4. Mark FD as MATURED
        await conn.query(`UPDATE fixed_deposits SET status='MATURED' WHERE id=?`, [fd.id]);

        // 5. Create Transaction Record
        await conn.query(
          `INSERT INTO transactions (
            sender_account, receiver_account, transaction_type, amount, status, description, balance_after
          ) VALUES ('BANK', ?, 'FD_MATURITY', ?, 'SUCCESS', ?, ?)`,
          [
            fd.account_id,
            maturityAmount,
            `Fixed Deposit #${fd.id} Matured and Credited`,
            newBalance,
          ]
        );

        await conn.commit();
        processedCount++;
        logger.info(`FD Matured: Account ${fd.account_id}, FD #${fd.id}, Credited ₹${maturityAmount}`);

        // 6. Send maturity email
        sendFdMaturedEmail(custRows[0].customerEmail, custRows[0].customerName, fd)
          .catch((e) => logger.warn(`FD maturity email error: ${e.message}`));
      } catch (err) {
        await conn.rollback();
        logger.error(`Error maturing FD #${fd.id}: ${err.message}`);
      } finally {
        conn.release();
      }
    }

    return { processed: processedCount };
  } catch (err) {
    logger.error(`Error in processFdMaturity: ${err.message}`);
    return { processed: 0, error: err.message };
  }
};

/**
 * Settle all matured Recurring Deposits where maturity_date <= NOW() and status = 'ACTIVE'.
 * Calculates payout strictly from verified actual payments in rd_contributions.
 */
const processRdMaturity = async () => {
  try {
    const [dueRds] = await db.query(
      `SELECT r.*, c.customerEmail, c.customerName, c.Balance as customerBalance 
       FROM recurring_deposits r 
       JOIN Customer c ON c.AccountNumber = r.account_id 
       WHERE r.status = 'ACTIVE' AND r.maturity_date <= NOW()`
    );

    if (dueRds.length === 0) return { processed: 0 };

    let processedCount = 0;
    for (const rd of dueRds) {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        // 1. Lock RD record
        const [lockedRdRows] = await conn.query(
          `SELECT * FROM recurring_deposits WHERE id=? FOR UPDATE`,
          [rd.id]
        );

        if (lockedRdRows.length === 0 || lockedRdRows[0].status !== 'ACTIVE') {
          await conn.rollback();
          continue; // Already processed
        }

        // 2. Fetch actual contributions made for this RD
        const [paidContribs] = await conn.query(
          `SELECT contribution_number, amount FROM rd_contributions WHERE rd_id=? ORDER BY contribution_number ASC`,
          [rd.id]
        );

        // 3. Compute authoritative actual maturity payout
        const actualCalc = calculateActualRdMaturity(
          rd.monthly_amount,
          rd.tenure_months,
          rd.interest_rate,
          paidContribs
        );

        const payoutAmount = actualCalc.actualMaturityAmount;

        // 4. Lock Customer row
        const [custRows] = await conn.query(
          `SELECT Balance, customerEmail, customerName FROM Customer WHERE AccountNumber=? FOR UPDATE`,
          [rd.account_id]
        );

        if (custRows.length === 0) {
          await conn.rollback();
          continue;
        }

        const currentBalance = parseFloat(custRows[0].Balance);
        const newBalance = parseFloat((currentBalance + payoutAmount).toFixed(2));

        // 5. Credit core balance with actual maturity payout
        await conn.query(`UPDATE Customer SET Balance=? WHERE AccountNumber=?`, [newBalance, rd.account_id]);

        // 6. Mark RD as MATURED
        await conn.query(`UPDATE recurring_deposits SET status='MATURED' WHERE id=?`, [rd.id]);

        // 7. Create Transaction Record
        await conn.query(
          `INSERT INTO transactions (
            sender_account, receiver_account, transaction_type, amount, status, description, balance_after
          ) VALUES ('BANK', ?, 'RD_MATURITY', ?, 'SUCCESS', ?, ?)`,
          [
            rd.account_id,
            payoutAmount,
            `Recurring Deposit #${rd.id} Matured and Credited (${actualCalc.contributionsCompleted}/${actualCalc.totalContributionsExpected} contributions paid)`,
            newBalance,
          ]
        );

        await conn.commit();
        processedCount++;
        logger.info(
          `RD Matured: Account ${rd.account_id}, RD #${rd.id}, Paid ${actualCalc.contributionsCompleted}/${actualCalc.totalContributionsExpected}, Credited ₹${payoutAmount}`
        );

        // 8. Send RD maturity email
        sendRdMaturedEmail(custRows[0].customerEmail, custRows[0].customerName, rd, actualCalc)
          .catch((e) => logger.warn(`RD maturity email error: ${e.message}`));
      } catch (err) {
        await conn.rollback();
        logger.error(`Error maturing RD #${rd.id}: ${err.message}`);
      } finally {
        conn.release();
      }
    }

    return { processed: processedCount };
  } catch (err) {
    logger.error(`Error in processRdMaturity: ${err.message}`);
    return { processed: 0, error: err.message };
  }
};

/**
 * Check active RDs where next_due_date <= NOW() and dispatch one-time payment reminders.
 * GUARANTEES: Zero automatic balance deductions, zero duplicate reminder emails.
 */
const processRdReminders = async () => {
  try {
    const [dueRds] = await db.query(
      `SELECT r.*, c.customerEmail, c.customerName 
       FROM recurring_deposits r 
       JOIN Customer c ON c.AccountNumber = r.account_id 
       WHERE r.status = 'ACTIVE' 
         AND r.next_due_date <= NOW() 
         AND (r.last_reminder_contribution_number < (r.contributions_completed + 1))`
    );

    if (dueRds.length === 0) return { remindersSent: 0 };

    let remindersSent = 0;
    for (const rd of dueRds) {
      const dueMonthNumber = parseInt(rd.contributions_completed, 10) + 1;
      const totalExpected = parseInt(rd.total_contributions_expected, 10);

      if (dueMonthNumber > totalExpected) continue;

      // Update reminder state to prevent duplicate dispatches
      await db.query(
        `UPDATE recurring_deposits SET 
          last_reminder_contribution_number=?,
          last_reminder_sent_at=NOW()
         WHERE id=?`,
        [dueMonthNumber, rd.id]
      );

      remindersSent++;
      logger.info(`RD Reminder sent: Account ${rd.account_id}, RD #${rd.id}, Month #${dueMonthNumber}`);

      // Dispatch reminder email
      sendRdMonthlyReminderEmail(rd.customerEmail, rd.customerName, rd, dueMonthNumber)
        .catch((e) => logger.warn(`RD reminder email error: ${e.message}`));
    }

    return { remindersSent };
  } catch (err) {
    logger.error(`Error in processRdReminders: ${err.message}`);
    return { remindersSent: 0, error: err.message };
  }
};

/**
 * Execute a single complete cycle of the investment scheduler.
 */
const runSchedulerCycle = async () => {
  const fdResult = await processFdMaturity();
  const rdResult = await processRdMaturity();
  const reminderResult = await processRdReminders();

  return {
    fdMaturities: fdResult.processed || 0,
    rdMaturities: rdResult.processed || 0,
    remindersSent: reminderResult.remindersSent || 0,
  };
};

/**
 * Start the recurring background scheduler interval.
 * @param {number} [intervalMs=60000] Default: 60 seconds
 */
const startScheduler = (intervalMs = 60000) => {
  if (schedulerInterval) clearInterval(schedulerInterval);

  logger.info(`🚀 Investment Scheduler initialized (interval: ${intervalMs / 1000}s)`);
  
  // Run once immediately on startup
  runSchedulerCycle().catch((e) => logger.error(`Scheduler startup error: ${e.message}`));

  // Recurring interval
  schedulerInterval = setInterval(() => {
    runSchedulerCycle().catch((e) => logger.error(`Scheduler recurring error: ${e.message}`));
  }, intervalMs);
};

const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('🛑 Investment Scheduler stopped');
  }
};

module.exports = {
  processFdMaturity,
  processRdMaturity,
  processRdReminders,
  runSchedulerCycle,
  startScheduler,
  stopScheduler,
};
