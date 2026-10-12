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
    const where = r.product_line ? ` in ${LINE_LABELS[r.product_line] || r.product_line}` : '';
    if (e.action === 'INSERT') return `Linked${where} as “${r.display_name}”`;
    if (e.action === 'DELETE') return `Unlinked${where} (“${r.display_name}”)`;
    const o = e.old_row || {};
    return o.display_name !== r.display_name ? `Renamed${where}: “${o.display_name}” → “${r.display_name}”` : `Link${where} updated`;
  }
  if (e.action === 'INSERT') return 'Created';
  if (e.action === 'DELETE') return 'Deleted';
  const o = e.old_row || {}, n = e.new_row || {};
  const parts = Object.keys(n).filter((k) => !SKIP.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => {
    if (k === 'active') return n[k] ? 'Shown' : 'Hidden';
    const label = k.replace(/_/g, ' ');
    return typeof n[k] === 'object' && n[k] !== null || typeof o[k] === 'object' && o[k] !== null ? `${label} changed` : `${label}: ${short(o[k])} → ${short(n[k])}`;
  });
  return parts.length ? parts.join('; ') : 'Saved';
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
