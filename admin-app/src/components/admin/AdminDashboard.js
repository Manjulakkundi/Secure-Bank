/**
 * Admin App — AdminDashboard.js (Fintech Enterprise KPI & Analytics Center)
 * Features:
 * - KPI metric cards with trend badges, micro-sparkline bars, and hover lift
 * - Doughnut risk & portfolio distribution chart with Chart.js
 * - Real-time activity & quick operations console
 * - Skeleton shimmer loading state
 * - Clean Inter typography and 8px border radius design tokens
 */
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../../services/api';
import { formatCurrency } from '../../utils/format';

const AdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const chartInst = useRef(null);
  const ChartLib = useRef(null);

  // ── Stats polling ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const r = await API.get('/admin/stats');
        if (!cancelled) {
          setStats(r.data.data || {});
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          if (err.response?.status !== 401 && err.response?.status !== 403) {
            console.error('Admin stats fetch error:', err);
          }
        }
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ── Chart.js Doughnut Initializer ─────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || loading) return;

    if (chartInst.current) {
      chartInst.current.destroy();
      chartInst.current = null;
    }

    let cancelled = false;

    const buildChart = async () => {
      try {
        if (!ChartLib.current) {
          const mod = await import('chart.js');
          mod.Chart.register(
            mod.DoughnutController,
            mod.ArcElement,
            mod.Tooltip,
            mod.Legend
          );
          ChartLib.current = mod.Chart;
        }
        if (cancelled || !chartRef.current) return;

        if (chartInst.current) {
          chartInst.current.destroy();
          chartInst.current = null;
        }

        const activeLoansCount = Math.max(0, (stats.totalLoans || 0) - (stats.pendingLoans || 0));
        const pendingLoansCount = stats.pendingLoans || 0;
        const fraudAlertsCount = stats.pendingAlerts || 0;
        const total = activeLoansCount + pendingLoansCount + fraudAlertsCount;

        chartInst.current = new ChartLib.current(chartRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Active Loans', 'Pending Loans', 'Fraud Alerts'],
            datasets: [
              {
                data: total === 0 ? [1, 0, 0] : [activeLoansCount, pendingLoansCount, fraudAlertsCount],
                backgroundColor: total === 0 ? ['#E2E8F0', '#E2E8F0', '#E2E8F0'] : ['#10B981', '#F59E0B', '#F43F5E'],
                borderColor: '#FFFFFF',
                borderWidth: 3,
                hoverOffset: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '76%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  boxWidth: 12,
                  boxHeight: 12,
                  borderRadius: 3,
                  usePointStyle: true,
                  pointStyle: 'circle',
                  font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
                  color: '#64748B',
                  padding: 16,
                },
              },
              tooltip: {
                backgroundColor: '#0A1628',
                titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
                bodyFont: { family: "'Inter', sans-serif", size: 12 },
                padding: 10,
                cornerRadius: 8,
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
      if (chartInst.current) {
        chartInst.current.destroy();
        chartInst.current = null;
      }
    };
  }, [stats, loading]);

  // KPI Metrics Definition
  const KPI_CARDS = [
    {
      label: 'Total Customers',
      value: stats.totalCustomers ?? '—',
      trend: '+12.4%',
      trendUp: true,
      color: '#2563EB',
      spark: [40, 55, 60, 75, 90, 100],
      link: '/customers',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      ),
    },
    {
      label: 'Core Transactions',
      value: stats.totalTransactions ?? '—',
      trend: '+28.6%',
      trendUp: true,
      color: '#10B981',
      spark: [30, 45, 60, 80, 85, 110],
      link: '/transactions',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      ),
    },
    {
      label: 'Total Deposits',
      value: formatCurrency(stats.totalDeposited || 0),
      trend: '+18.2%',
      trendUp: true,
      color: '#059669',
      spark: [50, 60, 70, 85, 95, 120],
      link: '/transactions',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 18V6" />
        </svg>
      ),
    },
    {
      label: 'Active Loans',
      value: stats.totalLoans ?? '—',
      trend: `${stats.pendingLoans || 0} Pending`,
      trendUp: true,
      color: '#3B82F6',
      spark: [20, 30, 40, 50, 65, 80],
      link: '/loans',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      ),
    },
    {
      label: 'Fraud Alerts',
      value: stats.pendingAlerts ?? 0,
      trend: (stats.pendingAlerts || 0) > 0 ? 'Requires Action' : 'Shield Secure',
      trendUp: false,
      color: '#F43F5E',
      spark: [10, 20, 15, 30, 25, 40],
      link: '/fraud-alerts',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      label: 'Frozen Accounts',
      value: stats.frozenAccounts ?? 0,
      trend: 'Compliance Lock',
      trendUp: false,
      color: '#E11D48',
      spark: [5, 10, 8, 12, 10, 15],
      link: '/customers',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ];

  const quickActions = [
    { title: 'Customer Operations', desc: 'Browse, verify & manage account status', link: '/customers', icon: '👥', color: '#2563EB' },
    { title: 'Investment Management', desc: 'Monitor bank-wide FDs, RDs & maturities', link: '/investments', icon: '📈', color: '#0D9488' },
    { title: 'Loan Underwriting', desc: 'Approve or reject credit applications', link: '/loans', icon: '📑', color: '#059669' },
    { title: 'Fraud Intelligence', desc: 'Review high-risk behavioral triggers', link: '/fraud-alerts', icon: '🛡️', color: '#DC2626' },
    { title: 'Audit Trail Ledger', desc: 'Inspect immutable system event logs', link: '/audit-logs', icon: '📋', color: '#475569' },
  ];


  // Design Tokens
  const styles = {
    page: {
      padding: '36px 40px',
      backgroundColor: '#F8FAFC',
      minHeight: '100vh',
      fontFamily: "'Inter', sans-serif",
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '32px',
      flexWrap: 'wrap',
      gap: '16px',
    },
    titleGroup: {},
    pageTitle: {
      fontSize: '26px',
      fontWeight: '800',
      color: '#0A1628',
      letterSpacing: '-0.02em',
      margin: '0 0 6px 0',
    },
    pageSubtitle: {
      fontSize: '13px',
      color: '#64748B',
      margin: 0,
    },
    liveBadgeGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    pulseBadge: {
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
    refreshBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#334155',
      cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    },
    // KPI Grid
    kpiGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '20px',
      marginBottom: '32px',
    },
    kpiCard: {
      background: '#FFFFFF',
      borderRadius: '12px',
      padding: '22px 24px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 12px -2px rgba(10, 22, 40, 0.04)',
      textDecoration: 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'all 0.2s ease',
      position: 'relative',
      overflow: 'hidden',
    },
    kpiTop: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: '14px',
    },
    kpiIconBox: (color) => ({
      width: '42px',
      height: '42px',
      borderRadius: '10px',
      background: `${color}12`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    trendBadge: (isUp, color) => ({
      fontSize: '11px',
      fontWeight: '700',
      color: color,
      background: `${color}14`,
      padding: '3px 8px',
      borderRadius: '6px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
    }),
    kpiValue: {
      fontSize: '28px',
      fontWeight: '800',
      color: '#0A1628',
      letterSpacing: '-0.03em',
      margin: '0 0 4px 0',
      lineHeight: '1.2',
    },
    kpiLabel: {
      fontSize: '13px',
      fontWeight: '500',
      color: '#64748B',
      margin: 0,
    },
    sparklineContainer: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '4px',
      height: '24px',
      marginTop: '16px',
      paddingTop: '6px',
      borderTop: '1px solid #F1F5F9',
    },
    sparkBar: (height, color) => ({
      flex: 1,
      height: `${height}%`,
      backgroundColor: `${color}40`,
      borderRadius: '2px',
      transition: 'height 0.3s ease',
    }),
    // Split Analytics Section
    analyticsSplit: {
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
      gap: '24px',
    },
    panelCard: {
      background: '#FFFFFF',
      borderRadius: '14px',
      padding: '24px 28px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 12px -2px rgba(10, 22, 40, 0.04)',
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
    panelBadge: {
      fontSize: '11px',
      fontWeight: '600',
      color: '#2563EB',
      background: '#EFF6FF',
      padding: '3px 9px',
      borderRadius: '6px',
    },
    chartContainer: {
      height: '260px',
      position: 'relative',
    },
    quickActionGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '12px',
    },
    actionItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '14px 18px',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '10px',
      textDecoration: 'none',
      transition: 'all 0.18s ease',
    },
    actionEmoji: {
      fontSize: '22px',
    },
    actionTextGroup: {
      flex: 1,
    },
    actionTitle: {
      fontSize: '14px',
      fontWeight: '700',
      color: '#0A1628',
      margin: '0 0 2px 0',
    },
    actionDesc: {
      fontSize: '12px',
      color: '#64748B',
      margin: 0,
    },
    actionArrow: {
      color: '#94A3B8',
      display: 'flex',
      alignItems: 'center',
    },
    // Shimmer Skeleton styles
    skeletonBox: {
      background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: '6px',
    },
  };

  return (
    <div style={styles.page}>
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          .kpi-hover-card:hover {
            transform: translateY(-3px);
            border-color: #CBD5E1;
            box-shadow: 0 12px 24px -6px rgba(10, 22, 40, 0.08);
          }
          .action-hover-item:hover {
            background: #FFFFFF;
            border-color: #93C5FD;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
            transform: translateX(3px);
          }
          @media (max-width: 1024px) {
            .analytics-split-layout { grid-template-columns: 1fr !important; }
          }
        `}
      </style>

      {/* Header Bar */}
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <h1 style={styles.pageTitle}>Executive Admin Center</h1>
          <p style={styles.pageSubtitle}>
            Consolidated telemetry, risk distribution, and core banking settlement controls.
          </p>
        </div>

        <div style={styles.liveBadgeGroup}>
          <div style={styles.pulseBadge}>
            <span style={styles.liveDot} />
            <span>Core Telemetry Active</span>
          </div>
          <button
            style={styles.refreshBtn}
            onClick={() => {
              setLoading(true);
              API.get('/admin/stats')
                .then((r) => setStats(r.data.data || {}))
                .finally(() => setLoading(false));
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={styles.kpiGrid}>
        {KPI_CARDS.map((card, idx) => (
          <Link
            key={idx}
            to={card.link}
            style={styles.kpiCard}
            className="kpi-hover-card"
          >
            <div>
              <div style={styles.kpiTop}>
                <div style={styles.kpiIconBox(card.color)}>{card.icon}</div>
                <span style={styles.trendBadge(card.trendUp, card.color)}>
                  {card.trend}
                </span>
              </div>
              <h2 style={styles.kpiValue}>
                {loading ? <div style={{ ...styles.skeletonBox, width: '120px', height: '32px' }} /> : card.value}
              </h2>
              <p style={styles.kpiLabel}>{card.label}</p>
            </div>

            {/* Micro Sparkline */}
            <div style={styles.sparklineContainer}>
              {card.spark.map((h, i) => (
                <div key={i} style={styles.sparkBar(h, card.color)} />
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* Split Analytics & Operations View */}
      <div style={styles.analyticsSplit} className="analytics-split-layout">
        {/* Left: Risk & Portfolio Chart */}
        <div style={styles.panelCard}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Risk &amp; Loan Distribution</h2>
            <span style={styles.panelBadge}>Real-time Ratio</span>
          </div>

          <div style={styles.chartContainer}>
            {loading ? (
              <div style={{ ...styles.skeletonBox, width: '100%', height: '100%' }} />
            ) : (
              <canvas ref={chartRef} />
            )}
          </div>
        </div>

        {/* Right: Quick Action Hub */}
        <div style={styles.panelCard}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Administrative Workflows</h2>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Rapid Access</span>
          </div>

          <div style={styles.quickActionGrid}>
            {quickActions.map((action, i) => (
              <Link
                key={i}
                to={action.link}
                style={styles.actionItem}
                className="action-hover-item"
              >
                <div style={styles.actionEmoji}>{action.icon}</div>
                <div style={styles.actionTextGroup}>
                  <h3 style={styles.actionTitle}>{action.title}</h3>
                  <p style={styles.actionDesc}>{action.desc}</p>
                </div>
                <div style={styles.actionArrow}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
