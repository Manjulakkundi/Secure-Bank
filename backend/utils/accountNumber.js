/**
 * utils/accountNumber.js
 * Generates a unique 12-digit account number.
 */
const crypto = require('crypto');
const db = require('../config/database');

const generateAccountNumber = async () => {
  let accountNumber;
  let isUnique = false;
  while (!isUnique) {
    accountNumber = crypto.randomInt(100000000000, 999999999999).toString();
    const [rows] = await db.query(
      'SELECT 1 FROM Customer WHERE AccountNumber = ? LIMIT 1',
      [accountNumber]
    );
    if (rows.length === 0) isUnique = true;
  }
  return accountNumber;
};

module.exports = { generateAccountNumber };
