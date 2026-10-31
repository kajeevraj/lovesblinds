// The cart bar: sticky at the bottom of the customer pages. On a product page its left half is "This blind" (swatch, color, price)
// and its right half is "Your cart"; elsewhere only the cart half shows. The cart half opens a panel that slides up from the bar.
import { HubOption, HubTotalRow } from './HubOption.jsx';
import { useEffect, useRef } from 'react';
import { useCart } from '../lib/cart.js';
import { money, blinds, photoFor, detailsOf } from '../lib/itemView.js';
import { QtyStepper } from './s2.jsx';
import { SwatchTile } from './SwatchPicker.jsx';
import { getSwatch } from '../data/swatchData.js';
import GoogleSignIn from './GoogleSignIn.jsx';
import SitePhoto from './SitePhoto.jsx';

export const INCOMPLETE_TEXT = 'Incomplete: finish choosing';
export const BLOCKED_TEXT = 'Finish choosing or remove the incomplete items to check out.';

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

// A small round swatch: the color in the same corrected color as the picker tile and the 3D preview (the supplier photo is only the weave),
// or the supplier picture when the color is not in the loaded catalog, or a neutral circle when there is none.
export function Dot({ pick, size = 32, className = '' }) {
  const sw = pick?.swatchId ? getSwatch(pick.swatchId, pick.fabricId) : null;
  return (
    <span className={`s2-dot ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      {sw ? <SwatchTile swatch={sw} size={size} /> : pick?.thumb && <img src={pick.thumb} alt="" width={size} height={size} crossOrigin="anonymous" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
    </span>
  );
}

// "Your cart" half of the bar: up to three overlapping swatches (then +N), "Your cart · 3 items · $527", an up chevron and the main
// button. Anywhere on this half opens the cart panel. `button` is the bar's main button: { label, onClick, disabled } or null.
function CartHalf({ button = null }) {
  const cart = useCart();
  const items = cart.items;
  const n = cart.count;
  const t = cart.totals;
  const total = items.length === 0 ? null : t.loading ? '…' : t.total > 0 ? money(t.total) : 'Price by email';
  const shown = items.slice(0, 3);
  const more = items.length - shown.length;
  const label = n === 0 ? 'Your cart is empty' : `Your cart: ${n} item${n === 1 ? '' : 's'} · ${total || 'Not finished yet'}`;
  return (
    <div className="s2-bar-cartbtn" onClick={() => cart.setPanelOpen(true)}>
      <button type="button" className="s2-bar-order" aria-haspopup="dialog" aria-label={`${label}. Open your cart`} onClick={(e) => { e.stopPropagation(); cart.setPanelOpen(true); }}>
        {shown.length > 0 && (
          <span className="s2-dots" aria-hidden="true">
            {shown.map((it) => <Dot key={it.id} pick={it.selection?.picks?.[0]} size={28} />)}
            {more > 0 && <span className="s2-dots-more">+{more}</span>}
          </span>
        )}
        <span className="s2-bar-order-text">
          <span className="s2-bar-line1">
            <span className="s2-bar-kick"><span className="k-d">Your cart</span><span className="k-p">Cart</span></span>
            <span className="s2-bar-sep"> · </span>
            <span className="s2-bar-count">{n === 0 ? 'empty' : `${n} item${n === 1 ? '' : 's'}`}</span>
          </span>
          {total && <span className="s2-bar-line2"><span className="s2-bar-sep"> · </span><span className={`s2-bar-total${total === 'Price by email' ? ' is-email' : ''}`}>{total}</span></span>}
        </span>
        <svg className="s2-bar-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
      </button>
      {button && <button type="button" className={`s2-bar-btn s2-bar-main-btn${button.label === 'Checkout' ? ' s2-bar-checkout' : ''}`} disabled={button.disabled} onClick={(e) => { e.stopPropagation(); button.onClick(); }}>{button.label}</button>}
    </div>
  );
}

// Home, products list, measuring guide and the other customer pages: only the cart half, and only when the cart has something in it.
export function OrderOnlyBar() {
  const cart = useCart();
  if (!cart.count) return null;
  return (
    <div className="s2-bar s2-bar-only">
      <div className="s2-wrap s2-bar-inner"><CartHalf button={cart.items.length > 0 ? { label: 'Checkout', onClick: cart.goCheckout } : null} /></div>
      <Flash />
    </div>
  );
}

// The product page bar. Left, "This blind" (or "These blinds" for several): a swatch circle, the color name and the price
// ("3 × $130 = $390"). Right, "Your cart". The main button follows the page: Add to cart when this blind is ready and not yet
// added, Save changes while editing, Checkout otherwise (and nothing while the cart is empty and nothing is being built).
// `pick` is the color chosen so far; `mode` is 'add' | 'save' | 'checkout'; `onAction` adds or saves.
export function PriceBar({ view, qty = 1, pick = null, mode = 'checkout', onAction, canAct = true }) {
  const cart = useCart();
  const priced = view.kind === 'price';
  const byEmail = view.kind === 'custom' || view.kind === 'request' || view.kind === 'error';
  const label = qty > 1 ? 'These blinds' : 'This blind';
  let body;
  if (!pick) body = <span className="s2-bar-muted">{label}: choose a color and size</span>;
  else {
    const price = priced ? (qty > 1 ? <><span className="s2-bar-price-long">{qty} × {money(view.price)} = </span>{money(view.price * qty)}</> : money(view.price)) : null;
    body = (
      <>
        <Dot pick={pick} size={32} />
        <span className="s2-bar-blind-text">
          <span className="s2-bar-kick">{label}</span>
          <span className="s2-bar-color">{pick.displayName}</span>
          {priced ? <span className="s2-bar-price">{price}</span> : <span className="s2-bar-muted">{byEmail ? 'Price by email' : view.kind === 'toosmall' ? 'Larger size needed' : 'Choose a size'}</span>}
        </span>
      </>
    );
  }
  const button = mode === 'save' ? { label: 'Save changes', onClick: onAction, disabled: !canAct }
    : mode === 'add' ? { label: 'Add to cart', onClick: onAction, disabled: !canAct }
      : cart.items.length > 0 ? { label: 'Checkout', onClick: cart.goCheckout } : null;
  return (
    <div className="s2-bar">
      <div className="s2-wrap s2-bar-inner s2-bar-split">
        <div className="s2-bar-blind">{body}</div>
        <span className="s2-bar-divider" aria-hidden="true" />
        <CartHalf button={button} />
      </div>
      <Flash />
    </div>
  );
}

// "Removed Roller Shades, Living room   Undo": for a few seconds after Remove (in the panel and on the cart page)
export function UndoBar() {
  const { undo, undoRemove } = useCart();
  if (!undo) return null;
  return (
    <div className="s2-undo" role="status" key={undo.n}>
      <span>{undo.label}</span>
      <button type="button" className="s2-link" onClick={undoRemove}>Undo</button>
    </div>
  );
}

// "Add this blind to your cart first?" when Checkout is tapped while the blind on the page is ready but not added.
export function AddFirstDialog() {
  const { confirmAdd } = useCart();
  const ref = useRef(null);
  useEffect(() => {
    if (!confirmAdd.open) return undefined;
    ref.current?.querySelector('[data-add]')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') confirmAdd.cancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmAdd.open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!confirmAdd.open) return null;
  return (
    <div className="s2-exit-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) confirmAdd.cancel(); }}>
      <div className="s2-exit s2-addfirst" role="dialog" aria-modal="true" aria-labelledby="s2-addfirst-title" ref={ref}>
        <h2 id="s2-addfirst-title" className="s2-exit-title">Add this blind to your cart first?</h2>
        <p className="s2-exit-text">You have a blind on this page that is not in your cart yet.</p>
        <div className="s2-added-card-actions">
          <button type="button" className="s2-btn s2-btn-brass" data-add onClick={confirmAdd.add}>Add</button>
          <button type="button" className="s2-btn s2-btn-line" onClick={confirmAdd.skip}>Skip</button>
        </div>
      </div>
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
      <div className="s2-panel" role="dialog" aria-modal="true" aria-label="Your cart" ref={ref}>
        <div className="s2-panel-head">
          <h2>Your cart</h2>
          <a className="s2-link s2-panel-full" href="/order" onClick={(e) => { e.preventDefault(); go(() => navigate('quote')); }}>Full cart page</a>
          <button type="button" className="s2-panel-close" aria-label="Close your cart" onClick={() => cart.setPanelOpen(false)}>×</button>
        </div>
        <UndoBar />
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
                      <span className="s2-panel-price">{p.kind === 'price' ? <><strong>{money(p.price * q)}</strong>{q > 1 && <small> {money(p.price)} each</small>}</> : p.kind === 'loading' ? 'Calculating…' : 'Price by email'}</span>
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
          <div className="s2-panel-foot">
            <HubOption cart={cart} compact />
            <SavePrompt />
            {items.length > 0 && (
              <>
                <HubTotalRow cart={cart} />
                <div className="s2-total-row"><span>Estimated total</span><strong>{totals.loading ? '…' : totals.total > 0 ? money(totals.total) : 'Price by email'}</strong></div>
                {totals.byEmail > 0 && totals.total > 0 && <div className="s2-total-plus">Plus {totals.byEmail} priced by email</div>}
              </>
            )}
            {blocked && <p className="s2-blocked" role="status">{BLOCKED_TEXT}</p>}
            <button type="button" className="s2-btn s2-btn-brass s2-panel-go" disabled={blocked || items.length === 0} onClick={() => go(cart.goCheckout)}>Checkout</button>
          </div>
        )}
      </div>
    </div>
  );
}

// The room and window label of a cart line: "Primary bedroom · Left window"
export const roomText = (it) => [it.roomLabel, it.windowLabel].filter(Boolean).join(' · ');

// The small note that tells a visitor a half-finished product page was kept in the cart. "Finish choosing" goes straight back to it.
export function IncompleteNote({ note, onClose }) {
  const cart = useCart();
  if (!note || cart.panelOpen || !cart.incomplete.length) return null;
  const entry = cart.incomplete.find((e) => e.key === note.entry?.key) || cart.incomplete[0];
  return (
    <div className="s2-incnote" role="status" key={note.n}>
      <p>Your <strong>{note.title}</strong> is in your cart, marked incomplete.</p>
      <div className="s2-incnote-actions">
        <button type="button" className="s2-link" onClick={() => { onClose(); cart.goIncomplete(entry); }}>Finish choosing</button>
        <button type="button" className="s2-incnote-x" aria-label="Close this note" onClick={onClose}>×</button>
      </div>
    </div>
  );
}
