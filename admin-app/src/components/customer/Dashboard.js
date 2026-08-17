/**
 * components/customer/Dashboard.js
 * Fixes applied:
 *  1. BarController registered — Chart.js v3 requires explicit registration
 *  2. Chart destroyed synchronously before async re-create — no "canvas in use" error
 *  3. 403/401 from polling swallowed — no uncaught runtime errors
 *  4. `cancelled` flag prevents setState after unmount
 */
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';
import { formatCurrency, formatDate, getTxnColor } from '../../utils/format';

const STAT_CARDS = [
  { key: 'totalDeposits',    label: 'Total Deposits',    icon: '⬇️', color: '#1E8449' },
  { key: 'totalWithdrawals', label: 'Total Withdrawals', icon: '⬆️', color: '#C0392B' },
  { key: 'activeLoans',      label: 'Active Loans',      icon: '🏦', color: '#2E7D9A' },
  { key: 'pendingAlerts',    label: 'Fraud Alerts',      icon: '🚨', color: '#E67E22' },
];

const Dashboard = () => {
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [txns, setTxns]       = useState([]);
  const [stats, setStats]     = useState({});
  const [loading, setLoading] = useState(true);
  const chartRef      = useRef(null);
  const chartInstance = useRef(null);
  const ChartLib      = useRef(null); // cache after first import

  // ── Data polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [accRes, txnRes] = await Promise.all([
          API.get('/customer/account-info'),
          API.get('/customer/transactions?limit=10'),
        ]);
        if (cancelled) return;

        const acc     = accRes.data.data;
        const txnList = txnRes.data.data.transactions || [];
        setAccount(acc);
        setTxns(txnList);

        const totalDeposits    = txnList.filter(t => ['DEPOSIT','RECEIVE','LOAN_APPROVED'].includes(t.transaction_type)).reduce((s, t) => s + parseFloat(t.amount), 0);
        const totalWithdrawals = txnList.filter(t => ['WITHDRAW','TRANSFER'].includes(t.transaction_type)).reduce((s, t) => s + parseFloat(t.amount), 0);
        setStats({ totalDeposits, totalWithdrawals, activeLoans: acc.totalLoans ? parseFloat(acc.totalLoans) : 0, pendingAlerts: 0 });
      } catch (err) {
        if (!cancelled && err.response?.status !== 401 && err.response?.status !== 403) {
          console.error('Dashboard fetch error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Chart ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || txns.length === 0) return;

    // SYNCHRONOUS destroy before any async work — prevents "canvas in use"
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    let cancelled = false;

    const buildChart = async () => {
      try {
        if (!ChartLib.current) {
          const mod = await import('chart.js');
          // Chart.js v3+ — BarController must be registered explicitly
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

        // Destroy again — another effect may have run during await
        if (chartInstance.current) {
          chartInstance.current.destroy();
          chartInstance.current = null;
        }

        const last7 = [...txns].slice(0, 7).reverse();
        chartInstance.current = new ChartLib.current(chartRef.current, {
          type: 'bar',
          data: {
            labels: last7.map(t => new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
            datasets: [{
              label: 'Amount (₹)',
              data: last7.map(t => parseFloat(t.amount)),
              backgroundColor: last7.map(t => getTxnColor(t.transaction_type) + 'CC'),
              borderRadius: 6,
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + v.toLocaleString('en-IN') } } },
          },
        });
      } catch (e) {
        if (!cancelled) console.error('Chart error:', e);
      }
    };

    buildChart();

    return () => {
      cancelled = true;
      if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    };
  }, [txns]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const st = {
    page:     { background: '#f5f7fa', minHeight: '100vh', padding: 24 },
    greeting: { fontSize: 26, fontWeight: 700, color: '#1A3C5E' },
    sub:      { color: '#888', fontSize: 14 },
    balCard:  { background: 'linear-gradient(135deg,#1A3C5E 0%,#2E7D9A 100%)', borderRadius: 16, padding: 28, color: '#fff', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 24px rgba(26,60,94,0.3)' },
    balLabel: { fontSize: 13, opacity: 0.8, marginBottom: 8 },
    balAmt:   { fontSize: 38, fontWeight: 700, letterSpacing: 1 },
    accNum:   { fontSize: 13, opacity: 0.7, marginTop: 8, letterSpacing: 2 },
    statsGrid:{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 },
    statCard: { background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    grid2:    { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 },
    panel:    { background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    panelT:   { fontSize: 16, fontWeight: 700, color: '#1A3C5E', marginBottom: 16 },
    txnRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' },
    qlinks:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    qlink:    { background: 'linear-gradient(135deg,#1A3C5E,#2E7D9A)', color: '#fff', padding: '18px', borderRadius: 10, textDecoration: 'none', textAlign: 'center', fontWeight: 600, fontSize: 14 },
    loading:  { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', fontSize: 18, color: '#888' },
    banner:   { background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#856404', fontSize: 13 },
    chip:     { background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 16px', marginBottom: 8 },
  };

  if (loading) return <div style={st.loading}>Loading dashboard...</div>;

  return (
    <div style={st.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={st.greeting}>Welcome back, {account?.customerName?.split(' ')[0]} 👋</h1>
        <p style={st.sub}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {account?.AccountVerify === 0 && (
        <div style={st.banner}>⚠️ Your account is pending verification. Some features may be limited.</div>
      )}

      {/* Balance Card */}
      <div style={st.balCard}>
        <div>
          <p style={st.balLabel}>Available Balance</p>
          <p style={st.balAmt}>{formatCurrency(account?.Balance || 0)}</p>
          <p style={st.accNum}>{account?.AccountNumber?.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={st.chip}><p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Account Type</p><p style={{ margin: 0, fontWeight: 700 }}>{account?.AccountType}</p></div>
          <div style={st.chip}><p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Status</p><p style={{ margin: 0, fontWeight: 700 }}>{account?.AccountStatus}</p></div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={st.statsGrid}>
        {STAT_CARDS.map(c => (
          <div key={c.key} style={st.statCard}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
            <p style={{ fontSize: 20, fontWeight: 700, color: c.color, margin: '0 0 4px' }}>
              {c.key === 'pendingAlerts' ? (stats[c.key] || 0) : formatCurrency(stats[c.key] || 0)}
            </p>
            <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{c.label}</p>
          </div>
        ))}
      </div>

      <div style={st.grid2}>
        {/* Recent Transactions */}
        <div style={st.panel}>
          <p style={st.panelT}>Recent Activity</p>
          {txns.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>No transactions yet</p>}
          {txns.slice(0, 8).map((t, i) => (
            <div key={i} style={st.txnRow}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{t.transaction_type}</p>
                <p style={{ fontSize: 11, color: '#aaa', margin: '3px 0 0' }}>{formatDate(t.created_at)}</p>
                <p style={{ fontSize: 11, color: '#bbb', margin: 0 }}>{t.description}</p>
              </div>
              <span style={{ fontWeight: 700, color: getTxnColor(t.transaction_type) }}>
                {['DEPOSIT','RECEIVE','LOAN_APPROVED'].includes(t.transaction_type) ? '+' : '−'}{formatCurrency(t.amount)}
              </span>
            </div>
          ))}
          <Link to="/transactions" style={{ color: '#2E7D9A', fontSize: 13, marginTop: 12, display: 'block', textAlign: 'right' }}>View all →</Link>
        </div>

        {/* Chart + Quick Links */}
        <div>
          <div style={{ ...st.panel, marginBottom: 20 }}>
            <p style={st.panelT}>Transaction Activity (Last 7)</p>
            <canvas ref={chartRef} height={180} />
          </div>
          <div style={st.panel}>
            <p style={st.panelT}>Quick Actions</p>
            <div style={st.qlinks}>
              <Link to="/transfer"      style={st.qlink}>💸 Transfer</Link>
              <Link to="/transactions"  style={st.qlink}>📋 History</Link>
              <Link to="/loans"         style={st.qlink}>🏦 Loans</Link>
              <Link to="/statement"     style={st.qlink}>📄 Statement</Link>
              <Link to="/beneficiaries" style={st.qlink}>👥 Beneficiaries</Link>
              <Link to="/profile"       style={st.qlink}>👤 Profile</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
