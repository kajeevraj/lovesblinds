// Curtain hardware prices: the per-meter price of each track, the shipping rate and the weights. The owner edits them here; the site works the
// customer's price out in the database (hardware_estimate) as  (meters x $/m + shipping + motor + finial) x layers x (1 + the Drapery markup),
// with shipping = weight x $/kg and weight = kg/m x meters + kg per tube x tubes + 3 kg when motorized.
import { useState } from 'react';
import { patch, estimate } from './api.js';
import { explain } from '../lib/errors.js';
import { TRACKS, CURTAIN_STYLES, FINIALS } from '../../lib/hardware.js';

function RateRow({ r, reload, setErr, setMsg }) {
  const [v, setV] = useState(String(r.amount));
  const [busy, setBusy] = useState(false);
  const dirty = Number(v) !== Number(r.amount) && v !== '' && Number(v) >= 0;
  const save = async () => { setBusy(true); setErr(''); try { await patch('hardware_rates', { id: r.id }, { amount: Number(v) }); setMsg(`“${r.label}” saved: ${v} ${r.unit}.`); await reload(); } catch (e) { setErr(explain(e)); } setBusy(false); };
  return (
    <tr>
      <td data-label="Rate">{r.label}{r.note && <div className="adm-small adm-muted">{r.note}</div>}</td>
      <td data-label="Amount"><input aria-label={`${r.label} amount`} type="number" step="0.01" min="0" value={v} onChange={(e) => setV(e.target.value)} /> <span className="adm-muted adm-small">{r.unit}</span></td>
      <td className="adm-actions"><button className="adm-btn adm-btn-sm" disabled={!dirty || busy} onClick={save}>Save</button></td>
    </tr>
  );
}

