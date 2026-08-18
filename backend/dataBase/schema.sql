-- =============================================================================
-- SecureBank — Complete Database Schema v2.0
-- Run this to set up a fresh database.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS bank CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bank;

-- ─── Customer ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Customer (
  AccountNumber  VARCHAR(14)  PRIMARY KEY,
  customerName   VARCHAR(150) NOT NULL,
  AccountType    ENUM('Savings','Current') NOT NULL,
  customerPhone  VARCHAR(12)  UNIQUE NOT NULL,
  customerEmail  VARCHAR(100) UNIQUE NOT NULL,
  customerAddress VARCHAR(200),
  customerCity   VARCHAR(100),
  CustomerPassword VARCHAR(200) NOT NULL,
  Balance        DECIMAL(20,2) DEFAULT 0.00,
  AccountVerify  TINYINT(1)   DEFAULT 0,
  AccountStatus  ENUM('Active','Frozen','Closed') DEFAULT 'Active',
  CreatedAt      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email  (customerEmail),
  INDEX idx_phone  (customerPhone),
  INDEX idx_status (AccountStatus)
);

-- ─── Admins ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id            INT          PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  email         VARCHAR(100),
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Seed default admin (password: Admin@123)
-- Generate with: node -e "require('bcryptjs').hash('Admin@123',12).then(console.log)"
INSERT IGNORE INTO admins (username, password_hash, email) VALUES
  ('admin', '$2a$12$uKPdXZWSRp35ZqfzUyn94Oj3LhmAyJJPeI9YMFxlI5Bs4paAJUs7K', 'admin@securebank.com');

-- ─── Transactions (unified table — replaces WithdrawHistory + TransferMoney) ──
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id  BIGINT       PRIMARY KEY AUTO_INCREMENT,
  sender_account  VARCHAR(14),
  receiver_account VARCHAR(14),
  transaction_type VARCHAR(30) NOT NULL,
  amount          DECIMAL(20,2) NOT NULL,


  status          ENUM('SUCCESS','FAILED','PENDING') DEFAULT 'SUCCESS',
  description     VARCHAR(255),
  balance_after   DECIMAL(20,2),
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sender   (sender_account),
  INDEX idx_receiver (receiver_account),
  INDEX idx_type     (transaction_type),
  INDEX idx_date     (created_at)
);

-- ─── Loan ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Loan (
  LoanID              INT          PRIMARY KEY AUTO_INCREMENT,
  AccountNumber       VARCHAR(14),
  LoanAmount          DECIMAL(20,2),
  LoanInterest        DECIMAL(5,2),
  ApprovalStatus      ENUM('Pending','Approved','Denied') DEFAULT 'Pending',
  LoanDurationMonths  INT,
  TotalPayableAmount  DECIMAL(20,2) DEFAULT 0.00,
  AppliedDate         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  ApprovalDate        TIMESTAMP    NULL,
  FOREIGN KEY (AccountNumber) REFERENCES Customer(AccountNumber) ON DELETE CASCADE,
  INDEX idx_loan_account (AccountNumber),
  INDEX idx_loan_status  (ApprovalStatus)
);

-- ─── OTP Verifications ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_verifications (
  id         INT          PRIMARY KEY AUTO_INCREMENT,
  email      VARCHAR(100) NOT NULL,
  otp_hash   VARCHAR(200) NOT NULL,
  purpose    ENUM('SIGNUP','PASSWORD_RESET') NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  used       TINYINT(1)   DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_email_purpose (email, purpose),
  INDEX idx_otp_email (email)
);

-- ─── Beneficiaries ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beneficiaries (
  beneficiary_id      INT          PRIMARY KEY AUTO_INCREMENT,
  customer_id         VARCHAR(14)  NOT NULL,
  beneficiary_account VARCHAR(14)  NOT NULL,
  beneficiary_name    VARCHAR(150) NOT NULL,
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_beneficiary (customer_id, beneficiary_account),
  FOREIGN KEY (customer_id)         REFERENCES Customer(AccountNumber) ON DELETE CASCADE,
  FOREIGN KEY (beneficiary_account) REFERENCES Customer(AccountNumber) ON DELETE CASCADE,
  INDEX idx_bene_customer (customer_id)
);

