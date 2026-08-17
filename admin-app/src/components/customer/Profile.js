/**
 * components/customer/Profile.js
 * Full customer profile page with edit and change password.
 * Fixes the 404 bug — this page was missing entirely.
 */
import React, { useState, useEffect } from 'react';
import API from '../../services/api';

const s = {
  page: { background: '#f5f7fa', minHeight: '100vh', padding: 24 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: '#1A3C5E', margin: 0 },
  sub: { color: '#888', fontSize: 14, marginTop: 4 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 },
  card: { background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1A3C5E', marginBottom: 20,
               paddingBottom: 12, borderBottom: '2px solid #f0f4f8' },
  avatar: { width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#1A3C5E,#2E7D9A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, color: '#fff', fontWeight: 700, margin: '0 auto 16px' },
  name: { textAlign: 'center', fontSize: 20, fontWeight: 700, color: '#1A3C5E', marginBottom: 4 },
  accNum: { textAlign: 'center', fontFamily: 'monospace', fontSize: 15, color: '#2E7D9A',
            letterSpacing: 2, marginBottom: 8 },
  badge: { display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12,
           fontWeight: 600, marginBottom: 4 },
  badgeActive: { background: '#d4edda', color: '#155724' },
  badgeFrozen: { background: '#fde8e8', color: '#c0392b' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '10px 0',
         borderBottom: '1px solid #f5f5f5', alignItems: 'center' },
  rowLabel: { fontSize: 13, color: '#888', fontWeight: 600 },
  rowVal: { fontSize: 14, color: '#333', fontWeight: 500 },
  balanceBox: { background: 'linear-gradient(135deg,#1A3C5E,#2E7D9A)', borderRadius: 10,
                padding: '20px', textAlign: 'center', marginBottom: 16 },
  balLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, letterSpacing: 1 },
  balAmt: { color: '#fff', fontSize: 28, fontWeight: 800, marginTop: 4 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 },
  input: { width: '100%', padding: '10px 13px', border: '2px solid #e0e0e0', borderRadius: 7,
           fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 14 },
  inputFocus: { borderColor: '#2E7D9A' },
  btn: { padding: '10px 22px', background: 'linear-gradient(135deg, #1A3C5E, #2E7D9A)',
         color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 700,
         cursor: 'pointer' },
  btnSecondary: { padding: '10px 22px', background: 'transparent', border: '2px solid #2E7D9A',
                  color: '#2E7D9A', borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  marginRight: 10 },
  err: { background: '#fde8e8', color: '#c0392b', padding: '10px', borderRadius: 7,
         marginBottom: 12, fontSize: 13 },
  ok: { background: '#d4edda', color: '#155724', padding: '10px', borderRadius: 7,
        marginBottom: 12, fontSize: 13 },
  loader: { textAlign: 'center', padding: 60, color: '#888' },
  actions: { display: 'flex', marginTop: 8 },
};

