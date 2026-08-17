/**
 * components/customer/Statement.js
 * Monthly statement view + PDF download.
 */
import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { formatCurrency, formatDate, getTxnColor } from '../../utils/format';

const Statement = () => {
  const [year, setYear]   = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfStart, setPdfStart] = useState('');
  const [pdfEnd, setPdfEnd]     = useState('');

  const fetchStatement = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/customer/monthly-statement?year=${year}&month=${month}`);
      setData(res.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStatement(); }, [year, month]);

  const downloadPdf = async () => {
    try {
      const params = new URLSearchParams();
      if (pdfStart) params.append('startDate', pdfStart);
      if (pdfEnd)   params.append('endDate', pdfEnd);
      const token = localStorage.getItem('jwtToken');
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8081'}/customer/statement-pdf?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'statement.pdf'; a.click();
    } catch (err) { alert('Failed to download PDF'); }
  };

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const txns = data?.transactions || [];

  const s = {
    page: { background: '#f5f7fa', minHeight: '100vh', padding: 24 },
    card: { background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 },
    controls: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 },
    select: { padding: '10px 14px', border: '2px solid #e0e0e0', borderRadius: 7, fontSize: 14, background: '#fff' },
    btn: { padding: '10px 20px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)', color: '#fff',
           border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 },
    sumCard: { background: '#f0f7ff', borderRadius: 10, padding: 20, textAlign: 'center' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '12px 14px', background: '#1A3C5E', color: '#fff', textAlign: 'left', fontSize: 12 },
    td: { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid #f5f5f5' },
  };

  return (
    <div style={s.page}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A3C5E', marginBottom: 24 }}>Bank Statement</h1>

      {/* PDF Download Section */}
      <div style={s.card}>
        <p style={{ fontWeight: 700, color: '#1A3C5E', marginBottom: 14, fontSize: 15 }}>📄 Download PDF Statement</p>
        <div style={s.controls}>
          <input type="date" value={pdfStart} onChange={e => setPdfStart(e.target.value)}
            style={{ padding: '10px 12px', border: '2px solid #e0e0e0', borderRadius: 7, fontSize: 14 }} />
          <span style={{ color: '#888' }}>to</span>
          <input type="date" value={pdfEnd} onChange={e => setPdfEnd(e.target.value)}
            style={{ padding: '10px 12px', border: '2px solid #e0e0e0', borderRadius: 7, fontSize: 14 }} />
          <button style={s.btn} onClick={downloadPdf}>⬇️ Download PDF</button>
        </div>
      </div>

      {/* Monthly View */}
      <div style={s.card}>
        <div style={{ ...s.controls, marginBottom: 20 }}>
          <select style={s.select} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select style={s.select} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button style={s.btn} onClick={fetchStatement}>View Statement</button>
        </div>

        {data && (
          <>
            <div style={s.summaryGrid}>
              <div style={s.sumCard}>
                <p style={{ color: '#1E8449', fontSize: 22, fontWeight: 700 }}>{formatCurrency(data.totalCredit || 0)}</p>
                <p style={{ color: '#888', fontSize: 12 }}>Total Credits</p>
              </div>
              <div style={s.sumCard}>
                <p style={{ color: '#C0392B', fontSize: 22, fontWeight: 700 }}>{formatCurrency(data.totalDebit || 0)}</p>
                <p style={{ color: '#888', fontSize: 12 }}>Total Debits</p>
              </div>
              <div style={s.sumCard}>
                <p style={{ color: '#1A3C5E', fontSize: 22, fontWeight: 700 }}>{txns.length}</p>
                <p style={{ color: '#888', fontSize: 12 }}>Transactions</p>
              </div>
            </div>

            {loading ? <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>Loading...</div> : (
              <table style={s.table}>
                <thead><tr>
                  {['Date', 'Type', 'Description', 'Amount', 'Balance'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {txns.length === 0 ? (
                    <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#aaa' }}>No transactions this month</td></tr>
                  ) : txns.map((t, i) => (
                    <tr key={i} style={{ background: i%2===0 ? '#fff' : '#fafafa' }}>
                      <td style={s.td}>{formatDate(t.created_at)}</td>
                      <td style={s.td}><span style={{ color: getTxnColor(t.transaction_type), fontWeight: 600, fontSize: 12 }}>{t.transaction_type}</span></td>
                      <td style={s.td}>{t.description}</td>
                      <td style={s.td}><span style={{ color: getTxnColor(t.transaction_type), fontWeight: 700 }}>
                        {['DEPOSIT','RECEIVE','LOAN_APPROVED'].includes(t.transaction_type) ? '+' : '−'}
                        {formatCurrency(t.amount)}
                      </span></td>
                      <td style={s.td}>{t.balance_after != null ? formatCurrency(t.balance_after) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Statement;
