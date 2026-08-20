/**
 * tests/authComprehensiveTest.js
 * Comprehensive integration test suite for SecureBank authentication flow.
 * Uses supertest for fast, in-process HTTP integration testing.
 */
const assert = require('assert');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const express = require('express');
const cors = require('cors');

const db = require('../config/database');
const customerRoutes = require('../routes/customerRoutes');
const adminRoutes = require('../routes/adminRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/customer', customerRoutes);
app.use('/admin', adminRoutes);

async function runAuthTests() {
  console.log('===============================================================');
  console.log('🧪 STARTING SECUREBANK FULL AUTHENTICATION TEST SUITE');
  console.log('===============================================================');

  const conn = await db.getConnection();

  try {
    const TEST_EMAIL = 'auth.test.user@securebank.com';
    const TEST_PHONE = '9876500001';
    const TEST_PASS = 'SecurePass@123';
    const TEST_NEW_PASS = 'NewSecurePass@456';

    const UNVERIFIED_EMAIL = 'unverified.user@securebank.com';
    const UNVERIFIED_PHONE = '9876500002';

    const FROZEN_EMAIL = 'frozen.user@securebank.com';
    const FROZEN_PHONE = '9876500003';

    // Clean up test data
    await conn.query('DELETE FROM otp_verifications WHERE email IN (?, ?, ?)', [
      TEST_EMAIL, UNVERIFIED_EMAIL, FROZEN_EMAIL
    ]);
    await conn.query('DELETE FROM Customer WHERE customerEmail IN (?, ?, ?) OR customerPhone IN (?, ?, ?)', [
      TEST_EMAIL, UNVERIFIED_EMAIL, FROZEN_EMAIL, TEST_PHONE, UNVERIFIED_PHONE, FROZEN_PHONE
    ]);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST A: Customer Registration
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST A: Customer Signup ───');
    const signupRes = await request(app)
      .post('/customer/signup')
      .send({
        customerName: 'Auth Test User',
        AccountType: 'Savings',
        customerPhone: TEST_PHONE,
        customerEmail: TEST_EMAIL,
        customerAddress: '123 Test Avenue',
        customerCity: 'Bengaluru',
        CustomerPassword: TEST_PASS,
      });

    assert.strictEqual(signupRes.status, 201, `Expected status 201, got ${signupRes.status}: ${JSON.stringify(signupRes.body)}`);
    assert.strictEqual(signupRes.body.success, true, 'Signup should succeed');
    assert.ok(signupRes.body.data.accountNumber, 'Account number should be returned');
    const registeredAcc = signupRes.body.data.accountNumber;

    // Verify DB insertion
    const [custRows] = await conn.query('SELECT * FROM Customer WHERE AccountNumber=?', [registeredAcc]);
    assert.strictEqual(custRows.length, 1, 'Customer record must exist in DB');
    assert.strictEqual(custRows[0].AccountVerify, 0, 'Initial AccountVerify must be 0');
    assert.strictEqual(custRows[0].customerEmail, TEST_EMAIL.toLowerCase(), 'Customer email should be lowercased');

    // Verify OTP record in DB
    const [otpRows] = await conn.query('SELECT * FROM otp_verifications WHERE email=? AND purpose=\'SIGNUP\'', [
      TEST_EMAIL.toLowerCase(),
    ]);
    assert.strictEqual(otpRows.length, 1, 'OTP verification record must exist in DB');
    assert.strictEqual(otpRows[0].used, 0, 'OTP record must be unused');
    console.log(`✅ PASS: Customer registered (${registeredAcc}), OTP record created, AccountVerify = 0`);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST H: Login with Unverified Account (Must be rejected)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST H: Unverified Account Login Rejection ───');
    const unverifiedLoginRes = await request(app)
      .post('/customer/login')
      .send({
        accountNumber: registeredAcc,
        password: TEST_PASS,
      });
    assert.strictEqual(unverifiedLoginRes.status, 401, 'Unverified account login must return 401');
    assert.strictEqual(unverifiedLoginRes.body.success, false, 'Unverified login success must be false');
    assert.ok(unverifiedLoginRes.body.message.includes('verify your email'), 'Must prompt to verify email');
    console.log('✅ PASS: Unverified account login correctly blocked with 401');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST B: Verify OTP
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST B: OTP Verification ───');
    // Set known OTP hash for testing
    const knownOtp = '123456';
    const knownHash = await bcrypt.hash(knownOtp, 8);
    await conn.query('UPDATE otp_verifications SET otp_hash=? WHERE email=? AND purpose=\'SIGNUP\'', [
      knownHash, TEST_EMAIL.toLowerCase(),
    ]);

    const verifyRes = await request(app)
      .post('/customer/verify-otp')
      .send({
        email: TEST_EMAIL.toUpperCase(), // Test case insensitivity in verify-otp
        otp: knownOtp,
      });
    assert.strictEqual(verifyRes.status, 200, `Expected 200 on verify OTP, got ${verifyRes.status}`);
    assert.strictEqual(verifyRes.body.success, true, 'OTP verification must succeed');

    const [verifiedCust] = await conn.query('SELECT AccountVerify FROM Customer WHERE AccountNumber=?', [registeredAcc]);
    assert.strictEqual(verifiedCust[0].AccountVerify, 1, 'AccountVerify must become 1');
    console.log('✅ PASS: OTP verified, AccountVerify transitioned 0 -> 1');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST C: Login with Account Number + Password
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST C: Login with Account Number ───');
    const accLoginRes = await request(app)
      .post('/customer/login')
      .send({
        accountNumber: registeredAcc,
        password: TEST_PASS,
      });
    assert.strictEqual(accLoginRes.status, 200, 'Account login must return 200');
    assert.strictEqual(accLoginRes.body.success, true, 'Account login must succeed');
    assert.ok(accLoginRes.body.data.token, 'JWT token must be returned');
    assert.strictEqual(accLoginRes.body.data.accountNumber, registeredAcc);
    const token = accLoginRes.body.data.token;
    console.log('✅ PASS: Login with Account Number succeeded, JWT received');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST D: Protected Route Access with JWT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST D: Protected Route with JWT ───');
    const profileRes = await request(app)
      .get('/customer/profile')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(profileRes.status, 200, 'Protected profile route must return 200');
    assert.strictEqual(profileRes.body.data.AccountNumber, registeredAcc);
    assert.strictEqual(profileRes.body.data.customerEmail, TEST_EMAIL.toLowerCase());
    console.log('✅ PASS: Protected /customer/profile accessed successfully');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST E: Login with Email + Password (Case-Insensitive)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST E: Login with Email (Case-Insensitive) ───');
    const emailLoginRes = await request(app)
      .post('/customer/login')
      .send({
        email: 'AUTH.TEST.USER@SECUREBANK.COM',
        password: TEST_PASS,
      });
    assert.strictEqual(emailLoginRes.status, 200, 'Email login must return 200');
    assert.strictEqual(emailLoginRes.body.success, true, 'Email login must succeed');
    assert.strictEqual(emailLoginRes.body.data.accountNumber, registeredAcc);
    console.log('✅ PASS: Login with uppercase email matched and succeeded');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST F: Login with Phone + Password
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST F: Login with Phone ───');
    const phoneLoginRes = await request(app)
      .post('/customer/login')
      .send({
        phone: TEST_PHONE,
        password: TEST_PASS,
      });
    assert.strictEqual(phoneLoginRes.status, 200, 'Phone login must return 200');
    assert.strictEqual(phoneLoginRes.body.success, true, 'Phone login must succeed');
    assert.strictEqual(phoneLoginRes.body.data.accountNumber, registeredAcc);
    console.log('✅ PASS: Login with phone number succeeded');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST G: Wrong Password Rejection
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST G: Wrong Password Rejection ───');
    const wrongPassRes = await request(app)
      .post('/customer/login')
      .send({
        accountNumber: registeredAcc,
        password: 'IncorrectPassword@999',
      });
    assert.strictEqual(wrongPassRes.status, 401, 'Wrong password must return 401');
    assert.strictEqual(wrongPassRes.body.success, false);
    assert.strictEqual(wrongPassRes.body.message, 'Invalid credentials');
    console.log('✅ PASS: Wrong password rejected with HTTP 401');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST I: Frozen Account Login Rejection
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST I: Frozen Account Login Rejection ───');
    await conn.query('UPDATE Customer SET AccountStatus=\'Frozen\' WHERE AccountNumber=?', [registeredAcc]);

    const frozenLoginRes = await request(app)
      .post('/customer/login')
      .send({
        accountNumber: registeredAcc,
        password: TEST_PASS,
      });
    assert.strictEqual(frozenLoginRes.status, 401, 'Frozen account login must return 401');
    assert.ok(frozenLoginRes.body.message.includes('frozen'), 'Must state account is frozen');

    // Restore to Active
    await conn.query('UPDATE Customer SET AccountStatus=\'Active\' WHERE AccountNumber=?', [registeredAcc]);
    console.log('✅ PASS: Frozen account rejected with HTTP 401');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST J: Forgot Password -> Reset Password -> Login with New Password
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST J: Forgot Password & Password Reset ───');
    const forgotRes = await request(app)
      .post('/customer/forgot-password')
      .send({ email: TEST_EMAIL });
    assert.strictEqual(forgotRes.status, 200);

    const resetOtp = '654321';
    const resetOtpHash = await bcrypt.hash(resetOtp, 8);
    await conn.query('UPDATE otp_verifications SET otp_hash=? WHERE email=? AND purpose=\'PASSWORD_RESET\'', [
      resetOtpHash, TEST_EMAIL.toLowerCase(),
    ]);

    const resetRes = await request(app)
      .post('/customer/reset-password')
      .send({
        email: TEST_EMAIL,
        otp: resetOtp,
        newPassword: TEST_NEW_PASS,
      });
    assert.strictEqual(resetRes.status, 200, 'Password reset must return 200');
    assert.strictEqual(resetRes.body.success, true);

    // Login with new password
    const newPassLoginRes = await request(app)
      .post('/customer/login')
      .send({
        accountNumber: registeredAcc,
        password: TEST_NEW_PASS,
      });
    assert.strictEqual(newPassLoginRes.status, 200, 'Login with new password must succeed');
    assert.ok(newPassLoginRes.body.data.token, 'New JWT token received');
    console.log('✅ PASS: Forgot password -> OTP -> reset password -> login with new password');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST K: Admin Login & Access
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n─── TEST K: Admin Login & Access ───');
    const adminLoginRes = await request(app)
      .post('/admin/login')
      .send({
        username: 'admin',
        password: 'Admin@123',
      });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login must return 200');
    assert.strictEqual(adminLoginRes.body.success, true);
    assert.ok(adminLoginRes.body.data.token, 'Admin JWT token received');
    assert.strictEqual(adminLoginRes.body.data.role, 'admin');

    const adminCustRes = await request(app)
      .get(`/admin/customers?search=${registeredAcc}`)
      .set('Authorization', `Bearer ${adminLoginRes.body.data.token}`);
    assert.strictEqual(adminCustRes.status, 200, 'Admin customer search must return 200');
    assert.strictEqual(adminCustRes.body.success, true);
    console.log('✅ PASS: Admin login and protected endpoint verified');

    // Cleanup test data
    await conn.query('DELETE FROM otp_verifications WHERE email IN (?, ?, ?)', [
      TEST_EMAIL, UNVERIFIED_EMAIL, FROZEN_EMAIL
    ]);
    await conn.query('DELETE FROM Customer WHERE AccountNumber=?', [registeredAcc]);

    console.log('\n===============================================================');
    console.log('📊 ALL 11 AUTHENTICATION TEST CASES PASSED WITH 0 FAILURES ✅');
    console.log('===============================================================');
  } catch (err) {
    console.error('\n❌ AUTHENTICATION TEST FAILED:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

runAuthTests();
