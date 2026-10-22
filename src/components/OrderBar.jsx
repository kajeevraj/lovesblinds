// The cart bar: sticky at the bottom of the customer pages. On a product page its left side is the item being built
// (its total, "$139 each · 3 blinds", and Add to cart or Save changes) and its right side is the cart so far; elsewhere it is
// only the cart part. The cart part opens a panel (a bottom sheet on phones, a side panel on desktop) listing every item.
import { useEffect, useRef } from 'react';
import { useCart } from '../lib/cart.js';
import { money, blinds, photoFor, detailsOf } from '../lib/itemView.js';
import { CartIcon } from '../icons.jsx';
import { QtyStepper } from './s2.jsx';
import GoogleSignIn from './GoogleSignIn.jsx';
import SitePhoto from './SitePhoto.jsx';

export const INCOMPLETE_TEXT = 'Incomplete: finish choosing';
export const BLOCKED_TEXT = 'Finish choosing or remove the incomplete items to check out.';

export const orderSummaryText = (cart) => {
  const n = cart.count;
  if (!n) return 'Your cart is empty';
  const t = cart.totals;
  return `Your cart: ${n} item${n === 1 ? '' : 's'} · ${cart.items.length === 0 ? 'Not finished yet' : t.loading ? '…' : t.total > 0 ? money(t.total) : 'Price by email'}`;
};

// "Sign in with Google to save your cart", with the button. Only for a signed-out visitor, and only when sign-in exists.
export function SavePrompt({ className = '' }) {
  const { auth } = useCart();
  if (!auth.supabaseEnabled || auth.user) return null;
  return (
    <div className={`s2-save ${className}`}>
      <p className="s2-save-text">Sign in with Google to save your cart</p>
      <GoogleSignIn wide text="signin_with" label="Sign in with Google" gis onFallback={auth.signIn} disabled={auth.authLoading} />
    </div>
  );
}

// One incomplete product page, as a line in the panel and on the cart page.
export function IncompleteRow({ entry, cart, compact = false }) {
  const link = `/products/${entry.product.slug}`;
  return (
    <li className="s2-incomplete" data-incomplete>
      <div className="s2-incomplete-body">
        <span className="s2-incomplete-badge">{INCOMPLETE_TEXT}</span>
        <span className="s2-panel-title">{entry.title}</span>
        {entry.colorText && <span className="s2-panel-line">{entry.colorText}</span>}
        {entry.sizeText && !compact && <span className="s2-panel-line">{entry.sizeText}</span>}
      </div>
      <div className="s2-panel-actions">
        <a className="s2-link" href={link} onClick={(e) => { e.preventDefault(); cart.goIncomplete(entry); }}>Finish choosing</a>
        <button type="button" className="s2-link" aria-label={`Remove ${entry.title}`} onClick={() => cart.removeIncomplete(entry)}>Remove</button>
      </div>
    </li>
  );
}

// The right-hand part of the bar. On a phone it is a small button with the item count.
export function OrderButton({ compact = false }) {
  const cart = useCart();
  const n = cart.count;
  const label = orderSummaryText(cart);
  return (
    <button type="button" className={`s2-bar-order${compact ? ' is-only' : ''}`} aria-haspopup="dialog" aria-label={`${label}. Open your cart`} onClick={() => cart.setPanelOpen(true)}>
      <span className="s2-bar-order-icon"><CartIcon />{n > 0 && <span className="s2-bar-count">{n}</span>}</span>
      <span className="s2-bar-order-text">{label}</span>
      <span className="s2-bar-order-arrow" aria-hidden="true">›</span>
    </button>
  );
}

// Only the cart part: home, products list, measuring guide and the other customer pages, and only when the cart has items.
export function OrderOnlyBar() {
  const cart = useCart();
  if (!cart.count) return null;
  return (
    <div className="s2-bar s2-bar-only">
      <div className="s2-wrap s2-bar-inner"><OrderButton compact /></div>
      <Flash />
    </div>
  );
}

