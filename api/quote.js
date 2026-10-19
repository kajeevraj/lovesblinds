import XLSX from 'xlsx';
import { Resend } from 'resend';
import { summarize, describeItem, describeInternal, displayNameOf, DREAM_STYLE_NAMES } from '../src/lib/selectionText.js';
import { priceRequestFromItem } from '../src/lib/priceRequest.js';

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
  return picks.map(p => `${rolePrefix(p, picks.length > 1)}${p.displayName}${p.style ? ` (${DREAM_STYLE_NAMES[p.style] || 'Style'} / Style ${p.style})` : ''}`).join(' / ');
}

// ── estimates ─────────────────────────────────────────────────────────────────
// The browser says what estimate the customer saw, but we work every estimate out again here, with the same database function
// and the same rules the product pages use, so what goes into the emails and the sheet is never just what a browser claimed.
// If the lookup fails, the estimate the customer saw is used and marked as unchecked.

const money = (n) => `$${Number(n).toLocaleString('en-US')}`;
export const EMAIL_PRICE = 'Price sent by email';
export const ESTIMATE_NOTE = "This is an estimate. We'll confirm details and your final price within 48 hours.";

const kindOf = (res) => {
  if (!res || res.error) return 'email';
  if (res.price_on_request) return 'request';
  if (res.price != null) return 'price';
  if (res.custom_size) return 'custom';
  return 'email';
};

export async function estimateLine(line, env = process.env) {
  const sent = line.estimate && line.estimate.kind === 'price' && Number(line.estimate.unit) > 0 ? { kind: 'price', unit: Number(line.estimate.unit) } : { kind: line.estimate?.kind === 'loading' ? 'email' : (line.estimate?.kind || 'email'), unit: null };
  // the same public function the product pages call (it answers only price / custom size / price on request), so the public key is enough
  const url = env.SUPABASE_URL, key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const req = priceRequestFromItem({ id: line.category }, { selection: line.selection, mech: line.mechId, width: line.width, length: line.length });
  if (!req || !url || !key) return { ...sent, checked: false };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/rest/v1/rpc/estimate_price_for_swatch`, {
      method: 'POST', signal: ctl.signal,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_line: req.line, p_swatch_id: req.swatchId, p_options: req.options, p_width: req.width, p_height: req.height }),
    });
    if (!res.ok) throw new Error(`estimate lookup failed (${res.status})`);
    const r = await res.json();
    const kind = kindOf(r);
    return { kind, unit: kind === 'price' ? r.price : null, checked: true, browserUnit: sent.unit };
  } catch (err) {
    console.error('[api/quote] estimate lookup failed, using what the customer saw:', err?.message || err);
    return { ...sent, checked: false };
  } finally { clearTimeout(timer); }
}

// Returns the lines with `.price = { kind, unit, checked }` and the totals.
export async function withEstimates(lines, env = process.env) {
  const priced = await Promise.all(lines.map(async (l) => ({ ...l, price: await estimateLine(l, env) })));
  let total = 0, byEmail = 0;
  for (const l of priced) {
    if (l.price.kind === 'price') total += l.price.unit * Math.max(1, Number(l.qty) || 1);
    else byEmail += 1;
  }
  return { lines: priced, total, byEmail };
}

// "$226 each · $678 for 3", "$226", or "Price sent by email"
export function priceText(l) {
  const q = Math.max(1, Number(l.qty) || 1);
  if (l.price?.kind !== 'price') return EMAIL_PRICE;
  return q > 1 ? `${money(l.price.unit)} each · ${money(l.price.unit * q)} for ${q}` : money(l.price.unit);
}
export const totalText = (t) => (t.total > 0 ? money(t.total) : EMAIL_PRICE);

// ── xlsx ─────────────────────────────────────────────────────────────────────

export function buildWorkbook(customer, lines, notes, totals = null) {
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
      line.price?.kind === 'price' ? line.price.unit : (line.price ? EMAIL_PRICE : ''),                       // Price per unit: the estimate the customer saw
      line.price?.kind === 'price' ? line.price.unit * Math.max(1, Number(line.qty) || 1) : '',               // Total for the quantity
      codeCell(line),
      nameCell(line),
    ]);
  }

  rows.push([]); // blank before totals

  // Totals block
  rows.push(['Subtotal (estimate)', '', '', '', '', '', '', '', totals && totals.total > 0 ? totals.total : '']);
  if (totals && totals.byEmail > 0) rows.push([`Plus ${totals.byEmail} item${totals.byEmail === 1 ? '' : 's'} priced by email`]);
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

const sizeText = (l) => (l.width ? `${esc(l.width)}"W × ${esc(l.length)}"H` : '');

// Customer email: description (display name + code). Internal email: internalDescription (supplier data too).
// Each item ends with its estimate for one window and the total for all of them.
export function lineListHtml(lines, internal = false) {
  return lines.map(l => {
    const q = Math.max(1, Number(l.qty) || 1);
    const unchecked = internal && l.price && !l.price.checked && l.price.kind === 'price' ? ' (estimate as shown in the browser; could not be re-checked)' : '';
    const differs = internal && l.price?.checked && l.price.browserUnit && l.price.kind === 'price' && l.price.browserUnit !== l.price.unit ? ` (customer's browser showed ${esc(money(l.price.browserUnit))})` : '';
    return `<li>${esc(internal ? (l.internalDescription || l.description) : l.description)}` +
      `, qty ${esc(q)}` +
      (l.width ? `, ${sizeText(l)}` : '') +
      (l.mechName ? `, ${esc(l.mechName)}` : '') +
      (l.roomLabel ? `, room: ${esc(l.roomLabel)}` : '') +
      (l.price ? ` &mdash; <strong>${esc(priceText(l))}</strong>${esc(unchecked)}${esc(differs)}` : '') +
      `</li>`;
  }).join('');
}

