/**
 * components/auth/Login.js
 * Multi-mode login: Account Number, Email, or Phone.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';

const s = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #1A3C5E 0%, #2E7D9A 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#fff', borderRadius: 16, padding: '48px 40px', width: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  logo: { textAlign: 'center', fontSize: 36, marginBottom: 8 },
  title: { textAlign: 'center', color: '#1A3C5E', fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { textAlign: 'center', color: '#888', fontSize: 14, marginBottom: 24 },
  tabs: { display: 'flex', background: '#f0f4f8', borderRadius: 8, padding: 4, marginBottom: 24, gap: 4 },
  tab: { flex: 1, padding: '8px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
         cursor: 'pointer', transition: 'all 0.2s' },
  tabActive: { background: '#1A3C5E', color: '#fff' },
  tabInactive: { background: 'transparent', color: '#666' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 },
  input: { width: '100%', padding: '12px 14px', border: '2px solid #e0e0e0', borderRadius: 8,
           fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)',
         color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700,
         cursor: 'pointer', marginTop: 8 },
  err: { background: '#fde8e8', color: '#c0392b', padding: '12px 16px', borderRadius: 8,
         marginBottom: 16, fontSize: 14, textAlign: 'center' },
  group: { marginBottom: 20 },
  link: { color: '#2E7D9A', textDecoration: 'none', fontWeight: 600 },
  footer: { textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' },
  divider: { textAlign: 'center', color: '#ccc', margin: '8px 0' },
};

const LOGIN_MODES = [
  { key: 'accountNumber', label: 'Account No', placeholder: '12-digit account number', maxLength: 12 },
  { key: 'email',         label: 'Email',      placeholder: 'your@email.com',           type: 'email' },
  { key: 'phone',         label: 'Phone',      placeholder: '10-digit mobile',          maxLength: 10 },
];

const Login = () => {
  const [mode, setMode]     = useState(0);
  const [identifier, setId] = useState('');
  const [password, setPwd]  = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const currentMode = LOGIN_MODES[mode];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { password, [currentMode.key]: identifier };
      const { data } = await API.post('/customer/login', payload);
      if (data.success) {
        login(data.data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (idx) => {
    setMode(idx);
    setId('');
    setError('');
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>🏦</div>
        <h1 style={s.title}>SecureBank</h1>
        <p style={s.sub}>Sign in to your account</p>

        {/* Login mode tabs */}
        <div style={s.tabs}>
          {LOGIN_MODES.map((m, i) => (
            <button key={m.key} style={{ ...s.tab, ...(mode === i ? s.tabActive : s.tabInactive) }}
              onClick={() => switchMode(i)} type="button">
              {m.label}
            </button>
          ))}
        </div>

        {error && <div style={s.err}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={s.group}>
            <label style={s.label}>{currentMode.label}</label>
            <input style={s.input}
              type={currentMode.type || 'text'}
              placeholder={currentMode.placeholder}
              maxLength={currentMode.maxLength}
              value={identifier}
              onChange={e => setId(e.target.value)}
              required />
          </div>
          <div style={s.group}>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" placeholder="Enter your password"
              value={password} onChange={e => setPwd(e.target.value)} required />
          </div>
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div style={s.footer}>
          <Link to="/forgot-password" style={s.link}>Forgot Password?</Link>
          {' · '}
          <Link to="/forgot-account-number" style={s.link}>Forgot Account Number?</Link>
        </div>
        <div style={s.footer}>
          <Link to="/signup" style={s.link}>Create Account</Link>
          {' · '}
          <Link to="/admin/login" style={{ ...s.link, color: '#aaa' }}>Admin Login →</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