// the price checker: the same numbers as the site, with the cost parts (admins only)
function Checker() {
  const [f, setF] = useState({ track: 'arc-rail', family: 'pleated', width: '100', layers: 'single', finial: 'classic' });
  const [res, setRes] = useState(null); const [err, setErr] = useState('');
  const run = async () => {
    setErr(''); setRes(null);
    try { setRes(await estimate('hardware_breakdown', { p_options: { track: f.track, style_family: f.family, layers: f.layers, finial: f.finial === 'classic' ? 'classic' : 'premium' }, p_width: Number(f.width) })); }
    catch (e) { setErr(explain(e)); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const money = (n) => `$${Number(n).toFixed(2)}`;
  return (
    <div className="adm-card">
      <h3>Check a price</h3>
      <div className="adm-grid3">
        <label className="adm-field"><span>Track or rod</span><select value={f.track} onChange={set('track')}>{TRACKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className="adm-field"><span>Curtain style type</span><select value={f.family} onChange={set('family')}>
          {['pleated', 'grommet', 'rod-pocket', 'ripple-hook', 'ripple-button'].map((x) => <option key={x} value={x}>{x} ({CURTAIN_STYLES.filter((s) => s.family === x).map((s) => s.label).join(', ').slice(0, 40)})</option>)}</select></label>
        <label className="adm-field"><span>Curtain width (in)</span><input type="number" min="1" value={f.width} onChange={set('width')} /></label>
        <label className="adm-field"><span>Layers</span><select value={f.layers} onChange={set('layers')}><option value="single">Single</option><option value="double">Double</option></select></label>
        <label className="adm-field"><span>Finial</span><select value={f.finial} onChange={set('finial')}>{FINIALS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
      </div>
      <button className="adm-btn adm-btn-sm" onClick={run}>Work it out</button>
      {err && <p className="adm-error" role="alert">{err}</p>}
      {res && res.status === 'ok' && (
        <dl className="adm-small" aria-label="Breakdown">
          <div>Track length: {res.meters} m ({res.tubes} shipping tube{res.tubes === 1 ? '' : 's'}), {res.layers} layer{res.layers === 1 ? '' : 's'}</div>
          <div>Track: {res.meters} m × ${res.per_m}/m = {money(res.track_cost)}</div>
          <div>Weight {res.weight_kg} kg, shipping {money(res.shipping)}; motor {money(res.motor)}; finial {money(res.finial)}</div>
          <div><strong>Our cost: {money(res.cost)}</strong> (before markup) · markup {Math.round(res.markup * 100)}% · <strong>customer price ${res.price}</strong></div>
        </dl>
      )}
      {res && res.status !== 'ok' && <p className="adm-muted">{res.status === 'not_available' ? 'A motorized rail does not go with grommet or rod pocket curtains.' : `No price (${res.status}).`}</p>}
    </div>
  );
}

// one number in a table (tier price, usable width, ship_k), saved on its own
function NumCell({ table, match, field, value, reload, setErr, setMsg, label }) {
  const [v, setV] = useState(String(value));
  const [busy, setBusy] = useState(false);
  const dirty = v !== '' && Number(v) !== Number(value) && Number(v) >= 0;
  const save = async () => { setBusy(true); setErr(''); try { await patch(table, match, { [field]: Number(v) }); setMsg(`${label} saved.`); await reload(); } catch (e) { setErr(explain(e)); } setBusy(false); };
  return <><input aria-label={label} type="number" step="0.001" min="0" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 90 }} />{dirty && <button className="adm-btn adm-btn-sm" disabled={busy} onClick={save} aria-label={`Save ${label}`}>Save</button>}</>;
}

// curtain fabric prices: the tier table (price of one unit at 42 and at 236 in high), each fabric's tier, usable width and shipping rate, and a checker
function CurtainFabric({ data, reload, setErr, setMsg }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState({ code: '', fullness: '2.6', family: 'pleated', lining: 'none', w: '87', h: '84' });
  const [res, setRes] = useState(null); const [e2, setE2] = useState('');
  const shown = data.dFabrics.filter((x) => !q || x.code.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  const run = async () => {
    setE2(''); setRes(null);
    try { setRes(await estimate('drapery_breakdown', { p_swatch: null, p_options: { code: f.code.trim(), fullness: Number(f.fullness), style_family: f.family, lining: f.lining }, p_width: Number(f.w), p_height: Number(f.h) })); } catch (e) { setE2(explain(e)); }
  };
  const money = (n) => `$${Number(n).toFixed(2)}`;
  return (
    <div>
      <h3>Curtain fabric prices</h3>
      <p className="adm-muted">Supplier cost before the markup. Units = ceil(fullness x width / usable width). Fabric = units x (P42 + (P236 - P42) x (height - 42) / 194), x 0.92 for ripple fold. The liner, shipping base and limits are in the rates above. Groups A to D are the supplier's and are not shown to customers.</p>
      <table className="adm-table"><thead><tr><th>Tier</th><th>P42 (one unit, 42 in high)</th><th>P236 (236 in high)</th></tr></thead><tbody>
        {data.dTiers.map((t) => (
          <tr key={t.tier + t.updated_at}><td data-label="Tier">{t.tier}</td>
            <td data-label="P42"><NumCell table="drapery_tiers" match={{ tier: t.tier }} field="p42" value={t.p42} label={`Tier ${t.tier} P42`} reload={reload} setErr={setErr} setMsg={setMsg} /></td>
            <td data-label="P236"><NumCell table="drapery_tiers" match={{ tier: t.tier }} field="p236" value={t.p236} label={`Tier ${t.tier} P236`} reload={reload} setErr={setErr} setMsg={setMsg} /></td></tr>
        ))}
      </tbody></table>
      <h3>Fabrics ({data.dFabrics.length})</h3>
      <label className="adm-field"><span>Find a supplier code</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SP2605" /></label>
      <table className="adm-table"><thead><tr><th>Code</th><th>Group</th><th>Tier</th><th>Usable width (in)</th><th>Shipping rate</th></tr></thead><tbody>
        {shown.map((x) => (
          <tr key={x.code + x.updated_at}><td data-label="Code">{x.code}</td><td data-label="Group">{x.price_group}</td>
            <td data-label="Tier"><NumCell table="drapery_fabrics" match={{ code: x.code }} field="tier" value={x.tier} label={`${x.code} tier`} reload={reload} setErr={setErr} setMsg={setMsg} /></td>
            <td data-label="Usable width"><NumCell table="drapery_fabrics" match={{ code: x.code }} field="usable_width" value={x.usable_width} label={`${x.code} usable width`} reload={reload} setErr={setErr} setMsg={setMsg} /></td>
            <td data-label="Shipping rate"><NumCell table="drapery_fabrics" match={{ code: x.code }} field="ship_k" value={x.ship_k} label={`${x.code} shipping rate`} reload={reload} setErr={setErr} setMsg={setMsg} /></td></tr>
        ))}
      </tbody></table>
      {data.dFabrics.length > shown.length && <p className="adm-muted adm-small">Showing {shown.length}; search to find others.</p>}
      <div className="adm-card">
        <h3>Check a curtain price</h3>
        <div className="adm-grid3">
          <label className="adm-field"><span>Supplier code</span><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="SP26057003" /></label>
          <label className="adm-field"><span>Fullness</span><input type="number" step="0.1" value={f.fullness} onChange={(e) => setF({ ...f, fullness: e.target.value })} /></label>
          <label className="adm-field"><span>Style type</span><select value={f.family} onChange={(e) => setF({ ...f, family: e.target.value })}>{['pleated', 'grommet', 'rod-pocket', 'ripple-hook', 'ripple-button'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="adm-field"><span>Liner</span><select value={f.lining} onChange={(e) => setF({ ...f, lining: e.target.value })}><option value="none">None</option><option value="light-filtering">Light filtering</option><option value="blackout">Blackout</option></select></label>
          <label className="adm-field"><span>Width (in)</span><input type="number" value={f.w} onChange={(e) => setF({ ...f, w: e.target.value })} /></label>
          <label className="adm-field"><span>Height (in)</span><input type="number" value={f.h} onChange={(e) => setF({ ...f, h: e.target.value })} /></label>
        </div>
        <button className="adm-btn adm-btn-sm" onClick={run}>Work it out</button>
        {e2 && <p className="adm-error" role="alert">{e2}</p>}
        {res && res.status === 'ok' && <dl className="adm-small"><div>Group {res.price_group}, tier {res.tier}: {res.units} unit{res.units === 1 ? '' : 's'}</div><div>Fabric {money(res.fabric)} + liner {money(res.liner)} + shipping {money(res.shipping)}</div><div><strong>Our cost {money(res.cost)}</strong> · markup {Math.round(res.markup * 100)}% · <strong>customer price ${res.price}</strong></div></dl>}
        {res && res.status !== 'ok' && <p className="adm-muted">{res.status === 'out_of_range' ? 'Outside 40 to 236 wide or 42 to 236 high: price by email.' : res.status === 'no_fabric_price' ? 'No price for that code yet: price by email.' : `No price (${res.status}).`}</p>}
      </div>
    </div>
  );
}

export default function HardwareRates({ data, reload }) {
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  if (!data.hardware) return <div className="adm-card"><p className="adm-muted">The hardware prices are not in the database yet. Run migration 20 (step A) in the Supabase SQL Editor.</p></div>;
  return (
    <div>
      {msg && <p className="adm-notice" role="status">{msg}</p>}{err && <p className="adm-error" role="alert">{err}</p>}
      <p className="adm-muted">Track prices are per meter of curtain width, before the markup. Shipping is charged by the supplier by weight and is part of our cost. Changes apply to the site within a minute.</p>
      <table className="adm-table"><thead><tr><th>Rate</th><th>Amount</th><th /></tr></thead><tbody>
        {data.hardware.map((r) => <RateRow key={r.id + r.updated_at} r={r} reload={reload} setErr={setErr} setMsg={setMsg} />)}
      </tbody></table>
      <Checker />
      {data.dFabrics && data.dTiers ? <CurtainFabric data={data} reload={reload} setErr={setErr} setMsg={setMsg} /> : <p className="adm-muted">The curtain fabric prices are not in the database yet (migration 20).</p>}
    </div>
  );
}
