/**
 * Customer App — Investments.js (Enterprise Fintech Investment Management)
 * Features:
 * - Fixed Deposit (FD) creator with real-time Simple Interest calculator & balance checks
 * - Recurring Deposit (RD) creator with scheduled roadmap & zero-deduction notice
 * - My Investments portfolio with active/matured FD cards and RD contribution tracker
 * - Manual RD installment contribution modal with live account balance validation
 * - Month-by-month contribution breakdown with PAID, PENDING, and MISSED states
 * - Inline styles, pure SVG icons (zero emojis), and no <form> tags
 */
import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

const Investments = () => {
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio' | 'fd' | 'rd'
  const [data, setData] = useState(null);
  const [rateSheet, setRateSheet] = useState([]);
  const [accountBalance, setAccountBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // FD Form State
  const [fdAmount, setFdAmount] = useState('50000');
  const [fdTenure, setFdTenure] = useState(24);
  const [fdSubmitting, setFdSubmitting] = useState(false);
  const [fdModalOpen, setFdModalOpen] = useState(false);

  // RD Form State
  const [rdMonthly, setRdMonthly] = useState('2000');
  const [rdTenure, setRdTenure] = useState(24);
  const [rdSubmitting, setRdSubmitting] = useState(false);
  const [rdModalOpen, setRdModalOpen] = useState(false);

  // RD Payment Modal State
  const [selectedRdForPayment, setSelectedRdForPayment] = useState(null);
  const [payingRd, setPayingRd] = useState(false);

  // Selected RD for Details History Modal
  const [selectedRdForHistory, setSelectedRdForHistory] = useState(null);

  // Fetch investments, rate sheet, and live account info
  const loadData = useCallback(async () => {
    setLoading(true);
    setActionError('');
    try {
      const [investRes, ratesRes, accRes] = await Promise.all([
        API.get('/customer/investments'),
        API.get('/customer/investments/rates'),
        API.get('/customer/account-info'),
      ]);

      if (investRes.data?.success) {
        setData(investRes.data.data);
      }
      if (ratesRes.data?.success) {
        setRateSheet(ratesRes.data.data.rates || []);
      }
      if (accRes.data?.success) {
        setAccountBalance(parseFloat(accRes.data.data.Balance || 0));
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setActionError(err.response?.data?.message || 'Unable to load investment data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculation helpers using selected rate sheet
  const getRate = (tenureMonths) => {
    const found = rateSheet.find((r) => r.tenureMonths === parseInt(tenureMonths, 10));
    return found ? found.annualRate : 7.10;
  };

  // FD Local Calculation Preview
  const principalNum = parseFloat(fdAmount) || 0;
  const fdRate = getRate(fdTenure);
  const fdInterest = parseFloat((principalNum * (fdRate / 100) * (parseInt(fdTenure, 10) / 12)).toFixed(2));
  const fdMaturityAmount = parseFloat((principalNum + fdInterest).toFixed(2));
  const isFdBalanceInsufficient = principalNum > accountBalance;
  const isFdAmountValid = principalNum >= 1000 && !isFdBalanceInsufficient;

  // RD Local Calculation Preview
  const rdMonthlyNum = parseFloat(rdMonthly) || 0;
  const rdMonthsNum = parseInt(rdTenure, 10);
  const rdRate = getRate(rdMonthsNum);
  const rdTotalScheduled = parseFloat((rdMonthlyNum * rdMonthsNum).toFixed(2));
  const rdEstimatedInterest = parseFloat((rdMonthlyNum * (rdRate / 100) * ((rdMonthsNum * (rdMonthsNum + 1)) / 24)).toFixed(2));
  const rdEstimatedMaturity = parseFloat((rdTotalScheduled + rdEstimatedInterest).toFixed(2));
  const isRdAmountValid = rdMonthlyNum >= 500;

  // Date preview
  const getMaturityDatePreview = (months) => {
    const d = new Date();
    d.setMonth(d.getMonth() + parseInt(months, 10));
    return formatDate(d);
  };

  // Submit Fixed Deposit Creation
  const handleCreateFd = async () => {
    if (!isFdAmountValid) return;
    setFdSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await API.post('/customer/investments/fd/create', {
        principalAmount: principalNum,
        tenureMonths: parseInt(fdTenure, 10),
      });

      if (res.data?.success) {
        setActionSuccess(`Fixed Deposit #${res.data.data.fdId} created successfully for ${formatCurrency(principalNum)}.`);
        setFdModalOpen(false);
        setFdAmount('50000');
        setActiveTab('portfolio');
        loadData();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to create Fixed Deposit.');
    } finally {
      setFdSubmitting(false);
    }
  };

  // Submit Recurring Deposit Creation
  const handleCreateRd = async () => {
    if (!isRdAmountValid) return;
    setRdSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await API.post('/customer/investments/rd/create', {
        monthlyAmount: rdMonthlyNum,
        tenureMonths: rdMonthsNum,
      });

      if (res.data?.success) {
        setActionSuccess(`Recurring Deposit schedule #${res.data.data.rdId} created successfully. No initial deduction was made.`);
        setRdModalOpen(false);
        setRdMonthly('2000');
        setActiveTab('portfolio');
        loadData();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to start Recurring Deposit.');
    } finally {
      setRdSubmitting(false);
    }
  };

  // Execute Manual RD Contribution
  const handlePayRdContribution = async () => {
    if (!selectedRdForPayment) return;
    setPayingRd(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await API.post(`/customer/investments/rd/${selectedRdForPayment.id}/contribute`);
      if (res.data?.success) {
        setActionSuccess(
          `Contribution #${res.data.data.contributionNumber} of ${formatCurrency(res.data.data.amountPaid)} paid successfully for RD #${selectedRdForPayment.id}.`
        );
        setSelectedRdForPayment(null);
        loadData();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to process RD contribution.');
    } finally {
      setPayingRd(false);
    }
  };

  const overview = data?.overview || {
    totalInvested: 0,
    activeFdPrincipal: 0,
    totalRdAmountPaid: 0,
    activeRdMonthly: 0,
    expectedMaturityValue: 0,
    activeFdCount: 0,
    activeRdCount: 0,
  };

  const styles = {
    page: {
      backgroundColor: '#F8FAFC',
      minHeight: '100vh',
      padding: '32px 24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    container: {
      maxWidth: '1280px',
      margin: '0 auto',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '24px',
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
    balancePill: {
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '10px',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    },
    kpiGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '20px',
      marginBottom: '28px',
    },
    kpiCard: (isHero) => ({
      background: isHero
        ? 'linear-gradient(135deg, #0A1628 0%, #1E3A8A 100%)'
        : '#FFFFFF',
      borderRadius: '16px',
      padding: '22px 24px',
      border: isHero ? 'none' : '1px solid #E2E8F0',
      color: isHero ? '#FFFFFF' : '#0F172A',
      boxShadow: isHero
        ? '0 12px 28px -6px rgba(10, 22, 40, 0.25)'
        : '0 4px 14px -2px rgba(10, 22, 40, 0.04)',
      position: 'relative',
      overflow: 'hidden',
    }),
    tabBar: {
      display: 'flex',
      gap: '8px',
      background: '#F1F5F9',
      padding: '5px',
      borderRadius: '12px',
      marginBottom: '28px',
      border: '1px solid #E2E8F0',
      maxWidth: '560px',
    },
    tabBtn: (isActive) => ({
      flex: 1,
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      background: isActive ? '#FFFFFF' : 'transparent',
      color: isActive ? '#0A1628' : '#64748B',
      boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
      transition: 'all 0.15s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    }),
    card: {
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 16px -2px rgba(10, 22, 40, 0.04)',
      padding: '28px',
      marginBottom: '24px',
    },
    cardTitle: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#0A1628',
      margin: '0 0 6px 0',
      letterSpacing: '-0.01em',
    },
    cardDesc: {
      fontSize: '13px',
      color: '#64748B',
      margin: '0 0 24px 0',
    },
    formGroup: {
      marginBottom: '20px',
    },
    label: {
      display: 'block',
      fontSize: '12px',
      fontWeight: '600',
      color: '#334155',
      marginBottom: '8px',
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      background: '#F8FAFC',
      border: '1.5px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '15px',
      color: '#0F172A',
      outline: 'none',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      fontWeight: '500',
    },
    tenureGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
      gap: '12px',
      marginTop: '8px',
    },
    tenureChip: (isSelected) => ({
      padding: '14px 12px',
      background: isSelected ? '#EFF6FF' : '#F8FAFC',
      border: `1.5px solid ${isSelected ? '#2563EB' : '#E2E8F0'}`,
      borderRadius: '10px',
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all 0.15s ease',
    }),
    summaryTable: {
      width: '100%',
      borderCollapse: 'collapse',
      background: '#F8FAFC',
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid #E2E8F0',
      marginTop: '20px',
    },
    summaryRow: (isHighlight) => ({
      background: isHighlight ? '#F0FDF4' : 'transparent',
      borderBottom: '1px solid #E2E8F0',
    }),
    summaryCell: {
      padding: '12px 16px',
      fontSize: '13px',
    },
    primaryBtn: (disabled) => ({
      padding: '12px 24px',
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
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.15s ease',
    }),
    statusBadge: (status) => {
      let bg = '#F1F5F9';
      let color = '#475569';
      let border = '#E2E8F0';

      if (status === 'ACTIVE' || status === 'PAID') {
        bg = '#ECFDF5';
        color = '#047857';
        border = '#A7F3D0';
      } else if (status === 'MATURED') {
        bg = '#EFF6FF';
        color = '#1D4ED8';
        border = '#BFDBFE';
      } else if (status === 'MISSED' || status === 'CANCELLED') {
        bg = '#FFF1F2';
        color = '#BE123C';
        border = '#FECDD3';
      } else if (status === 'PENDING') {
        bg = '#FFFBEB';
        color = '#B45309';
        border = '#FDE68A';
      }

      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      };
    },
    alertBar: (type) => ({
      background: type === 'ok' ? '#ECFDF5' : '#FFF1F2',
      border: `1px solid ${type === 'ok' ? '#A7F3D0' : '#FECDD3'}`,
      color: type === 'ok' ? '#047857' : '#BE123C',
      padding: '12px 16px',
      borderRadius: '8px',
      marginBottom: '20px',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }),
    disclaimerBanner: {
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '10px',
      padding: '14px 18px',
      fontSize: '12px',
      color: '#64748B',
      lineHeight: '1.5',
      marginTop: '32px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
    },
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 22, 40, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px',
    },
    modalCard: {
      background: '#FFFFFF',
      borderRadius: '16px',
      maxWidth: '520px',
      width: '100%',
      padding: '28px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      border: '1px solid #E2E8F0',
    },
  };

  return (
    <div style={styles.page}>
      <style>
        {`
          .tenure-chip:hover { border-color: #3B82F6 !important; background-color: #F8FAFC; }
          .deposit-card-hover:hover { box-shadow: 0 8px 24px -4px rgba(10, 22, 40, 0.08) !important; border-color: #CBD5E1 !important; }
          @media (max-width: 768px) {
            .investment-layout-split { grid-template-columns: 1fr !important; }
          }
        `}
      </style>

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Fixed &amp; Recurring Deposits</h1>
            <p style={styles.subtitle}>
              Automated wealth accumulation with guaranteed returns and institutional security.
            </p>
          </div>

          <div style={styles.balancePill}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>
                Available Balance
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0A1628' }}>
                {formatCurrency(accountBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Global Alerts */}
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

        {/* Portfolio KPI Summary Grid */}
        <div style={styles.kpiGrid}>
          {/* Total Invested */}
          <div style={styles.kpiCard(true)}>
            <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', color: '#93C5FD', marginBottom: '8px' }}>
              Total Invested
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '10px' }}>
              {formatCurrency(overview.totalInvested)}
            </div>
            <div style={{ fontSize: '12px', color: '#CBD5E1', display: 'flex', gap: '14px' }}>
              <span>FD: {formatCurrency(overview.activeFdPrincipal)}</span>
              <span>RD Paid: {formatCurrency(overview.totalRdAmountPaid)}</span>
            </div>
          </div>

          {/* Active FD Principal */}
          <div style={styles.kpiCard(false)}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '6px' }}>
              Active Fixed Deposits ({overview.activeFdCount})
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0A1628', marginBottom: '6px' }}>
              {formatCurrency(overview.activeFdPrincipal)}
            </div>
            <div style={{ fontSize: '11px', color: '#10B981', fontWeight: '600' }}>
              Locked &amp; Compounding
            </div>
          </div>

          {/* Total RD Amount Paid */}
          <div style={styles.kpiCard(false)}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '6px' }}>
              Total RD Amount Paid ({overview.activeRdCount})
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0A1628', marginBottom: '6px' }}>
              {formatCurrency(overview.totalRdAmountPaid)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>
              Active Monthly: {formatCurrency(overview.activeRdMonthly)}/mo
            </div>
          </div>

          {/* Expected Maturity Value */}
          <div style={styles.kpiCard(false)}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '6px' }}>
              Expected Maturity Value
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0D9488', marginBottom: '6px' }}>
              {formatCurrency(overview.expectedMaturityValue)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>
              Principal + Simulated Return
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={styles.tabBar}>
          <button
            style={styles.tabBtn(activeTab === 'portfolio')}
            onClick={() => setActiveTab('portfolio')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span>My Investments</span>
          </button>
          <button
            style={styles.tabBtn(activeTab === 'fd')}
            onClick={() => setActiveTab('fd')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Open Fixed Deposit</span>
          </button>
          <button
            style={styles.tabBtn(activeTab === 'rd')}
            onClick={() => setActiveTab('rd')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Start Recurring Deposit</span>
          </button>
        </div>

        {/* TAB 1: MY INVESTMENTS PORTFOLIO */}
        {activeTab === 'portfolio' && (
          <div>
            {/* Fixed Deposits Section */}
            <div style={styles.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h2 style={styles.cardTitle}>Fixed Deposits</h2>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Lump-sum deposits earning guaranteed tenure interest.</p>
                </div>
                <button
                  style={styles.primaryBtn(false)}
                  onClick={() => setActiveTab('fd')}
                >
                  <span>+ New Fixed Deposit</span>
                </button>
              </div>

              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>Loading deposits...</div>
              ) : !data?.fixedDeposits || data.fixedDeposits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>No Fixed Deposits active</div>
                  <div style={{ fontSize: '12px' }}>Open an FD to lock in high-yield returns for a fixed tenure.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {data.fixedDeposits.map((fd) => (
                    <div
                      key={fd.id}
                      style={{
                        padding: '20px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        transition: 'all 0.15s ease',
                      }}
                      className="deposit-card-hover"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0A1628' }}>
                          FD #{fd.id}
                        </div>
                        <span style={styles.statusBadge(fd.status)}>{fd.status}</span>
                      </div>

                      <div style={{ fontSize: '22px', fontWeight: '800', color: '#0A1628', marginBottom: '14px' }}>
                        {formatCurrency(fd.principal_amount)}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                        <div>
                          <div style={{ color: '#64748B' }}>Interest Rate</div>
                          <div style={{ fontWeight: '700', color: '#0D9488' }}>{parseFloat(fd.interest_rate).toFixed(2)}% p.a.</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748B' }}>Tenure</div>
                          <div style={{ fontWeight: '600' }}>{fd.tenure_months} Months</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748B' }}>Maturity Date</div>
                          <div style={{ fontWeight: '600' }}>{formatDate(fd.maturity_date)}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748B' }}>Maturity Amount</div>
                          <div style={{ fontWeight: '700', color: '#1E8449' }}>{formatCurrency(fd.maturity_amount)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recurring Deposits Section */}
            <div style={styles.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h2 style={styles.cardTitle}>Recurring Deposits</h2>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Monthly disciplined savings with manual installment payments.</p>
                </div>
                <button
                  style={styles.primaryBtn(false)}
                  onClick={() => setActiveTab('rd')}
                >
                  <span>+ Start Recurring Deposit</span>
                </button>
              </div>

              {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>Loading recurring deposits...</div>
              ) : !data?.recurringDeposits || data.recurringDeposits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>No Recurring Deposits active</div>
                  <div style={{ fontSize: '12px' }}>Start an RD to build long-term savings month by month.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                  {data.recurringDeposits.map((rd) => {
                    const isAllPaid = rd.contributions_completed >= rd.total_contributions_expected;
                    const canContribute = rd.status === 'ACTIVE' && !isAllPaid;

                    return (
                      <div
                        key={rd.id}
                        style={{
                          padding: '22px',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '14px',
                          transition: 'all 0.15s ease',
                        }}
                        className="deposit-card-hover"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0A1628', marginRight: '8px' }}>
                              RD #{rd.id}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                              ({formatCurrency(rd.monthly_amount)}/mo)
                            </span>
                          </div>
                          <span style={styles.statusBadge(rd.status)}>{rd.status}</span>
                        </div>

                        {/* Paid vs Scheduled Progress */}
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '700', color: '#0A1628' }}>
                              {formatCurrency(rd.total_amount_paid)} Paid
                            </span>
                            <span style={{ color: '#64748B' }}>
                              Target: {formatCurrency(rd.monthly_amount * rd.total_contributions_expected)}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${(rd.contributions_completed / rd.total_contributions_expected) * 100}%`,
                                background: 'linear-gradient(90deg, #2563EB 0%, #0D9488 100%)',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                            <span>{rd.contributions_completed} / {rd.total_contributions_expected} Contributions Paid</span>
                            <span>{parseFloat(rd.interest_rate).toFixed(2)}% p.a.</span>
                          </div>
                        </div>

                        {/* Meta Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginBottom: '16px' }}>
                          <div>
                            <div style={{ color: '#64748B' }}>Next Payment Due</div>
                            <div style={{ fontWeight: '700', color: canContribute ? '#2563EB' : '#64748B' }}>
                              {canContribute ? formatDate(rd.next_due_date) : 'Completed'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#64748B' }}>Maturity Date</div>
                            <div style={{ fontWeight: '600' }}>{formatDate(rd.maturity_date)}</div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {canContribute && (
                            <button
                              style={{
                                flex: 1,
                                padding: '9px 14px',
                                background: '#2563EB',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                              onClick={() => setSelectedRdForPayment(rd)}
                            >
                              Make RD Contribution
                            </button>
                          )}
                          <button
                            style={{
                              padding: '9px 14px',
                              background: '#FFFFFF',
                              color: '#334155',
                              border: '1px solid #CBD5E1',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedRdForHistory(rd)}
                          >
                            View Schedule
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: OPEN FIXED DEPOSIT */}
        {activeTab === 'fd' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Open Fixed Deposit</h2>
            <p style={styles.cardDesc}>
              Deposit a lump sum for a fixed period at high compounding interest rates.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }} className="investment-layout-split">
              {/* Form Input Side */}
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Deposit Principal Amount (₹)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="1000"
                    step="1000"
                    placeholder="e.g. 50000"
                    value={fdAmount}
                    onChange={(e) => setFdAmount(e.target.value)}
                  />
                  {isFdBalanceInsufficient && (
                    <div style={{ fontSize: '12px', color: '#BE123C', fontWeight: '600', marginTop: '6px' }}>
                      FD amount cannot exceed your available balance of {formatCurrency(accountBalance)}.
                    </div>
                  )}
                  {principalNum < 1000 && (
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                      Minimum deposit amount is ₹1,000.00
                    </div>
                  )}
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Select Deposit Tenure</label>
                  <div style={styles.tenureGrid}>
                    {rateSheet.map((r) => {
                      const isSelected = fdTenure === r.tenureMonths;
                      return (
                        <div
                          key={r.tenureMonths}
                          style={styles.tenureChip(isSelected)}
                          className="tenure-chip"
                          onClick={() => setFdTenure(r.tenureMonths)}
                        >
                          <div style={{ fontSize: '13px', fontWeight: '700', color: isSelected ? '#1D4ED8' : '#0A1628' }}>
                            {r.tenureLabel}
                          </div>
                          <div style={{ fontSize: '11px', color: '#0D9488', fontWeight: '700', marginTop: '2px' }}>
                            {r.annualRate.toFixed(2)}% p.a.
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  style={styles.primaryBtn(!isFdAmountValid)}
                  disabled={!isFdAmountValid}
                  onClick={() => setFdModalOpen(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Review &amp; Confirm FD</span>
                </button>
              </div>

              {/* Live Preview Summary */}
              <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0A1628', margin: '0 0 14px 0' }}>
                  Deposit Calculation Summary
                </h3>

                <table style={styles.summaryTable}>
                  <tbody>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Principal Amount</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '700', textAlign: 'right' }}>{formatCurrency(principalNum)}</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Tenure</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{fdTenure} Months</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Interest Rate</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '700', color: '#0D9488', textAlign: 'right' }}>{fdRate.toFixed(2)}% p.a.</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Estimated Simple Interest</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '600', color: '#1E8449', textAlign: 'right' }}>+{formatCurrency(fdInterest)}</td>
                    </tr>
                    <tr style={styles.summaryRow(true)}>
                      <td style={{ ...styles.summaryCell, fontWeight: '700', color: '#065F46' }}>Estimated Maturity Amount</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '800', color: '#065F46', fontSize: '16px', textAlign: 'right' }}>{formatCurrency(fdMaturityAmount)}</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Maturity Date</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{getMaturityDatePreview(fdTenure)}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '14px', lineHeight: '1.4' }}>
                  ✓ Principal amount will be deducted from your available balance immediately upon confirmation and returned with interest upon maturity.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: START RECURRING DEPOSIT */}
        {activeTab === 'rd' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Start Recurring Deposit</h2>
            <p style={styles.cardDesc}>
              Build wealth through regular monthly investments.
            </p>

            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '14px 18px', borderRadius: '10px', marginBottom: '24px', color: '#1E40AF', fontSize: '13px' }}>
              <strong>ℹ️ Manual Payment Rule:</strong> No money will be deducted from your account during creation. You will make each monthly installment payment manually via your banking dashboard.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }} className="investment-layout-split">
              {/* Form Input Side */}
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Monthly Contribution Amount (₹)</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="500"
                    step="500"
                    placeholder="e.g. 2000"
                    value={rdMonthly}
                    onChange={(e) => setRdMonthly(e.target.value)}
                  />
                  {rdMonthlyNum < 500 && (
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                      Minimum monthly deposit is ₹500.00
                    </div>
                  )}
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Select RD Tenure</label>
                  <div style={styles.tenureGrid}>
                    {rateSheet.map((r) => {
                      const isSelected = rdTenure === r.tenureMonths;
                      return (
                        <div
                          key={r.tenureMonths}
                          style={styles.tenureChip(isSelected)}
                          className="tenure-chip"
                          onClick={() => setRdTenure(r.tenureMonths)}
                        >
                          <div style={{ fontSize: '13px', fontWeight: '700', color: isSelected ? '#1D4ED8' : '#0A1628' }}>
                            {r.tenureLabel}
                          </div>
                          <div style={{ fontSize: '11px', color: '#0D9488', fontWeight: '700', marginTop: '2px' }}>
                            {r.annualRate.toFixed(2)}% p.a.
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  style={styles.primaryBtn(!isRdAmountValid)}
                  disabled={!isRdAmountValid}
                  onClick={() => setRdModalOpen(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                  <span>Review &amp; Start RD Schedule</span>
                </button>
              </div>

              {/* Live Preview Summary */}
              <div style={{ background: '#F8FAFC', padding: '24px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0A1628', margin: '0 0 14px 0' }}>
                  RD Schedule Estimation
                </h3>

                <table style={styles.summaryTable}>
                  <tbody>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Monthly Deposit</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '700', textAlign: 'right' }}>{formatCurrency(rdMonthlyNum)}</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Tenure</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{rdTenure} Months</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Interest Rate</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '700', color: '#0D9488', textAlign: 'right' }}>{rdRate.toFixed(2)}% p.a.</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Total Scheduled Deposit</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{formatCurrency(rdTotalScheduled)}</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Estimated Simple Interest</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '600', color: '#1E8449', textAlign: 'right' }}>+{formatCurrency(rdEstimatedInterest)}</td>
                    </tr>
                    <tr style={styles.summaryRow(true)}>
                      <td style={{ ...styles.summaryCell, fontWeight: '700', color: '#065F46' }}>Estimated Maturity Amount</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '800', color: '#065F46', fontSize: '16px', textAlign: 'right' }}>{formatCurrency(rdEstimatedMaturity)}</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>First Installment Due</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{getMaturityDatePreview(1)}</td>
                    </tr>
                    <tr style={styles.summaryRow(false)}>
                      <td style={styles.summaryCell}>Maturity Date</td>
                      <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{getMaturityDatePreview(rdTenure)}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '14px' }}>
                  ✓ Actual maturity payout is computed strictly from verified manual installment payments.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Academic Disclaimer Banner */}
        <div style={styles.disclaimerBanner}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Financial Disclosure:</strong> Investment values, interest rates and returns shown in this application are simulated for demonstration purposes and do not represent guaranteed real-world returns or financial advice.
          </div>
        </div>
      </div>

      {/* MODAL 1: FD CONFIRMATION SCREEN */}
      {fdModalOpen && (
        <div style={styles.modalOverlay} onClick={() => !fdSubmitting && setFdModalOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0A1628', margin: '0 0 6px 0' }}>
              Confirm Fixed Deposit
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px 0' }}>
              Please review your Fixed Deposit parameters before confirming.
            </p>

            <table style={styles.summaryTable}>
              <tbody>
                <tr style={styles.summaryRow(false)}>
                  <td style={styles.summaryCell}>Deposit Amount</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '800', fontSize: '16px', textAlign: 'right', color: '#0A1628' }}>
                    {formatCurrency(principalNum)}
                  </td>
                </tr>
                <tr style={styles.summaryRow(false)}>
                  <td style={styles.summaryCell}>Tenure</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{fdTenure} Months</td>
                </tr>
                <tr style={styles.summaryRow(false)}>
                  <td style={styles.summaryCell}>Interest Rate</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '700', color: '#0D9488', textAlign: 'right' }}>{fdRate.toFixed(2)}% p.a.</td>
                </tr>
                <tr style={styles.summaryRow(false)}>
                  <td style={styles.summaryCell}>Estimated Interest</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '600', color: '#1E8449', textAlign: 'right' }}>+{formatCurrency(fdInterest)}</td>
                </tr>
                <tr style={styles.summaryRow(true)}>
                  <td style={{ ...styles.summaryCell, fontWeight: '700', color: '#065F46' }}>Maturity Amount</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '800', color: '#065F46', fontSize: '18px', textAlign: 'right' }}>
                    {formatCurrency(fdMaturityAmount)}
                  </td>
                </tr>
                <tr style={styles.summaryRow(false)}>
                  <td style={styles.summaryCell}>Maturity Date</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{getMaturityDatePreview(fdTenure)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ background: '#EFF6FF', padding: '12px 14px', borderRadius: '8px', fontSize: '12px', color: '#1E40AF', margin: '18px 0' }}>
              <strong>⚠️ Balance Notice:</strong> {formatCurrency(principalNum)} will be deducted from your available account balance.
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                style={{ padding: '10px 18px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                onClick={() => setFdModalOpen(false)}
                disabled={fdSubmitting}
              >
                Cancel
              </button>
              <button
                style={styles.primaryBtn(fdSubmitting)}
                onClick={handleCreateFd}
                disabled={fdSubmitting}
              >
                {fdSubmitting ? 'Creating FD...' : 'Confirm Fixed Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RD CONFIRMATION SCREEN */}
      {rdModalOpen && (
        <div style={styles.modalOverlay} onClick={() => !rdSubmitting && setRdModalOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0A1628', margin: '0 0 6px 0' }}>
              Confirm Recurring Deposit Schedule
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px 0' }}>
              Verify your Recurring Deposit schedule details.
            </p>

            <table style={styles.summaryTable}>
              <tbody>
                <tr style={styles.summaryRow(false)}>
                  <td style={styles.summaryCell}>Monthly Installment</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '800', textAlign: 'right', color: '#0A1628' }}>
                    {formatCurrency(rdMonthlyNum)} / month
                  </td>
                </tr>
                <tr style={styles.summaryRow(false)}>
                  <td style={styles.summaryCell}>Tenure</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{rdTenure} Months</td>
                </tr>
                <tr style={styles.summaryRow(false)}>
                  <td style={styles.summaryCell}>Interest Rate</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '700', color: '#0D9488', textAlign: 'right' }}>{rdRate.toFixed(2)}% p.a.</td>
                </tr>
                <tr style={styles.summaryRow(false)}>
                  <td style={styles.summaryCell}>Total Scheduled Deposit</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '600', textAlign: 'right' }}>{formatCurrency(rdTotalScheduled)}</td>
                </tr>
                <tr style={styles.summaryRow(true)}>
                  <td style={{ ...styles.summaryCell, fontWeight: '700', color: '#065F46' }}>Estimated Maturity Value</td>
                  <td style={{ ...styles.summaryCell, fontWeight: '800', color: '#065F46', fontSize: '18px', textAlign: 'right' }}>
                    {formatCurrency(rdEstimatedMaturity)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ background: '#ECFDF5', padding: '12px 14px', borderRadius: '8px', fontSize: '12px', color: '#065F46', margin: '18px 0' }}>
              ✓ <strong>Zero Initial Debit:</strong> No money is deducted right now. Your first contribution of {formatCurrency(rdMonthlyNum)} will be paid manually.
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                style={{ padding: '10px 18px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                onClick={() => setRdModalOpen(false)}
                disabled={rdSubmitting}
              >
                Cancel
              </button>
              <button
                style={styles.primaryBtn(rdSubmitting)}
                onClick={handleCreateRd}
                disabled={rdSubmitting}
              >
                {rdSubmitting ? 'Starting Schedule...' : 'Start RD Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUAL RD CONTRIBUTION PAYMENT MODAL */}
      {selectedRdForPayment && (
        <div style={styles.modalOverlay} onClick={() => !payingRd && setSelectedRdForPayment(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0A1628', margin: '0 0 6px 0' }}>
              Make RD Contribution (RD #{selectedRdForPayment.id})
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px 0' }}>
              Pay monthly installment #{selectedRdForPayment.contributions_completed + 1} of {selectedRdForPayment.total_contributions_expected}.
            </p>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#64748B' }}>Contribution Amount</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#0A1628' }}>
                  {formatCurrency(selectedRdForPayment.monthly_amount)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#64748B' }}>Available Balance</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: accountBalance < parseFloat(selectedRdForPayment.monthly_amount) ? '#BE123C' : '#047857' }}>
                  {formatCurrency(accountBalance)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#64748B' }}>Installment Progress</span>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>
                  {selectedRdForPayment.contributions_completed + 1} / {selectedRdForPayment.total_contributions_expected}
                </span>
              </div>
            </div>

            {accountBalance < parseFloat(selectedRdForPayment.monthly_amount) && (
              <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', padding: '12px 14px', borderRadius: '8px', fontSize: '12px', color: '#BE123C', marginBottom: '18px' }}>
                ❌ <strong>Insufficient Balance:</strong> You need {formatCurrency(selectedRdForPayment.monthly_amount)} to make this contribution, but your available balance is {formatCurrency(accountBalance)}.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                style={{ padding: '10px 18px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                onClick={() => setSelectedRdForPayment(null)}
                disabled={payingRd}
              >
                Cancel
              </button>
              <button
                style={styles.primaryBtn(payingRd || accountBalance < parseFloat(selectedRdForPayment.monthly_amount))}
                onClick={handlePayRdContribution}
                disabled={payingRd || accountBalance < parseFloat(selectedRdForPayment.monthly_amount)}
              >
                {payingRd ? 'Processing Payment...' : 'Confirm Contribution Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RD CONTRIBUTION HISTORY SCHEDULE DRAWER */}
      {selectedRdForHistory && (
        <div style={styles.modalOverlay} onClick={() => setSelectedRdForHistory(null)}>
          <div style={{ ...styles.modalCard, maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0A1628', margin: '0 0 4px 0' }}>
                  RD #{selectedRdForHistory.id} Contribution Roadmap
                </h2>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                  {formatCurrency(selectedRdForHistory.monthly_amount)}/month • {selectedRdForHistory.tenure_months} Months • {parseFloat(selectedRdForHistory.interest_rate).toFixed(2)}% p.a.
                </p>
              </div>
              <button
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}
                onClick={() => setSelectedRdForHistory(null)}
              >
                ✕
              </button>
            </div>

            {/* Scrollable list */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '10px 14px' }}>Month</th>
                    <th style={{ padding: '10px 14px' }}>Amount</th>
                    <th style={{ padding: '10px 14px' }}>Due Date</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRdForHistory.contributions?.map((c) => (
                    <tr key={c.monthNumber} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '600' }}>Month {c.monthNumber}</td>
                      <td style={{ padding: '10px 14px' }}>{formatCurrency(c.amount)}</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>{formatDate(c.dueDate)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={styles.statusBadge(c.status)}>{c.status}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: c.paidAt ? '#047857' : '#94A3B8' }}>
                        {c.paidAt ? formatDate(c.paidAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actual Maturity Payout Preview Footer */}
            {selectedRdForHistory.actualCalculation && (
              <div style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0', padding: '14px', marginTop: '14px', borderRadius: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Total Actual Paid: <strong>{formatCurrency(selectedRdForHistory.actualCalculation.totalAmountPaid)}</strong></span>
                  <span>Interest Accrued: <strong>+{formatCurrency(selectedRdForHistory.actualCalculation.actualInterestEarned)}</strong></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: '700' }}>
                  <span>Actual Maturity Payout on Settle Date:</span>
                  <span>{formatCurrency(selectedRdForHistory.actualCalculation.actualMaturityAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Investments;
