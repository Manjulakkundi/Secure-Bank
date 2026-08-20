/**
 * Admin App — AdminCustomers.js (Enterprise Customer Operations)
 * Features:
 * - Data table with avatar initials, status pills, and inline action buttons
 * - Live search with instant filtering & status filter
 * - High-end Glassmorphic Deposit & Withdraw cash modal with real-time balance calculations
 * - Account verification, freezing/unfreezing actions with instant optimistic state refresh
 * - Skeleton shimmer loading state & empty state
 * - Strict adherence to no <form> tags rule & inline styling
 */
import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { formatCurrency } from '../../utils/format';

const AdminCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [modal, setModal] = useState({ type: null, customer: null });
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick((t) => t + 1);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const cancelled = { value: false };
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: 15 });
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        const { data } = await API.get(`/admin/customers?${params}`);
        if (!cancelled.value) {
          setCustomers(data.data.customers || []);
          setTotal(data.data.total || 0);
        }
      } catch (e) {
        if (!cancelled.value && e.response?.status !== 401 && e.response?.status !== 403) {
          console.error('Customer fetch error:', e);
        }
      } finally {
        if (!cancelled.value) setLoading(false);
      }
    };
    fetchCustomers();
    const interval = setInterval(fetchCustomers, 15000);
    return () => {
      cancelled.value = true;
      clearInterval(interval);
    };
  }, [page, search, status, refreshTick]);

  const openModal = (type, customer) => {
    setModal({ type, customer });
    setAmount('');
    setDescription(type === 'deposit' ? 'Cash Deposit' : 'Cash Withdrawal');
    setMsg({ text: '', ok: true });
  };

  const closeModal = () => {
    setModal({ type: null, customer: null });
    setAmount('');
    setDescription('');
  };

  const showMsg = (text, ok = true) => setMsg({ text, ok });

  const freeze = async (acc) => {
    try {
      await API.post(`/admin/customers/${acc}/freeze`);
      showMsg(`Account ${acc} has been frozen.`, true);
      refresh();
    } catch (e) {
      showMsg(e.response?.data?.message || 'Error freezing account.', false);
    }
  };

  const unfreeze = async (acc) => {
    try {
      await API.post(`/admin/customers/${acc}/unfreeze`);
      showMsg(`Account ${acc} has been reactivated.`, true);
      refresh();
    } catch (e) {
      showMsg(e.response?.data?.message || 'Error reactivating account.', false);
    }
  };

  const verifyAccount = async (acc) => {
    try {
      const { data } = await API.post('/admin/verify-customer', { accountNumber: acc });
      showMsg(data?.message || `Account ${acc} approved and activated successfully. Account creation email queued.`, true);
      refresh();
    } catch (e) {
      showMsg(e.response?.data?.message || 'Error verifying account.', false);
    }
  };


  const handleSubmit = async () => {
    const { type, customer } = modal;
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      showMsg('Please enter a valid amount greater than ₹0', false);
      return;
    }
    if (type === 'withdraw' && parsed > parseFloat(customer.Balance)) {
      showMsg(`Insufficient funds. Available balance: ${formatCurrency(customer.Balance)}`, false);
      return;
    }
    setSubmitting(true);
    try {
      if (type === 'deposit') {
        const { data } = await API.post('/admin/deposit', {
          accountNumber: customer.AccountNumber,
          depositAmount: parsed,
          description,
        });
        showMsg(`Successfully deposited ${formatCurrency(parsed)} to ${customer.AccountNumber}. New balance: ${formatCurrency(data.data.newBalance)}`, true);
      } else {
        const { data } = await API.post('/admin/withdraw', {
          accountNumber: customer.AccountNumber,
          withdrawAmount: parsed,
          description,
        });
        showMsg(`Successfully withdrawn ${formatCurrency(parsed)} from ${customer.AccountNumber}. New balance: ${formatCurrency(data.data.newBalance)}`, true);
      }
      closeModal();
      refresh();
    } catch (e) {
      showMsg(e.response?.data?.message || 'Transaction processing failed', false);
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'CU';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const isDeposit = modal.type === 'deposit';

  const styles = {
    page: {
      padding: '36px 40px',
      backgroundColor: '#F8FAFC',
      minHeight: '100vh',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
      flexWrap: 'wrap',
      backgroundColor: '#FFFFFF',
    },
    searchContainer: {
      position: 'relative',
      flex: '1',
      minWidth: '240px',
    },
    searchIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#94A3B8',
      display: 'flex',
    },
    searchInput: {
      width: '100%',
      padding: '9px 12px 9px 36px',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '13px',
      color: '#0F172A',
      outline: 'none',
      boxSizing: 'border-box',
    },
    selectInput: {
      padding: '9px 14px',
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
      transition: 'background-color 0.15s ease',
    },
    td: {
      padding: '14px 16px',
      fontSize: '13px',
      verticalAlign: 'middle',
      color: '#334155',
    },
    avatarBox: {
      width: '34px',
      height: '34px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    customerCell: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    statusBadge: (st) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      background: st === 'Active' ? '#ECFDF5' : '#FFF1F2',
      color: st === 'Active' ? '#047857' : '#BE123C',
      border: `1px solid ${st === 'Active' ? '#A7F3D0' : '#FECDD3'}`,
    }),
    verifyBadge: (verified) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '11px',
      fontWeight: '600',
      color: verified ? '#059669' : '#D97706',
      background: verified ? '#ECFDF5' : '#FFFBEB',
      border: `1px solid ${verified ? '#D1FAE5' : '#FDE68A'}`,
      padding: '3px 8px',
      borderRadius: '6px',
    }),
    actionBtnGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    actionBtn: (variant) => {
      const config = {
        freeze:   { bg: '#FFF1F2', border: '#FFE4E6', text: '#BE123C' },
        unfreeze: { bg: '#ECFDF5', border: '#D1FAE5', text: '#047857' },
        deposit:  { bg: '#EFF6FF', border: '#DBEAFE', text: '#1D4ED8' },
        withdraw: { bg: '#FFFBEB', border: '#FEF3C7', text: '#B45309' },
        verify:   { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
      };
      const theme = config[variant] || { bg: '#F8FAFC', border: '#E2E8F0', text: '#334155' };
      return {
        padding: '6px 10px',
        borderRadius: '6px',
        border: `1px solid ${theme.border}`,
        fontSize: '11px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: theme.bg,
        color: theme.text,
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
    // Modal Overlay
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 22, 40, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    },
    modalCard: {
      background: '#FFFFFF',
      borderRadius: '16px',
      width: '100%',
      maxWidth: '460px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden',
      border: '1px solid #E2E8F0',
    },
    modalHeader: (isDep) => ({
      background: isDep
        ? 'linear-gradient(135deg, #0A1628 0%, #1E3A8A 100%)'
        : 'linear-gradient(135deg, #0A1628 0%, #991B1B 100%)',
      padding: '24px 28px',
      color: '#FFFFFF',
    }),
    modalTitle: {
      fontSize: '18px',
      fontWeight: '700',
      margin: '0 0 4px 0',
      letterSpacing: '-0.01em',
    },
    modalSubtitle: {
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.75)',
      margin: 0,
    },
    modalBody: {
      padding: '24px 28px',
    },
    customerPreviewBox: {
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '10px',
      padding: '14px 16px',
      marginBottom: '20px',
    },
    formGroup: {
      marginBottom: '18px',
    },
    inputLabel: {
      display: 'block',
      fontSize: '12px',
      fontWeight: '600',
      color: '#334155',
      marginBottom: '6px',
    },
    modalInput: {
      width: '100%',
      padding: '10px 14px',
      background: '#FFFFFF',
      border: '1.5px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '14px',
      color: '#0F172A',
      outline: 'none',
      boxSizing: 'border-box',
    },
    modalFooter: {
      display: 'flex',
      gap: '10px',
      marginTop: '24px',
    },
    confirmBtn: (isDep, isSubmitting) => ({
      flex: 1,
      padding: '11px',
      borderRadius: '8px',
      border: 'none',
      background: isSubmitting
        ? '#94A3B8'
        : isDep
        ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
        : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: '13px',
      cursor: isSubmitting ? 'not-allowed' : 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }),
    cancelBtn: {
      padding: '11px 18px',
      borderRadius: '8px',
      border: '1px solid #E2E8F0',
      background: '#F8FAFC',
      color: '#475569',
      fontWeight: '600',
      fontSize: '13px',
      cursor: 'pointer',
    },
  };

  return (
    <div style={styles.page}>
      <style>
        {`
          .customer-row:hover { background-color: #F8FAFC !important; }
        `}
      </style>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Customer Registry</h1>
          <p style={styles.pageSubtitle}>
            Manage retail customer accounts, verification badges, and cash flow transactions ({total} registered).
          </p>
        </div>
      </div>

      {/* Global Alert Notification */}
      {msg.text && (
        <div
          style={{
            background: msg.ok ? '#ECFDF5' : '#FFF1F2',
            border: `1px solid ${msg.ok ? '#A7F3D0' : '#FECDD3'}`,
            color: msg.ok ? '#047857' : '#BE123C',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{msg.text}</span>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'inherit' }}
            onClick={() => setMsg({ text: '', ok: true })}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Table Panel */}
      <div style={styles.panel}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.searchContainer}>
            <div style={styles.searchIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              style={styles.searchInput}
              placeholder="Search by name, email, or account number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            style={styles.selectInput}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Account Statuses</option>
            <option value="Active">Active Accounts</option>
            <option value="Pending">Pending Verification</option>
            <option value="Frozen">Frozen Accounts</option>
          </select>

        </div>

        {/* Table Content */}
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Account No', 'Customer Profile', 'Type', 'Phone', 'Core Balance', 'Status', 'KYC', 'Quick Actions'].map((h) => (
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
                    <td colSpan={8} style={{ padding: '16px' }}>
                      <div style={{ height: '24px', background: '#F1F5F9', borderRadius: '4px' }} />
                    </td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#334155' }}>No customers found</div>
                    <div style={{ fontSize: '13px' }}>Try searching with a different name or clear filters.</div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.AccountNumber} style={styles.tr} className="customer-row">
                    <td style={styles.td}>
                      <code style={{ fontSize: '12px', fontWeight: '700', color: '#0A1628', background: '#F1F5F9', padding: '3px 8px', borderRadius: '4px' }}>
                        {c.AccountNumber}
                      </code>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.customerCell}>
                        <div style={styles.avatarBox}>{getInitials(c.customerName)}</div>
                        <div>
                          <div style={{ fontWeight: '700', color: '#0A1628' }}>{c.customerName}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{c.customerEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>{c.AccountType || 'Savings'}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>{c.customerPhone || '—'}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#0A1628' }}>
                        {formatCurrency(c.Balance)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge(c.AccountStatus)}>
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: c.AccountStatus === 'Active' ? '#10B981' : '#F43F5E',
                          }}
                        />
                        <span>{c.AccountStatus}</span>
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.verifyBadge(c.AccountVerify)}>
                        {c.AccountVerify ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionBtnGroup}>
                        {!c.AccountVerify && (
                          <button style={styles.actionBtn('verify')} onClick={() => verifyAccount(c.AccountNumber)} title="Verify KYC">
                            Verify KYC
                          </button>
                        )}
                        {c.AccountStatus === 'Active' ? (
                          <button style={styles.actionBtn('freeze')} onClick={() => freeze(c.AccountNumber)} title="Freeze Account">
                            Freeze
                          </button>
                        ) : (
                          <button style={styles.actionBtn('unfreeze')} onClick={() => unfreeze(c.AccountNumber)} title="Unfreeze Account">
                            Unfreeze
                          </button>
                        )}
                        <button style={styles.actionBtn('deposit')} onClick={() => openModal('deposit', c)} title="Deposit Cash">
                          Deposit
                        </button>
                        <button style={styles.actionBtn('withdraw')} onClick={() => openModal('withdraw', c)} title="Withdraw Cash">
                          Withdraw
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={styles.paginationBar}>
          <button
            style={styles.pageButton(page === 1)}
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Previous
          </button>
          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
            Page {page} · Showing {customers.length} records
          </span>
          <button
            style={styles.pageButton(customers.length < 15)}
            disabled={customers.length < 15}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Modal Dialog (Deposit / Withdraw) */}
      {modal.type && modal.customer && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader(isDeposit)}>
              <h3 style={styles.modalTitle}>
                {isDeposit ? 'Deposit Cash to Account' : 'Withdraw Cash from Account'}
              </h3>
              <p style={styles.modalSubtitle}>
                {isDeposit ? 'Credit liquidity directly into customer balance' : 'Debit liquidity from customer balance'}
              </p>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.customerPreviewBox}>
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '2px' }}>Beneficiary Account</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0A1628' }}>{modal.customer.customerName}</div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  Account: <code>{modal.customer.AccountNumber}</code>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#2563EB', marginTop: '6px' }}>
                  Available Balance: {formatCurrency(modal.customer.Balance)}
                </div>
              </div>

              {msg.text && !msg.ok && (
                <div style={{ background: '#FFF1F2', color: '#BE123C', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px' }}>
                  {msg.text}
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>Transaction Amount (₹)</label>
                <input
                  style={styles.modalInput}
                  type="number"
                  min="1"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>Ledger Description / Memo</label>
                <input
                  style={styles.modalInput}
                  type="text"
                  placeholder={isDeposit ? 'Branch Cash Deposit' : 'ATM / Branch Withdrawal'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={styles.modalFooter}>
                <button
                  style={styles.confirmBtn(isDeposit, submitting)}
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Processing Transaction...' : isDeposit ? 'Confirm Deposit' : 'Confirm Withdrawal'}
                </button>
                <button style={styles.cancelBtn} onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;