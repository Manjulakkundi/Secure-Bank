/**
 * Admin App — Login Page (Redesigned Enterprise Fintech UI)
 * Features:
 * - Full-screen split layout:
 *   • Left: Cinematic enhanced bank architectural visual:
 *     - Soft radial vignette darkening outer edges
 *     - Central building focal spotlight & column highlights
 *     - Subtle fintech teal/blue atmospheric tone
 *     - Preserved warm golden light reflections & floor contrast
 *     - Pure cinematic visual (strictly zero text, logos, or UI elements)
 *   • Right: Clean modern white authentication panel
 * - Strict 8px border radius & Inter typography
 * - Div-based form handling with Enter key submission support
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';

const AdminLogin = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [isBtnHovered, setIsBtnHovered] = useState(false);

  const { login, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, navigate]);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter both admin username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await API.post('/admin/login', form);
      if (data.success) {
        login(data.data.token);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid administrator credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'row',
      backgroundColor: '#0A1628',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#0F172A',
      overflow: 'hidden',
    },
    // Left Visual Image Panel with Professional Cinematic Shading & Lighting
    leftPanel: {
      flex: '1.25',
      position: 'relative',
      backgroundImage: 'url("/bank_login_bg.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      filter: 'contrast(106%) brightness(98%) saturate(104%)',
      overflow: 'hidden',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    },
    // 1. Soft Cinematic Vignette Overlay (Darkens outer edges subtly)
    vignetteOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse 75% 65% at 50% 48%, rgba(10, 22, 40, 0) 35%, rgba(10, 22, 40, 0.38) 75%, rgba(10, 22, 40, 0.75) 100%)',
      pointerEvents: 'none',
    },
    // 2. Directional Lighting & Fintech Atmosphere Gradient (Subtle blue/teal glow)
    atmosphereOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(145deg, rgba(15, 42, 74, 0.22) 0%, rgba(13, 148, 136, 0.07) 38%, rgba(10, 22, 40, 0.12) 68%, rgba(10, 22, 40, 0.55) 100%)',
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    },
    // 3. Central Building Focal Spotlight & Column Glow
    buildingFocalGlow: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse 48% 42% at 50% 45%, rgba(254, 240, 138, 0.14) 0%, rgba(245, 158, 11, 0.06) 45%, transparent 100%)',
      mixBlendMode: 'screen',
      pointerEvents: 'none',
    },
    // 4. Bottom Reflective Floor Shading & Horizon Depth
    floorShading: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(to top, rgba(10, 22, 40, 0.58) 0%, rgba(10, 22, 40, 0.18) 22%, transparent 48%)',
      pointerEvents: 'none',
    },
    // 5. Subtle Top Atmospheric Rim Light
    topRimLight: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '140px',
      background: 'linear-gradient(to bottom, rgba(10, 22, 40, 0.45) 0%, transparent 100%)',
      pointerEvents: 'none',
    },

    // Right Login Panel
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
      padding: '48px 44px',
      boxShadow: '0 20px 45px -10px rgba(10, 22, 40, 0.08), 0 0 1px 1px rgba(10, 22, 40, 0.04)',
      border: '1px solid #E2E8F0',
    },
    cardHeader: {
      marginBottom: '32px',
    },
    rolePill: {
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
      marginBottom: '14px',
    },
    loginTitle: {
      fontSize: '24px',
      fontWeight: '800',
      color: '#0A1628',
      letterSpacing: '-0.02em',
      margin: '0 0 8px 0',
    },
    loginSubtitle: {
      fontSize: '14px',
      color: '#64748B',
      margin: 0,
      lineHeight: '1.5',
    },
    errorAlert: {
      background: '#FFF1F2',
      border: '1px solid #FFE4E6',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      color: '#BE123C',
      fontSize: '13px',
      lineHeight: '1.4',
    },
    formGroup: {
      marginBottom: '20px',
    },
    labelWrapper: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px',
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
      transition: 'color 0.2s',
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
      marginTop: '28px',
      transition: 'all 0.2s ease',
      boxShadow: isDisabled ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.28)',
      transform: isHovered && !isDisabled ? 'translateY(-1px)' : 'none',
    }),
    portalSwitchCard: {
      marginTop: '28px',
      paddingTop: '24px',
      borderTop: '1px solid #F1F5F9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    portalText: {
      fontSize: '13px',
      color: '#64748B',
      margin: 0,
    },
    portalLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#2563EB',
      textDecoration: 'none',
      cursor: 'pointer',
      transition: 'color 0.15s ease',
    },
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          * { box-sizing: border-box; }
          input::placeholder { color: #94A3B8; font-weight: 400; }
          @media (max-width: 960px) {
            .admin-login-left-panel { display: none !important; }
            .admin-login-right-panel { flex: 1 !important; padding: 24px 16px !important; }
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

      {/* LEFT PANEL: Pure Bank Visual with Cinematic Shading & Lighting (No text, logos, or UI elements) */}
      <div style={styles.leftPanel} className="admin-login-left-panel">
        <div style={styles.vignetteOverlay} />
        <div style={styles.atmosphereOverlay} />
        <div style={styles.buildingFocalGlow} />
        <div style={styles.floorShading} />
        <div style={styles.topRimLight} />
      </div>

      {/* RIGHT PANEL: Clean White Auth Card */}
      <div style={styles.rightPanel} className="admin-login-right-panel">
        <div style={styles.loginCard}>
          <div style={styles.cardHeader}>
            <div style={styles.rolePill}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Administrator Portal</span>
            </div>
            <h2 style={styles.loginTitle}>Welcome Back</h2>
            <p style={styles.loginSubtitle}>
              Authenticate with your administrative credentials to access core controls.
            </p>
          </div>

          {/* Error Alert */}
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

          {/* Form container (No <form> tag) */}
          <div onKeyDown={handleKeyDown}>
            {/* Username Input */}
            <div style={styles.formGroup}>
              <div style={styles.labelWrapper}>
                <label style={styles.label}>Admin Username</label>
              </div>
              <div style={styles.inputContainer(focusedField === 'username')}>
                <div style={styles.inputIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="e.g. admin"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={styles.formGroup}>
              <div style={styles.labelWrapper}>
                <label style={styles.label}>Secret Key / Password</label>
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
                  placeholder="Enter administrator password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  disabled={loading}
                  autoComplete="current-password"
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
                  <span>Authenticating Session...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Portal</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Customer Portal Link */}
          <div style={styles.portalSwitchCard}>
            <p style={styles.portalText}>Looking for retail banking?</p>
            <a
              href="http://localhost:3000"
              style={styles.portalLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Customer Portal</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
