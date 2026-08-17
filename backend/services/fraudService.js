/**
 * services/fraudService.js
 * Rule-based fraud detection engine.
 * Every transfer is evaluated against 5 rules.
 * Risk score 0–100 determines alert level.
 */
const db = require('../config/database');
const logger = require('../utils/logger');

const FRAUD_RULES = {
  HIGH_VALUE_TRANSACTION:     { score: 30, description: 'Transaction amount exceeds ₹50,000' },
  RAPID_TRANSACTION_ACTIVITY: { score: 35, description: 'More than 5 transactions within 2 minutes' },
  DAILY_LIMIT_EXCEEDED:       { score: 25, description: 'Daily transfer total exceeds ₹1,00,000' },
  MULTIPLE_FAILED_ATTEMPTS:   { score: 40, description: 'More than 3 failed transfer attempts' },
  NEW_BENEFICIARY_RISK:       { score: 30, description: 'Transfer > ₹20,000 to a newly added beneficiary' },
};

const getRiskLevel = (score) => {
  if (score >= 71) return 'HIGH';
  if (score >= 31) return 'MEDIUM';
  return 'LOW';
};

/**
 * Evaluate a pending transfer for fraud signals.
 * @returns { riskScore, riskLevel, triggeredRules, shouldBlock }
 */
const evaluateTransaction = async (accountNumber, amount, toAccount, conn) => {
  const executor = conn || db;
  const triggeredRules = [];
  let riskScore = 0;

  // Rule 1: High Value Transaction
  if (parseFloat(amount) > 50000) {
    triggeredRules.push('HIGH_VALUE_TRANSACTION');
    riskScore += FRAUD_RULES.HIGH_VALUE_TRANSACTION.score;
  }

  // Rule 2: Rapid Transactions — more than 5 in past 2 minutes
  const [rapidRows] = await executor.query(
    `SELECT COUNT(*) AS cnt FROM transactions
     WHERE sender_account = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)`,
    [accountNumber]
  );
  if (rapidRows[0].cnt >= 5) {
    triggeredRules.push('RAPID_TRANSACTION_ACTIVITY');
    riskScore += FRAUD_RULES.RAPID_TRANSACTION_ACTIVITY.score;
  }

  // Rule 3: Daily transfer limit exceeded — total today > 1,00,000
  const [dailyRows] = await executor.query(
    `SELECT COALESCE(SUM(amount), 0) AS dailyTotal FROM transactions
     WHERE sender_account = ? AND transaction_type = 'TRANSFER'
       AND DATE(created_at) = CURDATE() AND status = 'SUCCESS'`,
    [accountNumber]
  );
  if (parseFloat(dailyRows[0].dailyTotal) + parseFloat(amount) > 100000) {
    triggeredRules.push('DAILY_LIMIT_EXCEEDED');
    riskScore += FRAUD_RULES.DAILY_LIMIT_EXCEEDED.score;
  }

  // Rule 4: Multiple failed transfer attempts in last hour
  const [failedRows] = await executor.query(
    `SELECT COUNT(*) AS cnt FROM transactions
     WHERE sender_account = ? AND status = 'FAILED'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [accountNumber]
  );
  if (failedRows[0].cnt >= 3) {
    triggeredRules.push('MULTIPLE_FAILED_ATTEMPTS');
    riskScore += FRAUD_RULES.MULTIPLE_FAILED_ATTEMPTS.score;
  }

  // Rule 5: New beneficiary risk — beneficiary added in last 24h and amount > 20,000
  if (parseFloat(amount) > 20000 && toAccount) {
    const [newBenefRows] = await executor.query(
      `SELECT 1 FROM beneficiaries
       WHERE customer_id = ? AND beneficiary_account = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 1`,
      [accountNumber, toAccount]
    );
    if (newBenefRows.length > 0) {
      triggeredRules.push('NEW_BENEFICIARY_RISK');
      riskScore += FRAUD_RULES.NEW_BENEFICIARY_RISK.score;
    }
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100);

  return {
    riskScore,
    riskLevel:     getRiskLevel(riskScore),
    triggeredRules,
    shouldBlock:   riskScore >= 90,  // Only auto-block extreme risk
  };
};

/**
 * Save a fraud alert to the database.
 */
const saveFraudAlert = async (transactionId, accountId, riskScore, triggeredRules, conn) => {
  const executor = conn || db;
  try {
    await executor.query(
      `INSERT INTO fraud_alerts (transaction_id, account_id, risk_score, fraud_reason, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [transactionId, accountId, riskScore, triggeredRules.join(', ')]
    );
    logger.warn(`FRAUD ALERT: account=${accountId} score=${riskScore} rules=${triggeredRules.join(',')}`);
  } catch (err) {
    logger.error(`Failed to save fraud alert: ${err.message}`);
  }
};

module.exports = { evaluateTransaction, saveFraudAlert, getRiskLevel, FRAUD_RULES, checkAndCreateFraudAlert };

/**
 * Convenience helper for admin cash operations (deposit/withdraw).
 * Creates a fraud alert if a single transaction exceeds ₹50,000.
 * @param {object} p - { accountId, transactionId, amount, type, reason }
 */
async function checkAndCreateFraudAlert({ accountId, transactionId, amount, type, reason }) {
  if (parseFloat(amount) > 50000) {
    await saveFraudAlert(
      transactionId,
      accountId,
      70,
      [reason || 'Large Transaction Detected'],
    );
  }
}
