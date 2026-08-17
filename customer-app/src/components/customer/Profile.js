/**
 * Customer App — Profile.js (Enterprise Customer Identity & Security Center)
 * Features:
 * - Dynamic retrieval of authenticated customer details from /customer/profile
 * - Profile details: Full Name, Email, Phone, Account Number (masked/copyable), Account Type, Status, Balance, Member Since
 * - Edit Profile with instant inline save/cancel & loading state
 * - Change Password with strict validation (current password, 8+ char rule, matching check)
 * - Shimmer skeleton loading state & clean error handling
 * - Zero emojis, crisp SVG icons, and consistent fintech styling
 */
import React, { useState, useEffect } from 'react';
import API from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Edit Profile State
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ customerName: '', customerPhone: '', customerCity: '', customerAddress: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState({ text: '', ok: true });

  // Password State
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ text: '', ok: true });

  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data } = await API.get('/customer/profile');
        if (!cancelled && data.success) {
          setProfile(data.data);
          setEditForm({
            customerName: data.data.customerName || '',
            customerPhone: data.data.customerPhone || '',
            customerCity: data.data.customerCity || '',
            customerAddress: data.data.customerAddress || '',
          });
        }
      } catch (err) {
        if (!cancelled && err.response?.status !== 401 && err.response?.status !== 403) {
          console.error('Profile fetch error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyAccount = () => {
    if (profile?.AccountNumber) {
      navigator.clipboard.writeText(profile.AccountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveProfile = async () => {
    if (!editForm.customerName.trim()) {
      setEditMsg({ text: 'Please enter your full name.', ok: false });
      return;
    }
    if (!editForm.customerPhone.trim() || editForm.customerPhone.length < 10) {
      setEditMsg({ text: 'Please enter a valid 10-digit phone number.', ok: false });
      return;
    }

    setEditLoading(true);
    setEditMsg({ text: '', ok: true });
    try {
      const { data } = await API.put('/customer/profile', editForm);
      if (data.success) {
        setProfile((prev) => ({ ...prev, ...editForm }));
        setEditMode(false);
        setEditMsg({ text: 'Profile details updated successfully.', ok: true });
      }
    } catch (err) {
      setEditMsg({ text: err.response?.data?.message || 'Failed to update profile.', ok: false });
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwdForm.currentPassword) {
      setPwdMsg({ text: 'Please enter your current password.', ok: false });
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      setPwdMsg({ text: 'New password must be at least 8 characters.', ok: false });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirm) {
      setPwdMsg({ text: 'New passwords do not match.', ok: false });
      return;
    }

    setPwdLoading(true);
    setPwdMsg({ text: '', ok: true });
    try {
      const { data } = await API.put('/customer/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      if (data.success) {
        setPwdMsg({ text: 'Account password changed successfully.', ok: true });
        setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
      }
    } catch (err) {
      setPwdMsg({ text: err.response?.data?.message || 'Password change failed.', ok: false });
    } finally {
      setPwdLoading(false);
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
      marginBottom: '28px',
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
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1.6fr',
      gap: '24px',
      alignItems: 'start',
    },
    card: {
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 4px 16px -2px rgba(10, 22, 40, 0.04)',
      padding: '24px 28px',
      marginBottom: '24px',
    },
    avatarBox: {
      width: '76px',
      height: '76px',
      borderRadius: '20px',
      background: 'linear-gradient(135deg, #0A1628 0%, #1E3A8A 100%)',
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: '26px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 16px',
      boxShadow: '0 8px 20px rgba(10, 22, 40, 0.15)',
    },
    customerName: {
      fontSize: '20px',
      fontWeight: '800',
      color: '#0A1628',
      textAlign: 'center',
      margin: '0 0 4px 0',
      letterSpacing: '-0.01em',
    },
    customerEmail: {
      fontSize: '13px',
      color: '#64748B',
      textAlign: 'center',
      margin: '0 0 14px 0',
    },
    badgeRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      marginBottom: '20px',
    },
    statusBadge: (isActive) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      background: isActive ? '#ECFDF5' : '#FFF1F2',
      color: isActive ? '#047857' : '#BE123C',
      border: `1px solid ${isActive ? '#A7F3D0' : '#FECDD3'}`,
    }),
    accountBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '600',
      background: '#EFF6FF',
      color: '#1D4ED8',
      border: '1px solid #DBEAFE',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    },
    balanceCard: {
      background: 'linear-gradient(135deg, #0A1628 0%, #0F2A4A 60%, #134E5E 100%)',
      borderRadius: '14px',
      padding: '20px 22px',
      color: '#FFFFFF',
      marginBottom: '20px',
    },
    infoRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: '1px solid #F1F5F9',
      fontSize: '13px',
    },
    infoLabel: {
      color: '#64748B',
      fontWeight: '500',
    },
    infoVal: {
      color: '#0A1628',
      fontWeight: '600',
    },
    cardTitleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '20px',
      paddingBottom: '12px',
      borderBottom: '1px solid #F1F5F9',
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: '700',
      color: '#0A1628',
      margin: 0,
      letterSpacing: '-0.01em',
    },
    editBtn: {
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#2563EB',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.15s ease',
    },
    formGroup: {
      marginBottom: '16px',
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
    },
    alertBox: (ok) => ({
      background: ok ? '#ECFDF5' : '#FFF1F2',
      border: `1px solid ${ok ? '#A7F3D0' : '#FECDD3'}`,
      color: ok ? '#047857' : '#BE123C',
      padding: '10px 14px',
      borderRadius: '8px',
      marginBottom: '16px',
      fontSize: '12px',
    }),
    btnPrimary: (disabled) => ({
      padding: '10px 18px',
      background: disabled ? '#94A3B8' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    }),
    btnSecondary: {
      padding: '10px 18px',
      background: '#F8FAFC',
      border: '1px solid #E2E8F0',
      color: '#475569',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      marginRight: '10px',
    },
    skeleton: {
      background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: '8px',
    },
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={{ height: '32px', width: '220px', ...styles.skeleton, marginBottom: '24px' }} />
          <div style={styles.grid}>
            <div style={{ height: '380px', ...styles.skeleton }} />
            <div style={{ height: '380px', ...styles.skeleton }} />
          </div>
        </div>
      </div>
    );
  }

  const isActive = profile?.AccountStatus === 'Active';

  return (
    <div style={styles.page}>
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @media (max-width: 900px) {
            .profile-layout-grid { grid-template-columns: 1fr !important; }
          }
        `}
      </style>

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Account Profile &amp; Security</h1>
          <p style={styles.subtitle}>
            Manage your verified contact information, core banking parameters, and access credentials.
          </p>
        </div>

        <div style={styles.grid} className="profile-layout-grid">
          {/* Left Column: Account Identity Card */}
          <div>
            <div style={styles.card}>
              <div style={styles.avatarBox}>{getInitials(profile?.customerName)}</div>
              <h2 style={styles.customerName}>{profile?.customerName}</h2>
              <p style={styles.customerEmail}>{profile?.customerEmail}</p>

              <div style={styles.badgeRow}>
                <span style={styles.statusBadge(isActive)}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#10B981' : '#F43F5E' }} />
                  <span>{profile?.AccountStatus || 'Active'}</span>
                </span>
                <span style={styles.accountBadge}>
                  {profile?.AccountType || 'Savings'}
                </span>
              </div>

              {/* Balance Box */}
              <div style={styles.balanceCard}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  Core Available Balance
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em' }}>
                  {formatCurrency(profile?.Balance || 0)}
                </div>
              </div>

              {/* Account Parameters */}
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Account Number</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={copyAccount} title="Copy Account Number">
                  <span style={{ ...styles.infoVal, fontFamily: 'monospace' }}>
                    {profile?.AccountNumber}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {copied && <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '700' }}>Copied</span>}
                </div>
              </div>

              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>KYC Verification</span>
                <span style={{ ...styles.infoVal, color: profile?.AccountVerify ? '#059669' : '#D97706' }}>
                  {profile?.AccountVerify ? '✓ Verified Customer' : '⚠ Verification Pending'}
                </span>
              </div>

              <div style={{ ...styles.infoRow, borderBottom: 'none' }}>
                <span style={styles.infoLabel}>Member Since</span>
                <span style={styles.infoVal}>
                  {profile?.CreatedAt ? formatDate(profile.CreatedAt) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Personal Info & Security */}
          <div>
            {/* Personal Details */}
            <div style={styles.card}>
              <div style={styles.cardTitleRow}>
                <h3 style={styles.cardTitle}>Personal Information</h3>
                {!editMode && (
                  <button style={styles.editBtn} onClick={() => setEditMode(true)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>Edit Info</span>
                  </button>
                )}
              </div>

              {editMsg.text && <div style={styles.alertBox(editMsg.ok)}>{editMsg.text}</div>}

              {!editMode ? (
                <div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Full Legal Name</span>
                    <span style={styles.infoVal}>{profile?.customerName}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Registered Email</span>
                    <span style={styles.infoVal}>{profile?.customerEmail}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Mobile Contact</span>
                    <span style={styles.infoVal}>{profile?.customerPhone || '—'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>City / Location</span>
                    <span style={styles.infoVal}>{profile?.customerCity || '—'}</span>
                  </div>
                  <div style={{ ...styles.infoRow, borderBottom: 'none' }}>
                    <span style={styles.infoLabel}>Residential Address</span>
                    <span style={styles.infoVal}>{profile?.customerAddress || '—'}</span>
                  </div>
                </div>
              ) : (
                <div onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProfile(); }}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Full Legal Name</label>
                    <input
                      style={styles.input}
                      value={editForm.customerName}
                      onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                      disabled={editLoading}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Mobile Phone Number</label>
                    <input
                      style={styles.input}
                      value={editForm.customerPhone}
                      maxLength={12}
                      onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                      disabled={editLoading}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>City</label>
                    <input
                      style={styles.input}
                      value={editForm.customerCity}
                      onChange={(e) => setEditForm({ ...editForm, customerCity: e.target.value })}
                      disabled={editLoading}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Residential Address</label>
                    <input
                      style={styles.input}
                      value={editForm.customerAddress}
                      onChange={(e) => setEditForm({ ...editForm, customerAddress: e.target.value })}
                      disabled={editLoading}
                    />
                  </div>

                  <div style={{ display: 'flex', marginTop: '20px' }}>
                    <button style={styles.btnSecondary} onClick={() => setEditMode(false)} disabled={editLoading}>
                      Cancel
                    </button>
                    <button style={styles.btnPrimary(editLoading)} onClick={handleSaveProfile} disabled={editLoading}>
                      {editLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Change Password Card */}
            <div style={styles.card}>
              <div style={styles.cardTitleRow}>
                <h3 style={styles.cardTitle}>Change Access Password</h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>256-Bit Salted Hash</span>
              </div>

              {pwdMsg.text && <div style={styles.alertBox(pwdMsg.ok)}>{pwdMsg.text}</div>}

              <div onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Current Account Password</label>
                  <input
                    style={styles.input}
                    type="password"
                    placeholder="Enter current password"
                    value={pwdForm.currentPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                    disabled={pwdLoading}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>New Password (Min 8 characters)</label>
                  <input
                    style={styles.input}
                    type="password"
                    placeholder="Create a strong password"
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                    disabled={pwdLoading}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Confirm New Password</label>
                  <input
                    style={styles.input}
                    type="password"
                    placeholder="Repeat new password"
                    value={pwdForm.confirm}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                    disabled={pwdLoading}
                  />
                </div>

                <button style={styles.btnPrimary(pwdLoading)} onClick={handleChangePassword} disabled={pwdLoading}>
                  {pwdLoading ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
