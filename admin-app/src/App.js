/**
 * Admin App — Router (Redesigned Enterprise Layout)
 * Runs on port 3001.
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import AdminLogin        from './components/auth/AdminLogin';
import AdminDashboard    from './components/admin/AdminDashboard';
import AdminCustomers    from './components/admin/AdminCustomers';
import AdminLoans        from './components/admin/AdminLoans';
import AdminFraudAlerts   from './components/admin/AdminFraudAlerts';
import AdminAuditLogs    from './components/admin/AdminAuditLogs';
import AdminTransactions from './components/admin/AdminTransactions';
import AdminInvestments  from './components/admin/AdminInvestments';
import Navbar            from './components/shared/Navbar';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const Layout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <>{children}</>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFC', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <Navbar />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: '100vh', background: '#F8FAFC' }}>
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/"             element={<Navigate to="/login" replace />} />
            <Route path="/login"        element={<AdminLoginPage />} />
            <Route path="/dashboard"    element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
            <Route path="/customers"    element={<PrivateRoute><AdminCustomers /></PrivateRoute>} />
            <Route path="/investments"  element={<PrivateRoute><AdminInvestments /></PrivateRoute>} />
            <Route path="/loans"        element={<PrivateRoute><AdminLoans /></PrivateRoute>} />
            <Route path="/fraud-alerts" element={<PrivateRoute><AdminFraudAlerts /></PrivateRoute>} />
            <Route path="/audit-logs"   element={<PrivateRoute><AdminAuditLogs /></PrivateRoute>} />
            <Route path="/transactions" element={<PrivateRoute><AdminTransactions /></PrivateRoute>} />
            <Route path="*"             element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}


/** Login page — redirects to dashboard if already logged in */
const AdminLoginPage = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <AdminLogin />;
};

export default App;
