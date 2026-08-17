/**
 * Customer App — Navbar.js (Fintech Top Navigation Bar)
 * Features:
 * - Brand logo with SecureBank badge
 * - Navigation links: Dashboard, Payments (Transfer), Accounts (History), Loans, Beneficiaries, Statements
 * - Notification Bell with unread badge
 * - Profile avatar dropdown with user info, profile link & logout
 * - Single source of truth for customer name via AuthContext
 * - Responsive mobile drawer toggle
 */
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/transfer', label: 'Payments' },
    { to: '/transactions', label: 'Accounts' },
    { to: '/investments', label: 'Investments' },
    { to: '/loans', label: 'Loans' },
    { to: '/beneficiaries', label: 'Beneficiaries' },
    { to: '/statement', label: 'Statements' },
  ];


  const displayName = user?.customerName || user?.username || 'Account';
  const displayEmail = user?.customerEmail || user?.email || '';
  const firstName = user?.customerName
    ? user.customerName.trim().split(' ')[0]
    : user?.username || 'Account';

  const initials = user?.customerName
    ? user.customerName
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'SB';

  const styles = {
    header: {
      background: '#0A1628',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    navContainer: {
      maxWidth: '1360px',
      margin: '0 auto',
      padding: '0 24px',
      height: '68px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    leftBrandGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '36px',
    },
    brandLink: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      textDecoration: 'none',
    },
    logoBox: {
      width: '38px',
      height: '38px',
      borderRadius: '10px',
      background: 'linear-gradient(135deg, #2563EB 0%, #0D9488 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
    },
    brandTitle: {
      fontSize: '19px',
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: '-0.02em',
      margin: 0,
    },
    brandBadge: {
      background: 'rgba(37, 99, 235, 0.25)',
      border: '1px solid rgba(96, 165, 250, 0.3)',
      color: '#93C5FD',
      fontSize: '9px',
      fontWeight: '700',
      padding: '2px 6px',
      borderRadius: '4px',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      marginLeft: '8px',
    },
    navLinksGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    navLink: (isActive) => ({
      color: isActive ? '#FFFFFF' : '#94A3B8',
      fontSize: '13px',
      fontWeight: isActive ? '600' : '500',
      textDecoration: 'none',
      padding: '8px 14px',
      borderRadius: '8px',
      background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
      transition: 'all 0.15s ease',
    }),
    rightControls: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    },
    iconBtn: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '10px',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#94A3B8',
      cursor: 'pointer',
      position: 'relative',
      transition: 'all 0.15s ease',
    },
    notifBadge: {
      position: 'absolute',
      top: '8px',
      right: '8px',
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      backgroundColor: '#10B981',
      boxShadow: '0 0 6px #10B981',
    },
    avatarBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '24px',
      padding: '4px 12px 4px 4px',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    },
    avatarCircle: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarName: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#FFFFFF',
      maxWidth: '110px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    // Dropdowns
    dropdown: {
      position: 'absolute',
      right: 0,
      top: '52px',
      width: '240px',
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 20px 35px -8px rgba(10, 22, 40, 0.18)',
      padding: '8px',
      zIndex: 1100,
    },
    dropdownHeader: {
      padding: '12px 14px',
      borderBottom: '1px solid #F1F5F9',
      marginBottom: '4px',
    },
    dropdownItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '500',
      color: '#334155',
      textDecoration: 'none',
      cursor: 'pointer',
      border: 'none',
      background: 'transparent',
      width: '100%',
      textAlign: 'left',
      boxSizing: 'border-box',
    },
    logoutItem: {
      color: '#BE123C',
      borderTop: '1px solid #F1F5F9',
      marginTop: '4px',
      paddingTop: '10px',
    },
  };

  return (
    <header style={styles.header}>
      <style>
        {`
          .nav-hover-link:hover { color: #FFFFFF !important; background: rgba(255, 255, 255, 0.08) !important; }
          .icon-hover-btn:hover { background: rgba(255, 255, 255, 0.12) !important; color: #FFFFFF !important; }
          .drop-item:hover { background-color: #F8FAFC !important; color: #0A1628 !important; }
          .drop-logout:hover { background-color: #FFF1F2 !important; color: #E11D48 !important; }
          @media (max-width: 900px) {
            .desktop-nav-links { display: none !important; }
            .mobile-menu-btn { display: flex !important; }
          }
          @media (min-width: 901px) {
            .mobile-menu-btn { display: none !important; }
            .mobile-drawer { display: none !important; }
          }
        `}
      </style>

      <div style={styles.navContainer}>
        {/* Brand & Desktop Links */}
        <div style={styles.leftBrandGroup}>
          <Link to="/dashboard" style={styles.brandLink}>
            <div style={styles.logoBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={styles.brandTitle}>SecureBank</span>
              <span style={styles.brandBadge}>Retail</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav style={styles.navLinksGroup} className="desktop-nav-links">
            {navLinks.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={styles.navLink(isActive)}
                  className="nav-hover-link"
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Controls (Notifications & User Profile) */}
        <div style={styles.rightControls}>
          {/* Notification Bell */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              style={styles.iconBtn}
              className="icon-hover-btn"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              title="Notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span style={styles.notifBadge} />
            </button>

            {notificationsOpen && (
              <div style={{ ...styles.dropdown, width: '280px' }}>
                <div style={styles.dropdownHeader}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0A1628' }}>System Notifications</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Real-time account alerts</div>
                </div>
                <div style={{ padding: '8px 10px', fontSize: '12px', color: '#334155', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ fontWeight: '600', color: '#059669', marginBottom: '2px' }}>✓ Security Shield Active</div>
                  <div style={{ color: '#64748B' }}>Two-factor authentication enabled on your profile.</div>
                </div>
                <div style={{ padding: '8px 10px', fontSize: '12px', color: '#334155' }}>
                  <div style={{ fontWeight: '600', color: '#2563EB', marginBottom: '2px' }}>Core Ledger Synced</div>
                  <div style={{ color: '#64748B' }}>Live balance &amp; transaction records up to date.</div>
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div style={{ position: 'relative' }} ref={profileRef}>
            <div
              style={styles.avatarBtn}
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <div style={styles.avatarCircle}>{initials}</div>
              <span style={styles.avatarName}>{firstName}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {profileOpen && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownHeader}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0A1628' }}>{displayName}</div>
                  {displayEmail && <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayEmail}</div>}
                </div>

                <Link
                  to="/profile"
                  style={styles.dropdownItem}
                  className="drop-item"
                  onClick={() => setProfileOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>My Profile</span>
                </Link>

                <Link
                  to="/statement"
                  style={styles.dropdownItem}
                  className="drop-item"
                  onClick={() => setProfileOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>Account Statements</span>
                </Link>

                <button
                  style={{ ...styles.dropdownItem, ...styles.logoutItem }}
                  className="drop-logout"
                  onClick={handleLogout}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Log Out Securely</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            style={styles.iconBtn}
            className="mobile-menu-btn icon-hover-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{ background: '#0F2347', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)' }} className="mobile-drawer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                style={{ color: '#E2E8F0', padding: '10px 0', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
