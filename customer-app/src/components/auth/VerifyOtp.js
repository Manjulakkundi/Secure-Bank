/**
 * components/auth/VerifyOtp.js
 * OTP email verification page after signup.
 * Shows account number success modal after verification.
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '../../services/api';

const s = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #1A3C5E 0%, #2E7D9A 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#fff', borderRadius: 16, padding: '48px 40px', width: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: '#1A3C5E', fontSize: 24, fontWeight: 700, marginBottom: 8 },
  sub: { color: '#666', fontSize: 14, marginBottom: 32 },
  input: { width: '100%', padding: '16px', border: '2px solid #e0e0e0', borderRadius: 8,
           fontSize: 28, textAlign: 'center', letterSpacing: 12, fontWeight: 700, outline: 'none',
           boxSizing: 'border-box', marginBottom: 20 },
  btn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)',
         color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12 },
  resend: { background: 'transparent', border: '2px solid #2E7D9A', color: '#2E7D9A',
            width: '100%', padding: '11px', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  err: { background: '#fde8e8', color: '#c0392b', padding: '10px', borderRadius: 7,
         marginBottom: 16, fontSize: 13 },
  ok: { background: '#d4edda', color: '#155724', padding: '10px', borderRadius: 7,
        marginBottom: 16, fontSize: 13 },
  // Success modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
             alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 420, width: '90%',
           textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.4)' },
  modalIcon: { fontSize: 56, marginBottom: 12 },
  modalTitle: { color: '#1E8449', fontSize: 22, fontWeight: 700, marginBottom: 8 },
  modalSub: { color: '#555', fontSize: 14, marginBottom: 24 },
  accBox: { background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)', borderRadius: 12,
            padding: '20px 24px', margin: '0 0 16px 0' },
  accLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, letterSpacing: 1, marginBottom: 6 },
  accNum: { color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: 4, fontFamily: 'monospace' },
  warning: { background: '#fff8e1', border: '1px solid #f9a825', borderRadius: 8, padding: '12px 16px',
             color: '#795548', fontSize: 13, marginBottom: 24, textAlign: 'left' },
  modalBtn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
};

const VerifyOtp = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const email     = location.state?.email || '';
  const accountNumber = location.state?.accountNumber || '';

  const [otp, setOtp]           = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleVerify = async () => {
    setError(''); setLoading(true);
    try {
      const { data } = await API.post('/customer/verify-otp', { email, otp });
      if (data.success) {
        setSuccess('Email verified successfully!');
        setShowModal(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setError(''); setSuccess('');
    try {
      await API.post('/customer/resend-otp', { email });
      setSuccess('New OTP sent to your email!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    }
  };

  const goToLogin = () => {
    setShowModal(false);
    navigate('/login');
  };

  return (
    <div style={s.page}>
      {/* Account Number Success Modal */}
      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalIcon}>🎉</div>
            <h2 style={s.modalTitle}>Account Created Successfully!</h2>
            <p style={s.modalSub}>Your email has been verified. Here is your account number:</p>
            <div style={s.accBox}>
              <div style={s.accLabel}>YOUR ACCOUNT NUMBER</div>
              <div style={s.accNum}>{accountNumber || 'See your email'}</div>
            </div>
            <div style={s.warning}>
              ⚠️ <strong>Important:</strong> Please save this account number. You will need it to log in to SecureBank. It has also been sent to your registered email.
            </div>
            <button style={s.modalBtn} onClick={goToLogin}>
              Continue to Login →
            </button>
          </div>
        </div>
      )}

      <div style={s.card}>
        <div style={s.icon}>📧</div>
        <h2 style={s.title}>Verify Your Email</h2>
        <p style={s.sub}>We sent a 6-digit OTP to<br /><strong>{email}</strong></p>
        {error && <div style={s.err}>{error}</div>}
        {success && !showModal && <div style={s.ok}>{success}</div>}
        <input style={s.input} type="text" maxLength={6} placeholder="000000"
          value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} />
        <button style={s.btn} onClick={handleVerify} disabled={loading || otp.length !== 6}>
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>
        <button style={s.resend} onClick={handleResend}>Resend OTP</button>
      </div>
    </div>
  );
};

export default VerifyOtp;
