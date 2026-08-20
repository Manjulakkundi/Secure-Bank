/**
 * Customer App — Login.js (High-Quality Photographic Fintech Customer Login)
 * Features:
 * - High-quality, static photographic visual (/customer_login_bg.jpg) with no animations
 * - Professional cinematic lighting, subtle vignette, and fintech blue/teal atmospheric depth
 * - Preserved SecureBank brand header and bottom tagline card: "Your money. Your future. Securely managed."
 * - Clean white customer login card with multi-mode switcher (Account No / Email / Phone)
 * - All existing auth logic, API endpoints, and context hooks preserved
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';

const LOGIN_MODES = [
  { key: 'accountNumber', label: 'Account No', placeholder: '12-digit account number', maxLength: 12, icon: 'user' },
  { key: 'email',         label: 'Email',      placeholder: 'name@example.com',        type: 'email', icon: 'mail' },
  { key: 'phone',         label: 'Phone',      placeholder: '10-digit mobile number',  maxLength: 10, icon: 'phone' },
];

const Login = () => {
  const [mode, setMode] = useState(0);
  const [identifier, setId] = useState('');
  const [password, setPwd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [isBtnHovered, setIsBtnHovered] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const currentMode = LOGIN_MODES[mode];

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please provide both your credential identifier and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = { password, identifier: identifier.trim(), [currentMode.key]: identifier.trim() };
      const { data } = await API.post('/customer/login', payload);
      if (data.success) {
        login(data.data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const switchMode = (idx) => {
    setMode(idx);
    setId('');
    setError('');
  };

  const styles = {
    page: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'row',
      backgroundColor: '#0A1628',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#0F172A',
      overflow: 'hidden',
    },
    // Left Visual Section (Pure high-quality image with lighting & preserved text)
    leftPanel: {
      flex: '1.25',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '44px 48px',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      backgroundColor: '#0A1628',
    },
    // High-Quality Photographic Background
    photoLayer: {
      position: 'absolute',
      inset: 0,
      backgroundImage: 'url("/customer_login_bg.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center 40%',
      backgroundRepeat: 'no-repeat',
      filter: 'contrast(105%) brightness(96%) saturate(106%)',
    },
    // Subtle Vignette & Atmosphere (Enhances readability & cinematic depth)
    vignetteOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse 80% 75% at 50% 50%, rgba(10, 22, 40, 0.08) 20%, rgba(10, 22, 40, 0.5) 75%, rgba(10, 22, 40, 0.85) 100%)',
      pointerEvents: 'none',
    },
    atmosphereOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(160deg, rgba(15, 34, 64, 0.35) 0%, rgba(13, 148, 136, 0.1) 40%, rgba(10, 22, 40, 0.25) 70%, rgba(10, 22, 40, 0.8) 100%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    },
    // Top Brand Bar
    brandHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      zIndex: 10,
    },
    logoBox: {
      width: '42px',
      height: '42px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #2563EB 0%, #0D9488 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)',
      color: '#FFFFFF',
    },
    brandTitle: {
      fontSize: '22px',
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: '-0.02em',
      margin: 0,
    },
    brandBadge: {
      background: 'rgba(37, 99, 235, 0.25)',
      border: '1px solid rgba(96, 165, 250, 0.3)',
      color: '#93C5FD',
      fontSize: '10px',
      fontWeight: '700',
      padding: '3px 8px',
      borderRadius: '6px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginLeft: '8px',
    },
    // Bottom Tagline & Value Proposition
    bottomTaglineBox: {
      zIndex: 10,
      background: 'rgba(10, 22, 40, 0.72)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '16px',
      padding: '24px 28px',
      maxWidth: '480px',
    },
    taglineTitle: {
      fontSize: '20px',
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: '-0.02em',
      margin: '0 0 6px 0',
    },
    taglineSub: {
      fontSize: '13px',
      color: '#CBD5E1',
      lineHeight: '1.5',
      margin: 0,
    },
    trustBadgeRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      marginTop: '14px',
      paddingTop: '12px',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      fontSize: '11px',
      color: '#94A3B8',
      fontWeight: '600',
    },
    trustPill: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },

    // Right Side: Clean Fintech Login Card
    rightPanel: {
      flex: '1',
      background: '#F8FAFC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 32px',
      position: 'relative',
    },
    loginCard: {
      background: '#FFFFFF',
      borderRadius: '16px',
      width: '100%',
      maxWidth: '460px',
      padding: '44px 40px',
      boxShadow: '0 20px 45px -10px rgba(10, 22, 40, 0.08), 0 0 1px 1px rgba(10, 22, 40, 0.04)',
      border: '1px solid #E2E8F0',
    },
    cardHeader: {
      marginBottom: '24px',
    },
    retailPill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: '#EFF6FF',
      border: '1px solid #DBEAFE',
      color: '#1D4ED8',
      fontSize: '11px',
      fontWeight: '700',
      padding: '4px 10px',
      borderRadius: '6px',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      marginBottom: '12px',
    },
    loginTitle: {
      fontSize: '24px',
      fontWeight: '800',
      color: '#0A1628',
      letterSpacing: '-0.02em',
      margin: '0 0 6px 0',
    },
    loginSubtitle: {
      fontSize: '14px',
      color: '#64748B',
      margin: 0,
      lineHeight: '1.5',
    },
    tabContainer: {
      display: 'flex',
      background: '#F1F5F9',
      borderRadius: '8px',
      padding: '4px',
      gap: '4px',
      marginBottom: '22px',
      border: '1px solid #E2E8F0',
    },
    tabItem: (isActive) => ({
      flex: 1,
      padding: '8px 10px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      background: isActive ? '#FFFFFF' : 'transparent',
      color: isActive ? '#0A1628' : '#64748B',
      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
      transition: 'all 0.18s ease',
    }),
    errorAlert: {
      background: '#FFF1F2',
      border: '1px solid #FFE4E6',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      color: '#BE123C',
      fontSize: '13px',
      lineHeight: '1.4',
    },
    formGroup: {
      marginBottom: '18px',
    },
    labelWrapper: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '7px',
    },
    label: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#334155',
    },
    inputContainer: (isFocused) => ({
      display: 'flex',
      alignItems: 'center',
      background: isFocused ? '#FFFFFF' : '#F8FAFC',
      border: `1.5px solid ${isFocused ? '#2563EB' : '#E2E8F0'}`,
      borderRadius: '8px',
      padding: '0 14px',
      height: '46px',
      transition: 'all 0.2s ease',
      boxShadow: isFocused ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
    }),
    inputIcon: {
      color: '#94A3B8',
      marginRight: '12px',
      display: 'flex',
      alignItems: 'center',
    },
    input: {
      width: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontSize: '14px',
      color: '#0F172A',
      fontFamily: 'inherit',
      fontWeight: '500',
    },
    passwordToggle: {
      background: 'none',
      border: 'none',
      color: '#94A3B8',
      cursor: 'pointer',
      padding: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      outline: 'none',
    },
    submitButton: (isHovered, isDisabled) => ({
      width: '100%',
      height: '48px',
      background: isDisabled
        ? '#94A3B8'
        : isHovered
        ? '#1D4ED8'
        : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      letterSpacing: '0.01em',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      marginTop: '24px',
      transition: 'all 0.2s ease',
      boxShadow: isDisabled ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.28)',
      transform: isHovered && !isDisabled ? 'translateY(-1px)' : 'none',
    }),
    linksRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '20px',
      fontSize: '13px',
    },
    navLink: {
      color: '#2563EB',
      textDecoration: 'none',
      fontWeight: '600',
    },
    registerCard: {
      marginTop: '24px',
      paddingTop: '20px',
      borderTop: '1px solid #F1F5F9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '13px',
      color: '#64748B',
    },
    registerBtn: {
      color: '#2563EB',
      textDecoration: 'none',
      fontWeight: '700',
    },
    adminPortalRow: {
      textAlign: 'center',
      marginTop: '16px',
      fontSize: '12px',
      color: '#94A3B8',
    },
  };

  return (
    <div style={styles.page}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          * { box-sizing: border-box; }
          input::placeholder { color: #94A3B8; font-weight: 400; }

          @media (max-width: 960px) {
            .customer-login-page { flex-direction: column !important; }
            .customer-login-left-panel { min-height: 280px !important; flex: none !important; padding: 24px 20px !important; }
            .customer-login-right-panel { flex: 1 !important; padding: 28px 16px !important; }
            .customer-bottom-tagline { display: none !important; }
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .spinner {
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #FFFFFF;
            animation: spin 0.75s linear infinite;
          }
        `}
      </style>

      {/* LEFT PANEL: High-Quality Static Coin Stack Image with Preserved Taglines & Branding */}
      <div style={styles.leftPanel} className="customer-login-left-panel">
        {/* Crisp Photographic Layer */}
        <div style={styles.photoLayer} />

        {/* Ambient Shading & Cinematic Depth */}
        <div style={styles.vignetteOverlay} />
        <div style={styles.atmosphereOverlay} />

        {/* Top Brand Header */}
        <div style={styles.brandHeader}>
          <div style={styles.logoBox}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h2 style={styles.brandTitle}>SecureBank</h2>
              <span style={styles.brandBadge}>Retail Banking</span>
            </div>
          </div>
        </div>

        {/* Bottom Tagline & Trust Pillars */}
        <div style={styles.bottomTaglineBox} className="customer-bottom-tagline">
          <h1 style={styles.taglineTitle}>Your money. Your future. Securely managed.</h1>
          <p style={styles.taglineSub}>
            Automated wealth compounding with 256-bit core encryption and guaranteed liquidity across high-yield savings.
          </p>

          <div style={styles.trustBadgeRow}>
            <div style={styles.trustPill}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Zero-Trust Vault</span>
            </div>
            <div style={styles.trustPill}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>SOC-2 Type II</span>
            </div>
            <div style={styles.trustPill}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Instant Settlement</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Clean White Customer Login Card */}
      <div style={styles.rightPanel} className="customer-login-right-panel">
        <div style={styles.loginCard}>
          <div style={styles.cardHeader}>
            <div style={styles.retailPill}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Retail Customer Portal</span>
            </div>
            <h2 style={styles.loginTitle}>Welcome Back</h2>
            <p style={styles.loginSubtitle}>Secure banking starts here. Access your account effortlessly.</p>
          </div>

          {/* Mode Tabs (Account No / Email / Phone) */}
          <div style={styles.tabContainer}>
            {LOGIN_MODES.map((m, idx) => (
              <button
                key={m.key}
                type="button"
                style={styles.tabItem(mode === idx)}
                onClick={() => switchMode(idx)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Error Message Box */}
          {error && (
            <div style={styles.errorAlert}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>{error}</div>
            </div>
          )}

          {/* Div-based Form (No <form> tag) */}
          <div onKeyDown={handleKeyDown}>
            {/* Identifier Input */}
            <div style={styles.formGroup}>
              <div style={styles.labelWrapper}>
                <label style={styles.label}>Account Number / Email / Phone ({currentMode.label})</label>
              </div>
              <div style={styles.inputContainer(focusedField === 'identifier')}>
                <div style={styles.inputIcon}>
                  {mode === 0 ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ) : mode === 1 ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                  )}
                </div>
                <input
                  style={styles.input}
                  type={currentMode.type || 'text'}
                  placeholder={currentMode.placeholder}
                  maxLength={currentMode.maxLength}
                  value={identifier}
                  onChange={(e) => setId(e.target.value)}
                  onFocus={() => setFocusedField('identifier')}
                  onBlur={() => setFocusedField(null)}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={styles.formGroup}>
              <div style={styles.labelWrapper}>
                <label style={styles.label}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: '12px', color: '#2563EB', textDecoration: 'none', fontWeight: '600' }}>
                  Forgot?
                </Link>
              </div>
              <div style={styles.inputContainer(focusedField === 'password')}>
                <div style={styles.inputIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  style={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => setPwd(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  disabled={loading}
                />
                <button
                  type="button"
                  style={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              style={styles.submitButton(isBtnHovered, loading)}
              onMouseEnter={() => setIsBtnHovered(true)}
              onMouseLeave={() => setIsBtnHovered(false)}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  <span>Securing Session...</span>
                </>
              ) : (
                <>
                  <span>Login Securely</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Links & Recovery */}
          <div style={styles.linksRow}>
            <Link to="/forgot-account-number" style={styles.navLink}>
              Forgot Account Number?
            </Link>
          </div>

          {/* New Customer Registration Card */}
          <div style={styles.registerCard}>
            <span>New to SecureBank?</span>
            <Link to="/signup" style={styles.registerBtn}>
              Register New Account →
            </Link>
          </div>

          {/* Admin Switch Link */}
          <div style={styles.adminPortalRow}>
            <span>Bank employee? </span>
            <a href="http://localhost:3001" style={{ color: '#64748B', textDecoration: 'none', fontWeight: '600' }} target="_blank" rel="noopener noreferrer">
              Admin Portal →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
