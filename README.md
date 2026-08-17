# 🏦 SecureBank — Portfolio Banking Platform

> A production-grade online banking system demonstrating full-stack development, security best practices, fraud detection, and ML-ready architecture.

[![Node.js](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange)](https://mysql.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://docker.com)
[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://python.org)

---

## 🚀 Quick Start

### Option A — Docker (Recommended)
```bash
git clone <your-repo>
cd banking-system
cp backend/.env.example backend/.env    # Fill in your secrets
docker-compose up --build
```
- Frontend:  http://localhost:3000
- Backend:   http://localhost:8081
- Fraud API: http://localhost:5001

### Option B — Manual
```bash
# 1. Database
mysql -u root -p < backend/dataBase/schema.sql

# 2. Backend
cd backend
cp .env.example .env          # Fill in DB + JWT + Email
npm install
npm run dev                   # Starts on :8081

# 3. Frontend
cd ../frontend
npm install
npm start                     # Starts on :3000

# 4. Fraud Service (optional)
cd ../fraud-service
pip install -r requirements.txt
python app.py                 # Starts on :5001
```

---

## 🔑 Default Credentials

| Role  | Login           | Password   |
|-------|-----------------|------------|
| Admin | username: admin | Admin@123  |

> ⚠️ Change the admin password immediately after first login.

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React 18      │───▶│  Express.js API  │───▶│   MySQL 8.0     │
│   (Port 3000)   │    │   (Port 8081)    │    │   (Port 3306)   │
└─────────────────┘    └────────┬────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Flask ML API   │
                       │  (Port 5001)    │
                       │ Isolation Forest│
                       └─────────────────┘
```

### Folder Structure
```
banking-system/
├── backend/
│   ├── config/           # DB connection pool
│   ├── controllers/      # Business logic (auth, txn, admin, beneficiary)
│   ├── middleware/        # JWT auth, RBAC, input validation, error handler, audit logger
│   ├── routes/           # Express routers (customer, admin)
│   ├── services/         # Email, PDF, JWT, Fraud engine
│   ├── utils/            # Logger (Winston), response helpers, account generator
│   ├── tests/            # Jest + Supertest test suites
│   ├── dataBase/         # schema.sql, migration scripts
│   ├── logs/             # Rotating log files (auto-created)
│   └── index.js          # Server entry point
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── auth/     # Login, Signup, OTP, ForgotPassword, AdminLogin
│       │   ├── customer/ # Dashboard, Transactions, Transfer, Beneficiaries, Loans, Statement
│       │   ├── admin/    # AdminDashboard, Customers, Loans, FraudAlerts, AuditLogs, Transactions
│       │   └── shared/   # Navbar, PrivateRoute, NotFound, Unauthorized
│       ├── context/      # AuthContext (global auth state)
│       ├── services/     # Axios API instance (centralised)
│       └── utils/        # Currency/date formatters
├── fraud-service/        # Python Flask ML microservice
│   ├── app.py            # Isolation Forest + mock heuristic
│   └── requirements.txt
└── docker-compose.yml
```

---

## ✅ Features

### Customer
| Feature | Status |
|---------|--------|
| Registration + Email OTP Verification | ✅ |
| Login with JWT | ✅ |
| Forgot / Reset Password via OTP | ✅ |
| Dashboard with Balance + Chart.js Activity | ✅ |
| Withdraw with balance validation | ✅ |
| Fund Transfer with receiver validation | ✅ |
| Transfer Receipt + Fraud Alert display | ✅ |
| Transaction History + Search + Filter + Pagination | ✅ |
| Mini Statement (last 10) | ✅ |
| Monthly Statement | ✅ |
| PDF Statement Download | ✅ |
| Loan Application + History | ✅ |
| Beneficiary Management (add/remove/validate) | ✅ |

### Admin
| Feature | Status |
|---------|--------|
| Admin Login with JWT | ✅ |
| Admin Dashboard with Chart.js Doughnut | ✅ |
| Customer List + Search + Filter | ✅ |
| Freeze / Unfreeze Accounts | ✅ |
| Deposit Money to Any Account | ✅ |
| Loan Approval / Denial | ✅ |
| All Transactions View | ✅ |
| Fraud Alert Monitoring Dashboard | ✅ |
| Fraud Alert Review + Resolve | ✅ |
| Audit Log View + Search + Filter | ✅ |
| Audit Log CSV Export | ✅ |

### Security & Infrastructure
| Feature | Status |
|---------|--------|
| JWT with env-based secret (RBAC) | ✅ |
| express-validator input validation | ✅ |
| bcryptjs password hashing (cost 12) | ✅ |
| Rate limiting (login: 10/15min) | ✅ |
| Morgan HTTP logging → Winston | ✅ |
| Rotating log files (error/combined/security) | ✅ |
| Global error handler (no stack trace in prod) | ✅ |
| Atomic DB transactions (transfer/withdraw) | ✅ |
| 5-rule fraud detection engine | ✅ |
| Audit logging (13 action types) | ✅ |
| Docker + docker-compose | ✅ |
| Jest + Supertest test suite | ✅ |
| ML-ready Fraud Service (Flask + Isolation Forest) | ✅ |

---

## 🔌 API Reference

### Customer Endpoints

| Method | Endpoint                        | Auth   | Description |
|--------|---------------------------------|--------|-------------|
| POST   | /customer/signup                | Public | Register + send OTP |
| POST   | /customer/login                 | Public | Login, returns JWT |
| POST   | /customer/verify-otp            | Public | Verify email OTP |
| POST   | /customer/resend-otp            | Public | Resend OTP |
| POST   | /customer/forgot-password       | Public | Send password reset OTP |
| POST   | /customer/reset-password        | Public | Reset password with OTP |
| GET    | /customer/account-info          | JWT    | Balance + account details |
| POST   | /customer/withdraw              | JWT    | Withdraw funds |
| POST   | /customer/transfer              | JWT    | Transfer to another account |
| GET    | /customer/transactions          | JWT    | History (paginated, filterable) |
| GET    | /customer/mini-statement        | JWT    | Last 10 transactions |
| GET    | /customer/monthly-statement     | JWT    | Monthly summary |
| GET    | /customer/statement-pdf         | JWT    | Download PDF |
| POST   | /customer/apply-loan            | JWT    | Apply for loan |
| GET    | /customer/my-loans              | JWT    | My loan history |
| POST   | /customer/beneficiaries         | JWT    | Add beneficiary |
| GET    | /customer/beneficiaries         | JWT    | List beneficiaries |
| DELETE | /customer/beneficiaries/:id     | JWT    | Remove beneficiary |
| GET    | /customer/beneficiaries/validate/:acc | JWT | Validate account |

### Admin Endpoints (all require Admin JWT)

| Method | Endpoint                               | Description |
|--------|----------------------------------------|-------------|
| POST   | /admin/login                           | Admin login |
| GET    | /admin/stats                           | Dashboard metrics |
| GET    | /admin/customers                       | All customers (paginated) |
| GET    | /admin/customers/:acc                  | Customer detail |
| POST   | /admin/customers/:acc/freeze           | Freeze account |
| POST   | /admin/customers/:acc/unfreeze         | Unfreeze account |
| POST   | /admin/deposit                         | Deposit to account |
| GET    | /admin/loans                           | All loans (filterable) |
| POST   | /admin/loans/:id/approve               | Approve / Deny loan |
| GET    | /admin/transactions                    | All transactions |
| GET    | /admin/fraud-alerts                    | Fraud alerts (paginated) |
| POST   | /admin/fraud-alerts/:id/resolve        | Review / Resolve alert |
| GET    | /admin/audit-logs                      | Audit logs (paginated) |
| GET    | /admin/audit-logs/export               | Export as CSV |

### ML Fraud Service

| Method | Endpoint         | Description |
|--------|------------------|-------------|
| GET    | /health          | Service health |
| POST   | /fraud/predict   | Score a transaction |
| POST   | /fraud/train     | Train Isolation Forest |
| GET    | /fraud/features  | Feature schema docs |

---

## 🗄️ Database Schema

### Tables
| Table | Purpose |
|-------|---------|
| `Customer` | User accounts — balance, status, credentials |
| `admins` | Admin users with hashed passwords |
| `transactions` | Unified transaction log (all types) |
| `Loan` | Loan applications and approvals |
| `otp_verifications` | OTP hashes with expiry |
| `beneficiaries` | Saved transfer recipients |
| `fraud_alerts` | Flagged transactions with risk scores |
| `audit_logs` | All user/admin actions with IP |

---

## 🕵️ Fraud Detection Rules

| Rule | Trigger | Score Added |
|------|---------|-------------|
| HIGH_VALUE_TRANSACTION | Amount > ₹50,000 | +30 |
| RAPID_TRANSACTION_ACTIVITY | >5 transactions in 2 minutes | +35 |
| DAILY_LIMIT_EXCEEDED | Daily transfers > ₹1,00,000 | +25 |
| MULTIPLE_FAILED_ATTEMPTS | >3 failed attempts in 1 hour | +40 |
| NEW_BENEFICIARY_RISK | >₹20,000 to beneficiary added < 24h ago | +30 |

Risk levels: **LOW** (0–30) · **MEDIUM** (31–70) · **HIGH** (71–100)

---

## 🧪 Running Tests

```bash
cd backend
npm test              # Run all tests
npm test -- --coverage  # With coverage report
```

Test coverage:
- Auth validation (signup, login)
- RBAC middleware (admin route blocking)
- Transaction validation
- Fraud service unit tests

---

## 🤖 ML Integration Guide

The Isolation Forest model activates once you POST training data:

```bash
curl -X POST http://localhost:5001/fraud/train \
  -H "Content-Type: application/json" \
  -d '{"transactions": [[1000, 1, 999, 0, 1000], [75000, 8, 2, 4, 150000]]}'
```

Features: `[amount, frequency, beneficiary_age_hrs, failed_attempts, daily_volume]`

Once trained, `/fraud/predict` returns ML-based scores instead of heuristics.

---

## 🎤 Interview Discussion Points

- **Atomic transactions**: `BEGIN` → update both balances → `INSERT` → `COMMIT` / `ROLLBACK`
- **RBAC**: JWT role field (`user`/`admin`) checked in middleware before every protected route
- **Fraud engine**: Rule-based scoring, additive risk scores capped at 100, non-blocking (alerts only, not hard blocks below 90)
- **Isolation Forest**: Unsupervised anomaly detection — no labelled data needed, isolates anomalies by path length
- **Audit logs**: Every sensitive action tracked with IP — immutable append-only pattern
- **OTP security**: Hashed with bcrypt before DB storage, 10-minute expiry, single-use flag
- **Rate limiting**: 10 login attempts per 15 minutes (brute force protection)
- **PDF generation**: PDFKit streaming directly to response (no temp file on disk)

---

## 📜 License

MIT — Portfolio use only.
