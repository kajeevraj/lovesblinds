// The cart page and checkout (Stage 2): every blind with its estimate (click one to change it, − / + for how many), the estimated
// total and a Checkout button. Checkout (/order?checkout=1) shows your details and shipping address and Send my order, then the
// confirmation screen. Once it is sent it is an order.
import { useEffect, useState } from 'react';
import { getMechanism } from './data/lines.js';
import { summarize, describeItem, describeInternal, displayNameOf } from './lib/selection.js';
import { useCart } from './lib/cart.js';
import { money, blinds, photoFor, detailsOf } from './lib/itemView.js';
import { profileOf } from './lib/profile.js';
import { COUNTRIES, DEFAULT_COUNTRY, addressLine } from './data/countries.js';
import { CART_CUSTOM_TEXT, REQUEST_TEXT, ESTIMATE_TEXT, QtyStepper } from './components/s2.jsx';
import { IncompleteRow, UndoBar, roomText, BLOCKED_TEXT } from './components/OrderBar.jsx';
import { SITE } from './data/site.js';
import GoogleSignIn from './components/GoogleSignIn.jsx';
import SitePhoto from './components/SitePhoto.jsx';
import { Footer } from './customer.jsx';

function PriceCell({ it, p }) {
  const q = Math.max(1, it.qty || 1);
  if (p.kind === 'price') {
    return (
      <div className="s2-item-price">
        <div className="s2-item-amount">{money(p.price * q)}</div>
        {q > 1 && <div className="s2-item-each">{money(p.price)} each · {blinds(q)}</div>}
      </div>
    );
  }
  if (p.kind === 'loading') return <div className="s2-item-price"><div className="s2-item-each">Calculating…</div></div>;
  return <div className="s2-item-price"><div className="s2-item-amount s2-item-onreq">Price by email</div>{q > 1 && <div className="s2-item-each">{blinds(q)}</div>}</div>;
}

// The whole card opens the product page with every choice filled in; Remove is the only other control.
function ItemCard({ it, p, cart }) {
  const d = detailsOf(it);
  const ph = photoFor(it);
  const edit = () => cart.goEdit(it);
  return (
    <li className="s2-item" onClick={edit}>
      <div className="s2-item-main">
        <SitePhoto name={ph.name} alt="" sizes="96px" loading="eager" className="s2-item-photo" />
        <div className="s2-item-body">
          <div className="s2-item-head">
            <a className="s2-item-title" href={`/products/${it.product.slug}?edit=${encodeURIComponent(it.id)}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); edit(); }} aria-label={`Change ${d.title}`}>{d.title}</a>
            <PriceCell it={it} p={p} />
          </div>
          {roomText(it) && <div className="s2-item-room">{roomText(it)}</div>}
          <div className="s2-item-details">{d.parts.join(' · ')}</div>
          <div className="s2-item-qty"><QtyStepper value={Math.max(1, it.qty || 1)} name={d.title} onChange={(n) => cart.setQty(it.id, n)} /> <span>{Math.max(1, it.qty || 1) === 1 ? 'blind' : 'blinds'}</span></div>
          {p.kind === 'request' && <div className="s2-item-note">{REQUEST_TEXT}</div>}
          {p.kind === 'custom' && <div className="s2-item-note">{CART_CUSTOM_TEXT}</div>}
          <div className="s2-item-actions">
            <a className="s2-link" href={`/products/${it.product.slug}?edit=${encodeURIComponent(it.id)}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); edit(); }} aria-label={`Edit ${d.title}`}>Edit</a>
            <button type="button" className="s2-link" aria-label={`Duplicate ${d.title}`} onClick={(e) => { e.stopPropagation(); cart.duplicateItem(it); }}>Duplicate</button>
            <button type="button" className="s2-link" onClick={(e) => { e.stopPropagation(); cart.removeItem(it.id); }}>Remove</button>
          </div>
        </div>
      </div>
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
    windowLabel: it.windowLabel || '',
    estimate: { kind: p.kind, unit: p.kind === 'price' ? p.price : null },     // what the customer saw; the server works it out again
  };
}

