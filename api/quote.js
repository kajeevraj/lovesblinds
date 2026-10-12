import XLSX from 'xlsx';
import { Resend } from 'resend';
import { summarize, describeItem, describeInternal, displayNameOf } from '../src/lib/selectionText.js';

const BUSINESS_NAME    = "Loves Blinds and Window Treatments";
const BUSINESS_ADDRESS = "512 Glenwyck Court, Fuquay-Varina, NC 27526";
const BUSINESS_PHONE   = "262-434-0949";
const BUSINESS_EMAIL   = "loveblindswindows@gmail.com";
const INTERNAL_TO      = "loveblindswindows@gmail.com";

// ── per-line wording ─────────────────────────────────────────────────────────
// description: customer wording (display name + code). internalDescription: supplier collection, color name and
// code plus the display name, for our own email and spreadsheet only.
const rolePrefix = (p, multi) => (multi && p.role ? `${p.role}: ` : '');
function codeCell(line) {
  const picks = line.internalPicks || [];
  if (!picks.length) return line.code || '';
  return picks.map(p => `${rolePrefix(p, picks.length > 1)}${p.code}`).join(' / ');
}
// The old "Color" cell: supplier collection and color name with the code, as we have always received it.
function supplierColorCell(line) {
  const picks = line.internalPicks || [];
  if (!picks.length) return line.colorName || line.code || '';
  return picks.map(p => {
    const name = p.line === 'cellular' && p.supplierColor ? p.supplierColor : [p.collection, p.supplierColor].filter(Boolean).join(' ');
    return `${rolePrefix(p, picks.length > 1)}${name} (${p.code})`;
  }).join(' / ');
}
function nameCell(line) {
  const picks = line.internalPicks || [];
  return picks.map(p => `${rolePrefix(p, picks.length > 1)}${p.displayName}${p.style ? ` (Style ${p.style})` : ''}`).join(' / ');
}

// ── xlsx ─────────────────────────────────────────────────────────────────────

export function buildWorkbook(customer, lines, notes) {
  const rows = [];

  // Header block — all four lines always present
  rows.push([BUSINESS_NAME]);
  rows.push([BUSINESS_ADDRESS]);
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
    'Supplier code', 'Display name',     // appended: the original columns stay where they were
  ]);

  // Line items
  for (const line of lines) {
    rows.push([
      line.internalDescription || line.description,
      supplierColorCell(line),
      line.qty,
      line.width  || '',
      line.length || '',
      line.mechName || '',
      line.roomLabel || '',
      '', // Price per unit: Stage 2 fills
      '', // Total: Stage 2 fills
      codeCell(line),
      nameCell(line),
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

  // Merge the business name across the 9 original columns
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
    { wch: 28 }, // Supplier code (appended)
    { wch: 28 }, // Display name (appended)
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Quote');
  return wb;
}

// ── HTML snippets ─────────────────────────────────────────────────────────────

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Customer email: description (display name + code). Internal email: internalDescription (supplier data too).
export function lineListHtml(lines, internal = false) {
  return lines.map(l =>
    `<li>${esc(internal ? (l.internalDescription || l.description) : l.description)}` +
    `, qty ${esc(l.qty)}` +
    (l.width ? `, ${esc(l.width)}"W × ${esc(l.length)}"H` : '') +
    (l.mechName ? `, ${esc(l.mechName)}` : '') +
    (l.roomLabel ? `, room: ${esc(l.roomLabel)}` : '') +
    `</li>`
  ).join('');
}

// ── catalog lookup ────────────────────────────────────────────────────────────
// The browser sends what the customer saw, but supplier codes and names in our own email and spreadsheet come from the
// catalog in Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, server side only). If the lookup fails for any reason,
// or a swatch is not found, that part of the order falls back to the payload, so an order always arrives.

const LOOKUP_TIMEOUT_MS = 4000;

export async function lookupSwatches(ids, env = process.env) {
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || ids.length === 0) return null;
  const list = ids.map(id => `"${String(id).replace(/"/g, '')}"`).join(',');
  // A swatch can also be linked into other lines (migration 9) under another display name and collection; the pick's
  // fabricId says which placement the customer chose. The plain select is the fallback if the links table is not there yet.
  const selects = [
    'id,fabric_id,product_line,family,display_name,supplier_code,supplier_color_name,styles,fabrics:fabrics!fabric_id(collection_name),swatch_links(fabric_id,family,display_name,fabrics(collection_name,product_line,family))',
    'id,product_line,family,display_name,supplier_code,supplier_color_name,styles,fabrics(collection_name)',
  ];
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), LOOKUP_TIMEOUT_MS);
  try {
    let res;
    for (const select of selects) {
      res = await fetch(`${url}/rest/v1/swatches?select=${encodeURIComponent(select)}&id=in.(${encodeURIComponent(list)})`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: ctl.signal,
      });
      if (res.ok) break;
    }
    if (!res.ok) throw new Error(`catalog lookup failed (${res.status})`);
    return new Map((await res.json()).map(r => [r.id, r]));
  } finally { clearTimeout(timer); }
}

