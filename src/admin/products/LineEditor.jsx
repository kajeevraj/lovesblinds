import { useState } from 'react';
import { patch } from '../pricing/api.js';
import { explain } from '../lib/errors.js';
import History from '../colors/History.jsx';
import OptionsTab from './OptionsTab.jsx';
import SizeRulesTab from './SizeRulesTab.jsx';
import { ZEBRA_DEFAULTS, ZEBRA_LIMITS, cleanBand } from '../../room/zebraBands.js';

export default function LineEditor({ lineId, data, catalog, reload, onBack }) {
  const line = data.productLines.find((l) => l.id === lineId);
  const [tab, setTab] = useState('details');
  const [f, setF] = useState({ name: line.name, blurb: line.blurb, description: line.description, good: (line.good_to_know || []).join('\n'), por: line.price_on_request });
  const hasBands = line.id === 'zebra' && 'band_solid_in' in line;       // false until migration 24 is applied
  const [bands, setBands] = useState({ solid: line.band_solid_in == null ? '' : String(line.band_solid_in), sheer: line.band_sheer_in == null ? '' : String(line.band_sheer_in) });
  const bandProblem = ['solid', 'sheer'].some((k) => bands[k].trim() !== '' && cleanBand(bands[k], null) === null) ? `Each band must be between ${ZEBRA_LIMITS.min} and ${ZEBRA_LIMITS.max} inches (or empty for ${ZEBRA_DEFAULTS.solidIn} and ${ZEBRA_DEFAULTS.sheerIn}).` : '';
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const saveBands = async () => {
    setErr(''); setMsg('');
    if (bandProblem) { setErr(bandProblem); return; }
    try { await patch('product_lines', { id: line.id }, { band_solid_in: bands.solid.trim() === '' ? null : Number(bands.solid), band_sheer_in: bands.sheer.trim() === '' ? null : Number(bands.sheer) }); setMsg('Saved the band widths. Every Zebra color without its own widths uses them.'); reload(); } catch (e) { setErr(explain(e)); }
  };
  const save = async () => {
    setErr(''); setMsg('');
    if (!f.name.trim()) { setErr('The name can’t be empty.'); return; }
    try { await patch('product_lines', { id: line.id }, { name: f.name.trim(), blurb: f.blurb.trim(), description: f.description.trim(), good_to_know: f.good.split('\n').map((s) => s.trim()).filter(Boolean), price_on_request: f.por }); setMsg('Saved. The live site does not read these yet.'); reload(); } catch (e) { setErr(explain(e)); }
  };
  const toggle = async () => { try { await patch('product_lines', { id: line.id }, { active: !line.active }); setMsg(`${line.name} is now ${line.active ? 'hidden' : 'visible'}.`); reload(); } catch (e) { setErr(explain(e)); } };
  return (
    <div className="adm-editor">
      <div className="adm-head"><h1>{line.name}</h1><button className="adm-btn" onClick={onBack}>Back to products</button></div>
      <div className="adm-tabs" role="tablist">
        {[['details', 'Details'], ['options', 'Options'], ['sizes', 'Size rules']].map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-current' : ''} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      {msg && <p className="adm-notice" role="status">{msg}</p>}{err && <p className="adm-error" role="alert">{err}</p>}
      {tab === 'details' && (<>
        <div className="adm-card adm-statusbar"><span className={`adm-badge ${line.active ? 'is-active' : 'is-off'}`}>{line.active ? 'Active' : 'Hidden'}</span>
          <span className="adm-muted">{line.active ? 'Listed on the site.' : 'Not listed on the site.'}</span><button className="adm-btn adm-btn-primary" onClick={toggle}>{line.active ? 'Hide this line' : 'Show this line'}</button></div>
        <div className="adm-card">
          <label className="adm-field"><span>Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="adm-field"><span>Short description</span><input value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} /></label>
          <label className="adm-field"><span>Description</span><textarea rows="3" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
          <label className="adm-field"><span>“Good to know” <small>(one point per line)</small></span><textarea rows="5" value={f.good} onChange={(e) => setF({ ...f, good: e.target.value })} /></label>
          <label className="adm-check"><input type="checkbox" checked={f.por} onChange={(e) => setF({ ...f, por: e.target.checked })} /> Price on request (no prices shown for this line)</label>
          <div className="adm-bar"><button className="adm-btn adm-btn-primary" onClick={save}>Save changes</button></div>
        </div>
        {hasBands && (
          <div className="adm-card" data-testid="line-bands">
            <h2>Zebra bands</h2>
            <p className="adm-muted">The width of the solid and the sheer band, for every Zebra color. A single color can have its own widths (Colors &gt; the color &gt; Texture).</p>
            <div className="adm-grid2">
              <label className="adm-field"><span>Solid band <small>(inches, empty = {ZEBRA_DEFAULTS.solidIn})</small></span><input type="number" aria-label="Line solid band width in inches" min={ZEBRA_LIMITS.min} max={ZEBRA_LIMITS.max} step="0.25" inputMode="decimal" placeholder={String(ZEBRA_DEFAULTS.solidIn)} value={bands.solid} onChange={(e) => setBands({ ...bands, solid: e.target.value })} /></label>
              <label className="adm-field"><span>Sheer band <small>(inches, empty = {ZEBRA_DEFAULTS.sheerIn})</small></span><input type="number" aria-label="Line sheer band width in inches" min={ZEBRA_LIMITS.min} max={ZEBRA_LIMITS.max} step="0.25" inputMode="decimal" placeholder={String(ZEBRA_DEFAULTS.sheerIn)} value={bands.sheer} onChange={(e) => setBands({ ...bands, sheer: e.target.value })} /></label>
            </div>
            {bandProblem && <em className="adm-field-error" role="alert">{bandProblem}</em>}
            <div className="adm-bar"><button className="adm-btn adm-btn-primary" disabled={!!bandProblem} onClick={saveBands}>Save band widths</button></div>
          </div>
        )}
        <History table="product_lines" rowId={line.id} reloadKey={JSON.stringify(line)} />
      </>)}
      {tab === 'options' && <OptionsTab line={line} data={data} reload={reload} />}
      {tab === 'sizes' && <SizeRulesTab line={line} data={data} catalog={catalog} reload={reload} />}
    </div>
  );
}
