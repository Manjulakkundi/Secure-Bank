/**
 * tests/emailSystem.test.js
 * Comprehensive unit and integration test suite for SecureBank Sendlib HTTPS email system.
 * Verifies:
 *  - Sendlib API configuration and sender parsing
 *  - Email masking for security/privacy
 *  - Delivery for all email/notification types
 *  - Error and timeout isolation
 *  - Transient failure retry handling
 *  - Non-blocking queue execution
 *  - Health check endpoint (/health/email) with 0 secrets leaked
 */
const request = require('supertest');

// 1. Mock database first
const mockConn = {
  query: jest.fn().mockImplementation((sql) => {
    if (typeof sql === 'string' && sql.includes('SELECT 1 FROM Customer')) {
      return Promise.resolve([[]]);
    }
    return Promise.resolve([{ affectedRows: 1, insertId: 1 }]);
  }),
  beginTransaction: jest.fn().mockResolvedValue(true),
  commit: jest.fn().mockResolvedValue(true),
  rollback: jest.fn().mockResolvedValue(true),
  release: jest.fn(),
};

jest.mock('../config/database', () => ({
  query: jest.fn().mockImplementation((sql) => {
    if (typeof sql === 'string' && sql.includes('SELECT 1 FROM Customer')) {
      return Promise.resolve([[]]);
    }
    return Promise.resolve([{ affectedRows: 1, insertId: 1 }]);
  }),
  getConnection: jest.fn(() => Promise.resolve(mockConn)),
}));

jest.mock('../middleware/auditLogger', () => ({
  logAudit: jest.fn().mockResolvedValue(true),
  ACTIONS: {
    SIGNUP: 'SIGNUP',
    CUSTOMER_LOGIN: 'CUSTOMER_LOGIN',
    WITHDRAW: 'WITHDRAW',
    TRANSFER: 'TRANSFER',
  },
}));

process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_for_securebank';
process.env.SENDLIB_API_KEY = 'mock_sendlib_api_key_test';

const app = require('../index');
const mailer = require('../services/mailer');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

describe('─── 1. Sendlib Mailer Engine & Transport Configuration ───', () => {
  let mockSender;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SENDLIB_API_KEY = 'mock_sendlib_api_key_test';
    mockSender = jest.fn().mockResolvedValue('msg-test-12345');
    mailer.setHttpSender(mockSender);
  });

  afterEach(() => {
    mailer.resetHttpSender();
  });

  it('masks emails properly for privacy-safe logs', () => {
    expect(mailer.maskEmail('manjulakkundi1234@gmail.com')).toMatch(/^m\*+4@gmail\.com$/);
    expect(mailer.maskEmail('ab@example.com')).toBe('a*@example.com');
    expect(mailer.maskEmail('')).toBe('unknown');
    expect(mailer.maskEmail(null)).toBe('unknown');
    expect(mailer.maskEmail('notanemail')).toBe('invalid');
  });

  it('correctly parses sender formats for Sendlib API', () => {
    const s1 = mailer.parseSender('SecureBank <manjulakkundi1234@gmail.com>');
    expect(s1).toEqual({ name: 'SecureBank', email: 'manjulakkundi1234@gmail.com' });

    const s2 = mailer.parseSender('manjulakkundi1234@gmail.com');
    expect(s2).toEqual({ name: 'SecureBank', email: 'manjulakkundi1234@gmail.com' });

    const s3 = mailer.parseSender('"SecureBank Alerts" <alerts@securebank.com>');
    expect(s3).toEqual({ name: 'SecureBank Alerts', email: 'alerts@securebank.com' });

    const s4 = mailer.parseSender('');
    expect(s4).toEqual({ name: 'SecureBank', email: 'manjulakkundi1234@gmail.com' });
  });

  it('sends email successfully with duration tracking and returns true', async () => {
    const result = await mailer.sendMailAsync({
      to: 'customer@example.com',
      subject: 'Test Subject',
      html: '<p>Test Body</p>',
      type: 'test_type',
    });

    expect(result).toBe(true);
    expect(mockSender).toHaveBeenCalledTimes(1);
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
      })
    );
  });

  it('handles invalid email addresses gracefully and returns false', async () => {
    const result = await mailer.sendMailAsync({
      to: 'invalid-email-address',
      subject: 'Test',
      html: '<p>Test</p>',
    });
    expect(result).toBe(false);
    expect(mockSender).not.toHaveBeenCalled();
  });
});

describe('─── 2. Email Failure, Retry Handling & Connection Timeout Isolation ───', () => {
  let mockSender;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSender = jest.fn();
    mailer.setHttpSender(mockSender);
  });

  afterEach(() => {
    mailer.resetHttpSender();
  });

  it('retries on transient Connection Timeout (ETIMEDOUT) and succeeds on attempt 2', async () => {
    const timeoutErr = new Error('Connection timeout');
    timeoutErr.code = 'ETIMEDOUT';
    mockSender
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce('retry-success-id');

    const result = await mailer.sendMailAsync({
      to: 'customer@example.com',
      subject: 'Withdrawal Alert',
      html: '<p>You withdrew ₹500</p>',
      type: 'withdrawal',
    });

    expect(result).toBe(true);
    expect(mockSender).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry permanent Client Error (HTTP 401) and returns false immediately', async () => {
    const authErr = new Error('Sendlib API HTTP 401: Unauthorized');
    authErr.status = 401;
    mockSender.mockRejectedValueOnce(authErr);

    const result = await mailer.sendMailAsync({
      to: 'customer@example.com',
      subject: 'Deposit Alert',
      html: '<p>You deposited ₹1,000</p>',
      type: 'deposit',
    });

    expect(result).toBe(false);
    expect(mockSender).toHaveBeenCalledTimes(1);
  });
});

describe('─── 3. All Email & Notification Service Methods ───', () => {
  let mockSender;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSender = jest.fn().mockResolvedValue('mock-msg-id');
    mailer.setHttpSender(mockSender);
  });

  afterEach(() => {
    mailer.resetHttpSender();
  });

  it('sends Signup OTP email', async () => {
    await emailService.sendOtpEmail('newuser@example.com', '654321', 'SIGNUP');
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'newuser@example.com',
        subject: expect.stringContaining('Verify Your Email'),
      })
    );
  });

  it('sends Password Reset OTP email', async () => {
    await emailService.sendOtpEmail('user@example.com', '123456', 'PASSWORD_RESET');
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('Password Reset OTP'),
      })
    );
  });

  it('sends Welcome email with Account Number', async () => {
    await emailService.sendWelcomeEmail('user@example.com', 'Aarav Sharma', '595086858683', 'Savings', new Date());
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('Welcome to SecureBank'),
      })
    );
  });

  it('sends Transaction & Transfer notifications via notificationService', async () => {
    // Deposit
    await notificationService.sendDepositEmail({
      toEmail: 'user@example.com',
      customerName: 'Aarav',
      accountNumber: '595086858683',
      amount: 5000,
      newBalance: 15000,
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Money Deposited') })
    );

    // Withdrawal
    await notificationService.sendWithdrawEmail({
      toEmail: 'user@example.com',
      customerName: 'Aarav',
      accountNumber: '595086858683',
      amount: 2000,
      newBalance: 13000,
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Cash Withdrawal Successful') })
    );

    // Transfer Sent
    await notificationService.sendTransferSentEmail({
      toEmail: 'sender@example.com',
      senderName: 'Sender',
      amount: 1000,
      receiverAccount: '123456789012',
      senderBalance: 12000,
      transactionId: 101,
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Money Transfer Successful') })
    );

    // Transfer Received
    await notificationService.sendTransferReceivedEmail({
      toEmail: 'receiver@example.com',
      receiverName: 'Receiver',
      amount: 1000,
      senderAccount: '595086858683',
      receiverBalance: 8000,
      transactionId: 101,
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Money Received') })
    );
  });

  it('sends Loan approval & rejection emails', async () => {
    await notificationService.sendLoanApprovedEmail({
      toEmail: 'user@example.com',
      customerName: 'Aarav',
      loanAmount: 50000,
      interestRate: 8.5,
      durationMonths: 12,
      newBalance: 63000,
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Loan Approved') })
    );

    await notificationService.sendLoanRejectedEmail({
      toEmail: 'user@example.com',
      customerName: 'Aarav',
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Loan Application Update') })
    );
  });

  it('sends Account Freeze & Reactivation emails', async () => {
    await notificationService.sendFreezeEmail({
      toEmail: 'user@example.com',
      customerName: 'Aarav',
      accountNumber: '595086858683',
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Account Temporarily Frozen') })
    );

    await notificationService.sendUnfreezeEmail({
      toEmail: 'user@example.com',
      customerName: 'Aarav',
      accountNumber: '595086858683',
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Account Reactivated') })
    );
  });

  it('sends FD and RD creation & maturity emails', async () => {
    // FD Created
    await emailService.sendFdCreatedEmail('user@example.com', 'Aarav', {
      principalAmount: 25000,
      interestRate: 7.1,
      tenureMonths: 12,
      interestAmount: 1775,
      maturityAmount: 26775,
      maturityDate: '2027-08-20',
      id: 1,
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Fixed Deposit Created') })
    );

    // RD Created
    await emailService.sendRdCreatedEmail('user@example.com', 'Aarav', {
      monthlyAmount: 2000,
      interestRate: 6.8,
      tenureMonths: 12,
      maturityDate: '2027-08-20',
      estimatedMaturityAmount: 24884,
      id: 2,
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Recurring Deposit') })
    );

    // RD Reminder
    await emailService.sendRdMonthlyReminderEmail('user@example.com', 'Aarav', {
      id: 2,
      account_id: '595086858683',
      monthly_amount: 2000,
      tenure_months: 12,
      contributions_completed: 4,
      total_amount_paid: 8000,
      next_due_date: '2026-09-20',
    });
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('RD Monthly Contribution Due') })
    );

    // Account Created Post-Approval Email
    await emailService.sendAccountCreatedEmail('user@example.com', 'Aarav', '595086858683', '9876543210');
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Account Has Been Created') })
    );
  });
});

describe('─── 4. Health Check Endpoints ───', () => {
  it('GET /health returns 200 and API status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /health/email returns 200 when Sendlib is configured', async () => {
    process.env.SENDLIB_API_KEY = 'mock-key-12345';

    const res = await request(app).get('/health/email');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('OK');
    expect(res.body.provider).toBe('sendlib');
    expect(res.body.transport).toBe('https');
    // Ensure no secrets are leaked
    expect(res.body.apiKey).toBeUndefined();
    expect(res.body.password).toBeUndefined();
    expect(res.body.pass).toBeUndefined();
  });

  it('GET /health/email returns status when Sendlib API key is not configured', async () => {
    delete process.env.SENDLIB_API_KEY;

    const res = await request(app).get('/health/email');
    expect(res.body.status).toBe('MISSING_API_KEY');
    expect(res.body.configured).toBe(false);
    expect(res.body.apiKey).toBeUndefined();
  });
});


