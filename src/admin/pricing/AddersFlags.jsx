import { useState } from 'react';
import { patch } from './api.js';
import { money } from './util.js';
import { explain } from '../lib/errors.js';

const when = (w) => Object.entries(w || {}).map(([k, v]) => `${k.replace(/_/g, ' ')} = ${[].concat(v).join(' / ')}`).join('; ') || 'always';
const KIND = { confirm: 'Confirm with supplier', placeholder: 'Placeholder', anomaly: 'As printed', info: 'Note' };

export default function AddersFlags({ data, reload }) {
  const [edit, setEdit] = useState({}); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const lineName = (id) => data.lines.find((l) => l.id === id)?.name || id || 'All lines';
  const save = async (a) => {
    const raw = edit[a.id]; const v = raw === '' ? null : Number(raw); setErr(''); setMsg('');
    if (v !== null && (!Number.isFinite(v) || v < 0)) { setErr('Enter an amount of zero or more (or clear it to mark it missing).'); return; }
    try {
      await patch('price_adders', { id: a.id }, { amount: v }); setMsg(`${a.label}: amount saved. ${a.origin === 'sheet' ? 'A re-import of that workbook would overwrite it.' : ''}`); setEdit((e) => { const n = { ...e }; delete n[a.id]; return n; }); reload();
    } catch (e) { setErr(explain(e)); }
  };
  const toggle = async (a) => { try { await patch('price_adders', { id: a.id }, { active: !a.active }); reload(); } catch (e) { setErr(explain(e)); } };
  const resolve = async (f) => { try { await patch('price_flags', { id: f.id }, { resolved: !f.resolved }); reload(); } catch (e) { setErr(explain(e)); } };
  const flags = [...data.flags].sort((a, b) => (a.resolved - b.resolved) || ['confirm', 'placeholder', 'anomaly', 'info'].indexOf(a.kind) - ['confirm', 'placeholder', 'anomaly', 'info'].indexOf(b.kind));
  return (
    <div>
      {msg && <p className="adm-notice" role="status">{msg}</p>}{err && <p className="adm-error" role="alert">{err}</p>}
      <div className="adm-card">
        <h2>Things to confirm and things kept as printed</h2>
        <ul className="adm-flags">
          {flags.map((f) => (
            <li key={f.id} className={f.resolved ? 'is-done' : ''}>
              <div><span className={`adm-badge ${f.kind === 'info' ? 'is-active' : 'is-off'}`}>{KIND[f.kind]}</span> <strong>{f.title}</strong> <span className="adm-muted adm-small">{lineName(f.line_id)}</span></div>
              <p>{f.detail}</p>
              {f.resolved && f.resolution_note && <p className="adm-small"><strong>Resolved:</strong> {f.resolution_note}</p>}
              {f.kind !== 'info' && <label className="adm-check"><input type="checkbox" checked={f.resolved} onChange={() => resolve(f)} /> {f.kind === 'anomaly' ? 'Reviewed' : 'Confirmed'}</label>}
            </li>
          ))}
        </ul>
      </div>
      <div className="adm-card">
        <h2>Adders and deductions</h2>
        <p className="adm-muted">Amounts are costs in USD, applied before the markup. Zebra special sizes use a ×1.1 multiplier on the special-size grids (see Grids).</p>
        <table className="adm-table"><thead><tr><th>Line</th><th>Adder</th><th>Applies when</th><th>Amount</th><th>Status</th><th>Source</th><th /></tr></thead><tbody>
          {data.adders.map((a) => {
            const v = edit[a.id] ?? (a.amount == null ? '' : String(Number(a.amount)));
            return (
              <tr key={a.id} className={a.active ? '' : 'is-hidden'}>
                <td data-label="Line">{lineName(a.line_id)}</td>
                <td data-label="Adder">{a.kind === 'add' ? '+' : '−'} {a.label}{a.unit === 'per_sqft' ? ' (per sq ft)' : ''}{a.note && <div className="adm-muted adm-small">{a.note}</div>}</td>
                <td data-label="Applies when" className="adm-small">{when(a.applies_when)}</td>
                <td data-label="Amount"><div className="adm-inline">$<input type="number" step="0.01" min="0" aria-label={`Amount for ${a.label}`} value={v} onChange={(e) => setEdit({ ...edit, [a.id]: e.target.value })} placeholder="missing" /></div>{a.amount == null && <div className="adm-warn adm-small">missing</div>}</td>
                <td data-label="Status"><span className={`adm-badge ${a.status === 'from_sheet' || a.status === 'from_supplier' ? 'is-active' : 'is-off'}`}>{a.status === 'placeholder' ? 'Placeholder, confirm with supplier' : a.status === 'confirm' ? 'Confirm' : a.status === 'from_supplier' ? 'From the supplier' : 'From the sheet'}</span></td>
                <td data-label="Source" className="adm-small adm-muted">{a.source}</td>
                <td className="adm-actions"><button className="adm-btn adm-btn-sm" disabled={edit[a.id] === undefined} onClick={() => save(a)}>Save</button> <button className="adm-btn adm-btn-sm" onClick={() => toggle(a)}>{a.active ? 'Turn off' : 'Turn on'}</button></td>
              </tr>
            );
          })}
        </tbody></table>
      </div>
    </div>
  );
}
