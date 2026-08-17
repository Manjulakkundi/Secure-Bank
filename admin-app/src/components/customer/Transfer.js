/**
 * components/customer/Transfer.js
 * Fund transfer with beneficiary lookup, balance validation, fraud alert display.
 */
import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { formatCurrency } from '../../utils/format';

const Transfer = () => {
  const [form, setForm] = useState({ toAccount: '', transferAmount: '' });
  const [receiverInfo, setReceiverInfo] = useState(null);
  const [balance, setBalance] = useState(0);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get('/customer/account-info').then(r => setBalance(parseFloat(r.data.data.Balance || 0)));
    API.get('/customer/beneficiaries').then(r => setBeneficiaries(r.data.data.beneficiaries || []));
  }, []);

  const validateAccount = async (acc) => {
    if (acc.length !== 12) { setReceiverInfo(null); return; }
    setValidating(true);
    try {
      const { data } = await API.get(`/customer/beneficiaries/validate/${acc}`);
      setReceiverInfo(data.data);
    } catch { setReceiverInfo({ error: 'Account not found' }); }
    finally { setValidating(false); }
  };

  const handleAccountChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
    setForm({ ...form, toAccount: val });
    setReceiverInfo(null);
    if (val.length === 12) validateAccount(val);
  };

  const selectBeneficiary = (b) => {
    setForm({ ...form, toAccount: b.beneficiary_account });
    setReceiverInfo({ customerName: b.beneficiary_name, accountExists: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseFloat(form.transferAmount) > balance) return setError('Insufficient balance');
    setError(''); setLoading(true); setResult(null);
    try {
      const { data } = await API.post('/customer/transfer', form);
      setResult(data.data);
      setBalance(prev => prev - parseFloat(form.transferAmount));
      setForm({ toAccount: '', transferAmount: '' });
      setReceiverInfo(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Transfer failed');
    } finally { setLoading(false); }
  };

  const s = {
    page: { background: '#f5f7fa', minHeight: '100vh', padding: 24 },
    grid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, maxWidth: 900, margin: '0 auto' },
    card: { background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    title: { fontSize: 20, fontWeight: 700, color: '#1A3C5E', marginBottom: 24 },
    group: { marginBottom: 20 },
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 },
    input: { width: '100%', padding: '12px 14px', border: '2px solid #e0e0e0', borderRadius: 8,
             fontSize: 15, outline: 'none', boxSizing: 'border-box' },
    btn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)',
           color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: 'pointer' },
    err: { background: '#fde8e8', color: '#c0392b', padding: '12px', borderRadius: 8, marginBottom: 16, fontSize: 13 },
    ok: { background: '#d4edda', color: '#155724', padding: '16px', borderRadius: 10, marginBottom: 16 },
    balBadge: { background: '#e8f4f8', color: '#1A3C5E', padding: '12px 16px', borderRadius: 8,
                fontWeight: 700, marginBottom: 20, textAlign: 'center', fontSize: 16 },
    verifyBox: (ok) => ({
      padding: '10px 14px', borderRadius: 7, marginTop: 8, fontSize: 13,
      background: ok ? '#d4edda' : '#fde8e8', color: ok ? '#155724' : '#c0392b',
    }),
    beneItem: { padding: '12px', border: '2px solid #e0e0e0', borderRadius: 8, cursor: 'pointer',
                marginBottom: 8, transition: 'border 0.2s' },
    alertBox: { background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '12px 16px', marginTop: 12 },
  };

  return (
    <div style={s.page}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A3C5E', marginBottom: 24 }}>Fund Transfer</h1>
      <div style={s.grid}>
        <div style={s.card}>
          {error && <div style={s.err}>{error}</div>}
          {result && (
            <div style={s.ok}>
              <strong>✅ Transfer Successful!</strong>
              <p style={{ margin: '8px 0 0', fontSize: 13 }}>Transaction ID: #{result.transactionId}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>New Balance: {formatCurrency(result.newBalance)}</p>
              {result.fraudAlert && (
                <div style={s.alertBox}>
                  ⚠️ <strong>{result.fraudAlert.riskLevel} Risk Alert</strong> — Transaction flagged for review
                </div>
              )}
            </div>
          )}
          <div style={s.balBadge}>Available: {formatCurrency(balance)}</div>
          <form onSubmit={handleSubmit}>
            <div style={s.group}>
              <label style={s.label}>Receiver Account Number</label>
              <input style={s.input} placeholder="12-digit account number" maxLength={12}
                value={form.toAccount} onChange={handleAccountChange} required />
              {validating && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Validating...</div>}
              {receiverInfo && !receiverInfo.error && (
                <div style={s.verifyBox(true)}>✅ {receiverInfo.customerName}</div>
              )}
              {receiverInfo?.error && <div style={s.verifyBox(false)}>❌ {receiverInfo.error}</div>}
            </div>
            <div style={s.group}>
              <label style={s.label}>Transfer Amount (₹)</label>
              <input style={s.input} type="number" min="1" max="500000" step="0.01"
                placeholder="Enter amount" value={form.transferAmount}
                onChange={e => setForm({ ...form, transferAmount: e.target.value })} required />
              {form.transferAmount && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                  Balance after: {formatCurrency(balance - parseFloat(form.transferAmount || 0))}
                </div>
              )}
            </div>
            <button style={s.btn} type="submit"
              disabled={loading || !receiverInfo?.accountExists}>
              {loading ? 'Processing...' : '💸 Transfer Money'}
            </button>
          </form>
        </div>

        <div style={s.card}>
          <p style={s.title}>Beneficiaries</p>
          {beneficiaries.length === 0 ? (
            <p style={{ color: '#aaa', fontSize: 13 }}>No beneficiaries added yet</p>
          ) : (
            beneficiaries.map(b => (
              <div key={b.beneficiary_id} style={s.beneItem}
                onClick={() => selectBeneficiary(b)}
                onMouseOver={e => e.currentTarget.style.borderColor = '#2E7D9A'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#e0e0e0'}>
                <div style={{ fontWeight: 600, color: '#1A3C5E', fontSize: 14 }}>{b.beneficiary_name}</div>
                <div style={{ color: '#888', fontSize: 12, marginTop: 3 }}>{b.beneficiary_account}</div>
              </div>
            ))
          )}
          <div style={{ marginTop: 16, padding: '12px', background: '#f0f7ff', borderRadius: 8, fontSize: 12, color: '#2E7D9A' }}>
            💡 Click a beneficiary to auto-fill the account number
          </div>
          <div style={{ marginTop: 16, padding: '12px', background: '#fff3cd', borderRadius: 8, fontSize: 12, color: '#856404' }}>
            ⚠️ Transfers over ₹50,000 are automatically flagged for review. Daily limit: ₹1,00,000.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transfer;
