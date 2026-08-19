/**
 * services/mailer.js
 * Production-hardened, pooled, resilient mail transport engine for SecureBank.
 * Features:
 *  - Connection pooling (pool: true, maxConnections: 5)
 *  - Direct SSL (port 465) / STARTTLS (port 587) smart selection
 *  - Fast connection timeout (5000ms max) to eliminate indefinite hanging
 *  - Non-blocking async queue dispatcher (enqueueEmail)
 *  - Structured diagnostic performance logging (EMAIL_ATTEMPT, EMAIL_SENT, EMAIL_FAILED, EMAIL_TIMEOUT)
 *  - Safe recipient masking in logs (e.g. j***@example.com)
 *  - Connection verification & health check (verifyMailConnection)
 *  - Zero data loss guarantee: failures are isolated and never rollback database transactions
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/** Mask email address for privacy-safe logging */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return 'invalid';
  const name = parts[0];
  const maskedName = name.length <= 2
    ? name[0] + '*'
    : name[0] + '*'.repeat(Math.max(1, name.length - 2)) + name.slice(-1);
  return `${maskedName}@${parts[1]}`;
};

/** Build optimal Nodemailer configuration for cloud platforms (Render / Vercel / AWS) */
const getTransporterConfig = () => {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const rawPort = process.env.EMAIL_PORT || process.env.SMTP_PORT;
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.EMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const service = process.env.EMAIL_SERVICE;

  // On cloud platforms, port 465 with direct SSL is significantly faster and less prone to
  // firewall STARTTLS negotiation timeouts than port 587.
  const port = rawPort ? parseInt(rawPort, 10) : (host.includes('gmail') ? 465 : 587);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  const config = {
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    connectionTimeout: 5000, // 5s connection timeout
    greetingTimeout: 5000,   // 5s greeting timeout
    socketTimeout: 8000,     // 8s socket timeout
    dnsTimeout: 3000,        // 3s DNS timeout
  };

  if (service) {
    config.service = service;
    config.auth = user && pass ? { user, pass } : undefined;
  } else {
    config.host = host;
    config.port = port;
    config.secure = secure;
    config.auth = user && pass ? { user, pass } : undefined;
    config.tls = {
      rejectUnauthorized: process.env.EMAIL_REJECT_UNAUTHORIZED === 'true',
      minVersion: 'TLSv1.2',
    };
  }

  return config;
};

let transporterInstance = null;

const getTransporter = () => {
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport(getTransporterConfig());
  }
  return transporterInstance;
};

const setTransporter = (instance) => {
  transporterInstance = instance;
};


/**
 * Dispatch an email with full safety, structured logging, and duration tracking.
 * NEVER throws an error to the caller — returns boolean true/false.
 *
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text fallback
 * @param {string} [options.type] - Category tag for diagnostic logs
 * @returns {Promise<boolean>}
 */
const sendMailAsync = async ({ to, subject, html, text, type = 'general' }) => {
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    logger.warn(`[EMAIL_REJECTED] Invalid recipient: ${to} (type=${type})`);
    return false;
  }

  const masked = maskEmail(to);
  const startTime = Date.now();
  logger.info(`[EMAIL_ATTEMPT] type=${type} to=${masked}`);

  try {
    const fromAddress = process.env.EMAIL_FROM || '"SecureBank" <noreply@securebank.com>';
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: fromAddress,
      to: to.trim(),
      subject,
      html,
      text: text || undefined,
    });

    const duration = Date.now() - startTime;
    logger.info(`[EMAIL_SENT] type=${type} to=${masked} duration=${duration}ms messageId=${info.messageId || 'OK'}`);
    return true;
  } catch (err) {
    const duration = Date.now() - startTime;
    const isTimeout =
      err.code === 'ETIMEDOUT' ||
      err.code === 'ESOCKET' ||
      err.message?.toLowerCase().includes('timeout');

    if (isTimeout) {
      logger.error(`[EMAIL_TIMEOUT] type=${type} to=${masked} duration=${duration}ms error="${err.message}"`);
    } else {
      logger.error(`[EMAIL_FAILED] type=${type} to=${masked} duration=${duration}ms error="${err.message}"`);
    }
    return false;
  }
};

/**
 * Non-blocking asynchronous task dispatcher.
 * Returns immediately and executes the mail send function in the background.
 */
const enqueueEmail = (fn, ...args) => {
  setImmediate(async () => {
    try {
      await fn(...args);
    } catch (err) {
      logger.warn(`[EMAIL_ASYNC_ERROR] ${err.message}`);
    }
  });
};

/**
 * Safe connection verification / health check.
 * NEVER exposes secrets.
 */
const verifyMailConnection = async () => {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.EMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = process.env.EMAIL_PORT || process.env.SMTP_PORT || (host.includes('gmail') ? 465 : 587);

  if (!user || !pass) {
    return {
      configured: false,
      provider: host,
      port: parseInt(port, 10),
      status: 'MISSING_CREDENTIALS',
      message: 'EMAIL_USER or EMAIL_PASS environment variable is not configured',
    };
  }

  try {
    const transporter = getTransporter();
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Connection verification timeout (4000ms)')), 4000);
      if (timeoutId && typeof timeoutId.unref === 'function') timeoutId.unref();
    });

    try {
      await Promise.race([transporter.verify(), timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }

    return {
      configured: true,
      provider: host,
      port: parseInt(port, 10),
      status: 'CONNECTED',
      message: 'SMTP transport connection verified successfully',
    };
  } catch (err) {
    return {
      configured: true,
      provider: host,
      port: parseInt(port, 10),
      status: 'CONNECTION_ERROR',
      error: err.message,
    };
  }
};

const resetTransporter = () => {
  transporterInstance = null;
};

module.exports = {
  getTransporter,
  setTransporter,
  resetTransporter,
  sendMailAsync,
  enqueueEmail,
  verifyMailConnection,
  maskEmail,
};


