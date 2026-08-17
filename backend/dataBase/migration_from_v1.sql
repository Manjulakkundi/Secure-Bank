-- =============================================================================
-- Migration: v1 → v2 (Run ONLY if upgrading an existing v1 database)
-- =============================================================================
USE bank;

-- 1. Fix decimal types on old tables
ALTER TABLE WithdrawHistory
  MODIFY WithdrawAmount DECIMAL(20,2),
  MODIFY AfterBalance   DECIMAL(20,2);

ALTER TABLE TransferMoney
  MODIFY TransferAmount DECIMAL(20,2);

-- 2. Add new columns to Customer
ALTER TABLE Customer
  ADD COLUMN IF NOT EXISTS AccountStatus ENUM('Active','Frozen','Closed') DEFAULT 'Active' AFTER AccountVerify,
  ADD COLUMN IF NOT EXISTS CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER AccountStatus;

-- 3. Create all new tables (idempotent — uses IF NOT EXISTS)
-- 3. Create all new tables (idempotent — uses IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS admins (
  id            INT          PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  email         VARCHAR(100),
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO admins (username, password_hash, email) VALUES
  ('admin', '$2a$12$uKPdXZWSRp35ZqfzUyn94Oj3LhmAyJJPeI9YMFxlI5Bs4paAJUs7K', 'admin@securebank.com');

CREATE TABLE IF NOT EXISTS transactions (
  transaction_id  BIGINT       PRIMARY KEY AUTO_INCREMENT,
  sender_account  VARCHAR(14),
  receiver_account VARCHAR(14),
  transaction_type ENUM('DEPOSIT','WITHDRAW','TRANSFER','RECEIVE','LOAN_APPROVED') NOT NULL,
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

-- 4. Migrate old WithdrawHistory data into unified transactions table
INSERT INTO transactions (sender_account, transaction_type, amount, status, description, balance_after, created_at)
SELECT AccountNumber, 'WITHDRAW', WithdrawAmount, 'SUCCESS',
       CONCAT('Migrated withdrawal'), AfterBalance, WithdrawTime
FROM WithdrawHistory;

-- 5. Migrate old TransferMoney data into unified transactions table
INSERT INTO transactions (sender_account, receiver_account, transaction_type, amount, status, description, created_at)
SELECT AccountNumber, ToAccount, 'TRANSFER', TransferAmount, 'SUCCESS',
       CONCAT('Migrated transfer to ', ToAccount), TransferTime
FROM TransferMoney;

-- 6. (Optional) Drop old tables after verifying migration
-- DROP TABLE IF EXISTS WithdrawHistory, TransferMoney, BalanceLog, TransactionHistory;

SELECT 'Migration complete' AS status;
