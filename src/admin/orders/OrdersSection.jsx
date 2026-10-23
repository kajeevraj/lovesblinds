import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { formatInches } from '../../lib/inches.js';
import { explain } from '../lib/errors.js';
import { updateRow } from '../lib/db.js';

// Orders the site accepted (table sent_orders, migration 14). Admins read them and change only the status and a note;
// the database refuses any other change to a sent order.
export const STATUSES = [
  { id: 'new', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'ordered', label: 'Ordered' },
  { id: 'shipped', label: 'Shipped' },
];
const LIMIT = 200;
const COLUMNS = 'id,created_at,customer,lines,notes,total,by_email_count,customer_copy,status,admin_note';

const money = (n) => `$${Number(n).toLocaleString('en-US')}`;
const when = (iso) => new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const whenShort = (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;
const itemCount = (o) => (o.lines || []).reduce((n, l) => n + (Number(l.qty) || 1), 0);
const totalText = (o) => (o.total > 0 ? `${money(o.total)}${o.by_email_count ? ` + ${o.by_email_count} by email` : ''}` : 'Price by email');
const sizeText = (l) => (l.width ? `${formatInches(l.width)}" × ${formatInches(l.length)}"` : '');
const address = (c) => {
  const a = c?.address;
  if (!a) return c?.shipTo || '';
  return [a.street, a.apt, [a.city, a.state, a.zip].filter(Boolean).join(' '), a.country].filter(Boolean).join(', ');
};

export default function OrdersSection() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState('');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase.from('sent_orders').select(COLUMNS).order('created_at', { ascending: false }).limit(LIMIT);
    if (err) { setError(/sent_orders/.test(err.message || '') ? 'The orders table is not set up yet (run migration 14 in Supabase).' : explain(err)); return; }
    setOrders(data); setError('');
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const counts = useMemo(() => {
    const c = { all: orders?.length || 0 };
    for (const s of STATUSES) c[s.id] = (orders || []).filter((o) => o.status === s.id).length;
    return c;
  }, [orders]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (orders || []).filter((o) => (filter === 'all' || o.status === filter)
      && (!needle || `${o.customer?.name || ''} ${o.customer?.email || ''}`.toLowerCase().includes(needle)));
  }, [orders, filter, q]);

  if (error && !orders) return <div className="adm-card"><h1>Orders</h1><p className="adm-error" role="alert">{error}</p><button className="adm-btn" onClick={reload}>Try again</button></div>;
  if (!orders) return <p className="adm-muted" aria-busy="true">Loading orders…</p>;

  const current = sel && orders.find((o) => o.id === sel);
  if (current) {
    return <OrderDetail key={current.id} order={current} onBack={() => setSel('')} onSaved={(row) => setOrders((list) => list.map((o) => (o.id === row.id ? { ...o, ...row } : o)))} />;
  }

  return (
    <div>
      <div className="adm-head"><h1>Orders</h1><span className="adm-muted">Every order sent from the site, newest first. Estimates are what the customer was shown; the final price is agreed by email.</span></div>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-bar adm-order-bar">
        <div className="adm-tabs" role="group" aria-label="Filter by status">
          <button className={filter === 'all' ? 'is-current' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All ({counts.all})</button>
          {STATUSES.map((s) => <button key={s.id} className={filter === s.id ? 'is-current' : ''} aria-pressed={filter === s.id} onClick={() => setFilter(s.id)}>{s.label} ({counts[s.id]})</button>)}
        </div>
        <label className="adm-field adm-order-search"><span className="adm-sr">Search by name or email</span>
          <input type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      {orders.length >= LIMIT && <p className="adm-muted adm-small">Showing the newest {LIMIT} orders.</p>}
      {!shown.length ? <p className="adm-muted">{orders.length ? 'No orders match.' : 'No orders yet. Orders sent from the site appear here.'}</p> : (
        <table className="adm-table"><thead><tr><th>Date</th><th>Customer</th><th>Items</th><th>Estimated total</th><th>Status</th></tr></thead><tbody>
          {shown.map((o) => (
            <tr key={o.id}>
              <td data-label="Date">{whenShort(o.created_at)}</td>
              <td data-label="Customer" className="adm-name"><button className="adm-link" onClick={() => setSel(o.id)}>{o.customer?.name || '(no name)'}</button><div className="adm-small adm-muted">{o.customer?.email}</div></td>
              <td data-label="Items">{itemCount(o)} {itemCount(o) === 1 ? 'blind' : 'blinds'}</td>
              <td data-label="Estimated total">{totalText(o)}</td>
              <td data-label="Status"><span className={`adm-badge adm-status-${o.status}`}>{statusLabel(o.status)}</span></td>
            </tr>
          ))}
        </tbody></table>
      )}
    </div>
  );
}

