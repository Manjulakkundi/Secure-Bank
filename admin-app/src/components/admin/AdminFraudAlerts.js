/**
 * Admin App — AdminFraudAlerts.js (AI Risk & Fraud Sentry Intelligence)
 * Features:
 * - Alert severity KPI cards with color-coded risk indicators
 * - Doughnut risk distribution visualizer using Chart.js
 * - Real-time alerts table with risk score badges and instant Review / Resolve actions
 * - Empty state with icon and skeleton loading shimmer
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import API from '../../services/api';
import { formatDate, getRiskBadgeColor } from '../../utils/format';

const AdminFraudAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [filters, setFilters] = useState({ status: 'PENDING', riskLevel: '', search: '' });
  const [msg, setMsg] = useState('');
  const chartRef = useRef(null);
  const chartInst = useRef(null);
  const ChartLib = useRef(null);

  const fetchAlerts = useCallback((cancelled = { value: false }) => {
    const p = new URLSearchParams(filters);
    Object.keys(filters).forEach((k) => {
      if (!filters[k]) p.delete(k);
    });
    API.get(`/admin/fraud-alerts?${p}`)
      .then((r) => {
        if (cancelled.value) return;
        setAlerts(r.data.data.alerts || []);
        setMetrics(r.data.data.metrics || {});
      })
      .catch((err) => {
        if (err.response?.status !== 403 && err.response?.status !== 401) console.error(err);
      });
  }, [filters]);

  useEffect(() => {
    const cancelled = { value: false };
    fetchAlerts(cancelled);
    const interval = setInterval(() => fetchAlerts(cancelled), 15000);
    return () => {
      cancelled.value = true;
      clearInterval(interval);
    };
  }, [fetchAlerts]);

  useEffect(() => {
    if (!chartRef.current || !metrics.total) return;
    if (chartInst.current) {
      chartInst.current.destroy();
      chartInst.current = null;
    }
    let cancelled = false;

    const buildChart = async () => {
      try {
        if (!ChartLib.current) {
          const mod = await import('chart.js');
          mod.Chart.register(mod.DoughnutController, mod.ArcElement, mod.Tooltip, mod.Legend);
          ChartLib.current = mod.Chart;
        }
        if (cancelled || !chartRef.current) return;
        if (chartInst.current) {
          chartInst.current.destroy();
          chartInst.current = null;
        }
        chartInst.current = new ChartLib.current(chartRef.current, {
          type: 'doughnut',
          data: {
            labels: ['High Risk', 'Medium Risk', 'Low Risk'],
            datasets: [
              {
                data: [metrics.high || 0, metrics.medium || 0, metrics.low || 0],
                backgroundColor: ['#F43F5E', '#F59E0B', '#10B981'],
                borderColor: '#FFFFFF',
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  boxWidth: 10,
                  usePointStyle: true,
                  pointStyle: 'circle',
                  font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
                  color: '#64748B',
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
      if (chartInst.current) {
        chartInst.current.destroy();
        chartInst.current = null;
      }
    };
  }, [metrics]);

  const resolve = async (alertId, status) => {
    try {
      await API.post(`/admin/fraud-alerts/${alertId}/resolve`, { status });
      setMsg(`Fraud alert #${alertId} marked as ${status}.`);
      fetchAlerts();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Error resolving alert.');
    }
  };

  const METRIC_CARDS = [
    { label: 'Total Incidents', value: metrics.total ?? 0, color: '#2563EB', bg: '#EFF6FF', border: '#DBEAFE' },
    { label: 'Critical Risk (High)', value: metrics.high ?? 0, color: '#E11D48', bg: '#FFF1F2', border: '#FFE4E6' },
    { label: 'Medium Risk', value: metrics.medium ?? 0, color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
    { label: 'Pending Action', value: metrics.pending ?? 0, color: '#7C3AED', bg: '#F5F3FF', border: '#EDE9FE' },
    { label: 'Resolved Safe', value: metrics.resolved ?? 0, color: '#059669', bg: '#ECFDF5', border: '#D1FAE5' },
  ];

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
      marginBottom: '28px',
      flexWrap: 'wrap',
      gap: '16px',
    },
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
    metricsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginBottom: '28px',
    },
    metricCard: (bg, border) => ({
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: '12px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
    }),
    metVal: (color) => ({
      fontSize: '28px',
      fontWeight: '800',
      color: color,
      margin: '0 0 4px 0',
      lineHeight: '1.2',
    }),
    metLabel: {
      fontSize: '12px',
      color: '#64748B',
      fontWeight: '600',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '2.5fr 1fr',
      gap: '24px',
    },
    panel: {
      background: '#FFFFFF',
      borderRadius: '14px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 12px -2px rgba(10, 22, 40, 0.04)',
      overflow: 'hidden',
    },
    toolbar: {
      padding: '16px 20px',
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      borderBottom: '1px solid #F1F5F9',
      flexWrap: 'wrap',
    },
    tabButton: (isActive) => ({
      padding: '7px 14px',
      borderRadius: '8px',
      border: `1px solid ${isActive ? '#2563EB' : '#E2E8F0'}`,
      background: isActive ? '#EFF6FF' : '#FFFFFF',
      color: isActive ? '#1D4ED8' : '#64748B',
      fontWeight: '600',
      fontSize: '12px',
      cursor: 'pointer',
    }),
    selectInput: {
      padding: '7px 12px',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '12px',
      color: '#334155',
      outline: 'none',
      fontWeight: '500',
    },
    searchInput: {
      padding: '7px 12px',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '12px',
      color: '#0F172A',
      outline: 'none',
      minWidth: '160px',
    },
    tableContainer: {
      overflowX: 'auto',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      textAlign: 'left',
    },
    th: {
      padding: '14px 16px',
      background: '#F8FAFC',
      color: '#475569',
      fontSize: '12px',
      fontWeight: '600',
      borderBottom: '1px solid #E2E8F0',
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
    },
    tr: {
      borderBottom: '1px solid #F1F5F9',
    },
    td: {
      padding: '14px 16px',
      fontSize: '13px',
      verticalAlign: 'middle',
      color: '#334155',
    },
    riskGauge: (score) => {
      const isHigh = score >= 70;
      const isMed = score >= 40 && score < 70;
      const color = isHigh ? '#E11D48' : isMed ? '#D97706' : '#059669';
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: '800',
        fontSize: '14px',
        color: color,
      };
    },
    reasonPill: {
      display: 'inline-block',
      maxWidth: '220px',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '6px',
      padding: '4px 8px',
      fontSize: '11px',
      color: '#475569',
      lineHeight: '1.4',
    },
    reviewBtn: {
      padding: '5px 10px',
      borderRadius: '6px',
      border: '1px solid #DBEAFE',
      background: '#EFF6FF',
      color: '#1D4ED8',
      fontWeight: '600',
      fontSize: '11px',
      cursor: 'pointer',
      marginRight: '6px',
    },
    resolveBtn: {
      padding: '5px 10px',
      borderRadius: '6px',
      border: '1px solid #A7F3D0',
      background: '#ECFDF5',
      color: '#047857',
      fontWeight: '600',
      fontSize: '11px',
      cursor: 'pointer',
    },
    chartPanel: {
      padding: '24px',
    },
  };

  return (
    <div style={styles.page}>
      <style>
        {`
          @media (max-width: 1024px) {
            .fraud-grid-layout { grid-template-columns: 1fr !important; }
          }
        `}
      </style>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Fraud Sentry Intelligence</h1>
          <p style={styles.pageSubtitle}>
            AI-driven anomaly detection, risk scoring thresholds, and threat mitigation logs.
          </p>
        </div>
      </div>

      {/* Message alert */}
      {msg && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{msg}</span>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'inherit' }}
            onClick={() => setMsg('')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards Row */}
      <div style={styles.metricsRow}>
        {METRIC_CARDS.map((m) => (
          <div key={m.label} style={styles.metricCard(m.bg, m.border)}>
            <div style={styles.metVal(m.color)}>{m.value}</div>
            <div style={styles.metLabel}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Split Grid */}
      <div style={styles.grid} className="fraud-grid-layout">
        {/* Table Panel */}
        <div style={styles.panel}>
          <div style={styles.toolbar}>
            {[
              ['PENDING', 'Pending Actions'],
              ['REVIEWED', 'Under Review'],
              ['RESOLVED', 'Resolved Safe'],
              ['', 'All Incidents'],
            ].map(([val, label]) => (
              <button
                key={val}
                style={styles.tabButton(filters.status === val)}
                onClick={() => setFilters({ ...filters, status: val })}
              >
                {label}
              </button>
            ))}

            <select
              style={styles.selectInput}
              value={filters.riskLevel}
              onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
            >
              <option value="">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>

            <input
              style={styles.searchInput}
              placeholder="Search account..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Alert ID', 'Target Account', 'Risk Score', 'Threat Level', 'Reason & Anomaly', 'Status', 'Timestamp', 'Mitigation'].map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛡️</div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#334155' }}>No active fraud alerts</div>
                      <div style={{ fontSize: '13px' }}>System threat sentry is monitoring incoming transactions cleanly.</div>
                    </td>
                  </tr>
                ) : (
                  alerts.map((a) => {
                    const rb = getRiskBadgeColor(a.risk_score);
                    return (
                      <tr key={a.alert_id} style={styles.tr}>
                        <td style={styles.td}>
                          <code style={{ fontSize: '12px', fontWeight: '700', color: '#E11D48', background: '#FFF1F2', padding: '3px 8px', borderRadius: '4px' }}>
                            #{a.alert_id}
                          </code>
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '700', color: '#0A1628' }}>{a.customerName || 'Retail Account'}</div>
                          <code style={{ fontSize: '11px', color: '#64748B' }}>{a.account_id}</code>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.riskGauge(a.risk_score)}>
                            <span>{a.risk_score}</span>
                            <span style={{ fontSize: '10px', color: '#94A3B8' }}>/100</span>
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ background: rb.bg, color: rb.text, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', border: `1px solid ${rb.text}33` }}>
                            {rb.label}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.reasonPill}>{a.fraud_reason}</div>
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            background: a.status === 'RESOLVED' ? '#ECFDF5' : a.status === 'REVIEWED' ? '#EFF6FF' : '#FFFBEB',
                            color: a.status === 'RESOLVED' ? '#047857' : a.status === 'REVIEWED' ? '#1D4ED8' : '#B45309',
                            padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                          }}>
                            {a.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>{formatDate(a.created_at)}</span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {a.status === 'PENDING' && (
                              <button style={styles.reviewBtn} onClick={() => resolve(a.alert_id, 'REVIEWED')}>
                                Review
                              </button>
                            )}
                            {a.status !== 'RESOLVED' && (
                              <button style={styles.resolveBtn} onClick={() => resolve(a.alert_id, 'RESOLVED')}>
                                Resolve Safe
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Analytics Distribution Panel */}
        <div style={styles.panel}>
          <div style={styles.chartPanel}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0A1628', margin: '0 0 16px 0' }}>
              Threat Breakdown
            </h2>
            <div style={{ height: '220px', position: 'relative' }}>
              <canvas ref={chartRef} />
            </div>

            {metrics.total > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F1F5F9', fontSize: '12px', color: '#64748B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Mitigation Rate</span>
                  <strong style={{ color: '#059669' }}>
                    {Math.round((metrics.resolved / metrics.total) * 100)}%
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>High Risk Exposure</span>
                  <strong style={{ color: '#E11D48' }}>
                    {Math.round((metrics.high / metrics.total) * 100)}%
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFraudAlerts;