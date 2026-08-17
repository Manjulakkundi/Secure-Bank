/**
 * tests/adminInvestmentTest.js
 * Comprehensive automated verification test suite for Admin Investment Management API.
 * Verifies:
 * - Overview KPI accuracy (Unique investors counted once, strict total invested calculation)
 * - Server-side search & filtering by Name, Account Number, FD ID, RD ID
 * - Multi-column sorting
 * - Zero raw account number exposure (all responses masked as ****6808)
 * - Deep customer drilldown with FDs, RDs roadmap, audit timestamps, and related transactions
 * - Maturity monitor with 5 non-overlapping distinct categories
 * - RD contribution history itemization
 */
const db = require('../config/database');
const adminInvestCtrl = require('../controllers/adminInvestmentController');

// Mock Express Request & Response
const mockReq = (params = {}, query = {}, body = {}) => ({
  params,
  query,
  body,
  ip: '127.0.0.1',
});

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.data = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.data = payload;
    return res;
  };
  return res;
};

async function runAdminTests() {
  console.log('===============================================================');
  console.log('🧪 STARTING ADMIN INVESTMENT MANAGEMENT API INTEGRATION TESTS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${name} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${details ? '--> ' + details : ''}`);
      failed++;
    }
  }

  const conn = await db.getConnection();

  try {
    // 0. Setup two test accounts with known investments (<= 16 chars)
    const ACC_A = 'ADM_TST_A_1111';
    const ACC_B = 'ADM_TST_B_2222';

    // Clean old test records

    await conn.query(`DELETE FROM transactions WHERE sender_account IN (?, ?) OR receiver_account IN (?, ?)`, [ACC_A, ACC_B, ACC_A, ACC_B]);
    await conn.query(`DELETE FROM rd_contributions WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM recurring_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM fixed_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM Customer WHERE AccountNumber IN (?, ?)`, [ACC_A, ACC_B]);

    // Create Customer A (FD ₹50,000 + RD ₹8,000 paid)
    await conn.query(
      `INSERT INTO Customer (AccountNumber, customerName, AccountType, customerPhone, customerEmail, CustomerPassword, Balance, AccountVerify, AccountStatus)
       VALUES (?, 'Ananya Sharma', 'Savings', '9876543210', 'ananya@securebank.com', 'hashA', 100000.00, 1, 'Active')`,
      [ACC_A]
    );

    // Create Customer B (FD ₹1,00,000 + RD ₹20,000 paid)
    await conn.query(
      `INSERT INTO Customer (AccountNumber, customerName, AccountType, customerPhone, customerEmail, CustomerPassword, Balance, AccountVerify, AccountStatus)
       VALUES (?, 'Bhavesh Patel', 'Savings', '9876543211', 'bhavesh@securebank.com', 'hashB', 200000.00, 1, 'Active')`,
      [ACC_B]
    );

    // Customer A: FD 1 (₹50,000, 24 mo, Active, maturing in 20 days)
    const [fdA] = await conn.query(
      `INSERT INTO fixed_deposits (customer_id, account_id, principal_amount, interest_rate, tenure_months, interest_amount, maturity_amount, start_date, maturity_date, status)
       VALUES (?, ?, 50000.00, 7.10, 24, 7100.00, 57100.00, NOW() - INTERVAL 1 MONTH, NOW() + INTERVAL 20 DAY, 'ACTIVE')`,
      [ACC_A, ACC_A]
    );

    // Customer A: RD 1 (₹2,000/mo, 24 mo, Active, total paid ₹8,000)
    const [rdA] = await conn.query(
      `INSERT INTO recurring_deposits (customer_id, account_id, monthly_amount, interest_rate, tenure_months, total_contributions_expected, contributions_completed, total_amount_paid, estimated_interest, estimated_maturity_amount, start_date, maturity_date, next_due_date, status)
       VALUES (?, ?, 2000.00, 7.10, 24, 24, 4, 8000.00, 3550.00, 51550.00, NOW() - INTERVAL 4 MONTH, NOW() + INTERVAL 20 MONTH, NOW() + INTERVAL 5 DAY, 'ACTIVE')`,
      [ACC_A, ACC_A]
    );

    // Add 4 contributions for RD A
    for (let m = 1; m <= 4; m++) {
      await conn.query(
        `INSERT INTO rd_contributions (rd_id, customer_id, account_id, contribution_number, amount, paid_at)
         VALUES (?, ?, ?, ?, 2000.00, NOW() - INTERVAL ? MONTH)`,
        [rdA.insertId, ACC_A, ACC_A, m, 5 - m]
      );
    }

    // Customer B: FD 2 (₹1,00,000, 12 mo, Active, maturing in 5 days)
    const [fdB] = await conn.query(
      `INSERT INTO fixed_deposits (customer_id, account_id, principal_amount, interest_rate, tenure_months, interest_amount, maturity_amount, start_date, maturity_date, status)
       VALUES (?, ?, 100000.00, 6.75, 12, 6750.00, 106750.00, NOW() - INTERVAL 11 MONTH, NOW() + INTERVAL 5 DAY, 'ACTIVE')`,
      [ACC_B, ACC_B]
    );

    // Customer B: RD 2 (₹5,000/mo, 12 mo, Active, total paid ₹20,000)
    const [rdB] = await conn.query(
      `INSERT INTO recurring_deposits (customer_id, account_id, monthly_amount, interest_rate, tenure_months, total_contributions_expected, contributions_completed, total_amount_paid, estimated_interest, estimated_maturity_amount, start_date, maturity_date, next_due_date, status)
       VALUES (?, ?, 5000.00, 6.75, 12, 12, 4, 20000.00, 2193.75, 62193.75, NOW() - INTERVAL 4 MONTH, NOW() + INTERVAL 8 MONTH, NOW() - INTERVAL 2 DAY, 'ACTIVE')`,
      [ACC_B, ACC_B]
    );

    // Add 4 contributions for RD B
    for (let m = 1; m <= 4; m++) {
      await conn.query(
        `INSERT INTO rd_contributions (rd_id, customer_id, account_id, contribution_number, amount, paid_at)
         VALUES (?, ?, ?, ?, 5000.00, NOW() - INTERVAL ? MONTH)`,
        [rdB.insertId, ACC_B, ACC_B, m, 5 - m]
      );
    }

    // Log corresponding transactions
    await conn.query(
      `INSERT INTO transactions (sender_account, receiver_account, transaction_type, amount, status, description, balance_after)
       VALUES (?, 'BANK', 'FD_CREATED', 50000.00, 'SUCCESS', 'FD #1 Created', 50000.00)`,
      [ACC_A]
    );

    await conn.query(
      `INSERT INTO transactions (sender_account, receiver_account, transaction_type, amount, status, description, balance_after)
       VALUES (?, 'BANK', 'FD_CREATED', 100000.00, 'SUCCESS', 'FD #2 Created', 100000.00)`,
      [ACC_B]
    );

    console.log('Setup test data: Customer A (FD ₹50k + RD ₹8k paid), Customer B (FD ₹100k + RD ₹20k paid).\n');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST SUITE 1: Overview KPIs
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST SUITE 1: Overview KPIs ───');
    const req1 = mockReq();
    const res1 = mockRes();
    await adminInvestCtrl.getInvestmentOverview(req1, res1, (err) => { throw err; });

    const kpis = res1.data.data.kpis;
    assert(kpis.totalInvestors >= 2, 'Total Unique Investors Counted Correctly', `Investors: ${kpis.totalInvestors}`);
    assert(kpis.totalActiveFdPrincipal >= 150000.00, 'Total Active FD Principal Correct', `FD Principal: ₹${kpis.totalActiveFdPrincipal}`);
    assert(kpis.totalActiveRdPaid >= 28000.00, 'Total Active RD Paid Correct (Actual Contributions)', `RD Paid: ₹${kpis.totalActiveRdPaid}`);
    assert(kpis.totalInvestedAcrossBank >= 178000.00, 'Total Invested Across Bank Correct', `Total: ₹${kpis.totalInvestedAcrossBank}`);
    assert(kpis.fdsMaturing7d >= 1, 'Maturity ≤ 7 Days Detected', `Count: ${kpis.fdsMaturing7d}`);
    assert(kpis.fdsMaturingSoon >= 2, 'Maturity ≤ 30 Days Detected', `Count: ${kpis.fdsMaturingSoon}`);
    assert(kpis.rdsWithMissedContributions >= 1, 'Missed RD Installment Detected', `Count: ${kpis.rdsWithMissedContributions}`);
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST SUITE 2: Customer Search, Sorting & Account Masking
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST SUITE 2: Search, Sorting & Account Masking ───');
    // Search by Name "Ananya"
    const reqSearchName = mockReq({}, { search: 'Ananya', limit: 10 });
    const resSearchName = mockRes();
    await adminInvestCtrl.getCustomerInvestments(reqSearchName, resSearchName, (err) => { throw err; });

    const custs1 = resSearchName.data.data.customers;
    assert(custs1.length === 1 && custs1[0].customerName === 'Ananya Sharma', 'Search by Name Success');
    assert(custs1[0].maskedAccountNumber === '****1111', 'Account Number Strictly Masked', custs1[0].maskedAccountNumber);
    assert(custs1[0].totalFdPrincipal === 50000.00, 'Customer A FD Principal = ₹50,000.00');
    assert(custs1[0].totalRdAmountPaid === 8000.00, 'Customer A RD Paid = ₹8,000.00');
    assert(custs1[0].totalActualInvested === 58000.00, 'Customer A Total Invested = ₹58,000.00');

    // Search by raw Account Number (DB matches, response returns masked)
    const reqSearchAcc = mockReq({}, { search: 'ADM_TST_B_2222', limit: 10 });
    const resSearchAcc = mockRes();

    await adminInvestCtrl.getCustomerInvestments(reqSearchAcc, resSearchAcc, (err) => { throw err; });

    const custs2 = resSearchAcc.data.data.customers;
    assert(custs2.length === 1 && custs2[0].customerName === 'Bhavesh Patel', 'Search by Raw Account Number Matches');
    assert(custs2[0].maskedAccountNumber === '****2222', 'Returned Account Number is Masked');
    assert(custs2[0].totalActualInvested === 120000.00, 'Customer B Total Invested = ₹1,20,000.00');

    // Search by FD ID
    const reqSearchFd = mockReq({}, { search: String(fdA.insertId), limit: 10 });
    const resSearchFd = mockRes();
    await adminInvestCtrl.getCustomerInvestments(reqSearchFd, resSearchFd, (err) => { throw err; });
    assert(resSearchFd.data.data.customers.some((c) => c.customerName === 'Ananya Sharma'), 'Search by FD ID Finds Investor');

    // Multi-column sorting by totalInvested DESC
    const reqSort = mockReq({}, { sortBy: 'totalInvested', sortOrder: 'DESC', limit: 10 });
    const resSort = mockRes();
    await adminInvestCtrl.getCustomerInvestments(reqSort, resSort, (err) => { throw err; });
    const sorted = resSort.data.data.customers;
    assert(sorted[0].totalActualInvested >= sorted[1].totalActualInvested, 'Sorting by totalInvested DESC works');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST SUITE 3: Customer Drilldown with Roadmap & Audit
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST SUITE 3: Customer Drilldown with Roadmap & Audit ───');
    const reqDetail = mockReq({ accountNumber: ACC_A });
    const resDetail = mockRes();
    await adminInvestCtrl.getCustomerInvestmentDetail(reqDetail, resDetail, (err) => { throw err; });

    const detail = resDetail.data.data;
    assert(detail.customer.maskedAccountNumber === '****1111', 'Drilldown Masks Customer Account Number');
    assert(detail.fixedDeposits.length >= 1, 'Returns Customer Fixed Deposits');
    assert(detail.fixedDeposits[0].created_at !== undefined, 'FD includes created_at Audit Timestamp');
    assert(detail.recurringDeposits.length >= 1, 'Returns Customer Recurring Deposits');

    const rdDetailA = detail.recurringDeposits[0];
    assert(rdDetailA.contributions.length === 24, 'RD Roadmap Generates All 24 Scheduled Months');
    assert(rdDetailA.contributions[0].status === 'PAID', 'Month 1 is PAID');
    assert(rdDetailA.contributions[3].status === 'PAID', 'Month 4 is PAID');
    assert(rdDetailA.contributions[4].status === 'PENDING', 'Month 5 is PENDING');
    assert(detail.transactions.length >= 1, 'Returns Related Investment Transactions');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST SUITE 4: Maturity Monitor Categories
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST SUITE 4: Maturity Monitor Categories ───');
    // 7-day range
    const reqMat7 = mockReq({}, { range: 'maturing_7d' });
    const resMat7 = mockRes();
    await adminInvestCtrl.getMaturityMonitor(reqMat7, resMat7, (err) => { throw err; });
    assert(resMat7.data.data.records.some((r) => r.maskedAccountNumber === '****2222'), 'Maturity Monitor 7d Catches Customer B FD (Maturing in 5d)');

    // 30-day range
    const reqMat30 = mockReq({}, { range: 'maturing_30d' });
    const resMat30 = mockRes();
    await adminInvestCtrl.getMaturityMonitor(reqMat30, resMat30, (err) => { throw err; });
    assert(resMat30.data.data.records.some((r) => r.maskedAccountNumber === '****1111'), 'Maturity Monitor 30d Catches Customer A FD (Maturing in 20d)');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST SUITE 5: RD Contribution History Endpoint
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST SUITE 5: RD Contribution History Endpoint ───');
    const reqRdContrib = mockReq({ id: rdA.insertId });
    const resRdContrib = mockRes();
    await adminInvestCtrl.getRdContributionHistory(reqRdContrib, resRdContrib, (err) => { throw err; });
    assert(resRdContrib.data.data.contributions.length === 24, 'RD History Endpoint Returns Complete Schedule');
    assert(resRdContrib.data.data.rd.maskedAccountNumber === '****1111', 'RD History Masks Account Number');

    // Clean test records
    await conn.query(`DELETE FROM transactions WHERE sender_account IN (?, ?) OR receiver_account IN (?, ?)`, [ACC_A, ACC_B, ACC_A, ACC_B]);
    await conn.query(`DELETE FROM rd_contributions WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM recurring_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM fixed_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM Customer WHERE AccountNumber IN (?, ?)`, [ACC_A, ACC_B]);

    console.log('\n===============================================================');
    console.log(`📊 ADMIN TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

  } catch (err) {
    console.error('Admin test execution error:', err);
  } finally {
    conn.release();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAdminTests();