function OrderDetail({ order, onBack, onSaved }) {
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState(order.admin_note || '');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const c = order.customer || {};
  const dirty = status !== order.status || note.trim() !== (order.admin_note || '');

  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const row = await updateRow('sent_orders', order.id, { status, admin_note: note.trim() || null });
      onSaved({ id: row.id, status: row.status, admin_note: row.admin_note, updated_at: row.updated_at });
      setNote(row.admin_note || ''); setMsg('Saved.');
    } catch (e) { setErr(explain(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <button className="adm-btn adm-btn-sm" onClick={onBack}>← All orders</button>
      <div className="adm-head adm-order-head"><h1>{c.name || '(no name)'}</h1><span className="adm-muted">Sent {when(order.created_at)}</span></div>
      <div className="adm-card">
        <h2 className="adm-h2">Status and notes</h2>
        <label className="adm-field"><span>Status</span>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setMsg(''); }}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select></label>
        <label className="adm-field"><span>Our notes (only admins see these)</span>
          <textarea rows={4} maxLength={5000} value={note} onChange={(e) => { setNote(e.target.value); setMsg(''); }} /></label>
        {err && <p className="adm-error" role="alert">{err}</p>}
        {msg && <p className="adm-notice" role="status">{msg}</p>}
        <button className="adm-btn adm-btn-primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="adm-card">
        <h2 className="adm-h2">Customer</h2>
        <dl className="adm-kv">
          <dt>Email</dt><dd><a href={`mailto:${c.email}`}>{c.email}</a></dd>
          {c.phone && <><dt>Phone</dt><dd><a href={`tel:${c.phone}`}>{c.phone}</a></dd></>}
          <dt>Ship to</dt><dd>{address(c) || '—'}</dd>
          <dt>Confirmation email</dt><dd>{order.customer_copy ? 'Sent to the customer' : 'Not sent'}</dd>
          {order.notes && <><dt>Customer’s notes</dt><dd className="adm-pre">{order.notes}</dd></>}
        </dl>
      </div>
      <div className="adm-card">
        <h2 className="adm-h2">Items ({itemCount(order)})</h2>
        <table className="adm-table"><thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Room</th><th>Estimate</th></tr></thead><tbody>
          {(order.lines || []).map((l, i) => {
            const unit = l.price?.kind === 'price' ? l.price.unit : null;
            const qty = Number(l.qty) || 1;
            return (
              <tr key={i}>
                <td data-label="Item">{l.internalDescription || l.description || l.productName}{l.mountId && <div className="adm-small adm-muted">{l.mountId} mount</div>}</td>
                <td data-label="Size">{sizeText(l) || '—'}</td>
                <td data-label="Qty">{qty}</td>
                <td data-label="Room">{[l.roomLabel, l.windowLabel].filter(Boolean).join(' · ') || '—'}</td>
                <td data-label="Estimate">{unit != null ? (qty > 1 ? `${money(unit)} each · ${money(unit * qty)}` : money(unit)) : 'Price by email'}</td>
              </tr>
            );
          })}
        </tbody></table>
        <p className="adm-order-total"><strong>Estimated total: {totalText(order)}</strong></p>
      </div>
    </div>
  );
}
