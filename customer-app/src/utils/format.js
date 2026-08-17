/**
 * utils/format.js — Currency, date, and number formatters
 */
export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
    .format(parseFloat(amount) || 0);

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const formatDateOnly = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const getRiskBadgeColor = (score) => {
  if (score >= 71) return { bg: '#fde8e8', text: '#c0392b', label: 'HIGH' };
  if (score >= 31) return { bg: '#fef3cd', text: '#856404', label: 'MEDIUM' };
  return { bg: '#d4edda', text: '#155724', label: 'LOW' };
};

export const getTxnColor = (type) => {
  const credits = ['DEPOSIT', 'RECEIVE', 'LOAN_APPROVED', 'FD_MATURITY', 'RD_MATURITY'];
  return credits.includes(type) ? '#1E8449' : '#C0392B';
};

export const getTxnSign = (type, accountNumber, row) => {
  const credits = ['DEPOSIT', 'RECEIVE', 'LOAN_APPROVED', 'FD_MATURITY', 'RD_MATURITY'];
  if (credits.includes(type)) return '+';
  return '−';
};

