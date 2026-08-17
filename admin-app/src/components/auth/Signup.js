/**
 * components/auth/Signup.js
 * Registration form — on success navigates to OTP verification.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../../services/api';

const s = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #1A3C5E 0%, #2E7D9A 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' },
  card: { background: '#fff', borderRadius: 16, padding: '40px', width: '100%', maxWidth: 520,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  title: { textAlign: 'center', color: '#1A3C5E', fontSize: 24, fontWeight: 700, marginBottom: 8 },
  sub: { textAlign: 'center', color: '#888', fontSize: 13, marginBottom: 28 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  group: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 },
  input: { width: '100%', padding: '11px 13px', border: '2px solid #e0e0e0', borderRadius: 7,
           fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '11px 13px', border: '2px solid #e0e0e0', borderRadius: 7,
            fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' },
  btn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)',
         color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  err: { background: '#fde8e8', color: '#c0392b', padding: '10px', borderRadius: 7,
         marginBottom: 16, fontSize: 13, textAlign: 'center' },
  footer: { textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' },
  link: { color: '#2E7D9A', textDecoration: 'none', fontWeight: 600 },
  note: { fontSize: 11, color: '#aaa', marginTop: 4 },
};

const Signup = () => {
  const [form, setForm] = useState({
    customerName: '', AccountType: 'Savings', customerPhone: '',
    customerEmail: '', customerAddress: '', customerCity: '', CustomerPassword: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.CustomerPassword !== confirmPassword) {
      return setError('Passwords do not match');
    }
    setLoading(true);
    try {
      const { data } = await API.post('/customer/signup', form);
      if (data.success) {
        navigate('/verify-otp', { state: { email: form.customerEmail, accountNumber: data.data.accountNumber } });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const inp = (key) => ({
    style: s.input, value: form[key],
    onChange: e => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>🏦 Create Account</h1>
        <p style={s.sub}>Join SecureBank — takes 2 minutes</p>
        {error && <div style={s.err}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={s.row}>
            <div style={s.group}>
              <label style={s.label}>Full Name *</label>
              <input {...inp('customerName')} placeholder="Your full name" required />
            </div>
            <div style={s.group}>
              <label style={s.label}>Account Type *</label>
              <select style={s.select} value={form.AccountType}
                onChange={e => setForm({ ...form, AccountType: e.target.value })}>
                <option value="Savings">Savings</option>
                <option value="Current">Current</option>
              </select>
            </div>
          </div>
          <div style={s.row}>
            <div style={s.group}>
              <label style={s.label}>Email Address *</label>
              <input {...inp('customerEmail')} type="email" placeholder="you@example.com" required />
            </div>
            <div style={s.group}>
              <label style={s.label}>Phone Number *</label>
              <input {...inp('customerPhone')} placeholder="10-digit mobile" maxLength={10} required />
            </div>
          </div>
          <div style={s.group}>
            <label style={s.label}>Address *</label>
            <input {...inp('customerAddress')} placeholder="Street address" required />
          </div>
          <div style={s.group}>
            <label style={s.label}>City *</label>
            <input {...inp('customerCity')} placeholder="Your city" required />
          </div>
          <div style={s.row}>
            <div style={s.group}>
              <label style={s.label}>Password *</label>
              <input {...inp('CustomerPassword')} type="password" placeholder="Min 8 chars" required />
              <p style={s.note}>Uppercase + number + special char required</p>
            </div>
            <div style={s.group}>
              <label style={s.label}>Confirm Password *</label>
              <input style={s.input} type="password" placeholder="Repeat password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
          </div>
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <div style={s.footer}>
          Already have an account? <Link to="/login" style={s.link}>Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
