# SecureBank v3 — Local Development Startup Guide

## First-Time Setup

### 1. Database Initialization
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bank CHARACTER SET utf8mb4;"
mysql -u root -p bank < backend/dataBase/schema.sql
```

### 2. Environment Configuration
Create `backend/.env` based on `backend/.env.example` and set your local credentials:
```ini
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
EMAIL_PASS=your_app_specific_password

FRONTEND_URL=http://localhost:3000
ADMIN_FRONTEND_URL=http://localhost:3001
```

### 3. Install All Dependencies (Run Once)
```bash
cd backend       && npm install
cd ../customer-app && npm install
cd ../admin-app    && npm install
```

---

## Daily Development — 3 Terminals

**Terminal 1 — Core Banking API & Investment Scheduler:**
```bash
cd backend
npm run dev
# Running on http://localhost:8081
```

**Terminal 2 — Customer Banking Portal:**
```bash
cd customer-app
npm start
# Running on http://localhost:3000
```

**Terminal 3 — Admin Surveillance Portal:**
```bash
cd admin-app
npm start
# Running on http://localhost:3001
```

---

## Port Allocation Summary
| Service | Local URL | Primary Responsibility |
| :--- | :--- | :--- |
| **Customer Portal** | `http://localhost:3000` | Retail customer banking, transfers, FD/RD investments, statements |
| **Admin Portal** | `http://localhost:3001` | Bank-wide investment surveillance HUD, customer management, loans |
| **Backend API** | `http://localhost:8081` | REST API endpoints, investment scheduler, audit logging |
| **ML Fraud Service** | `http://localhost:5001` | (Optional) Isolation Forest anomaly scoring engine |

---

## Why Decoupled Customer & Admin Applications?
- `customer-app` stores authenticated session tokens as `customerToken` in browser storage.
- `admin-app` stores privileged administrative tokens as `adminToken`.
- Prevents cross-context session contamination, privilege escalation, and token pollution.
