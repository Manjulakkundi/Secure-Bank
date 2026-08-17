/**
 * services/pdfService.js
 * Generates professional PDF bank statements using PDFKit.
 */
const PDFDocument = require('pdfkit');

const BANK_NAME   = 'SecureBank';
const PRIMARY     = '#1A3C5E';
const SECONDARY   = '#2E7D9A';
const LIGHT_BG    = '#F0F7FF';

/**
 * Generate a bank statement PDF and pipe to response.
 * @param {object} res        - Express response object
 * @param {object} customer   - Customer row from DB
 * @param {Array}  txns       - Array of transaction rows
 * @param {string} startDate
 * @param {string} endDate
 */
const generateStatement = (res, customer, txns, startDate, endDate) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="statement_${customer.AccountNumber}_${Date.now()}.pdf"`
  );
  doc.pipe(res);

  const pageW = doc.page.width;
  const margin = 50;
  const contentW = pageW - margin * 2;

  // ─── Header Banner ────────────────────────────────────────────────────────
  doc.rect(0, 0, pageW, 100).fill(PRIMARY);
  doc.fontSize(26).fillColor('#FFFFFF').font('Helvetica-Bold').text(BANK_NAME, margin, 30);
  doc.fontSize(11).fillColor('#A8D8EA').font('Helvetica').text('Account Statement', margin, 62);
  doc.fontSize(10).fillColor('#A8D8EA')
    .text(`Generated: ${new Date().toLocaleString('en-IN')}`, 0, 72, { align: 'right', width: pageW - margin });

  // ─── Customer Info Box ────────────────────────────────────────────────────
  doc.rect(margin, 115, contentW, 100).fill(LIGHT_BG).stroke();
  doc.fillColor('#333').font('Helvetica-Bold').fontSize(12).text('Customer Details', margin + 12, 125);
  doc.font('Helvetica').fontSize(10);
  const col2 = margin + contentW / 2;
  doc.fillColor('#555')
    .text(`Name:`, margin + 12, 142).fillColor('#222').text(customer.customerName, margin + 80, 142)
    .fillColor('#555').text(`Account No:`, margin + 12, 158).fillColor('#222').text(customer.AccountNumber, margin + 80, 158)
    .fillColor('#555').text(`Type:`, margin + 12, 174).fillColor('#222').text(customer.AccountType, margin + 80, 174)
    .fillColor('#555').text(`Email:`, col2, 142).fillColor('#222').text(customer.customerEmail, col2 + 50, 142)
    .fillColor('#555').text(`Phone:`, col2, 158).fillColor('#222').text(customer.customerPhone, col2 + 50, 158)
    .fillColor('#555').text(`Period:`, col2, 174).fillColor('#222')
    .text(`${startDate || 'All'} to ${endDate || 'All'}`, col2 + 50, 174);

  // ─── Balance Summary ──────────────────────────────────────────────────────
  doc.rect(margin, 230, contentW, 40).fill(SECONDARY);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(11)
    .text('Current Balance:', margin + 12, 245)
    .text(`₹${parseFloat(customer.Balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      0, 245, { align: 'right', width: pageW - margin });

  // ─── Transactions Table ───────────────────────────────────────────────────
  const tableTop = 285;
  const cols = {
    date:   { x: margin,          w: 105 },
    type:   { x: margin + 105,    w: 90  },
    desc:   { x: margin + 195,    w: 165 },
    debit:  { x: margin + 360,    w: 70  },
    credit: { x: margin + 430,    w: 70  },
    bal:    { x: margin + 500,    w: 75  },
  };

  // Header row
  doc.rect(margin, tableTop, contentW, 22).fill(PRIMARY);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
  Object.entries(cols).forEach(([key, c]) => {
    const labels = { date:'Date', type:'Type', desc:'Description', debit:'Debit(₹)', credit:'Credit(₹)', bal:'Balance(₹)' };
    doc.text(labels[key], c.x + 3, tableTop + 6, { width: c.w });
  });

  // Data rows
  let y = tableTop + 22;
  let totalDebits = 0, totalCredits = 0;

  txns.forEach((t, i) => {
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 50;
    }
    const alt = i % 2 === 0;
    doc.rect(margin, y, contentW, 20).fill(alt ? LIGHT_BG : '#FFFFFF');

    const isDebit  = ['WITHDRAW', 'TRANSFER'].includes(t.transaction_type);
    const isCredit = ['DEPOSIT', 'RECEIVE', 'LOAN_APPROVED'].includes(t.transaction_type);
    const amt = parseFloat(t.amount);
    if (isDebit)  totalDebits  += amt;
    if (isCredit) totalCredits += amt;

    doc.fillColor('#333').font('Helvetica').fontSize(8);
    doc.text(new Date(t.created_at).toLocaleDateString('en-IN'),
      cols.date.x + 3, y + 5, { width: cols.date.w });
    doc.text(t.transaction_type, cols.type.x + 3, y + 5, { width: cols.type.w });
    doc.text((t.description || '').substring(0, 30), cols.desc.x + 3, y + 5, { width: cols.desc.w });
    doc.fillColor(isDebit ? '#C0392B' : '#555')
      .text(isDebit ? amt.toFixed(2) : '-', cols.debit.x + 3, y + 5, { width: cols.debit.w, align: 'right' });
    doc.fillColor(isCredit ? '#1E8449' : '#555')
      .text(isCredit ? amt.toFixed(2) : '-', cols.credit.x + 3, y + 5, { width: cols.credit.w, align: 'right' });
    doc.fillColor('#333')
      .text((t.balance_after != null ? parseFloat(t.balance_after).toFixed(2) : '-'),
        cols.bal.x + 3, y + 5, { width: cols.bal.w, align: 'right' });
    y += 20;
  });

  // Totals row
  doc.rect(margin, y, contentW, 24).fill('#E8F4F8');
  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(9);
  doc.text('TOTALS', margin + 3, y + 7);
  doc.fillColor('#C0392B').text(totalDebits.toFixed(2), cols.debit.x + 3, y + 7, { width: cols.debit.w, align: 'right' });
  doc.fillColor('#1E8449').text(totalCredits.toFixed(2), cols.credit.x + 3, y + 7, { width: cols.credit.w, align: 'right' });

  if (txns.length === 0) {
    doc.fillColor('#888').font('Helvetica').fontSize(11)
      .text('No transactions found for the selected period.', margin, tableTop + 40, { align: 'center', width: contentW });
  }

  // ─── Footer ───────────────────────────────────────────────────────────────
  doc.rect(0, doc.page.height - 40, pageW, 40).fill(PRIMARY);
  doc.fillColor('#A8D8EA').font('Helvetica').fontSize(9)
    .text('This is a computer-generated statement. No signature required.', margin, doc.page.height - 26);

  doc.end();
};

module.exports = { generateStatement };
