/**
 * services/notificationService.js
 * Centralized notification service for SecureBank.
 * All methods are non-blocking — callers use .catch() to swallow errors.
 * Every notification is HTML-formatted and matches real banking email standards.
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST   || process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || process.env.SMTP_USER,
    pass: process.env.EMAIL_PASS || process.env.EMAIL_APP_PASSWORD || process.env.SMTP_PASS,
  },
});


// ─── Template helpers ─────────────────────────────────────────────────────────
const fmt = (n) =>
  `₹${parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const maskAccount = (acc) => {
  const s = String(acc);
  return 'XXXX' + s.slice(-4);
};

const dateStr = () =>
  new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  }) + ' IST';

const BASE_HEADER = `
  <div style="background:linear-gradient(135deg,#1A3C5E,#2E7D9A);padding:28px 24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:1px">🏦 SecureBank</h1>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px">Secure your future</p>
  </div>`;

const BASE_FOOTER = `
  <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #eee">
    <p style="margin:0">SecureBank — 24/7 Banking Support | This is an automated notification, please do not reply.</p>
    <p style="margin:4px 0 0">If you did not authorize this transaction, call <strong>1800-SEC-BANK</strong> immediately.</p>
  </div>`;

const wrap = (body) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #ddd;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    ${BASE_HEADER}
    <div style="padding:32px 28px;background:#fff">${body}</div>
    ${BASE_FOOTER}
  </div>`;

const infoRow = (label, value, highlight = false, color = '#333') => `
  <tr style="background:${highlight ? '#f0f7ff' : '#fff'}">
    <td style="padding:11px 14px;font-weight:600;color:#555;font-size:13px;border-bottom:1px solid #f0f0f0;width:45%">${label}</td>
    <td style="padding:11px 14px;color:${color};font-size:13px;border-bottom:1px solid #f0f0f0;font-weight:${highlight ? 700 : 400}">${value}</td>
  </tr>`;

/** Send any email — internal helper */
const _send = async (to, subject, html) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"SecureBank" <noreply@securebank.com>',
    to,
    subject,
    html,
  });
  logger.info(`[Notification] Email sent → ${to} | ${subject}`);
};

// ─── A. Deposit Notification ──────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {string} p.toEmail
 * @param {string} p.customerName
 * @param {string} p.accountNumber
 * @param {number} p.amount
 * @param {number} p.newBalance
 * @param {string} [p.description]
 */
const sendDepositEmail = async (p) => {
  const html = wrap(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px">💰</div>
      <h2 style="color:#1E8449;margin:12px 0 4px;font-size:20px">Money Deposited Successfully</h2>
      <p style="color:#888;font-size:13px;margin:0">Your account has been credited</p>
    </div>

    <p style="color:#555;font-size:14px;margin-bottom:20px">
      Dear <strong>${p.customerName}</strong>, a cash deposit has been credited to your account.
    </p>

    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e8f5e9;margin-bottom:20px">
      ${infoRow('Amount Deposited', `<span style="font-size:20px;color:#1E8449;font-weight:800">${fmt(p.amount)}</span>`, true)}
      ${infoRow('Account Number', maskAccount(p.accountNumber))}
      ${infoRow('Available Balance', `<strong>${fmt(p.newBalance)}</strong>`, true, '#1A3C5E')}
      ${infoRow('Description', p.description || 'Cash Deposit')}
      ${infoRow('Date & Time', dateStr(), true)}
    </table>

    <div style="background:#f0f7ff;border-left:4px solid #1A3C5E;padding:12px 16px;border-radius:4px;margin-bottom:20px">
      <p style="margin:0;color:#1A3C5E;font-size:13px">
        <strong>SMS Alert:</strong><br>
        ${fmt(p.amount)} deposited into A/C ${maskAccount(p.accountNumber)}.
        Available balance ${fmt(p.newBalance)}. SecureBank
      </p>
    </div>

    <p style="color:#aaa;font-size:11px;text-align:center">
      Thank you for banking with SecureBank.
    </p>
  `);

  await _send(p.toEmail, 'Money Deposited Successfully — SecureBank', html);
};

// ─── B. Withdrawal Notification ───────────────────────────────────────────────
/**
 * @param {object} p
 * @param {string} p.toEmail
 * @param {string} p.customerName
 * @param {string} p.accountNumber
 * @param {number} p.amount
 * @param {number} p.newBalance
 * @param {string} [p.description]
 */
const sendWithdrawEmail = async (p) => {
  const html = wrap(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#fde8e8;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px">💸</div>
      <h2 style="color:#C0392B;margin:12px 0 4px;font-size:20px">Cash Withdrawal Successful</h2>
      <p style="color:#888;font-size:13px;margin:0">A withdrawal has been processed from your account</p>
    </div>

    <p style="color:#555;font-size:14px;margin-bottom:20px">
      Dear <strong>${p.customerName}</strong>, a cash withdrawal has been processed from your account.
    </p>

    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #fde8e8;margin-bottom:20px">
      ${infoRow('Amount Withdrawn', `<span style="font-size:20px;color:#C0392B;font-weight:800">${fmt(p.amount)}</span>`, true)}
      ${infoRow('Account Number', maskAccount(p.accountNumber))}
      ${infoRow('Remaining Balance', `<strong>${fmt(p.newBalance)}</strong>`, true, '#1A3C5E')}
      ${infoRow('Description', p.description || 'Cash Withdrawal')}
      ${infoRow('Date & Time', dateStr(), true)}
    </table>

    <div style="background:#fff3cd;border-left:4px solid #f9a825;padding:12px 16px;border-radius:4px;margin-bottom:16px">
      <p style="margin:0;color:#795548;font-size:13px">
        ⚠️ <strong>Security Notice:</strong> If you did not authorize this withdrawal, contact the bank immediately at <strong>1800-SEC-BANK</strong>.
      </p>
    </div>

    <div style="background:#f0f7ff;border-left:4px solid #1A3C5E;padding:12px 16px;border-radius:4px;margin-bottom:20px">
      <p style="margin:0;color:#1A3C5E;font-size:13px">
        <strong>SMS Alert:</strong><br>
        ${fmt(p.amount)} withdrawn from A/C ${maskAccount(p.accountNumber)}.
        Available balance ${fmt(p.newBalance)}. SecureBank
      </p>
    </div>
  `);

  await _send(p.toEmail, 'Cash Withdrawal Successful — SecureBank', html);
};

