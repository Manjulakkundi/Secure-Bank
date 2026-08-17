/**
 * migrations/001_investments.js
 * Migration to create tables for Fixed Deposits, Recurring Deposits, and RD Contributions.
 */
const db = require('../config/database');

async function migrate() {
  const conn = await db.getConnection();
  try {
    console.log('Running database migrations for Investments...');

    // 1. Update transactions.transaction_type to VARCHAR(30)
    try {
      await conn.query(`ALTER TABLE transactions MODIFY COLUMN transaction_type VARCHAR(30) NOT NULL`);
      console.log('✓ Updated transactions.transaction_type to VARCHAR(30)');
    } catch (e) {
      console.log('• Note on transactions alter:', e.message);
    }

    // 2. Create fixed_deposits table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS fixed_deposits (
        id INT PRIMARY KEY AUTO_INCREMENT,
        customer_id VARCHAR(14) NOT NULL,
        account_id VARCHAR(14) NOT NULL,
        principal_amount DECIMAL(20,2) NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL,
        tenure_months INT NOT NULL,
        interest_amount DECIMAL(20,2) NOT NULL,
        maturity_amount DECIMAL(20,2) NOT NULL,
        start_date DATETIME NOT NULL,
        maturity_date DATETIME NOT NULL,
        status ENUM('ACTIVE','MATURED','CANCELLED') DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES Customer(AccountNumber) ON DELETE CASCADE,
        INDEX idx_fd_account (account_id),
        INDEX idx_fd_status (status),
        INDEX idx_fd_maturity (maturity_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ Created table fixed_deposits');

    // 3. Create recurring_deposits table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS recurring_deposits (
        id INT PRIMARY KEY AUTO_INCREMENT,
        customer_id VARCHAR(14) NOT NULL,
        account_id VARCHAR(14) NOT NULL,
        monthly_amount DECIMAL(20,2) NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL,
        tenure_months INT NOT NULL,
        total_contributions_expected INT NOT NULL,
        contributions_completed INT DEFAULT 0,
        total_amount_paid DECIMAL(20,2) DEFAULT 0.00,
        estimated_interest DECIMAL(20,2) NOT NULL,
        estimated_maturity_amount DECIMAL(20,2) NOT NULL,
        start_date DATETIME NOT NULL,
        maturity_date DATETIME NOT NULL,
        next_due_date DATETIME NOT NULL,
        last_reminder_contribution_number INT DEFAULT 0,
        last_reminder_sent_at DATETIME NULL,
        status ENUM('ACTIVE','MATURED','CANCELLED') DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES Customer(AccountNumber) ON DELETE CASCADE,
        INDEX idx_rd_account (account_id),
        INDEX idx_rd_status (status),
        INDEX idx_rd_maturity (maturity_date),
        INDEX idx_rd_due (next_due_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ Created table recurring_deposits');

    // 4. Create rd_contributions table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS rd_contributions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        rd_id INT NOT NULL,
        customer_id VARCHAR(14) NOT NULL,
        account_id VARCHAR(14) NOT NULL,
        contribution_number INT NOT NULL,
        amount DECIMAL(20,2) NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        transaction_id BIGINT NULL,
        FOREIGN KEY (rd_id) REFERENCES recurring_deposits(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES Customer(AccountNumber) ON DELETE CASCADE,
        UNIQUE KEY unique_rd_contribution (rd_id, contribution_number),
        INDEX idx_rd_contrib (rd_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ Created table rd_contributions');

    console.log('✅ Investments migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
