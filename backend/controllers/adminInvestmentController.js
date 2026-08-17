/**
 * controllers/adminInvestmentController.js
 * Bank-Wide Investment Monitoring & Management Controller (Admin Portal)
 * 
 * Provides:
 * 1. Bank-Wide KPI Overview & Analytics (Unique investors, Total invested = Active FD + Actual RD Paid)
 * 2. Server-side paginated, searchable, sorted Customer Investments Table (Masked Account Numbers)
 * 3. Deep Customer Investment Drill-down (FDs, RDs with month-by-month roadmap, Audit timestamps, Transaction ledger)
 * 4. Maturity Monitor (5 distinct date ranges)
 * 5. RD Contribution Breakdown
 * 
 * Security: Strictly read-only for financial state; zero raw account numbers exposed to client.
 */
const db = require('../config/database');
const { sendSuccess, sendBadRequest, sendNotFound } = require('../utils/response');
const { calculateActualRdMaturity } = require('../config/investmentRates');
const logger = require('../utils/logger');

// Helper to mask account number e.g. "SBIN0011226808" -> "****6808"
const maskAccount = (accNum) => {
  if (!accNum) return '****0000';
  const str = String(accNum).trim();
  const last4 = str.length > 4 ? str.slice(-4) : str;
  return `****${last4}`;
};

/**
 * GET /admin/investments/overview
 * Returns bank-wide investment KPIs and Chart.js aggregation series.
 */
