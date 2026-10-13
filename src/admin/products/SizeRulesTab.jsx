import { useState } from 'react';
import { patch } from '../pricing/api.js';
import { insertRow, deleteRow } from '../lib/db.js';
import { explain } from '../lib/errors.js';
import { gridLimits, SYSTEM_LABEL } from '../pricing/util.js';
import History from '../colors/History.jsx';

export const ruleMessage = (r) => {
  if (r.message_override) return r.message_override;
  const bits = [];
  if (r.max_width != null) bits.push(`${r.subject} can be up to ${r.max_width} in wide.`);
  if (r.min_width != null) bits.push(`${r.subject} must be at least ${r.min_width} in wide.`);
  if (r.max_height != null) bits.push(`${r.subject} can be up to ${r.max_height} in tall.`);
  if (r.min_height != null) bits.push(`${r.subject} must be at least ${r.min_height} in tall.`);
  return bits.join(' ') || 'No limits set yet.';
};
const nv = (s) => (s === '' || s == null ? null : Number(s));

function Rule({ rule, controls, reload, setErr, setMsg }) {
  const [f, setF] = useState({ subject: rule.subject, controls: rule.when_values?.control || [], min_width: rule.min_width ?? '', max_width: rule.max_width ?? '', min_height: rule.min_height ?? '', max_height: rule.max_height ?? '',
    note: rule.note || '', note_if_width_over: rule.note_if_width_over ?? '', note_if_height_over: rule.note_if_height_over ?? '', message_override: rule.message_override || '', severity: rule.severity, use_fabric_width: rule.use_fabric_width, verified: rule.verified, verified_note: rule.verified_note || '', active: rule.active });
  const [hist, setHist] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setErr('');
    const nums = ['min_width', 'max_width', 'min_height', 'max_height'].map((k) => nv(f[k]));
    if (nums.some((n) => n != null && (!Number.isFinite(n) || n < 0))) { setErr('Limits must be numbers of zero or more.'); return; }
    if ((nums[0] != null && nums[1] != null && nums[0] > nums[1]) || (nums[2] != null && nums[3] != null && nums[2] > nums[3])) { setErr('A minimum can’t be larger than its maximum.'); return; }
    try {
      await patch('size_rules', { id: rule.id }, { subject: f.subject.trim(), when_values: f.controls.length ? { control: f.controls } : {}, min_width: nums[0], max_width: nums[1], min_height: nums[2], max_height: nums[3],
        note: f.note.trim() || null, note_if_width_over: nv(f.note_if_width_over), note_if_height_over: nv(f.note_if_height_over), message_override: f.message_override.trim() || null, severity: f.severity, use_fabric_width: f.use_fabric_width,
        verified: f.verified, verified_note: f.verified_note.trim() || null, active: f.active });
      setMsg('Size rule saved. Unverified rules are never shown to customers.'); reload();
    } catch (e) { setErr(explain(e)); }
  };
  const del = async () => { if (!window.confirm(`Delete the rule “${rule.subject}”?`)) return; try { await deleteRow('size_rules', rule.id); reload(); } catch (e) { setErr(explain(e)); } };
  const preview = ruleMessage({ ...f, min_width: nv(f.min_width), max_width: nv(f.max_width), min_height: nv(f.min_height), max_height: nv(f.max_height) });
  return (
    <div className="adm-card">
      <div className="adm-head-sm"><strong>{rule.subject}</strong> {rule.verified ? <span className="adm-badge is-active">Verified</span> : <span className="adm-badge is-off">Unverified</span>} {!rule.active && <span className="adm-badge is-off">Off</span>}</div>
      <div className="adm-grid2">
        <label className="adm-field"><span>Who it is about <small>(used in the message)</small></span><input value={f.subject} onChange={(e) => set({ subject: e.target.value })} /></label>
        <div className="adm-field"><span>Applies when the control is <small>(none ticked = always)</small></span>
          <div>{controls.map((c) => <label key={c.code} className="adm-check"><input type="checkbox" checked={f.controls.includes(c.code)} onChange={(e) => set({ controls: e.target.checked ? [...f.controls, c.code] : f.controls.filter((x) => x !== c.code) })} /> {c.label}</label>)}</div></div>
      </div>
      <div className="adm-grid4">
        {[['min_width', 'Min width (in)'], ['max_width', 'Max width (in)'], ['min_height', 'Min height (in)'], ['max_height', 'Max height (in)']].map(([k, l]) => <label key={k} className="adm-field"><span>{l}</span><input type="number" step="0.1" min="0" value={f[k]} onChange={(e) => set({ [k]: e.target.value })} /></label>)}
      </div>
      <div className="adm-grid3">
        <label className="adm-field"><span>Note to the customer</span><input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Fixed width above 100 in" /></label>
        <label className="adm-field"><span>Show the note when width is over</span><input type="number" step="0.1" value={f.note_if_width_over} onChange={(e) => set({ note_if_width_over: e.target.value })} /></label>
        <label className="adm-field"><span>…or when height is over</span><input type="number" step="0.1" value={f.note_if_height_over} onChange={(e) => set({ note_if_height_over: e.target.value })} /></label>
      </div>
      <label className="adm-field"><span>Your own message <small>(leave empty to use the automatic one)</small></span><input value={f.message_override} onChange={(e) => set({ message_override: e.target.value })} /></label>
      <p className="adm-preview">Customer message: <strong>{preview}</strong></p>
      <div className="adm-grid3">
        <label className="adm-field"><span>When the size is outside</span><select value={f.severity} onChange={(e) => set({ severity: e.target.value })}><option value="block">Block adding to the order</option><option value="warn">Only warn</option></select></label>
        <label className="adm-check"><input type="checkbox" checked={f.use_fabric_width} onChange={(e) => set({ use_fabric_width: e.target.checked })} /> Also cap the width at the chosen fabric’s “Max width”</label>
        <label className="adm-check"><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Rule is on</label>
      </div>
      <div className="adm-grid2">
        <label className="adm-check"><input type="checkbox" checked={f.verified} onChange={(e) => set({ verified: e.target.checked })} /> Verified: I have confirmed these numbers</label>
        <label className="adm-field"><span>Where the numbers come from</span><input value={f.verified_note} onChange={(e) => set({ verified_note: e.target.value })} /></label>
      </div>
      <div className="adm-bar"><button className="adm-btn adm-btn-primary" onClick={save}>Save rule</button><button className="adm-btn" onClick={del}>Delete rule</button><button className="adm-link" onClick={() => setHist(!hist)}>{hist ? 'Hide' : 'Show'} history</button></div>
      {hist && <History table="size_rules" rowId={rule.id} />}
    </div>
  );
}

