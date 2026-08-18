# 🏦 SecureBank v3 — Enterprise Digital Banking & Investment Platform

> A full-stack, production-hardened digital banking system demonstrating ACID transaction integrity, intelligent fraud scoring, full-lifecycle Fixed & Recurring Deposits, role-based administration, bank-wide investment surveillance, and automated background schedulers.

[![Node.js](https://img.shields.io/badge/Node.js-20+-68A063?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://mysql.com)
[![JWT](https://img.shields.io/badge/JWT-Protected-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io)
[![Winston](https://img.shields.io/badge/Winston-Logging-5B45FF?style=for-the-badge)](https://github.com/winstonjs/winston)
[![Vercel](https://img.shields.io/badge/Vercel-Ready-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![Render](https://img.shields.io/badge/Render-Ready-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com)

---

## 📑 Table of Contents
1. [Architecture & System Topology](#-architecture--system-topology)
2. [Core Banking & Investment Modules](#-core-banking--investment-modules)
   - [Customer Banking Portal](#1-customer-banking-portal)
   - [Full-Lifecycle Investment Engine (FD & RD)](#2-full-lifecycle-investment-engine-fd--rd)
   - [Admin Investment Surveillance HUD](#3-admin-investment-surveillance-hud)
   - [Administrator Portal](#4-administrator-portal)
3. [Security & Transactional Integrity](#-security--transactional-integrity)
4. [Fraud Detection Architecture](#-fraud-detection-architecture)
5. [Database Schema](#-database-schema)
6. [API Route Reference](#-api-route-reference)
7. [Automated Test Suite (87 Passed / 0 Failed)](#-automated-test-suite)
8. [Local Development Quick Start](#-local-development-quick-start)
9. [Production Deployment Architecture](#-production-deployment-architecture)
10. [Engineering Highlights](#-engineering-highlights)

---

## 🏗️ Architecture & System Topology

SecureBank v3 uses a decoupled full-stack architecture with dual React single-page applications, a robust Node.js/Express REST API, automated cron schedulers, transactional email dispatchers, and MySQL relational persistence.

```
                      ┌───────────────────────────────────────────────┐
                      │            SECUREBANK CLIENT APPS             │
                      └───────────────────────────────────────────────┘
                                      │               │
               ┌──────────────────────┘               └──────────────────────┐
               ▼                                                             ▼
    ┌─────────────────────────┐                                   ┌─────────────────────────┐
    │   Customer React App    │                                   │    Admin React App      │
    │  (Port 3000 / Vercel)   │                                   │  (Port 3001 / Vercel)   │
    │ Token: `customerToken`  │                                   │   Token: `adminToken`   │
    └──────────┬──────────────┘                                   └──────────┬──────────────┘
               │                                                             │
               │ HTTPS / JSON REST API                                       │ HTTPS / JSON REST API
               └──────────────────────┐               ┌──────────────────────┘
                                      ▼               ▼
                      ┌───────────────────────────────────────────────┐
                      │          Node.js + Express.js API             │
                      │            (Port 8081 / Render)               │
                      │ ───────────────────────────────────────────── │
                      │  • JWT RBAC & Ownership Authorization         │
                      │  • Strict Row-Locking & Rate Limiting         │
                      │  • Multi-Origin Normalized CORS               │
                      │  • Winston Structured Audit & Event Logging   │
                      └───────┬──────────────┬──────────────┬─────────┘
                              │              │              │
              ┌───────────────┘              │              └───────────────┐
              ▼                              ▼                              ▼
  ┌───────────────────────┐      ┌───────────────────────┐      ┌───────────────────────┐
  │      MySQL 8.0+       │      │  Investment Scheduler │      │ Nodemailer SMTP Relay │
  │   (Cloud RDS/Aiven)   │      │   (Dual-Role Engine)  │      │  (HTML Notifications) │
  │ ───────────────────── │      │ ───────────────────── │      │ ───────────────────── │
  │ • ACID Transactions   │      │ • Idempotent Maturity │      │ • P2P Transfers       │
  │ • Foreign Keys & IDX  │      │ • RD Payment Reminder │      │ • FD/RD Confirmations │
  │ • Account Isolation   │      │ • Non-debit Reminders │      │ • Maturity Alerts     │
  └───────────────────────┘      └───────────────────────┘      └───────────────────────┘
              │
              ▼ (Optional / Async)
  ┌───────────────────────┐
  │  Python ML Service    │
  │  (Port 5001 / Flask)  │
  │ ───────────────────── │
  │ • Isolation Forest    │
  │ • Behavioral Anomalies│
  └───────────────────────┘
```

---

## 🏦 Core Banking & Investment Modules

### 1. Customer Banking Portal
* **Registration & Verification**: Onboarding with bcrypt-hashed passwords and 6-digit numeric Email OTP verification (`otp_verifications`).
* **JWT Authentication**: Dedicated `customerToken` realm with automatic 401 interceptor redirection.
* **Dynamic Dashboard**: Hero balance display with live mask/unmask privacy toggles (`₹10,000.00` ↔ `••••••`), recent transaction feed, monthly debit/credit breakdown, and quick action tiles.
* **Peer-to-Peer Fund Transfers**: Atomic account transfers with zero negative balance guarantee, beneficiary existence validation, sender debit, receiver credit, and balance logging.
* **Beneficiaries Directory**: Management of frequent payees with verified account name resolution and duplicate-prevention checks.
* **Ledger & Statements**: Server-paginated transaction history with date filters and dynamic on-demand PDF Statement generation via PDFKit.
* **Loan Applications**: Customer credit requests with monthly income calculations and admin underwriting review status.

---

### 2. Full-Lifecycle Investment Engine (FD & RD)

#### Fixed Deposit (FD)
* **High-Yield Calculation**: Simple interest calculated based on tenure ($6\text{m} \rightarrow 6.00\%$, $1\text{y} \rightarrow 6.75\%$, $2\text{y} \rightarrow 7.10\%$, $3\text{y} \rightarrow 7.25\%$, $5\text{y} \rightarrow 7.50\%$).
* **Real-Time Balance Verification**: Verifies available customer funds before executing any balance deduction.
* **Atomic Settlement**: Deducts principal from customer balance within an ACID transaction and creates an `ACTIVE` record.
* **Idempotent Maturity Engine**: Background scheduler checks `maturity_date <= NOW()`, credits the maturity amount (`Principal + Interest`), logs an `FD_MATURITY` transaction, and sets status to `MATURED` without risk of double-crediting.

#### Recurring Deposit (RD)
* **Zero Initial Debit**: Creating an RD generates the scheduled contract without deducting any money upfront.
* **Manual Customer Installments**: Installments are paid manually by the customer via the portal with strict balance checks.
* **Roadmap Progress Tracking**: Tracks itemized month-by-month progress (`PAID`, `PENDING`, `MISSED`) and distinguishes between *Expected Total Deposit* and *Actual Paid Capital*.
* **Monthly Reminder Scheduler**: Automatically sends email reminders for due contributions **without auto-debiting funds**.
* **Actual-Contribution Maturity Payout**: Maturity payout calculates interest based strictly on installments actually paid.

#### My Investments Dashboard
* **Portfolio Overview**: Live KPI summary displaying Total Invested, Active FDs, Active RDs, and Next Maturity Target.
* **Detailed Portfolio Breakdown**: Tabbed inspection of active and matured deposits, showing interest earned, tenure progress, and itemized RD contribution schedules.

---

### 3. Admin Investment Surveillance HUD

A bank-wide investment monitoring and surveillance dashboard accessible only to authenticated bank administrators.

* **Bank-Wide Overview KPIs**:
  * **Total Unique Investors**: Number of distinct customers holding active investments (counted once per customer across FDs and RDs).
  * **Total Invested Across Bank**: Strictly calculates $\text{Active FD Principal} + \text{Actual RD Paid So Far}$ (never anticipates unpaid installments).
  * **Expected Maturity Obligations**: Sum of projected FD and RD maturity payouts.
  * **Portfolio Health**: Real-time counter of upcoming maturities ($\le 7\text{d}$, $\le 30\text{d}$) and missed RD contributions.
* **Chart.js Capital Allocation Analytics**: Dynamic visual charts for asset distribution (FD vs. RD) and lifecycle status (Active vs. Matured).
* **5-Range Maturity Surveillance Monitor**:
  * `maturing_7d`: Active investments maturing in $\le 7$ days.
  * `maturing_30d`: Active investments maturing in $\le 30$ days.
  * `matured_last_7d`: Investments matured in the last 7 days.
  * `matured_last_30d`: Investments matured in the last 30 days.
  * `all_matured`: Historical archive of all matured investments.
* **Server-Side Paginated Customer Table**: Multi-field search by Customer Name, Account Number, FD ID, RD ID, with multi-column sorting.
* **Strict Privacy Masking**: Customer account numbers are strictly masked (`****6808`) in all API payloads and UI tables.
* **Customer Portfolio Drilldown**: Deep inspection modal showing all customer FDs, RDs with month-by-month roadmap, audit timestamps (`created_at`, `updated_at`), and related transaction history.
* **Read-Only Financial Scope**: Enforces read-only oversight; admins cannot alter customer balances or manipulate investment interest rates.

---

### 4. Administrator Portal
* **Customer Management**: Search, filter, and inspect customer profiles, with one-click **Account Freeze / Unfreeze** toggles.
* **Teller Operations**: Administrative manual cash deposit processing.
* **Loan Underwriting**: Credit evaluation with one-click Loan Approval / Rejection workflows.
* **Fraud Intelligence**: Real-time log of flagged high-velocity, high-amount, or unusual behavioral transfers.
* **Immutable Audit Trail**: Append-only system audit log (`audit_logs`) tracking administrative logins, approvals, and customer state changes.

---

## 🔒 Security & Transactional Integrity

| Security Layer | Implementation Details |
| :--- | :--- |
| **ACID Integrity** | Strict `START TRANSACTION`, `SELECT ... FOR UPDATE` row locks, and `COMMIT`/`ROLLBACK` handling for all financial operations. |
| **Dual JWT Realms** | Independent tokens (`customerToken` signed with `JWT_SECRET` vs `adminToken` signed with `JWT_ADMIN_SECRET`). |
| **Password Hashing** | BCrypt password hashing with cost factor of 12 rounds. |
| **Cross-Account RBAC** | Backend token verification ensures customers can only query and transfer from their own account. |
| **Rate Limiting** | Tiered rate limiting via `express-rate-limit` (100 req/15 min global, 10 req/15 min on login endpoints). |
| **Zero Account Exposure**| Administrative endpoints return masked identifiers (`****6808`) to prevent PII leakage. |
| **CORS Normalization** | Dynamic multi-origin parser supporting comma-separated domains and trailing slash stripping. |
| **Audit Trail Ledger** | Automated IP-stamped audit logging for all critical financial and authentication events. |

---

## 🛡️ Fraud Detection Architecture

SecureBank v3 uses a hybrid fraud prevention system combining deterministic business rules with optional machine learning anomaly scoring:

1. **Rule-Based Heuristics (Synchronous)**:
   * Single-transaction amount velocity check ($>\text{₹}50,000$).
   * Short-window transfer frequency ($>3$ transfers within 2 minutes).
   * High-value transfers to newly registered beneficiaries ($<24\text{ hours}$).
   * Night-time high-risk transaction alerts ($11\text{ PM} - 5\text{ AM}$).
2. **Isolation Forest ML Service (`fraud-service/`)**:
   * Python Flask microservice evaluating multi-dimensional feature vectors (amount, time delta, sender velocity, balance ratio).
   * Generates continuous anomaly scores from $-1.0$ (High Anomaly) to $+1.0$ (Normal).

---

## 🗄️ Database Schema

The relational database architecture is defined in `backend/dataBase/schema.sql` and `backend/migrations/001_investments.js`:

```
┌───────────────────────────┐         ┌───────────────────────────┐
│         Customer          │ 1     * │       transactions        │
│───────────────────────────│─────────│───────────────────────────│
│ PK AccountNumber (VARCHAR)│         │ PK transaction_id (BIGINT)│
│    customerName           │         │ FK sender_account         │
│    customerEmail (UNIQUE) │         │ FK receiver_account       │
│    customerPhone          │         │    transaction_type       │
│    CustomerPassword       │         │    amount                 │
│    Balance (DECIMAL 20,2) │         │    status                 │
│    AccountStatus (ENUM)   │         │    balance_after          │
│    AccountVerify (TINYINT)│         │    created_at             │
└─────────────┬─────────────┘         └───────────────────────────┘
              │ 1
              ├───────────────────────────────────┐
              │ *                                 │ *
┌─────────────▼─────────────┐         ┌───────────▼───────────────┐
│       fixed_deposits      │         │     recurring_deposits    │
│───────────────────────────│         │───────────────────────────│
│ PK id (BIGINT)            │         │ PK id (BIGINT)            │
│ FK account_id (VARCHAR)   │         │ FK account_id (VARCHAR)   │
│    principal_amount       │         │    monthly_amount         │
│    interest_rate          │         │    interest_rate          │
│    tenure_months          │         │    tenure_months          │
│    interest_amount        │         │    total_amount_paid      │
│    maturity_amount        │         │    estimated_maturity     │
│    start_date             │         │    next_due_date          │
│    maturity_date          │         │    status (ACTIVE/MATURED)│
│    status (ACTIVE/MATURED)│         └─────────────┬─────────────┘
└───────────────────────────┘                       │ 1
                                                    │ *
                                      ┌─────────────▼─────────────┐
                                      │      rd_contributions     │
                                      │───────────────────────────│
                                      │ PK id (BIGINT)            │
                                      │ FK rd_id (BIGINT)         │
                                      │ FK account_id (VARCHAR)   │
                                      │    contribution_number    │
                                      │    amount                 │
                                      │    paid_at                │
                                      └───────────────────────────┘
```

*Other Supporting Tables*: `admins`, `beneficiaries`, `Loan`, `otp_verifications`, `audit_logs`, `fraud_alerts`.

---

## 📡 API Route Reference

### Health & System
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server status and ISO timestamp | Public |

### Customer Portal (`/customer/*`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/customer/signup` | Register new account & dispatch OTP | Public |
| `POST` | `/customer/verify-otp` | Verify 6-digit email OTP | Public |
| `POST` | `/customer/login` | Authenticate customer & return JWT | Public |
| `GET` | `/customer/profile` | Retrieve authenticated profile & balance | Customer JWT |
| `POST` | `/customer/transfer` | Execute peer-to-peer funds transfer | Customer JWT |
| `GET` | `/customer/transactions` | Query server-paginated transaction history | Customer JWT |
| `GET` | `/customer/beneficiaries` | List saved beneficiaries | Customer JWT |
| `POST` | `/customer/beneficiaries` | Add new verified beneficiary | Customer JWT |
| `GET` | `/customer/investments` | Retrieve active & matured FD/RD portfolio | Customer JWT |
| `POST` | `/customer/investments/fd` | Create Fixed Deposit with balance validation | Customer JWT |
| `POST` | `/customer/investments/rd` | Create Recurring Deposit schedule (zero debit)| Customer JWT |
| `POST` | `/customer/investments/rd/:id/contribute` | Pay monthly RD installment | Customer JWT |
| `POST` | `/customer/apply-loan` | Submit credit underwriting application | Customer JWT |
| `GET` | `/customer/statement-pdf` | Stream generated PDF statement | Customer JWT |

### Admin Portal (`/admin/*`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/admin/login` | Authenticate administrator & return admin JWT | Public |
| `GET` | `/admin/dashboard` | Bank-wide telemetry & recent transactions | Admin JWT |
| `GET` | `/admin/investments/overview` | Bank-wide investment KPIs & analytics | Admin JWT |
| `GET` | `/admin/investments/customers` | Paginated, searchable & sortable investor list | Admin JWT |
| `GET` | `/admin/investments/customers/:accountNumber`| Deep customer portfolio & RD roadmap drilldown| Admin JWT |
| `GET` | `/admin/investments/maturity-monitor` | Surveillance feed across 5 maturity ranges | Admin JWT |
| `GET` | `/admin/customers` | Customer list with KYC statuses & balances | Admin JWT |
| `PUT` | `/admin/customers/:account/status` | Freeze or unfreeze customer account | Admin JWT |
| `POST` | `/admin/deposit` | Administrative cash teller deposit | Admin JWT |
| `GET` | `/admin/loans` | Loan applications queue | Admin JWT |
| `PUT` | `/admin/loans/:id` | Approve or reject loan application | Admin JWT |
| `GET` | `/admin/fraud-alerts` | Real-time suspicious transaction log | Admin JWT |
| `GET` | `/admin/audit-logs` | Immutable system event ledger | Admin JWT |

---

## 🧪 Automated Test Suite

The project includes an end-to-end integration and unit test suite verified with **87 Passed / 0 Failed assertions**:

```bash
# Run Pre-Deployment End-to-End Suite (23 Tests)
node backend/tests/preDeploymentE2ETest.js

# Run Full FD/RD Lifecycle & Scheduler Tests (33 Tests)
node backend/tests/investmentIntegrationTest.js

# Run Admin Investment Surveillance & Privacy Tests (30 Tests)
node backend/tests/adminInvestmentTest.js

# Run Production Mode Health Check (1 Test)
node backend/tests/healthCheckTest.js
```

### Verified Scenarios:
- [x] Customer login validation, invalid password rejection, and session token generation.
- [x] Strict non-negative balance enforcement during transfers and FD creations.
- [x] Zero-debit RD creation and manual installment payment workflows.
- [x] Idempotent maturity settlement (guarantees zero double-credits upon scheduler re-runs).
- [x] Bank-wide investor counting (unique deduplication across FD and RD portfolios).
- [x] Zero raw account number leakage in administrative API responses (`****6808`).
- [x] Dual-role background scheduler reminder loop without auto-debits.

---

## 💻 Local Development Quick Start

### Prerequisites
- Node.js 20.x or higher
- MySQL 8.0+ Server running locally on port 3306
- (Optional) Python 3.10+ for the Flask ML Fraud Service

### 1. Database Initialization
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bank CHARACTER SET utf8mb4;"
mysql -u root -p bank < backend/dataBase/schema.sql
```

### 2. Environment Configuration
Create `.env` in `backend/` based on `backend/.env.example`:
```ini
PORT=8081
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=bank
JWT_SECRET=your_development_jwt_secret_min_32_characters
JWT_ADMIN_SECRET=your_development_admin_secret_min_32_characters
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
FRONTEND_URL=http://localhost:3000
ADMIN_FRONTEND_URL=http://localhost:3001
```

### 3. Install & Start Services

**Terminal 1 — Backend API & Investment Scheduler:**
```bash
cd backend
npm install
npm run dev
# Running on http://localhost:8081
```

**Terminal 2 — Customer Banking Portal:**
```bash
cd customer-app
npm install
npm start
# Running on http://localhost:3000
```

**Terminal 3 — Admin Surveillance Portal:**
```bash
cd admin-app
npm install
npm start
# Running on http://localhost:3001
```

**Terminal 4 (Optional) — ML Fraud Detection Service:**
```bash
cd fraud-service
pip install -r requirements.txt
python app.py
# Running on http://localhost:5001
```

---

## 🚀 Production Deployment Architecture

The application is prepared for zero-friction deployment to modern cloud infrastructure:

| Component | Target Platform | Build Command | Start / Output Command |
| :--- | :--- | :--- | :--- |
| **Customer App** | **Vercel** (SPA) | `npm run build` | Static Output (`build/` + `vercel.json`) |
| **Admin App** | **Vercel** (SPA) | `npm run build` | Static Output (`build/` + `vercel.json`) |
| **Backend API** | **Render** (Web Service) | `npm install` | `node index.js` |
| **Database** | **Aiven / PlanetScale / AWS RDS** | N/A | MySQL 8.0+ Port 3306 with SSL |

---

## 💡 Engineering Highlights

* **Atomic Financial Concurrency**: Implements pessimistic row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions and overdrafts during rapid concurrent transfers and deposit settlements.
* **Zero-Debit Investment Scheduling**: Engineered a flexible Recurring Deposit system allowing manual customer contributions with automated non-debit reminder dispatch.
* **Idempotent Background Jobs**: The dual-role cron engine safely handles investment maturity payouts and reminder notifications without duplicate transaction processing.
* **Enterprise Privacy Enforcement**: Strict masking layer on all administrative data endpoints ensures customer account numbers are never exposed in browser developer tools.
* **Decoupled Multi-SPA Design**: Isolated state architectures for Customer and Admin applications prevent token pollution and permission elevation.

---

### 📄 License
This project is licensed under the [MIT License](LICENSE).
