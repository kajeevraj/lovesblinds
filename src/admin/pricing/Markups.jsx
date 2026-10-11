import { useState } from 'react';
import { patch, upsertMarkup, removeMarkup } from './api.js';
import { pct, money, fabricsOf } from './util.js';
import { explain } from '../lib/errors.js';

export default function Markups({ data, catalog, reload }) {
  const [edit, setEdit] = useState({});
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [ovLine, setOvLine] = useState('roller'); const [ovFabric, setOvFabric] = useState(''); const [ovPct, setOvPct] = useState('');
  const nameOf = (id) => catalog.fabrics.find((f) => f.id === id);
  const fabrics = fabricsOf(catalog.fabrics, ovLine);

  const saveLine = async (l) => {
    const v = Number(edit[l.id]); setErr(''); setMsg('');
    if (!Number.isFinite(v) || v < 0 || v > 1000) { setErr('Enter a markup between 0 and 1000 percent.'); return; }
    try { await patch('pricing_lines', { id: l.id }, { markup: v / 100 }); setMsg(`${l.name}: markup is now ${v}% (price = cost × ${(1 + v / 100).toFixed(2)}).`); setEdit((e) => { const n = { ...e }; delete n[l.id]; return n; }); reload(); } catch (e) { setErr(explain(e)); }
  };
  const addOverride = async () => {
    const v = Number(ovPct); setErr(''); setMsg('');
    if (!ovFabric || !Number.isFinite(v) || v < 0) { setErr('Choose a collection and a percentage.'); return; }
    try { await upsertMarkup(ovFabric, v / 100); setMsg(`${nameOf(ovFabric)?.collection_name}: markup override ${v}%.`); setOvPct(''); reload(); } catch (e) { setErr(explain(e)); }
  };
  return (
    <div>
      {msg && <p className="adm-notice" role="status">{msg}</p>}{err && <p className="adm-error" role="alert">{err}</p>}
      <div className="adm-card">
        <h2>Markup per product line</h2>
        <p className="adm-muted">Customer price = round((cost + adders) × (1 + markup)), in whole dollars. Default 50%.</p>
        <table className="adm-table"><thead><tr><th>Line</th><th>Markup</th><th>Example: cost $100</th><th /></tr></thead><tbody>
          {data.lines.map((l) => {
            const val = edit[l.id] ?? String(Math.round(Number(l.markup) * 1000) / 10);
            return (
              <tr key={l.id}><td data-label="Line">{l.name}</td>
                <td data-label="Markup"><div className="adm-inline"><input type="number" step="0.1" min="0" aria-label={`Markup % for ${l.name}`} value={val} onChange={(e) => setEdit({ ...edit, [l.id]: e.target.value })} /> %</div></td>
                <td data-label="Example">{money(Math.round(100 * (1 + Number(val) / 100)), 0)}</td>
                <td className="adm-actions"><button className="adm-btn adm-btn-sm" disabled={edit[l.id] === undefined} onClick={() => saveLine(l)}>Save</button></td></tr>
            );
          })}
        </tbody></table>
      </div>
      <div className="adm-card">
        <h2>Overrides per collection</h2>
        <p className="adm-muted">A collection with an override uses it instead of its line's markup.</p>
        {data.markups.length > 0 && (
          <table className="adm-table"><thead><tr><th>Collection</th><th>Line</th><th>Markup</th><th /></tr></thead><tbody>
            {data.markups.map((m) => { const f = nameOf(m.fabric_id); return (
              <tr key={m.fabric_id}><td data-label="Collection">{f?.collection_name || m.fabric_id}</td><td data-label="Line">{f?.product_line}</td><td data-label="Markup">{pct(m.markup)}</td>
                <td className="adm-actions"><button className="adm-btn adm-btn-sm" onClick={async () => { try { await removeMarkup(m.fabric_id); reload(); } catch (e) { setErr(explain(e)); } }}>Remove</button></td></tr>); })}
          </tbody></table>
        )}
        <div className="adm-grid3">
          <label className="adm-field"><span>Line</span><select value={ovLine} onChange={(e) => { setOvLine(e.target.value); setOvFabric(''); }}>{data.lines.filter((l) => l.id !== 'woven-wood').map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className="adm-field"><span>Collection</span><select value={ovFabric} onChange={(e) => setOvFabric(e.target.value)}><option value="">Choose…</option>{fabrics.map((f) => <option key={f.id} value={f.id}>{f.collection_name}{f.family ? ` (${f.family})` : ''}</option>)}</select></label>
          <label className="adm-field"><span>Markup %</span><input type="number" step="0.1" min="0" value={ovPct} onChange={(e) => setOvPct(e.target.value)} /></label>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={addOverride}>Set override</button>
      </div>
    </div>
  );
}
