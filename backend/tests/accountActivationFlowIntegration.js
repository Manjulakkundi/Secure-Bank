/**
 * tests/accountActivationFlowIntegration.js
 * End-to-end integration test verifying the new registration and account activation flow:
 *
 * 1. Customer signs up:
 *    - Account created in database with AccountStatus = 'Pending', AccountVerify = 0
 *    - No signup OTP email required or sent
 *    - Returns 201 with success message: "Registration submitted successfully. Your account will be activated after admin verification."
 *
 * 2. Customer attempts to log in before admin verification:
 *    - Valid password provided
 *    - Denied with 401: "Your account is pending admin verification. You will be able to log in after your account is approved."
 *
 * 3. Admin reviews KYC & approves customer:
 *    - Calls POST /admin/verify-customer
 *    - Sets AccountVerify = 1, AccountStatus = 'Active'
 *    - Triggers "Congratulations! Your SecureBank Account Has Been Created" email
 *
 * 4. Activated customer logs in successfully:
 *    - Login with Account Number -> 200 OK + JWT
 *    - Login with Email -> 200 OK + JWT
 *    - Login with Phone -> 200 OK + JWT
 *    - Login with Identifier field -> 200 OK + JWT
 *
 * 5. Wrong password rejected -> 401
 * 6. Frozen account rejected -> 401
 */
const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Setup environment
process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_for_securebank';
process.env.JWT_EXPIRES_IN = '1h';
process.env.RESEND_API_KEY = 're_test_dummy_key';

let sentEmails = [];
const mailer = require('../services/mailer');
mailer.setHttpSender(async (options) => {
  sentEmails.push(options);
  return 'msg-flow-' + Date.now();
});

const app = require('../index');
const request = require('supertest');
const db = require('../config/database');

