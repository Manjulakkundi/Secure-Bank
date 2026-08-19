/**
 * Customer App — API service
 * Always sends customerToken. Redirects to /login on 401.
 */
import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8081',
  timeout: 15000,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('customerToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthRoute =
      url.includes('/customer/login') ||
      url.includes('/customer/signup') ||
      url.includes('/customer/verify-otp') ||
      url.includes('/customer/resend-otp') ||
      url.includes('/customer/forgot-password') ||
      url.includes('/customer/reset-password') ||
      url.includes('/customer/forgot-account-number');

    if (err.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('customerToken');
      const currentPath = window.location.pathname;
      if (
        !currentPath.startsWith('/login') &&
        !currentPath.startsWith('/signup') &&
        !currentPath.startsWith('/verify-otp') &&
        !currentPath.startsWith('/forgot-password') &&
        !currentPath.startsWith('/forgot-account-number')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);


export default API;