// The product page bar. `view` is the current estimate (see priceView in s2.jsx).
export function PriceBar({ title, view, needs, canAdd, added, onAdd, qty = 1, editing = false }) {
  const priced = view.kind === 'price';
  let label = title, value = needs, sub = null;
  if (priced) { value = money(view.price * qty); sub = qty > 1 ? `${money(view.price)} each · ${blinds(qty)}` : null; label = null; }
  else if (view.kind === 'custom' || view.kind === 'request' || view.kind === 'error') { label = view.kind === 'request' ? 'Price on request' : 'Custom size'; value = 'Price sent by email'; }
  else if (view.kind === 'loading') { label = 'Your estimate'; value = 'Calculating…'; }
  else if (view.kind === 'toosmall') { label = 'Size too small'; value = 'Enter a larger size'; }
  return (
    <div className="s2-bar">
      <div className="s2-wrap s2-bar-inner">
        <div className="s2-bar-left">
          <div className="s2-bar-text">
            {label && <span className="s2-bar-label">{label}</span>}
            <span className={`s2-bar-value${priced ? '' : ' is-text'}`}>{value}</span>
            {sub && <span className="s2-bar-sub">{sub}</span>}
          </div>
          <button type="button" className="s2-bar-btn" disabled={!canAdd} onClick={onAdd}>{added ? (editing ? 'Saved' : 'Added') : (editing ? 'Save changes' : 'Add to cart')}</button>
        </div>
        <OrderButton />
      </div>
      <Flash />
    </div>
  );
}

// A short message ("Changes saved") for a moment, just above the bar.
export function Flash() {
  const { flash } = useCart();
  if (!flash) return null;
  return <div className="s2-flash" role="status" key={flash.n}>{flash.msg}</div>;
}

