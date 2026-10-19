// The order page (Stage 2): every window with its estimate, Edit and Remove, the estimated total, your details, Send my order,
// and the confirmation screen. It replaces the old Order Summary and Review pages.
import { useEffect, useState } from 'react';
import { MOUNTS, getMechanism } from './data/lines.js';
import { summarize, describeItem, describeInternal, displayNameOf } from './lib/selection.js';
import { useItemPrices, totalsOf } from './lib/itemPrice.js';
import { formatInches, FRACTIONS } from './lib/inches.js';
import { profileOf } from './lib/profile.js';
import { SizeFields, QtyField, priceLine, CUSTOM_TEXT, REQUEST_TEXT, ESTIMATE_TEXT } from './components/s2.jsx';
import SitePhoto from './components/SitePhoto.jsx';
import { Footer } from './customer.jsx';

const money = (n) => `$${Number(n).toLocaleString('en-US')}`;

// The room photo that goes with a window in the order (same photos as the product pages).
export function photoFor(it) {
  const p0 = it.selection?.picks?.[0];
  switch (it.product.id) {
    case 'roller': return { name: ['solar', 'screen-view', 'blackout'].includes(p0?.family) ? p0.family : 'solar', alt: 'Roller shade' };
    case 'zebra': return { name: 'zebra-dining', alt: 'Zebra shade' };
    case 'shangri-la': return { name: 'shangri-la', alt: 'Shangri-La shade' };
    case 'roman': return { name: 'roman', alt: 'Roman shade' };
    case 'cellular': return { name: it.selection?.type === 'top-down-bottom-up' ? 'cellular-tdbu' : 'cellular', alt: 'Cellular shade' };
    default: return { name: it.selection?.section === 'dream-curtains' ? 'dream-curtains' : 'drapery', alt: 'Drapery' };
  }
}

// "Solar · Linen (SL-102) · 40" wide × 64" high · Inside mount · Cordless · Fabric-wrapped cassette"
function detailsOf(it) {
  const sum = summarize(it);
  const mech = getMechanism(it.product, it.mech)?.name || it.mech;
  const mount = it.product.mounts.length > 1 ? (MOUNTS.find((m) => m.id === it.mount)?.name || it.mount) : null;
  const size = it.width ? `${formatInches(it.width)}" wide × ${formatInches(it.length || it.height)}" high` : null;
  return { title: sum.title, parts: [...sum.parts, size, mount, mech].filter(Boolean) };
}

const toSize = (it) => {
  const split = (v) => { const n = parseFloat(v) || 0; const w = Math.floor(n); const f = FRACTIONS.find(([d]) => Math.abs(parseFloat(d) - (n - w)) < 0.001); return [n ? String(w) : '', f ? f[0] : '0']; };
  const [w, wf] = split(it.width); const [h, hf] = split(it.length || it.height);
  return { w, wf, h, hf };
};
const fromSize = (s) => {
  const num = (a, f) => (a === '' ? null : (parseFloat(a) || 0) + (parseFloat(f) || 0) || null);
  return { width: num(s.w, s.wf), length: num(s.h, s.hf) };
};

function PriceCell({ it, p }) {
  const q = Math.max(1, it.qty || 1);
  if (p.kind === 'price') {
    return (
      <div className="s2-item-price">
        <div className="s2-item-amount">{money(p.price * q)}</div>
        {q > 1 && <div className="s2-item-each">{money(p.price)} each · {q} blinds</div>}
      </div>
    );
  }
  if (p.kind === 'loading') return <div className="s2-item-price"><div className="s2-item-each">Calculating…</div></div>;
  return <div className="s2-item-price"><div className="s2-item-amount s2-item-onreq">{p.kind === 'custom' ? 'Price by email' : 'Price on request'}</div>{q > 1 && <div className="s2-item-each">{q} blinds</div>}</div>;
}