function totalsHtml(totals, withNote) {
  if (!totals) return '';
  return `<p style="margin:12px 0 0"><strong>Estimated total: ${esc(totalText(totals))}</strong>` +
    (totals.total > 0 && totals.byEmail > 0 ? `<br>Plus ${totals.byEmail} item${totals.byEmail === 1 ? '' : 's'} priced by email` : '') +
    `</p>` + (withNote ? `<p style="color:#4a423a">${esc(ESTIMATE_NOTE)}</p>` : '');
}

export function internalEmailHtml(customer, lines, notes, totals) {
  return `
        <h2 style="font-family:Georgia,serif;color:#2c2c2a">New Quote Request</h2>
        <p>
          <strong>Name:</strong> ${esc(customer.name)}<br>
          <strong>Email:</strong> ${esc(customer.email)}<br>
          ${customer.phone       ? `<strong>Phone:</strong> ${esc(customer.phone)}<br>` : ''}
          ${customer.shipTo      ? `<strong>Ship to:</strong> ${esc(customer.shipTo)}<br>` : ''}
          ${customer.callTime    ? `<strong>Best time to call:</strong> ${esc(customer.callTime)}<br>` : ''}
          ${customer.measureMethod ? `<strong>Measurement:</strong> ${esc(customer.measureMethod)}` : ''}
        </p>
        <h3 style="font-family:Georgia,serif;color:#2c2c2a">Items (${lines.length})</h3>
        <ul>${lineListHtml(lines, true)}</ul>
        ${totalsHtml(totals, false)}
        ${notes ? `<p><strong>Notes:</strong> ${esc(notes)}</p>` : ''}
        <p style="color:#666;font-size:13px">Full order sheet attached as Excel. Estimates are what the customer was shown, worked out again on our server.</p>
      `;
}

