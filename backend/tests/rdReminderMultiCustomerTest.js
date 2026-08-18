/**
 * backend/tests/rdReminderMultiCustomerTest.js
 * Multi-customer RD monthly reminder integration and customer-isolation test.
 * 
 * Verifies:
 * 1. Correct recipient email and customer mapping (Zero cross-customer data leakage).
 * 2. All email template fields contain valid numbers/dates (No NaN, undefined, or Invalid Date).
 * 3. Zero automatic balance deductions during reminder dispatches.
 * 4. Idempotency / duplicate reminder prevention.
 */
const assert = require('assert');
const db = require('../config/database');
const emailService = require('../services/emailService');
const investmentScheduler = require('../services/investmentScheduler');

// Intercept emails to inspect exact rendered HTML and parameters
const sentEmails = [];
const originalSendRdMonthlyReminderEmail = emailService.sendRdMonthlyReminderEmail;

emailService.sendRdMonthlyReminderEmail = async (toEmail, customerName, rd, dueMonthNumber) => {
  sentEmails.push({
    toEmail,
    customerName,
    rd: { ...rd },
    dueMonthNumber,
  });
  return originalSendRdMonthlyReminderEmail(toEmail, customerName, rd, dueMonthNumber);
};

const runTest = async () => {
  console.log('===============================================================');
  console.log('🧪 STARTING RD MONTHLY REMINDER MULTI-CUSTOMER ISOLATION TEST');
  console.log('===============================================================');

  const conn = await db.getConnection();
  try {
    // 1. Setup two distinct customers
    const ACC_A = 'TEST_REMIND_A';
    const ACC_B = 'TEST_REMIND_B';

    // Cleanup previous test state if any
    await conn.query(`DELETE FROM rd_contributions WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM recurring_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM Customer WHERE AccountNumber IN (?, ?) OR customerEmail IN ('rahul@securebank.com', 'bhavesh@securebank.com') OR customerPhone IN ('9876543210', '9876543211')`, [ACC_A, ACC_B]);


    // Insert Customer A (Rahul Sharma, ₹50,000.00 balance)
    await conn.query(
      `INSERT INTO Customer (AccountNumber, customerName, customerEmail, customerPhone, CustomerPassword, Balance, AccountStatus, AccountVerify)
       VALUES (?, 'Rahul Sharma', 'rahul@securebank.com', '9876543210', 'hashed_pw', 50000.00, 'Active', 1)`,
      [ACC_A]
    );

    // Insert Customer B (Bhavesh Patel, ₹75,000.00 balance)
    await conn.query(
      `INSERT INTO Customer (AccountNumber, customerName, customerEmail, customerPhone, CustomerPassword, Balance, AccountStatus, AccountVerify)
       VALUES (?, 'Bhavesh Patel', 'bhavesh@securebank.com', '9876543211', 'hashed_pw', 75000.00, 'Active', 1)`,
      [ACC_B]
    );

    // 2. Setup RD for Customer A: ₹2,000/mo, 12 months, 4 contributions paid (Total Paid: ₹8,000.00), Due date in past
    const pastDueDateA = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
    const maturityDateA = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000);
    const [resRdA] = await conn.query(
      `INSERT INTO recurring_deposits (
        customer_id, account_id, monthly_amount, interest_rate, tenure_months, total_contributions_expected,
        contributions_completed, total_amount_paid, estimated_interest, estimated_maturity_amount,
        start_date, maturity_date, next_due_date, status, last_reminder_contribution_number
      ) VALUES (?, ?, 2000.00, 6.75, 12, 12, 4, 8000.00, 888.00, 24888.00, DATE_SUB(NOW(), INTERVAL 4 MONTH), ?, ?, 'ACTIVE', 0)`,
      [ACC_A, ACC_A, maturityDateA, pastDueDateA]
    );
    const rdIdA = resRdA.insertId;

    // 3. Setup RD for Customer B: ₹5,000/mo, 24 months, 7 contributions paid (Total Paid: ₹35,000.00), Due date in past
    const pastDueDateB = new Date(Date.now() - 48 * 60 * 60 * 1000); // 2 days ago
    const maturityDateB = new Date(Date.now() + 500 * 24 * 60 * 60 * 1000);
    const [resRdB] = await conn.query(
      `INSERT INTO recurring_deposits (
        customer_id, account_id, monthly_amount, interest_rate, tenure_months, total_contributions_expected,
        contributions_completed, total_amount_paid, estimated_interest, estimated_maturity_amount,
        start_date, maturity_date, next_due_date, status, last_reminder_contribution_number
      ) VALUES (?, ?, 5000.00, 7.10, 24, 24, 7, 35000.00, 9000.00, 129000.00, DATE_SUB(NOW(), INTERVAL 7 MONTH), ?, ?, 'ACTIVE', 0)`,
      [ACC_B, ACC_B, maturityDateB, pastDueDateB]
    );
    const rdIdB = resRdB.insertId;



    console.log(`Setup complete: Customer A (RD #${rdIdA}), Customer B (RD #${rdIdB})`);

    // Record pre-reminder balances
    const [[custAPre]] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [ACC_A]);
    const [[custBPre]] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [ACC_B]);

    // 4. Execute the Reminder Scheduler
    sentEmails.length = 0;
    const reminderResult = await investmentScheduler.processRdReminders();

    console.log(`\n─── 1. Reminder Execution & Count ───`);
    assert.strictEqual(reminderResult.remindersSent, 2, 'Exactly 2 reminders should be dispatched');
    assert.strictEqual(sentEmails.length, 2, 'Exactly 2 email dispatches captured');
    console.log('✅ PASS: Exactly 2 distinct customer reminders dispatched');

    // 5. Verify Customer A Email Parameters
    console.log(`\n─── 2. Customer A Email Parameters Verification ───`);
    const emailA = sentEmails.find((e) => e.toEmail === 'rahul@securebank.com');
    assert.ok(emailA, 'Customer A email must be addressed to rahul@securebank.com');
    assert.strictEqual(emailA.customerName, 'Rahul Sharma', 'Customer A name matches');
    assert.strictEqual(emailA.rd.id, rdIdA, 'RD ID matches Customer A RD');
    assert.strictEqual(parseFloat(emailA.rd.monthlyAmount), 2000.00, 'Monthly Amount is ₹2000.00');
    assert.strictEqual(emailA.dueMonthNumber, 5, 'Contribution number is Month 5');
    assert.strictEqual(emailA.rd.totalContributionsExpected, 12, 'Total contributions is 12');
    assert.strictEqual(parseFloat(emailA.rd.totalAmountPaid), 8000.00, 'Total paid is ₹8000.00');
    assert.ok(!isNaN(new Date(emailA.rd.nextDueDate).getTime()), 'Next due date is a valid date object');
    console.log('✅ PASS: Customer A Email: Rahul Sharma, ₹2,000.00, Month 5 of 12, Paid: ₹8,000.00 (No NaN / undefined)');

    // 6. Verify Customer B Email Parameters
    console.log(`\n─── 3. Customer B Email Parameters Verification ───`);
    const emailB = sentEmails.find((e) => e.toEmail === 'bhavesh@securebank.com');
    assert.ok(emailB, 'Customer B email must be addressed to bhavesh@securebank.com');
    assert.strictEqual(emailB.customerName, 'Bhavesh Patel', 'Customer B name matches');
    assert.strictEqual(emailB.rd.id, rdIdB, 'RD ID matches Customer B RD');
    assert.strictEqual(parseFloat(emailB.rd.monthlyAmount), 5000.00, 'Monthly Amount is ₹5000.00');
    assert.strictEqual(emailB.dueMonthNumber, 8, 'Contribution number is Month 8');
    assert.strictEqual(emailB.rd.totalContributionsExpected, 24, 'Total contributions is 24');
    assert.strictEqual(parseFloat(emailB.rd.totalAmountPaid), 35000.00, 'Total paid is ₹35000.00');
    assert.ok(!isNaN(new Date(emailB.rd.nextDueDate).getTime()), 'Next due date is a valid date object');
    console.log('✅ PASS: Customer B Email: Bhavesh Patel, ₹5,000.00, Month 8 of 24, Paid: ₹35,000.00 (No NaN / undefined)');

    // 7. Verify ZERO Balance Debit Rule
    console.log(`\n─── 4. Non-Debit Verification (Business Rule Preservation) ───`);
    const [[custAPost]] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [ACC_A]);
    const [[custBPost]] = await conn.query(`SELECT Balance FROM Customer WHERE AccountNumber=?`, [ACC_B]);

    assert.strictEqual(parseFloat(custAPost.Balance), parseFloat(custAPre.Balance), 'Customer A Balance must NOT change');
    assert.strictEqual(parseFloat(custBPost.Balance), parseFloat(custBPre.Balance), 'Customer B Balance must NOT change');
    console.log('✅ PASS: Customer A balance remains ₹50,000.00 (ZERO auto-debit)');
    console.log('✅ PASS: Customer B balance remains ₹75,000.00 (ZERO auto-debit)');

    // 8. Verify Idempotency / No Duplicate Reminders
    console.log(`\n─── 5. Idempotency & Duplicate Prevention ───`);
    sentEmails.length = 0;
    const rerunResult = await investmentScheduler.processRdReminders();
    assert.strictEqual(rerunResult.remindersSent, 0, 'Re-running reminder scheduler must send 0 reminders');
    assert.strictEqual(sentEmails.length, 0, 'No duplicate emails dispatched');
    console.log('✅ PASS: Re-running scheduler sends ZERO duplicate reminder emails');

    // 9. Clean up test records
    await conn.query(`DELETE FROM rd_contributions WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM recurring_deposits WHERE account_id IN (?, ?)`, [ACC_A, ACC_B]);
    await conn.query(`DELETE FROM Customer WHERE AccountNumber IN (?, ?)`, [ACC_A, ACC_B]);

    console.log('\n===============================================================');
    console.log('📊 RD REMINDER MULTI-CUSTOMER TEST: ALL ASSERTIONS PASSED ✅');
    console.log('===============================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    conn.release();
  }
};

runTest();