export function OrderPanel({ navigate }) {
  const cart = useCart();
  const ref = useRef(null);
  const open = cart.panelOpen;
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;                 // the button that opened the panel
    ref.current?.querySelector('button')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { cart.setPanelOpen(false); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      // keep Tab inside the panel while it is open (the page behind is not reachable)
      const f = [...ref.current.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], at = document.activeElement;
      if (!ref.current.contains(at)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('s2-noscroll');
    return () => {
      document.removeEventListener('keydown', onKey); document.body.classList.remove('s2-noscroll');
      // back to the button that opened it (or the order button, if that one is gone)
      if (prev && document.contains(prev)) prev.focus(); else document.querySelector('.s2-bar-order')?.focus();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const { items, prices, totals, incomplete } = cart;
  const go = (fn) => { cart.setPanelOpen(false); fn(); };
  const blocked = incomplete.length > 0;
  return (
    <div className="s2-panel-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) cart.setPanelOpen(false); }}>
      <aside className="s2-panel" role="dialog" aria-modal="true" aria-label="Your cart" ref={ref}>
        <header className="s2-panel-head">
          <h2>Your cart</h2>
          <button type="button" className="s2-panel-close" aria-label="Close your cart" onClick={() => cart.setPanelOpen(false)}>×</button>
        </header>
        {items.length === 0 && incomplete.length === 0 ? (
          <div className="s2-panel-empty"><p>Your cart is empty. Choose a style to get started.</p></div>
        ) : (
          <ul className="s2-panel-items">
            {incomplete.map((e) => <IncompleteRow key={e.key} entry={e} cart={cart} compact />)}
            {items.map((it, i) => {
              const d = detailsOf(it); const ph = photoFor(it); const p = prices[i]; const q = Math.max(1, it.qty || 1);
              return (
                <li key={it.id} className="s2-panel-item">
                  <a className="s2-panel-main" href={`/products/${it.product.slug}?edit=${encodeURIComponent(it.id)}`} onClick={(e) => { e.preventDefault(); go(() => cart.goEdit(it)); }}>
                    <SitePhoto name={ph.name} alt="" sizes="64px" loading="eager" className="s2-panel-photo" />
                    <span className="s2-panel-body">
                      <span className="s2-panel-title">{d.title}</span>
                      <span className="s2-panel-line">{d.colorText}</span>
                      <span className="s2-panel-line">{[d.parts.find((x) => /wide ×/.test(x)), roomText(it)].filter(Boolean).join(' · ')}</span>
                      <span className="s2-panel-price">{p.kind === 'price' ? <><strong>{money(p.price * q)}</strong>{q > 1 && <small> {money(p.price)} each</small>}</> : p.kind === 'loading' ? 'Calculating…' : 'Price sent by email'}</span>
                    </span>
                  </a>
                  <div className="s2-panel-actions">
                    <QtyStepper value={q} name={d.title} onChange={(n) => cart.setQty(it.id, n)} />
                    <a className="s2-link" href={`/products/${it.product.slug}?edit=${encodeURIComponent(it.id)}`} aria-label={`Edit ${d.title}`} onClick={(e) => { e.preventDefault(); go(() => cart.goEdit(it)); }}>Edit</a>
                    <button type="button" className="s2-link" aria-label={`Duplicate ${d.title}`} onClick={() => go(() => cart.duplicateItem(it))}>Duplicate</button>
                    <button type="button" className="s2-link" aria-label={`Remove ${d.title}`} onClick={() => cart.removeItem(it.id)}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {(items.length > 0 || incomplete.length > 0) && (
          <footer className="s2-panel-foot">
            <SavePrompt />
            {items.length > 0 && (
              <>
                <div className="s2-total-row"><span>Estimated total</span><strong>{totals.loading ? '…' : totals.total > 0 ? money(totals.total) : 'Price by email'}</strong></div>
                {totals.byEmail > 0 && totals.total > 0 && <div className="s2-total-plus">Plus {totals.byEmail} priced by email</div>}
              </>
            )}
            {blocked && <p className="s2-blocked" role="status">{BLOCKED_TEXT}</p>}
            <button type="button" className="s2-btn s2-btn-brass s2-panel-go" disabled={blocked || items.length === 0} onClick={() => go(cart.goCheckout)}>Checkout</button>
          </footer>
        )}
      </aside>
    </div>
  );
}

// The room and window label of a cart line: "Primary bedroom · Left window"
export const roomText = (it) => [it.roomLabel, it.windowLabel].filter(Boolean).join(' · ');

// Right after something is added: a small popup on the page itself, with Checkout and Keep shopping.
export function AddedPopup({ navigate }) {
  const cart = useCart();
  const { added } = cart;
  const ref = useRef(null);
  const open = !!added && !cart.panelOpen;
  useEffect(() => {
    if (!open) return undefined;
    ref.current?.querySelector('[data-checkout]')?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') cart.closeAdded(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, added?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return (
    <div className="s2-added" role="dialog" aria-modal="false" aria-labelledby="s2-added-title" ref={ref} key={added.n}>
      <button type="button" className="s2-added-x" aria-label="Close" onClick={cart.closeAdded}>×</button>
      <div className="s2-added-head"><span className="s2-added-check" aria-hidden="true">✓</span><strong id="s2-added-title">{added.merged ? 'Quantity updated in your cart' : 'Added to your cart'}</strong></div>
      <p className="s2-added-text">{added.title}{added.merged ? `: now ${blinds(added.qty)} of this size.` : added.qty > 1 ? ` · ${blinds(added.qty)}` : ''}</p>
      <div className="s2-added-actions">
        <button type="button" className="s2-btn s2-btn-brass" data-checkout onClick={cart.goCheckout}>Checkout</button>
        <button type="button" className="s2-btn s2-btn-line" onClick={cart.closeAdded}>Keep shopping</button>
      </div>
    </div>
  );
}

// The small note that tells a visitor a half-finished product page was kept in the cart. They can close it.
export function IncompleteNote({ note, onClose }) {
  const cart = useCart();
  if (!note || cart.panelOpen || !cart.incomplete.length) return null;
  return (
    <div className="s2-incnote" role="status" key={note.n}>
      <p>We kept your <strong>{note.title}</strong> in your cart, marked incomplete, so you can pick up where you left off.</p>
      <div className="s2-incnote-actions">
        <button type="button" className="s2-link" onClick={() => { onClose(); cart.setPanelOpen(true); }}>Open cart</button>
        <button type="button" className="s2-incnote-x" aria-label="Close this note" onClick={onClose}>×</button>
      </div>
    </div>
  );
}
