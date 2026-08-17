/**
 * controllers/beneficiaryController.js
 * Add, remove, list beneficiaries with account validation.
 */
const db = require('../config/database');
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound } = require('../utils/response');
const { logAudit, ACTIONS } = require('../middleware/auditLogger');

/** POST /customer/beneficiaries */
const addBeneficiary = async (req, res, next) => {
  try {
    const { beneficiaryAccount, beneficiaryName } = req.body;
    const customerId = req.user.AccNumber;

    if (beneficiaryAccount === customerId) return sendBadRequest(res, 'Cannot add yourself as beneficiary');

    // Validate account exists
    const [accRows] = await db.query(
      'SELECT customerName FROM Customer WHERE AccountNumber=? LIMIT 1', [beneficiaryAccount]
    );
    if (accRows.length === 0) return sendNotFound(res, 'Beneficiary account does not exist');

    // Check duplicate
    const [existing] = await db.query(
      'SELECT 1 FROM beneficiaries WHERE customer_id=? AND beneficiary_account=? LIMIT 1',
      [customerId, beneficiaryAccount]
    );
    if (existing.length > 0) return sendBadRequest(res, 'Beneficiary already added');

    const [result] = await db.query(
      `INSERT INTO beneficiaries (customer_id, beneficiary_account, beneficiary_name)
       VALUES (?, ?, ?)`,
      [customerId, beneficiaryAccount, beneficiaryName]
    );

    await logAudit(customerId, ACTIONS.BENEFICIARY_ADD,
      `Added beneficiary: ${beneficiaryAccount} (${beneficiaryName})`, req.ip);

    return sendCreated(res, {
      beneficiaryId:      result.insertId,
      beneficiaryAccount,
      beneficiaryName,
      verifiedName:       accRows[0].customerName,
    }, 'Beneficiary added successfully');
  } catch (err) {
    next(err);
  }
};

/** GET /customer/beneficiaries */
const getBeneficiaries = async (req, res, next) => {
  try {
    const customerId = req.user.AccNumber;
    const [rows] = await db.query(
      `SELECT b.*, c.customerName AS bankName
       FROM beneficiaries b
       LEFT JOIN Customer c ON c.AccountNumber = b.beneficiary_account
       WHERE b.customer_id=? ORDER BY b.created_at DESC`,
      [customerId]
    );
    return sendSuccess(res, { beneficiaries: rows });
  } catch (err) {
    next(err);
  }
};

/** DELETE /customer/beneficiaries/:id */
const removeBeneficiary = async (req, res, next) => {
  try {
    const customerId = req.user.AccNumber;
    const { id } = req.params;

    const [rows] = await db.query(
      'SELECT * FROM beneficiaries WHERE beneficiary_id=? AND customer_id=?', [id, customerId]
    );
    if (rows.length === 0) return sendNotFound(res, 'Beneficiary not found');

    await db.query('DELETE FROM beneficiaries WHERE beneficiary_id=?', [id]);
    await logAudit(customerId, ACTIONS.BENEFICIARY_REMOVE,
      `Removed beneficiary: ${rows[0].beneficiary_account}`, req.ip);

    return sendSuccess(res, {}, 'Beneficiary removed');
  } catch (err) {
    next(err);
  }
};

/** GET /customer/beneficiaries/validate/:account */
const validateBeneficiary = async (req, res, next) => {
  try {
    const { account } = req.params;
    const [rows] = await db.query(
      'SELECT customerName, AccountType FROM Customer WHERE AccountNumber=? LIMIT 1', [account]
    );
    if (rows.length === 0) return sendNotFound(res, 'Account not found');
    return sendSuccess(res, { accountExists: true, customerName: rows[0].customerName, accountType: rows[0].AccountType });
  } catch (err) {
    next(err);
  }
};

module.exports = { addBeneficiary, getBeneficiaries, removeBeneficiary, validateBeneficiary };
