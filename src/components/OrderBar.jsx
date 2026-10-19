// The order bar (the cart): sticky at the bottom of the customer pages. On a product page its left side is the item being built
// (its total, "$139 each · 3 blinds", and Add to order or Save changes) and its right side is the order so far; elsewhere it is
// only the order part. The order part opens a panel (a bottom sheet on phones, a side panel on desktop) listing every item.
import { useEffect, useRef } from 'react';
import { useCart } from '../lib/cart.js';
import { money, blinds, photoFor, detailsOf } from '../lib/itemView.js';
import SitePhoto from './SitePhoto.jsx';

const BagIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>
);

export const orderSummaryText = (cart) => {
  const n = cart.items.length;
  if (!n) return 'Your order is empty';
  const t = cart.totals;
  return `Your order: ${n} item${n === 1 ? '' : 's'} · ${t.loading ? '…' : t.total > 0 ? money(t.total) : 'Price by email'}`;
};

// The right-hand part of the bar. On a phone it is a small button with the item count.
export function OrderButton({ compact = false }) {
  const cart = useCart();
  const n = cart.items.length;
  const label = orderSummaryText(cart);
  return (
    <button type="button" className={`s2-bar-order${compact ? ' is-only' : ''}`} aria-haspopup="dialog" aria-label={`${label}. Open your order`} onClick={() => cart.setPanelOpen(true)}>
      <span className="s2-bar-order-icon"><BagIcon />{n > 0 && <span className="s2-bar-count">{n}</span>}</span>
      <span className="s2-bar-order-text">{label}</span>
      <span className="s2-bar-order-arrow" aria-hidden="true">›</span>
    </button>
  );
}

// Only the order part: home, products list, measuring guide and the other customer pages, and only when the order has items.
export function OrderOnlyBar() {
  const cart = useCart();
  if (!cart.items.length) return null;
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
  return (
    <div className="s2-bar">
      <div className="s2-wrap s2-bar-inner">
        <div className="s2-bar-left">
          <div className="s2-bar-text">
            {label && <span className="s2-bar-label">{label}</span>}
            <span className={`s2-bar-value${priced ? '' : ' is-text'}`}>{value}</span>
            {sub && <span className="s2-bar-sub">{sub}</span>}
          </div>
          <button type="button" className="s2-bar-btn" disabled={!canAdd} onClick={onAdd}>{added ? (editing ? 'Saved' : 'Added') : (editing ? 'Save changes' : 'Add to order')}</button>
        </div>
        <OrderButton />
      </div>
      <Flash />
    </div>
  );
}

// "Added to your order" for a moment, just above the bar.
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
    const prev = document.activeElement;
    ref.current?.querySelector('button')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') cart.setPanelOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('s2-noscroll');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('s2-noscroll'); prev?.focus?.(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const { items, prices, totals } = cart;
  const go = (fn) => { cart.setPanelOpen(false); fn(); };
  return (
    <div className="s2-panel-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) cart.setPanelOpen(false); }}>
      <aside className="s2-panel" role="dialog" aria-modal="true" aria-label="Your order" ref={ref}>
        <header className="s2-panel-head">
          <h2>Your order</h2>
          <button type="button" className="s2-panel-close" aria-label="Close your order" onClick={() => cart.setPanelOpen(false)}>×</button>
        </header>
        {items.length === 0 ? (
          <div className="s2-panel-empty"><p>Your order is empty. Choose a style to get started.</p></div>
        ) : (
          <ul className="s2-panel-items">
            {items.map((it, i) => {
              const d = detailsOf(it); const ph = photoFor(it); const p = prices[i]; const q = Math.max(1, it.qty || 1);
              return (
                <li key={it.id} className="s2-panel-item">
                  <a className="s2-panel-main" href={`/products/${it.product.slug}?edit=${encodeURIComponent(it.id)}`} onClick={(e) => { e.preventDefault(); go(() => cart.goEdit(it)); }}>
                    <SitePhoto name={ph.name} alt="" sizes="64px" className="s2-panel-photo" />
                    <span className="s2-panel-body">
                      <span className="s2-panel-title">{d.title}</span>
                      <span className="s2-panel-line">{d.colorText}</span>
                      <span className="s2-panel-line">{[d.parts.find((x) => /wide ×/.test(x)), blinds(q)].filter(Boolean).join(' · ')}</span>
                      <span className="s2-panel-price">{p.kind === 'price' ? <><strong>{money(p.price * q)}</strong>{q > 1 && <small> {money(p.price)} each</small>}</> : p.kind === 'loading' ? 'Calculating…' : 'Price sent by email'}</span>
                    </span>
                  </a>
                  <button type="button" className="s2-link s2-panel-remove" aria-label={`Remove ${d.title}`} onClick={() => cart.removeItem(it.id)}>Remove</button>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > 0 && (
          <footer className="s2-panel-foot">
            <div className="s2-total-row"><span>Estimated total</span><strong>{totals.loading ? '…' : totals.total > 0 ? money(totals.total) : 'Price by email'}</strong></div>
            {totals.byEmail > 0 && totals.total > 0 && <div className="s2-total-plus">Plus {totals.byEmail} priced by email</div>}
            <button type="button" className="s2-btn s2-btn-brass s2-panel-go" onClick={() => go(() => navigate('quote'))}>Review and send order</button>
          </footer>
        )}
      </aside>
    </div>
  );
}
