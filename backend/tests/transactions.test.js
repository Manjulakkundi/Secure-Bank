/**
 * tests/transactions.test.js
 * Unit + API tests for transaction endpoints.
 */
const request = require('supertest');
const app = require('../index');
const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getConnection: jest.fn(() => Promise.resolve({
    query: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
  })),
}));
jest.mock('../services/emailService', () => ({
  sendOtpEmail: jest.fn(),
  sendTransferNotification: jest.fn(),
}));
jest.mock('../middleware/auditLogger', () => ({
  logAudit: jest.fn(),
  ACTIONS: { WITHDRAW: 'WITHDRAW', TRANSFER: 'TRANSFER', DEPOSIT: 'DEPOSIT' },
}));
jest.mock('../services/fraudService', () => ({
  evaluateTransaction: jest.fn().mockResolvedValue({ riskScore: 0, riskLevel: 'LOW', triggeredRules: [], shouldBlock: false }),
  saveFraudAlert: jest.fn(),
}));

const SECRET = process.env.JWT_SECRET || 'test_secret';
const makeToken = (accNum = '123456789012') =>
  jwt.sign({ AccNumber: accNum, role: 'user' }, SECRET, { expiresIn: '1h' });

describe('POST /customer/withdraw — Validation', () => {
  it('rejects withdrawAmount < 1', async () => {
    const res = await request(app)
      .post('/customer/withdraw')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ withdrawAmount: 0 });
    expect(res.statusCode).toBe(400);
  });

  it('rejects withdrawAmount > 200000', async () => {
    const res = await request(app)
      .post('/customer/withdraw')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ withdrawAmount: 250000 });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /customer/transfer — Validation', () => {
  it('rejects missing toAccount', async () => {
    const res = await request(app)
      .post('/customer/transfer')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ transferAmount: 500 });
    expect(res.statusCode).toBe(400);
  });

  it('rejects transfer amount > 500000', async () => {
    const res = await request(app)
      .post('/customer/transfer')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ toAccount: '987654321098', transferAmount: 600000 });
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-numeric account', async () => {
    const res = await request(app)
      .post('/customer/transfer')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ toAccount: 'ABCDEFGHIJKL', transferAmount: 1000 });
    expect(res.statusCode).toBe(400);
  });
});

describe('Fraud Service — Unit Tests', () => {
  const { evaluateTransaction } = require('../services/fraudService');

  it('returns LOW risk for small amounts', async () => {
    const mockConn = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ cnt: 0 }]])  // rapid check
        .mockResolvedValueOnce([[{ dailyTotal: '0' }]])  // daily limit
        .mockResolvedValueOnce([[{ cnt: 0 }]])  // failed attempts
        .mockResolvedValueOnce([[]])             // new beneficiary
    };
    const result = await evaluateTransaction('123456789012', 1000, '987654321098', mockConn);
    expect(result.riskLevel).toBe('LOW');
    expect(result.triggeredRules).toHaveLength(0);
  });
});
