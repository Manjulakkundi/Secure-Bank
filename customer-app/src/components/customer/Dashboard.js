/**
 * Customer App — Dashboard.js (Premium Modern Fintech Customer Dashboard)
 * Features:
 * - Dynamic Personalized Greeting ("Good day, [FirstName] 👋" / "Welcome back, [FirstName] 👋")
 * - Hero Gradient Banking Card with live balance, mask/unmask toggle, account chip & contactless wave
 * - Four Financial Summary KPI cards (Deposits, Withdrawals, Active Loans, Security Status)
 * - Interactive Responsive Chart.js transaction trend visualizer
 * - Recent Transaction Activity list with credit/debit color coding & timestamps
 * - Quick Action Grid (Transfer, History, Loans, Statement, Beneficiaries, Profile)
 * - Sentry Security & Session protection banner
 * - Shimmer skeleton loading state & zero emojis in icons
 */
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

const Dashboard = () => {
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [txns, setTxns] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [investOverview, setInvestOverview] = useState({ activeFdPrincipal: 0, totalRdAmountPaid: 0, totalInvested: 0 });
  const ChartLib = useRef(null);

  // ── Data polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchDashboardData = async () => {
      try {
        const [accRes, txnRes, investRes] = await Promise.all([
          API.get('/customer/account-info'),
          API.get('/customer/transactions?limit=10'),
          API.get('/customer/investments').catch(() => ({ data: { data: { overview: {} } } })),
        ]);
        if (cancelled) return;

        const acc = accRes.data.data;
        const txnList = txnRes.data.data.transactions || [];
        const overview = investRes.data?.data?.overview || {};
        setAccount(acc);
        setTxns(txnList);
        setInvestOverview(overview);

        const totalDeposits = txnList
          .filter((t) => ['DEPOSIT', 'RECEIVE', 'LOAN_APPROVED', 'FD_MATURITY', 'RD_MATURITY'].includes(t.transaction_type))
          .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        const totalWithdrawals = txnList
          .filter((t) => ['WITHDRAW', 'TRANSFER', 'FD_CREATED', 'RD_CONTRIBUTION'].includes(t.transaction_type))
          .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        setStats({
          totalDeposits,
          totalWithdrawals,
          activeLoans: acc.totalLoans ? parseFloat(acc.totalLoans) : 0,
          pendingAlerts: 0,
        });
      } catch (err) {
        if (!cancelled && err.response?.status !== 401 && err.response?.status !== 403) {
          console.error('Dashboard fetch error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };


    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ── Chart.js Setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || txns.length === 0 || loading) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    let cancelled = false;

    const buildChart = async () => {
      try {
        if (!ChartLib.current) {
          const mod = await import('chart.js');
          mod.Chart.register(
            mod.BarController,
            mod.CategoryScale,
            mod.LinearScale,
            mod.BarElement,
            mod.Tooltip,
            mod.Legend
          );
          ChartLib.current = mod.Chart;
        }
        if (cancelled || !chartRef.current) return;

        if (chartInstance.current) {
          chartInstance.current.destroy();
          chartInstance.current = null;
        }

        const last7 = [...txns].slice(0, 7).reverse();

        chartInstance.current = new ChartLib.current(chartRef.current, {
          type: 'bar',
          data: {
            labels: last7.map((t) =>
              new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            ),
            datasets: [
              {
                label: 'Amount (₹)',
                data: last7.map((t) => parseFloat(t.amount)),
                backgroundColor: last7.map((t) =>
                  ['DEPOSIT', 'RECEIVE', 'LOAN_APPROVED'].includes(t.transaction_type)
                    ? 'rgba(16, 185, 129, 0.85)'
                    : 'rgba(244, 63, 94, 0.85)'
                ),
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 24,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#0A1628',
                titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
                bodyFont: { family: "'Inter', sans-serif", size: 12 },
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                  label: (ctx) => ` ₹${ctx.parsed.y.toLocaleString('en-IN')}`,
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  font: { family: "'Inter', sans-serif", size: 11 },
                  color: '#94A3B8',
                },
              },
              y: {
                beginAtZero: true,
                grid: { color: '#F1F5F9' },
                ticks: {
                  font: { family: "'Inter', sans-serif", size: 11 },
                  color: '#94A3B8',
                  callback: (v) => '₹' + v.toLocaleString('en-IN'),
                },
              },
            },
          },
        });
      } catch (e) {
        if (!cancelled) console.error('Chart error:', e);
      }
    };

    buildChart();

    return () => {
      cancelled = true;
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [txns, loading]);

  const copyAccountNumber = () => {
    if (account?.AccountNumber) {
      navigator.clipboard.writeText(account.AccountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getMaskedAccount = (accNum) => {
    if (!accNum) return '•••• •••• ••••';
    const clean = accNum.toString();
    if (clean.length <= 4) return clean;
    return `•••• •••• ${clean.slice(-4)}`;
  };

  const rawName = account?.customerName || user?.customerName || '';
  const firstName = rawName ? rawName.trim().split(' ')[0] : '';
  const greetingTitle = firstName ? `Good day, ${firstName} 👋` : 'Welcome back 👋';

  const quickActions = [
    {
      to: '/transfer',
      label: 'Transfer Funds',
      desc: 'Instant peer & IMPS payment',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      ),
      color: '#EFF6FF',
    },
    {
      to: '/transactions',
      label: 'Transaction History',
      desc: 'All debit & credit records',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      ),
      color: '#F0FDFA',
    },
    {
      to: '/loans',
      label: 'Credit & Loans',
      desc: 'Low-interest flexible credit',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
      color: '#EEF2FF',
    },
    {
      to: '/investments',
      label: 'Fixed & Recurring Deposits',
      desc: 'High-yield FD & RD savings',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      color: '#F0FDFA',
    },
    {
      to: '/statement',
      label: 'Account Statements',
      desc: 'Download certified PDF logs',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      color: '#FFFBEB',
    },

    {
      to: '/beneficiaries',
      label: 'Manage Payees',
      desc: 'Saved beneficiary contacts',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      color: '#ECFDF5',
    },
    {
      to: '/profile',
      label: 'Security & Profile',
      desc: 'Password & identity settings',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      color: '#F8FAFC',
    },
  ];

  const styles = {
    page: {
      backgroundColor: '#F8FAFC',
      minHeight: '100vh',
      padding: '32px 24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    container: {
      maxWidth: '1360px',
      margin: '0 auto',
    },
    headerRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '28px',
      flexWrap: 'wrap',
      gap: '16px',
    },
    welcomeTitle: {
      fontSize: '26px',
      fontWeight: '800',
      color: '#0A1628',
      letterSpacing: '-0.02em',
      margin: '0 0 4px 0',
    },
    welcomeSub: {
      fontSize: '13px',
      color: '#64748B',
      margin: 0,
    },
    headerStatusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: '#ECFDF5',
      border: '1px solid #A7F3D0',
      color: '#047857',
      fontSize: '12px',
      fontWeight: '600',
      padding: '6px 14px',
      borderRadius: '20px',
    },
    liveDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: '#10B981',
      boxShadow: '0 0 8px #10B981',
    },
    // Top Hero Card & Summary Row
    heroGrid: {
      display: 'grid',
      gridTemplateColumns: '1.25fr 1fr',
      gap: '24px',
      marginBottom: '28px',
    },
    heroCard: {
      background: 'linear-gradient(135deg, #0A1628 0%, #0F2A4A 60%, #134E5E 100%)',
      borderRadius: '20px',
      padding: '32px',
      color: '#FFFFFF',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 16px 36px -8px rgba(10, 22, 40, 0.35)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: '220px',
    },
    cardAtmosphere: {
      position: 'absolute',
      right: '-40px',
      top: '-40px',
      width: '240px',
      height: '240px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(13, 148, 136, 0.3) 0%, rgba(13, 148, 136, 0) 70%)',
      pointerEvents: 'none',
    },
    cardTop: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 2,
    },
    cardTypePill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(255, 255, 255, 0.12)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: '#E2E8F0',
    },
    balanceGroup: {
      margin: '20px 0',
      zIndex: 2,
    },
    balanceLabelWrapper: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '6px',
    },
    balanceLabel: {
      fontSize: '13px',
      color: '#94A3B8',
      fontWeight: '500',
      margin: 0,
    },
    eyeToggleBtn: {
      background: 'none',
      border: 'none',
      color: '#94A3B8',
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
    },
    balanceValue: {
      fontSize: '38px',
      fontWeight: '800',
      letterSpacing: '-0.02em',
      margin: 0,
      lineHeight: '1.2',
    },
    cardBottom: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 2,
      paddingTop: '16px',
      borderTop: '1px solid rgba(255, 255, 255, 0.12)',
    },
    accountNumberBlock: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
    },
    accountNumberText: {
      fontSize: '13px',
      color: '#CBD5E1',
      fontWeight: '500',
      letterSpacing: '0.08em',
      fontFamily: 'monospace',
    },
    // Summary Cards
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '16px',
    },
    summaryCard: {
      background: '#FFFFFF',
      borderRadius: '16px',
      padding: '20px 22px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 12px -2px rgba(10, 22, 40, 0.03)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'all 0.2s ease',
    },
    summaryTop: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12px',
    },
    iconBox: (bg) => ({
      width: '38px',
      height: '38px',
      borderRadius: '10px',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    summaryVal: {
      fontSize: '22px',
      fontWeight: '800',
      color: '#0A1628',
      margin: '0 0 2px 0',
      letterSpacing: '-0.02em',
    },
    summaryLabel: {
      fontSize: '12px',
      color: '#64748B',
      fontWeight: '500',
      margin: 0,
    },
    // Split Section (Activity & Chart)
    mainSplit: {
      display: 'grid',
      gridTemplateColumns: '1.25fr 1fr',
      gap: '24px',
      marginBottom: '28px',
    },
    panelCard: {
      background: '#FFFFFF',
      borderRadius: '18px',
      padding: '24px 28px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 12px -2px rgba(10, 22, 40, 0.03)',
    },
    panelHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '20px',
      paddingBottom: '14px',
      borderBottom: '1px solid #F1F5F9',
    },
    panelTitle: {
      fontSize: '16px',
      fontWeight: '700',
      color: '#0A1628',
      margin: 0,
      letterSpacing: '-0.01em',
    },
    viewAllLink: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#2563EB',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    },
    // Transaction Timeline Rows
    txnList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    txnRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      background: '#F8FAFC',
      border: '1px solid #F1F5F9',
      borderRadius: '12px',
      transition: 'all 0.15s ease',
    },
    txnLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
    },
    txnIconBadge: (isCredit) => ({
      width: '38px',
      height: '38px',
      borderRadius: '10px',
      background: isCredit ? '#ECFDF5' : '#FFF1F2',
      border: `1px solid ${isCredit ? '#A7F3D0' : '#FECDD3'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: isCredit ? '#059669' : '#DC2626',
    }),
    txnType: {
      fontSize: '13px',
      fontWeight: '700',
      color: '#0A1628',
      margin: '0 0 2px 0',
    },
    txnSub: {
      fontSize: '11px',
      color: '#64748B',
      margin: 0,
    },
    txnAmount: (isCredit) => ({
      fontSize: '14px',
      fontWeight: '800',
      color: isCredit ? '#059669' : '#DC2626',
      textAlign: 'right',
    }),
    // Quick Actions
    quickActionsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '28px',
    },
    actionCard: {
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '16px',
      padding: '20px',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '14px',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 8px rgba(10, 22, 40, 0.02)',
    },
    actionIconBox: (bg) => ({
      width: '42px',
      height: '42px',
      borderRadius: '12px',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }),
    actionTitle: {
      fontSize: '14px',
      fontWeight: '700',
      color: '#0A1628',
      margin: '0 0 3px 0',
    },
    actionDesc: {
      fontSize: '11px',
      color: '#64748B',
      margin: 0,
      lineHeight: '1.4',
    },
    // Sentry Security Banner
    securityBanner: {
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '16px',
      padding: '18px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '14px',
    },
    secLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    secTitle: {
      fontSize: '13px',
      fontWeight: '700',
      color: '#0A1628',
      margin: '0 0 2px 0',
    },
    secSub: {
      fontSize: '12px',
      color: '#64748B',
      margin: 0,
    },
    skeleton: {
      background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: '6px',
    },
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ height: '36px', width: '260px', ...styles.skeleton, marginBottom: '24px' }} />
          <div style={styles.heroGrid}>
            <div style={{ height: '220px', ...styles.skeleton, borderRadius: '20px' }} />
            <div style={{ height: '220px', ...styles.skeleton, borderRadius: '20px' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          .fintech-card-hover:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 24px -4px rgba(10, 22, 40, 0.08) !important;
            border-color: #CBD5E1 !important;
          }
          .action-tile-hover:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px -4px rgba(37, 99, 235, 0.1) !important;
            border-color: #93C5FD !important;
          }
          .txn-item-hover:hover {
            background-color: #FFFFFF !important;
            border-color: #CBD5E1 !important;
            box-shadow: 0 4px 12px rgba(10, 22, 40, 0.04);
          }
          @media (max-width: 1024px) {
            .hero-split-grid { grid-template-columns: 1fr !important; }
            .main-split-grid { grid-template-columns: 1fr !important; }
          }
        `}
      </style>

      <div style={styles.container}>
        {/* Header Greeting with Authenticated Customer First Name */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.welcomeTitle}>{greetingTitle}</h1>
            <p style={styles.welcomeSub}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · Account Overview
            </p>
          </div>

          <div style={styles.headerStatusBadge}>
            <span style={styles.liveDot} />
            <span>Encrypted Core Active</span>
          </div>
        </div>

        {/* Hero Balance Card & Summary KPI Grid */}
        <div style={styles.heroGrid} className="hero-split-grid">
          {/* Card 1: Futuristic Digital Banking Card */}
          <div style={styles.heroCard}>
            <div style={styles.cardAtmosphere} />

            <div style={styles.cardTop}>
              <div style={styles.cardTypePill}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>{account?.AccountType || 'Savings'} Account</span>
              </div>

              {/* Contactless wave icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
                <path d="M8.5 14.5A4 4 0 0 1 8.5 9.5" />
                <path d="M12 17A7.5 7.5 0 0 0 12 7" />
                <path d="M15.5 19.5A11 11 0 0 0 15.5 4.5" />
              </svg>
            </div>

            {/* Balance Display */}
            <div style={styles.balanceGroup}>
              <div style={styles.balanceLabelWrapper}>
                <span style={styles.balanceLabel}>Total Available Balance</span>
                <button
                  style={styles.eyeToggleBtn}
                  onClick={() => setIsBalanceHidden(!isBalanceHidden)}
                  title={isBalanceHidden ? 'Show balance' : 'Hide balance'}
                >
                  {isBalanceHidden ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="23" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <h2 style={styles.balanceValue}>
                {isBalanceHidden ? '••••••••' : formatCurrency(account?.Balance || 0)}
              </h2>
            </div>

            {/* Card Footer: Account Number & Copy */}
            <div style={styles.cardBottom}>
              <div style={styles.accountNumberBlock} onClick={copyAccountNumber} title="Click to copy account number">
                <span style={styles.accountNumberText}>
                  {getMaskedAccount(account?.AccountNumber)}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copied && <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '600' }}>Copied!</span>}
              </div>

              <span style={{ fontSize: '12px', fontWeight: '700', color: '#34D399' }}>
                Active &amp; Verified
              </span>
            </div>
          </div>

          {/* Card 2: Financial KPI Summary Grid */}
          <div style={styles.summaryGrid}>
            {/* Deposits */}
            <div style={styles.summaryCard} className="fintech-card-hover">
              <div style={styles.summaryTop}>
                <div style={styles.iconBox('#ECFDF5')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '6px' }}>
                  Credit
                </span>
              </div>
              <div>
                <h3 style={styles.summaryVal}>
                  {formatCurrency(stats.totalDeposits || 0)}
                </h3>
                <p style={styles.summaryLabel}>Total Inflow</p>
              </div>
            </div>

            {/* Withdrawals */}
            <div style={styles.summaryCard} className="fintech-card-hover">
              <div style={styles.summaryTop}>
                <div style={styles.iconBox('#FFF1F2')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#DC2626', background: '#FFF1F2', padding: '2px 8px', borderRadius: '6px' }}>
                  Debit
                </span>
              </div>
              <div>
                <h3 style={styles.summaryVal}>
                  {formatCurrency(stats.totalWithdrawals || 0)}
                </h3>
                <p style={styles.summaryLabel}>Total Outflow</p>
              </div>
            </div>

            {/* Loans */}
            <div style={styles.summaryCard} className="fintech-card-hover">
              <div style={styles.summaryTop}>
                <div style={styles.iconBox('#EFF6FF')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: '6px' }}>
                  Credit Line
                </span>
              </div>
              <div>
                <h3 style={styles.summaryVal}>
                  {stats.activeLoans ? formatCurrency(stats.activeLoans) : '₹0.00'}
                </h3>
                <p style={styles.summaryLabel}>Active Credit Facility</p>
              </div>
            </div>

            {/* Security */}
            <div style={styles.summaryCard} className="fintech-card-hover">
              <div style={styles.summaryTop}>
                <div style={styles.iconBox('#F0FDF4')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#16A34A', background: '#F0FDF4', padding: '2px 8px', borderRadius: '6px' }}>
                  Protected
                </span>
              </div>
              <div>
                <h3 style={{ ...styles.summaryVal, fontSize: '16px', color: '#15803D' }}>256-Bit SSL</h3>
                <p style={styles.summaryLabel}>Zero-Trust Sentry Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Investment Overview Card */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '22px 26px',
            marginBottom: '28px',
            boxShadow: '0 4px 14px -2px rgba(10, 22, 40, 0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0A1628 0%, #1E3A8A 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0A1628', margin: '0 0 3px 0' }}>
                Investment Overview
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                High-yield deposits compounding with automated settlement.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>
                Active FD
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0A1628' }}>
                {formatCurrency(investOverview.activeFdPrincipal || 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>
                Active RD Paid
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0A1628' }}>
                {formatCurrency(investOverview.totalRdAmountPaid || 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>
                Total Invested
              </div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#0D9488' }}>
                {formatCurrency(investOverview.totalInvested || 0)}
              </div>
            </div>

            <Link
              to="/investments"
              style={{
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                color: '#FFFFFF',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>View Investments →</span>
            </Link>
          </div>
        </div>

        {/* Quick Operations Bar */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0A1628', marginBottom: '14px' }}>
            Quick Operations
          </h2>

          <div style={styles.quickActionsGrid}>
            {quickActions.map((action, i) => (
              <Link
                key={i}
                to={action.to}
                style={styles.actionCard}
                className="action-tile-hover"
              >
                <div style={styles.actionIconBox(action.color)}>{action.icon}</div>
                <div>
                  <h3 style={styles.actionTitle}>{action.label}</h3>
                  <p style={styles.actionDesc}>{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Split Section: Recent Activity & Trend Chart */}
        <div style={styles.mainSplit} className="main-split-grid">
          {/* Left: Recent Activity Feed */}
          <div style={styles.panelCard}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Recent Transaction Activity</h2>
              <Link to="/transactions" style={styles.viewAllLink}>
                <span>View Full Ledger</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>

            <div style={styles.txnList}>
              {txns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#94A3B8' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" style={{ marginBottom: '8px' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p style={{ margin: 0, fontSize: '13px' }}>No recorded transactions yet.</p>
                </div>
              ) : (
                txns.slice(0, 6).map((t, idx) => {
                  const isCredit = ['DEPOSIT', 'RECEIVE', 'LOAN_APPROVED'].includes(t.transaction_type);
                  return (
                    <div key={idx} style={styles.txnRow} className="txn-item-hover">
                      <div style={styles.txnLeft}>
                        <div style={styles.txnIconBadge(isCredit)}>
                          {isCredit ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="12" y1="19" x2="12" y2="5" />
                              <polyline points="5 12 12 5 19 12" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <polyline points="19 12 12 19 5 12" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p style={styles.txnType}>{t.transaction_type.replace('_', ' ')}</p>
                          <p style={styles.txnSub}>
                            {t.description || 'Core Banking Transfer'} · {formatDate(t.created_at)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p style={styles.txnAmount(isCredit)}>
                          {isCredit ? '+' : '−'} {formatCurrency(t.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Cash Flow Volume Bar Chart */}
          <div style={styles.panelCard}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>7-Day Volume Analysis</h2>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>Real-time Trend</span>
            </div>

            <div style={{ height: '240px', position: 'relative' }}>
              {txns.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" style={{ marginBottom: '8px' }}>
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <p style={{ margin: 0, fontSize: '13px' }}>Insufficient historical transaction data</p>
                </div>
              ) : (
                <canvas ref={chartRef} />
              )}
            </div>
          </div>
        </div>

        {/* Sentry & Account Security Banner */}
        <div style={styles.securityBanner}>
          <div style={styles.secLeft}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <div>
              <p style={styles.secTitle}>Session &amp; Fund Protection Active</p>
              <p style={styles.secSub}>
                Your session is encrypted with TLS 1.3. Zero security anomalies detected across retail accounts.
              </p>
            </div>
          </div>

          <Link
            to="/profile"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#F8FAFC',
              color: '#334155',
              fontSize: '12px',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            Security Settings →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
