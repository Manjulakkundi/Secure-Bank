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
    if (err.response?.status === 401) {
      localStorage.removeItem('customerToken');
      window.location.href = '/login';
      return new Promise(() => {});
    }
    return Promise.reject(err);
  }
);

export default API;
