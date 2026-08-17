/**
 * utils/logger.js
 * Winston logger with daily log rotation.
 * Logs: requests, errors, security events, business events.
 */
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Console (dev only)
    new transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
      silent: process.env.NODE_ENV === 'test',
    }),
    // Error log file
    new transports.DailyRotateFile({
      filename:  path.join(__dirname, '../logs/error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level:    'error',
      maxFiles: '30d',
    }),
    // Combined log file
    new transports.DailyRotateFile({
      filename:  path.join(__dirname, '../logs/combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
    // Security events
    new transports.DailyRotateFile({
      filename:  path.join(__dirname, '../logs/security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level:    'warn',
      maxFiles: '90d',
    }),
  ],
});

module.exports = logger;
