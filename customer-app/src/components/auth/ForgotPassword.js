/**
 * components/auth/ForgotPassword.js
 * Step 1 — enter email. Step 2 — enter OTP + new password.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../../services/api';

const s = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #1A3C5E 0%, #2E7D9A 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#fff', borderRadius: 16, padding: '48px 40px', width: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  title: { color: '#1A3C5E', fontSize: 24, fontWeight: 700, marginBottom: 8, textAlign: 'center' },
  sub: { color: '#888', fontSize: 13, marginBottom: 28, textAlign: 'center' },
  group: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 },
  input: { width: '100%', padding: '12px 14px', border: '2px solid #e0e0e0', borderRadius: 7,
           fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)',
         color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  err: { background: '#fde8e8', color: '#c0392b', padding: '10px', borderRadius: 7,
         marginBottom: 16, fontSize: 13, textAlign: 'center' },
  ok: { background: '#d4edda', color: '#155724', padding: '10px', borderRadius: 7,
        marginBottom: 16, fontSize: 13, textAlign: 'center' },
  footer: { textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' },
  link: { color: '#2E7D9A', textDecoration: 'none', fontWeight: 600 },
};

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const sendOtp = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await API.post('/customer/forgot-password', { email });
      setSuccess('OTP sent! Check your email.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const resetPassword = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await API.post('/customer/reset-password', { email, otp, newPassword });
      if (data.success) {
        setSuccess('Password reset! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>🔑 {step === 1 ? 'Forgot Password' : 'Reset Password'}</h2>
        <p style={s.sub}>{step === 1 ? 'Enter your email to receive an OTP' : `OTP sent to ${email}`}</p>
        {error && <div style={s.err}>{error}</div>}
        {success && <div style={s.ok}>{success}</div>}
        {step === 1 ? (
          <form onSubmit={sendOtp}>
            <div style={s.group}>
              <label style={s.label}>Email Address</label>
              <input style={s.input} type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword}>
            <div style={s.group}>
              <label style={s.label}>OTP Code</label>
              <input style={{ ...s.input, letterSpacing: 8, textAlign: 'center', fontSize: 20 }}
                type="text" maxLength={6} placeholder="000000"
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required />
            </div>
            <div style={s.group}>
              <label style={s.label}>New Password</label>
              <input style={s.input} type="password" placeholder="Min 8 chars, uppercase + number + symbol"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            </div>
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
        <div style={s.footer}><Link to="/login" style={s.link}>← Back to Login</Link></div>
      </div>
    </div>
  );
};

export default ForgotPassword;
