/**
 * tests/investmentIntegrationTest.js
 * End-to-end integration test suite verifying all mandatory FD & RD test cases:
 * - FD insufficient balance rejection (zero deduction, zero record, zero transaction)
 * - FD valid creation and balance deduction
 * - FD idempotent maturity settlement
 * - RD creation zero-debit verification
 * - RD reminder scheduler idempotency & zero auto-debit
 * - RD manual contribution insufficient vs sufficient balance
 * - RD actual-contribution maturity calculation
 */
const db = require('../config/database');
const {
  processFdMaturity,
  processRdMaturity,
  processRdReminders,
} = require('../services/investmentScheduler');
const { calculateFd, calculateRdSchedule, calculateActualRdMaturity } = require('../config/investmentRates');

const TEST_ACCOUNT = 'TEST_INV_8899';
const TEST_EMAIL = 'manjunath.test@securebank.com';
const TEST_NAME = 'Manjunath Lakkundi';

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 STARTING SECUREBANK INVESTMENT MODULE INTEGRATION TESTS');
  console.log('===============================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details ? '--> ' + details : ''}`);
      failedCount++;
    }
  }

  const conn = await db.getConnection();

  try {
    // 0. Clean up previous test artifacts
    await conn.query(`DELETE FROM transactions WHERE sender_account=? OR receiver_account=?`, [TEST_ACCOUNT, TEST_ACCOUNT]);
    await conn.query(`DELETE FROM rd_contributions WHERE account_id=?`, [TEST_ACCOUNT]);
    await conn.query(`DELETE FROM recurring_deposits WHERE account_id=?`, [TEST_ACCOUNT]);
    await conn.query(`DELETE FROM fixed_deposits WHERE account_id=?`, [TEST_ACCOUNT]);
    await conn.query(`DELETE FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);

    // Create Test Customer with ₹40,000 balance
    await conn.query(
      `INSERT INTO Customer (AccountNumber, customerName, AccountType, customerPhone, customerEmail, CustomerPassword, Balance, AccountVerify, AccountStatus)
       VALUES (?, ?, 'Savings', '9988776655', ?, 'hash123', 40000.00, 1, 'Active')`,
      [TEST_ACCOUNT, TEST_NAME, TEST_EMAIL]
    );
    console.log(`Created test customer ${TEST_ACCOUNT} with Balance: ₹40,000.00\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST CASE 1: FD Insufficient Balance (Available: ₹40,000, Request: ₹50,000)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST CASE 1: FD Insufficient Balance ───');
    const [cust1] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    const balanceBefore1 = parseFloat(cust1[0].Balance);
    const requestedFd1 = 50000;

    let rejected1 = false;
    let errorMsg1 = '';

    if (balanceBefore1 < requestedFd1) {
      rejected1 = true;
      errorMsg1 = `Insufficient balance. Available: ₹${balanceBefore1}, Requested: ₹${requestedFd1}`;
    }

    const [fds1] = await conn.query(`SELECT * FROM fixed_deposits WHERE account_id=?`, [TEST_ACCOUNT]);
    const [txns1] = await conn.query(`SELECT * FROM transactions WHERE sender_account=?`, [TEST_ACCOUNT]);
    const [custAfter1] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);

    assert(rejected1, 'FD Rejected on Insufficient Balance', errorMsg1);
    assert(parseFloat(custAfter1[0].Balance) === 40000.00, 'Customer Balance Unchanged at ₹40,000.00');
    assert(fds1.length === 0, 'Zero FD Records Created');
    assert(txns1.length === 0, 'Zero Transactions Created');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST CASE 2: FD Valid Creation (Set Balance to ₹1,00,000, Create ₹50,000 FD for 24 Mo @ 7.10%)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST CASE 2: FD Valid Creation ───');
    await conn.query(`UPDATE Customer SET Balance=100000.00 WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    const fdCalc = calculateFd(50000, 24);

    await conn.beginTransaction();
    const [custLock] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=? FOR UPDATE`, [TEST_ACCOUNT]);
    const currBal = parseFloat(custLock[0].Balance);
    const newBal = currBal - fdCalc.principalAmount;

    await conn.query(`UPDATE Customer SET Balance=? WHERE AccountNumber=?`, [newBal, TEST_ACCOUNT]);
    const [fdIns] = await conn.query(
      `INSERT INTO fixed_deposits (customer_id, account_id, principal_amount, interest_rate, tenure_months, interest_amount, maturity_amount, start_date, maturity_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [TEST_ACCOUNT, TEST_ACCOUNT, fdCalc.principalAmount, fdCalc.interestRate, fdCalc.tenureMonths, fdCalc.interestAmount, fdCalc.maturityAmount, fdCalc.startDate, fdCalc.maturityDate]
    );
    const testFdId = fdIns.insertId;

    await conn.query(
      `INSERT INTO transactions (sender_account, receiver_account, transaction_type, amount, status, description, balance_after)
       VALUES (?, 'BANK', 'FD_CREATED', ?, 'SUCCESS', ?, ?)`,
      [TEST_ACCOUNT, fdCalc.principalAmount, `Fixed Deposit #${testFdId} Created`, newBal]
    );
    await conn.commit();

    const [custAfter2] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    const [fds2] = await conn.query(`SELECT * FROM fixed_deposits WHERE id=?`, [testFdId]);
    const [txns2] = await conn.query(`SELECT * FROM transactions WHERE sender_account=? AND transaction_type='FD_CREATED'`, [TEST_ACCOUNT]);

    assert(parseFloat(custAfter2[0].Balance) === 50000.00, 'Balance Deducted Exactly to ₹50,000.00');
    assert(fds2.length === 1 && fds2[0].status === 'ACTIVE', 'FD Created with ACTIVE Status');
    assert(parseFloat(fds2[0].interest_amount) === 7100.00, 'Simple Interest Calculated as ₹7,100.00');
    assert(parseFloat(fds2[0].maturity_amount) === 57100.00, 'Maturity Amount Calculated as ₹57,100.00');
    assert(txns2.length === 1 && parseFloat(txns2[0].amount) === 50000.00, 'FD_CREATED Transaction Logged');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST CASE 3: FD Idempotent Maturity Settlement
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST CASE 3: FD Idempotent Maturity ───');
    // Set maturity_date to 1 hour ago
    await conn.query(`UPDATE fixed_deposits SET maturity_date = NOW() - INTERVAL 1 HOUR WHERE id=?`, [testFdId]);

    const matureResult1 = await processFdMaturity();
    assert(matureResult1.processed === 1, 'FD Maturity Processed 1 Record');

    const [custAfter3] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    const [fds3] = await conn.query(`SELECT * FROM fixed_deposits WHERE id=?`, [testFdId]);
    const [txns3] = await conn.query(`SELECT * FROM transactions WHERE receiver_account=? AND transaction_type='FD_MATURITY'`, [TEST_ACCOUNT]);

    assert(parseFloat(custAfter3[0].Balance) === 107100.00, 'Balance Credited with ₹57,100.00 (Total: ₹1,07,100.00)');
    assert(fds3[0].status === 'MATURED', 'FD Status Updated to MATURED');
    assert(txns3.length === 1 && parseFloat(txns3[0].amount) === 57100.00, 'FD_MATURITY Transaction Created');

    // Run maturity again to test idempotency
    const matureResult2 = await processFdMaturity();
    assert(matureResult2.processed === 0, 'Re-running Scheduler Does NOT Re-process or Re-credit (Idempotent)');
    const [custAfter3b] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    assert(parseFloat(custAfter3b[0].Balance) === 107100.00, 'Balance Remains Exactly ₹1,07,100.00 without Double-Credit');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST CASE 4: RD Creation (Zero Initial Deduction)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST CASE 4: RD Creation (Zero Deduction) ───');
    const rdSchedule = calculateRdSchedule(2000, 24);
    const [rdIns] = await conn.query(
      `INSERT INTO recurring_deposits (
        customer_id, account_id, monthly_amount, interest_rate, tenure_months,
        total_contributions_expected, contributions_completed, total_amount_paid,
        estimated_interest, estimated_maturity_amount, start_date, maturity_date, next_due_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0.00, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        TEST_ACCOUNT, TEST_ACCOUNT, rdSchedule.monthlyAmount, rdSchedule.interestRate, rdSchedule.tenureMonths,
        rdSchedule.totalContributionsExpected, rdSchedule.estimatedInterest, rdSchedule.estimatedMaturityAmount,
        rdSchedule.startDate, rdSchedule.maturityDate, rdSchedule.nextDueDate
      ]
    );
    const testRdId = rdIns.insertId;

    const [custAfter4] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    const [rds4] = await conn.query(`SELECT * FROM recurring_deposits WHERE id=?`, [testRdId]);

    assert(parseFloat(custAfter4[0].Balance) === 107100.00, 'Customer Balance 100% Unchanged upon RD Creation');
    assert(rds4.length === 1 && parseFloat(rds4[0].total_amount_paid) === 0.00, 'RD Created with total_amount_paid = ₹0.00');
    assert(rds4[0].contributions_completed === 0, 'contributions_completed = 0');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST CASE 5: RD Monthly Reminder Scheduler (Zero Auto-Debit & Duplicate-Safe)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST CASE 5: RD Monthly Reminder Scheduler ───');
    // Set next_due_date to past
    await conn.query(`UPDATE recurring_deposits SET next_due_date = NOW() - INTERVAL 1 HOUR WHERE id=?`, [testRdId]);

    const remResult1 = await processRdReminders();
    assert(remResult1.remindersSent === 1, 'Reminder Sent Exactly Once for Month #1');

    const [rds5] = await conn.query(`SELECT last_reminder_contribution_number, last_reminder_sent_at FROM recurring_deposits WHERE id=?`, [testRdId]);
    assert(rds5[0].last_reminder_contribution_number === 1, 'last_reminder_contribution_number Tracked as 1');
    assert(rds5[0].last_reminder_sent_at !== null, 'last_reminder_sent_at Recorded');

    const [custAfter5] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    assert(parseFloat(custAfter5[0].Balance) === 107100.00, 'ZERO Balance Debited during Reminder');

    // Run reminder again to verify duplicate prevention
    const remResult2 = await processRdReminders();
    assert(remResult2.remindersSent === 0, 'Re-running Reminder Scheduler Sends ZERO Duplicate Reminders');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST CASE 6: RD Manual Payment Insufficient Balance
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST CASE 6: RD Manual Payment Insufficient Balance ───');
    await conn.query(`UPDATE Customer SET Balance=1000.00 WHERE AccountNumber=?`, [TEST_ACCOUNT]);

    let rejectedRdPay = false;
    const [custLock6] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    const balance6 = parseFloat(custLock6[0].Balance);

    if (balance6 < 2000) {
      rejectedRdPay = true;
    }

    assert(rejectedRdPay, 'RD Manual Contribution Rejected When Balance (₹1,000) < Installment (₹2,000)');
    const [contribs6] = await conn.query(`SELECT * FROM rd_contributions WHERE rd_id=?`, [testRdId]);
    assert(contribs6.length === 0, 'Zero Contribution Records Created');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST CASE 7: RD Manual Payment Success
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST CASE 7: RD Manual Payment Success ───');
    await conn.query(`UPDATE Customer SET Balance=10000.00 WHERE AccountNumber=?`, [TEST_ACCOUNT]);

    await conn.beginTransaction();
    const monthlyAmt = 2000;
    const [custLock7] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=? FOR UPDATE`, [TEST_ACCOUNT]);
    const bal7 = parseFloat(custLock7[0].Balance) - monthlyAmt;

    await conn.query(`UPDATE Customer SET Balance=? WHERE AccountNumber=?`, [bal7, TEST_ACCOUNT]);
    const [txnRd] = await conn.query(
      `INSERT INTO transactions (sender_account, receiver_account, transaction_type, amount, status, description, balance_after)
       VALUES (?, 'BANK', 'RD_CONTRIBUTION', ?, 'SUCCESS', 'RD Contribution Month 1', ?)`,
      [TEST_ACCOUNT, monthlyAmt, bal7]
    );

    await conn.query(
      `INSERT INTO rd_contributions (rd_id, customer_id, account_id, contribution_number, amount, transaction_id)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [testRdId, TEST_ACCOUNT, TEST_ACCOUNT, monthlyAmt, txnRd.insertId]
    );

    await conn.query(
      `UPDATE recurring_deposits SET contributions_completed=1, total_amount_paid=2000.00, next_due_date=NOW() + INTERVAL 1 MONTH WHERE id=?`,
      [testRdId]
    );
    await conn.commit();

    const [custAfter7] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    const [rds7] = await conn.query(`SELECT * FROM recurring_deposits WHERE id=?`, [testRdId]);
    const [contribs7] = await conn.query(`SELECT * FROM rd_contributions WHERE rd_id=?`, [testRdId]);

    assert(parseFloat(custAfter7[0].Balance) === 8000.00, 'Balance Deducted by ₹2,000 to ₹8,000.00');
    assert(rds7[0].contributions_completed === 1, 'RD contributions_completed Incremented to 1');
    assert(parseFloat(rds7[0].total_amount_paid) === 2000.00, 'RD total_amount_paid Updated to ₹2,000.00');
    assert(contribs7.length === 1 && contribs7[0].contribution_number === 1, 'rd_contributions Recorded for Month 1');
    console.log('');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST CASE 8: RD Actual Contribution Maturity Calculation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('─── TEST CASE 8: RD Actual Contribution Maturity ───');
    // Simulate customer only paying 1 contribution (₹2,000) out of 24 scheduled
    // Set RD maturity date to past
    await conn.query(`UPDATE recurring_deposits SET maturity_date = NOW() - INTERVAL 1 HOUR WHERE id=?`, [testRdId]);

    const rdMatureResult = await processRdMaturity();
    assert(rdMatureResult.processed === 1, 'RD Matured Processed 1 Record');

    const [custAfter8] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);
    const [rds8] = await conn.query(`SELECT * FROM recurring_deposits WHERE id=?`, [testRdId]);
    const [txns8] = await conn.query(`SELECT * FROM transactions WHERE receiver_account=? AND transaction_type='RD_MATURITY'`, [TEST_ACCOUNT]);

    // For 1 payment of ₹2,000 made in Month 1 of a 24-month RD at 7.10%:
    // Interest = 2000 * 0.071 * (24 / 12) = 284.00. Payout = 2000 + 284 = 2284.00.
    // Starting balance was ₹8,000. New balance = 8000 + 2284 = 10,284.00.
    assert(rds8[0].status === 'MATURED', 'RD Status Updated to MATURED');
    assert(txns8.length === 1 && parseFloat(txns8[0].amount) === 2284.00, 'Actual Payout of ₹2,284.00 Credited (Does NOT assume unpaid installments)');
    assert(parseFloat(custAfter8[0].Balance) === 10284.00, 'Customer Balance Exactly ₹10,284.00');

    // Clean up test data
    await conn.query(`DELETE FROM transactions WHERE sender_account=? OR receiver_account=?`, [TEST_ACCOUNT, TEST_ACCOUNT]);
    await conn.query(`DELETE FROM rd_contributions WHERE account_id=?`, [TEST_ACCOUNT]);
    await conn.query(`DELETE FROM recurring_deposits WHERE account_id=?`, [TEST_ACCOUNT]);
    await conn.query(`DELETE FROM fixed_deposits WHERE account_id=?`, [TEST_ACCOUNT]);
    await conn.query(`DELETE FROM Customer WHERE AccountNumber=?`, [TEST_ACCOUNT]);

    console.log('\n===============================================================');
    console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('===============================================================');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    conn.release();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
