import XLSX from 'xlsx';
import { Resend } from 'resend';

const BUSINESS_NAME = "Loves Blinds and Window Treatments";
const BUSINESS_ADDRESS = ""; // set your address here or via env var
const BUSINESS_PHONE = "(555) 408-1290";
const BUSINESS_EMAIL = "loveblindswindows@gmail.com";
const INTERNAL_TO = "loveblindswindows@gmail.com";

// ── xlsx ─────────────────────────────────────────────────────────────────────

function buildWorkbook(customer, lines, notes) {
  const rows = [];

  // Header block
  rows.push([BUSINESS_NAME]);
  if (BUSINESS_ADDRESS) rows.push([BUSINESS_ADDRESS]);
  rows.push([BUSINESS_PHONE]);
  rows.push([BUSINESS_EMAIL]);
  rows.push([
    `Customer: ${customer.name}` +
    (customer.shipTo ? `    Ship to: ${customer.shipTo}` : ''),
  ]);
  rows.push([]); // blank separator

  // Column headers
  rows.push([
    'Description', 'Color', 'Quantity', 'Width', 'Length',
    'Drive System', 'Location', 'Price per unit', 'Total',
  ]);

  // Line items
  for (const line of lines) {
    rows.push([
      line.description,
      line.colorName || line.code || '',
      line.qty,
      line.width  || '',
      line.length || '',
      line.mechName || '',
      line.location || '',
      '', // Price per unit — Stage 2 fills
      '', // Total — Stage 2 fills
    ]);
  }

  rows.push([]); // blank before totals

  // Totals block
  rows.push(['Subtotal', '', '', '', '', '', '', '', '']);
  rows.push(['Tax',      '', '', '', '', '', '', '', '']);
  rows.push(['Total',    '', '', '', '', '', '', '', '']);

  // Notes
  if (notes) {
    rows.push([]);
    rows.push([`Notes: ${notes}`]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merge the business name across all 9 columns
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

  // Column widths
  ws['!cols'] = [
    { wch: 36 }, // Description
    { wch: 22 }, // Color
    { wch: 10 }, // Quantity
    { wch: 10 }, // Width
    { wch: 10 }, // Length
    { wch: 22 }, // Drive System
    { wch: 12 }, // Location
    { wch: 16 }, // Price per unit
    { wch: 14 }, // Total
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Quote');
  return wb;
}

// ── HTML snippets ─────────────────────────────────────────────────────────────

function lineListHtml(lines) {
  return lines.map(l =>
    `<li>${l.description} — ${l.colorName || l.code || 'no color'}, ` +
    `qty ${l.qty}` +
    (l.width ? `, ${l.width}"W × ${l.length}"H` : '') +
    (l.mechName ? `, ${l.mechName}` : '') +
    `</li>`
  ).join('');
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customer, lines, notes } = req.body || {};

  if (!customer?.email) {
    return res.status(400).json({ error: 'customer.email is required' });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'At least one line item is required' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured (RESEND_API_KEY missing)' });
  }

  try {
    const wb = buildWorkbook(customer, lines, notes || '');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const date = new Date().toISOString().slice(0, 10);
    const safeName = customer.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const filename = `quote-${safeName}-${date}.xlsx`;

    // Internal email — xlsx attached
    await resend.emails.send({
      from: "Love's Blinds <quotes@lovesblinds.com>",
      to: INTERNAL_TO,
      subject: `New quote request — ${customer.name}`,
      html: `
        <h2 style="font-family:Georgia,serif;color:#2c2c2a">New Quote Request</h2>
        <p>
          <strong>Name:</strong> ${customer.name}<br>
          <strong>Email:</strong> ${customer.email}<br>
          ${customer.phone       ? `<strong>Phone:</strong> ${customer.phone}<br>` : ''}
          ${customer.shipTo      ? `<strong>Ship to:</strong> ${customer.shipTo}<br>` : ''}
          ${customer.callTime    ? `<strong>Best time to call:</strong> ${customer.callTime}<br>` : ''}
          ${customer.measureMethod ? `<strong>Measurement:</strong> ${customer.measureMethod}` : ''}
        </p>
        <h3 style="font-family:Georgia,serif;color:#2c2c2a">Items (${lines.length})</h3>
        <ul>${lineListHtml(lines)}</ul>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        <p style="color:#666;font-size:13px">Full order sheet attached as Excel.</p>
      `,
      attachments: [{ filename, content: xlsxBuffer }],
    });

    // Customer confirmation — no xlsx, gated behind env var
    if (process.env.SEND_CUSTOMER_CONFIRMATION === 'true') {
      await resend.emails.send({
        from: "Love's Blinds <quotes@lovesblinds.com>",
        to: customer.email,
        subject: "Your quote request — Love's Blinds",
        html: `
          <h2 style="font-family:Georgia,serif;color:#2c2c2a">Thanks, ${customer.name}!</h2>
          <p>We've received your quote request and will send a written proposal to
          <strong>${customer.email}</strong> within 48 hours.</p>
          <h3 style="font-family:Georgia,serif;color:#2c2c2a">What you requested</h3>
          <ul>${lineListHtml(lines)}</ul>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          <p>Questions in the meantime? Call us at ${BUSINESS_PHONE} or reply to this email.</p>
          <p style="color:#888;font-size:12px">${BUSINESS_NAME}</p>
        `,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/quote]', err);
    return res.status(500).json({
      error: err.message || 'Failed to send quote. Please try again or call us directly.',
    });
  }
}
