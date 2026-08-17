/**
 * components/customer/Beneficiaries.js
 * Add, view, delete beneficiaries.
 */
import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { formatDate } from '../../utils/format';

const Beneficiaries = () => {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ beneficiaryAccount: '', beneficiaryName: '' });
  const [validating, setValidating] = useState(false);
  const [verifiedName, setVerifiedName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchBeneficiaries = () =>
    API.get('/customer/beneficiaries').then(r => setList(r.data.data.beneficiaries || []));

  useEffect(() => { fetchBeneficiaries(); }, []);

  const validateAccount = async (acc) => {
    if (acc.length !== 12) { setVerifiedName(''); return; }
    setValidating(true);
    try {
      const { data } = await API.get(`/customer/beneficiaries/validate/${acc}`);
      setVerifiedName(data.data.customerName);
      setForm(f => ({ ...f, beneficiaryName: f.beneficiaryName || data.data.customerName }));
    } catch { setVerifiedName('NOT FOUND'); }
    finally { setValidating(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      await API.post('/customer/beneficiaries', form);
      setSuccess('Beneficiary added!');
      setForm({ beneficiaryAccount: '', beneficiaryName: '' });
      setVerifiedName('');
      fetchBeneficiaries();
    } catch (err) { setError(err.response?.data?.message || 'Failed to add'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this beneficiary?')) return;
    try {
      await API.delete(`/customer/beneficiaries/${id}`);
      fetchBeneficiaries();
    } catch (err) { setError(err.response?.data?.message || 'Remove failed'); }
  };

  const s = {
    page: { background: '#f5f7fa', minHeight: '100vh', padding: 24 },
    grid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, maxWidth: 900, margin: '0 auto' },
    card: { background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    title: { fontSize: 18, fontWeight: 700, color: '#1A3C5E', marginBottom: 20 },
    group: { marginBottom: 18 },
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 },
    input: { width: '100%', padding: '11px 13px', border: '2px solid #e0e0e0', borderRadius: 7, fontSize: 14, boxSizing: 'border-box', outline: 'none' },
    btn: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
    beneCard: { border: '1px solid #e8e8e8', borderRadius: 10, padding: '16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    delBtn: { background: '#fde8e8', color: '#c0392b', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
    err: { background: '#fde8e8', color: '#c0392b', padding: '10px', borderRadius: 7, marginBottom: 14, fontSize: 13 },
    ok: { background: '#d4edda', color: '#155724', padding: '10px', borderRadius: 7, marginBottom: 14, fontSize: 13 },
  };

  return (
    <div style={s.page}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A3C5E', marginBottom: 24 }}>Beneficiaries</h1>
      <div style={s.grid}>
        {/* Add Form */}
        <div style={s.card}>
          <p style={s.title}>Add Beneficiary</p>
          {error && <div style={s.err}>{error}</div>}
          {success && <div style={s.ok}>{success}</div>}
          <form onSubmit={handleAdd}>
            <div style={s.group}>
              <label style={s.label}>Account Number</label>
              <input style={s.input} placeholder="12-digit account number" maxLength={12}
                value={form.beneficiaryAccount}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g,'').slice(0,12);
                  setForm({ ...form, beneficiaryAccount: v });
                  validateAccount(v);
                }} required />
              {validating && <div style={{ fontSize: 11, color: '#888', marginTop: 5 }}>Validating...</div>}
              {verifiedName && verifiedName !== 'NOT FOUND' && (
                <div style={{ fontSize: 12, color: '#1E8449', marginTop: 5 }}>✅ Verified: {verifiedName}</div>
              )}
              {verifiedName === 'NOT FOUND' && (
                <div style={{ fontSize: 12, color: '#c0392b', marginTop: 5 }}>❌ Account not found</div>
              )}
            </div>
            <div style={s.group}>
              <label style={s.label}>Nickname / Name</label>
              <input style={s.input} placeholder="e.g. Mom, Office Rent" value={form.beneficiaryName}
                onChange={e => setForm({ ...form, beneficiaryName: e.target.value })} required />
            </div>
            <button style={s.btn} type="submit" disabled={loading || verifiedName === 'NOT FOUND'}>
              {loading ? 'Adding...' : '+ Add Beneficiary'}
            </button>
          </form>
        </div>

        {/* List */}
        <div style={s.card}>
          <p style={s.title}>Saved Beneficiaries ({list.length})</p>
          {list.length === 0 ? (
            <p style={{ color: '#aaa', fontSize: 13 }}>No beneficiaries yet. Add one to get started.</p>
          ) : list.map(b => (
            <div key={b.beneficiary_id} style={s.beneCard}>
              <div>
                <div style={{ fontWeight: 700, color: '#1A3C5E', fontSize: 15 }}>{b.beneficiary_name}</div>
                <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{b.beneficiary_account}</div>
                <div style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>Added {formatDate(b.created_at)}</div>
              </div>
              <button style={s.delBtn} onClick={() => handleDelete(b.beneficiary_id)}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Beneficiaries;
