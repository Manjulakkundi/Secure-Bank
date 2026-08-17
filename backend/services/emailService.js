/**
 * services/emailService.js
 * Nodemailer wrapper for all SecureBank emails.
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const BASE_HEADER = `
  <div style="background:#1A3C5E;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">🏦 SecureBank</h1>
  </div>`;

const BASE_FOOTER = `
  <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:12px;color:#aaa">
    SecureBank — Secure your future | If you did not request this, please ignore.
  </div>`;

const wrap = (body) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
    ${BASE_HEADER}
    <div style="padding:32px">${body}</div>
    ${BASE_FOOTER}
  </div>`;

const send = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"SecureBank" <noreply@securebank.com>',
      to, subject, html,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    // Non-critical for financial execution — caller handles
    return false;
  }
};

/** OTP email (SIGNUP or PASSWORD_RESET) */
const sendOtpEmail = async (toEmail, otp, purpose = 'SIGNUP') => {
  const subjects = {
    SIGNUP:         'SecureBank — Verify Your Email',
    PASSWORD_RESET: 'SecureBank — Password Reset OTP',
  };
  const intros = {
    SIGNUP:         'Use the OTP below to verify your email and activate your account.',
    PASSWORD_RESET: 'Use the OTP below to reset your password. This OTP expires shortly.',
  };

  const html = wrap(`
    <h2 style="color:#1A3C5E;margin-top:0">${subjects[purpose]}</h2>
    <p style="color:#555">${intros[purpose]}</p>
    <div style="background:#f0f7ff;border:2px dashed #2E7D9A;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
      <span style="font-size:40px;font-weight:bold;letter-spacing:14px;color:#1A3C5E">${otp}</span>
    </div>
    <p style="color:#888;font-size:13px">⏰ Expires in <strong>${process.env.OTP_EXPIRY_MINUTES || 10} minutes</strong>.</p>
  `);

  try {
    await send(toEmail, subjects[purpose], html);
  } catch (err) {
    throw new Error('Failed to send verification email. Please try again.');
  }
};

/** Welcome email sent after account creation — includes account number */
const sendWelcomeEmail = async (toEmail, customerName, accountNumber, accountType, createdAt) => {
  const creationDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = wrap(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:40px">🎉</div>
      <h2 style="color:#1A3C5E;margin:12px 0 4px">Welcome to SecureBank!</h2>
      <p style="color:#888;font-size:13px;margin:0">Your account has been successfully created & verified</p>
    </div>

    <p style="color:#555;font-size:14px;margin-bottom:20px">
      Dear <strong>${customerName}</strong>, congratulations! Your SecureBank account is now active and ready to use.
    </p>

    <!-- Account Number — most prominent element as per spec -->
    <div style="background:linear-gradient(135deg,#1A3C5E,#2E7D9A);border-radius:14px;padding:28px;text-align:center;margin:0 0 24px">
      <p style="color:rgba(255,255,255,0.75);font-size:11px;letter-spacing:2px;font-weight:700;margin:0 0 8px;text-transform:uppercase">Your Account Number</p>
      <p style="color:#fff;font-size:34px;font-weight:800;letter-spacing:8px;margin:0;font-family:monospace">${accountNumber}</p>
      <p style="color:rgba(255,255,255,0.6);font-size:11px;margin:10px 0 0">Use this number to login and receive transfers</p>
    </div>

    <!-- Account details table -->
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e8eef4;margin-bottom:20px">
      <tr style="background:#f0f7ff">
        <td style="padding:11px 14px;font-weight:600;color:#555;font-size:13px;width:45%;border-bottom:1px solid #e8eef4">Account Holder</td>
        <td style="padding:11px 14px;color:#333;font-size:13px;border-bottom:1px solid #e8eef4">${customerName}</td>
      </tr>
      <tr>
        <td style="padding:11px 14px;font-weight:600;color:#555;font-size:13px;border-bottom:1px solid #e8eef4">Account Number</td>
        <td style="padding:11px 14px;font-family:monospace;font-size:14px;font-weight:700;color:#1A3C5E;border-bottom:1px solid #e8eef4">${accountNumber}</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:11px 14px;font-weight:600;color:#555;font-size:13px;border-bottom:1px solid #e8eef4">Account Type</td>
        <td style="padding:11px 14px;color:#333;font-size:13px;border-bottom:1px solid #e8eef4">${accountType}</td>
      </tr>
      <tr>
        <td style="padding:11px 14px;font-weight:600;color:#555;font-size:13px">Account Created</td>
        <td style="padding:11px 14px;color:#333;font-size:13px">${creationDate}</td>
      </tr>
    </table>

    <div style="background:#fff8e1;border-left:4px solid #f9a825;padding:14px 16px;border-radius:4px;margin-bottom:20px">
      <strong style="color:#795548">⚠️ Important — Save your Account Number</strong>
      <p style="color:#795548;margin:6px 0 0;font-size:13px">
        You need your <strong>${accountNumber}</strong> to log in and receive transfers. Keep it safe and do not share it with anyone.
      </p>
    </div>

    <h3 style="color:#1A3C5E;font-size:14px">What you can do now:</h3>
    <ul style="color:#555;font-size:13px;line-height:2">
      <li>💰 Deposit and withdraw funds</li>
      <li>💸 Transfer money to other accounts</li>
      <li>📈 Open Fixed &amp; Recurring Deposits</li>
      <li>🏦 Apply for loans</li>
      <li>📋 View full transaction history</li>
      <li>📄 Download monthly statements</li>
    </ul>
  `);

  try {
    await send(toEmail, 'Welcome to SecureBank — Your Account is Active', html);
  } catch (err) {
    logger.warn(`Welcome email failed for ${toEmail}: ${err.message}`);
  }
};

/** Transaction notification */
const sendTransactionEmail = async (toEmail, customerName, txnData) => {
  const { amount, type, balance, description } = txnData;
  const isDebit  = ['WITHDRAW','TRANSFER','DEBIT','FD_CREATED','RD_CONTRIBUTION'].includes(type);
  const color    = isDebit ? '#C0392B' : '#1E8449';
  const sign     = isDebit ? '−' : '+';
  const typeLabel = {
    DEPOSIT: 'Deposit',
    WITHDRAW: 'Withdrawal',
    TRANSFER: 'Transfer',
    RECEIVE: 'Money Received',
    LOAN_APPROVED: 'Loan Credited',
    FD_CREATED: 'Fixed Deposit Created',
    FD_MATURITY: 'Fixed Deposit Matured',
    RD_CONTRIBUTION: 'Recurring Deposit Contribution',
    RD_MATURITY: 'Recurring Deposit Matured',
  }[type] || type;

  const html = wrap(`
    <h2 style="color:#1A3C5E;margin-top:0">Transaction Alert</h2>
    <p>Dear <strong>${customerName}</strong>, a transaction was processed on your account.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Amount</td>
        <td style="padding:12px;color:${color};font-size:22px;font-weight:bold">${sign}₹${parseFloat(amount).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Type</td>
        <td style="padding:12px">${typeLabel}</td>
      </tr>
      ${description ? `<tr style="background:#f9f9f9"><td style="padding:12px;font-weight:bold;color:#555">Description</td><td style="padding:12px">${description}</td></tr>` : ''}
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Available Balance</td>
        <td style="padding:12px;font-weight:bold">₹${parseFloat(balance).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
      </tr>
    </table>
    <p style="color:#888;font-size:12px">If this transaction was not made by you, contact SecureBank support immediately.</p>
  `);

  try {
    await send(toEmail, `SecureBank: ${typeLabel} Alert`, html);
  } catch (err) {
    logger.warn(`Transaction email failed for ${toEmail}: ${err.message}`);
  }
};

/** Account freeze/unfreeze notification */
const sendAccountStatusEmail = async (toEmail, customerName, action, reason) => {
  const isFrozen = action === 'FREEZE';
  const html = wrap(`
    <h2 style="color:${isFrozen ? '#C0392B' : '#1E8449'};margin-top:0">
      Account ${isFrozen ? 'Frozen ❄️' : 'Reactivated ✅'}
    </h2>
    <p>Dear <strong>${customerName}</strong>,</p>
    <p style="color:#555">Your SecureBank account has been <strong>${isFrozen ? 'frozen' : 'reactivated'}</strong> by an administrator.</p>
    ${reason ? `<div style="background:#f5f5f5;padding:12px;border-radius:8px;margin:16px 0"><strong>Reason:</strong> ${reason}</div>` : ''}
    <p style="color:#888;font-size:13px">If you believe this is an error, please contact our support team.</p>
  `);

  try {
    await send(toEmail, `SecureBank: Account ${isFrozen ? 'Frozen' : 'Reactivated'}`, html);
  } catch (err) {
    logger.warn(`Status email failed for ${toEmail}: ${err.message}`);
  }
};

/** Loan approval/rejection */
const sendLoanStatusEmail = async (toEmail, customerName, loanData) => {
  const { amount, status, loanType } = loanData;
  const approved = status === 'Approved';
  const html = wrap(`
    <h2 style="color:${approved ? '#1E8449' : '#C0392B'};margin-top:0">
      Loan Application ${approved ? 'Approved ✅' : 'Rejected ❌'}
    </h2>
    <p>Dear <strong>${customerName}</strong>,</p>
    <p style="color:#555">Your ${loanType} loan application has been <strong>${status}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold">Loan Amount</td>
        <td style="padding:12px">₹${parseFloat(amount).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold">Loan Type</td>
        <td style="padding:12px">${loanType}</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold">Status</td>
        <td style="padding:12px;font-weight:bold;color:${approved ? '#1E8449' : '#C0392B'}">${status}</td>
      </tr>
    </table>
    ${approved ? '<p style="color:#555">The approved amount has been credited to your account. Log in to view your balance.</p>' : ''}
  `);

  try {
    await send(toEmail, `SecureBank: Loan Application ${status}`, html);
  } catch (err) {
    logger.warn(`Loan email failed for ${toEmail}: ${err.message}`);
  }
};

/** Forgot account number */
const sendAccountNumberEmail = async (toEmail, customerName, accountNumber, accountStatus) => {
  const html = wrap(`
    <h2 style="color:#1A3C5E;margin-top:0">Account Number Recovery</h2>
    <p>Dear <strong>${customerName}</strong>, you requested your account details.</p>
    <div style="background:linear-gradient(135deg,#1A3C5E,#2E7D9A);border-radius:12px;padding:24px;text-align:center;margin:24px 0">
      <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:0 0 6px;letter-spacing:1px;font-weight:600">YOUR ACCOUNT NUMBER</p>
      <p style="color:#fff;font-size:32px;font-weight:800;letter-spacing:6px;margin:0;font-family:monospace">${accountNumber}</p>
    </div>
    <p style="color:#555;font-size:14px">Account Status: <strong>${accountStatus}</strong></p>
    <p style="color:#888;font-size:12px">If you did not request this, please contact support immediately.</p>
  `);

  try {
    await send(toEmail, 'SecureBank: Your Account Number', html);
  } catch (err) {
    logger.warn(`Account recovery email failed for ${toEmail}: ${err.message}`);
  }
};

/** Fixed Deposit Created confirmation email */
const sendFdCreatedEmail = async (toEmail, customerName, fd) => {
  const { principalAmount, tenureMonths, interestRate, interestAmount, maturityAmount, startDate, maturityDate } = fd;
  const startStr = new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const maturityStr = new Date(maturityDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const tenureLabel = tenureMonths >= 12 ? `${tenureMonths / 12} Year${tenureMonths > 12 ? 's' : ''}` : `${tenureMonths} Months`;

  const html = wrap(`
    <h2 style="color:#1A3C5E;margin-top:0">Fixed Deposit Created Successfully ✅</h2>
    <p>Dear <strong>${customerName}</strong>,</p>
    <p style="color:#555">Your Fixed Deposit has been successfully created and your funds are now securely compounding.</p>
    
    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">FD Principal Amount</td>
        <td style="padding:12px;color:#1A3C5E;font-size:18px;font-weight:bold">₹${parseFloat(principalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Tenure</td>
        <td style="padding:12px">${tenureLabel} (${tenureMonths} Months)</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Interest Rate</td>
        <td style="padding:12px;font-weight:bold;color:#0D9488">${parseFloat(interestRate).toFixed(2)}% p.a.</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Estimated Interest</td>
        <td style="padding:12px;color:#1E8449;font-weight:600">₹${parseFloat(interestAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Maturity Amount</td>
        <td style="padding:12px;color:#1A3C5E;font-size:18px;font-weight:bold">₹${parseFloat(maturityAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Start Date</td>
        <td style="padding:12px">${startStr}</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Maturity Date</td>
        <td style="padding:12px;font-weight:bold;color:#1A3C5E">${maturityStr}</td>
      </tr>
    </table>

    <p style="color:#555;font-size:13px">
      The principal amount has been deducted from your SecureBank available account balance and your Fixed Deposit is now active.
    </p>
  `);

  try {
    await send(toEmail, 'SecureBank - Fixed Deposit Created Successfully', html);
  } catch (err) {
    logger.warn(`FD created email failed for ${toEmail}: ${err.message}`);
  }
};

/** Fixed Deposit Matured credit email */
const sendFdMaturedEmail = async (toEmail, customerName, fd) => {
  const { principalAmount, interestAmount, maturityAmount } = fd;
  const html = wrap(`
    <h2 style="color:#1E8449;margin-top:0">Your Fixed Deposit Has Matured 🎉</h2>
    <p>Dear <strong>${customerName}</strong>,</p>
    <p style="color:#555">Your Fixed Deposit has reached its maturity date. The maturity proceeds have been automatically credited to your core account.</p>
    
    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Principal Amount</td>
        <td style="padding:12px">₹${parseFloat(principalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Interest Earned</td>
        <td style="padding:12px;color:#1E8449;font-weight:bold">+₹${parseFloat(interestAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Total Maturity Credited</td>
        <td style="padding:12px;color:#1A3C5E;font-size:20px;font-weight:bold">₹${parseFloat(maturityAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    </table>

    <p style="color:#555;font-size:13px">
      The maturity amount has been credited to your SecureBank account. Your Fixed Deposit status is now MATURED.
    </p>
  `);

  try {
    await send(toEmail, 'SecureBank - Your Fixed Deposit Has Matured', html);
  } catch (err) {
    logger.warn(`FD matured email failed for ${toEmail}: ${err.message}`);
  }
};

/** Recurring Deposit Created confirmation email (States zero initial deduction) */
const sendRdCreatedEmail = async (toEmail, customerName, rd) => {
  const { monthlyAmount, tenureMonths, interestRate, totalScheduledDeposit, estimatedMaturityAmount, nextDueDate, maturityDate } = rd;
  const dueStr = new Date(nextDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const maturityStr = new Date(maturityDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = wrap(`
    <h2 style="color:#1A3C5E;margin-top:0">Recurring Deposit Schedule Created ✅</h2>
    <p>Dear <strong>${customerName}</strong>,</p>
    <p style="color:#555">Your Recurring Deposit schedule has been successfully created.</p>

    <div style="background:#eff6ff;border-left:4px solid #2563EB;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:13px;color:#1E40AF">
      <strong>ℹ️ No Initial Deduction:</strong> No money was deducted from your account during creation. You will make your monthly contributions manually via the portal.
    </div>

    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Monthly Installment</td>
        <td style="padding:12px;color:#1A3C5E;font-size:18px;font-weight:bold">₹${parseFloat(monthlyAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Tenure</td>
        <td style="padding:12px">${tenureMonths} Months (${tenureMonths} Contributions)</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Interest Rate</td>
        <td style="padding:12px;font-weight:bold;color:#0D9488">${parseFloat(interestRate).toFixed(2)}% p.a.</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Total Scheduled Deposit</td>
        <td style="padding:12px">₹${parseFloat(totalScheduledDeposit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Estimated Maturity Value</td>
        <td style="padding:12px;color:#1E8449;font-weight:bold">₹${parseFloat(estimatedMaturityAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Current Amount Paid</td>
        <td style="padding:12px;font-weight:bold">₹0.00</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">First Installment Due</td>
        <td style="padding:12px;font-weight:bold;color:#2563EB">${dueStr}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Maturity Date</td>
        <td style="padding:12px">${maturityStr}</td>
      </tr>
    </table>
  `);

  try {
    await send(toEmail, 'SecureBank - Recurring Deposit Created Successfully', html);
  } catch (err) {
    logger.warn(`RD created email failed for ${toEmail}: ${err.message}`);
  }
};

/** Recurring Deposit Monthly Reminder email (Zero deduction notice) */
const sendRdMonthlyReminderEmail = async (toEmail, customerName, rd, dueMonthNumber) => {
  const { id, monthlyAmount, totalContributionsExpected, totalAmountPaid, nextDueDate } = rd;
  const dueStr = new Date(nextDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const remainingCount = totalContributionsExpected - (dueMonthNumber - 1);

  const html = wrap(`
    <h2 style="color:#1A3C5E;margin-top:0">RD Monthly Contribution Due 📅</h2>
    <p>Dear <strong>${customerName}</strong>,</p>
    <p style="color:#555">Your monthly Recurring Deposit contribution is now due for <strong>RD #${id}</strong>.</p>

    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Monthly Contribution Due</td>
        <td style="padding:12px;color:#1A3C5E;font-size:18px;font-weight:bold">₹${parseFloat(monthlyAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Contribution Number</td>
        <td style="padding:12px;font-weight:bold">${dueMonthNumber} of ${totalContributionsExpected}</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Due Date</td>
        <td style="padding:12px;color:#C0392B;font-weight:bold">${dueStr}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Total Amount Paid So Far</td>
        <td style="padding:12px">₹${parseFloat(totalAmountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Remaining Scheduled Contributions</td>
        <td style="padding:12px">${remainingCount}</td>
      </tr>
    </table>

    <div style="background:#fff8e1;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:16px 0;font-size:13px;color:#92400E">
      <strong>⚠️ Manual Payment Required:</strong> Please log in to SecureBank and make your RD contribution manually. Your account will <strong>NOT</strong> be automatically debited.
    </div>
  `);

  try {
    await send(toEmail, 'SecureBank - RD Monthly Contribution Due', html);
  } catch (err) {
    logger.warn(`RD reminder email failed for ${toEmail}: ${err.message}`);
  }
};

/** Recurring Deposit Contribution Confirmation email */
const sendRdContributionEmail = async (toEmail, customerName, rd, contribData) => {
  const { monthlyAmount, totalContributionsExpected, totalAmountPaid, nextDueDate } = rd;
  const { contributionNumber, amount } = contribData;
  const remainingCount = Math.max(0, totalContributionsExpected - contributionNumber);
  const nextDueStr = nextDueDate
    ? new Date(nextDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Completed';

  const html = wrap(`
    <h2 style="color:#1E8449;margin-top:0">RD Contribution Successful ✅</h2>
    <p>Dear <strong>${customerName}</strong>,</p>
    <p style="color:#555">Your recurring deposit contribution has been successfully received and added to your RD balance.</p>

    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Contribution Paid</td>
        <td style="padding:12px;color:#1E8449;font-size:18px;font-weight:bold">₹${parseFloat(amount || monthlyAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Contribution Progress</td>
        <td style="padding:12px;font-weight:bold">${contributionNumber} of ${totalContributionsExpected} Completed</td>
      </tr>
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Total Principal Paid</td>
        <td style="padding:12px;font-weight:bold">₹${parseFloat(totalAmountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Remaining Contributions</td>
        <td style="padding:12px">${remainingCount}</td>
      </tr>
      ${remainingCount > 0 ? `
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Next Due Date</td>
        <td style="padding:12px;font-weight:bold;color:#2563EB">${nextDueStr}</td>
      </tr>` : ''}
    </table>
  `);

  try {
    await send(toEmail, 'SecureBank - RD Contribution Successful', html);
  } catch (err) {
    logger.warn(`RD contribution email failed for ${toEmail}: ${err.message}`);
  }
};

/** Recurring Deposit Matured credit email (Uses actual payout numbers) */
const sendRdMaturedEmail = async (toEmail, customerName, rd, actualMaturityData) => {
  const { totalContributionsExpected, contributionsCompleted, contributionsMissed, totalAmountPaid, actualInterestEarned, actualMaturityAmount } = actualMaturityData;

  const html = wrap(`
    <h2 style="color:#1E8449;margin-top:0">Your Recurring Deposit Has Matured 🎉</h2>
    <p>Dear <strong>${customerName}</strong>,</p>
    <p style="color:#555">Your Recurring Deposit has reached maturity. Your maturity proceeds calculated from your actual verified contributions have been credited to your core account.</p>

    <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Total Actual Contributions Paid</td>
        <td style="padding:12px">₹${parseFloat(totalAmountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${contributionsCompleted} / ${totalContributionsExpected})</td>
      </tr>
      ${contributionsMissed > 0 ? `
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Missed/Unpaid Contributions</td>
        <td style="padding:12px;color:#C0392B">${contributionsMissed}</td>
      </tr>` : ''}
      <tr style="background:#f0f7ff">
        <td style="padding:12px;font-weight:bold;color:#555">Actual Interest Earned</td>
        <td style="padding:12px;color:#1E8449;font-weight:bold">+₹${parseFloat(actualInterestEarned).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td style="padding:12px;font-weight:bold;color:#555">Total Maturity Credited</td>
        <td style="padding:12px;color:#1A3C5E;font-size:20px;font-weight:bold">₹${parseFloat(actualMaturityAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    </table>

    <p style="color:#555;font-size:13px">
      The maturity proceeds have been credited to your SecureBank account and your Recurring Deposit is now MATURED.
    </p>
  `);

  try {
    await send(toEmail, 'SecureBank - Your Recurring Deposit Has Matured', html);
  } catch (err) {
    logger.warn(`RD matured email failed for ${toEmail}: ${err.message}`);
  }
};

// Keep old export name for backward compatibility
const sendTransferNotification = sendTransactionEmail;

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendTransactionEmail,
  sendTransferNotification,
  sendAccountStatusEmail,
  sendLoanStatusEmail,
  sendAccountNumberEmail,
  sendFdCreatedEmail,
  sendFdMaturedEmail,
  sendRdCreatedEmail,
  sendRdMonthlyReminderEmail,
  sendRdContributionEmail,
  sendRdMaturedEmail,
};
