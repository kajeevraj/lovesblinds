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
    </div>
  );
}
