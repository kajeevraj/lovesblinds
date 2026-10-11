import { useState } from 'react';
import { patch } from '../pricing/api.js';
import { insertRow } from '../lib/db.js';
import { explain } from '../lib/errors.js';
import { prepareImage, uploadOptionImage, removeOptionImage, optionImageUrl } from '../lib/images.js';
import EXPLAINERS from '../../data/explainers.json';
import History from '../colors/History.jsx';
import { SYSTEM_LABEL } from '../pricing/util.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const when = (w) => Object.entries(w || {}).map(([k, v]) => `${k.replace(/_/g, ' ')} = ${[].concat(v).join('/')}`).join('; ');

function ValueRow({ v, group, siblings, idx, adders, reload, setErr, setMsg }) {
  const [label, setLabel] = useState(v.label); const [expl, setExpl] = useState(v.explanation || ''); const [sys, setSys] = useState(v.grid_system || '');
  const [busy, setBusy] = useState(false); const [open, setOpen] = useState(false);
  const dirty = label !== v.label || expl !== (v.explanation || '') || sys !== (v.grid_system || '');
  const run = async (fn, ok) => { setBusy(true); setErr(''); try { await fn(); if (ok) setMsg(ok); await reload(); } catch (e) { setErr(explain(e)); } setBusy(false); };
  const save = () => run(() => patch('option_values', { id: v.id }, { label: label.trim(), explanation: expl.trim() || null, grid_system: sys || null }), `“${label.trim()}” saved.`);
  const move = (dir) => { const o = siblings[idx + dir]; if (!o) return; run(() => Promise.all([patch('option_values', { id: v.id }, { sort_order: o.sort_order }), patch('option_values', { id: o.id }, { sort_order: v.sort_order })])); };
  const makeDefault = () => run(async () => { const cur = siblings.find((s) => s.is_default && s.id !== v.id); if (cur) await patch('option_values', { id: cur.id }, { is_default: false }); await patch('option_values', { id: v.id }, { is_default: !v.is_default }); }, v.is_default ? 'Default removed.' : `“${v.label}” is now the default.`);
  const upload = async (file) => {
    if (!file) return; setBusy(true); setErr('');
    try { const p = await prepareImage(file); const path = await uploadOptionImage(group.line_id, `${group.key}-${v.code}`, p); const old = v.image_path; await patch('option_values', { id: v.id }, { image_path: path }); await removeOptionImage(old); setMsg('Picture uploaded.'); await reload(); }
    catch (e) { setErr(e.message || explain(e)); } setBusy(false);
  };
  const removeImg = () => run(async () => { const old = v.image_path; await patch('option_values', { id: v.id }, { image_path: null }); await removeOptionImage(old); }, 'Picture removed; the built-in picture (if any) shows again.');
  const staticImg = v.image_key && EXPLAINERS[v.image_key]?.src;
  const shown = v.image_path ? optionImageUrl(v.image_path) : staticImg;
  const linked = group.key === 'control' ? adders.filter((a) => [].concat(a.applies_when?.control || []).includes(v.code)) : [];
  return (
    <tr className={v.active ? '' : 'is-hidden'}>
      <td data-label="Picture">{shown ? <img className="adm-thumb" src={shown} alt="" width="48" height="48" loading="lazy" /> : <div className="adm-thumb adm-thumb-empty" />}</td>
      <td data-label="Label"><input aria-label="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input aria-label="One-line explanation" className="adm-mt" value={expl} onChange={(e) => setExpl(e.target.value)} placeholder="One-line explanation" />
        <div className="adm-muted adm-small">code <code>{v.code}</code>{v.image_path ? ' · uploaded picture' : staticImg ? ' · built-in picture' : ' · no picture'}</div>
        {open && <div className="adm-mt"><label className="adm-field"><span>Picture</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files[0])} /></label>
          {v.image_path && <button className="adm-link" onClick={removeImg}>Remove uploaded picture</button>}</div>}
        <button className="adm-link adm-small" onClick={() => setOpen(!open)}>{open ? 'Hide picture options' : 'Change picture'}</button></td>
      {group.key === 'control' && <td data-label="Price grid">
        <select aria-label="Price grid system" value={sys} onChange={(e) => setSys(e.target.value)}><option value="">None</option>{Object.entries(SYSTEM_LABEL).map(([k, l]) => <option key={k} value={k}>{l} grid</option>)}</select>
        <div className="adm-small adm-muted">{linked.length ? `+ adders: ${linked.map((a) => `${a.kind === 'add' ? '+' : '−'}$${Number(a.amount ?? 0)} ${a.label}${when({ ...a.applies_when, control: undefined }) ? ` (${when({ ...a.applies_when, control: undefined })})` : ''}`).join('; ')}` : 'no adders'}</div></td>}
      <td data-label="Default"><label className="adm-check"><input type="radio" name={`def-${group.id}`} checked={v.is_default} readOnly onClick={makeDefault} disabled={busy} /> Default</label></td>
      <td className="adm-actions">
        <button className="adm-btn adm-btn-sm" disabled={!dirty || busy} onClick={save}>Save</button>{' '}
        <button className="adm-btn adm-btn-sm" disabled={busy} onClick={() => run(() => patch('option_values', { id: v.id }, { active: !v.active }), `“${v.label}” is now ${v.active ? 'hidden' : 'visible'}.`)}>{v.active ? 'Hide' : 'Show'}</button>{' '}
        <button className="adm-btn adm-btn-sm" aria-label="Move up" disabled={idx === 0 || busy} onClick={() => move(-1)}>↑</button>{' '}
        <button className="adm-btn adm-btn-sm" aria-label="Move down" disabled={idx === siblings.length - 1 || busy} onClick={() => move(1)}>↓</button></td>
    </tr>
  );
}

