import { useEffect, useMemo, useState } from 'react';
import { loadGridCost, patch } from './api.js';
import { gridLimits, SYSTEM_LABEL } from './util.js';
import { explain } from '../lib/errors.js';

const numsIn = (t) => (String(t || '').match(/\d+(?:\.\d+)?/g) || []).map(Number);

function Viewer({ meta, data, catalog, onSwapped }) {
  const [cost, setCost] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; setCost(null); loadGridCost(meta.id).then((c) => live && setCost(c)).catch((e) => live && setErr(explain(e))); return () => { live = false; }; }, [meta.id]);
  const lim = gridLimits(meta);
  const nc = meta.col_axis.length;
  const fabs = data.gridFabrics.filter((gf) => gf.grid_id === meta.id).map((gf) => ({ ...gf, fabric: catalog.fabrics.find((f) => f.id === gf.fabric_id) }));
  const rowLabel = meta.rows_are === 'width' ? 'width' : 'height / drop'; const colLabel = meta.rows_are === 'width' ? 'drop' : 'width';
  const dips = useMemo(() => {
    const s = new Set(); if (!cost) return s;
    for (let i = 0; i < meta.row_axis.length; i++) for (let j = 0; j < nc; j++) {
      const v = cost[i * nc + j]; if (v == null) continue;
      if ((j > 0 && cost[i * nc + j - 1] != null && v < cost[i * nc + j - 1] - 0.005) || (i > 0 && cost[(i - 1) * nc + j] != null && v < cost[(i - 1) * nc + j] - 0.005)) s.add(i * nc + j);
    }
    return s;
  }, [cost, meta, nc]);
  const swap = async () => {
    if (!window.confirm(`Swap the meaning of the axes for this grid?\n\nNow: rows are the ${meta.rows_are}. After: rows are the ${meta.rows_are === 'width' ? 'height' : 'width'}.\nUse this only if a real supplier quote shows the sheet is read the other way round. Prices from this grid change.`)) return;
    setBusy(true); try { await patch('price_grids', { id: meta.id }, { rows_are: meta.rows_are === 'width' ? 'height' : 'width' }); onSwapped(); } catch (e) { setErr(explain(e)); } setBusy(false);
  };
  return (
    <div className="adm-card">
      <h2>{meta.label}</h2>
      <p className="adm-muted adm-small">{meta.source_file} · sheet “{meta.source_sheet}” · first cost cell at row {meta.origin_row}, column {meta.origin_col}{meta.special ? ` · special sizes, costs × ${meta.multiplier}` : ''}</p>
      {err && <p className="adm-error">{err}</p>}
      <div className="adm-grid2">
        <div>
          <table className="adm-kv"><tbody>
            <tr><th>Systems</th><td>{meta.systems.map((s) => SYSTEM_LABEL[s]).join(', ')}{meta.variant !== 'all' ? ` · ${meta.variant}` : ''}{meta.lining ? ` · ${meta.lining}` : ''}</td></tr>
            <tr><th>Width range</th><td>{lim.minW}–{lim.maxW} in (priced from the sheet's {meta.rows_are === 'width' ? 'rows' : 'columns'})</td></tr>
            <tr><th>Height / drop range</th><td>{lim.minH}–{lim.maxH} in</td></tr>
            <tr><th>Roll width (sheet)</th><td>{meta.roll_widths.length ? meta.roll_widths.join(' / ') + ' in' : '—'}</td></tr>
            <tr><th>Axes</th><td>Rows = <strong>{rowLabel}</strong> ↓, columns = <strong>{colLabel}</strong> → <button className="adm-link" disabled={busy} onClick={swap}>Swap</button></td></tr>
          </tbody></table>
          {meta.anomalies.length > 0 && <div className="adm-anom"><strong>As printed in the sheet:</strong><ul>{meta.anomalies.map((a, i) => (
            <li key={i}>{a.type === 'decreases' ? `${a.count} places where a larger size costs a few cents less (highlighted)` : a.type === 'blank_cells' ? `${a.count} of ${a.of} cells have no price` : `odd ${a.axis} axis value ${a.values.join(', ')}`}</li>))}</ul></div>}
        </div>
        <div>
          {fabs.length > 0 ? (
            <table className="adm-table adm-compact"><thead><tr><th>Collection</th><th>Roll: sheet</th><th>Roll: ours</th><th>Max drop</th></tr></thead><tbody>
              {fabs.map((gf) => { const ours = numsIn(gf.fabric?.width); const sheet = gf.sheet_rolls || []; const diff = sheet.length && ours.length && Math.min(...sheet) !== Math.min(...ours);
                return (<tr key={gf.fabric_id}><td data-label="Collection">{gf.fabric?.collection_name}{gf.fabric?.family ? ` (${gf.fabric.family})` : ''}</td>
                  <td data-label="Roll: sheet">{sheet.join(' / ') || '—'}</td><td data-label="Roll: ours" className={diff ? 'adm-warn' : ''}>{gf.fabric?.width || '—'}{diff ? ` → uses ${Math.min(...sheet, ...ours)}` : ''}</td><td data-label="Max drop">{gf.max_drop ?? '—'}</td></tr>); })}
            </tbody></table>
          ) : <p className="adm-muted">Covers every collection in the line.</p>}
        </div>
      </div>
      {!cost ? <p className="adm-muted" aria-busy="true">Loading cells…</p> : (
        <div className="adm-gridwrap" tabIndex={0} aria-label={`Cost grid: rows are ${rowLabel}, columns are ${colLabel}`}>
          <table className="adm-grid"><thead><tr><th className="adm-corner">{rowLabel} ↓ / {colLabel} →</th>{meta.col_axis.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{meta.row_axis.map((r, i) => (
              <tr key={r}><th>{r}</th>{meta.col_axis.map((c, j) => { const v = cost[i * nc + j]; const k = i * nc + j;
                return <td key={c} className={v == null ? 'is-blank' : dips.has(k) ? 'is-dip' : ''}>{v == null ? '—' : v.toFixed(2)}</td>; })}</tr>))}</tbody></table>
        </div>
      )}
      <p className="adm-muted adm-small">Costs are supplier USD, shipping included, before adders and markup. Read-only.</p>
    </div>
  );
}

export default function GridViewer({ data, catalog, reload }) {
  const [line, setLine] = useState('roller'); const [sys, setSys] = useState(''); const [q, setQ] = useState(''); const [sel, setSel] = useState('');
  const rows = data.grids.filter((g) => g.line_id === line && (!sys || g.systems.includes(sys)) && (!q || g.label.toLowerCase().includes(q.toLowerCase())));
  const meta = data.grids.find((g) => g.id === sel);
  return (
    <div>
      <div className="adm-filters adm-filters3">
        <label className="adm-field"><span>Line</span><select value={line} onChange={(e) => { setLine(e.target.value); setSel(''); }}>{data.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label className="adm-field"><span>System</span><select value={sys} onChange={(e) => setSys(e.target.value)}><option value="">All</option>{Object.entries(SYSTEM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="adm-field"><span>Search</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="collection name" /></label>
      </div>
      <p className="adm-muted">{rows.length} grids</p>
      <table className="adm-table"><thead><tr><th>Grid</th><th>Systems</th><th>Width</th><th>Height / drop</th><th>Cells</th><th>Notes</th><th /></tr></thead><tbody>
        {rows.map((g) => { const l = gridLimits(g); const blank = g.anomalies.find((a) => a.type === 'blank_cells'); const dec = g.anomalies.find((a) => a.type === 'decreases');
          return (<tr key={g.id} className={sel === g.id ? 'is-selected' : ''}><td data-label="Grid" className="adm-name"><button className="adm-link" onClick={() => setSel(g.id)}>{g.label}</button></td>
            <td data-label="Systems">{g.systems.map((s) => SYSTEM_LABEL[s]).join(', ')}{g.special ? ' (special)' : ''}</td><td data-label="Width">{l.minW}–{l.maxW}</td><td data-label="Height / drop">{l.minH}–{l.maxH}</td>
            <td data-label="Cells">{g.row_axis.length * g.col_axis.length}</td>
            <td data-label="Notes">{blank ? `${blank.count} blank` : ''}{dec ? ` ${dec.count} dips` : ''}</td><td className="adm-actions"><button className="adm-btn adm-btn-sm" onClick={() => setSel(g.id)}>View</button></td></tr>); })}
      </tbody></table>
      {meta && <Viewer key={meta.id} meta={meta} data={data} catalog={catalog} onSwapped={reload} />}
    </div>
  );
}
