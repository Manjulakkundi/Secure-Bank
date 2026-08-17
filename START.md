# SecureBank v3 — Start Guide

## First time setup

### 1. Database
```bash
mysql -u root -p -e "DROP DATABASE IF EXISTS bank; CREATE DATABASE bank CHARACTER SET utf8mb4;"
mysql -u root -p bank < backend/dataBase/schema.sql
```

### 2. Edit backend/.env
Set your DB password and JWT secrets:
```
DB_PASS=your_mysql_password
JWT_SECRET=4285b429b73cfa25d17250e36a688e37b3e0265e359d7d7e111d93aff68bd311dd00a13de36092482ab041d1205f7a5198abe029d105df313117658420ce212c
JWT_ADMIN_SECRET=e5ed1b662a067e8b272b0aab97109e74bca2269bf6e2a9fa7a3d81ccda058545057f606dd2821f1bb6bd4142f6771beb561031b365c1c276944d34ca4c88e69e
```

### 3. Install all dependencies (run once)
```bash
cd backend       && npm install
cd ../customer-app && npm install
cd ../admin-app    && npm install
```

## Every time — 3 terminals

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Customer App:**
```bash
cd customer-app
npm start
```

**Terminal 3 — Admin App:**
```bash
cd admin-app
npm start
```

## URLs
| App | URL |
|-----|-----|
| Customer | http://localhost:3000 |
| Admin    | http://localhost:3001 |
| Backend  | http://localhost:8081 |

## Admin credentials
- Username: admin
- Password: Admin@123

## Why two separate apps?
- customer-app stores token as `customerToken` in its own browser tab
- admin-app stores token as `adminToken` in its own browser tab  
- They never interfere with each other
- Each app auto-refreshes every 15 seconds independently
