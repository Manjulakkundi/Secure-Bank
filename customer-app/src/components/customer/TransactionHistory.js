/**
 * components/customer/TransactionHistory.js
 * Full transaction history with search, filters, and pagination.
 */
import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/api';
import { formatCurrency, formatDate, getTxnColor } from '../../utils/format';

const TYPES = ['', 'DEPOSIT', 'WITHDRAW', 'TRANSFER', 'RECEIVE', 'LOAN_APPROVED', 'FD_CREATED', 'FD_MATURITY', 'RD_CONTRIBUTION', 'RD_MATURITY'];

const TransactionHistory = () => {
  const [txns, setTxns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ type: '', startDate: '', endDate: '', search: '' });
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchTxns = useCallback(async (cancelled = { value: false }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, ...filters });
      Object.keys(filters).forEach(k => { if (!filters[k]) params.delete(k); });
      const { data } = await API.get(`/customer/transactions?${params}`);
      if (!cancelled.value) {
        setTxns(data.data.transactions || []);
        setTotal(data.data.total || 0);
      }
    } catch (err) {
      if (!cancelled.value && err.response?.status !== 401 && err.response?.status !== 403)
        console.error(err);
    } finally { if (!cancelled.value) setLoading(false); }
  }, [page, filters]);

  useEffect(() => {
    const cancelled = { value: false };
    fetchTxns(cancelled);
    const interval = setInterval(() => fetchTxns(cancelled), 15000);
    return () => { cancelled.value = true; clearInterval(interval); };
  }, [fetchTxns]);

  const totalPages = Math.ceil(total / limit);

  const s = {
    page: { background: '#f5f7fa', minHeight: '100vh', padding: 24 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 700, color: '#1A3C5E' },
    panel: { background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' },
    filterBar: { padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 12, flexWrap: 'wrap' },
    input: { padding: '9px 12px', border: '2px solid #e0e0e0', borderRadius: 7, fontSize: 13, outline: 'none' },
    select: { padding: '9px 12px', border: '2px solid #e0e0e0', borderRadius: 7, fontSize: 13, background: '#fff' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '14px 16px', background: '#1A3C5E', color: '#fff', textAlign: 'left', fontSize: 12, fontWeight: 600 },
    td: { padding: '14px 16px', fontSize: 13, borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle' },
    badge: (type) => ({
      background: ['DEPOSIT','RECEIVE','LOAN_APPROVED','FD_MATURITY','RD_MATURITY'].includes(type) ? '#d4edda' : '#fde8e8',
      color: getTxnColor(type), padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    }),

    statusBadge: (s) => ({
      background: s === 'SUCCESS' ? '#d4edda' : s === 'FAILED' ? '#fde8e8' : '#fff3cd',
      color: s === 'SUCCESS' ? '#155724' : s === 'FAILED' ? '#721c24' : '#856404',
      padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    }),
    pagination: { padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0' },
    pageBtn: (active) => ({
      padding: '7px 13px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
      background: active ? '#1A3C5E' : '#f0f0f0', color: active ? '#fff' : '#333', fontWeight: active ? 700 : 400,
    }),
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Transaction History</h1>
        <span style={{ color: '#888', fontSize: 13 }}>{total} total transactions</span>
      </div>
      <div style={s.panel}>
        <div style={s.filterBar}>
          <input style={s.input} placeholder="🔍 Search transactions..." value={filters.search}
            onChange={e => { setFilters({...filters, search: e.target.value}); setPage(1); }} />
          <select style={s.select} value={filters.type}
            onChange={e => { setFilters({...filters, type: e.target.value}); setPage(1); }}>
            {TYPES.map(t => <option key={t} value={t}>{t || 'All Types'}</option>)}
          </select>
          <input style={s.input} type="date" value={filters.startDate}
            onChange={e => setFilters({...filters, startDate: e.target.value})} />
          <input style={s.input} type="date" value={filters.endDate}
            onChange={e => setFilters({...filters, endDate: e.target.value})} />
          <button style={{ ...s.input, background: '#e8f0fe', color: '#1A3C5E', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => { setFilters({ type:'', startDate:'', endDate:'', search:'' }); setPage(1); }}>
            Clear
          </button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Date', 'Type', 'Description', 'From/To', 'Amount', 'Balance After', 'Status'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 ? (
                <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: '#aaa', padding: 32 }}>No transactions found</td></tr>
              ) : txns.map((t, i) => (
                <tr key={t.transaction_id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={s.td}><div style={{ fontSize: 12 }}>{formatDate(t.created_at)}</div></td>
                  <td style={s.td}><span style={s.badge(t.transaction_type)}>{t.transaction_type}</span></td>
                  <td style={s.td}><div style={{ fontSize: 12, color: '#555' }}>{t.description || '-'}</div></td>
                  <td style={s.td}>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {t.transaction_type === 'TRANSFER' ? `→ ${t.receiver_account}` :
                       t.transaction_type === 'RECEIVE' ? `← ${t.sender_account}` : '-'}
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 700, color: getTxnColor(t.transaction_type), fontSize: 15 }}>
                      {['DEPOSIT','RECEIVE','LOAN_APPROVED'].includes(t.transaction_type) ? '+' : '−'}
                      {formatCurrency(t.amount)}
                    </span>
                  </td>
                  <td style={s.td}>{t.balance_after != null ? formatCurrency(t.balance_after) : '-'}</td>
                  <td style={s.td}><span style={s.statusBadge(t.status)}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={s.pagination}>
          <span style={{ fontSize: 13, color: '#888' }}>
            Showing {Math.min((page-1)*limit+1, total)}–{Math.min(page*limit, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={s.pageBtn(false)} onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>← Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, page - 2) + i;
              return p <= totalPages ? (
                <button key={p} style={s.pageBtn(p === page)} onClick={() => setPage(p)}>{p}</button>
              ) : null;
            })}
            <button style={s.pageBtn(false)} onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;