// ─── C. Transfer Notification (Sender) ───────────────────────────────────────
const sendTransferSentEmail = async (p) => {
  const html = wrap(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#e3f2fd;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px">➡️</div>
      <h2 style="color:#1565C0;margin:12px 0 4px;font-size:20px">Money Transfer Successful</h2>
    </div>
    <p style="color:#555;font-size:14px;margin-bottom:20px">
      Dear <strong>${p.senderName}</strong>, your transfer has been completed.
    </p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e3f2fd;border-radius:8px;overflow:hidden;margin-bottom:20px">
      ${infoRow('Amount Transferred', `<span style="font-size:20px;color:#C0392B;font-weight:800">${fmt(p.amount)}</span>`, true)}
      ${infoRow('Transferred To', maskAccount(p.receiverAccount))}
      ${infoRow('Remaining Balance', `<strong>${fmt(p.senderBalance)}</strong>`, true, '#1A3C5E')}
      ${infoRow('Transaction ID', p.transactionId)}
      ${infoRow('Date & Time', dateStr(), true)}
    </table>
  `);
  await _send(p.toEmail, 'Money Transfer Successful — SecureBank', html);
};

// ─── D. Transfer Notification (Receiver) ─────────────────────────────────────
const sendTransferReceivedEmail = async (p) => {
  const html = wrap(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px">💚</div>
      <h2 style="color:#1E8449;margin:12px 0 4px;font-size:20px">Money Received</h2>
    </div>
    <p style="color:#555;font-size:14px;margin-bottom:20px">
      Dear <strong>${p.receiverName}</strong>, you have received funds in your account.
    </p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e8f5e9;border-radius:8px;overflow:hidden;margin-bottom:20px">
      ${infoRow('Amount Received', `<span style="font-size:20px;color:#1E8449;font-weight:800">${fmt(p.amount)}</span>`, true)}
      ${infoRow('From Account', maskAccount(p.senderAccount))}
      ${infoRow('Updated Balance', `<strong>${fmt(p.receiverBalance)}</strong>`, true, '#1A3C5E')}
      ${infoRow('Transaction ID', p.transactionId)}
      ${infoRow('Date & Time', dateStr(), true)}
    </table>
  `);
  await _send(p.toEmail, 'Money Received — SecureBank', html);
};

// ─── E. Loan Approved Notification ───────────────────────────────────────────
const sendLoanApprovedEmail = async (p) => {
  const html = wrap(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px">🎉</div>
      <h2 style="color:#1E8449;margin:12px 0 4px;font-size:20px">Loan Approved!</h2>
      <p style="color:#888;font-size:13px;margin:0">Congratulations — your loan has been approved</p>
    </div>

    <p style="color:#555;font-size:14px;margin-bottom:20px">
      Dear <strong>${p.customerName}</strong>, your loan request has been approved and credited to your account.
    </p>

    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e8f5e9;margin-bottom:20px">
      ${infoRow('Loan Amount', `<span style="font-size:20px;color:#1E8449;font-weight:800">${fmt(p.loanAmount)}</span>`, true)}
      ${infoRow('Interest Rate', `${p.interestRate}% per annum`)}
      ${infoRow('Duration', `${p.durationMonths} Months`, true)}
      ${infoRow('Amount Credited', fmt(p.loanAmount))}
      ${infoRow('Current Balance', `<strong>${fmt(p.newBalance)}</strong>`, true, '#1A3C5E')}
      ${infoRow('Date & Time', dateStr(), true)}
    </table>

    <div style="background:#f0f7ff;border-left:4px solid #1A3C5E;padding:12px 16px;border-radius:4px;margin-bottom:20px">
      <p style="margin:0;color:#1A3C5E;font-size:13px">
        <strong>SMS Alert:</strong><br>
        Your loan of ${fmt(p.loanAmount)} has been approved and credited to your account. SecureBank
      </p>
    </div>
  `);
  await _send(p.toEmail, 'Loan Approved — SecureBank', html);
};

// ─── F. Loan Rejected Notification ───────────────────────────────────────────
const sendLoanRejectedEmail = async (p) => {
  const html = wrap(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#fde8e8;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px">📋</div>
      <h2 style="color:#C0392B;margin:12px 0 4px;font-size:20px">Loan Application Update</h2>
    </div>

    <p style="color:#555;font-size:14px;margin-bottom:20px">Dear <strong>${p.customerName}</strong>,</p>

    <p style="color:#555;font-size:14px;margin-bottom:20px">
      We regret to inform you that your loan application has been <strong>declined</strong>.
    </p>

    <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:20px">
      <p style="margin:0;color:#555;font-size:13px">
        Please visit your nearest SecureBank branch or contact our customer support for further information regarding your application.
      </p>
    </div>

    <p style="color:#aaa;font-size:12px;text-align:center">
      Thank you for banking with SecureBank.
    </p>
  `);
  await _send(p.toEmail, 'Loan Application Update — SecureBank', html);
};

// ─── G. Account Freeze Notification ──────────────────────────────────────────
const sendFreezeEmail = async (p) => {
  const html = wrap(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#fde8e8;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px">🔒</div>
      <h2 style="color:#C0392B;margin:12px 0 4px;font-size:20px">Account Temporarily Frozen</h2>
    </div>

    <p style="color:#555;font-size:14px;margin-bottom:20px">Dear <strong>${p.customerName}</strong>,</p>

    <p style="color:#555;font-size:14px;margin-bottom:16px">
      Your account has been temporarily frozen by the bank.
    </p>

    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #fde8e8;margin-bottom:20px">
      ${infoRow('Account Number', maskAccount(p.accountNumber), true)}
      ${infoRow('Status', '<span style="color:#C0392B;font-weight:700">Frozen</span>')}
      ${infoRow('Date & Time', dateStr(), true)}
    </table>

    <div style="background:#fff3cd;border-left:4px solid #f9a825;padding:12px 16px;border-radius:4px;margin-bottom:20px">
      <p style="margin:0;color:#795548;font-size:13px">
        ⚠️ Please contact your nearest SecureBank branch or call <strong>1800-SEC-BANK</strong> to resolve this.
      </p>
    </div>
  `);
  await _send(p.toEmail, 'Account Temporarily Frozen — SecureBank', html);
};

// ─── H. Account Unfreeze Notification ────────────────────────────────────────
const sendUnfreezeEmail = async (p) => {
  const html = wrap(`
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#e8f5e9;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px">✅</div>
      <h2 style="color:#1E8449;margin:12px 0 4px;font-size:20px">Account Reactivated</h2>
    </div>

    <p style="color:#555;font-size:14px;margin-bottom:20px">Dear <strong>${p.customerName}</strong>,</p>

    <p style="color:#555;font-size:14px;margin-bottom:16px">
      Your account has been successfully reactivated. You can now access all banking services.
    </p>

    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e8f5e9;margin-bottom:20px">
      ${infoRow('Account Number', maskAccount(p.accountNumber), true)}
      ${infoRow('Status', '<span style="color:#1E8449;font-weight:700">Active</span>')}
      ${infoRow('Date & Time', dateStr(), true)}
    </table>

    <p style="color:#aaa;font-size:12px;text-align:center">
      Welcome back! Thank you for banking with SecureBank.
    </p>
  `);
  await _send(p.toEmail, 'Account Reactivated — SecureBank', html);
};

module.exports = {
  sendDepositEmail,
  sendWithdrawEmail,
  sendTransferSentEmail,
  sendTransferReceivedEmail,
  sendLoanApprovedEmail,
  sendLoanRejectedEmail,
  sendFreezeEmail,
  sendUnfreezeEmail,
};