// One order line, with every pick it can find in the catalog replaced by the catalog's values, and the text built
// from the picks rebuilt with the same code the browser uses. Returns the line unchanged when there is nothing to do.
export function applyCatalog(line, rows) {
  const picks = line?.selection?.picks;
  if (!rows || !Array.isArray(picks) || picks.length === 0 || !line.productName) return { line, found: 0, total: picks?.length || 0, diffs: [] };
  const diffs = [];
  let found = 0;
  const fresh = picks.map(p => {
    const r = rows.get(p.swatchId);
    if (!r) return p;
    // the placement the customer picked: the swatch's own, or one linked into another line
    const link = p.fabricId && r.fabric_id && p.fabricId !== r.fabric_id ? (r.swatch_links || []).find(l => l.fabric_id === p.fabricId) : null;
    const styleCode = p.style ? (r.styles || []).find(st => st.style === p.style)?.code : null;
    const next = {
      ...p,
      line: link ? link.fabrics?.product_line ?? p.line : r.product_line,
      family: (link ? link.family || link.fabrics?.family : r.family) || null,
      fabric: (link ? link.fabrics?.collection_name : r.fabrics?.collection_name) ?? p.fabric,
      colorName: r.supplier_color_name ?? null,
      displayName: link ? link.display_name : r.display_name,
      code: styleCode || (p.style ? p.code : r.supplier_code),
    };
    found++;
    for (const k of ['code', 'displayName', 'colorName', 'fabric']) {
      if ((p[k] ?? null) !== (next[k] ?? null)) diffs.push(`${p.swatchId}.${k}: sent ${JSON.stringify(p[k] ?? null)}, catalog ${JSON.stringify(next[k] ?? null)}`);
    }
    return next;
  });
  if (found === 0) return { line, found, total: picks.length, diffs };
  const selection = { ...line.selection, picks: fresh };
  const item = { product: { name: line.productName }, selection };
  const sum = summarize(item);
  return {
    found, total: picks.length, diffs,
    line: {
      ...line,
      selection,
      code: sum.codes.length ? sum.codes.join(', ') : (line.code || null),
      codes: sum.codes,
      colorName: sum.colorText || line.colorName,
      description: describeItem(item),
      internalDescription: describeInternal(item),
      internalPicks: fresh.map(p => ({ line: p.line, role: p.role, code: p.code, displayName: displayNameOf(p), supplierColor: p.colorName ?? null, collection: p.fabric, style: p.style })),
      details: sum.parts,
    },
  };
}

// Never throws: any failure returns the lines exactly as they were sent.
export async function withCatalog(lines, env = process.env) {
  try {
    const ids = [...new Set(lines.flatMap(l => (l?.selection?.picks || []).map(p => p.swatchId)).filter(Boolean))];
    if (ids.length === 0) return { lines, source: 'payload (no swatches in the order)' };
    const rows = await lookupSwatches(ids, env);
    if (!rows) return { lines, source: 'payload (catalog lookup not configured)' };
    const out = lines.map(l => applyCatalog(l, rows));
    const missing = out.reduce((n, r) => n + (r.total - r.found), 0);
    for (const r of out) for (const d of r.diffs) console.warn('[api/quote] payload differs from the catalog:', d);
    if (missing) console.warn(`[api/quote] ${missing} picked swatch(es) not found in the catalog; payload values used for them`);
    return { lines: out.map(r => r.line), source: missing ? `catalog (${missing} not found, payload used)` : 'catalog' };
  } catch (err) {
    console.error('[api/quote] catalog lookup failed, using the order as sent:', err?.message || err);
    return { lines, source: 'payload (catalog lookup failed)' };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customer, lines: sentLines, notes } = req.body || {};

  if (!customer?.email) {
    return res.status(400).json({ error: 'customer.email is required' });
  }
  if (!Array.isArray(sentLines) || sentLines.length === 0) {
    return res.status(400).json({ error: 'At least one line item is required' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured (RESEND_API_KEY missing)' });
  }

  try {
    const { lines, source } = await withCatalog(sentLines);
    console.log(`[api/quote] ${lines.length} line(s), supplier data from ${source}`);
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
        <ul>${lineListHtml(lines, true)}</ul>
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
