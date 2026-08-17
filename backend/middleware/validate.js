/**
 * middleware/validate.js
 * express-validator rule sets for all endpoints.
 * Import the array and spread into route definitions.
 */
const { body, query, param, validationResult } = require('express-validator');
const { sendBadRequest } = require('../utils/response');

/** Run validation and return 400 on failure */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendBadRequest(res, 'Validation failed', errors.array());
  }
  next();
};

// ─── Rule Sets ────────────────────────────────────────────────────────────────

const validateSignup = [
  body('customerName')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 chars'),
  body('customerEmail')
    .trim().isEmail().withMessage('Valid email required')
    .normalizeEmail(),
  body('customerPhone')
    .trim().isMobilePhone('en-IN').withMessage('Valid 10-digit Indian phone required'),
  body('AccountType')
    .isIn(['Savings', 'Current']).withMessage('AccountType must be Savings or Current'),
  body('CustomerPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .withMessage('Password must contain uppercase, number, and special character'),
  body('customerAddress').trim().notEmpty().withMessage('Address required'),
  body('customerCity').trim().notEmpty().withMessage('City required'),
  handleValidation,
];

const validateLogin = [
  // Accept accountNumber OR email OR phone — at least one required
  body('password').notEmpty().withMessage('Password required'),
  (req, res, next) => {
    const { accountNumber, email, phone } = req.body;
    if (!accountNumber && !email && !phone) {
      return res.status(400).json({ success: false, message: 'Provide account number, email, or phone number' });
    }
    next();
  },
  handleValidation,
];

const validateDeposit = [
  body('accountNumber')
    .trim().notEmpty().isLength({ min: 12, max: 12 }).isNumeric()
    .withMessage('Valid account number required'),
  body('depositAmount')
    .isFloat({ min: 1, max: 1000000 }).withMessage('Deposit amount must be ₹1 – ₹10,00,000'),
  handleValidation,
];

const validateWithdraw = [
  body('withdrawAmount')
    .isFloat({ min: 1 }).withMessage('Withdrawal amount must be at least ₹1')
    .isFloat({ max: 200000 }).withMessage('Single withdrawal cannot exceed ₹2,00,000'),
  handleValidation,
];

const validateAdminWithdraw = [
  body('accountNumber')
    .trim().notEmpty().isLength({ min: 12, max: 12 }).isNumeric()
    .withMessage('Valid account number required'),
  body('withdrawAmount')
    .isFloat({ min: 1 }).withMessage('Withdrawal amount must be at least ₹1')
    .isFloat({ max: 1000000 }).withMessage('Single withdrawal cannot exceed ₹10,00,000'),
  handleValidation,
];

const validateTransfer = [
  body('toAccount')
    .trim().notEmpty().isLength({ min: 12, max: 12 }).isNumeric()
    .withMessage('Valid receiver account number required'),
  body('transferAmount')
    .isFloat({ min: 1 }).withMessage('Transfer amount must be at least ₹1')
    .isFloat({ max: 500000 }).withMessage('Single transfer cannot exceed ₹5,00,000'),
  handleValidation,
];

const validateLoan = [
  body('loanAmount')
    .isFloat({ min: 1000, max: 5000000 }).withMessage('Loan amount must be ₹1,000 – ₹50,00,000'),
  body('loanDurationMonths')
    .isInt({ min: 1, max: 360 }).withMessage('Duration must be 1–360 months'),
  handleValidation,
];

const validateOtp = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('otp')
    .trim().notEmpty().isLength({ min: 6, max: 6 }).isNumeric()
    .withMessage('OTP must be a 6-digit number'),
  handleValidation,
];

const validatePasswordReset = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('otp').trim().isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid OTP required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password min 8 characters')
    .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .withMessage('Must contain uppercase, number, special character'),
  handleValidation,
];

const validateBeneficiary = [
  body('beneficiaryAccount')
    .trim().notEmpty().isLength({ min: 12, max: 12 }).isNumeric()
    .withMessage('Valid beneficiary account required'),
  body('beneficiaryName').trim().notEmpty().isLength({ min: 2, max: 100 })
    .withMessage('Beneficiary name required'),
  handleValidation,
];

const validateAdminLogin = [
  body('username').trim().notEmpty().withMessage('Username required'),
  body('password').notEmpty().withMessage('Password required'),
  handleValidation,
];

module.exports = {
  validateSignup, validateLogin, validateDeposit, validateWithdraw,
  validateAdminWithdraw, validateTransfer, validateLoan, validateOtp,
  validatePasswordReset, validateBeneficiary, validateAdminLogin, handleValidation,
};