function Group({ group, values, adders, reload, setErr, setMsg }) {
  const [label, setLabel] = useState(group.label); const [note, setNote] = useState(group.note || '');
  const [nl, setNl] = useState(''); const [ne, setNe] = useState(''); const [ns, setNs] = useState('');
  const [hist, setHist] = useState(false);
  const saveGroup = async () => { setErr(''); try { await patch('option_groups', { id: group.id }, { label: label.trim(), note: note.trim() || null }); setMsg(`“${label.trim()}” saved.`); reload(); } catch (e) { setErr(explain(e)); } };
  const add = async () => {
    setErr('');
    if (!nl.trim()) { setErr('Give the new option a label.'); return; }
    const code = slug(nl); if (!code) { setErr('Use letters or numbers in the label.'); return; }
    if (values.some((v) => v.code === code)) { setErr('An option with that name already exists in this group.'); return; }
    try { await insertRow('option_values', { id: `${group.id}:${code}`, group_id: group.id, code, label: nl.trim(), explanation: ne.trim() || null, grid_system: ns || null, active: true, is_default: false, sort_order: Math.max(-1, ...values.map((v) => v.sort_order)) + 1 }); setNl(''); setNe(''); setNs(''); setMsg('Option added.'); reload(); } catch (e) { setErr(explain(e)); }
  };
  return (
    <div className="adm-card">
      <h3>{group.label} <span className="adm-muted adm-small">({group.key}){group.bound ? ' · tied to the site’s code or catalog: edit, hide and reorder, but no new options' : ''}</span></h3>
      <div className="adm-grid2">
        <label className="adm-field"><span>Heading customers see</span><input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="adm-field"><span>Note under the cards</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>
      <button className="adm-btn adm-btn-sm" disabled={label === group.label && note === (group.note || '')} onClick={saveGroup}>Save heading and note</button>
      <table className="adm-table adm-options"><thead><tr><th>Picture</th><th>Option</th>{group.key === 'control' && <th>Price grid</th>}<th>Default</th><th /></tr></thead><tbody>
        {values.map((v, i) => <ValueRow key={v.id + v.updated_at} v={v} group={group} siblings={values} idx={i} adders={adders} reload={reload} setErr={setErr} setMsg={setMsg} />)}
      </tbody></table>
      {!group.bound && (
        <div className="adm-subcard"><strong>Add an option</strong>
          <div className="adm-grid3"><label className="adm-field"><span>Label</span><input value={nl} onChange={(e) => setNl(e.target.value)} /></label>
            <label className="adm-field"><span>One-line explanation</span><input value={ne} onChange={(e) => setNe(e.target.value)} /></label>
            {group.key === 'control' && <label className="adm-field"><span>Price grid</span><select value={ns} onChange={(e) => setNs(e.target.value)}><option value="">None</option>{Object.entries(SYSTEM_LABEL).map(([k, l]) => <option key={k} value={k}>{l} grid</option>)}</select></label>}</div>
          <button className="adm-btn adm-btn-sm" onClick={add}>Add option</button> <span className="adm-muted adm-small">Its code is made from the label and never changes; options are hidden, not deleted, so saved orders keep their names.</span></div>
      )}
      <button className="adm-link adm-small" onClick={() => setHist(!hist)}>{hist ? 'Hide' : 'Show'} change history for this group’s options</button>
      {hist && values.slice(0, 1).map((v) => <History key={v.id} table="option_values" rowId={v.id} />)}
    </div>
  );
}

export default function OptionsTab({ line, data, reload }) {
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const groups = data.groups.filter((g) => g.line_id === line.id);
  const pls = data.lines.filter((l) => l.product_line_id === line.id).map((l) => l.id);
  const adders = data.adders.filter((a) => pls.includes(a.line_id));
  if (!groups.length) return <p className="adm-muted">This line has no option groups.</p>;
  return (
    <div>
      {msg && <p className="adm-notice" role="status">{msg}</p>}{err && <p className="adm-error" role="alert">{err}</p>}
      <p className="adm-muted">Values are shown in this order. Hide an option instead of deleting it, so saved orders keep their names. The live site does not read these yet.</p>
      {groups.map((g) => <Group key={g.id} group={g} values={data.values.filter((v) => v.group_id === g.id)} adders={adders} reload={reload} setErr={setErr} setMsg={setMsg} />)}
    </div>
  );
}
