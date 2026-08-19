/**
 * routes/customerRoutes.js
 * All customer-facing API routes.
 */
const { Router } = require('express');
const router = Router();
const { verifyUser } = require('../middleware/auth');
const {
  validateSignup, validateLogin, validateWithdraw, validateTransfer,
  validateLoan, validateOtp, validatePasswordReset, validateBeneficiary,
} = require('../middleware/validate');
const { body } = require('express-validator');
const { handleValidation } = require('../middleware/validate');

const authCtrl  = require('../controllers/authController');
const txnCtrl   = require('../controllers/transactionController');
const loanCtrl  = require('../controllers/loanController');
const benefCtrl = require('../controllers/beneficiaryController');
const investCtrl = require('../controllers/investmentController');

// ─── Auth (Public) ────────────────────────────────────────────────────────────
router.post('/signup',               validateSignup,                                          authCtrl.signup);
router.post('/login',                validateLogin,                                           authCtrl.login);
router.post('/verify-otp',           validateOtp,                                             authCtrl.verifyOtp);
router.post('/resend-otp',           [body('email').trim().isEmail().toLowerCase(), handleValidation], authCtrl.resendOtp);
router.post('/forgot-password',      [body('email').trim().isEmail().toLowerCase(), handleValidation], authCtrl.forgotPassword);
router.post('/reset-password',       validatePasswordReset,                                   authCtrl.resetPassword);
router.post('/forgot-account-number',[body('email').trim().isEmail().toLowerCase(), handleValidation], authCtrl.forgotAccountNumber);


// ─── Profile (Protected) ──────────────────────────────────────────────────────
router.get('/profile',               verifyUser, authCtrl.getProfile);
router.put('/profile',               verifyUser, [
  body('customerName').notEmpty().trim(),
  body('customerPhone').isMobilePhone(),
  handleValidation,
], authCtrl.updateProfile);
router.put('/change-password',       verifyUser, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
  handleValidation,
], authCtrl.changePassword);

// ─── Account (Protected) ──────────────────────────────────────────────────────
router.get('/account-info',          verifyUser, txnCtrl.getAccountInfo);

// ─── Transactions (Protected) ─────────────────────────────────────────────────
router.post('/withdraw',             verifyUser, validateWithdraw,   txnCtrl.withdraw);
router.post('/transfer',             verifyUser, validateTransfer,   txnCtrl.transfer);
router.get('/transactions',          verifyUser, txnCtrl.getTransactions);
router.get('/mini-statement',        verifyUser, txnCtrl.getMiniStatement);
router.get('/monthly-statement',     verifyUser, txnCtrl.getMonthlyStatement);
router.get('/statement-pdf',         verifyUser, txnCtrl.downloadStatement);

// ─── Investments (Protected) ──────────────────────────────────────────────────
router.get('/investments/rates',             verifyUser, investCtrl.getRates);
router.get('/investments',                   verifyUser, investCtrl.getMyInvestments);
router.post('/investments/fd/create',        verifyUser, investCtrl.createFD);
router.post('/investments/rd/create',        verifyUser, investCtrl.createRD);
router.post('/investments/rd/:id/contribute',verifyUser, investCtrl.makeRdContribution);

// ─── Loans (Protected) ────────────────────────────────────────────────────────
router.post('/apply-loan',           verifyUser, validateLoan,       loanCtrl.applyLoan);
router.get('/my-loans',              verifyUser, loanCtrl.getMyLoans);

// ─── Beneficiaries (Protected) ────────────────────────────────────────────────
router.post('/beneficiaries',                    verifyUser, validateBeneficiary, benefCtrl.addBeneficiary);
router.get('/beneficiaries',                     verifyUser, benefCtrl.getBeneficiaries);
router.delete('/beneficiaries/:id',              verifyUser, benefCtrl.removeBeneficiary);
router.get('/beneficiaries/validate/:account',   verifyUser, benefCtrl.validateBeneficiary);

module.exports = router;

