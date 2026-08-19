/**
 * index.js — SecureBank Backend Server
 * Production-grade Express app with:
 *   - Environment variable config
 *   - Morgan HTTP logging
 *   - Global error handling
 *   - RBAC-protected routes
 *   - Rate limiting
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const fs      = require('fs');
const path    = require('path');

const logger  = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const customerRoutes = require('./routes/customerRoutes');
const adminRoutes    = require('./routes/adminRoutes');

const app = express();

// ─── Ensure logs directory ────────────────────────────────────────────────────
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const getOrigins = (envVar, defaultOrigin) => {
  if (!envVar) return [defaultOrigin];
  return envVar.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
};

const ALLOWED_ORIGINS = [
  ...getOrigins(process.env.FRONTEND_URL, 'http://localhost:3000'),
  ...getOrigins(process.env.ADMIN_FRONTEND_URL, 'http://localhost:3001'),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (ALLOWED_ORIGINS.includes(normalizedOrigin) || ALLOWED_ORIGINS.includes('*')) {
      return callback(null, true);
    }
    logger.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods:       ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders:['Content-Type', 'Authorization'],
  credentials:   true,
}));


// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── HTTP Request Logging (Morgan → Winston) ──────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip:   (req) => req.url === '/health',
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message:  { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});

app.use(limiter);
app.use('/customer/login', loginLimiter);
app.use('/admin/login',    loginLimiter);

const { verifyMailConnection, resolveMailConfig } = require('./services/mailer');

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'SecureBank API is running', timestamp: new Date().toISOString() });
});

app.get('/health/email', async (req, res) => {
  try {
    const status = await verifyMailConnection();
    const statusCode = status.success ? 200 : (status.configured ? 503 : 200);
    res.status(statusCode).json({
      timestamp: new Date().toISOString(),
      ...status,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: err.message,
    });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/customer', customerRoutes);
app.use('/admin',    adminRoutes);

// ─── 404 + Global Error Handler ───────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

const investmentScheduler = require('./services/investmentScheduler');

// ─── Start Server ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 8081;
  app.listen(PORT, () => {
    logger.info(`✅ SecureBank API running on port ${PORT} [${process.env.NODE_ENV}]`);
    const mailConfig = resolveMailConfig();
    logger.info(`📧 Mailer initialized: provider=${mailConfig.provider} transport=${mailConfig.transport} port=${mailConfig.port} secure=${mailConfig.secure}`);
    // Start background investment maturity & reminder scheduler (runs every 60s)
    investmentScheduler.startScheduler(60000);
  });
}




module.exports = app; // exported for Jest/Supertest

