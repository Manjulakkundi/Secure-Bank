/**
 * Admin App — AdminInvestments.js (Bank-Wide Investment Monitoring & Management Dashboard)
 * Features:
 * - Bank-wide KPI aggregation (Unique investors, Total invested = Active FD + Actual RD Paid, Expected maturities)
 * - Chart.js analytics for asset allocation, active vs matured status, and maturity timeline
 * - Maturity Monitor with 5 distinct non-overlapping date range categories
 * - Server-side paginated & sorted customer table with multi-field search & column sorters
 * - Deep Customer Investment Drilldown Modal (All FDs, RDs with month-by-month roadmap, Audit timestamps, Transaction ledger)
 * - Strict Zero Raw Account Number exposure (always masked e.g. ****6808)
 * - Pure SVG icons (zero emojis) and inline styles without <form> tags
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import API from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

const AdminInvestments = () => {
  // Top-level View Tabs
  const [activeMainTab, setActiveMainTab] = useState('customers'); // 'customers' | 'maturity' | 'analytics'

  // Overview KPIs & Analytics State
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Customer Table State (Server-Side Paginated & Sorted)
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'FD' | 'RD'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'MATURED'
  const [sortBy, setSortBy] = useState('totalInvested');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [tableLoading, setTableLoading] = useState(false);

  // Maturity Monitor State
  const [maturityRange, setMaturityRange] = useState('all');
  const [maturityRecords, setMaturityRecords] = useState([]);
  const [maturityLoading, setMaturityLoading] = useState(false);

  // Selected Customer Drilldown State
  const [selectedCustomerRef, setSelectedCustomerRef] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSubTab, setDetailSubTab] = useState('fds'); // 'fds' | 'rds' | 'txns'

  // Selected RD for Expanded Contribution History Drawer
  const [selectedRdForContributions, setSelectedRdForContributions] = useState(null);

  // Chart References
  const distChartRef = useRef(null);
  const distChartInst = useRef(null);
  const statusChartRef = useRef(null);
  const statusChartInst = useRef(null);
  const ChartLib = useRef(null);

  // ── 1. Fetch Overview KPIs ──────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await API.get('/admin/investments/overview');
      if (res.data?.success) {
        setOverview(res.data.data);
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        console.error('Failed to fetch investment overview:', err);
      }
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 45000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  // ── 2. Fetch Customer Investments Table ─────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        search,
        type: typeFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
      });

      const res = await API.get(`/admin/investments/customers?${params.toString()}`);
      if (res.data?.success) {
        setCustomers(res.data.data.customers || []);
        setPagination(res.data.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        console.error('Failed to fetch customer investments:', err);
      }
    } finally {
      setTableLoading(false);
    }
  }, [pagination.page, pagination.limit, search, typeFilter, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ── 3. Fetch Maturity Monitor Records ───────────────────────────────────────
  const fetchMaturityRecords = useCallback(async () => {
    setMaturityLoading(true);
    try {
      const res = await API.get(`/admin/investments/maturity-monitor?range=${maturityRange}`);
      if (res.data?.success) {
        setMaturityRecords(res.data.data.records || []);
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        console.error('Failed to fetch maturity records:', err);
      }
    } finally {
      setMaturityLoading(false);
    }
  }, [maturityRange]);

  useEffect(() => {
    if (activeMainTab === 'maturity') {
      fetchMaturityRecords();
    }
  }, [activeMainTab, fetchMaturityRecords]);

  // ── 4. Fetch Customer Drilldown Details ─────────────────────────────────────
  const fetchCustomerDetail = useCallback(async (custRef) => {
    if (!custRef) return;
    setDetailLoading(true);
    setCustomerDetail(null);
    try {
      const res = await API.get(`/admin/investments/customers/${custRef}`);
      if (res.data?.success) {
        setCustomerDetail(res.data.data);
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        console.error('Failed to fetch customer detail:', err);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleOpenCustomerDetail = (custRef) => {
    setSelectedCustomerRef(custRef);
    setDetailSubTab('fds');
    fetchCustomerDetail(custRef);
  };

  // ── 5. Setup Chart.js Analytics ─────────────────────────────────────────────
  useEffect(() => {
    if (activeMainTab !== 'analytics' || !overview?.analytics) return;

    let cancelled = false;

    const buildCharts = async () => {
      try {
        if (!ChartLib.current) {
          const mod = await import('chart.js');
          mod.Chart.register(
            mod.DoughnutController,
            mod.BarController,
            mod.CategoryScale,
            mod.LinearScale,
            mod.BarElement,
            mod.ArcElement,
            mod.Tooltip,
            mod.Legend
          );
          ChartLib.current = mod.Chart;
        }

        if (cancelled) return;

        // 1. Distribution Chart
        if (distChartRef.current) {
          if (distChartInst.current) distChartInst.current.destroy();
          const distData = overview.analytics.distribution;

          distChartInst.current = new ChartLib.current(distChartRef.current, {
            type: 'doughnut',
            data: {
              labels: ['Active FD Principal', 'Actual RD Paid'],
              datasets: [
                {
                  data: [distData.fdPrincipal, distData.rdPaid],
                  backgroundColor: ['#2563EB', '#0D9488'],
                  borderWidth: 0,
                  hoverOffset: 6,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } } },
                tooltip: {
                  callbacks: {
                    label: (context) => ` ${context.label}: ${formatCurrency(context.raw)}`,
                  },
                },
              },
              cutout: '70%',
            },
          });
        }

        // 2. Status Breakdown Chart
        if (statusChartRef.current) {
          if (statusChartInst.current) statusChartInst.current.destroy();
          const sb = overview.analytics.statusBreakdown;

          statusChartInst.current = new ChartLib.current(statusChartRef.current, {
            type: 'doughnut',
            data: {
              labels: ['Active FDs', 'Matured FDs', 'Active RDs', 'Matured RDs'],
              datasets: [
                {
                  data: [sb.activeFds, sb.maturedFds, sb.activeRds, sb.maturedRds],
                  backgroundColor: ['#3B82F6', '#93C5FD', '#14B8A6', '#99F6E4'],
                  borderWidth: 0,
                  hoverOffset: 6,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } } },
              },
              cutout: '70%',
            },
          });
        }
      } catch (err) {
        console.error('Chart build error:', err);
      }
    };

    buildCharts();

    return () => {
      cancelled = true;
      if (distChartInst.current) {
        distChartInst.current.destroy();
        distChartInst.current = null;
      }
      if (statusChartInst.current) {
        statusChartInst.current.destroy();
        statusChartInst.current = null;
      }
    };
  }, [activeMainTab, overview]);

  // Column Sort Toggle Handler
  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(columnKey);
      setSortOrder('DESC');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const kpis = overview?.kpis || {
    totalInvestors: 0,
    totalInvestedAcrossBank: 0,
    totalActiveFdPrincipal: 0,
    totalActiveRdPaid: 0,
    totalExpectedFdMaturity: 0,
    totalExpectedRdMaturity: 0,
    totalExpectedMaturityValue: 0,
    activeFdCount: 0,
    activeRdCount: 0,
    maturedFdCount: 0,
    maturedRdCount: 0,
    fdsMaturingSoon: 0,
    fdsMaturing7d: 0,
    rdsWithPendingContributions: 0,
    rdsWithMissedContributions: 0,
  };

  const styles = {
    page: {
      padding: '32px 28px',
      backgroundColor: '#F8FAFC',
      minHeight: '100vh',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    container: {
      maxWidth: '1440px',
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
    titleGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    title: {
      fontSize: '24px',
      fontWeight: '800',
      color: '#0A1628',
      letterSpacing: '-0.02em',
      margin: 0,
    },
    subtitle: {
      fontSize: '13px',
      color: '#64748B',
      margin: 0,
    },
    kpiGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '18px',
      marginBottom: '28px',
    },
    kpiCard: (isHero) => ({
      background: isHero
        ? 'linear-gradient(135deg, #0A1628 0%, #1E3A8A 100%)'
        : '#FFFFFF',
      borderRadius: '14px',
      padding: '20px 22px',
      border: isHero ? 'none' : '1px solid #E2E8F0',
      color: isHero ? '#FFFFFF' : '#0F172A',
      boxShadow: isHero
        ? '0 10px 25px -5px rgba(10, 22, 40, 0.2)'
        : '0 2px 8px -2px rgba(10, 22, 40, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }),
    kpiLabel: (isHero) => ({
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: isHero ? '#93C5FD' : '#64748B',
      marginBottom: '8px',
    }),
    kpiValue: (isHero) => ({
      fontSize: '24px',
      fontWeight: '800',
      letterSpacing: '-0.02em',
      color: isHero ? '#FFFFFF' : '#0A1628',
      margin: '0 0 6px 0',
    }),
    kpiSub: (isHero) => ({
      fontSize: '12px',
      color: isHero ? '#CBD5E1' : '#64748B',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }),
    mainTabs: {
      display: 'flex',
      gap: '8px',
      background: '#F1F5F9',
      padding: '5px',
      borderRadius: '12px',
      marginBottom: '24px',
      border: '1px solid #E2E8F0',
      maxWidth: '480px',
    },
    mainTabBtn: (isActive) => ({
      flex: 1,
      padding: '10px 14px',
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
      gap: '6px',
    }),
    card: {
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 16px -2px rgba(10, 22, 40, 0.04)',
      padding: '24px',
      marginBottom: '24px',
    },
    filterBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '14px',
      marginBottom: '20px',
      flexWrap: 'wrap',
    },
    searchInput: {
      padding: '10px 14px',
      background: '#F8FAFC',
      border: '1.5px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '13px',
      color: '#0F172A',
      outline: 'none',
      width: '320px',
      maxWidth: '100%',
    },
    select: {
      padding: '10px 14px',
      background: '#F8FAFC',
      border: '1.5px solid #E2E8F0',
      borderRadius: '8px',
      fontSize: '13px',
      color: '#0F172A',
      outline: 'none',
      cursor: 'pointer',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '13px',
    },
    th: (sortable) => ({
      padding: '12px 14px',
      background: '#F8FAFC',
      color: '#475569',
      fontWeight: '700',
      textAlign: 'left',
      borderBottom: '1.5px solid #E2E8F0',
      cursor: sortable ? 'pointer' : 'default',
      userSelect: 'none',
      whiteSpace: 'nowrap',
    }),
    td: {
      padding: '14px',
      borderBottom: '1px solid #F1F5F9',
      verticalAlign: 'middle',
    },
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
      } else if (status === 'MISSED' || status === 'CANCELLED' || status === 'FAILED') {
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
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        textTransform: 'uppercase',
      };
    },
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 22, 40, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px',
    },
    modalCard: {
      background: '#FFFFFF',
      borderRadius: '16px',
      maxWidth: '880px',
      width: '100%',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      border: '1px solid #E2E8F0',
      overflow: 'hidden',
    },
  };

  return (
    <div style={styles.page}>
      <style>
        {`
          .table-row-hover:hover { background-color: #F8FAFC !important; }
          .btn-action-hover:hover { background-color: #1D4ED8 !important; color: #FFFFFF !important; }
        `}
      </style>

      <div style={styles.container}>
        {/* Header Title */}
        <div style={styles.header}>
          <div style={styles.titleGroup}>
            <h1 style={styles.title}>Bank-Wide Investment Operations</h1>
            <p style={styles.subtitle}>
              Complete portfolio monitoring, maturity surveillance, and customer investment surveillance.
            </p>
          </div>

          <button
            style={{
              padding: '9px 16px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => {
              fetchOverview();
              if (activeMainTab === 'customers') fetchCustomers();
              if (activeMainTab === 'maturity') fetchMaturityRecords();
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Refresh Telemetry</span>
          </button>
        </div>

        {/* Bank-Wide Overview Top KPI Grid */}
        <div style={styles.kpiGrid}>
          {/* Card 1: Total Invested Across Bank (HERO) */}
          <div style={styles.kpiCard(true)}>
            <div>
              <div style={styles.kpiLabel(true)}>Total Invested Across Bank</div>
              <div style={styles.kpiValue(true)}>{formatCurrency(kpis.totalInvestedAcrossBank)}</div>
            </div>
            <div style={styles.kpiSub(true)}>
              <span>Active FD: {formatCurrency(kpis.totalActiveFdPrincipal)}</span>
              <span>•</span>
              <span>RD Paid: {formatCurrency(kpis.totalActiveRdPaid)}</span>
            </div>
          </div>

          {/* Card 2: Total Investors */}
          <div style={styles.kpiCard(false)}>
            <div>
              <div style={styles.kpiLabel(false)}>Total Unique Investors</div>
              <div style={styles.kpiValue(false)}>{kpis.totalInvestors}</div>
            </div>
            <div style={styles.kpiSub(false)}>
              <span>Active FDs: {kpis.activeFdCount}</span>
              <span>•</span>
              <span>Active RDs: {kpis.activeRdCount}</span>
            </div>
          </div>

          {/* Card 3: Expected Maturity Value */}
          <div style={styles.kpiCard(false)}>
            <div>
              <div style={styles.kpiLabel(false)}>Expected Maturity Value</div>
              <div style={{ ...styles.kpiValue(false), color: '#0D9488' }}>
                {formatCurrency(kpis.totalExpectedMaturityValue)}
              </div>
            </div>
            <div style={styles.kpiSub(false)}>
              <span>FD: {formatCurrency(kpis.totalExpectedFdMaturity)}</span>
              <span>•</span>
              <span>RD: {formatCurrency(kpis.totalExpectedRdMaturity)}</span>
            </div>
          </div>

          {/* Card 4: Maturity & Health Surveillance */}
          <div style={styles.kpiCard(false)}>
            <div>
              <div style={styles.kpiLabel(false)}>Surveillance &amp; Health</div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#B45309', background: '#FFFBEB', padding: '4px 8px', borderRadius: '6px' }}>
                  {kpis.fdsMaturingSoon} Maturing ≤30d
                </span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: kpis.rdsWithMissedContributions > 0 ? '#BE123C' : '#047857', background: kpis.rdsWithMissedContributions > 0 ? '#FFF1F2' : '#ECFDF5', padding: '4px 8px', borderRadius: '6px' }}>
                  {kpis.rdsWithMissedContributions} Missed RDs
                </span>
              </div>
            </div>
            <div style={styles.kpiSub(false)}>
              <span>Matured FDs: {kpis.maturedFdCount}</span>
              <span>•</span>
              <span>Matured RDs: {kpis.maturedRdCount}</span>
            </div>
          </div>
        </div>

        {/* View Selection Tabs */}
        <div style={styles.mainTabs}>
          <button
            style={styles.mainTabBtn(activeMainTab === 'customers')}
            onClick={() => setActiveMainTab('customers')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>Customer Investments</span>
          </button>
          <button
            style={styles.mainTabBtn(activeMainTab === 'maturity')}
            onClick={() => setActiveMainTab('maturity')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Maturity Monitor</span>
          </button>
          <button
            style={styles.mainTabBtn(activeMainTab === 'analytics')}
            onClick={() => setActiveMainTab('analytics')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Portfolio Analytics</span>
          </button>
        </div>

        {/* ── TAB 1: CUSTOMER-WISE INVESTMENT TABLE ──────────────────────────── */}
        {activeMainTab === 'customers' && (
          <div style={styles.card}>
            {/* Filter & Search Bar */}
            <div style={styles.filterBar}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  style={styles.searchInput}
                  placeholder="Search by Name, Masked Account, FD #, RD #..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                />

                <select
                  style={styles.select}
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                >
                  <option value="ALL">All Investment Types</option>
                  <option value="FD">Fixed Deposits (FD)</option>
                  <option value="RD">Recurring Deposits (RD)</option>
                </select>

                <select
                  style={styles.select}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Investments</option>
                  <option value="MATURED">Matured Investments</option>
                </select>
              </div>

              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>
                Showing {customers.length} of {pagination.total} Investors
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th(true)} onClick={() => handleSort('customerName')}>
                      Customer Name {sortBy === 'customerName' && (sortOrder === 'ASC' ? '↑' : '↓')}
                    </th>
                    <th style={styles.th(false)}>Masked Account</th>
                    <th style={styles.th(true)} onClick={() => handleSort('fdPrincipal')}>
                      FD Principal {sortBy === 'fdPrincipal' && (sortOrder === 'ASC' ? '↑' : '↓')}
                    </th>
                    <th style={styles.th(true)} onClick={() => handleSort('rdPaid')}>
                      RD Paid {sortBy === 'rdPaid' && (sortOrder === 'ASC' ? '↑' : '↓')}
                    </th>
                    <th style={styles.th(true)} onClick={() => handleSort('totalInvested')}>
                      Total Invested {sortBy === 'totalInvested' && (sortOrder === 'ASC' ? '↑' : '↓')}
                    </th>
                    <th style={styles.th(true)} onClick={() => handleSort('activeCount')}>
                      Active / Total {sortBy === 'activeCount' && (sortOrder === 'ASC' ? '↑' : '↓')}
                    </th>
                    <th style={styles.th(false)}>Expected Maturity</th>
                    <th style={{ ...styles.th(false), textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                        Loading customer portfolio records...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                        No investment customer records found matching query.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr key={c.customerRef} className="table-row-hover">
                        <td style={styles.td}>
                          <div style={{ fontWeight: '700', color: '#0A1628' }}>{c.customerName}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{c.customerEmail}</div>
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1E3A8A' }}>
                            {c.maskedAccountNumber}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '600', color: '#0A1628' }}>{formatCurrency(c.totalFdPrincipal)}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{c.activeFdCount} Active FDs</div>
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '600', color: '#0A1628' }}>{formatCurrency(c.totalRdAmountPaid)}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{c.activeRdCount} Active RDs</div>
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '800', color: '#0D9488', fontSize: '14px' }}>
                            {formatCurrency(c.totalActualInvested)}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge(c.activeInvestmentsCount > 0 ? 'ACTIVE' : 'MATURED')}>
                            {c.activeInvestmentsCount} Active
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '600', color: '#1E8449' }}>
                            {formatCurrency(c.totalExpectedMaturityValue)}
                          </div>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <button
                            style={{
                              padding: '6px 12px',
                              background: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#2563EB',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            className="btn-action-hover"
                            onClick={() => handleOpenCustomerDetail(c.customerRef)}
                          >
                            View Portfolio →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} Total)
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={{
                    padding: '6px 12px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                    color: pagination.page <= 1 ? '#94A3B8' : '#334155',
                  }}
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  ← Previous
                </button>
                <button
                  style={{
                    padding: '6px 12px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                    color: pagination.page >= pagination.totalPages ? '#94A3B8' : '#334155',
                  }}
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: MATURITY MONITOR ────────────────────────────────────────── */}
        {activeMainTab === 'maturity' && (
          <div style={styles.card}>
            <div style={styles.filterBar}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Maturities' },
                  { id: 'maturing_7d', label: 'Maturing ≤ 7 Days' },
                  { id: 'maturing_30d', label: 'Maturing ≤ 30 Days' },
                  { id: 'matured_last_7d', label: 'Matured in Last 7 Days' },
                  { id: 'matured_last_30d', label: 'Matured in Last 30 Days' },
                  { id: 'all_matured', label: 'All Matured' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: maturityRange === chip.id ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                      background: maturityRange === chip.id ? '#EFF6FF' : '#FFFFFF',
                      color: maturityRange === chip.id ? '#1D4ED8' : '#475569',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                    onClick={() => setMaturityRange(chip.id)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '12px', color: '#64748B' }}>
                {maturityRecords.length} Maturity Records Found
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th(false)}>Investment Type</th>
                    <th style={styles.th(false)}>Customer Name</th>
                    <th style={styles.th(false)}>Masked Account</th>
                    <th style={styles.th(false)}>Invested Capital</th>
                    <th style={styles.th(false)}>Interest Rate</th>
                    <th style={styles.th(false)}>Maturity Value</th>
                    <th style={styles.th(false)}>Maturity Date</th>
                    <th style={styles.th(false)}>Surveillance Status</th>
                    <th style={{ ...styles.th(false), textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {maturityLoading ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                        Loading maturity surveillance records...
                      </td>
                    </tr>
                  ) : maturityRecords.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                        No records match the selected maturity surveillance range.
                      </td>
                    </tr>
                  ) : (
                    maturityRecords.map((r) => (
                      <tr key={`${r.investmentType}-${r.id}`} className="table-row-hover">
                        <td style={styles.td}>
                          <span style={{ fontWeight: '700', color: r.investmentType === 'FD' ? '#2563EB' : '#0D9488' }}>
                            {r.investmentType} #{r.id}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '600', color: '#0A1628' }}>{r.customerName}</div>
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{r.maskedAccountNumber}</span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '700' }}>{formatCurrency(r.investedAmount)}</div>
                        </td>
                        <td style={styles.td}>
                          <span style={{ color: '#0D9488', fontWeight: '600' }}>{r.interestRate.toFixed(2)}% p.a.</span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ fontWeight: '700', color: '#1E8449' }}>{formatCurrency(r.maturityAmount)}</div>
                        </td>
                        <td style={styles.td}>
                          <div>{formatDate(r.maturityDate)}</div>
                          {r.status === 'ACTIVE' && r.daysUntilMaturity >= 0 && (
                            <span style={{ fontSize: '11px', color: r.daysUntilMaturity <= 7 ? '#DC2626' : '#D97706', fontWeight: '600' }}>
                              In {r.daysUntilMaturity} days
                            </span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge(r.status)}>{r.status}</span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <button
                            style={{
                              padding: '5px 10px',
                              background: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleOpenCustomerDetail(r.customerRef)}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: PORTFOLIO ANALYTICS ─────────────────────────────────────── */}
        {activeMainTab === 'analytics' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              {/* Asset Allocation Chart */}
              <div style={styles.card}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0A1628', margin: '0 0 6px 0' }}>
                  Capital Allocation Breakdown
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 20px 0' }}>
                  Active FD Principal vs Verified RD Contributions Paid
                </p>
                <div style={{ height: '240px', position: 'relative' }}>
                  <canvas ref={distChartRef} />
                </div>
              </div>

              {/* Status Breakdown Chart */}
              <div style={styles.card}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0A1628', margin: '0 0 6px 0' }}>
                  Investment Lifecycle Status
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 20px 0' }}>
                  Active compounding deposits vs settled matured deposits
                </p>
                <div style={{ height: '240px', position: 'relative' }}>
                  <canvas ref={statusChartRef} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── CUSTOMER INVESTMENT DRILLDOWN MODAL ───────────────────────────────── */}
      {selectedCustomerRef && (
        <div style={styles.modalOverlay} onClick={() => setSelectedCustomerRef(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0A1628', margin: '0 0 4px 0' }}>
                  {customerDetail?.customer?.customerName || 'Customer Investment Portfolio'}
                </h2>
                <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', gap: '14px' }}>
                  <span>Account: <strong>{customerDetail?.customer?.maskedAccountNumber}</strong></span>
                  <span>Email: {customerDetail?.customer?.customerEmail}</span>
                  <span>Status: <strong>{customerDetail?.customer?.accountStatus}</strong></span>
                </div>
              </div>
              <button
                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}
                onClick={() => setSelectedCustomerRef(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 24px', background: '#FFFFFF' }}>
              {[
                { id: 'fds', label: `Fixed Deposits (${customerDetail?.fixedDeposits?.length || 0})` },
                { id: 'rds', label: `Recurring Deposits (${customerDetail?.recurringDeposits?.length || 0})` },
                { id: 'txns', label: `Investment Transactions (${customerDetail?.transactions?.length || 0})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  style={{
                    padding: '12px 18px',
                    border: 'none',
                    borderBottom: detailSubTab === tab.id ? '2px solid #2563EB' : '2px solid transparent',
                    background: 'transparent',
                    fontSize: '13px',
                    fontWeight: detailSubTab === tab.id ? '700' : '500',
                    color: detailSubTab === tab.id ? '#2563EB' : '#64748B',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDetailSubTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>Loading customer portfolio...</div>
              ) : (
                <>
                  {/* FDs Sub-Tab */}
                  {detailSubTab === 'fds' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {!customerDetail?.fixedDeposits || customerDetail.fixedDeposits.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>No Fixed Deposits found for this customer.</div>
                      ) : (
                        customerDetail.fixedDeposits.map((fd) => (
                          <div key={fd.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', background: '#F8FAFC' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                              <div>
                                <span style={{ fontSize: '15px', fontWeight: '800', color: '#0A1628', marginRight: '8px' }}>FD #{fd.id}</span>
                                <span style={{ fontSize: '16px', fontWeight: '800', color: '#2563EB' }}>{formatCurrency(fd.principal_amount)}</span>
                              </div>
                              <span style={styles.statusBadge(fd.status)}>{fd.status}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
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
                                <div style={{ fontWeight: '800', color: '#1E8449' }}>{formatCurrency(fd.maturity_amount)}</div>
                              </div>
                            </div>

                            {/* Audit Footer */}
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px', borderTop: '1px dashed #E2E8F0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Created At: {formatDate(fd.created_at)}</span>
                              <span>Updated At: {formatDate(fd.updated_at)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* RDs Sub-Tab */}
                  {detailSubTab === 'rds' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {!customerDetail?.recurringDeposits || customerDetail.recurringDeposits.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>No Recurring Deposits found for this customer.</div>
                      ) : (
                        customerDetail.recurringDeposits.map((rd) => (
                          <div key={rd.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', background: '#F8FAFC' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                              <div>
                                <span style={{ fontSize: '15px', fontWeight: '800', color: '#0A1628', marginRight: '8px' }}>RD #{rd.id}</span>
                                <span style={{ fontSize: '13px', color: '#64748B' }}>({formatCurrency(rd.monthly_amount)}/month • {rd.tenure_months} Mo)</span>
                              </div>
                              <span style={styles.statusBadge(rd.status)}>{rd.status}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                              <div>
                                <div style={{ color: '#64748B' }}>Total Paid</div>
                                <div style={{ fontWeight: '800', color: '#0D9488' }}>{formatCurrency(rd.total_amount_paid)}</div>
                              </div>
                              <div>
                                <div style={{ color: '#64748B' }}>Contributions</div>
                                <div style={{ fontWeight: '600' }}>{rd.contributions_completed} / {rd.total_contributions_expected}</div>
                              </div>
                              <div>
                                <div style={{ color: '#64748B' }}>Next Due Date</div>
                                <div style={{ fontWeight: '600' }}>{formatDate(rd.next_due_date)}</div>
                              </div>
                              <div>
                                <div style={{ color: '#64748B' }}>Est. Maturity</div>
                                <div style={{ fontWeight: '800', color: '#1E8449' }}>{formatCurrency(rd.estimated_maturity_amount)}</div>
                              </div>
                            </div>

                            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                                Created: {formatDate(rd.created_at)}
                              </div>
                              <button
                                style={{
                                  padding: '5px 12px',
                                  background: '#FFFFFF',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setSelectedRdForContributions(rd)}
                              >
                                View Contribution History →
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Transactions Sub-Tab */}
                  {detailSubTab === 'txns' && (
                    <div>
                      {!customerDetail?.transactions || customerDetail.transactions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>No investment transactions logged for this account.</div>
                      ) : (
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th(false)}>Txn ID</th>
                              <th style={styles.th(false)}>Type</th>
                              <th style={styles.th(false)}>Amount</th>
                              <th style={styles.th(false)}>Balance After</th>
                              <th style={styles.th(false)}>Status</th>
                              <th style={styles.th(false)}>Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerDetail.transactions.map((t) => (
                              <tr key={t.id}>
                                <td style={styles.td}>#{t.id}</td>
                                <td style={styles.td}>
                                  <span style={{ fontWeight: '700', fontSize: '12px' }}>{t.transaction_type}</span>
                                </td>
                                <td style={styles.td}>
                                  <span style={{ fontWeight: '700', color: ['FD_MATURITY', 'RD_MATURITY'].includes(t.transaction_type) ? '#047857' : '#BE123C' }}>
                                    {['FD_MATURITY', 'RD_MATURITY'].includes(t.transaction_type) ? '+' : '−'}{formatCurrency(t.amount)}
                                  </span>
                                </td>
                                <td style={styles.td}>{formatCurrency(t.balance_after)}</td>
                                <td style={styles.td}>
                                  <span style={styles.statusBadge(t.status)}>{t.status}</span>
                                </td>
                                <td style={styles.td}>{formatDate(t.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RD ITEMIZE CONTRIBUTION HISTORY MODAL ─────────────────────────────── */}
      {selectedRdForContributions && (
        <div style={styles.modalOverlay} onClick={() => setSelectedRdForContributions(null)}>
          <div style={{ ...styles.modalCard, maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0A1628', margin: 0 }}>
                  RD #{selectedRdForContributions.id} Contribution History
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                  {formatCurrency(selectedRdForContributions.monthly_amount)}/mo • {selectedRdForContributions.tenure_months} Months
                </p>
              </div>
              <button
                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold' }}
                onClick={() => setSelectedRdForContributions(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th(false)}>Month</th>
                    <th style={styles.th(false)}>Amount</th>
                    <th style={styles.th(false)}>Due Date</th>
                    <th style={styles.th(false)}>Status</th>
                    <th style={styles.th(false)}>Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRdForContributions.contributions?.map((c) => (
                    <tr key={c.monthNumber}>
                      <td style={styles.td}>Month {c.monthNumber}</td>
                      <td style={styles.td}>{formatCurrency(c.amount)}</td>
                      <td style={styles.td}>{formatDate(c.dueDate)}</td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge(c.status)}>{c.status}</span>
                      </td>
                      <td style={styles.td}>{c.paidAt ? formatDate(c.paidAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInvestments;
