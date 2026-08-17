/**
 * config/investmentRates.js
 * Centralized financial rate sheet and calculation module for Fixed & Recurring Deposits.
 * 
 * Rules:
 * - Simple Interest calculation
 * - Predefined simulated interest rates
 * - Authoritative backend validation and calculation
 */

const INVESTMENT_RATES = [
  { tenureMonths: 6,  tenureLabel: '6 Months',  annualRate: 6.50, minAmount: 1000,  minMonthly: 500 },
  { tenureMonths: 12, tenureLabel: '1 Year',    annualRate: 6.75, minAmount: 1000,  minMonthly: 500 },
  { tenureMonths: 24, tenureLabel: '2 Years',   annualRate: 7.10, minAmount: 1000,  minMonthly: 500 },
  { tenureMonths: 36, tenureLabel: '3 Years',   annualRate: 7.25, minAmount: 1000,  minMonthly: 500 },
  { tenureMonths: 60, tenureLabel: '5 Years',   annualRate: 7.50, minAmount: 1000,  minMonthly: 500 },
];

/**
 * Get annual interest rate for a specific tenure in months.
 * @param {number} months 
 * @returns {number|null} Rate in percentage (e.g. 7.10)
 */
const getRateForTenure = (months) => {
  const m = parseInt(months, 10);
  const found = INVESTMENT_RATES.find((r) => r.tenureMonths === m);
  return found ? found.annualRate : null;
};

/**
 * Check if a tenure in months is valid.
 */
const isValidTenure = (months) => {
  return getRateForTenure(months) !== null;
};

/**
 * Add exact months to a date.
 * @param {Date} date 
 * @param {number} months 
 * @returns {Date}
 */
const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + parseInt(months, 10));
  return result;
};

/**
 * Calculate Fixed Deposit details using Simple Interest.
 * Formula: Interest = Principal * (Rate / 100) * (Months / 12)
 * Maturity Amount = Principal + Interest
 * 
 * @param {number} principal 
 * @param {number} tenureMonths 
 * @param {Date} [startDate]
 */
const calculateFd = (principal, tenureMonths, startDate = new Date()) => {
  const p = parseFloat(principal);
  const m = parseInt(tenureMonths, 10);
  const rate = getRateForTenure(m);

  if (!rate) {
    throw new Error(`Invalid tenure: ${tenureMonths} months. Allowed tenures: 6, 12, 24, 36, 60 months.`);
  }
  if (isNaN(p) || p <= 0) {
    throw new Error('Principal amount must be a positive number.');
  }

  const timeYears = m / 12;
  const interestAmount = parseFloat((p * (rate / 100) * timeYears).toFixed(2));
  const maturityAmount = parseFloat((p + interestAmount).toFixed(2));
  const maturityDate = addMonths(startDate, m);

  return {
    principalAmount: p,
    tenureMonths: m,
    interestRate: rate,
    interestAmount,
    maturityAmount,
    startDate,
    maturityDate,
  };
};

/**
 * Calculate Recurring Deposit expected schedule and estimated returns.
 * Formula: Estimated Interest = Monthly * (Rate / 100) * [N * (N + 1) / 24]
 * 
 * @param {number} monthlyAmount 
 * @param {number} tenureMonths 
 * @param {Date} [startDate]
 */
const calculateRdSchedule = (monthlyAmount, tenureMonths, startDate = new Date()) => {
  const p = parseFloat(monthlyAmount);
  const n = parseInt(tenureMonths, 10);
  const rate = getRateForTenure(n);

  if (!rate) {
    throw new Error(`Invalid tenure: ${tenureMonths} months. Allowed tenures: 6, 12, 24, 36, 60 months.`);
  }
  if (isNaN(p) || p <= 0) {
    throw new Error('Monthly deposit amount must be a positive number.');
  }

  const totalScheduledDeposit = parseFloat((p * n).toFixed(2));
  // Standard simple interest sum for N monthly recurring contributions
  const estimatedInterest = parseFloat((p * (rate / 100) * ((n * (n + 1)) / 24)).toFixed(2));
  const estimatedMaturityAmount = parseFloat((totalScheduledDeposit + estimatedInterest).toFixed(2));
  const maturityDate = addMonths(startDate, n);
  const nextDueDate = addMonths(startDate, 1); // 1 month after start

  return {
    monthlyAmount: p,
    tenureMonths: n,
    interestRate: rate,
    totalContributionsExpected: n,
    totalScheduledDeposit,
    estimatedInterest,
    estimatedMaturityAmount,
    startDate,
    maturityDate,
    nextDueDate,
  };
};

/**
 * Calculate ACTUAL Recurring Deposit maturity payout using only verified paid contributions.
 * 
 * Each paid installment 'k' (1 <= k <= N) earns interest for remaining (N - k + 1) months.
 * Interest_k = MonthlyAmount * (Rate / 100) * ((N - k + 1) / 12)
 * 
 * @param {number} monthlyAmount 
 * @param {number} tenureMonths 
 * @param {number} interestRate 
 * @param {Array<{ contribution_number: number, amount: number }>} paidContributions 
 */
const calculateActualRdMaturity = (monthlyAmount, tenureMonths, interestRate, paidContributions = []) => {
  const p = parseFloat(monthlyAmount);
  const n = parseInt(tenureMonths, 10);
  const rate = parseFloat(interestRate);

  let totalAmountPaid = 0;
  let totalActualInterest = 0;

  for (const contrib of paidContributions) {
    const k = parseInt(contrib.contribution_number, 10);
    const amount = parseFloat(contrib.amount) || p;
    totalAmountPaid += amount;

    // Remaining months this installment was invested until maturity
    const remainingMonths = Math.max(0, n - k + 1);
    const interestForK = amount * (rate / 100) * (remainingMonths / 12);
    totalActualInterest += interestForK;
  }

  totalAmountPaid = parseFloat(totalAmountPaid.toFixed(2));
  totalActualInterest = parseFloat(totalActualInterest.toFixed(2));
  const actualMaturityAmount = parseFloat((totalAmountPaid + totalActualInterest).toFixed(2));

  return {
    totalContributionsExpected: n,
    contributionsCompleted: paidContributions.length,
    contributionsMissed: Math.max(0, n - paidContributions.length),
    totalAmountPaid,
    actualInterestEarned: totalActualInterest,
    actualMaturityAmount,
  };
};

module.exports = {
  INVESTMENT_RATES,
  getRateForTenure,
  isValidTenure,
  addMonths,
  calculateFd,
  calculateRdSchedule,
  calculateActualRdMaturity,
};
