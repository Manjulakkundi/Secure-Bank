/**
 * Customer App — Router
 * Completely separate from admin app.
 * Runs on port 3000.
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login               from './components/auth/Login';
import Signup              from './components/auth/Signup';
import VerifyOtp           from './components/auth/VerifyOtp';
import ForgotPassword      from './components/auth/ForgotPassword';
import ForgotAccountNumber from './components/auth/ForgotAccountNumber';

import Dashboard        from './components/customer/Dashboard';
import TransactionHistory from './components/customer/TransactionHistory';
import Transfer         from './components/customer/Transfer';
import Beneficiaries    from './components/customer/Beneficiaries';
import Loans            from './components/customer/Loans';
import Statement        from './components/customer/Statement';
import Profile          from './components/customer/Profile';
import Investments      from './components/customer/Investments';
import Navbar           from './components/shared/Navbar';

const PUBLIC = ['/login', '/signup', '/verify-otp', '/forgot-password', '/forgot-account-number'];

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const Layout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isPublic = PUBLIC.some(p => location.pathname.startsWith(p));
  return (
    <>
      {isAuthenticated && !isPublic && <Navbar />}
      {children}
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/"                      element={<Navigate to="/login" replace />} />
            <Route path="/login"                 element={<LoginPage />} />
            <Route path="/signup"                element={<Signup />} />
            <Route path="/verify-otp"            element={<VerifyOtp />} />
            <Route path="/forgot-password"       element={<ForgotPassword />} />
            <Route path="/forgot-account-number" element={<ForgotAccountNumber />} />

            <Route path="/dashboard"      element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/profile"        element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/transactions"   element={<PrivateRoute><TransactionHistory /></PrivateRoute>} />
            <Route path="/transfer"       element={<PrivateRoute><Transfer /></PrivateRoute>} />
            <Route path="/beneficiaries"  element={<PrivateRoute><Beneficiaries /></PrivateRoute>} />
            <Route path="/investments"    element={<PrivateRoute><Investments /></PrivateRoute>} />
            <Route path="/loans"          element={<PrivateRoute><Loans /></PrivateRoute>} />
            <Route path="/statement"      element={<PrivateRoute><Statement /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}


const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Login />;
};

export default App;
