import { useEffect, useMemo, useState } from 'react';
import { FAMILY_LABELS } from '../lib/constants.js';
import { estimate, } from './api.js';
import { money, pct, sheetCell, SYSTEM_LABEL, fabricsOf } from './util.js';
import { explain } from '../lib/errors.js';

const LINING = [['light-filtering', 'Light-filtering'], ['blackout', 'Blackout']];
const TYPES = [['standard', 'Standard'], ['top-down-bottom-up', 'Top-Down/Bottom-Up'], ['day-night', 'Day & Night']];
const STATUS_TEXT = {
  custom_size: 'Custom size: the customer would see "we\'ll quote it".', price_on_request: 'Price on request.', no_grid: 'No price grid covers this collection, system and lining.',
  no_control_mapping: 'This control is not linked to a price grid system.', unknown_line: 'Unknown pricing line.', incomplete: 'An adder has no amount yet, so the price is incomplete.',
};
const REASON_TEXT = {
  outside_grid: 'The size is past the largest value in the grid.', no_price_in_grid: 'The sheet has no price in that cell (a size the supplier does not make).',
  roll_width: 'The size does not fit the smaller of the sheet\'s and our catalog\'s roll width.', max_length: 'Longer than the supplier\'s "Max Length" for this collection.', no_size: 'Enter a width and a height.',
};

function Breakdown({ r, title }) {
  const g = r.grid || {};
  return (
    <div className="adm-card">
      {title && <h3>{title}</h3>}
      <table className="adm-kv"><tbody>
        <tr><th>Grid</th><td>{g.label}<br /><span className="adm-muted adm-small">{g.source_file} · sheet “{g.source_sheet}” · {g.rows_are === 'width' ? 'rows = width, columns = drop' : 'rows = height, columns = width'}{r.used_special_grid ? ' · special-size grid' : ''}</span></td></tr>
        <tr><th>Sizes used</th><td>asked {r.size_used?.asked_width} × {r.size_used?.asked_height} in → rounded up to <strong>{r.size_used?.width} × {r.size_used?.height}</strong> in (width × height)</td></tr>
        <tr><th>Grid cell</th><td><code>{g.source_sheet}!{sheetCell(g)}</code> (row value {g.row_value}, column value {g.col_value})</td></tr>
        <tr><th>Cost from the grid</th><td>{money(r.grid_cost, 4)}{r.multiplier !== 1 ? ` × ${r.multiplier} = ${money(r.cost, 4)}` : ''}</td></tr>
        {(r.adders || []).map((a, i) => (
          <tr key={i}><th>{a.kind === 'add' ? 'Adder' : 'Deduction'}</th><td>{a.label}: {a.missing ? <strong className="adm-warn">amount missing</strong> : `${a.kind === 'add' ? '+' : '−'}${money(a.amount)}`}{a.unit === 'per_sqft' ? ' (per sq ft)' : ''} {a.status !== 'from_sheet' && <span className="adm-badge is-off">{a.status === 'placeholder' ? 'placeholder' : 'confirm'}</span>}</td></tr>
        ))}
        {!(r.adders || []).length && <tr><th>Adders</th><td className="adm-muted">none apply</td></tr>}
        <tr><th>Cost before markup</th><td><strong>{money(r.subtotal, 4)}</strong></td></tr>
        <tr><th>Markup</th><td>{pct(r.markup)} ({r.markup_source === 'collection' ? 'collection override' : 'line default'})</td></tr>
        <tr><th>Exact price</th><td>{money(r.price_exact, 4)}</td></tr>
        <tr><th>Customer price</th><td><strong className="adm-price">{money(r.price, 0)}</strong> (whole dollars)</td></tr>
        <tr><th>Roll width</th><td>sheet {(r.roll?.sheet || []).join(' / ') || '—'} · ours {(r.roll?.ours || []).join(' / ') || '—'} · used for limits: <strong>{r.roll?.effective ?? '—'}</strong></td></tr>
      </tbody></table>
    </div>
  );
}

