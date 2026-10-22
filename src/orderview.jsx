// A sent order, to look at and nothing more: its items with the estimates they were sent with, the customer's details and
// address, and "Order again", which copies the items into a new draft. A sent order is never edited or overwritten.
import { reconstructItem } from './lib/orders.js';
import { money, blinds, photoFor, detailsOf } from './lib/itemView.js';
import { addressLine } from './data/countries.js';
import SitePhoto from './components/SitePhoto.jsx';
import { Footer } from './customer.jsx';

export default function SentOrderView({ order, navigate, orderAgain }) {
  const items = (order.items || []).map((st, i) => reconstructItem(st, i)).filter(Boolean);
  let total = 0, byEmail = 0;
  for (const it of items) { if (it.priceKind === 'estimate' && it.price > 0) total += it.price * Math.max(1, it.qty || 1); else byEmail += 1; }
  const hasEstimates = items.some((it) => it.priceKind);
  const c = order.customer;
  const when = new Date(order.updated_at || order.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <div className="page-fade s2 s2-order">
      <section className="s2-wrap s2-order-wrap">
        <a className="s2-link" href="/orders" onClick={(e) => { e.preventDefault(); navigate('orders'); }}>← My orders</a>
        <h1 className="s2-order-title">{order.name}</h1>
        <p className="s2-order-sub">Sent on {when}. This order has been sent to us and can't be changed. To order the same blinds again, start a new order from it.</p>

        <ul className="s2-items">
          {items.map((it) => {
            const d = detailsOf(it); const ph = photoFor(it); const q = Math.max(1, it.qty || 1);
            return (
              <li key={it.id} className="s2-item s2-item-static">
                <div className="s2-item-main">
                  <SitePhoto name={ph.name} alt="" sizes="96px" loading="eager" className="s2-item-photo" />
                  <div className="s2-item-body">
                    <div className="s2-item-head">
                      <span className="s2-item-title">{d.title}</span>
                      <div className="s2-item-price">
                        {it.priceKind === 'estimate' && it.price > 0
                          ? <><div className="s2-item-amount">{money(it.price * q)}</div>{q > 1 && <div className="s2-item-each">{money(it.price)} each · {blinds(q)}</div>}</>
                          : it.priceKind ? <div className="s2-item-amount s2-item-onreq">Price sent by email</div> : null}
                      </div>
                    </div>
                    {(it.roomLabel || it.windowLabel) && <div className="s2-item-room">{[it.roomLabel, it.windowLabel].filter(Boolean).join(' · ')}</div>}
                    <div className="s2-item-details">{d.parts.join(' · ')}</div>
                    <div className="s2-item-qty">{blinds(q)}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {hasEstimates && (
          <section className="s2-total">
            <div className="s2-total-row"><span>Estimated total</span><strong>{total > 0 ? money(total) : 'Price sent by email'}</strong></div>
            {byEmail > 0 && total > 0 && <div className="s2-total-plus">Plus {byEmail} item{byEmail === 1 ? '' : 's'} priced by email</div>}
          </section>
        )}

        {c && (
          <section className="s2-details">
            <h2 className="s2-details-title">Sent to</h2>
            <p className="s2-order-sub">{[c.name, c.email, c.phone].filter(Boolean).join(' · ')}<br />{addressLine(c.address)}{c.notes ? <><br />Notes: {c.notes}</> : null}</p>
          </section>
        )}

        <button type="button" className="s2-btn s2-btn-brass s2-send" onClick={() => orderAgain(order)}>Order again</button>
        <p className="s2-send-note">Copies these blinds into a new order you can change before sending.</p>
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}
