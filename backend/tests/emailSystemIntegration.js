/**
 * tests/emailSystemIntegration.js
 * Standalone, fast integration test suite for SecureBank Sendlib HTTPS email system.
 * Tests:
 *  1. Sendlib HTTPS API Configuration Resolution (Port 443 HTTPS)
 *  2. Transient Network Failure Retry Mechanism (Exponential Backoff)
 *  3. Permanent Client Error (HTTP 401/403) Fast Failure Isolation
 *  4. Connection Timeout (AbortError) Isolation
 *  5. Privacy-Safe Email Masking
 *  6. All 16 Customer and Admin Email Templates via Sendlib API
 *  7. Non-Blocking Async Queue Execution
 *  8. Health Check Verification (/health/email) with 0 Secrets Leaked
 */
const assert = require('assert');
const mailer = require('../services/mailer');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

async function runEmailTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING SECUREBANK SENDLIB HTTPS EMAIL INTEGRATION TESTS');
  console.log('===============================================================');

  // ─── 1. Sendlib HTTPS API Configuration Resolution ────────────────────────
  console.log('\n─── TEST 1: Sendlib HTTPS API Configuration (Port 443 HTTPS) ───');
  process.env.SENDLIB_API_KEY = 'mock_sendlib_api_key_12345';
  process.env.EMAIL_FROM = 'SecureBank <manjulakkundi1234@gmail.com>';

  const mailConfig = mailer.resolveMailConfig();
  assert.strictEqual(mailConfig.type, 'http');
  assert.strictEqual(mailConfig.provider, 'sendlib');
  assert.strictEqual(mailConfig.transport, 'https');
  assert.strictEqual(mailConfig.port, 443);
  assert.strictEqual(mailConfig.secure, true);
  assert.strictEqual(mailConfig.from, 'manjulakkundi1234@gmail.com');
  assert.strictEqual(mailConfig.sender.name, 'SecureBank');
  assert.strictEqual(mailConfig.sender.email, 'manjulakkundi1234@gmail.com');
  console.log('✅ PASS: Sendlib HTTPS configuration resolved to Port 443 HTTPS with connected Gmail sender');

  // ─── 2. Transient Error Retry Handling ────────────────────────────────────
  console.log('\n─── TEST 2: Transient Network Error Retry Mechanism ───');
  let attemptCount = 0;
  mailer.setHttpSender(async () => {
    attemptCount++;
    if (attemptCount === 1) {
      const err = new Error('Connection timeout');
      err.code = 'ETIMEDOUT';
      throw err;
    }
    return '1a01f29ce6cbb4fb';
  });

  const retryResult = await mailer.sendMailAsync({
    to: 'customer@securebank.com',
    subject: 'SecureBank Test Retry',
    html: '<p>Retry test</p>',
    type: 'account_created',
  });

  assert.strictEqual(retryResult, true, 'sendMailAsync must succeed after transient retry');
  assert.strictEqual(attemptCount, 2, 'Must have attempted exactly 2 times');
  console.log('✅ PASS: Transient network error automatically retried and succeeded on attempt 2');

  // ─── 3. Permanent Client Error Fast Failure ───────────────────────────────
  console.log('\n─── TEST 3: Permanent Client Error (HTTP 401) Fast Failure ───');
  attemptCount = 0;
  mailer.setHttpSender(async () => {
    attemptCount++;
    const authErr = new Error('Sendlib API HTTP 401: Unauthorized');
    authErr.status = 401;
    throw authErr;
  });

  const authFailResult = await mailer.sendMailAsync({
    to: 'customer@securebank.com',
    subject: 'Deposit Alert',
    html: '<p>Deposited ₹5000</p>',
    type: 'deposit',
  });

  assert.strictEqual(authFailResult, false, 'Permanent auth failure must return false');
  assert.strictEqual(attemptCount, 1, 'Must NOT retry permanent authentication errors');
  console.log('✅ PASS: Permanent authentication error failed immediately without wasteful retries');

  // ─── 4. Connection Timeout Isolation ─────────────────────────────────────
  console.log('\n─── TEST 4: Connection Timeout Isolation ───');
  mailer.setHttpSender(async () => {
    const timeoutErr = new Error('The operation was aborted due to timeout');
    timeoutErr.name = 'AbortError';
    throw timeoutErr;
  });

  const timeoutResult = await mailer.sendMailAsync({
    to: 'customer@securebank.com',
    subject: 'Withdrawal Alert',
    html: '<p>Withdrew ₹1000</p>',
    type: 'withdrawal',
  });

  assert.strictEqual(timeoutResult, false, 'sendMailAsync must return false on timeout without throwing');
  console.log('✅ PASS: HTTPS timeout safely isolated; banking operations remain unaffected');

  // ─── 5. Privacy-Safe Email Masking ────────────────────────────────────────
  console.log('\n─── TEST 5: Privacy-Safe Email Masking ───');
  const masked1 = mailer.maskEmail('manjulakkundi1234@gmail.com');
  assert.ok(masked1.startsWith('m') && masked1.endsWith('4@gmail.com'));
  assert.strictEqual(mailer.maskEmail('ab@example.com'), 'a*@example.com');
  assert.strictEqual(mailer.maskEmail(''), 'unknown');
  assert.strictEqual(mailer.maskEmail(null), 'unknown');
  assert.strictEqual(mailer.maskEmail('invalid-email'), 'invalid');
  console.log('✅ PASS: Email masking produces secure, unexposed log strings');

  // ─── 6. All 16 Email Templates & Notification Types ───────────────────────
  console.log('\n─── TEST 6: Verification of All 16 Email Types via Sendlib HTTPS API ───');
  let sentCalls = [];
  mailer.setHttpSender(async (opts) => {
    sentCalls.push(opts);
    return '1a01f29ce6cbb4fb';
  });

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
  // 16. Post-Approval Account Created Email
  await emailService.sendAccountCreatedEmail('user@test.com', 'Aarav Sharma', '595086858683', '9876543210');

  assert.strictEqual(sentCalls.length, 16, `Expected 16 emails to be sent, got ${sentCalls.length}`);
  console.log('✅ PASS: All 16 email and notification types generated and dispatched through Sendlib HTTPS API');

  // ─── 7. Non-Blocking Async Queue ──────────────────────────────────────────
  console.log('\n─── TEST 7: Non-Blocking Async Queue ───');
  let asyncExecuted = false;
  mailer.enqueueEmail(async () => {
    asyncExecuted = true;
  });
  await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(asyncExecuted, true, 'enqueueEmail must execute task in background');
  console.log('✅ PASS: Non-blocking async queue executed task without blocking caller');

  // ─── 8. Health Check Endpoint Verification ───────────────────────────────
  console.log('\n─── TEST 8: Health Check Verification ───');
  process.env.SENDLIB_API_KEY = 'mock_sendlib_api_key_12345';
  const healthStatus = await mailer.verifyMailConnection();
  assert.strictEqual(healthStatus.success, true);
  assert.strictEqual(healthStatus.status, 'OK');
  assert.strictEqual(healthStatus.provider, 'sendlib');
  assert.strictEqual(healthStatus.transport, 'https');
  assert.strictEqual(healthStatus.port, 443);
  assert.strictEqual(healthStatus.secure, true);
  assert.strictEqual(healthStatus.apiKey, undefined);
  console.log('✅ PASS: verifyMailConnection returned OK status with 0 secrets leaked');

  mailer.resetHttpSender();
  mailer.resetTransporter();

  console.log('\n===============================================================');
  console.log('🎉 ALL SENDLIB HTTPS EMAIL SYSTEM TESTS PASSED (0 FAILURES)');
  console.log('===============================================================');
}

runEmailTests().catch((err) => {
  console.error('❌ EMAIL TEST FAILED:', err);
  process.exit(1);
});


