import { useEffect, useMemo, useRef, useState } from 'react';
import { FAMILY_LABELS, LINE_LABELS } from '../lib/constants.js';
import { estimate, } from './api.js';
import { money, pct, sheetCell, SYSTEM_LABEL, fabricsOf } from './util.js';
import { explain } from '../lib/errors.js';

const LINING = [['light-filtering', 'Light-filtering'], ['blackout', 'Blackout']];
const TYPES = [['standard', 'Standard'], ['top-down-bottom-up', 'Top-Down/Bottom-Up'], ['day-night', 'Day & Night']];
const STATUS_TEXT = {
  custom_size: 'Custom size: the customer would see "we\'ll quote it".', price_on_request: 'Price on request.', no_grid: 'No price grid covers this price group, system and lining.',
  no_control_mapping: 'This control is not linked to a price grid system.', unknown_line: 'Unknown pricing line.', incomplete: 'An adder has no amount yet, so the price is incomplete.',
};
const REASON_TEXT = {
  outside_grid: 'The size is past the largest value in the grid.', no_price_in_grid: 'The sheet has no price in that cell (a size the supplier does not make).',
  roll_width: 'The size does not fit the smaller of the sheet\'s and our catalog\'s roll width.', max_length: 'Longer than the supplier\'s "Max Length" for this price group.', no_size: 'Enter a width and a height.',
};

