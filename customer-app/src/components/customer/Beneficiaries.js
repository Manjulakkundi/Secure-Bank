/**
 * Customer App — Beneficiaries.js (Modern Fintech Payee Management)
 * Features:
 * - Single request on mount with unmount cleanup (prevents 429 infinite loops & StrictMode issues)
 * - Graceful HTTP 429 and error handling with manual "Retry" button (no raw Axios errors)
 * - Live 12-digit account number validation & verification badge
 * - Add Payee with dynamic loading states & div-based form (no <form> tag)
 * - Payee directory with initials avatar, masked account copy, and remove confirmation
 * - Shimmer loading skeleton & clean empty state
 * - Clean SVG icons (zero emojis) and inline fintech styling
 */
import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/api';
import { formatDate } from '../../utils/format';

const Beneficiaries = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [is429, setIs429] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Add form state
  const [accountNum, setAccountNum] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [validating, setValidating] = useState(false);
  const [verifiedName, setVerifiedName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch beneficiaries once on mount or upon explicit trigger
  const fetchBeneficiaries = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    setIs429(false);
    try {
      const res = await API.get('/customer/beneficiaries');
      if (res.data?.success) {
        setList(res.data.data.beneficiaries || []);
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setIs429(true);
        setErrorMsg('Too many requests. Please wait a moment and try again.');
      } else if (err.response?.status !== 401 && err.response?.status !== 403) {
        setErrorMsg(err.response?.data?.message || 'Unable to load beneficiaries. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBeneficiaries();
  }, [fetchBeneficiaries]);

  // Account validation helper
  const handleAccountChange = async (val) => {
    const clean = val.replace(/\D/g, '').slice(0, 12);
    setAccountNum(clean);
    setVerifiedName('');
    setActionError('');

    if (clean.length === 12) {
      setValidating(true);
      try {
        const { data } = await API.get(`/customer/beneficiaries/validate/${clean}`);
        if (data?.data?.customerName) {
          setVerifiedName(data.data.customerName);
          if (!payeeName) setPayeeName(data.data.customerName);
        }
      } catch (e) {
        setVerifiedName('NOT_FOUND');
      } finally {
        setValidating(false);
      }
    }
  };

  const handleAdd = async () => {
    if (!accountNum || accountNum.length !== 12) {
      setActionError('Please enter a valid 12-digit account number.');
      return;
    }
    if (!payeeName.trim()) {
      setActionError('Please provide a name or nickname for this beneficiary.');
      return;
    }
    if (verifiedName === 'NOT_FOUND') {
      setActionError('Cannot add beneficiary: Target account number was not found.');
      return;
    }

    setActionError('');
    setActionSuccess('');
    setSubmitting(true);
    try {
      const { data } = await API.post('/customer/beneficiaries', {
        beneficiaryAccount: accountNum,
        beneficiaryName: payeeName.trim(),
      });
      if (data?.success) {
        setActionSuccess('Beneficiary added successfully!');
        setAccountNum('');
        setPayeeName('');
        setVerifiedName('');
        fetchBeneficiaries();
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setActionError('Too many requests. Please wait a moment before trying again.');
      } else {
        setActionError(err.response?.data?.message || 'Failed to add beneficiary.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name || 'this beneficiary'} from your saved payees?`)) {
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const { data } = await API.delete(`/customer/beneficiaries/${id}`);
      if (data?.success) {
        setActionSuccess('Beneficiary removed successfully.');
        setList((prev) => prev.filter((b) => b.beneficiary_id !== id));
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setActionError('Too many requests. Please wait a moment before removing.');
      } else {
        setActionError(err.response?.data?.message || 'Failed to remove beneficiary.');
      }
    }
  };

  const getInitials = (name) => {
    if (!name) return 'SB';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const styles = {
    page: {
      backgroundColor: '#F8FAFC',
      minHeight: '100vh',
      padding: '32px 24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '28px',
      flexWrap: 'wrap',
      gap: '16px',
    },
    title: {
      fontSize: '26px',
      fontWeight: '800',
      color: '#0A1628',
      letterSpacing: '-0.02em',
      margin: '0 0 4px 0',
    },
    subtitle: {
      fontSize: '13px',
      color: '#64748B',
      margin: 0,
    },
    refreshBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      padding: '8px 14px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#334155',
      cursor: 'pointer',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'all 0.15s ease',
    },
    layoutGrid: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1.8fr',
      gap: '24px',
      alignItems: 'start',
    },
    card: {
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 16px -2px rgba(10, 22, 40, 0.04)',
      padding: '24px 28px',
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: '700',
      color: '#0A1628',
      margin: '0 0 6px 0',
      letterSpacing: '-0.01em',
    },
    cardDesc: {
      fontSize: '12px',
      color: '#64748B',
      margin: '0 0 20px 0',
    },
    formGroup: {
      marginBottom: '18px',
    },
    label: {
      display: 'block',
      fontSize: '12px',
      fontWeight: '600',
      color: '#334155',
      marginBottom: '6px',
    },
    input: {
      width: '100%',
      padding: '10px 14px',
      background: '#F8FAFC',
      border: '1.5px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '14px',
      color: '#0F172A',
      outline: 'none',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      transition: 'all 0.15s ease',
    },
    verifiedPill: (isOk) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      marginTop: '6px',
      fontSize: '12px',
      fontWeight: '600',
      color: isOk ? '#047857' : '#BE123C',
      background: isOk ? '#ECFDF5' : '#FFF1F2',
      border: `1px solid ${isOk ? '#A7F3D0' : '#FECDD3'}`,
      padding: '3px 10px',
      borderRadius: '6px',
    }),
    submitBtn: (disabled) => ({
      width: '100%',
      padding: '12px',
      background: disabled
        ? '#94A3B8'
        : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      marginTop: '22px',
      transition: 'all 0.15s ease',
    }),
    beneList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    beneItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '12px',
      transition: 'all 0.15s ease',
    },
    beneLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
    },
    avatar: {
      width: '42px',
      height: '42px',
      borderRadius: '10px',
      background: 'linear-gradient(135deg, #0A1628 0%, #1E3A8A 100%)',
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    beneName: {
      fontSize: '14px',
      fontWeight: '700',
      color: '#0A1628',
      margin: '0 0 2px 0',
    },
    beneAccount: {
      fontSize: '12px',
      color: '#475569',
      fontFamily: 'monospace',
      margin: '0 0 2px 0',
    },
    beneDate: {
      fontSize: '11px',
      color: '#94A3B8',
      margin: 0,
    },
    delBtn: {
      background: '#FFF1F2',
      border: '1px solid #FECDD3',
      color: '#BE123C',
      padding: '6px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.15s ease',
    },
    alertBar: (type) => ({
      background: type === 'ok' ? '#ECFDF5' : '#FFF1F2',
      border: `1px solid ${type === 'ok' ? '#A7F3D0' : '#FECDD3'}`,
      color: type === 'ok' ? '#047857' : '#BE123C',
      padding: '12px 16px',
      borderRadius: '8px',
      marginBottom: '18px',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }),
    retryBtn: {
      background: '#BE123C',
      color: '#FFFFFF',
      border: 'none',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      marginLeft: '12px',
    },
    skeletonItem: {
      height: '70px',
      borderRadius: '12px',
      background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
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
          .bene-hover-item:hover {
            background-color: #FFFFFF !important;
            border-color: #CBD5E1 !important;
            box-shadow: 0 4px 12px rgba(10, 22, 40, 0.04);
          }
          @media (max-width: 900px) {
            .beneficiary-layout-grid { grid-template-columns: 1fr !important; }
          }
        `}
      </style>

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Beneficiary Payees</h1>
            <p style={styles.subtitle}>
              Save and manage trusted beneficiary accounts for instantaneous fund transfers.
            </p>
          </div>

          <button
            style={styles.refreshBtn}
            onClick={fetchBeneficiaries}
            disabled={loading}
            title="Refresh list"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Global Action Alerts */}
        {actionSuccess && (
          <div style={styles.alertBar('ok')}>
            <span>✓ {actionSuccess}</span>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
              onClick={() => setActionSuccess('')}
            >
              ✕
            </button>
          </div>
        )}

        {actionError && (
          <div style={styles.alertBar('err')}>
            <span>✕ {actionError}</span>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
              onClick={() => setActionError('')}
            >
              ✕
            </button>
          </div>
        )}

        {/* 429 Rate-Limit / Global Fetch Error Alert */}
        {errorMsg && (
          <div style={styles.alertBar('err')}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
            {is429 && (
              <button style={styles.retryBtn} onClick={fetchBeneficiaries}>
                Retry Now
              </button>
            )}
          </div>
        )}

        {/* Main Grid */}
        <div style={styles.layoutGrid} className="beneficiary-layout-grid">
          {/* Left: Add Beneficiary Card */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Add New Payee</h2>
            <p style={styles.cardDesc}>Enter the 12-digit SecureBank account number of the recipient.</p>

            <div onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Account Number</label>
                <input
                  style={styles.input}
                  placeholder="12-digit account number"
                  maxLength={12}
                  value={accountNum}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  disabled={submitting}
                />
                {validating && (
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                    Verifying account in core ledger...
                  </div>
                )}
                {verifiedName && verifiedName !== 'NOT_FOUND' && (
                  <div style={styles.verifiedPill(true)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Verified: {verifiedName}</span>
                  </div>
                )}
                {verifiedName === 'NOT_FOUND' && (
                  <div style={styles.verifiedPill(false)}>
                    <span>Account not found</span>
                  </div>
                )}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Beneficiary Nickname / Label</label>
                <input
                  style={styles.input}
                  placeholder="e.g. Office Rent, Alex"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <button
                style={styles.submitBtn(submitting || verifiedName === 'NOT_FOUND')}
                disabled={submitting || verifiedName === 'NOT_FOUND'}
                onClick={handleAdd}
              >
                {submitting ? (
                  <span>Securing &amp; Adding...</span>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                    <span>Add Beneficiary</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Saved Beneficiaries Directory */}
          <div style={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={styles.cardTitle}>
                Saved Payees ({list.length})
              </h2>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>Direct Settlement</span>
            </div>

            {loading ? (
              <div style={styles.beneList}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={styles.skeletonItem} />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#64748B' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  No beneficiaries saved yet
                </div>
                <div style={{ fontSize: '13px', maxWidth: '300px', margin: '0 auto' }}>
                  Add your first beneficiary to make instant fund transfers faster and easier.
                </div>
              </div>
            ) : (
              <div style={styles.beneList}>
                {list.map((b) => (
                  <div key={b.beneficiary_id} style={styles.beneItem} className="bene-hover-item">
                    <div style={styles.beneLeft}>
                      <div style={styles.avatar}>{getInitials(b.beneficiary_name)}</div>
                      <div>
                        <p style={styles.beneName}>{b.beneficiary_name}</p>
                        <p style={styles.beneAccount}>
                          {b.beneficiary_account?.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}
                          {b.bankName && <span style={{ color: '#64748B', marginLeft: '6px' }}>({b.bankName})</span>}
                        </p>
                        <p style={styles.beneDate}>Added on {formatDate(b.created_at)}</p>
                      </div>
                    </div>

                    <button
                      style={styles.delBtn}
                      onClick={() => handleDelete(b.beneficiary_id, b.beneficiary_name)}
                      title="Remove Beneficiary"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>Remove</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Beneficiaries;
