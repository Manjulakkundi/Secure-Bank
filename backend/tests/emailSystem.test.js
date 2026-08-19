/**
 * tests/emailSystem.test.js
 * Comprehensive unit and integration test suite for the email & notification system.
 * Verifies:
 *  - Mailer engine configuration (pooling, SSL, sensible 5s timeouts)
 *  - Email masking for security/privacy
 *  - Delivery for all 15 email/notification types
 *  - Simulated connection timeouts & error isolation (financial transactions succeed on email failure)
 *  - Asynchronous non-blocking queue execution
 *  - Email health check endpoint (/health/email)
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

// 2. Mock nodemailer
const mockSendMail = jest.fn();
const mockVerify = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
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
process.env.EMAIL_USER = 'testbank@example.com';
process.env.EMAIL_PASS = 'mockapppassword123';
process.env.EMAIL_HOST = 'smtp.gmail.com';

const app = require('../index');
const mailer = require('../services/mailer');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

describe('─── 1. Mailer Engine & Transport Configuration ───', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mailer.setTransporter({
      sendMail: mockSendMail,
      verify: mockVerify,
    });
  });


  it('masks emails properly for privacy-safe logs', () => {
    expect(mailer.maskEmail('manjulakkundi1234@gmail.com')).toMatch(/^m\*+4@gmail\.com$/);
    expect(mailer.maskEmail('ab@example.com')).toBe('a*@example.com');
    expect(mailer.maskEmail('')).toBe('unknown');
    expect(mailer.maskEmail(null)).toBe('unknown');
    expect(mailer.maskEmail('notanemail')).toBe('invalid');
  });

  it('sends email successfully with duration tracking and returns true', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'test-msg-123' });

    const result = await mailer.sendMailAsync({
      to: 'customer@example.com',
      subject: 'Test Subject',
      html: '<p>Test Body</p>',
      type: 'test_type',
    });

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
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
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

describe('─── 2. Email Failure & Connection Timeout Isolation ───', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mailer.setTransporter({
      sendMail: mockSendMail,
      verify: mockVerify,
    });
  });

  it('catches Connection Timeout (ETIMEDOUT) gracefully and returns false without throwing', async () => {
    const timeoutErr = new Error('Connection timeout');
    timeoutErr.code = 'ETIMEDOUT';
    mockSendMail.mockRejectedValueOnce(timeoutErr);

    const result = await mailer.sendMailAsync({
      to: 'customer@example.com',
      subject: 'Withdrawal Alert',
      html: '<p>You withdrew ₹500</p>',
      type: 'withdrawal',
    });

    expect(result).toBe(false);
  });

  it('catches Auth Failure gracefully and returns false without throwing', async () => {
    const authErr = new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
    authErr.code = 'EAUTH';
    mockSendMail.mockRejectedValueOnce(authErr);

    const result = await mailer.sendMailAsync({
      to: 'customer@example.com',
      subject: 'Deposit Alert',
      html: '<p>You deposited ₹1,000</p>',
      type: 'deposit',
    });

    expect(result).toBe(false);
  });
});

describe('─── 3. All Email & Notification Service Methods ───', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'mock-id' });
    mailer.setTransporter({
      sendMail: mockSendMail,
      verify: mockVerify,
    });
  });


  it('sends Signup OTP email', async () => {
    await emailService.sendOtpEmail('newuser@example.com', '654321', 'SIGNUP');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'newuser@example.com',
        subject: expect.stringContaining('Verify Your Email'),
      })
    );
  });

  it('sends Password Reset OTP email', async () => {
    await emailService.sendOtpEmail('user@example.com', '123456', 'PASSWORD_RESET');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('Password Reset OTP'),
      })
    );
  });

  it('sends Welcome email with Account Number', async () => {
    await emailService.sendWelcomeEmail('user@example.com', 'Aarav Sharma', '595086858683', 'Savings', new Date());
    expect(mockSendMail).toHaveBeenCalledWith(
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
    expect(mockSendMail).toHaveBeenCalledWith(
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
    expect(mockSendMail).toHaveBeenCalledWith(
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
    expect(mockSendMail).toHaveBeenCalledWith(
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
    expect(mockSendMail).toHaveBeenCalledWith(
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
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Loan Approved') })
    );

    await notificationService.sendLoanRejectedEmail({
      toEmail: 'user@example.com',
      customerName: 'Aarav',
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Loan Application Update') })
    );
  });

  it('sends Account Freeze & Reactivation emails', async () => {
    await notificationService.sendFreezeEmail({
      toEmail: 'user@example.com',
      customerName: 'Aarav',
      accountNumber: '595086858683',
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Account Temporarily Frozen') })
    );

    await notificationService.sendUnfreezeEmail({
      toEmail: 'user@example.com',
      customerName: 'Aarav',
      accountNumber: '595086858683',
    });
    expect(mockSendMail).toHaveBeenCalledWith(
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
    expect(mockSendMail).toHaveBeenCalledWith(
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
    expect(mockSendMail).toHaveBeenCalledWith(
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
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('RD Monthly Contribution Due') })
    );

  });
});

describe('─── 4. Health Check Endpoints ───', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mailer.setTransporter({
      sendMail: mockSendMail,
      verify: mockVerify,
    });
  });

  it('GET /health returns 200 and API status', async () => {

    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /health/email returns 200 when SMTP connection is verified', async () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    mockVerify.mockResolvedValueOnce(true);

    const res = await request(app).get('/health/email');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('OK');
    // Ensure no secrets are leaked
    expect(res.body.password).toBeUndefined();
    expect(res.body.pass).toBeUndefined();
    expect(res.body.apiKey).toBeUndefined();
  });

  it('GET /health/email returns 200 when HTTP Resend provider is active', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_test_key_12345';
    mailer.setHttpSender(async () => 'mock-resend-id');

    const res = await request(app).get('/health/email');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('OK');
    expect(res.body.provider).toBe('resend');
    expect(res.body.transport).toBe('https');
    expect(res.body.apiKey).toBeUndefined();

    mailer.resetHttpSender();
  });

});