function Breakdown({ r, title, group, final }) {
  const g = r.grid || {};
  return (
    <div className="adm-card">
      {title && <h3>{title}</h3>}
      <table className="adm-kv"><tbody>
        {group && <tr><th>Price group</th><td><strong>{group}</strong> <span className="adm-muted adm-small">(admin only; customers never see it)</span></td></tr>}
        <tr><th>Grid</th><td>{g.label}<br /><span className="adm-muted adm-small">{g.source_file} · sheet “{g.source_sheet}” · {g.rows_are === 'width' ? 'rows = width, columns = drop' : 'rows = height, columns = width'}{r.used_special_grid ? ' · special-size grid' : ''}</span></td></tr>
        <tr><th>Sizes used</th><td>asked {r.size_used?.asked_width} × {r.size_used?.asked_height} in → rounded up to <strong>{r.size_used?.width} × {r.size_used?.height}</strong> in (width × height)</td></tr>
        <tr><th>Grid cell</th><td><code>{g.source_sheet}!{sheetCell(g)}</code> (row value {g.row_value}, column value {g.col_value})</td></tr>
        <tr><th>Cost from the grid</th><td>{money(r.grid_cost, 4)}{r.multiplier !== 1 ? ` × ${r.multiplier} = ${money(r.cost, 4)}` : ''}</td></tr>
        {(r.adders || []).map((a, i) => (
          <tr key={i}><th>{a.kind === 'add' ? 'Adder' : 'Deduction'}</th><td>{a.label}: {a.missing ? <strong className="adm-warn">amount missing</strong> : `${a.kind === 'add' ? '+' : '−'}${money(a.amount)}`}{a.unit === 'per_sqft' ? ' (per sq ft)' : ''} {(a.status === 'placeholder' || a.status === 'confirm') && <span className="adm-badge is-off">{a.status === 'placeholder' ? 'placeholder' : 'confirm'}</span>}{a.status === 'from_supplier' && <span className="adm-badge is-active">from the supplier</span>}</td></tr>
        ))}
        {!(r.adders || []).length && <tr><th>Adders</th><td className="adm-muted">none apply</td></tr>}
        <tr><th>Cost before markup</th><td><strong>{money(r.subtotal, 4)}</strong></td></tr>
        <tr><th>Markup</th><td>{pct(r.markup)} ({r.markup_source === 'collection' ? 'collection override' : 'line default'})</td></tr>
        <tr><th>Exact price</th><td>{money(r.price_exact, 4)}</td></tr>
        {final ? (<>
          <tr><th>Price before extra cost</th><td>{money(final.before, 0)} (the grid price after markup, whole dollars)</td></tr>
          <tr><th>Extra cost</th><td>+{money(final.extra)} <span className="adm-muted adm-small">(this color; added after the markup)</span></td></tr>
          <tr><th>Customer price</th><td><strong className="adm-price">{money(final.price, 0)}</strong> (whole dollars)</td></tr>
        </>) : <tr><th>Customer price</th><td><strong className="adm-price">{money(r.price, 0)}</strong> (whole dollars)</td></tr>}
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
  const [fx, setFx] = useState({});   // customer-price effect of each toggle at the current size

  const pl = lines.find((l) => l.id === line);
  const fabrics = useMemo(() => fabricsOf(catalog.fabrics, line), [catalog.fabrics, line]);
  // Every place a color is sold: its own record, plus each line it is linked into (migration 9), under that line's name.
  const placements = useMemo(() => {
    const byId = new Map(catalog.swatches.map((s) => [s.id, s]));
    const fabById = new Map(catalog.fabrics.map((f) => [f.id, f]));
    const own = catalog.swatches.map((s) => ({ key: `${s.id}@${s.fabric_id}`, swatchId: s.id, fabric_id: s.fabric_id, name: s.display_name, code: s.supplier_code, family: s.family, active: s.active, extra: s.extra_cost }));
    const linked = (catalog.links || []).filter((l) => byId.has(l.swatch_id)).map((l) => { const sw = byId.get(l.swatch_id); return { key: `${l.swatch_id}@${l.fabric_id}`, swatchId: l.swatch_id, fabric_id: l.fabric_id, name: sw.display_name, code: sw.supplier_code, family: l.family, active: l.active && sw.active, extra: sw.extra_cost }; });
    return [...own, ...linked].map((p) => ({ ...p, fabric: fabById.get(p.fabric_id) })).filter((p) => p.fabric);
  }, [catalog.swatches, catalog.links, catalog.fabrics]);
  // the pricing line a result belongs to; Roman and Drapery share fabrics, so keep the current one when it fits
  const lineOfFabric = (f) => (f.product_line === 'drapery' ? ((f.shown_in || []).includes(line) ? line : (f.shown_in || []).includes('roman') ? 'roman' : 'drapery') : f.product_line);
  const [query, setQuery] = useState('');
  const [queryB, setQueryB] = useState('');
  const pendingSel = useRef(null);
  const search = (text, only) => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return placements.filter((p) => (!only || p.fabric.product_line === only) && (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)))
      .sort((a, b) => (a.name.toLowerCase().startsWith(q) || a.code.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) || b.code.toLowerCase().startsWith(q) ? 0 : 1) || a.name.localeCompare(b.name))
      .slice(0, 12);
  };
  const results = useMemo(() => search(query), [placements, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const resultsB = useMemo(() => search(queryB, 'roller'), [placements, queryB]); // eslint-disable-line react-hooks/exhaustive-deps
  const backChosen = placements.find((p) => p.key === back) || null;
  const chosen = placements.find((p) => p.key === swatch) || null;
  const choose = (p) => {
    const target = lineOfFabric(p.fabric);
    setQuery('');
    if (target === line) { setFabric(p.fabric_id); setSwatch(p.key); }
    else { pendingSel.current = { fabric: p.fabric_id, swatch: p.key }; setLine(target); }
  };
  const controls = useMemo(() => {
    const g = data.groups.find((x) => x.line_id === pl?.product_line_id && x.key === 'control');
    return g ? data.values.filter((v) => v.group_id === g.id) : [];
  }, [data.groups, data.values, pl]);
  useEffect(() => { const want = pendingSel.current; pendingSel.current = null; setFabric(want?.fabric || fabrics[0]?.id || ''); setSwatch(want?.swatch || ''); setBack(''); }, [line]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setControl(controls.find((c) => c.is_default)?.code || controls[0]?.code || ''); }, [controls]);
  useEffect(() => { const s = placements.find((x) => x.key === swatch); if (s && (line === 'cellular') && s.family) setLining(s.family); }, [swatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // what the customer's colors add to a call: the swatch ids for the swatch route, the group ids for the group route
  const options = useMemo(() => {
    const o = { control };
    if (line === 'cellular') { o.type = type; o.lining = lining; }
    if (line === 'roman') o.lining = lining;
    if (line === 'roller') { o.mode = mode; }
    if (wrapC) o.wrap_cassette = 'none';
    if (wrapB) o.wrap_bottom_rail = 'none';
    if (coating) o.coating = 'none';
    return o;
  }, [control, type, lining, mode, back, wrapC, wrapB, coating, line]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const width = Number(w) || null, height = Number(h) || null;
      // With a color chosen the price comes from the same function customers use (price group and extra cost included).
      // Double-stack needs both colors; with no color the line's first price group is used and no extra cost applies.
      const dbl = line === 'roller' && mode === 'double-stack';
      const bySwatch = !!chosen && (!dbl || !!backChosen);
      const opts = (o) => (dbl ? (bySwatch ? { ...o, back_swatch_id: backChosen.swatchId } : backChosen ? { ...o, back_fabric_id: backChosen.fabric_id } : o) : o);
      const dbg = (o) => (bySwatch ? estimate('estimate_price_debug_for_swatch', { p_line: line, p_swatch_id: chosen.swatchId, p_options: opts(o), p_width: width, p_height: height })
        : estimate('estimate_price_debug', { p_line: line, p_fabric_id: fabric || '', p_options: opts(o), p_width: width, p_height: height }));
      const cst = (o) => (bySwatch ? estimate('estimate_price_for_swatch', { p_line: line, p_swatch_id: chosen.swatchId, p_options: opts(o), p_width: width, p_height: height })
        : estimate('estimate_price', { p_line: line, p_fabric_id: fabric || '', p_options: opts(o), p_width: width, p_height: height }));
      try {
        const [a, b] = await Promise.all([dbg(options), cst(options)]);
        // each toggle's effect on the CUSTOMER price (after markup and rounding) at this size: price with it minus price without
        const TOG = { wrapC: ['wrap_cassette', 'none'], wrapB: ['wrap_bottom_rail', 'none'], coating: ['coating', 'none'] };
        const effects = {};
        await Promise.all(Object.entries(TOG).map(async ([k, [key, val]]) => {
          const [on, off] = await Promise.all([{ ...options, [key]: val }, (({ [key]: _drop, ...rest }) => rest)(options)].map(cst));
          effects[k] = on?.price != null && off?.price != null ? on.price - off.price : null;
        }));
        if (live) { setRes(a); setCust(b); setFx(effects); setErr(''); }
      } catch (e) { if (live) setErr(explain(e)); }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [line, fabric, options, w, h, mode, chosen, backChosen]); // eslint-disable-line react-hooks/exhaustive-deps

  const effect = (k) => (fx[k] == null ? ' (shown once a price exists at this size)' : ` (${fx[k] < 0 ? '−' : fx[k] > 0 ? '+' : ''}$${Math.abs(fx[k])} on the customer price at this size)`);
  const showFamily = line === 'cellular' || line === 'roman';
  const noFabric = line === 'woven-wood';
  return (
    <div>
      <div className="adm-card">
        <h2>Pick what a customer would pick</h2>
        <div className="adm-grid3">
          <label className="adm-field"><span>Product line</span><select value={line} onChange={(e) => setLine(e.target.value)}>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}{l.id === 'woven-wood' ? ' (hidden)' : ''}</option>)}</select></label>
          {!noFabric && (
            <div className="adm-field adm-search" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="pc-search"><span>Find a color <small>(name or code; picks the line and price group for you)</small></span></label>
              <input id="pc-search" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Purity, Snow, or XSS000105" />
              {query.trim() && (
                <ul className="adm-results" role="listbox" aria-label="Matching colors">
                  {results.length === 0 && <li className="adm-muted">No color matches.</li>}
                  {results.map((p) => (
                    <li key={p.key} role="option" aria-selected={p.key === swatch}>
                      <button type="button" className="adm-link" onClick={() => choose(p)}>
                        <strong>{p.name}</strong> <code>{p.code}</code>
                        <span className="adm-muted adm-small"> · {LINE_LABELS[p.fabric.product_line]}{p.fabric.family ? ` · ${FAMILY_LABELS[p.fabric.family]}` : ''} · price group {p.fabric.collection_name}{p.active ? '' : ' · hidden'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="adm-small" aria-live="polite">
                {chosen
                  ? <>Pricing <strong>{chosen.name}</strong> (<code>{chosen.code}</code>) · {LINE_LABELS[chosen.fabric.product_line]} · price group <strong>{chosen.fabric.collection_name}</strong>{Number(chosen.extra) > 0 ? <> · extra cost <strong>{money(chosen.extra)}</strong></> : null} <button type="button" className="adm-link" onClick={() => setSwatch('')}>Clear</button></>
                  : <span className="adm-muted">No color chosen: using the first price group in this line ({fabrics.find((f) => f.id === fabric)?.collection_name || 'none'}).</span>}
              </p>
            </div>
          )}
          <label className="adm-field"><span>Control</span><select value={control} onChange={(e) => setControl(e.target.value)}>{controls.map((c) => <option key={c.code} value={c.code}>{c.label}{c.grid_system ? ` → ${SYSTEM_LABEL[c.grid_system]} grid` : ''}</option>)}</select></label>
          {line === 'cellular' && <label className="adm-field"><span>Type</span><select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
          {showFamily && <label className="adm-field"><span>{line === 'cellular' ? (type === 'day-night' ? 'Second (night) fabric' : 'Fabric') : 'Lining'}</span><select value={lining} onChange={(e) => setLining(e.target.value)}>{LINING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
          {line === 'roller' && <label className="adm-field"><span>Single or double-stack</span><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="single">Single</option><option value="double-stack">Double-stack (front + back)</option></select></label>}
          {line === 'roller' && mode === 'double-stack' && (
            <div className="adm-field adm-search" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="pc-search-back"><span>Back shade color <small>(a Roller color; its price group and extra cost are added)</small></span></label>
              <input id="pc-search-back" type="search" autoComplete="off" value={queryB} onChange={(e) => setQueryB(e.target.value)} placeholder="name or code" />
              {queryB.trim() && (
                <ul className="adm-results" role="listbox" aria-label="Matching back shade colors">
                  {resultsB.length === 0 && <li className="adm-muted">No Roller color matches.</li>}
                  {resultsB.map((p) => (
                    <li key={p.key} role="option" aria-selected={p.key === back}>
                      <button type="button" className="adm-link" onClick={() => { setBack(p.key); setQueryB(''); }}>
                        <strong>{p.name}</strong> <code>{p.code}</code> <span className="adm-muted adm-small"> · {p.fabric.family ? FAMILY_LABELS[p.fabric.family] : ''} · price group {p.fabric.collection_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="adm-small">{backChosen ? <>Back shade: <strong>{backChosen.name}</strong> (<code>{backChosen.code}</code>) · price group <strong>{backChosen.fabric.collection_name}</strong> <button type="button" className="adm-link" onClick={() => setBack('')}>Clear</button></> : <span className="adm-muted">No back shade color chosen yet.</span>}</p>
            </div>
          )}
          <label className="adm-field"><span>Width (in)</span><input type="number" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /></label>
          <label className="adm-field"><span>Height / drop (in)</span><input type="number" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} /></label>
        </div>
        <div className="adm-bar">
          {(line === 'roller' || line === 'zebra') && <label className="adm-check"><input type="checkbox" checked={wrapC} onChange={(e) => setWrapC(e.target.checked)} /> No fabric wrap on the cassette{effect('wrapC')}</label>}
          {line === 'roller' && <label className="adm-check"><input type="checkbox" checked={wrapB} onChange={(e) => setWrapB(e.target.checked)} /> No fabric wrap on the bottom rail{effect('wrapB')}</label>}
          {line === 'woven-wood' && <label className="adm-check"><input type="checkbox" checked={coating} onChange={(e) => setCoating(e.target.checked)} /> No coating{effect('coating')}</label>}
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
          {res.double_stack ? (<>
            <Breakdown r={res.front} title="Front shade" group={res.price_group?.name} />
            <Breakdown r={res.back} title="Back shade" group={res.back_price_group?.name} />
            <div className="adm-card"><table className="adm-kv"><tbody>
              <tr><th>Front + back, after markup</th><td>{money(res.price_before_extra ?? res.price, 0)}</td></tr>
              <tr><th>Extra cost (front + back colors)</th><td>+{money(res.extra_cost ?? 0)} <span className="adm-muted adm-small">(added after the markup)</span></td></tr>
              <tr><th>Customer price</th><td><strong className="adm-price">{money(res.price, 0)}</strong></td></tr>
            </tbody></table></div>
            <p className="adm-muted">Double-stack = front price + back price.</p></>)
            : (res.grid && <Breakdown r={res} group={res.price_group?.name || (chosen ? chosen.fabric.collection_name : fabrics.find((f) => f.id === fabric)?.collection_name)}
                final={res.price_group ? { before: res.price_before_extra, extra: res.extra_cost, price: res.price } : null} />)}
        </>
      )}
    </div>
  );
}
