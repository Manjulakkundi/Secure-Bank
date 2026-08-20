/**
 * tests/auth.test.js
 * Comprehensive unit and integration test suite for authentication endpoints using Jest + Supertest.
 * Covers:
 *  - Customer Signup (Pending status, AccountVerify=0, No OTP required)
 *  - Admin Approval / Verification (Transitions AccountVerify=1, AccountStatus='Active', Triggers Account Created Email)
 *  - Customer Login via:
 *      * Account Number
 *      * Email Address (Case-insensitive)
 *      * Phone Number
 *      * Generic Identifier (identifier field)
 *  - Pending Account Rejection (Clear admin-approval required message)
 *  - Frozen Account Rejection
 *  - Wrong Password Rejection
 *  - Forgot Password & Reset Password OTP
 *  - Admin Login & RBAC Isolation
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock database to provide deterministic responses
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

jest.mock('../config/database', () => {
  return {
    query: jest.fn().mockImplementation((sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT 1 FROM Customer')) {
        return Promise.resolve([[]]);
      }
      return Promise.resolve([{ affectedRows: 1, insertId: 1 }]);
    }),
    getConnection: jest.fn(() => Promise.resolve(mockConn)),
  };
});

const mockSendAccountCreatedEmail = jest.fn().mockResolvedValue(true);
const mockSendOtpEmail = jest.fn().mockResolvedValue(true);
const mockSendWelcomeEmail = jest.fn().mockResolvedValue(true);
const mockSendAccountNumberEmail = jest.fn().mockResolvedValue(true);

jest.mock('../services/emailService', () => ({
  sendAccountCreatedEmail: (...args) => mockSendAccountCreatedEmail(...args),
  sendOtpEmail: (...args) => mockSendOtpEmail(...args),
  sendWelcomeEmail: (...args) => mockSendWelcomeEmail(...args),
  sendAccountNumberEmail: (...args) => mockSendAccountNumberEmail(...args),
}));

jest.mock('../middleware/auditLogger', () => ({
  logAudit: jest.fn().mockResolvedValue(true),
  ACTIONS: {
    SIGNUP: 'SIGNUP',
    CUSTOMER_LOGIN: 'CUSTOMER_LOGIN',
    ADMIN_LOGIN: 'ADMIN_LOGIN',
    OTP_SENT: 'OTP_SENT',
    OTP_VERIFIED: 'OTP_VERIFIED',
    PASSWORD_RESET: 'PASSWORD_RESET',
  },
}));

process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_for_securebank';
process.env.JWT_EXPIRES_IN = '1h';

const app = require('../index');
const db = require('../config/database');

describe('─── 1. POST /customer/signup — Registration & Pending Status ───', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing customerName', async () => {
    const res = await request(app).post('/customer/signup').send({
      AccountType: 'Savings',
      customerPhone: '9876543210',
      customerEmail: 'test@test.com',
      CustomerPassword: 'Test@1234Password',
      customerAddress: '123 St',
      customerCity: 'Mumbai',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const res = await request(app).post('/customer/signup').send({
      customerName: 'Test User',
      AccountType: 'Savings',
      customerPhone: '9876543210',
      customerEmail: 'not-an-email',
      CustomerPassword: 'Test@1234Password',
      customerAddress: '123 St',
      customerCity: 'Mumbai',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('rejects weak password (less than 8 chars or missing special char)', async () => {
    const res = await request(app).post('/customer/signup').send({
      customerName: 'Test User',
      AccountType: 'Savings',
      customerPhone: '9876543210',
      customerEmail: 'test@test.com',
      CustomerPassword: 'weakpassword',
      customerAddress: '123 St',
      customerCity: 'Mumbai',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid phone (not 10 digits)', async () => {
    const res = await request(app).post('/customer/signup').send({
      customerName: 'Test User',
      AccountType: 'Savings',
      customerPhone: '12345',
      customerEmail: 'test@test.com',
      CustomerPassword: 'Test@1234Password',
      customerAddress: '123 St',
      customerCity: 'Mumbai',
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates customer in Pending status without requiring OTP, returning HTTP 201', async () => {
    const mockConn = await db.getConnection();
    // 1. SELECT 1 FROM Customer WHERE LOWER(customerEmail)... -> empty
    mockConn.query.mockResolvedValueOnce([[]]);
    // 2. INSERT INTO Customer...
    mockConn.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app).post('/customer/signup').send({
      customerName: 'Aarav Sharma',
      AccountType: 'Savings',
      customerPhone: '9876543210',
      customerEmail: 'aarav.sharma@example.com',
      CustomerPassword: 'SecurePassword@123',
      customerAddress: '42 MG Road',
      customerCity: 'Bengaluru',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accountNumber).toBeDefined();
    expect(res.body.data.email).toBe('aarav.sharma@example.com');
    expect(res.body.message).toContain('Registration submitted successfully. Your account will be activated after admin verification.');
    // Ensure signup OTP is not sent
    expect(mockSendOtpEmail).not.toHaveBeenCalled();
  });
});

describe('─── 2. POST /admin/verify-customer — Admin KYC Approval & Activation ───', () => {
  let adminToken;

  beforeAll(() => {
    adminToken = jwt.sign(
      { adminId: 1, username: 'admin', role: 'admin' },
      process.env.JWT_SECRET
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approves pending customer, sets AccountVerify=1, AccountStatus=Active, and triggers confirmation email', async () => {
    // 1. SELECT customer details
    db.query.mockResolvedValueOnce([
      [{
        AccountNumber: '595086858683',
        customerName: 'Aarav Sharma',
        customerEmail: 'aarav.sharma@example.com',
        customerPhone: '9876543210',
        AccountVerify: 0,
        AccountStatus: 'Active',
      }]
    ]);
    // 2. UPDATE Customer SET AccountVerify=1, AccountStatus='Active'...
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .post('/admin/verify-customer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ accountNumber: '595086858683' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Customer approved successfully');
    expect(res.body.data.status).toBe('Active');
    expect(res.body.data.verified).toBe(true);

    // Verify confirmation email dispatched
    expect(mockSendAccountCreatedEmail).toHaveBeenCalledWith(
      'aarav.sharma@example.com',
      'Aarav Sharma',
      '595086858683',
      '9876543210'
    );
  });
});

describe('─── 3. POST /customer/login — Multi-Identifier & Status Checks ───', () => {
  let hashedPassword;

  beforeAll(async () => {
    hashedPassword = await bcrypt.hash('SecurePassword@123', 12);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects empty credentials with 400', async () => {
    const res = await request(app).post('/customer/login').send({
      password: 'SecurePassword@123',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('Provide account number, email, or phone number');
  });

  it('blocks unverified customer (AccountVerify = 0) with 401 and informative message', async () => {
    db.query.mockResolvedValueOnce([
      [{
        AccountNumber: '595086858683',
        customerName: 'Aarav Sharma',
        customerEmail: 'aarav.sharma@example.com',
        customerPhone: '9876543210',
        CustomerPassword: hashedPassword,
        AccountVerify: 0,
        AccountStatus: 'Active',
      }]
    ]);

    const res = await request(app).post('/customer/login').send({
      accountNumber: '595086858683',
      password: 'SecurePassword@123',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Your account is pending admin verification. You will be able to log in after your account is approved.');
  });


  it('blocks frozen account with 401', async () => {
    db.query.mockResolvedValueOnce([
      [{
        AccountNumber: '595086858683',
        customerName: 'Aarav Sharma',
        customerEmail: 'aarav.sharma@example.com',
        CustomerPassword: hashedPassword,
        AccountVerify: 1,
        AccountStatus: 'Frozen',
      }]
    ]);

    const res = await request(app).post('/customer/login').send({
      accountNumber: '595086858683',
      password: 'SecurePassword@123',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('frozen');
  });

  it('rejects incorrect password with 401', async () => {
    db.query.mockResolvedValueOnce([
      [{
        AccountNumber: '595086858683',
        customerName: 'Aarav Sharma',
        customerEmail: 'aarav.sharma@example.com',
        CustomerPassword: hashedPassword,
        AccountVerify: 1,
        AccountStatus: 'Active',
      }]
    ]);

    const res = await request(app).post('/customer/login').send({
      accountNumber: '595086858683',
      password: 'WrongPassword@999',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('successfully logs in via Account Number', async () => {
    db.query.mockResolvedValueOnce([
      [{
        AccountNumber: '595086858683',
        customerName: 'Aarav Sharma',
        AccountType: 'Savings',
        customerEmail: 'aarav.sharma@example.com',
        CustomerPassword: hashedPassword,
        AccountVerify: 1,
        AccountStatus: 'Active',
      }]
    ]);

    const res = await request(app).post('/customer/login').send({
      accountNumber: '595086858683',
      password: 'SecurePassword@123',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.accountNumber).toBe('595086858683');
  });

  it('successfully logs in via Email (Case-Insensitive)', async () => {
    db.query.mockResolvedValueOnce([
      [{
        AccountNumber: '595086858683',
        customerName: 'Aarav Sharma',
        AccountType: 'Savings',
        customerEmail: 'aarav.sharma@example.com',
        CustomerPassword: hashedPassword,
        AccountVerify: 1,
        AccountStatus: 'Active',
      }]
    ]);

    const res = await request(app).post('/customer/login').send({
      email: 'AARAV.SHARMA@EXAMPLE.COM',
      password: 'SecurePassword@123',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accountNumber).toBe('595086858683');
  });

  it('successfully logs in via Phone Number', async () => {
    db.query.mockResolvedValueOnce([
      [{
        AccountNumber: '595086858683',
        customerName: 'Aarav Sharma',
        AccountType: 'Savings',
        customerPhone: '9876543210',
        customerEmail: 'aarav.sharma@example.com',
        CustomerPassword: hashedPassword,
        AccountVerify: 1,
        AccountStatus: 'Active',
      }]
    ]);

    const res = await request(app).post('/customer/login').send({
      phone: '9876543210',
      password: 'SecurePassword@123',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accountNumber).toBe('595086858683');
  });

  it('successfully logs in via Generic Identifier field', async () => {
    db.query.mockResolvedValueOnce([
      [{
        AccountNumber: '595086858683',
        customerName: 'Aarav Sharma',
        AccountType: 'Savings',
        customerPhone: '9876543210',
        customerEmail: 'aarav.sharma@example.com',
        CustomerPassword: hashedPassword,
        AccountVerify: 1,
        AccountStatus: 'Active',
      }]
    ]);

    const res = await request(app).post('/customer/login').send({
      identifier: 'aarav.sharma@example.com',
      password: 'SecurePassword@123',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accountNumber).toBe('595086858683');
  });
});

describe('─── 4. Protected Routes & RBAC Middleware ───', () => {
  let customerToken, adminToken;

  beforeAll(() => {
    customerToken = jwt.sign(
      { AccNumber: '595086858683', accountNumber: '595086858683', customerName: 'Aarav Sharma', role: 'user' },
      process.env.JWT_SECRET
    );
    adminToken = jwt.sign(
      { adminId: 1, username: 'admin', role: 'admin' },
      process.env.JWT_SECRET
    );
  });

  it('allows customer JWT to access /customer/profile', async () => {
    db.query.mockResolvedValueOnce([
      [{
        AccountNumber: '595086858683',
        customerName: 'Aarav Sharma',
        AccountType: 'Savings',
        customerEmail: 'aarav.sharma@example.com',
        Balance: 50000,
        AccountVerify: 1,
        AccountStatus: 'Active',
      }]
    ]);

    const res = await request(app)
      .get('/customer/profile')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.AccountNumber).toBe('595086858683');
  });

  it('blocks customer JWT from admin routes (RBAC check)', async () => {
    const res = await request(app)
      .get('/admin/customers')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain('Admin access only');
  });

  it('allows admin JWT to access admin routes', async () => {
    db.query.mockResolvedValueOnce([
      [{ AccountNumber: '595086858683', customerName: 'Aarav Sharma', Balance: 50000 }]
    ]);
    db.query.mockResolvedValueOnce([[{ total: 1 }]]);

    const res = await request(app)
      .get('/admin/customers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('─── 5. Admin Authentication ───', () => {
  it('logs in admin with valid credentials', async () => {
    const adminPassHash = await bcrypt.hash('Admin@123', 12);
    db.query.mockResolvedValueOnce([
      [{ id: 1, username: 'admin', password_hash: adminPassHash }]
    ]);

    const res = await request(app).post('/admin/login').send({
      username: 'admin',
      password: 'Admin@123',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.role).toBe('admin');
  });
});

describe('─── 6. Password Reset Flow (OTP Preserved) ───', () => {
  it('allows requesting password reset OTP', async () => {
    db.query.mockResolvedValueOnce([[{ AccountNumber: '595086858683' }]]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app).post('/customer/forgot-password').send({
      email: 'aarav.sharma@example.com',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSendOtpEmail).toHaveBeenCalledWith(
      'aarav.sharma@example.com',
      expect.any(String),
      'PASSWORD_RESET'
    );
  });
});