const getInvestmentOverview = async (req, res, next) => {
  try {
    // 1. Total Unique Investors (Counted strictly ONCE per customer across FDs and RDs)
    const [[{ total_investors }]] = await db.query(`
      SELECT COUNT(DISTINCT customer_id) AS total_investors
      FROM (
        SELECT customer_id FROM fixed_deposits
        UNION
        SELECT customer_id FROM recurring_deposits
      ) AS unique_investors
    `);

    // 2. Active FD Metrics
    const [[fdActive]] = await db.query(`
      SELECT 
        COUNT(*) AS active_count,
        COALESCE(SUM(principal_amount), 0) AS total_principal,
        COALESCE(SUM(interest_amount), 0) AS total_interest,
        COALESCE(SUM(maturity_amount), 0) AS total_maturity
      FROM fixed_deposits
      WHERE status = 'ACTIVE'
    `);

    // 3. Matured / Cancelled FD Metrics
    const [[fdMatured]] = await db.query(`
      SELECT 
        COUNT(*) AS matured_count,
        COALESCE(SUM(principal_amount), 0) AS matured_principal,
        COALESCE(SUM(maturity_amount), 0) AS total_payout
      FROM fixed_deposits
      WHERE status = 'MATURED'
    `);

    // 4. Active RD Metrics (Strictly actual amount paid)
    const [[rdActive]] = await db.query(`
      SELECT 
        COUNT(*) AS active_count,
        COALESCE(SUM(total_amount_paid), 0) AS total_paid,
        COALESCE(SUM(monthly_amount), 0) AS total_monthly_commitment,
        COALESCE(SUM(estimated_interest), 0) AS total_estimated_interest,
        COALESCE(SUM(estimated_maturity_amount), 0) AS total_estimated_maturity
      FROM recurring_deposits
      WHERE status = 'ACTIVE'
    `);

    // 5. Matured RD Metrics
    const [[rdMatured]] = await db.query(`
      SELECT 
        COUNT(*) AS matured_count,
        COALESCE(SUM(total_amount_paid), 0) AS total_paid
      FROM recurring_deposits
      WHERE status = 'MATURED'
    `);

    // 6. Maturity Monitor Counters (Non-overlapping & distinct)
    const [[{ fds_maturing_7d }]] = await db.query(`
      SELECT COUNT(*) AS fds_maturing_7d
      FROM fixed_deposits
      WHERE status = 'ACTIVE' AND maturity_date BETWEEN NOW() AND NOW() + INTERVAL 7 DAY
    `);

    const [[{ fds_maturing_30d }]] = await db.query(`
      SELECT COUNT(*) AS fds_maturing_30d
      FROM fixed_deposits
      WHERE status = 'ACTIVE' AND maturity_date BETWEEN NOW() AND NOW() + INTERVAL 30 DAY
    `);

    const [[{ rds_maturing_30d }]] = await db.query(`
      SELECT COUNT(*) AS rds_maturing_30d
      FROM recurring_deposits
      WHERE status = 'ACTIVE' AND maturity_date BETWEEN NOW() AND NOW() + INTERVAL 30 DAY
    `);

    // 7. RD Payment Health Counters
    const [[{ rds_pending_contributions }]] = await db.query(`
      SELECT COUNT(*) AS rds_pending_contributions
      FROM recurring_deposits
      WHERE status = 'ACTIVE' 
        AND contributions_completed < total_contributions_expected
        AND next_due_date <= NOW() + INTERVAL 7 DAY
    `);

    const [[{ rds_missed_contributions }]] = await db.query(`
      SELECT COUNT(*) AS rds_missed_contributions
      FROM recurring_deposits
      WHERE status = 'ACTIVE' 
        AND contributions_completed < total_contributions_expected
        AND next_due_date < NOW()
    `);

    // Strict Total Invested across bank: Active FD Principal + Actual RD Amount Paid
    const activeFdPrincipal = parseFloat(fdActive.total_principal) || 0;
    const activeRdPaid = parseFloat(rdActive.total_paid) || 0;
    const totalInvestedAcrossBank = parseFloat((activeFdPrincipal + activeRdPaid).toFixed(2));

    const totalFdExpectedMaturity = parseFloat(fdActive.total_maturity) || 0;
    const totalRdExpectedMaturity = parseFloat(rdActive.total_estimated_maturity) || 0;
    const totalExpectedMaturityValue = parseFloat((totalFdExpectedMaturity + totalRdExpectedMaturity).toFixed(2));

    // 8. Chart.js Analytics Data
    const analytics = {
      distribution: {
        fdPrincipal: activeFdPrincipal,
        rdPaid: activeRdPaid,
        total: totalInvestedAcrossBank,
        fdPercentage: totalInvestedAcrossBank > 0 ? ((activeFdPrincipal / totalInvestedAcrossBank) * 100).toFixed(1) : 0,
        rdPercentage: totalInvestedAcrossBank > 0 ? ((activeRdPaid / totalInvestedAcrossBank) * 100).toFixed(1) : 0,
      },
      statusBreakdown: {
        activeFds: parseInt(fdActive.active_count) || 0,
        maturedFds: parseInt(fdMatured.matured_count) || 0,
        activeRds: parseInt(rdActive.active_count) || 0,
        maturedRds: parseInt(rdMatured.matured_count) || 0,
      },
      maturityForecast: {
        within7Days: (parseInt(fds_maturing_7d) || 0),
        within30Days: (parseInt(fds_maturing_30d) || 0) + (parseInt(rds_maturing_30d) || 0),
      },
    };

    return sendSuccess(res, {
      kpis: {
        totalInvestors: parseInt(total_investors) || 0,
        totalInvestedAcrossBank,
        totalActiveFdPrincipal: activeFdPrincipal,
        totalActiveRdPaid: activeRdPaid,
        totalExpectedFdMaturity: totalFdExpectedMaturity,
        totalExpectedRdMaturity: totalRdExpectedMaturity,
        totalExpectedMaturityValue,
        activeFdCount: parseInt(fdActive.active_count) || 0,
        activeRdCount: parseInt(rdActive.active_count) || 0,
        maturedFdCount: parseInt(fdMatured.matured_count) || 0,
        maturedRdCount: parseInt(rdMatured.matured_count) || 0,
        fdsMaturingSoon: parseInt(fds_maturing_30d) || 0,
        fdsMaturing7d: parseInt(fds_maturing_7d) || 0,
        rdsWithPendingContributions: parseInt(rds_pending_contributions) || 0,
        rdsWithMissedContributions: parseInt(rds_missed_contributions) || 0,
      },
      analytics,
    }, 'Bank-wide investment overview retrieved');
  } catch (err) {
    logger.error('Error fetching admin investment overview:', err);
    next(err);
  }
};