function EditPanel({ it, idx, updateItem, onDone }) {
  const [size, setSize] = useState(() => toSize(it));
  const mechs = it.product.mechanisms;
  const cover = it.selection?.cover;
  const hasCover = it.product.id === 'roller' || it.product.id === 'zebra';
  const applySize = (s) => { setSize(s); updateItem(idx, fromSize(s)); };
  const idp = `ed${idx}`;
  return (
    <div className="s2-edit" role="group" aria-label="Edit this blind">
      <SizeFields idp={idp} size={size} onChange={applySize} />
      <div className="s2-edit-row">
        {it.product.mounts.length > 1 && (
          <label className="s2-field"><span className="s2-label">Mount</span>
            <select className="s2-input" value={it.mount} onChange={(e) => updateItem(idx, { mount: e.target.value })}>
              {it.product.mounts.map((id) => <option key={id} value={id}>{MOUNTS.find((m) => m.id === id)?.name}</option>)}
            </select>
          </label>
        )}
        <label className="s2-field"><span className="s2-label">Control</span>
          <select className="s2-input" value={it.mech} onChange={(e) => updateItem(idx, { mech: e.target.value })}>
            {!mechs.some((m) => m.id === it.mech) && <option value={it.mech}>{it.mech}</option>}
            {mechs.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        {hasCover && cover && (
          <label className="s2-field"><span className="s2-label">Top cover</span>
            <select className="s2-input" value={cover} onChange={(e) => updateItem(idx, { selection: { ...it.selection, cover: e.target.value } })}>
              <option value="wrapped">Fabric-wrapped cassette</option>
              <option value="none">No fabric wrap</option>
            </select>
          </label>
        )}
        <label className="s2-field"><span className="s2-label">Room</span>
          <input className="s2-input" type="text" value={it.roomLabel || ''} onChange={(e) => updateItem(idx, { roomLabel: e.target.value })} placeholder="e.g. Primary bedroom" />
        </label>
      </div>
      <QtyField id={`${idp}-qty`} qty={String(it.qty || 1)} onChange={(v) => updateItem(idx, { qty: Math.max(1, parseInt(v, 10) || 1) })} />
      <p className="s2-step-hint">To change the color or style, remove this blind and add it again.</p>
      <button type="button" className="s2-btn s2-btn-brass s2-edit-done" onClick={onDone}>Done</button>
    </div>
  );
}

function ItemCard({ it, idx, p, editing, setEditing, updateItem, removeFromQuote }) {
  const d = detailsOf(it);
  const ph = photoFor(it);
  return (
    <li className="s2-item">
      <div className="s2-item-main">
        <SitePhoto name={ph.name} alt="" sizes="96px" className="s2-item-photo" />
        <div className="s2-item-body">
          <div className="s2-item-head">
            <div className="s2-item-title">{d.title}</div>
            <PriceCell it={it} p={p} />
          </div>
          {it.roomLabel && <div className="s2-item-room">{it.roomLabel}</div>}
          <div className="s2-item-details">{d.parts.join(' · ')}</div>
          {p.kind === 'request' && <div className="s2-item-note">{REQUEST_TEXT}</div>}
          {p.kind === 'custom' && <div className="s2-item-note">{CUSTOM_TEXT}</div>}
          <div className="s2-item-actions">
            <button type="button" className="s2-link" aria-expanded={editing} onClick={() => setEditing(editing ? null : idx)}>Edit</button>
            <button type="button" className="s2-link" onClick={() => removeFromQuote(idx)}>Remove</button>
          </div>
        </div>
      </div>
      {editing && <EditPanel it={it} idx={idx} updateItem={updateItem} onDone={() => setEditing(null)} />}
    </li>
  );
}

// What the server needs for one window: customer wording, supplier wording for us, and the estimate shown to the customer.
function quoteLine(it, p) {
  const sum = summarize(it);
  return {
    code: sum.codes.length ? sum.codes.join(', ') : (it.code || null),
    codes: sum.codes,
    colorName: sum.colorText || it.colorName || it.variant,
    category: it.category || it.product.id,
    productName: it.product.name,
    section: it.selection?.section || null,
    description: describeItem(it),
    internalDescription: describeInternal(it),
    internalPicks: (it.selection?.picks || []).map((pk) => ({ line: pk.line, role: pk.role, code: pk.code, displayName: displayNameOf(pk), supplierColor: pk.colorName ?? null, collection: pk.fabric, style: pk.style })),
    details: sum.parts,
    selection: it.selection || null,
    mechId: it.mech,
    mechName: getMechanism(it.product, it.mech)?.name || it.mech,
    mountId: it.mount,
    width: it.width || null,
    length: it.length || it.height || null,
    qty: it.qty || 1,
    location: it.location || it.product.location,
    roomLabel: it.roomLabel || '',
    estimate: { kind: p.kind, unit: p.kind === 'price' ? p.price : null },     // what the customer saw; the server works it out again
  };
}

export default function OrderPage({ navigate, quoteItems, removeFromQuote, updateItem, activeOrderId, onOrderSent, onSubmitted, user }) {
  const items = quoteItems;
  const prices = useItemPrices(items);
  const { total, byEmail, loading } = totalsOf(items, prices);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', shipTo: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);                // { copySent } once the order has gone

  // start from the customer's saved profile (only fills fields they have not typed into)
  useEffect(() => {
    const pr = profileOf(user);
    if (!pr) return;
    setForm((f) => ({ ...f, name: f.name || pr.name, email: f.email || pr.email, phone: f.phone || pr.phone, shipTo: f.shipTo || pr.shipTo }));
  }, [user]);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };

  const send = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Please enter your name';
    if (!form.email.trim()) errs.email = 'Please enter your email';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (loading) { setError('One moment, we are still working out your estimates.'); return; }
    setSending(true); setError(null);
    try {
      const res = await fetch('/api/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), shipTo: form.shipTo.trim() },
          lines: items.map((it, i) => quoteLine(it, prices[i])),
          notes: form.notes.trim(),
        }),
      });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || `Server error (${res.status})`); }
      const data = await res.json().catch(() => ({}));
      // keep the estimates with the saved order, then mark it sent
      const withPrices = items.map((it, i) => ({ ...it, price: prices[i].kind === 'price' ? prices[i].price : null, priceKind: prices[i].kind === 'price' ? 'estimate' : 'email' }));
      if (onOrderSent && activeOrderId) onOrderSent(activeOrderId, withPrices);
      onSubmitted?.();
      setSent({ copySent: !!data.customerCopy });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again or call us.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="page-fade s2 s2-order">
        <section className="s2-wrap s2-sent">
          <div className="s2-sent-mark" aria-hidden="true">✓</div>
          <h1 className="s2-order-title">Your order is on its way to us</h1>
          <p className="s2-order-sub">We'll check every detail and email you your final price within 48 hours. Nothing is charged until you approve it.</p>
          {sent.copySent && <p className="s2-order-sub">A copy of your order was sent to your email.</p>}
          <a className="s2-btn s2-btn-brass" href="/" onClick={(e) => { e.preventDefault(); navigate('home'); }}>Back to home</a>
        </section>
        <Footer navigate={navigate} />
      </div>
    );
  }

  return (
    <div className="page-fade s2 s2-order">
      <section className="s2-wrap s2-order-wrap">
        <h1 className="s2-order-title">Your order</h1>
        <p className="s2-order-sub">Check your blinds, add your details, and send. No payment is taken now.</p>

        {items.length === 0 ? (
          <div className="s2-empty-order">
            <p>Your order is empty. Choose a style to get started.</p>
            <a className="s2-btn s2-btn-brass" href="/products" onClick={(e) => { e.preventDefault(); navigate('products'); }}>Choose a style</a>
          </div>
        ) : (
          <>
            <ul className="s2-items">
              {items.map((it, i) => (
                <ItemCard key={i} it={it} idx={i} p={prices[i]} editing={editing === i} setEditing={setEditing} updateItem={updateItem} removeFromQuote={(idx) => { setEditing(null); removeFromQuote(idx); }} />
              ))}
            </ul>
            <a className="s2-add-another" href="/products" onClick={(e) => { e.preventDefault(); navigate('products'); }}>+ Add more blinds</a>

            <section className="s2-total" aria-live="polite">
              {total > 0 || (!loading && byEmail === 0) ? (
                <>
                  <div className="s2-total-row"><span>Estimated total</span><strong>{loading ? '…' : money(total)}</strong></div>
                  {byEmail > 0 && <div className="s2-total-plus">Plus {byEmail} item{byEmail === 1 ? '' : 's'} priced by email</div>}
                  <p className="s2-total-note">{ESTIMATE_TEXT}</p>
                </>
              ) : (
                <>
                  <div className="s2-total-row"><span>Estimated total</span><strong>{loading ? '…' : 'Price by email'}</strong></div>
                  <p className="s2-total-note">{byEmail} item{byEmail === 1 ? '' : 's'} priced by email. {REQUEST_TEXT}</p>
                </>
              )}
            </section>

            <section className="s2-details" aria-labelledby="s2-details-title">
              <h2 id="s2-details-title" className="s2-details-title">Your details</h2>
              <div className="s2-form">
                <div className="s2-field"><label className="s2-label" htmlFor="o-name">Full name</label>
                  <input id="o-name" className="s2-input" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
                  {errors.name && <span className="s2-error" role="alert">{errors.name}</span>}</div>
                <div className="s2-field"><label className="s2-label" htmlFor="o-email">Email</label>
                  <input id="o-email" className="s2-input" type="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
                  {errors.email && <span className="s2-error" role="alert">{errors.email}</span>}</div>
                <div className="s2-field"><label className="s2-label" htmlFor="o-phone">Phone</label>
                  <input id="o-phone" className="s2-input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} /></div>
                <div className="s2-field s2-field-wide"><label className="s2-label" htmlFor="o-ship">Shipping address</label>
                  <input id="o-ship" className="s2-input" autoComplete="street-address" value={form.shipTo} onChange={set('shipTo')} /></div>
                <div className="s2-field s2-field-wide"><label className="s2-label" htmlFor="o-notes">Anything we should know? (optional)</label>
                  <textarea id="o-notes" className="s2-input s2-textarea" rows={3} value={form.notes} onChange={set('notes')} /></div>
              </div>
              {error && <div className="s2-send-error" role="alert">{error}</div>}
              <button type="button" className="s2-btn s2-btn-brass s2-send" disabled={sending} onClick={send}>{sending ? 'Sending…' : 'Send my order'}</button>
              <p className="s2-send-note">We reply within 48 hours. Made-to-measure orders ship in two to three weeks after you approve.</p>
            </section>
          </>
        )}
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}