export function customerEmailHtml(customer, lines, notes, totals) {
  return `
          <h2 style="font-family:Georgia,serif;color:#2c2c2a">Thanks, ${esc(customer.name)}!</h2>
          <p>We've received your quote request and will send a written proposal to
          <strong>${esc(customer.email)}</strong> within 48 hours.</p>
          <h3 style="font-family:Georgia,serif;color:#2c2c2a">What you requested</h3>
          <ul>${lineListHtml(lines)}</ul>
          ${totalsHtml(totals, true)}
          ${notes ? `<p><strong>Notes:</strong> ${esc(notes)}</p>` : ''}
          <p>Questions in the meantime? Call us at ${BUSINESS_PHONE} or reply to this email.</p>
          <p style="color:#888;font-size:12px">${BUSINESS_NAME}</p>
        `;
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
  // A color can be in several lines (migration 9/10): same name and code everywhere, one price group per line. The `!fabric_id`
  // hint keeps PostgREST from reading the two paths between swatches and fabrics as one ambiguous relationship.
  const select = 'id,product_line,family,display_name,supplier_code,supplier_color_name,styles,fabrics:fabrics!fabric_id(collection_name),swatch_links(product_line,family,fabrics(collection_name))';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/rest/v1/swatches?select=${encodeURIComponent(select)}&id=in.(${encodeURIComponent(list)})`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`catalog lookup failed (${res.status})`);
    return new Map((await res.json()).map(r => [r.id, r]));
  } finally { clearTimeout(timer); }
}

// The price group (supplier collection) and family a pick sits in: the color's own line, or the line it is linked into.
const placementOf = (r, line) => {
  const link = line && line !== r.product_line ? (r.swatch_links || []).find(l => l.product_line === line) : null;
  return link
    ? { line: link.product_line, family: link.family || null, group: link.fabrics?.collection_name }
    : { line: r.product_line, family: r.family || null, group: r.fabrics?.collection_name };
};

// One order line, with every pick it can find in the catalog replaced by the catalog's values, and the text built
// from the picks rebuilt with the same code the browser uses. Returns the line unchanged when there is nothing to do.
// Supplier data (price group, supplier color name) goes to the internal email and spreadsheet only: it is never put back
// into `selection`, which is customer-visible.
export function applyCatalog(line, rows) {
  const picks = line?.selection?.picks;
  if (!rows || !Array.isArray(picks) || picks.length === 0 || !line.productName) return { line, found: 0, total: picks?.length || 0, diffs: [] };
  const diffs = [];
  let found = 0;
  const pub = [];        // customer-safe picks
  const internal = [];   // the same picks with the supplier's price group and color name
  for (const p of picks) {
    const r = rows.get(p.swatchId);
    if (!r) { pub.push(p); internal.push(p); continue; }
    const where = placementOf(r, p.line);
    const styleCode = p.style ? (r.styles || []).find(st => st.style === p.style)?.code : null;
    const next = {
      ...p,
      line: where.line,
      family: where.family,
      displayName: r.display_name,
      code: styleCode || (p.style ? p.code : r.supplier_code),
    };
    found++;
    for (const k of ['code', 'displayName']) {
      if ((p[k] ?? null) !== (next[k] ?? null)) diffs.push(`${p.swatchId}.${k}: sent ${JSON.stringify(p[k] ?? null)}, catalog ${JSON.stringify(next[k] ?? null)}`);
    }
    pub.push(next);
    internal.push({ ...next, fabric: where.group ?? p.fabric, colorName: r.supplier_color_name ?? null });
  }
  if (found === 0) return { line, found, total: picks.length, diffs };
  const selection = { ...line.selection, picks: pub };
  const item = { product: { name: line.productName }, selection };
  const internalItem = { product: { name: line.productName }, selection: { ...line.selection, picks: internal } };
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
      internalDescription: describeInternal(internalItem),
      internalPicks: internal.map(p => ({ line: p.line, role: p.role, code: p.code, displayName: displayNameOf(p), supplierColor: p.colorName ?? null, collection: p.fabric ?? null, style: p.style })),
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
    const { lines: catalogLines, source } = await withCatalog(sentLines);
    const { lines, total, byEmail } = await withEstimates(catalogLines);
    const totals = { total, byEmail };
    console.log(`[api/quote] ${lines.length} line(s), supplier data from ${source}, estimates ${lines.map(l => l.price.checked ? 'checked' : 'unchecked').join('/')}`);
    const wb = buildWorkbook(customer, lines, notes || '', totals);
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const date = new Date().toISOString().slice(0, 10);
    const safeName = String(customer.name || 'customer').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const filename = `quote-${safeName}-${date}.xlsx`;

    // Internal email: xlsx attached, supplier price groups, color names and codes
    await resend.emails.send({
      from: "Love's Blinds <quotes@lovesblinds.com>",
      to: INTERNAL_TO,
      subject: `New quote request — ${customer.name}`,
      html: internalEmailHtml(customer, lines, notes, totals),
      attachments: [{ filename, content: xlsxBuffer }],
    });

    // Customer confirmation: no xlsx, no supplier data, gated behind an env var
    const customerCopy = process.env.SEND_CUSTOMER_CONFIRMATION === 'true';
    if (customerCopy) {
      await resend.emails.send({
        from: "Love's Blinds <quotes@lovesblinds.com>",
        to: customer.email,
        subject: "Your quote request — Love's Blinds",
        html: customerEmailHtml(customer, lines, notes, totals),
      });
    }

    return res.status(200).json({ ok: true, customerCopy });
  } catch (err) {
    console.error('[api/quote]', err);
    return res.status(500).json({
      error: err.message || 'Failed to send quote. Please try again or call us directly.',
    });
  }
}