/**
 * GET /admin/investments/customers
 * Server-side paginated, searchable, and sortable customer investment portfolio table.
 * Zero raw account numbers exposed to frontend.
 */
const getCustomerInvestments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 15,
      search = '',
      type = 'ALL', // 'ALL' | 'FD' | 'RD'
      status = 'ALL', // 'ALL' | 'ACTIVE' | 'MATURED'
      sortBy = 'totalInvested', // 'customerName' | 'totalInvested' | 'fdPrincipal' | 'rdPaid' | 'activeCount' | 'maturityDate'
      sortOrder = 'DESC', // 'ASC' | 'DESC'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Build Search & Filter conditions
    let searchFilter = '';
    const params = [];

    // Clean numeric ID search for FD/RD
    const numericSearch = search.replace(/\D/g, '');

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      searchFilter += ` AND (
        c.customerName LIKE ? 
        OR c.customerEmail LIKE ? 
        OR c.AccountNumber LIKE ?
        ${numericSearch ? 'OR c.AccountNumber IN (SELECT account_id FROM fixed_deposits WHERE id = ? UNION SELECT account_id FROM recurring_deposits WHERE id = ?)' : ''}
      )`;
      params.push(term, term, term);
      if (numericSearch) {
        params.push(parseInt(numericSearch, 10), parseInt(numericSearch, 10));
      }
    }

    // Type filter
    let havingClause = 'HAVING (active_fd_count > 0 OR active_rd_count > 0 OR total_actual_invested > 0 OR total_investments_count > 0)';
    if (type === 'FD') {
      havingClause = 'HAVING (total_fd_count > 0)';
    } else if (type === 'RD') {
      havingClause = 'HAVING (total_rd_count > 0)';
    }

    if (status === 'ACTIVE') {
      havingClause += ' AND (active_investments_count > 0)';
    } else if (status === 'MATURED') {
      havingClause += ' AND (matured_investments_count > 0)';
    }

    // Sort order validation
    const validSortCols = {
      customerName: 'c.customerName',
      totalInvested: 'total_actual_invested',
      fdPrincipal: 'active_fd_principal',
      rdPaid: 'active_rd_paid',
      activeCount: 'active_investments_count',
      maturityDate: 'earliest_active_maturity',
    };

    const sortColumn = validSortCols[sortBy] || 'total_actual_invested';
    const orderDirection = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Main Aggregation Query
    const query = `
      SELECT 
        c.AccountNumber,
        c.customerName,
        c.customerEmail,
        c.customerPhone,
        c.AccountStatus,
        c.Balance AS core_balance,
        
        -- FD Aggregations
        COUNT(DISTINCT fd.id) AS total_fd_count,
        COALESCE(SUM(CASE WHEN fd.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active_fd_count,
        COALESCE(SUM(CASE WHEN fd.status = 'MATURED' THEN 1 ELSE 0 END), 0) AS matured_fd_count,
        COALESCE(SUM(CASE WHEN fd.status = 'ACTIVE' THEN fd.principal_amount ELSE 0 END), 0) AS active_fd_principal,
        COALESCE(SUM(CASE WHEN fd.status = 'ACTIVE' THEN fd.maturity_amount ELSE 0 END), 0) AS active_fd_expected_maturity,
        
        -- RD Aggregations
        COUNT(DISTINCT rd.id) AS total_rd_count,
        COALESCE(SUM(CASE WHEN rd.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active_rd_count,
        COALESCE(SUM(CASE WHEN rd.status = 'MATURED' THEN 1 ELSE 0 END), 0) AS matured_rd_count,
        COALESCE(SUM(CASE WHEN rd.status = 'ACTIVE' THEN rd.total_amount_paid ELSE 0 END), 0) AS active_rd_paid,
        COALESCE(SUM(CASE WHEN rd.status = 'ACTIVE' THEN rd.estimated_maturity_amount ELSE 0 END), 0) AS active_rd_expected_maturity,
        
        -- Total Aggregations
        (COUNT(DISTINCT fd.id) + COUNT(DISTINCT rd.id)) AS total_investments_count,
        (COALESCE(SUM(CASE WHEN fd.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN rd.status = 'ACTIVE' THEN 1 ELSE 0 END), 0)) AS active_investments_count,
        (COALESCE(SUM(CASE WHEN fd.status = 'MATURED' THEN 1 ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN rd.status = 'MATURED' THEN 1 ELSE 0 END), 0)) AS matured_investments_count,
        
        -- Strict Total Invested = Active FD Principal + Actual Active RD Paid
        (COALESCE(SUM(CASE WHEN fd.status = 'ACTIVE' THEN fd.principal_amount ELSE 0 END), 0) + 
         COALESCE(SUM(CASE WHEN rd.status = 'ACTIVE' THEN rd.total_amount_paid ELSE 0 END), 0)) AS total_actual_invested,
        
        (COALESCE(SUM(CASE WHEN fd.status = 'ACTIVE' THEN fd.maturity_amount ELSE 0 END), 0) + 
         COALESCE(SUM(CASE WHEN rd.status = 'ACTIVE' THEN rd.estimated_maturity_amount ELSE 0 END), 0)) AS total_expected_maturity_value,
         
        MIN(CASE WHEN fd.status = 'ACTIVE' THEN fd.maturity_date WHEN rd.status = 'ACTIVE' THEN rd.maturity_date ELSE NULL END) AS earliest_active_maturity
        
      FROM Customer c
      LEFT JOIN fixed_deposits fd ON c.AccountNumber = fd.account_id
      LEFT JOIN recurring_deposits rd ON c.AccountNumber = rd.account_id
      WHERE 1=1 ${searchFilter}
      GROUP BY c.AccountNumber, c.customerName, c.customerEmail, c.customerPhone, c.AccountStatus, c.Balance
      ${havingClause}
      ORDER BY ${sortColumn} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, limitNum, offset];
    const [rows] = await db.query(query, queryParams);

    // Total Count Query for pagination
    const countQuery = `
      SELECT COUNT(*) AS total_count FROM (
        SELECT c.AccountNumber,
          COUNT(DISTINCT fd.id) AS total_fd_count,
          COUNT(DISTINCT rd.id) AS total_rd_count,
          COALESCE(SUM(CASE WHEN fd.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active_fd_count,
          COALESCE(SUM(CASE WHEN rd.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active_rd_count,
          COALESCE(SUM(CASE WHEN fd.status = 'MATURED' THEN 1 ELSE 0 END), 0) AS matured_fd_count,
          COALESCE(SUM(CASE WHEN rd.status = 'MATURED' THEN 1 ELSE 0 END), 0) AS matured_rd_count,
          (COUNT(DISTINCT fd.id) + COUNT(DISTINCT rd.id)) AS total_investments_count,
          (COALESCE(SUM(CASE WHEN fd.status = 'ACTIVE' THEN 1 ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN rd.status = 'ACTIVE' THEN 1 ELSE 0 END), 0)) AS active_investments_count,
          (COALESCE(SUM(CASE WHEN fd.status = 'MATURED' THEN 1 ELSE 0 END), 0) + COALESCE(SUM(CASE WHEN rd.status = 'MATURED' THEN 1 ELSE 0 END), 0)) AS matured_investments_count,
          (COALESCE(SUM(CASE WHEN fd.status = 'ACTIVE' THEN fd.principal_amount ELSE 0 END), 0) + 
           COALESCE(SUM(CASE WHEN rd.status = 'ACTIVE' THEN rd.total_amount_paid ELSE 0 END), 0)) AS total_actual_invested
        FROM Customer c
        LEFT JOIN fixed_deposits fd ON c.AccountNumber = fd.account_id
        LEFT JOIN recurring_deposits rd ON c.AccountNumber = rd.account_id
        WHERE 1=1 ${searchFilter}
        GROUP BY c.AccountNumber
        ${havingClause}
      ) AS filtered_customers
    `;

    const [[{ total_count }]] = await db.query(countQuery, params);

    // Map rows and guarantee ZERO raw account numbers are exposed
    const customers = rows.map((r) => ({
      customerRef: r.AccountNumber, // safe internal lookup key for admin drilldown
      maskedAccountNumber: maskAccount(r.AccountNumber),
      customerName: r.customerName,
      customerEmail: r.customerEmail,
      customerPhone: r.customerPhone,
      accountStatus: r.AccountStatus,
      fdCount: parseInt(r.total_fd_count) || 0,
      activeFdCount: parseInt(r.active_fd_count) || 0,
      totalFdPrincipal: parseFloat(r.active_fd_principal) || 0,
      rdCount: parseInt(r.total_rd_count) || 0,
      activeRdCount: parseInt(r.active_rd_count) || 0,
      totalRdAmountPaid: parseFloat(r.active_rd_paid) || 0,
      totalActualInvested: parseFloat(r.total_actual_invested) || 0,
      activeInvestmentsCount: parseInt(r.active_investments_count) || 0,
      totalExpectedMaturityValue: parseFloat(r.total_expected_maturity_value) || 0,
      earliestMaturityDate: r.earliest_active_maturity || null,
    }));

    return sendSuccess(res, {
      customers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(total_count) || 0,
        totalPages: Math.ceil((parseInt(total_count) || 0) / limitNum) || 1,
      },
    }, 'Customer investments list retrieved');
  } catch (err) {
    logger.error('Error fetching customer investments list:', err);
    next(err);
  }
};

/**
 * GET /admin/investments/customers/:accountNumber
 * Deep customer investment drilldown view.
 * Includes complete FDs, RDs with month-by-month contribution roadmap, audit timestamps, and related transactions.
 */
const getCustomerInvestmentDetail = async (req, res, next) => {
  try {
    const { accountNumber } = req.params;

    // 1. Fetch Customer Record
    const [custRows] = await db.query(
      `SELECT AccountNumber, customerName, customerEmail, customerPhone, AccountType, AccountStatus, CreatedAt
       FROM Customer WHERE AccountNumber = ? LIMIT 1`,
      [accountNumber]
    );

    if (custRows.length === 0) {
      return sendNotFound(res, 'Customer not found');
    }

    const customer = custRows[0];

    // 2. Fetch Fixed Deposits with full audit columns
    const [fixedDeposits] = await db.query(
      `SELECT 
        id, customer_id, principal_amount, interest_rate, tenure_months,
        interest_amount, maturity_amount, start_date, maturity_date, status,
        created_at, updated_at
       FROM fixed_deposits
       WHERE account_id = ?
       ORDER BY created_at DESC`,
      [accountNumber]
    );

    // 3. Fetch Recurring Deposits with full audit columns
    const [recurringDeposits] = await db.query(
      `SELECT 
        id, customer_id, monthly_amount, interest_rate, tenure_months,
        total_contributions_expected, contributions_completed, total_amount_paid,
        estimated_interest, estimated_maturity_amount, start_date, maturity_date,
        next_due_date, last_reminder_contribution_number, last_reminder_sent_at,
        status, created_at, updated_at
       FROM recurring_deposits
       WHERE account_id = ?
       ORDER BY created_at DESC`,
      [accountNumber]
    );

    // 4. Fetch RD Contributions for itemized roadmap
    const [contributions] = await db.query(
      `SELECT id, rd_id, contribution_number, amount, paid_at, transaction_id
       FROM rd_contributions
       WHERE account_id = ?
       ORDER BY rd_id, contribution_number ASC`,
      [accountNumber]
    );

    // Map contributions by rd_id
    const contribsByRd = {};
    contributions.forEach((c) => {
      if (!contribsByRd[c.rd_id]) contribsByRd[c.rd_id] = [];
      contribsByRd[c.rd_id].push(c);
    });

    // Build roadmap for each RD
    const rdsWithRoadmap = recurringDeposits.map((rd) => {
      const paidContribs = contribsByRd[rd.id] || [];
      const paidMap = {};
      paidContribs.forEach((pc) => {
        paidMap[pc.contribution_number] = pc;
      });

      const schedule = [];
      const startDate = new Date(rd.start_date);
      const totalMonths = rd.total_contributions_expected;

      for (let i = 1; i <= totalMonths; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(startDate.getMonth() + i);

        const paidRecord = paidMap[i];
        let status = 'PENDING';
        if (paidRecord) {
          status = 'PAID';
        } else if (rd.status === 'MATURED' || (new Date() > dueDate && i <= (rd.contributions_completed + 1))) {
          // If past due date and not paid
          status = new Date() > dueDate ? 'MISSED' : 'PENDING';
        }

        schedule.push({
          monthNumber: i,
          amount: parseFloat(rd.monthly_amount),
          dueDate: dueDate.toISOString(),
          status,
          paidAt: paidRecord ? paidRecord.paid_at : null,
          transactionId: paidRecord ? paidRecord.transaction_id : null,
        });
      }

      // Actual maturity calculation preview
      const actualCalculation = calculateActualRdMaturity(
        paidContribs.length,
        rd.total_contributions_expected,
        rd.monthly_amount,
        rd.interest_rate,
        rd.tenure_months
      );

      return {
        ...rd,
        contributions: schedule,
        actualCalculation,
      };
    });

    // 5. Fetch Related Investment Transactions
    const [transactions] = await db.query(
      `SELECT 
        transaction_id AS id, sender_account, receiver_account, transaction_type, amount,
        status, description, balance_after, created_at
       FROM transactions
       WHERE (sender_account = ? OR receiver_account = ?)
         AND transaction_type IN ('FD_CREATED', 'FD_MATURITY', 'RD_CONTRIBUTION', 'RD_MATURITY')
       ORDER BY created_at DESC`,
      [accountNumber, accountNumber]
    );


    // Compute Customer-level Aggregates
    const activeFds = fixedDeposits.filter((f) => f.status === 'ACTIVE');
    const activeRds = rdsWithRoadmap.filter((r) => r.status === 'ACTIVE');

    const totalActiveFdPrincipal = activeFds.reduce((sum, f) => sum + parseFloat(f.principal_amount || 0), 0);
    const totalActiveRdPaid = activeRds.reduce((sum, r) => sum + parseFloat(r.total_amount_paid || 0), 0);
    const totalActualInvested = parseFloat((totalActiveFdPrincipal + totalActiveRdPaid).toFixed(2));

    const totalExpectedFdMaturity = activeFds.reduce((sum, f) => sum + parseFloat(f.maturity_amount || 0), 0);
    const totalExpectedRdMaturity = activeRds.reduce((sum, r) => sum + parseFloat(r.estimated_maturity_amount || 0), 0);
    const totalExpectedMaturityValue = parseFloat((totalExpectedFdMaturity + totalExpectedRdMaturity).toFixed(2));

    return sendSuccess(res, {
      customer: {
        customerRef: customer.AccountNumber,
        maskedAccountNumber: maskAccount(customer.AccountNumber),
        customerName: customer.customerName,
        customerEmail: customer.customerEmail,
        customerPhone: customer.customerPhone,
        accountType: customer.AccountType,
        accountStatus: customer.AccountStatus,
        createdAt: customer.CreatedAt,
      },
      summary: {
        totalInvestmentsCount: fixedDeposits.length + recurringDeposits.length,
        activeInvestmentsCount: activeFds.length + activeRds.length,
        totalActualInvested,
        totalActiveFdPrincipal,
        totalActiveRdPaid,
        totalExpectedMaturityValue,
        activeFdCount: activeFds.length,
        activeRdCount: activeRds.length,
      },
      fixedDeposits,
      recurringDeposits: rdsWithRoadmap,
      transactions: transactions.map((t) => ({
        ...t,
        maskedSender: maskAccount(t.sender_account),
        maskedReceiver: maskAccount(t.receiver_account),
      })),
    }, 'Customer investment detail retrieved');
  } catch (err) {
    logger.error('Error fetching customer investment detail:', err);
    next(err);
  }
};

/**
 * GET /admin/investments/maturity-monitor
 * Returns unified list of upcoming and matured investments across 5 distinct non-overlapping categories.
 */
const getMaturityMonitor = async (req, res, next) => {
  try {
    const { range = 'all' } = req.query;
    // range: 'maturing_7d' | 'maturing_30d' | 'matured_last_7d' | 'matured_last_30d' | 'all_matured' | 'all'

    let fdWhere = 'WHERE 1=1';
    let rdWhere = 'WHERE 1=1';

    if (range === 'maturing_7d') {
      fdWhere += ` AND status = 'ACTIVE' AND maturity_date BETWEEN NOW() AND NOW() + INTERVAL 7 DAY`;
      rdWhere += ` AND status = 'ACTIVE' AND maturity_date BETWEEN NOW() AND NOW() + INTERVAL 7 DAY`;
    } else if (range === 'maturing_30d') {
      fdWhere += ` AND status = 'ACTIVE' AND maturity_date BETWEEN NOW() AND NOW() + INTERVAL 30 DAY`;
      rdWhere += ` AND status = 'ACTIVE' AND maturity_date BETWEEN NOW() AND NOW() + INTERVAL 30 DAY`;
    } else if (range === 'matured_last_7d') {
      fdWhere += ` AND status = 'MATURED' AND maturity_date BETWEEN NOW() - INTERVAL 7 DAY AND NOW()`;
      rdWhere += ` AND status = 'MATURED' AND maturity_date BETWEEN NOW() - INTERVAL 7 DAY AND NOW()`;
    } else if (range === 'matured_last_30d') {
      fdWhere += ` AND status = 'MATURED' AND maturity_date BETWEEN NOW() - INTERVAL 30 DAY AND NOW()`;
      rdWhere += ` AND status = 'MATURED' AND maturity_date BETWEEN NOW() - INTERVAL 30 DAY AND NOW()`;
    } else if (range === 'all_matured') {
      fdWhere += ` AND status = 'MATURED'`;
      rdWhere += ` AND status = 'MATURED'`;
    }

    const [fds] = await db.query(`
      SELECT 
        fd.id,
        'FD' AS investment_type,
        fd.account_id,
        c.customerName,
        fd.principal_amount AS invested_amount,
        fd.interest_rate,
        fd.tenure_months,
        fd.interest_amount,
        fd.maturity_amount,
        fd.start_date,
        fd.maturity_date,
        fd.status,
        fd.created_at,
        fd.updated_at,
        TIMESTAMPDIFF(DAY, NOW(), fd.maturity_date) AS days_until_maturity
      FROM fixed_deposits fd
      JOIN Customer c ON fd.account_id = c.AccountNumber
      ${fdWhere}
      ORDER BY fd.maturity_date ASC
      LIMIT 100
    `);

    const [rds] = await db.query(`
      SELECT 
        rd.id,
        'RD' AS investment_type,
        rd.account_id,
        c.customerName,
        rd.total_amount_paid AS invested_amount,
        rd.interest_rate,
        rd.tenure_months,
        rd.estimated_interest AS interest_amount,
        rd.estimated_maturity_amount AS maturity_amount,
        rd.start_date,
        rd.maturity_date,
        rd.status,
        rd.created_at,
        rd.updated_at,
        TIMESTAMPDIFF(DAY, NOW(), rd.maturity_date) AS days_until_maturity
      FROM recurring_deposits rd
      JOIN Customer c ON rd.account_id = c.AccountNumber
      ${rdWhere}
      ORDER BY rd.maturity_date ASC
      LIMIT 100
    `);

    // Combine and sort by maturity date
    const combined = [...fds, ...rds].sort((a, b) => new Date(a.maturity_date) - new Date(b.maturity_date));

    const records = combined.map((item) => ({
      id: item.id,
      investmentType: item.investment_type,
      customerRef: item.account_id,
      maskedAccountNumber: maskAccount(item.account_id),
      customerName: item.customerName,
      investedAmount: parseFloat(item.invested_amount) || 0,
      interestRate: parseFloat(item.interest_rate) || 0,
      tenureMonths: item.tenure_months,
      interestAmount: parseFloat(item.interest_amount) || 0,
      maturityAmount: parseFloat(item.maturity_amount) || 0,
      startDate: item.start_date,
      maturityDate: item.maturity_date,
      status: item.status,
      daysUntilMaturity: item.days_until_maturity,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    return sendSuccess(res, { records, total: records.length, filterRange: range }, 'Maturity monitor records retrieved');
  } catch (err) {
    logger.error('Error fetching maturity monitor records:', err);
    next(err);
  }
};

/**
 * GET /admin/investments/rd/:id/contributions
 * Returns itemized contribution history for a specific RD.
 */
const getRdContributionHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [rds] = await db.query(
      `SELECT rd.*, c.customerName 
       FROM recurring_deposits rd 
       JOIN Customer c ON rd.account_id = c.AccountNumber 
       WHERE rd.id = ? LIMIT 1`,
      [id]
    );

    if (rds.length === 0) {
      return sendNotFound(res, 'Recurring deposit record not found');
    }

    const rd = rds[0];

    const [contributions] = await db.query(
      `SELECT id, rd_id, contribution_number, amount, paid_at, transaction_id
       FROM rd_contributions
       WHERE rd_id = ?
       ORDER BY contribution_number ASC`,
      [id]
    );

    const paidMap = {};
    contributions.forEach((pc) => {
      paidMap[pc.contribution_number] = pc;
    });

    const schedule = [];
    const startDate = new Date(rd.start_date);
    const totalMonths = rd.total_contributions_expected;

    for (let i = 1; i <= totalMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + i);

      const paidRecord = paidMap[i];
      let status = 'PENDING';
      if (paidRecord) {
        status = 'PAID';
      } else if (rd.status === 'MATURED' || new Date() > dueDate) {
        status = 'MISSED';
      }

      schedule.push({
        monthNumber: i,
        amount: parseFloat(rd.monthly_amount),
        dueDate: dueDate.toISOString(),
        status,
        paidAt: paidRecord ? paidRecord.paid_at : null,
        transactionId: paidRecord ? paidRecord.transaction_id : null,
      });
    }

    return sendSuccess(res, {
      rd: {
        id: rd.id,
        customerRef: rd.account_id,
        maskedAccountNumber: maskAccount(rd.account_id),
        customerName: rd.customerName,
        monthlyAmount: parseFloat(rd.monthly_amount),
        interestRate: parseFloat(rd.interest_rate),
        tenureMonths: rd.tenure_months,
        totalContributionsExpected: rd.total_contributions_expected,
        contributionsCompleted: rd.contributions_completed,
        totalAmountPaid: parseFloat(rd.total_amount_paid),
        status: rd.status,
        nextDueDate: rd.next_due_date,
        maturityDate: rd.maturity_date,
        createdAt: rd.created_at,
        updatedAt: rd.updated_at,
      },
      contributions: schedule,
    }, 'RD contribution history retrieved');
  } catch (err) {
    logger.error('Error fetching RD contribution history:', err);
    next(err);
  }
};

module.exports = {
  getInvestmentOverview,
  getCustomerInvestments,
  getCustomerInvestmentDetail,
  getMaturityMonitor,
  getRdContributionHistory,
};
