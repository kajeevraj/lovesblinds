import { useEffect, useState } from 'react';
import { loadHistory } from '../lib/db.js';
import { explain } from '../lib/errors.js';
import { LINE_LABELS } from '../lib/constants.js';

const SKIP = new Set(['updated_at', 'created_at']);
const short = (v) => {
  if (v === null || v === undefined || v === '') return 'empty';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'object') return 'changed';
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 37)}…` : s;
};
function describe(e) {
  if (e.table_name === 'swatch_links') {
    const r = e.new_row || e.old_row || {};
    const where = LINE_LABELS[r.product_line] || r.product_line || 'another line';
    if (e.action === 'INSERT') return `Added to ${where}`;
    if (e.action === 'DELETE') return `Removed from ${where}`;
    return e.old_row?.fabric_id !== e.new_row?.fabric_id ? `Price group changed in ${where}` : `Link in ${where} updated`;
  }
  if (e.action === 'INSERT') return 'Created';
  if (e.action === 'DELETE') return 'Deleted';
  const o = e.old_row || {}, n = e.new_row || {};
  const parts = Object.keys(n).filter((k) => !SKIP.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => {
    if (k === 'active') return n[k] ? 'Shown' : 'Hidden';
    if (k === 'fabric_id') return 'price group changed';
    if (k === 'shown_in') return null;
    const label = k.replace(/_/g, ' ');
    return typeof n[k] === 'object' && n[k] !== null || typeof o[k] === 'object' && o[k] !== null ? `${label} changed` : `${label}: ${short(o[k])} → ${short(n[k])}`;
  });
  const shown = parts.filter(Boolean);
  return shown.length ? shown.join('; ') : 'Saved';
}

export default function History({ table, rowId, reloadKey = 0, withLinks = false }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    loadHistory(table, rowId, 10, withLinks).then((r) => live && setRows(r)).catch((e) => live && setErr(explain(e)));
    return () => { live = false; };
  }, [table, rowId, reloadKey, withLinks]);
  return (
    <section className="adm-card" aria-labelledby="hist-h">
      <h2 id="hist-h">Change history</h2>
      {err && <p className="adm-error">{err}</p>}
      {!rows && !err && <p className="adm-muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="adm-muted">No changes recorded yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="adm-history">
          {rows.map((e) => (
            <li key={e.id}>
              <time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time>
              <span className="adm-muted">{e.actor_email || 'System'}</span>
              <span>{describe(e)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