export default function OrderPage({ navigate, activeOrderId, onOrderSent, onSubmitted, user, search = '' }) {
  const cart = useCart();
  const { items, prices, incomplete } = cart;
  const blocked = incomplete.length > 0;
  // the cart page, or (after Checkout) the details step. Incomplete items keep it on the cart page.
  const checkout = new URLSearchParams(search).get('checkout') === '1' && !blocked && items.length > 0;
  const { total, byEmail, loading } = cart.totals;
  const [form, setForm] = useState({ name: '', email: '', phone: '', street: '', apt: '', city: '', state: '', zip: '', country: DEFAULT_COUNTRY, notes: '', zx_kv_q7: '' });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);                // { copySent, lines, total, byEmail } once the order has gone
  const [showItems, setShowItems] = useState(false);     // "See items" in the checkout summary

  // start from the customer's saved profile (only fills fields they have not typed into)
  useEffect(() => {
    const pr = profileOf(user);
    if (!pr) return;
    const a = pr.address;
    setForm((f) => ({ ...f, name: f.name || pr.name, email: f.email || pr.email, phone: f.phone || pr.phone, street: f.street || a.street, apt: f.apt || a.apt, city: f.city || a.city, state: f.state || a.state, zip: f.zip || a.zip, country: f.country === DEFAULT_COUNTRY ? a.country : f.country }));
  }, [user]);
  useEffect(() => { if (checkout) window.scrollTo({ top: 0, behavior: 'instant' }); }, [checkout]);
  useEffect(() => { if (sent) window.scrollTo({ top: 0, behavior: 'instant' }); }, [sent]);
  const fixCount = Object.values(errors).filter(Boolean).length;
  const NETWORK_TEXT = `We could not reach our server. Please check your connection, or email us at ${SITE.email} or call ${SITE.phone}.`;
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };

  const send = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Please enter your name';
    if (!form.email.trim()) errs.email = 'Please enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email';
    if (!form.street.trim()) errs.street = 'Please enter your street address';
    if (!form.city.trim()) errs.city = 'Please enter your city';
    if (!form.state.trim()) errs.state = 'Please enter your state or province';
    if (!form.zip.trim()) errs.zip = 'Please enter your ZIP or postal code';
    setErrors(errs);
    const first = ['name', 'email', 'street', 'city', 'state', 'zip'].find((k) => errs[k]);
    if (first) {                                   // take them to the first thing to fix
      setTimeout(() => { const el = document.getElementById(`o-${first}`); if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); } }, 0);
      return;
    }
    if (blocked) { setError(BLOCKED_TEXT); return; }
    if (loading) { setError('One moment, we are still working out your estimates.'); return; }
    const address = { street: form.street.trim(), apt: form.apt.trim(), city: form.city.trim(), state: form.state.trim(), zip: form.zip.trim(), country: form.country };
    setSending(true); setError(null);
    try {
      const res = await fetch('/api/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), address, shipTo: addressLine(address) },
          lines: items.map((it, i) => quoteLine(it, prices[i])),
          notes: form.notes.trim(),
          zx_kv_q7: form.zx_kv_q7,
        }),
      }).catch(() => null);
      if (!res) throw new Error(NETWORK_TEXT);                   // offline or the connection dropped: our own plain message
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || `Server error (${res.status})`); }
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error('We could not send your order just now. Please email loveblindswindows@gmail.com or call 262-434-0949.');     // never show "sent" unless the server says so
      // keep the estimates with the saved order, then mark it sent
      const withPrices = items.map((it, i) => ({ ...it, price: prices[i].kind === 'price' ? prices[i].price : null, priceKind: prices[i].kind === 'price' ? 'estimate' : 'email' }));
      // it reached us: a problem saving it to the customer's account is only logged and never turns the success into an error
      try { if (onOrderSent && activeOrderId) Promise.resolve(onOrderSent(activeOrderId, withPrices, { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), address, notes: form.notes.trim() })).catch((e) => console.error('[order] not saved to the account:', e)); onSubmitted?.(); }
      catch (e) { console.error('[order] not saved to the account:', e); }
      setSent({ copySent: !!data.customerCopy, total, byEmail, lines: items.map((it, i) => ({ id: it.id, title: detailsOf(it).title, room: roomText(it), qty: Math.max(1, it.qty || 1), p: prices[i] })) });
    } catch (err) {
      setError(err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(err?.message || '') ? NETWORK_TEXT : (err.message || `Something went wrong. Please try again, or email us at ${SITE.email} or call ${SITE.phone}.`));
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
          <section className="s2-sent-list" aria-label="What you sent">
            <h2 className="s2-sent-list-title">What you sent</h2>
            <ul>
              {sent.lines.map((l) => (
                <li key={l.id}>
                  <span className="s2-sent-name">{l.title}{l.room ? ` · ${l.room}` : ''}</span>
                  <span className="s2-sent-qty">{blinds(l.qty)}</span>
                  <span className="s2-sent-price">{l.p.kind === 'price' ? money(l.p.price * l.qty) : 'Price by email'}</span>
                </li>
              ))}
            </ul>
            <div className="s2-total-row"><span>Estimated total</span><strong>{sent.total > 0 ? money(sent.total) : 'Price by email'}</strong></div>
            {sent.byEmail > 0 && sent.total > 0 && <div className="s2-total-plus">Plus {sent.byEmail} item{sent.byEmail === 1 ? '' : 's'} priced by email</div>}
          </section>
          <a className="s2-btn s2-btn-brass" href="/" onClick={(e) => { e.preventDefault(); navigate('home'); }}>Back to home</a>
        </section>
        <Footer navigate={navigate} />
      </div>
    );
  }

  return (
    <div className="page-fade s2 s2-order">
      <section className="s2-wrap s2-order-wrap">
        <h1 className="s2-order-title">{checkout ? 'Checkout' : 'Your cart'}</h1>
        <p className="s2-order-sub">{checkout ? 'Add your details and send. No payment is taken now.' : 'Check your blinds, then check out. No payment is taken now.'}</p>
        {!checkout && cart.notice && <div className="s2-saved" role="status" key={cart.notice.n}><span aria-hidden="true">✓</span> {cart.notice.msg}</div>}
        {!checkout && <UndoBar />}
        {checkout && (
          <div className="s2-co-summary">
            <span><strong>{blinds(items.reduce((n, it) => n + Math.max(1, it.qty || 1), 0))}</strong> · {loading ? '…' : total > 0 ? money(total) : 'Price by email'}{total > 0 && byEmail > 0 ? ` + ${byEmail} by email` : ''}</span>
            <button type="button" className="s2-link" aria-expanded={showItems} onClick={() => setShowItems((v) => !v)}>{showItems ? 'Hide items' : 'See items'}</button>
          </div>
        )}

        {items.length === 0 && incomplete.length === 0 ? (
          <div className="s2-empty-order">
            <p>Your cart is empty. Choose a style to get started.</p>
            <a className="s2-btn s2-btn-brass" href="/products" onClick={(e) => { e.preventDefault(); navigate('products'); }}>Choose a style</a>
          </div>
        ) : (
          <>
            {incomplete.length > 0 && (
              <ul className="s2-items s2-items-incomplete" aria-label="Incomplete items">
                {incomplete.map((e) => <IncompleteRow key={e.key} entry={e} cart={cart} />)}
              </ul>
            )}
            {(!checkout || showItems) && (
              <ul className="s2-items">
                {items.map((it, i) => (
                  <ItemCard key={it.id} it={it} p={prices[i]} cart={cart} />
                ))}
              </ul>
            )}
            {!checkout && <a className="s2-add-another" href="/products" onClick={(e) => { e.preventDefault(); navigate('products'); }}>+ Add more blinds</a>}

            {items.length > 0 && !checkout && (
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
            )}

            {!checkout && (
              <div className="s2-cart-actions">
                {blocked && <p className="s2-blocked" role="status">{BLOCKED_TEXT}</p>}
                <button type="button" className="s2-btn s2-btn-brass s2-send" disabled={blocked || items.length === 0} onClick={() => navigate('/order?checkout=1')}>Checkout</button>
              </div>
            )}

            {checkout && (
            <section className="s2-details" aria-labelledby="s2-details-title">
              <h2 id="s2-details-title" className="s2-details-title">Your details</h2>
              {cart.auth.supabaseEnabled && (user
                ? <p className="s2-details-who">Signed in as <strong>{user.email}</strong>. We filled in what we know. You can change anything.</p>
                : <div className="s2-details-signin">
                    <p>Sign in with Google to fill in your name, email and saved details.</p>
                    <GoogleSignIn wide text="continue_with" label="Continue with Google" gis onFallback={cart.auth.signIn} disabled={cart.auth.authLoading} />
                  </div>)}
              <div className="s2-form">
                <div className="s2-field"><label className="s2-label" htmlFor="o-name">Full name</label>
                  <input id="o-name" className="s2-input" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
                  {errors.name && <span className="s2-error" role="alert">{errors.name}</span>}</div>
                <div className="s2-field"><label className="s2-label" htmlFor="o-email">Email</label>
                  <input id="o-email" className="s2-input" type="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
                  {errors.email && <span className="s2-error" role="alert">{errors.email}</span>}</div>
                <div className="s2-field"><label className="s2-label" htmlFor="o-phone">Phone</label>
                  <input id="o-phone" className="s2-input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} /></div>
                <div className="s2-field s2-field-wide"><label className="s2-label" htmlFor="o-street">Street address</label>
                  <input id="o-street" className="s2-input" autoComplete="address-line1" value={form.street} onChange={set('street')} aria-invalid={!!errors.street} />
                  {errors.street && <span className="s2-error" role="alert">{errors.street}</span>}</div>
                <div className="s2-field s2-field-wide"><label className="s2-label" htmlFor="o-apt">Apartment, suite, etc. (optional)</label>
                  <input id="o-apt" className="s2-input" autoComplete="address-line2" value={form.apt} onChange={set('apt')} /></div>
                <div className="s2-field"><label className="s2-label" htmlFor="o-city">City</label>
                  <input id="o-city" className="s2-input" autoComplete="address-level2" value={form.city} onChange={set('city')} aria-invalid={!!errors.city} />
                  {errors.city && <span className="s2-error" role="alert">{errors.city}</span>}</div>
                <div className="s2-field"><label className="s2-label" htmlFor="o-state">State / province</label>
                  <input id="o-state" className="s2-input" autoComplete="address-level1" value={form.state} onChange={set('state')} aria-invalid={!!errors.state} />
                  {errors.state && <span className="s2-error" role="alert">{errors.state}</span>}</div>
                <div className="s2-field"><label className="s2-label" htmlFor="o-zip">ZIP / postal code</label>
                  <input id="o-zip" className="s2-input" autoComplete="postal-code" value={form.zip} onChange={set('zip')} aria-invalid={!!errors.zip} />
                  {errors.zip && <span className="s2-error" role="alert">{errors.zip}</span>}</div>
                <div className="s2-field"><label className="s2-label" htmlFor="o-country">Country</label>
                  <select id="o-country" className="s2-input" autoComplete="country-name" value={form.country} onChange={set('country')}>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select></div>
                <div className="s2-field s2-field-wide"><label className="s2-label" htmlFor="o-notes">Anything we should know? (optional)</label>
                  <textarea id="o-notes" className="s2-input s2-textarea" rows={3} value={form.notes} onChange={set('notes')} /></div>
              </div>
              {/* a field people never see; a bot that fills it in is ignored */}
              <div className="spam-trap" aria-hidden="true"><label>Leave this empty<input type="text" name="zx_kv_q7" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.zx_kv_q7} onChange={set('zx_kv_q7')} /></label></div>
              {fixCount > 0 && <div className="s2-fix-summary" role="alert">{fixCount} thing{fixCount === 1 ? '' : 's'} to fix</div>}
              {error && <div className="s2-send-error" role="alert">{error}</div>}
              <button type="button" className="s2-btn s2-btn-brass s2-send" disabled={sending} onClick={send}>{sending ? 'Sending…' : 'Send my order'}</button>
              <p className="s2-send-note">We reply within 48 hours. Made-to-measure orders ship in two to three weeks after you approve.</p>
            </section>
            )}
          </>
        )}
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}
