/**
 * Admin App — AdminTransactions.js (Core Ledger & Real-Time Flow)
 * Features:
 * - Transaction data table with type icons & color-coded debit/credit flows
 * - Status pills (Success, Pending, Failed) & ledger balance after transaction
 * - Type filtering & pagination controls
 * - Empty state with SVG graphic & loading skeleton
 */
import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';


const AdminTransactions = () => {
  const [txns, setTxns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);
  const limit = 50;

  const fetchTxns = useCallback(
    async (cancelled = { value: false }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit });
        if (type) params.set('type', type);
        const { data } = await API.get(`/admin/transactions?${params}`);
        if (!cancelled.value) {
          setTxns(data.data.transactions || []);
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
    [page, type]
  );

  useEffect(() => {
    const cancelled = { value: false };
    fetchTxns(cancelled);
    const interval = setInterval(() => fetchTxns(cancelled), 15000);
    return () => {
      cancelled.value = true;
      clearInterval(interval);
    };
  }, [fetchTxns]);

  const getTypeIcon = (t) => {
    const isCredit = ['DEPOSIT', 'RECEIVE', 'LOAN_APPROVED'].includes(t);
    if (isCredit) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
    );
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
      gap: '12px',
      alignItems: 'center',
      borderBottom: '1px solid #F1F5F9',
      backgroundColor: '#FFFFFF',
    },
    selectInput: {
      padding: '8px 14px',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '13px',
      color: '#334155',
      outline: 'none',
      fontWeight: '500',
      cursor: 'pointer',
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
    typePill: (type) => {
      const isCredit = ['DEPOSIT', 'RECEIVE', 'LOAN_APPROVED'].includes(type);
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: isCredit ? '#ECFDF5' : '#FFF1F2',
        color: isCredit ? '#047857' : '#BE123C',
        border: `1px solid ${isCredit ? '#A7F3D0' : '#FECDD3'}`,
        padding: '3px 9px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
      };
    },
    statusBadge: (st) => {
      const isSuccess = st === 'SUCCESS';
      const isFailed = st === 'FAILED';
      return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: '700',
        background: isSuccess ? '#ECFDF5' : isFailed ? '#FFF1F2' : '#FFFBEB',
        color: isSuccess ? '#047857' : isFailed ? '#BE123C' : '#B45309',
      };
    },
    paginationBar: {
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTop: '1px solid #F1F5F9',
      background: '#FFFFFF',
    },
    pageButton: (disabled) => ({
      padding: '7px 14px',
      borderRadius: '6px',
      border: '1px solid #E2E8F0',
      background: disabled ? '#F8FAFC' : '#FFFFFF',
      color: disabled ? '#94A3B8' : '#0F172A',
      fontSize: '12px',
      fontWeight: '600',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }),
  };

  const TYPES = ['', 'DEPOSIT', 'WITHDRAW', 'TRANSFER', 'RECEIVE', 'LOAN_APPROVED'];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Transaction Records</h1>
          <p style={styles.pageSubtitle}>
            Global ledger across all branches, transfers, card payments, and loan disbursements ({total} records).
          </p>
        </div>
      </div>

      <div style={styles.panel}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <select
            style={styles.selectInput}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t ? t.replace('_', ' ') : 'All Transaction Types'}
              </option>
            ))}
          </select>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
            {total} Total Transactions
          </span>
        </div>

        {/* Table */}
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Txn ID', 'Customer Account', 'Sender', 'Receiver', 'Type', 'Amount', 'Status', 'Balance After', 'Timestamp'].map((h) => (
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
                    <td colSpan={9} style={{ padding: '16px' }}>
                      <div style={{ height: '24px', background: '#F1F5F9', borderRadius: '4px' }} />
                    </td>
                  </tr>
                ))
              ) : txns.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>💳</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#334155' }}>No transactions recorded</div>
                    <div style={{ fontSize: '13px' }}>Transactions will populate dynamically upon customer activity.</div>
                  </td>
                </tr>
              ) : (
                txns.map((t) => {
                  const isCredit = ['DEPOSIT', 'RECEIVE', 'LOAN_APPROVED'].includes(t.transaction_type);
                  return (
                    <tr key={t.transaction_id} style={styles.tr}>
                      <td style={styles.td}>
                        <code style={{ fontSize: '12px', fontWeight: '700', color: '#0A1628', background: '#F1F5F9', padding: '3px 7px', borderRadius: '4px' }}>
                          #{t.transaction_id}
                        </code>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: '700', color: '#0A1628' }}>{t.customerName || 'Retail Customer'}</div>
                      </td>
                      <td style={styles.td}>
                        <code style={{ fontSize: '11px', color: '#64748B' }}>{t.sender_account || '—'}</code>
                      </td>
                      <td style={styles.td}>
                        <code style={{ fontSize: '11px', color: '#64748B' }}>{t.receiver_account || '—'}</code>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.typePill(t.transaction_type)}>
                          {getTypeIcon(t.transaction_type)}
                          <span>{t.transaction_type}</span>
                        </span>
                      </td>
                      <td style={styles.td}>
                        <strong style={{ fontSize: '14px', color: isCredit ? '#059669' : '#DC2626' }}>
                          {isCredit ? '+' : '-'} {formatCurrency(t.amount)}
                        </strong>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge(t.status)}>{t.status}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                          {t.balance_after != null ? formatCurrency(t.balance_after) : '—'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>{formatDate(t.created_at)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={styles.paginationBar}>
          <button
            style={styles.pageButton(page === 1)}
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Previous
          </button>
          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
            Page {page} · Showing {txns.length} records
          </span>
          <button
            style={styles.pageButton(txns.length < limit)}
            disabled={txns.length < limit}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminTransactions;