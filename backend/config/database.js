/**
 * config/database.js
 * MySQL2 connection pool — reads credentials from .env, never hardcoded.
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',
  database: process.env.DB_NAME     || 'bank',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  timezone:           '+05:30',        // IST
  charset:            'utf8mb4',
});

// Verify connectivity on startup
pool.getConnection()
  .then(conn => { console.log('✅ MySQL connected'); conn.release(); })
  .catch(err => { console.error('❌ MySQL connection failed:', err.message); process.exit(1); });

module.exports = pool;
