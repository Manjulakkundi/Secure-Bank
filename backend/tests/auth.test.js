/**
 * tests/auth.test.js
 * API tests for authentication endpoints using Jest + Supertest.
 */
const request = require('supertest');
const app = require('../index');

// Mock database to avoid real DB in tests
jest.mock('../config/database', () => ({
  query:        jest.fn(),
  getConnection: jest.fn(() => Promise.resolve({
    query:           jest.fn(),
    beginTransaction: jest.fn(),
    commit:          jest.fn(),
    rollback:        jest.fn(),
    release:         jest.fn(),
  })),
}));

jest.mock('../services/emailService', () => ({
  sendOtpEmail:              jest.fn().mockResolvedValue(true),
  sendTransferNotification:  jest.fn().mockResolvedValue(true),
}));

jest.mock('../middleware/auditLogger', () => ({
  logAudit: jest.fn(),
  ACTIONS:  { SIGNUP: 'SIGNUP', LOGIN: 'LOGIN', OTP_SENT: 'OTP_SENT', OTP_VERIFIED: 'OTP_VERIFIED' },
}));

const db = require('../config/database');

describe('POST /customer/signup — Input Validation', () => {
  it('rejects missing customerName', async () => {
    const res = await request(app).post('/customer/signup').send({
      AccountType: 'Savings', customerPhone: '9876543210',
      customerEmail: 'test@test.com', CustomerPassword: 'Test@1234',
      customerAddress: '123 St', customerCity: 'Mumbai',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const res = await request(app).post('/customer/signup').send({
      customerName: 'Test User', AccountType: 'Savings',
      customerPhone: '9876543210', customerEmail: 'not-an-email',
      CustomerPassword: 'Test@1234', customerAddress: '123 St', customerCity: 'Mumbai',
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('rejects weak password', async () => {
    const res = await request(app).post('/customer/signup').send({
      customerName: 'Test User', AccountType: 'Savings',
      customerPhone: '9876543210', customerEmail: 'test@test.com',
      CustomerPassword: '12345678', customerAddress: '123 St', customerCity: 'Mumbai',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid phone', async () => {
    const res = await request(app).post('/customer/signup').send({
      customerName: 'Test User', AccountType: 'Savings',
      customerPhone: '12345', customerEmail: 'test@test.com',
      CustomerPassword: 'Test@1234', customerAddress: '123 St', customerCity: 'Mumbai',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /customer/login — Input Validation', () => {
  it('rejects missing account number', async () => {
    const res = await request(app).post('/customer/login')
      .send({ password: 'Test@1234' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-12-digit account number', async () => {
    const res = await request(app).post('/customer/login')
      .send({ accountNumber: '123', password: 'Test@1234' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for non-existent account', async () => {
    db.query.mockResolvedValueOnce([[]]); // No rows found
    const res = await request(app).post('/customer/login')
      .send({ accountNumber: '123456789012', password: 'Test@1234' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /customer/withdraw — Auth', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/customer/withdraw')
      .send({ withdrawAmount: 100 });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /health', () => {
  it('returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Admin routes — RBAC', () => {
  it('blocks /admin/customers without token', async () => {
    const res = await request(app).get('/admin/customers');
    expect(res.statusCode).toBe(401);
  });

  it('blocks /admin/deposit without token', async () => {
    const res = await request(app).post('/admin/deposit').send({ accountNumber: '123456789012', depositAmount: 1000 });
    expect(res.statusCode).toBe(401);
  });

  it('blocks customer JWT from admin routes', async () => {
    // Create a user-role JWT
    const jwt = require('jsonwebtoken');
    const userToken = jwt.sign(
      { AccNumber: '123456789012', role: 'user' },
      process.env.JWT_SECRET || 'test_secret'
    );
    const res = await request(app)
      .get('/admin/customers')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(403);
  });
});
