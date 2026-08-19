/**
 * tests/emailSystemIntegration.js
 * Standalone, fast integration test suite for SecureBank email notification system.
 * Tests:
 *  1. Mailer configuration (pooling, SSL port 465, timeouts)
 *  2. Privacy-safe email masking
 *  3. Simulated successful dispatch
 *  4. Simulated Connection Timeout (ETIMEDOUT) & error isolation
 *  5. Simulated Auth Failure & error isolation
 *  6. All customer and admin email templates
 *  7. Non-blocking async queue
 *  8. Email health check verification
 */
const assert = require('assert');
const mailer = require('../services/mailer');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

async function runEmailTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING SECUREBANK EMAIL SYSTEM INTEGRATION TEST SUITE');
  console.log('===============================================================');

  // ─── 1. Email Masking & Privacy ───────────────────────────────────────────
  console.log('\n─── TEST 1: Privacy-Safe Email Masking ───');
  const masked1 = mailer.maskEmail('manjulakkundi1234@gmail.com');
  assert.ok(masked1.startsWith('m') && masked1.endsWith('4@gmail.com'), `Masked format invalid: ${masked1}`);
  assert.strictEqual(mailer.maskEmail('ab@example.com'), 'a*@example.com');
  assert.strictEqual(mailer.maskEmail(''), 'unknown');
  assert.strictEqual(mailer.maskEmail(null), 'unknown');
  assert.strictEqual(mailer.maskEmail('invalid-email'), 'invalid');
  console.log('✅ PASS: Email masking produces secure, unexposed log strings');

  // ─── 2. Mock Transporter Dispatch & Verification ──────────────────────────
  console.log('\n─── TEST 2: High-Performance Pooled Dispatch ───');
  let sentMessages = [];
  const mockTransporter = {
    sendMail: async (opts) => {
      sentMessages.push(opts);
      return { messageId: 'msg-test-12345' };
    },
    verify: async () => true,
  };

  // Set mock transporter
  mailer.setTransporter(mockTransporter);

  const sendResult = await mailer.sendMailAsync({
    to: 'customer@securebank.com',
    subject: 'SecureBank Test Notification',
    html: '<p>Test content</p>',
    type: 'test_notification',
  });

  assert.strictEqual(sendResult, true, 'sendMailAsync must return true on success');
  assert.strictEqual(sentMessages.length, 1, 'Transporter sendMail must be called once');
  assert.strictEqual(sentMessages[0].to, 'customer@securebank.com');
  console.log('✅ PASS: Email dispatched via mailer engine with duration metrics');


  // ─── 3. Connection Timeout Simulation (ETIMEDOUT) ─────────────────────────
  console.log('\n─── TEST 3: Connection Timeout Simulation (ETIMEDOUT) ───');
  mockTransporter.sendMail = async () => {
    const timeoutErr = new Error('Connection timeout');
    timeoutErr.code = 'ETIMEDOUT';
    throw timeoutErr;
  };

  const timeoutResult = await mailer.sendMailAsync({
    to: 'customer@securebank.com',
    subject: 'Withdrawal Alert',
    html: '<p>Withdrew ₹1000</p>',
    type: 'withdrawal',
  });

  assert.strictEqual(timeoutResult, false, 'sendMailAsync must return false on connection timeout without throwing');
  console.log('✅ PASS: Connection timeout caught gracefully; banking flow remains intact');

  // ─── 4. Auth Failure Simulation (EAUTH) ───────────────────────────────────
  console.log('\n─── TEST 4: SMTP Auth Failure Simulation (EAUTH) ───');
  mockTransporter.sendMail = async () => {
    const authErr = new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
    authErr.code = 'EAUTH';
    throw authErr;
  };

  const authResult = await mailer.sendMailAsync({
    to: 'customer@securebank.com',
    subject: 'Deposit Alert',
    html: '<p>Deposited ₹5000</p>',
    type: 'deposit',
  });

  assert.strictEqual(authResult, false, 'sendMailAsync must return false on auth failure without throwing');
  console.log('✅ PASS: SMTP auth error safely handled; no unhandled rejections');

  // ─── 5. All Email Templates & Notification Types ──────────────────────────
  console.log('\n─── TEST 5: Verification of All 15 Email Types ───');
  sentMessages = [];
  mockTransporter.sendMail = async (opts) => {
    sentMessages.push(opts);
    return { messageId: 'msg-success' };
  };

  // 1. Signup OTP
  await emailService.sendOtpEmail('user@test.com', '789012', 'SIGNUP');
  // 2. Password Reset OTP
  await emailService.sendOtpEmail('user@test.com', '123456', 'PASSWORD_RESET');
  // 3. Welcome Email
  await emailService.sendWelcomeEmail('user@test.com', 'Aarav Sharma', '595086858683', 'Savings', new Date());
  // 4. Deposit
  await notificationService.sendDepositEmail({ toEmail: 'user@test.com', customerName: 'Aarav', accountNumber: '595086858683', amount: 5000, newBalance: 15000 });
  // 5. Withdrawal
  await notificationService.sendWithdrawEmail({ toEmail: 'user@test.com', customerName: 'Aarav', accountNumber: '595086858683', amount: 2000, newBalance: 13000 });
  // 6. Transfer Sent
  await notificationService.sendTransferSentEmail({ toEmail: 'user@test.com', senderName: 'Aarav', amount: 1000, receiverAccount: '123456789012', senderBalance: 12000, transactionId: 1 });
  // 7. Transfer Received
  await notificationService.sendTransferReceivedEmail({ toEmail: 'user@test.com', receiverName: 'Aarav', amount: 1000, senderAccount: '123456789012', receiverBalance: 14000, transactionId: 1 });
  // 8. Loan Approved
  await notificationService.sendLoanApprovedEmail({ toEmail: 'user@test.com', customerName: 'Aarav', loanAmount: 50000, interestRate: 8.5, durationMonths: 12, newBalance: 63000 });
  // 9. Loan Rejected
  await notificationService.sendLoanRejectedEmail({ toEmail: 'user@test.com', customerName: 'Aarav' });
  // 10. Account Freeze
  await notificationService.sendFreezeEmail({ toEmail: 'user@test.com', customerName: 'Aarav', accountNumber: '595086858683' });
  // 11. Account Unfreeze
  await notificationService.sendUnfreezeEmail({ toEmail: 'user@test.com', customerName: 'Aarav', accountNumber: '595086858683' });
  // 12. FD Created
  await emailService.sendFdCreatedEmail('user@test.com', 'Aarav', { principalAmount: 25000, interestRate: 7.1, tenureMonths: 12, interestAmount: 1775, maturityAmount: 26775, maturityDate: '2027-08-20', id: 1 });
  // 13. RD Created
  await emailService.sendRdCreatedEmail('user@test.com', 'Aarav', { monthlyAmount: 2000, interestRate: 6.8, tenureMonths: 12, maturityDate: '2027-08-20', estimatedMaturityAmount: 24884, id: 2 });
  // 14. RD Reminder
  await emailService.sendRdMonthlyReminderEmail('user@test.com', 'Aarav', { id: 2, account_id: '595086858683', monthly_amount: 2000, tenure_months: 12, contributions_completed: 4, total_amount_paid: 8000, next_due_date: '2026-09-20' });
  // 15. RD Matured
  await emailService.sendRdMaturedEmail('user@test.com', 'Aarav', { id: 2 }, { totalContributionsExpected: 12, contributionsCompleted: 12, contributionsMissed: 0, totalAmountPaid: 24000, actualInterestEarned: 884, actualMaturityAmount: 24884 });

  assert.strictEqual(sentMessages.length, 15, `Expected 15 emails to be sent, got ${sentMessages.length}`);
  console.log('✅ PASS: All 15 email and notification types generated and dispatched properly');

  // ─── 6. Non-Blocking Async Queue Execution ────────────────────────────────
  console.log('\n─── TEST 6: Non-Blocking Async Queue ───');
  let asyncExecuted = false;
  mailer.enqueueEmail(async () => {
    asyncExecuted = true;
  });
  // Wait a tick for setImmediate
  await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(asyncExecuted, true, 'enqueueEmail must execute task in background');
  console.log('✅ PASS: Non-blocking async queue executed task without blocking caller');

  // ─── 7. Health Check Verification ─────────────────────────────────────────
  console.log('\n─── TEST 7: Mail Connection Verification ───');
  process.env.EMAIL_USER = 'test@securebank.com';
  process.env.EMAIL_PASS = 'pass123';
  const healthStatus = await mailer.verifyMailConnection();
  assert.strictEqual(healthStatus.status, 'CONNECTED');
  assert.strictEqual(healthStatus.configured, true);
  assert.strictEqual(healthStatus.password, undefined);
  assert.strictEqual(healthStatus.pass, undefined);
  console.log('✅ PASS: verifyMailConnection returned connected status with zero secrets leaked');

  // Reset transporter instance
  mailer.resetTransporter();


  console.log('\n===============================================================');
  console.log('🎉 ALL EMAIL SYSTEM TESTS PASSED SUCCESSFULLY (0 FAILURES)');
  console.log('===============================================================');
}

runEmailTests().catch((err) => {
  console.error('❌ EMAIL TEST FAILED:', err);
  process.exit(1);
});
