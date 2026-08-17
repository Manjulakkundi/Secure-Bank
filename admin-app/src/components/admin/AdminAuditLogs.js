/**
 * Admin App — AdminAuditLogs.js (Immutable System Audit Trail)
 * Features:
 * - Timeline-style system event log with action color badges
 * - Multi-parameter filtering: User / Account, Action type, Date range
 * - CSV Export function and multi-page pagination
 * - Empty state with icon and skeleton shimmer loading
 */
import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/api';
import { formatDate } from '../../utils/format';

const ACTIONS = [
  '',
  'LOGIN',
  'LOGOUT',
  'SIGNUP',
  'DEPOSIT',
  'WITHDRAW',
  'TRANSFER',
  'LOAN_REQUEST',
  'LOAN_APPROVAL',
  'LOAN_REJECTION',
  'ACCOUNT_FREEZE',
  'ACCOUNT_UNFREEZE',
  'BENEFICIARY_ADD',
  'BENEFICIARY_REMOVE',
  'PASSWORD_RESET',
  'ADMIN_LOGIN',
  'FRAUD_ALERT',
];

const ACTION_COLOR = {
  LOGIN: '#059669',
  LOGOUT: '#64748B',
  SIGNUP: '#2563EB',
  DEPOSIT: '#059669',
  WITHDRAW: '#E11D48',
  TRANSFER: '#D97706',
  LOAN_REQUEST: '#2563EB',
  LOAN_APPROVAL: '#059669',
  LOAN_REJECTION: '#E11D48',
  ACCOUNT_FREEZE: '#E11D48',
  ACCOUNT_UNFREEZE: '#059669',
  BENEFICIARY_ADD: '#2563EB',
  BENEFICIARY_REMOVE: '#D97706',
  PASSWORD_RESET: '#D97706',
  ADMIN_LOGIN: '#1E3A8A',
  FRAUD_ALERT: '#E11D48',
};

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ userId: '', action: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState(false);
  const limit = 50;

  const fetchLogs = useCallback(
    async (cancelled = { value: false }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit, ...filters });
        Object.keys(filters).forEach((k) => {
          if (!filters[k]) params.delete(k);
        });
        const { data } = await API.get(`/audit-logs?${params}`);
        if (!cancelled.value) {
          setLogs(data.data.logs || []);
          setTotal(data.data.total || 0);
        }
      } catch (e) {
        if (!cancelled.value && e.response?.status !== 401 && e.response?.status !== 403) {
          console.error(e);
        }
      } finally {
        if (!cancelled.value) setLoading(false);
      }
    },
    [page, filters]
  );

  useEffect(() => {
    const cancelled = { value: false };
    fetchLogs(cancelled);
    const interval = setInterval(() => fetchLogs(cancelled), 15000);
    return () => {
      cancelled.value = true;
      clearInterval(interval);
    };
  }, [fetchLogs]);

  const exportCsv = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/audit-logs/export`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${Date.now()}.csv`;
      a.click();
    } catch (e) {
      alert('Export failed');
    }
  };

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
      backgroundColor: '#FFFFFF',
    },
    input: {
      padding: '8px 12px',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '13px',
      color: '#334155',
      outline: 'none',
    },
    clearBtn: {
      padding: '8px 14px',
      background: '#F1F5F9',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#475569',
      cursor: 'pointer',
    },
    exportBtn: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
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
    actionBadge: (action) => {
      const color = ACTION_COLOR[action] || '#64748B';
      return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        color: color,
        background: `${color}14`,
        border: `1px solid ${color}33`,
      };
    },
    pagination: {
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      borderTop: '1px solid #F1F5F9',
      background: '#FFFFFF',
    },
    pageBtn: (isActive, disabled) => ({
      padding: '6px 12px',
      borderRadius: '6px',
      border: `1px solid ${isActive ? '#2563EB' : '#E2E8F0'}`,
      background: isActive ? '#EFF6FF' : disabled ? '#F8FAFC' : '#FFFFFF',
      color: isActive ? '#1D4ED8' : disabled ? '#94A3B8' : '#334155',
      fontSize: '12px',
      fontWeight: '600',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }),
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Security Audit Trail</h1>
          <p style={styles.pageSubtitle}>
            Immutable forensic event logging, authentication tracking, and administrative actions ({total} events recorded).
          </p>
        </div>
      </div>

      <div style={styles.panel}>
        {/* Filter Toolbar */}
        <div style={styles.toolbar}>
          <input
            style={styles.input}
            placeholder="Filter User / Account ID..."
            value={filters.userId}
            onChange={(e) => {
              setFilters({ ...filters, userId: e.target.value });
              setPage(1);
            }}
          />

          <select
            style={styles.input}
            value={filters.action}
            onChange={(e) => {
              setFilters({ ...filters, action: e.target.value });
              setPage(1);
            }}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a ? a.replace('_', ' ') : 'All Action Types'}
              </option>
            ))}
          </select>

          <input
            style={styles.input}
            type="date"
            title="Start Date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />

          <input
            style={styles.input}
            type="date"
            title="End Date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />

          <button
            style={styles.clearBtn}
            onClick={() => {
              setFilters({ userId: '', action: '', startDate: '', endDate: '' });
              setPage(1);
            }}
          >
            Reset Filters
          </button>

          <button style={styles.exportBtn} onClick={exportCsv}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>

        {/* Table Content */}
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Log ID', 'Target Entity', 'Action Type', 'Description & Payload', 'Client IP', 'Timestamp'].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td colSpan={6} style={{ padding: '16px' }}>
                      <div style={{ height: '24px', background: '#F1F5F9', borderRadius: '4px' }} />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📜</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#334155' }}>No audit events found</div>
                    <div style={{ fontSize: '13px' }}>Adjust filter parameters to view earlier compliance logs.</div>
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.log_id} style={styles.tr}>
                    <td style={styles.td}>
                      <code style={{ fontSize: '12px', fontWeight: '700', color: '#0A1628', background: '#F1F5F9', padding: '3px 7px', borderRadius: '4px' }}>
                        #{l.log_id}
                      </code>
                    </td>
                    <td style={styles.td}>
                      <code style={{ fontSize: '12px', fontWeight: '600', color: '#2563EB' }}>{l.user_id}</code>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.actionBadge(l.action)}>{l.action}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontSize: '13px', color: '#334155', maxWidth: '320px' }}>{l.description}</div>
                    </td>
                    <td style={styles.td}>
                      <code style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', padding: '2px 6px', borderRadius: '4px' }}>
                        {l.ip_address || '127.0.0.1'}
                      </code>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>{formatDate(l.created_at)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={styles.pagination}>
          <button
            style={styles.pageBtn(false, page === 1)}
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, page - 2) + i;
            return p <= totalPages ? (
              <button
                key={p}
                style={styles.pageBtn(p === page, false)}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ) : null;
          })}
          <button
            style={styles.pageBtn(false, page >= totalPages)}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
            Page {page} of {totalPages} · {total} events total
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogs;
