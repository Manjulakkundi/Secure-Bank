/**
 * components/auth/ForgotAccountNumber.js
 * Lets customers recover their account number via email.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../../services/api';

const s = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #1A3C5E 0%, #2E7D9A 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#fff', borderRadius: 16, padding: '48px 40px', width: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { color: '#1A3C5E', fontSize: 24, fontWeight: 700, marginBottom: 8 },
  sub: { color: '#666', fontSize: 14, marginBottom: 28 },
  label: { display: 'block', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 },
  input: { width: '100%', padding: '12px 14px', border: '2px solid #e0e0e0', borderRadius: 8,
           fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)',
         color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  err: { background: '#fde8e8', color: '#c0392b', padding: '10px', borderRadius: 7, marginBottom: 16, fontSize: 13 },
  ok: { background: '#d4edda', color: '#155724', padding: '14px', borderRadius: 7, marginBottom: 16, fontSize: 14 },
  link: { color: '#2E7D9A', textDecoration: 'none', fontWeight: 600 },
  footer: { textAlign: 'center', marginTop: 24, fontSize: 13, color: '#888' },
  group: { marginBottom: 20, textAlign: 'left' },
};

const ForgotAccountNumber = () => {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await API.post('/customer/forgot-account-number', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.icon}>🔍</div>
        <h2 style={s.title}>Forgot Account Number?</h2>
        <p style={s.sub}>Enter your registered email address and we'll send your account number to you.</p>

        {error && <div style={s.err}>{error}</div>}

        {sent ? (
          <>
            <div style={s.ok}>
              ✅ If this email is registered with SecureBank, your account number has been sent. Please check your inbox.
            </div>
            <div style={s.footer}>
              <Link to="/login" style={s.link}>← Back to Login</Link>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div style={s.group}>
                <label style={s.label}>Registered Email Address</label>
                <input style={s.input} type="email" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button style={s.btn} type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Account Number'}
              </button>
            </form>
            <div style={s.footer}>
              <Link to="/login" style={s.link}>← Back to Login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotAccountNumber;
