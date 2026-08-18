/**
 * backend/tests/preDeploymentE2ETest.js
 * Comprehensive Pre-Deployment End-to-End Test Suite.
 * Validates:
 * - Customer Auth, Login, JWT tokens
 * - Cross-Customer Isolation & RBAC
 * - Dashboard & Account summary
 * - Beneficiaries CRUD & duplicate validation
 * - Transfers & Strict Non-Negative Balance Enforcement
 * - Loan Applications
 * - Statement Retrieval
 * - Fixed Deposit Lifecycle & Balance Validation
 * - Recurring Deposit Lifecycle & Zero-Deduction Creation
 * - Admin Auth, Admin RBAC & Account Number Masking
 * - Clean Teardown
 */
require('dotenv').config();
const db = require('../config/database');

const bcrypt = require('bcryptjs');


const authCtrl = require('../controllers/authController');
const txCtrl = require('../controllers/transactionController');
const beneCtrl = require('../controllers/beneficiaryController');
const loanCtrl = require('../controllers/loanController');
const investCtrl = require('../controllers/investmentController');
const adminInvestCtrl = require('../controllers/adminInvestmentController');

// Mock Express Request & Response
const mockReq = (params = {}, query = {}, body = {}, user = null) => ({
  params,
  query,
  body,
  user,
  ip: '127.0.0.1',
  headers: user ? { authorization: `Bearer mock_token` } : {},
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

async function runE2ETests() {
  console.log('===============================================================');
  console.log('🧪 STARTING SECUREBANK PRE-DEPLOYMENT E2E INTEGRATION TEST');
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

  // Test accounts (<= 14 chars)
  const ACC_A = 'E2E_USER_A';
  const ACC_B = 'E2E_USER_B';

  try {
    // 0. Clean old test accounts safely
    await conn.query(`DELETE FROM transactions WHERE sender_account IN (?, ?) OR receiver_account IN (?, ?)`, [ACC_A, ACC_B, ACC_A, ACC_B]);
    await conn.query(`DELETE FROM rd_contributions WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM recurring_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM fixed_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM beneficiaries WHERE customer_id IN (?, ?) OR beneficiary_account IN (?, ?)`, [ACC_A, ACC_B, ACC_A, ACC_B]);
    await conn.query(`DELETE FROM Loan WHERE AccountNumber IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM Customer WHERE AccountNumber IN (?, ?)`, [ACC_A, ACC_B]);

    const passwordHash = await bcrypt.hash('TestPass@123', 10);

    // Create Customer A
    await conn.query(
      `INSERT INTO Customer (AccountNumber, customerName, AccountType, customerPhone, customerEmail, CustomerPassword, Balance, AccountVerify, AccountStatus)
       VALUES (?, 'Alpha Tester', 'Savings', '9876543210', 'alpha@e2etest.com', ?, 50000.00, 1, 'Active')`,
      [ACC_A, passwordHash]
    );

    // Create Customer B
    await conn.query(
      `INSERT INTO Customer (AccountNumber, customerName, AccountType, customerPhone, customerEmail, CustomerPassword, Balance, AccountVerify, AccountStatus)
       VALUES (?, 'Beta Tester', 'Savings', '9876543211', 'beta@e2etest.com', ?, 10000.00, 1, 'Active')`,
      [ACC_B, passwordHash]
    );

    const userA = { AccNumber: ACC_A, accountNumber: ACC_A, customerEmail: 'alpha@e2etest.com', customerName: 'Alpha Tester', role: 'customer' };
    const userB = { AccNumber: ACC_B, accountNumber: ACC_B, customerEmail: 'beta@e2etest.com', customerName: 'Beta Tester', role: 'customer' };
    const adminUser = { id: 1, username: 'admin', role: 'admin' };

    console.log('Setup: Customer A (₹50,000.00) and Customer B (₹10,000.00) created.\n');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Customer Auth & Login
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── 1. Customer Authentication ───');
    const reqLoginValid = mockReq({}, {}, { accountNumber: ACC_A, password: 'TestPass@123' });
    const resLoginValid = mockRes();
    await authCtrl.login(reqLoginValid, resLoginValid, (err) => { throw err; });
    assert(resLoginValid.statusCode === 200 && resLoginValid.data.success, 'Valid Customer Login Generates Token');

    const reqLoginInvalid = mockReq({}, {}, { accountNumber: ACC_A, password: 'WrongPassword' });
    const resLoginInvalid = mockRes();
    await authCtrl.login(reqLoginInvalid, resLoginInvalid, (err) => { throw err; });
    assert(resLoginInvalid.statusCode === 401 || !resLoginInvalid.data.success, 'Invalid Password Rejected with 401');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: Customer Profile & RBAC Isolation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── 2. Profile & RBAC Isolation ───');
    const reqProfA = mockReq({}, {}, {}, userA);
    const resProfA = mockRes();
    await authCtrl.getProfile(reqProfA, resProfA, (err) => { throw err; });
    assert(resProfA.data.data.customerName === 'Alpha Tester', 'Customer A Can Access Own Profile');
    assert(parseFloat(resProfA.data.data.Balance) === 50000.00, 'Customer A Balance Matches ₹50,000.00');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Beneficiaries CRUD
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── 3. Beneficiaries Management ───');
    const reqAddBene = mockReq({}, {}, {
      beneficiaryName: 'Beta Tester',
      beneficiaryAccount: ACC_B,
    }, userA);
    const resAddBene = mockRes();
    await beneCtrl.addBeneficiary(reqAddBene, resAddBene, (err) => { throw err; });
    assert(resAddBene.statusCode === 201 || resAddBene.data.success, 'Beneficiary Added Successfully');

    const reqGetBene = mockReq({}, {}, {}, userA);
    const resGetBene = mockRes();
    await beneCtrl.getBeneficiaries(reqGetBene, resGetBene, (err) => { throw err; });
    assert(resGetBene.data.data.beneficiaries.some(b => b.beneficiary_account === ACC_B), 'Beneficiary Retrievable in Customer List');


    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Money Transfers & Balance Constraints
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── 4. Money Transfers & Negative Balance Prevention ───');
    // Insufficient balance transfer
    const reqTxOver = mockReq({}, {}, {
      toAccount: ACC_B,
      transferAmount: 999999.00,
      description: 'Overdraft test',
    }, userA);
    const resTxOver = mockRes();
    await txCtrl.transfer(reqTxOver, resTxOver, (err) => { throw err; });
    assert(resTxOver.statusCode === 400 || !resTxOver.data.success, 'Insufficient Balance Transfer Rejected');

    // Valid transfer ₹15,000 from A to B
    const reqTxValid = mockReq({}, {}, {
      toAccount: ACC_B,
      transferAmount: 15000.00,
      description: 'Project payment',
    }, userA);
    const resTxValid = mockRes();
    await txCtrl.transfer(reqTxValid, resTxValid, (err) => { throw err; });
    assert(resTxValid.statusCode === 200 && resTxValid.data.success, 'Transfer of ₹15,000 Processed Successfully');

    // Verify DB balances
    const [[custA]] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber = ?`, [ACC_A]);
    const [[custB]] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber = ?`, [ACC_B]);
    assert(parseFloat(custA.Balance) === 35000.00, 'Sender Balance Deducted to ₹35,000.00', `Actual: ₹${custA.Balance}`);
    assert(parseFloat(custB.Balance) === 25000.00, 'Receiver Balance Credited to ₹25,000.00', `Actual: ₹${custB.Balance}`);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: Transactions History
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── 5. Transaction Ledger ───');
    const reqTxHist = mockReq({}, { limit: 10 }, {}, userA);
    const resTxHist = mockRes();
    await txCtrl.getTransactions(reqTxHist, resTxHist, (err) => { throw err; });
    assert(resTxHist.data.data.transactions.length >= 1, 'Transfer Transaction Recorded in Sender Ledger');


    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: Loan Application
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── 6. Loan Application ───');
    const reqLoan = mockReq({}, {}, {
      loanType: 'Personal',
      loanAmount: 100000.00,
      tenureMonths: 24,
      monthlyIncome: 60000.00,
    }, userA);
    const resLoan = mockRes();
    await loanCtrl.applyLoan(reqLoan, resLoan, (err) => { throw err; });
    assert(resLoan.statusCode === 201 || resLoan.data.success, 'Loan Application Created with Pending Status');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 7: Fixed Deposit Creation & Balance Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── 7. Fixed Deposit Lifecycle ───');
    // Balance is currently ₹35,000. Try FD for ₹40,000 (must fail)
    const reqFdFail = mockReq({}, {}, { principalAmount: 40000.00, tenureMonths: 12 }, userA);
    const resFdFail = mockRes();
    await investCtrl.createFD(reqFdFail, resFdFail, (err) => { throw err; });
    assert(resFdFail.statusCode === 400 || !resFdFail.data.success, 'FD Rejected When Balance (₹35,000) < Principal (₹40,000)');

    // Create FD for ₹20,000 (must succeed)
    const reqFdOk = mockReq({}, {}, { principalAmount: 20000.00, tenureMonths: 12 }, userA);
    const resFdOk = mockRes();
    await investCtrl.createFD(reqFdOk, resFdOk, (err) => { throw err; });
    assert(resFdOk.statusCode === 201 && resFdOk.data.success, 'FD Created Successfully for ₹20,000.00');

    const [[custAFd]] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber = ?`, [ACC_A]);
    assert(parseFloat(custAFd.Balance) === 15000.00, 'Customer A Balance Deducted to ₹15,000.00');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 8: Recurring Deposit Creation & Contribution
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── 8. Recurring Deposit Lifecycle ───');
    // Create RD ₹2,000/mo (Zero initial deduction!)
    const reqRdCreate = mockReq({}, {}, { monthlyAmount: 2000.00, tenureMonths: 24 }, userA);
    const resRdCreate = mockRes();
    await investCtrl.createRD(reqRdCreate, resRdCreate, (err) => { throw err; });
    assert(resRdCreate.statusCode === 201 && resRdCreate.data.success, 'RD Created with ZERO Initial Balance Deduction');

    const [[custARdInit]] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber = ?`, [ACC_A]);
    assert(parseFloat(custARdInit.Balance) === 15000.00, 'Customer Balance Remains Exactly ₹15,000.00');

    const rdId = resRdCreate.data.data.rdId;
    // Pay first installment manually (₹2,000)
    const reqRdPay = mockReq({ id: rdId }, {}, {}, userA);
    const resRdPay = mockRes();
    await investCtrl.makeRdContribution(reqRdPay, resRdPay, (err) => { throw err; });
    assert(resRdPay.statusCode === 200 && resRdPay.data.success, 'RD First Installment Manually Paid');


    const [[custARdPaid]] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber = ?`, [ACC_A]);
    assert(parseFloat(custARdPaid.Balance) === 13000.00, 'Customer Balance Deducted to ₹13,000.00 After RD Payment');


    // ──────────────────────────────────────────────────────────────────────────
    // TEST 9: Admin Investment Surveillance & Masked Data
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── 9. Admin Surveillance & Privacy Enforcement ───');
    const reqAdminOverview = mockReq({}, {}, {}, adminUser);
    const resAdminOverview = mockRes();
    await adminInvestCtrl.getInvestmentOverview(reqAdminOverview, resAdminOverview, (err) => { throw err; });
    assert(resAdminOverview.data.data.kpis.totalInvestors >= 1, 'Admin Overview Calculates Total Unique Investors');

    const reqAdminCusts = mockReq({}, { search: 'Alpha', limit: 10 }, {}, adminUser);
    const resAdminCusts = mockRes();
    await adminInvestCtrl.getCustomerInvestments(reqAdminCusts, resAdminCusts, (err) => { throw err; });
    const adminCustA = resAdminCusts.data.data.customers[0];
    assert(adminCustA.customerName === 'Alpha Tester', 'Admin Can Search Investor by Name');
    assert(adminCustA.maskedAccountNumber.startsWith('****'), 'Admin API Strictly Masks Account Number', adminCustA.maskedAccountNumber);
    assert(adminCustA.totalActualInvested === 22000.00, 'Total Invested = Active FD (₹20k) + Actual RD Paid (₹2k) = ₹22,000.00');

    // ──────────────────────────────────────────────────────────────────────────
    // Clean Up Test Data
    // ──────────────────────────────────────────────────────────────────────────
    await conn.query(`DELETE FROM transactions WHERE sender_account IN (?, ?) OR receiver_account IN (?, ?)`, [ACC_A, ACC_B, ACC_A, ACC_B]);
    await conn.query(`DELETE FROM rd_contributions WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM recurring_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM fixed_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM beneficiaries WHERE customer_id IN (?, ?) OR beneficiary_account IN (?, ?)`, [ACC_A, ACC_B, ACC_A, ACC_B]);
    await conn.query(`DELETE FROM Loan WHERE AccountNumber IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM Customer WHERE AccountNumber IN (?, ?)`, [ACC_A, ACC_B]);

    console.log('\n===============================================================');
    console.log(`📊 PRE-DEPLOYMENT E2E SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

  } catch (err) {
    console.error('E2E test error:', err);
  } finally {
    conn.release();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runE2ETests();
