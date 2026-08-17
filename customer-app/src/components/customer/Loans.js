/**
 * components/customer/Loans.js — Apply for loan + view loan history
 */
import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

const STATUS_COLOR = { Pending: '#856404', Approved: '#155724', Denied: '#721c24' };
const STATUS_BG    = { Pending: '#fff3cd', Approved: '#d4edda', Denied: '#fde8e8' };

const Loans = () => {
  const [loans, setLoans] = useState([]);
  const [form, setForm] = useState({ loanAmount: '', loanDurationMonths: '' });
  const [accountType, setAccountType] = useState('Savings');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLoans = () => API.get('/customer/my-loans').then(r => setLoans(r.data.data.loans || []));
  useEffect(() => {
    fetchLoans();
    API.get('/customer/account-info').then(r => setAccountType(r.data.data.AccountType));
  }, []);

  const interestRate = accountType === 'Savings' ? 5 : 6;
  const totalPayable = form.loanAmount && form.loanDurationMonths
    ? (parseFloat(form.loanAmount) + (parseFloat(form.loanAmount) * interestRate / 100) * (parseInt(form.loanDurationMonths) / 12))
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      const { data } = await API.post('/customer/apply-loan', form);
      setSuccess(`Loan application submitted! Interest rate: ${data.data.interestRate}%`);
      setForm({ loanAmount: '', loanDurationMonths: '' });
      fetchLoans();
    } catch (err) { setError(err.response?.data?.message || 'Application failed'); }
    finally { setLoading(false); }
  };

  const s = {
    page: { background: '#f5f7fa', minHeight: '100vh', padding: 24 },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 24, maxWidth: 1000, margin: '0 auto' },
    card: { background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: 'fit-content' },
    title: { fontSize: 18, fontWeight: 700, color: '#1A3C5E', marginBottom: 20 },
    group: { marginBottom: 18 },
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 },
    input: { width: '100%', padding: '11px 13px', border: '2px solid #e0e0e0', borderRadius: 7, fontSize: 14, boxSizing: 'border-box', outline: 'none' },
    btn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
    infoBox: { background: '#f0f7ff', borderRadius: 8, padding: '16px', marginBottom: 20 },
    loanCard: { border: '1px solid #e8e8e8', borderRadius: 10, padding: 18, marginBottom: 14 },
    err: { background: '#fde8e8', color: '#c0392b', padding: '10px', borderRadius: 7, marginBottom: 14, fontSize: 13 },
    ok: { background: '#d4edda', color: '#155724', padding: '10px', borderRadius: 7, marginBottom: 14, fontSize: 13 },
    row: { display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 },
  };

  return (
    <div style={s.page}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A3C5E', marginBottom: 24 }}>Loans</h1>
      <div style={s.grid}>
        <div>
          <div style={s.card}>
            <p style={s.title}>Apply for Loan</p>
            <div style={s.infoBox}>
              <p style={{ margin: 0, fontWeight: 600, color: '#1A3C5E', fontSize: 13 }}>
                {accountType} Account — Interest Rate: <strong>{interestRate}% p.a.</strong>
              </p>
            </div>
            {error && <div style={s.err}>{error}</div>}
            {success && <div style={s.ok}>{success}</div>}
            <form onSubmit={handleSubmit}>
              <div style={s.group}>
                <label style={s.label}>Loan Amount (₹)</label>
                <input style={s.input} type="number" min="1000" max="5000000" placeholder="Min ₹1,000"
                  value={form.loanAmount} onChange={e => setForm({ ...form, loanAmount: e.target.value })} required />
              </div>
              <div style={s.group}>
                <label style={s.label}>Duration (Months)</label>
                <input style={s.input} type="number" min="1" max="360" placeholder="e.g. 12"
                  value={form.loanDurationMonths}
                  onChange={e => setForm({ ...form, loanDurationMonths: e.target.value })} required />
              </div>
              {totalPayable > 0 && (
                <div style={{ ...s.infoBox, background: '#fff3cd', marginBottom: 18 }}>
                  <div style={s.row}><span>Principal:</span><strong>{formatCurrency(form.loanAmount)}</strong></div>
                  <div style={s.row}><span>Interest ({interestRate}% p.a.):</span>
                    <strong>{formatCurrency(totalPayable - parseFloat(form.loanAmount))}</strong></div>
                  <div style={{ ...s.row, borderTop: '1px solid #ffc107', paddingTop: 8 }}>
                    <span>Total Payable:</span><strong style={{ color: '#1A3C5E', fontSize: 15 }}>{formatCurrency(totalPayable)}</strong></div>
                </div>
              )}
              <button style={s.btn} type="submit" disabled={loading}>{loading ? 'Applying...' : 'Apply for Loan'}</button>
            </form>
          </div>
        </div>

        <div style={s.card}>
          <p style={s.title}>My Loans ({loans.length})</p>
          {loans.length === 0 ? <p style={{ color: '#aaa', fontSize: 13 }}>No loan history</p> :
            loans.map(l => (
              <div key={l.LoanID} style={s.loanCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: '#1A3C5E', fontSize: 16 }}>{formatCurrency(l.LoanAmount)}</span>
                  <span style={{ background: STATUS_BG[l.ApprovalStatus], color: STATUS_COLOR[l.ApprovalStatus],
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    {l.ApprovalStatus}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#666' }}>
                  <span>Duration: {l.LoanDurationMonths} months</span>
                  <span>Interest: {l.LoanInterest}%</span>
                  <span>Applied: {formatDate(l.AppliedDate)}</span>
                  {l.ApprovalStatus === 'Approved' && <span>Total: {formatCurrency(l.TotalPayableAmount)}</span>}
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
};

export default Loans;