export default function SizeRulesTab({ line, data, reload }) {
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const plines = data.lines.filter((l) => l.product_line_id === line.id);
  const controlGroup = data.groups.find((g) => g.line_id === line.id && g.key === 'control');
  const controls = controlGroup ? data.values.filter((v) => v.group_id === controlGroup.id) : [];
  const rules = data.rules.filter((r) => r.line_id === line.id);

  // limits straight from the grids, one row per pricing line, system, variant and lining
  const rows = [];
  for (const pl of plines) {
    const groups = new Map();
    for (const g of data.grids.filter((x) => x.line_id === pl.id)) {
      const key = `${g.systems.join('+')}|${g.variant}|${g.lining || ''}|${g.special ? 's' : ''}`; const lim = gridLimits(g);
      const cur = groups.get(key) || { pl, g, minW: Infinity, maxW: 0, minH: Infinity, maxH: 0, n: 0 };
      cur.minW = Math.min(cur.minW, lim.minW); cur.maxW = Math.max(cur.maxW, lim.maxW); cur.minH = Math.min(cur.minH, lim.minH); cur.maxH = Math.max(cur.maxH, lim.maxH); cur.n++; groups.set(key, cur);
    }
    rows.push(...groups.values());
  }
  const add = async () => {
    setErr('');
    try { await insertRow('size_rules', { line_id: line.id, subject: `${line.name}`, when_values: {}, source: 'manual', verified: false }); setMsg('Rule added (unverified).'); reload(); } catch (e) { setErr(explain(e)); }
  };
  return (
    <div>
      {msg && <p className="adm-notice" role="status">{msg}</p>}{err && <p className="adm-error" role="alert">{err}</p>}
      <div className="adm-card">
        <h2>Limits from the supplier price grids</h2>
        {rows.length === 0 ? <p className="adm-muted">This line has no price grid, so there are no limits from grids.</p> : (<>
          <p className="adm-muted">These come straight from the grids (read-only). A size past them has no estimate (“custom size”). Per-price group limits (roll width, “Max Length”) are on each grid.</p>
          <table className="adm-table"><thead><tr><th>Pricing line</th><th>System</th><th>Variant</th><th>Width (in)</th><th>Height / drop (in)</th><th>Grids</th><th>Source</th></tr></thead><tbody>
            {rows.map((r, i) => <tr key={i}><td data-label="Pricing line">{r.pl.name}</td><td data-label="System">{r.g.systems.map((s) => SYSTEM_LABEL[s]).join(' + ')}{r.g.special ? ' (special sizes)' : ''}</td><td data-label="Variant">{[r.g.variant !== 'all' ? r.g.variant : '', r.g.lining || ''].filter(Boolean).join(' · ') || '—'}</td>
              <td data-label="Width">{r.minW}–{r.maxW}</td><td data-label="Height / drop">{r.minH}–{r.maxH}</td><td data-label="Grids">{r.n}</td><td data-label="Source"><span className="adm-badge is-active">From grid</span></td></tr>)}
          </tbody></table></>)}
      </div>
      <h2>Rules you set</h2>
      <p className="adm-muted">Anything that does not come from a grid is marked <span className="adm-badge is-off">Unverified</span> until you confirm it. Unverified rules are not shown to customers.</p>
      {rules.map((r) => <Rule key={r.id + r.updated_at} rule={r} controls={controls} reload={reload} setErr={setErr} setMsg={setMsg} />)}
      <button className="adm-btn" onClick={add}>Add a size rule</button>
    </div>
  );
}
