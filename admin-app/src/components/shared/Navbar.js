/**
 * Admin App — Vertical Sidebar Navigation (Fintech Enterprise Design)
 * Features:
 * - Dark gradient vertical sidebar with crisp SVG icons
 * - Active route indicator with electric blue glow
 * - Real-time system status pill
 * - Admin profile card with avatar initials & logout action
 * - Responsive collapsible support
 */
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredPath, setHoveredPath] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#60A5FA' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      to: '/customers',
      label: 'Customers',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#60A5FA' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      to: '/investments',
      label: 'Investments (FD/RD)',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#60A5FA' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
    },
    {
      to: '/transactions',
      label: 'Transactions',

      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#60A5FA' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      ),
    },
    {
      to: '/loans',
      label: 'Loan Applications',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#60A5FA' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    },
    {
      to: '/fraud-alerts',
      label: 'Fraud Sentry',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#F87171' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    {
      to: '/audit-logs',
      label: 'Audit Trail',
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#60A5FA' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
  ];

  const userInitial = user?.username ? user.username.charAt(0).toUpperCase() : 'A';

  const styles = {
    sidebar: {
      width: '260px',
      minWidth: '260px',
      height: '100vh',
      background: 'linear-gradient(180deg, #0A1628 0%, #0D1F3C 100%)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      userSelect: 'none',
    },
    topSection: {
      padding: '24px 20px',
    },
    brandContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      textDecoration: 'none',
      marginBottom: '28px',
      padding: '0 4px',
    },
    logoBox: {
      width: '38px',
      height: '38px',
      borderRadius: '10px',
      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
    },
    brandName: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: '-0.02em',
      margin: 0,
    },
    badge: {
      background: 'rgba(37, 99, 235, 0.25)',
      border: '1px solid rgba(96, 165, 250, 0.3)',
      color: '#93C5FD',
      fontSize: '9px',
      fontWeight: '700',
      padding: '2px 6px',
      borderRadius: '4px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginLeft: '6px',
    },
    systemStatus: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: 'rgba(255, 255, 255, 0.04)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '8px',
      marginBottom: '24px',
    },
    liveDot: {
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      backgroundColor: '#10B981',
      boxShadow: '0 0 8px #10B981',
    },
    statusText: {
      fontSize: '11px',
      fontWeight: '600',
      color: '#94A3B8',
      letterSpacing: '0.02em',
    },
    navGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    navItem: (isActive, isHovered) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '11px 14px',
      borderRadius: '8px',
      textDecoration: 'none',
      fontSize: '13px',
      fontWeight: isActive ? '600' : '500',
      color: isActive ? '#FFFFFF' : isHovered ? '#E2E8F0' : '#94A3B8',
      background: isActive
        ? 'rgba(37, 99, 235, 0.16)'
        : isHovered
        ? 'rgba(255, 255, 255, 0.05)'
        : 'transparent',
      borderLeft: `3px solid ${isActive ? '#2563EB' : 'transparent'}`,
      transition: 'all 0.18s ease',
    }),
    bottomSection: {
      padding: '20px',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      background: 'rgba(10, 22, 40, 0.4)',
    },
    userCard: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '14px',
    },
    userInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    avatar: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: '14px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    },
    userName: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#FFFFFF',
      margin: 0,
    },
    userRole: {
      fontSize: '11px',
      color: '#64748B',
      margin: 0,
    },
    logoutBtn: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '9px',
      background: 'rgba(244, 63, 94, 0.1)',
      border: '1px solid rgba(244, 63, 94, 0.2)',
      borderRadius: '8px',
      color: '#FB7185',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.18s ease',
    },
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.topSection}>
        {/* Brand Header */}
        <Link to="/dashboard" style={styles.brandContainer}>
          <div style={styles.logoBox}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h1 style={styles.brandName}>SecureBank</h1>
              <span style={styles.badge}>Admin</span>
            </div>
          </div>
        </Link>

        {/* Live System Status Pill */}
        <div style={styles.systemStatus}>
          <span style={styles.liveDot} />
          <span style={styles.statusText}>Core Network Online</span>
        </div>

        {/* Navigation Items */}
        <nav style={styles.navGroup}>
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            const isHovered = hoveredPath === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                style={styles.navItem(isActive, isHovered)}
                onMouseEnter={() => setHoveredPath(item.to)}
                onMouseLeave={() => setHoveredPath(null)}
              >
                {item.icon(isActive)}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div style={styles.bottomSection}>
        <div style={styles.userCard}>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>{userInitial}</div>
            <div>
              <p style={styles.userName}>{user?.username || 'Administrator'}</p>
              <p style={styles.userRole}>Super Admin</p>
            </div>
          </div>
        </div>

        <button
          style={styles.logoutBtn}
          onClick={handleLogout}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F43F5E';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)';
            e.currentTarget.style.color = '#FB7185';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
};

export default Navbar;