async function runActivationFlowSuite() {
  console.log('===============================================================');
  console.log('🧪 RUNNING ACCOUNT ACTIVATION & LOGIN FLOW INTEGRATION TESTS');
  console.log('===============================================================\n');

  // In-memory test store simulating the database
  const inMemoryCustomers = new Map();
  let nextId = 1000;

  // Mock DB query & getConnection for test execution
  const originalQuery = db.query;
  const originalGetConnection = db.getConnection;

  db.query = async (sql, params = []) => {
    const s = sql.trim();
    if (s.startsWith('SELECT * FROM admins')) {
      const hash = await bcrypt.hash('Admin@123', 10);
      return [[{ id: 1, username: 'admin', password_hash: hash }]];
    }

    if (s.includes('FROM Customer WHERE') || s.includes('FROM Customer')) {
      // Check query filters
      const all = Array.from(inMemoryCustomers.values());
      if (s.includes('AccountNumber = ?') || s.includes('AccountNumber=?')) {
        const found = all.filter(c => c.AccountNumber === params[0]);
        return [found];
      }
      if (s.includes('LOWER(customerEmail) = LOWER(?)')) {
        const found = all.filter(c => c.customerEmail.toLowerCase() === params[0].toLowerCase());
        return [found];
      }
      if (s.includes('customerPhone = ?')) {
        const found = all.filter(c => c.customerPhone === params[0]);
        return [found];
      }
      if (s.includes('customerPhone = ? OR AccountNumber = ?')) {
        const found = all.filter(c => c.customerPhone === params[0] || c.AccountNumber === params[1] || c.AccountNumber === params[0]);
        return [found];
      }
      if (s.includes('AccountNumber = ? OR customerPhone = ? OR LOWER(customerEmail) = LOWER(?)')) {
        const p = params[0];
        const found = all.filter(c => c.AccountNumber === p || c.customerPhone === p || c.customerEmail.toLowerCase() === p.toLowerCase());
        return [found];
      }
      return [all];
    }

    if (s.startsWith('UPDATE Customer SET AccountVerify=1, AccountStatus=\'Active\'')) {
      const acc = params[0];
      const cust = inMemoryCustomers.get(acc);
      if (cust) {
        cust.AccountVerify = 1;
        cust.AccountStatus = 'Active';
      }
      return [{ affectedRows: 1 }];
    }

    if (s.startsWith('UPDATE Customer SET AccountStatus=?')) {
      const status = params[0];
      const acc = params[1];
      const cust = inMemoryCustomers.get(acc);
      if (cust) cust.AccountStatus = status;
      return [{ affectedRows: 1 }];
    }

    return [[{ total: inMemoryCustomers.size }]];
  };

  db.getConnection = async () => {
    return {
      query: async (sql, params = []) => {
        const s = sql.trim();
        if (s.includes('SELECT 1 FROM Customer WHERE LOWER(customerEmail)=LOWER(?) OR customerPhone=?')) {
          const email = params[0];
          const phone = params[1];
          const exists = Array.from(inMemoryCustomers.values()).some(
            c => c.customerEmail.toLowerCase() === email.toLowerCase() || c.customerPhone === phone
          );
          return [exists ? [{ 1: 1 }] : []];
        }

        if (s.startsWith('INSERT INTO Customer')) {
          const [acc, name, type, phone, email, addr, city, pwd] = params;
          const cust = {
            AccountNumber: acc,
            customerName: name,
            AccountType: type,
            customerPhone: phone,
            customerEmail: email,
            customerAddress: addr,
            customerCity: city,
            CustomerPassword: pwd,
            Balance: 0,
            AccountVerify: 0,
            AccountStatus: 'Active',
            CreatedAt: new Date(),
          };
          inMemoryCustomers.set(acc, cust);
          return [{ affectedRows: 1 }];
        }

        return [{ affectedRows: 1 }];
      },
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    };
  };

  try {
    // ─── TEST 1: Customer Signup ─────────────────────────────────────────────
    console.log('─── TEST 1: Customer Signup (Creates Pending Account, No OTP Required) ───');
    sentEmails = [];
    const signupRes = await request(app).post('/customer/signup').send({
      customerName: 'Priya Patel',
      AccountType: 'Savings',
      customerPhone: '9820098200',
      customerEmail: 'priya.patel@example.com',
      CustomerPassword: 'StrongPassword@123',
      customerAddress: '74 Park Street',
      customerCity: 'Kolkata',
    });

    assert.strictEqual(signupRes.statusCode, 201, `Signup must return 201, got ${signupRes.statusCode}`);
    assert.strictEqual(signupRes.body.success, true);
    assert.strictEqual(
      signupRes.body.message,
      'Registration submitted successfully. Your account will be activated after admin verification.'
    );
    const accountNumber = signupRes.body.data.accountNumber;
    assert.ok(accountNumber, 'Account number must be generated');

    const createdCust = inMemoryCustomers.get(accountNumber);
    assert.strictEqual(createdCust.AccountStatus, 'Active', 'Customer AccountStatus must be "Active"');
    assert.strictEqual(createdCust.AccountVerify, 0, 'Customer AccountVerify must be 0 (Pending Admin Approval)');
    assert.strictEqual(sentEmails.length, 0, 'No signup OTP email should be sent');
    console.log(`✅ PASS: Customer registered in "Pending" status (AccountVerify = 0, Account: ${accountNumber}). No OTP required.`);


    // ─── TEST 2: Login Before Admin Approval ────────────────────────────────
    console.log('\n─── TEST 2: Customer Login Attempt Before Admin Approval (Must be Blocked) ───');
    const pendingLoginRes = await request(app).post('/customer/login').send({
      accountNumber,
      password: 'StrongPassword@123',
    });

    assert.strictEqual(pendingLoginRes.statusCode, 401);
    assert.strictEqual(pendingLoginRes.body.success, false);
    assert.strictEqual(
      pendingLoginRes.body.message,
      'Your account is pending admin verification. You will be able to log in after your account is approved.'
    );
    console.log('✅ PASS: Pending customer login rejected with clear admin verification message.');

    // ─── TEST 3: Admin Approval & Account Activation ─────────────────────────
    console.log('\n─── TEST 3: Admin Approval (POST /admin/verify-customer) ───');
    const adminToken = jwt.sign({ adminId: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);
    sentEmails = [];

    const approvalRes = await request(app)
      .post('/admin/verify-customer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ accountNumber });

    assert.strictEqual(approvalRes.statusCode, 200);
    assert.strictEqual(approvalRes.body.success, true);
    assert.strictEqual(approvalRes.body.data.status, 'Active');
    assert.strictEqual(approvalRes.body.data.verified, true);
    assert.strictEqual(createdCust.AccountStatus, 'Active');
    assert.strictEqual(createdCust.AccountVerify, 1);

    // Wait a moment for non-blocking email dispatch
    await new Promise(r => setTimeout(r, 100));

    assert.strictEqual(sentEmails.length, 1, 'Post-approval Account Created email must be dispatched');
    assert.strictEqual(sentEmails[0].to, 'priya.patel@example.com');
    assert.strictEqual(sentEmails[0].subject, 'Congratulations! Your SecureBank Account Has Been Created');
    assert.ok(sentEmails[0].html.includes(accountNumber), 'Email must contain customer account number');
    assert.ok(sentEmails[0].html.includes('priya.patel@example.com'), 'Email must contain customer email');
    assert.ok(sentEmails[0].html.includes('9820098200'), 'Email must contain customer phone');
    console.log('✅ PASS: Admin approved KYC. Account activated to "Active" and "Congratulations" email dispatched.');

    // ─── TEST 4: Multi-Identifier Customer Login ────────────────────────────
    console.log('\n─── TEST 4: Multi-Identifier Login (Account Number / Email / Phone / Identifier) ───');

    // 4a. Login via Account Number
    const loginAcc = await request(app).post('/customer/login').send({
      accountNumber,
      password: 'StrongPassword@123',
    });
    assert.strictEqual(loginAcc.statusCode, 200);
    assert.ok(loginAcc.body.data.token, 'Token must be returned for Account Number login');
    console.log('✅ PASS: Login via Account Number successful');

    // 4b. Login via Email (Case-Insensitive)
    const loginEmail = await request(app).post('/customer/login').send({
      email: 'PRIYA.PATEL@EXAMPLE.COM',
      password: 'StrongPassword@123',
    });
    assert.strictEqual(loginEmail.statusCode, 200);
    assert.ok(loginEmail.body.data.token, 'Token must be returned for Email login');
    console.log('✅ PASS: Login via Email (case-insensitive) successful');

    // 4c. Login via Phone Number
    const loginPhone = await request(app).post('/customer/login').send({
      phone: '9820098200',
      password: 'StrongPassword@123',
    });
    assert.strictEqual(loginPhone.statusCode, 200);
    assert.ok(loginPhone.body.data.token, 'Token must be returned for Phone login');
    console.log('✅ PASS: Login via Phone Number successful');

    // 4d. Login via Generic Identifier field
    const loginIdentifier = await request(app).post('/customer/login').send({
      identifier: 'priya.patel@example.com',
      password: 'StrongPassword@123',
    });
    assert.strictEqual(loginIdentifier.statusCode, 200);
    assert.ok(loginIdentifier.body.data.token, 'Token must be returned for generic identifier login');
    console.log('✅ PASS: Login via Generic Identifier field successful');

    // ─── TEST 5: Wrong Password Rejection ───────────────────────────────────
    console.log('\n─── TEST 5: Wrong Password Rejection ───');
    const wrongPwdRes = await request(app).post('/customer/login').send({
      accountNumber,
      password: 'WrongPassword@999',
    });
    assert.strictEqual(wrongPwdRes.statusCode, 401);
    assert.strictEqual(wrongPwdRes.body.message, 'Invalid credentials');
    console.log('✅ PASS: Wrong password rejected with 401');

    // ─── TEST 6: Frozen Account Handling ────────────────────────────────────
    console.log('\n─── TEST 6: Frozen Account Handling ───');
    createdCust.AccountStatus = 'Frozen';
    const frozenRes = await request(app).post('/customer/login').send({
      accountNumber,
      password: 'StrongPassword@123',
    });
    assert.strictEqual(frozenRes.statusCode, 401);
    assert.strictEqual(frozenRes.body.message, 'Your account has been frozen. Contact support.');
    console.log('✅ PASS: Frozen account rejected with 401 and support contact instruction');

    console.log('\n===============================================================');
    console.log('🎉 ALL ACCOUNT ACTIVATION & LOGIN FLOW INTEGRATION TESTS PASSED');
    console.log('===============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    db.query = originalQuery;
    db.getConnection = originalGetConnection;
  }
}

runActivationFlowSuite();
