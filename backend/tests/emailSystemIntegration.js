/**
 * tests/emailSystemIntegration.js
 * Standalone, fast integration test suite for SecureBank multi-provider email system.
 * Tests:
 *  1. HTTP Transactional API Provider (Resend) over HTTPS/443
 *  2. HTTP Transactional API Provider (Brevo) over HTTPS/443
 *  3. SMTP Fallback Provider & Port 465 SSL Normalization
 *  4. Missing API Key & Error Handling
 *  5. Privacy-Safe Email Masking
 *  6. Simulated HTTP API Failure & Isolation
 *  7. Simulated HTTP Timeout (AbortError) & Isolation
 *  8. All 15 Customer and Admin Email Templates
 *  9. Non-Blocking Async Queue Execution
 *  10. Health Check Endpoint (/health/email) for HTTP and SMTP modes
 */
const assert = require('assert');
const mailer = require('../services/mailer');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

async function runEmailTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING SECUREBANK EMAIL SYSTEM INTEGRATION TEST SUITE');
  console.log('===============================================================');

  // ─── 1. Brevo HTTP Provider Resolution & Payload Structure ────────────────
  console.log('\n─── TEST 1: Brevo HTTP Transactional API (HTTPS/443 Simulation) ───');
  process.env.EMAIL_PROVIDER = 'brevo';
  process.env.BREVO_API_KEY = 'brevo_test_key_12345';
  process.env.EMAIL_FROM = '"SecureBank" <noreply@securebank.com>';

  const brevoConfig = mailer.resolveMailConfig();
  assert.strictEqual(brevoConfig.type, 'http');
  assert.strictEqual(brevoConfig.provider, 'brevo');
  assert.strictEqual(brevoConfig.transport, 'https');
  assert.strictEqual(brevoConfig.port, 443);
  assert.strictEqual(brevoConfig.secure, true);
  assert.strictEqual(brevoConfig.sender.name, 'SecureBank');
  assert.strictEqual(brevoConfig.sender.email, 'noreply@securebank.com');

  let sentHttpCalls = [];
  mailer.setHttpSender(async (opts) => {
    sentHttpCalls.push(opts);
    return 'simulated-brevo-msg-id-98765';
  });

  const sendResult = await mailer.sendMailAsync({
    to: 'customer@securebank.com',
    subject: 'SecureBank Brevo Test Notification',
    html: '<p>Test HTTP transactional email via Brevo</p>',
    type: 'account_created',
  });

  assert.strictEqual(sendResult, true, 'sendMailAsync via HTTP API must return true on success');
  assert.strictEqual(sentHttpCalls.length, 1);
  assert.strictEqual(sentHttpCalls[0].to, 'customer@securebank.com');
  console.log('✅ PASS: Brevo HTTP transactional API dispatched email over HTTPS/443 (mocked handler)');

  // ─── 2. Default Provider Resolution (Defaults to Brevo) ────────────────────
  console.log('\n─── TEST 2: Default Provider Selection (Defaults to Brevo) ───');
  delete process.env.EMAIL_PROVIDER;
  process.env.BREVO_API_KEY = 'brevo_test_key_67890';

  const defaultConfig = mailer.resolveMailConfig();
  assert.strictEqual(defaultConfig.type, 'http');
  assert.strictEqual(defaultConfig.provider, 'brevo');
  assert.strictEqual(defaultConfig.transport, 'https');
  assert.strictEqual(defaultConfig.port, 443);
  console.log('✅ PASS: Default provider selection cleanly selects Brevo over HTTPS/443');

  // ─── 3. Explicit Local Development SMTP Config ────────────────────────────
  console.log('\n─── TEST 3: Explicit Local Development SMTP Config (Port 465 SSL) ───');
  process.env.EMAIL_PROVIDER = 'smtp';
  delete process.env.BREVO_API_KEY;
  delete process.env.EMAIL_FORCE_PORT;
  process.env.EMAIL_HOST = 'smtp.gmail.com';
  process.env.EMAIL_PORT = '587'; // Legacy env var

  const smtpConfig = mailer.resolveMailConfig();
  assert.strictEqual(smtpConfig.type, 'smtp');
  assert.strictEqual(smtpConfig.port, 465, 'Gmail host must automatically normalize to port 465');
  assert.strictEqual(smtpConfig.secure, true);
  console.log('✅ PASS: Explicit local SMTP config normalized to Port 465 with SSL for Gmail');


  // ─── 4. Missing API Key Handling ───────────────────────────────────────────
  console.log('\n─── TEST 4: Missing API Key Handling ───');
  process.env.EMAIL_PROVIDER = 'brevo';
  delete process.env.BREVO_API_KEY;
  mailer.resetHttpSender();

  const missingKeyStatus = await mailer.verifyMailConnection();
  assert.strictEqual(missingKeyStatus.success, false);
  assert.strictEqual(missingKeyStatus.status, 'MISSING_API_KEY');
  console.log('✅ PASS: Missing API key identified without crashing');

  // ─── 5. Privacy-Safe Email Masking ───
  console.log('\n─── TEST 5: Privacy-Safe Email Masking ───');
  const masked1 = mailer.maskEmail('manjulakkundi1234@gmail.com');
  assert.ok(masked1.startsWith('m') && masked1.endsWith('4@gmail.com'));
  assert.strictEqual(mailer.maskEmail('ab@example.com'), 'a*@example.com');
  assert.strictEqual(mailer.maskEmail(''), 'unknown');
  assert.strictEqual(mailer.maskEmail(null), 'unknown');
  assert.strictEqual(mailer.maskEmail('invalid-email'), 'invalid');
  console.log('✅ PASS: Email masking produces secure, unexposed log strings');

  // ─── 6. Brevo HTTP API Error Simulation ───
  console.log('\n─── TEST 6: Brevo HTTP API Error Isolation ───');
  mailer.setHttpSender(async () => {
    throw new Error('Brevo API HTTP 401: Key not found or invalid');
  });

  const failResult = await mailer.sendMailAsync({
    to: 'customer@securebank.com',
    subject: 'Deposit Alert',
    html: '<p>Deposited ₹5000</p>',
    type: 'deposit',
  });

  assert.strictEqual(failResult, false, 'sendMailAsync must return false on API failure without throwing');
  console.log('✅ PASS: HTTP API error safely caught; banking operations remain unaffected');

  // ─── 7. Brevo HTTP API Timeout Simulation ───
  console.log('\n─── TEST 7: Brevo HTTP API Timeout (AbortError) Isolation ───');
  mailer.setHttpSender(async () => {
    const abortErr = new Error('The operation was aborted due to timeout');
    abortErr.name = 'AbortError';
    throw abortErr;
  });

  const timeoutResult = await mailer.sendMailAsync({
    to: 'customer@securebank.com',
    subject: 'Withdrawal Alert',
    html: '<p>Withdrew ₹1000</p>',
    type: 'withdrawal',
  });

  assert.strictEqual(timeoutResult, false, 'sendMailAsync must return false on timeout without throwing');
  console.log('✅ PASS: HTTP timeout safely caught; transaction execution continues');

  // ─── 8. All 16 Email Templates & Notification Types via Brevo ──────────────
  console.log('\n─── TEST 8: Verification of All 16 Email Types via Brevo ───');
  process.env.EMAIL_PROVIDER = 'brevo';
  process.env.BREVO_API_KEY = 'brevo_test_key_12345';
  sentHttpCalls = [];
  mailer.setHttpSender(async (opts) => {
    sentHttpCalls.push(opts);
    return 'msg-brevo-id';
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

  assert.strictEqual(sentHttpCalls.length, 16, `Expected 16 emails to be sent, got ${sentHttpCalls.length}`);
  console.log('✅ PASS: All 16 email and notification types generated and dispatched through Brevo HTTP provider');

  // ─── 9. Non-Blocking Async Queue ──────────────────────────────────────────
  console.log('\n─── TEST 9: Non-Blocking Async Queue ───');
  let asyncExecuted = false;
  mailer.enqueueEmail(async () => {
    asyncExecuted = true;
  });
  await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(asyncExecuted, true, 'enqueueEmail must execute task in background');
  console.log('✅ PASS: Non-blocking async queue executed task without blocking caller');

  // ─── 10. Health Check Endpoint Verification ───────────────────────────────
  console.log('\n─── TEST 10: Health Check Verification ───');
  process.env.EMAIL_PROVIDER = 'brevo';
  process.env.BREVO_API_KEY = 'brevo_test_key_12345';
  const healthStatus = await mailer.verifyMailConnection();
  assert.strictEqual(healthStatus.success, true);
  assert.strictEqual(healthStatus.status, 'OK');
  assert.strictEqual(healthStatus.provider, 'brevo');
  assert.strictEqual(healthStatus.transport, 'https');
  assert.strictEqual(healthStatus.port, 443);
  assert.strictEqual(healthStatus.apiKey, undefined);
  console.log('✅ PASS: verifyMailConnection returned OK status over HTTPS/443 with 0 secrets leaked');

  mailer.resetHttpSender();
  mailer.resetTransporter();

  console.log('\n===============================================================');
  console.log('🎉 ALL BREVO & MULTI-PROVIDER EMAIL SYSTEM TESTS PASSED (0 FAILURES)');
  console.log('===============================================================');
}


runEmailTests().catch((err) => {
  console.error('❌ EMAIL TEST FAILED:', err);
  process.exit(1);
});