const Profile = () => {
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editMode, setEditMode]   = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [editMsg, setEditMsg]     = useState({ type: '', text: '' });
  const [pwdForm, setPwdForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwdMsg, setPwdMsg]       = useState({ type: '', text: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    API.get('/customer/profile')
      .then(res => {
        setProfile(res.data.data);
        setEditForm({
          customerName:    res.data.data.customerName,
          customerPhone:   res.data.data.customerPhone,
          customerAddress: res.data.data.customerAddress,
          customerCity:    res.data.data.customerCity,
        });
      })
      .catch(err => {
        console.error('Profile load error:', err);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSaveLoading(true);
    setEditMsg({ type: '', text: '' });
    try {
      await API.put('/customer/profile', editForm);
      setProfile(prev => ({ ...prev, ...editForm }));
      setEditMode(false);
      setEditMsg({ type: 'ok', text: 'Profile updated successfully!' });
    } catch (err) {
      setEditMsg({ type: 'err', text: err.response?.data?.message || 'Update failed' });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirm) {
      return setPwdMsg({ type: 'err', text: 'New passwords do not match' });
    }
    if (pwdForm.newPassword.length < 8) {
      return setPwdMsg({ type: 'err', text: 'New password must be at least 8 characters' });
    }
    setPwdLoading(true);
    setPwdMsg({ type: '', text: '' });
    try {
      await API.put('/customer/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdMsg({ type: 'ok', text: 'Password changed successfully!' });
      setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwdMsg({ type: 'err', text: err.response?.data?.message || 'Password change failed' });
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) return <div style={s.loader}>Loading profile…</div>;
  if (!profile) return <div style={s.loader}>Could not load profile.</div>;

  const initials = profile.customerName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const badgeStyle = profile.AccountStatus === 'Active' ? s.badgeActive : s.badgeFrozen;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>My Profile</h1>
        <p style={s.sub}>View and manage your account details</p>
      </div>

      <div style={s.grid}>
        {/* Left column — Account Summary */}
        <div>
          {/* Avatar card */}
          <div style={{ ...s.card, textAlign: 'center', marginBottom: 24 }}>
            <div style={s.avatar}>{initials}</div>
            <div style={s.name}>{profile.customerName}</div>
            <div style={s.accNum}>{profile.AccountNumber}</div>
            <span style={{ ...s.badge, ...badgeStyle }}>{profile.AccountStatus}</span>
            <br />
            <span style={{ ...s.badge, background: '#e8f4fd', color: '#1A3C5E', marginTop: 4 }}>
              {profile.AccountType} Account
            </span>
          </div>

          {/* Balance */}
          <div style={s.card}>
            <div style={s.cardTitle}>Account Balance</div>
            <div style={s.balanceBox}>
              <div style={s.balLabel}>AVAILABLE BALANCE</div>
              <div style={s.balAmt}>
                ₹{parseFloat(profile.Balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={s.row}>
              <span style={s.rowLabel}>Account Number</span>
              <span style={{ ...s.rowVal, fontFamily: 'monospace', letterSpacing: 2 }}>{profile.AccountNumber}</span>
            </div>
            <div style={s.row}>
              <span style={s.rowLabel}>Account Type</span>
              <span style={s.rowVal}>{profile.AccountType}</span>
            </div>
            <div style={s.row}>
              <span style={s.rowLabel}>Verified</span>
              <span style={s.rowVal}>{profile.AccountVerify ? '✅ Yes' : '❌ No'}</span>
            </div>
            <div style={{ ...s.row, borderBottom: 'none' }}>
              <span style={s.rowLabel}>Member Since</span>
              <span style={s.rowVal}>
                {profile.CreatedAt
                  ? new Date(profile.CreatedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Right column — Edit & Password */}
        <div>
          {/* Personal Details */}
          <div style={{ ...s.card, marginBottom: 24 }}>
            <div style={{ ...s.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Personal Details
              {!editMode && (
                <button style={{ ...s.btnSecondary, padding: '6px 14px', fontSize: 12 }}
                  onClick={() => setEditMode(true)}>Edit</button>
              )}
            </div>

            {editMsg.text && <div style={editMsg.type === 'ok' ? s.ok : s.err}>{editMsg.text}</div>}

            {!editMode ? (
              <>
                <div style={s.row}>
                  <span style={s.rowLabel}>Full Name</span>
                  <span style={s.rowVal}>{profile.customerName}</span>
                </div>
                <div style={s.row}>
                  <span style={s.rowLabel}>Email</span>
                  <span style={s.rowVal}>{profile.customerEmail}</span>
                </div>
                <div style={s.row}>
                  <span style={s.rowLabel}>Phone</span>
                  <span style={s.rowVal}>{profile.customerPhone}</span>
                </div>
                <div style={s.row}>
                  <span style={s.rowLabel}>City</span>
                  <span style={s.rowVal}>{profile.customerCity}</span>
                </div>
                <div style={{ ...s.row, borderBottom: 'none' }}>
                  <span style={s.rowLabel}>Address</span>
                  <span style={s.rowVal}>{profile.customerAddress}</span>
                </div>
              </>
            ) : (
              <>
                <label style={s.label}>Full Name</label>
                <input style={s.input} value={editForm.customerName}
                  onChange={e => setEditForm({ ...editForm, customerName: e.target.value })} />
                <label style={s.label}>Phone Number</label>
                <input style={s.input} value={editForm.customerPhone}
                  onChange={e => setEditForm({ ...editForm, customerPhone: e.target.value })} maxLength={10} />
                <label style={s.label}>City</label>
                <input style={s.input} value={editForm.customerCity}
                  onChange={e => setEditForm({ ...editForm, customerCity: e.target.value })} />
                <label style={s.label}>Address</label>
                <input style={s.input} value={editForm.customerAddress}
                  onChange={e => setEditForm({ ...editForm, customerAddress: e.target.value })} />
                <div style={s.actions}>
                  <button style={s.btnSecondary} onClick={() => setEditMode(false)}>Cancel</button>
                  <button style={s.btn} onClick={handleSaveProfile} disabled={saveLoading}>
                    {saveLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Change Password */}
          <div style={s.card}>
            <div style={s.cardTitle}>Change Password</div>
            {pwdMsg.text && <div style={pwdMsg.type === 'ok' ? s.ok : s.err}>{pwdMsg.text}</div>}
            <form onSubmit={handleChangePassword}>
              <label style={s.label}>Current Password</label>
              <input style={s.input} type="password" placeholder="Enter current password"
                value={pwdForm.currentPassword}
                onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} required />
              <label style={s.label}>New Password</label>
              <input style={s.input} type="password" placeholder="Min 8 characters"
                value={pwdForm.newPassword}
                onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} required />
              <label style={s.label}>Confirm New Password</label>
              <input style={s.input} type="password" placeholder="Repeat new password"
                value={pwdForm.confirm}
                onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })} required />
              <button style={s.btn} type="submit" disabled={pwdLoading}>
                {pwdLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
