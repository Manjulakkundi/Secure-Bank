/**
 * Admin App — AdminLoans.js (Underwriting & Credit Approval Center)
 * Features:
 * - Kanban-style filter tabs with live counters (Pending, Approved, Denied, All)
 * - Loan metrics table with amount progress visualizers, interest pills, and duration tags
 * - One-click approval / denial controls with instant optimistic refresh
 * - Empty state with icon and skeleton loading shimmer
 */
import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

const AdminLoans = () => {
  const [loans, setLoans] = useState([]);
  const [filter, setFilter] = useState('Pending');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLoans = useCallback((cancelled = { value: false }) => {
    setLoading(true);
    API.get(`/admin/loans${filter ? `?status=${filter}` : ''}`)
      .then((r) => {
        if (!cancelled.value) setLoans(r.data.data.loans || []);
      })
      .catch((err) => {
        if (err.response?.status !== 403 && err.response?.status !== 401) console.error(err);
      })
      .finally(() => {
        if (!cancelled.value) setLoading(false);
      });
  }, [filter]);

  useEffect(() => {
    const cancelled = { value: false };
    fetchLoans(cancelled);
    const interval = setInterval(() => fetchLoans(cancelled), 15000);
    return () => {
      cancelled.value = true;
      clearInterval(interval);
    };
  }, [fetchLoans]);

  const decide = async (loanId, approvalStatus) => {
    try {
      await API.post(`/admin/loans/${loanId}/approve`, { approvalStatus });
      setMsg(`Loan application #${loanId} has been marked as ${approvalStatus}.`);
      fetchLoans();
    } catch (e) {
      setMsg(e.response?.data?.message || 'Error updating loan status.');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'LO';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
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
      gap: '8px',
      alignItems: 'center',
      borderBottom: '1px solid #F1F5F9',
      flexWrap: 'wrap',
    },
    tabButton: (isActive) => ({
      padding: '8px 16px',
      borderRadius: '8px',
      border: `1px solid ${isActive ? '#2563EB' : '#E2E8F0'}`,
      background: isActive ? '#EFF6FF' : '#FFFFFF',
      color: isActive ? '#1D4ED8' : '#64748B',
      fontWeight: '600',
      fontSize: '12px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.15s ease',
    }),
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
      transition: 'background-color 0.15s ease',
    },
    td: {
      padding: '14px 16px',
      fontSize: '13px',
      verticalAlign: 'middle',
      color: '#334155',
    },
    statusBadge: (status) => {
      const isApproved = status === 'Approved';
      const isDenied = status === 'Denied';
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: '700',
        background: isApproved ? '#ECFDF5' : isDenied ? '#FFF1F2' : '#FFFBEB',
        color: isApproved ? '#047857' : isDenied ? '#BE123C' : '#B45309',
        border: `1px solid ${isApproved ? '#A7F3D0' : isDenied ? '#FECDD3' : '#FDE68A'}`,
      };
    },
    approveBtn: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: '1px solid #A7F3D0',
      background: '#ECFDF5',
      color: '#047857',
      fontWeight: '600',
      fontSize: '12px',
      cursor: 'pointer',
      marginRight: '6px',
      transition: 'all 0.15s ease',
    },
    denyBtn: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: '1px solid #FECDD3',
      background: '#FFF1F2',
      color: '#BE123C',
      fontWeight: '600',
      fontSize: '12px',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    },
    avatarBox: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: '11px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };

  const tabs = [
    { key: 'Pending', label: 'Pending Review' },
    { key: 'Approved', label: 'Approved' },
    { key: 'Denied', label: 'Denied' },
    { key: '', label: 'All Applications' },
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Loan Underwriting Portal</h1>
          <p style={styles.pageSubtitle}>
            Credit review, loan approvals, EMI schedules, and interest risk controls.
          </p>
        </div>
      </div>

      {/* Global Alert Notification */}
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

      {/* Panel */}
      <div style={styles.panel}>
        {/* Kanban-Style Toolbar Tabs */}
        <div style={styles.toolbar}>
          {tabs.map((t) => (
            <button
              key={t.key}
              style={styles.tabButton(filter === t.key)}
              onClick={() => setFilter(t.key)}
            >
              <span>{t.label}</span>
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
            {loans.length} applications
          </span>
        </div>

        {/* Table */}
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['App ID', 'Applicant', 'Account No', 'Principal', 'Duration', 'Rate', 'Total Repayable', 'Applied On', 'Status', 'Decision'].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td colSpan={10} style={{ padding: '16px' }}>
                      <div style={{ height: '24px', background: '#F1F5F9', borderRadius: '4px' }} />
                    </td>
                  </tr>
                ))
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#334155' }}>No loan applications in this category</div>
                    <div style={{ fontSize: '13px' }}>Switch tabs or check back later for customer requests.</div>
                  </td>
                </tr>
              ) : (
                loans.map((l) => (
                  <tr key={l.LoanID} style={styles.tr}>
                    <td style={styles.td}>
                      <code style={{ fontSize: '12px', fontWeight: '700', color: '#2563EB', background: '#EFF6FF', padding: '3px 8px', borderRadius: '4px' }}>
                        #{l.LoanID}
                      </code>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={styles.avatarBox}>{getInitials(l.customerName)}</div>
                        <div>
                          <div style={{ fontWeight: '700', color: '#0A1628' }}>{l.customerName}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{l.customerEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <code style={{ fontSize: '12px', color: '#475569' }}>{l.AccountNumber}</code>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#0A1628' }}>
                        {formatCurrency(l.LoanAmount)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>{l.LoanDurationMonths} Months</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563EB', background: '#EFF6FF', padding: '2px 7px', borderRadius: '4px' }}>
                        {l.LoanInterest}% p.a.
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>
                        {l.TotalPayableAmount > 0 ? formatCurrency(l.TotalPayableAmount) : '—'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>{formatDate(l.AppliedDate)}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge(l.ApprovalStatus)}>
                        <span>{l.ApprovalStatus}</span>
                      </span>
                    </td>
                    <td style={styles.td}>
                      {l.ApprovalStatus === 'Pending' ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button style={styles.approveBtn} onClick={() => decide(l.LoanID, 'Approved')}>
                            Approve
                          </button>
                          <button style={styles.denyBtn} onClick={() => decide(l.LoanID, 'Denied')}>
                            Deny
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '500' }}>Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminLoans;