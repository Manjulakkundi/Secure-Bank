/**
 * components/shared/PrivateRoute.js
 * Route guard. Redirects to /login if not authenticated.
 * Redirects to /unauthorized if wrong role.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PrivateRoute = ({ children, role }) => {
  const { isAuthenticated, isAdmin, isUser } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === 'admin' && !isAdmin) return <Navigate to="/unauthorized" replace />;
  if (role === 'user'  && !isUser)  return <Navigate to="/unauthorized" replace />;
  return children;
};

export default PrivateRoute;