-- ─── Fraud Alerts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_alerts (
  alert_id       INT          PRIMARY KEY AUTO_INCREMENT,
  transaction_id BIGINT,
  account_id     VARCHAR(14),
  risk_score     INT          NOT NULL DEFAULT 0,
  fraud_reason   TEXT,
  status         ENUM('PENDING','REVIEWED','RESOLVED') DEFAULT 'PENDING',
  resolved_at    TIMESTAMP    NULL,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE SET NULL,
  INDEX idx_fraud_account (account_id),
  INDEX idx_fraud_status  (status),
  INDEX idx_fraud_score   (risk_score)
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id      BIGINT       PRIMARY KEY AUTO_INCREMENT,
  user_id     VARCHAR(100) NOT NULL,
  action      VARCHAR(50)  NOT NULL,
  description TEXT,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user   (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_date   (created_at)
);

-- ─── Fixed Deposits ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_deposits (
  id               INT          PRIMARY KEY AUTO_INCREMENT,
  customer_id      VARCHAR(14)  NOT NULL,
  account_id       VARCHAR(14)  NOT NULL,
  principal_amount DECIMAL(20,2) NOT NULL,
  interest_rate    DECIMAL(5,2) NOT NULL,
  tenure_months    INT          NOT NULL,
  interest_amount  DECIMAL(20,2) NOT NULL,
  maturity_amount  DECIMAL(20,2) NOT NULL,
  start_date       DATETIME     NOT NULL,
  maturity_date    DATETIME     NOT NULL,
  status           ENUM('ACTIVE','MATURED','CANCELLED') DEFAULT 'ACTIVE',
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES Customer(AccountNumber) ON DELETE CASCADE,
  INDEX idx_fd_account  (account_id),
  INDEX idx_fd_status   (status),
  INDEX idx_fd_maturity (maturity_date)
);

-- ─── Recurring Deposits ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_deposits (
  id                                INT          PRIMARY KEY AUTO_INCREMENT,
  customer_id                       VARCHAR(14)  NOT NULL,
  account_id                        VARCHAR(14)  NOT NULL,
  monthly_amount                    DECIMAL(20,2) NOT NULL,
  interest_rate                     DECIMAL(5,2) NOT NULL,
  tenure_months                     INT          NOT NULL,
  total_contributions_expected      INT          NOT NULL,
  contributions_completed           INT          DEFAULT 0,
  total_amount_paid                 DECIMAL(20,2) DEFAULT 0.00,
  estimated_interest                DECIMAL(20,2) NOT NULL,
  estimated_maturity_amount         DECIMAL(20,2) NOT NULL,
  start_date                        DATETIME     NOT NULL,
  maturity_date                     DATETIME     NOT NULL,
  next_due_date                     DATETIME     NOT NULL,
  last_reminder_contribution_number INT          DEFAULT 0,
  last_reminder_sent_at             DATETIME     NULL,
  status                            ENUM('ACTIVE','MATURED','CANCELLED') DEFAULT 'ACTIVE',
  created_at                        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at                        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES Customer(AccountNumber) ON DELETE CASCADE,
  INDEX idx_rd_account  (account_id),
  INDEX idx_rd_status   (status),
  INDEX idx_rd_maturity (maturity_date),
  INDEX idx_rd_due      (next_due_date)
);

-- ─── RD Contributions (Source of truth for actual payments) ─────────────────
CREATE TABLE IF NOT EXISTS rd_contributions (
  id                  INT          PRIMARY KEY AUTO_INCREMENT,
  rd_id               INT          NOT NULL,
  customer_id         VARCHAR(14)  NOT NULL,
  account_id          VARCHAR(14)  NOT NULL,
  contribution_number INT          NOT NULL,
  amount              DECIMAL(20,2) NOT NULL,
  paid_at             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  transaction_id      BIGINT       NULL,
  FOREIGN KEY (rd_id)      REFERENCES recurring_deposits(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES Customer(AccountNumber) ON DELETE CASCADE,
  UNIQUE KEY unique_rd_contribution (rd_id, contribution_number),
  INDEX idx_rd_contrib (rd_id)
);