export default function PriceChecker({ data, catalog }) {
  const lines = data.lines;
  const [line, setLine] = useState('roller');
  const [fabric, setFabric] = useState('');
  const [swatch, setSwatch] = useState('');
  const [control, setControl] = useState('');
  const [type, setType] = useState('standard');
  const [lining, setLining] = useState('light-filtering');
  const [mode, setMode] = useState('single');
  const [back, setBack] = useState('');
  const [wrapC, setWrapC] = useState(false);
  const [wrapB, setWrapB] = useState(false);
  const [coating, setCoating] = useState(false);
  const [w, setW] = useState('40');
  const [h, setH] = useState('60');
  const [res, setRes] = useState(null);
  const [cust, setCust] = useState(null);
  const [err, setErr] = useState('');

  const pl = lines.find((l) => l.id === line);
  const fabrics = useMemo(() => fabricsOf(catalog.fabrics, line), [catalog.fabrics, line]);
  const swatches = useMemo(() => catalog.swatches.filter((s) => s.fabric_id === fabric), [catalog.swatches, fabric]);
  const controls = useMemo(() => {
    const g = data.groups.find((x) => x.line_id === pl?.product_line_id && x.key === 'control');
    return g ? data.values.filter((v) => v.group_id === g.id) : [];
  }, [data.groups, data.values, pl]);
  useEffect(() => { setFabric(fabrics[0]?.id || ''); setSwatch(''); setBack(''); }, [line]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setControl(controls.find((c) => c.is_default)?.code || controls[0]?.code || ''); }, [controls]);
  useEffect(() => { const s = swatches.find((x) => x.id === swatch); if (s && (line === 'cellular') && s.family) setLining(s.family); }, [swatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => {
    const o = { control };
    if (line === 'cellular') { o.type = type; o.lining = lining; }
    if (line === 'roman') o.lining = lining;
    if (line === 'roller') { o.mode = mode; if (mode === 'double-stack' && back) o.back_fabric_id = back; }
    if (wrapC) o.wrap_cassette = 'none';
    if (wrapB) o.wrap_bottom_rail = 'none';
    if (coating) o.coating = 'none';
    return o;
  }, [control, type, lining, mode, back, wrapC, wrapB, coating, line]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const args = { p_line: line, p_fabric_id: fabric || '', p_options: options, p_width: Number(w) || null, p_height: Number(h) || null };
      try {
        const [a, b] = await Promise.all([estimate('estimate_price_debug', args), estimate('estimate_price', args)]);
        if (live) { setRes(a); setCust(b); setErr(''); }
      } catch (e) { if (live) setErr(explain(e)); }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [line, fabric, options, w, h]);

  const showFamily = line === 'cellular' || line === 'roman';
  const noFabric = line === 'woven-wood';
  return (
    <div>
      <div className="adm-card">
        <h2>Pick what a customer would pick</h2>
        <div className="adm-grid3">
          <label className="adm-field"><span>Product line</span><select value={line} onChange={(e) => setLine(e.target.value)}>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}{l.id === 'woven-wood' ? ' (hidden)' : ''}</option>)}</select></label>
          {!noFabric && <label className="adm-field"><span>Collection</span><select value={fabric} onChange={(e) => { setFabric(e.target.value); setSwatch(''); }}>{fabrics.map((f) => <option key={f.id} value={f.id}>{f.collection_name}{f.family ? ` (${FAMILY_LABELS[f.family]})` : ''}</option>)}</select></label>}
          {!noFabric && <label className="adm-field"><span>Color <small>(optional)</small></span><select value={swatch} onChange={(e) => setSwatch(e.target.value)}><option value="">Any</option>{swatches.map((s) => <option key={s.id} value={s.id}>{s.display_name} ({s.supplier_code})</option>)}</select></label>}
          <label className="adm-field"><span>Control</span><select value={control} onChange={(e) => setControl(e.target.value)}>{controls.map((c) => <option key={c.code} value={c.code}>{c.label}{c.grid_system ? ` → ${SYSTEM_LABEL[c.grid_system]} grid` : ''}</option>)}</select></label>
          {line === 'cellular' && <label className="adm-field"><span>Type</span><select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
          {showFamily && <label className="adm-field"><span>{line === 'cellular' ? (type === 'day-night' ? 'Second (night) fabric' : 'Fabric') : 'Lining'}</span><select value={lining} onChange={(e) => setLining(e.target.value)}>{LINING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
          {line === 'roller' && <label className="adm-field"><span>Single or double-stack</span><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="single">Single</option><option value="double-stack">Double-stack (front + back)</option></select></label>}
          {line === 'roller' && mode === 'double-stack' && <label className="adm-field"><span>Back shade collection</span><select value={back} onChange={(e) => setBack(e.target.value)}><option value="">Choose…</option>{fabrics.map((f) => <option key={f.id} value={f.id}>{f.collection_name} ({FAMILY_LABELS[f.family]})</option>)}</select></label>}
          <label className="adm-field"><span>Width (in)</span><input type="number" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /></label>
          <label className="adm-field"><span>Height / drop (in)</span><input type="number" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} /></label>
        </div>
        <div className="adm-bar">
          {(line === 'roller' || line === 'zebra') && <label className="adm-check"><input type="checkbox" checked={wrapC} onChange={(e) => setWrapC(e.target.checked)} /> No fabric wrap on the cassette (−$3)</label>}
          {line === 'roller' && <label className="adm-check"><input type="checkbox" checked={wrapB} onChange={(e) => setWrapB(e.target.checked)} /> No fabric wrap on the bottom rail (−$3)</label>}
          {line === 'woven-wood' && <label className="adm-check"><input type="checkbox" checked={coating} onChange={(e) => setCoating(e.target.checked)} /> No coating (−$0.46 / sq ft)</label>}
        </div>
      </div>
      {err && <p className="adm-error" role="alert">{err}</p>}
      {res && (
        <>
          <div className="adm-card adm-result">
            <div><span className="adm-muted">Customer would see</span>
              <div className="adm-price-big">{cust?.price != null ? money(cust.price, 0) : cust?.price_on_request ? 'Price on request' : 'Custom size, we’ll quote it'}</div></div>
            {res.status !== 'ok' && <p className="adm-warn">{STATUS_TEXT[res.status] || res.status} {REASON_TEXT[res.reason] || ''} {res.missing?.length ? `Missing: ${res.missing.join(', ')}.` : ''}</p>}
          </div>
          {res.double_stack ? (<><Breakdown r={res.front} title="Front shade" /><Breakdown r={res.back} title="Back shade" /><p className="adm-muted">Double-stack = front price + back price (to confirm with the supplier).</p></>)
            : (res.grid && <Breakdown r={res} />)}
        </>
      )}
    </div>
  );
}
