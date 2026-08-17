/**
 * routes/adminRoutes.js
 * All admin API routes — all protected by verifyAdmin middleware.
 */
const { Router } = require('express');
const router = Router();
const { verifyAdmin } = require('../middleware/auth');
const { validateDeposit, validateAdminLogin, validateAdminWithdraw } = require('../middleware/validate');
const { body } = require('express-validator');
const { handleValidation } = require('../middleware/validate');
const adminCtrl = require('../controllers/adminController');
const investAdminCtrl = require('../controllers/adminInvestmentController');

// ─── Admin Auth (Public) ──────────────────────────────────────────────────────
router.post('/login', validateAdminLogin, adminCtrl.adminLogin);

// All routes below require admin JWT
router.use(verifyAdmin);

// ─── Stats & Dashboard ────────────────────────────────────────────────────────
router.get('/stats',                    adminCtrl.getStats);

// ─── Bank-Wide Investments (Admin Monitoring & Analytics) ─────────────────────
router.get('/investments/overview',                    investAdminCtrl.getInvestmentOverview);
router.get('/investments/customers',                   investAdminCtrl.getCustomerInvestments);
router.get('/investments/customers/:accountNumber',    investAdminCtrl.getCustomerInvestmentDetail);
router.get('/investments/maturity-monitor',            investAdminCtrl.getMaturityMonitor);
router.get('/investments/rd/:id/contributions',        investAdminCtrl.getRdContributionHistory);

// ─── Customer Management ──────────────────────────────────────────────────────
router.get('/customers',                adminCtrl.getAllCustomers);
router.get('/customers/:accountNumber', adminCtrl.getCustomerDetail);
router.post('/customers/:accountNumber/freeze',   adminCtrl.freezeAccount);
router.post('/customers/:accountNumber/unfreeze', adminCtrl.unfreezeAccount);
router.post('/verify-customer',         adminCtrl.verifyCustomer);

// ─── Deposits ─────────────────────────────────────────────────────────────────
router.post('/deposit', validateDeposit, adminCtrl.depositMoney);

// ─── Withdrawals ──────────────────────────────────────────────────────────────
router.post('/withdraw', validateAdminWithdraw, adminCtrl.withdrawMoney);

// ─── Loans ────────────────────────────────────────────────────────────────────
router.get('/loans',                    adminCtrl.getAllLoans);
router.post('/loans/:loanId/approve',
  [body('approvalStatus').isIn(['Approved', 'Denied']), handleValidation],
  adminCtrl.approveLoan);

// ─── Transactions ─────────────────────────────────────────────────────────────
router.get('/transactions',             adminCtrl.getAllTransactions);

// ─── Fraud Alerts ─────────────────────────────────────────────────────────────
router.get('/fraud-alerts',             adminCtrl.getFraudAlerts);
router.post('/fraud-alerts/:alertId/resolve',
  [body('status').isIn(['REVIEWED', 'RESOLVED']), handleValidation],
  adminCtrl.resolveFraudAlert);

// ─── Audit Logs ───────────────────────────────────────────────────────────────
router.get('/audit-logs',               adminCtrl.getAuditLogs);
router.get('/audit-logs/export',        adminCtrl.exportAuditLogs);

module.exports = router;

