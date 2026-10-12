import { useMemo, useState } from 'react';
import { LINE_LABELS, LINE_ORDER, FAMILY_LABELS, familyNeeded, scopeLabel } from '../lib/constants.js';
import { checkName } from '../lib/validate.js';
import { insertRow, updateRow, deleteRow } from '../lib/db.js';
import { catalogLinesOf } from '../../data/catalogQuery.js';
import { publishToSite } from '../lib/livecache.js';
import { explain } from '../lib/errors.js';

// "Also sold in": the same swatch (one record: same code, same photo, same Hide/Show) placed in other product lines.
// Each placement has its own display name and its own collection, which is that line's price collection.
export default function LinkedLines({ swatch, data, reload }) {
  const links = useMemo(() => (data.links || []).filter((l) => l.swatch_id === swatch.id), [data.links, swatch.id]);
  const fabricById = useMemo(() => new Map(data.fabrics.map((f) => [f.id, f])), [data.fabrics]);
  const taken = new Set([swatch.product_line, ...links.map((l) => l.product_line)]);
  const freeLines = LINE_ORDER.filter((l) => !taken.has(l));

  const [line, setLine] = useState('');
  const [fabricId, setFabricId] = useState('');
  const [cellFamily, setCellFamily] = useState('light-filtering');
  const [name, setName] = useState(swatch.display_name);
  const [edit, setEdit] = useState({});          // link id -> new display name
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fabric = fabricById.get(fabricId) || null;
  const family = line === 'roller' ? fabric?.family || null : line === 'cellular' ? cellFamily : null;
  const lineFabrics = data.fabrics.filter((f) => f.product_line === line);
  const problem = line && fabric ? checkName(name, { line, family, selfId: swatch.id, swatches: data.swatches, fabrics: data.fabrics, links: data.links, selfLinkId: null }) : '';
  const canAdd = !busy && line && fabricId && name.trim() && !problem;

  const done = async (msg, lines) => { setNotice(`${msg} ${await publishToSite(lines)}`); await reload(); };

  const add = async () => {
    setBusy('add'); setError(''); setNotice('');
    try {
      const sort = Math.max(-1, ...(data.links || []).filter((l) => l.fabric_id === fabricId).map((l) => l.sort_order), ...data.swatches.filter((s) => s.fabric_id === fabricId).map((s) => s.sort_order)) + 1;
      await insertRow('swatch_links', { swatch_id: swatch.id, fabric_id: fabricId, display_name: name.trim(), family: line === 'cellular' ? cellFamily : null, sort_order: sort });
      const lines = catalogLinesOf(fabric.shown_in);
      setLine(''); setFabricId(''); setName(swatch.display_name);
      await done(`Linked into ${LINE_LABELS[fabric.product_line]} as “${name.trim()}”.`, lines);
    } catch (e) { setError(explain(e, { line, family })); }
    setBusy('');
  };

  const rename = async (l) => {
    setBusy(l.id); setError(''); setNotice('');
    try {
      await updateRow('swatch_links', l.id, { display_name: edit[l.id].trim() });
      setEdit((x) => { const n = { ...x }; delete n[l.id]; return n; });
      await done(`Renamed in ${LINE_LABELS[l.product_line]}.`, catalogLinesOf(fabricById.get(l.fabric_id)?.shown_in));
    } catch (e) { setError(explain(e, { line: l.product_line, family: l.family })); }
    setBusy('');
  };

  const remove = async (l) => {
    if (!window.confirm(`Remove “${l.display_name}” from ${LINE_LABELS[l.product_line]}? The color itself stays in ${LINE_LABELS[swatch.product_line]}. Saved orders keep what they recorded.`)) return;
    setBusy(l.id); setError(''); setNotice('');
    try {
      await deleteRow('swatch_links', l.id);
      await done(`Removed from ${LINE_LABELS[l.product_line]}.`, catalogLinesOf(fabricById.get(l.fabric_id)?.shown_in));
    } catch (e) { setError(explain(e)); }
    setBusy('');
  };

  return (
    <div className="adm-card">
      <h2>Also sold in other lines</h2>
      <p className="adm-muted">This is one color record: the code, photo and Hide/Show are shared, so an edit above shows in every line. In each line it has its own display name and its own collection (that line’s price collection).</p>
      {notice && <p className="adm-notice" role="status">{notice}</p>}
      {error && <p className="adm-error" role="alert">{error}</p>}

      {links.length === 0 ? <p className="adm-muted">Not linked to any other line.</p> : (
        <table className="adm-table">
          <thead><tr><th>Line</th><th>Collection</th><th>Display name there</th><th><span className="adm-sr">Actions</span></th></tr></thead>
          <tbody>
            {links.map((l) => {
              const f = fabricById.get(l.fabric_id);
              const v = edit[l.id] ?? l.display_name;
              const p = edit[l.id] !== undefined ? checkName(v, { line: l.product_line, family: l.family, selfId: swatch.id, swatches: data.swatches, fabrics: data.fabrics, links: data.links, selfLinkId: l.id }) : '';
              return (
                <tr key={l.id}>
                  <td data-label="Line">{scopeLabel(l.product_line, l.family)}</td>
                  <td data-label="Collection">{f?.collection_name}{f && !f.active ? ' (hidden)' : ''}</td>
                  <td data-label="Display name there">
                    <input aria-label={`Display name in ${LINE_LABELS[l.product_line]}`} value={v} onChange={(e) => setEdit({ ...edit, [l.id]: e.target.value })} aria-invalid={!!p} />
                    {p && <em className="adm-field-error">{p}</em>}
                  </td>
                  <td className="adm-actions">
                    <button className="adm-btn adm-btn-sm" disabled={busy === l.id || edit[l.id] === undefined || !!p || !v.trim()} onClick={() => rename(l)}>Save name</button>
                    <button className="adm-btn adm-btn-sm adm-btn-danger" disabled={busy === l.id} onClick={() => remove(l)}>Remove link</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {freeLines.length > 0 && (
        <fieldset className="adm-subcard">
          <legend>Link to another line</legend>
          <div className="adm-grid2">
            <label className="adm-field"><span>Product line</span>
              <select value={line} onChange={(e) => { setLine(e.target.value); setFabricId(''); }}>
                <option value="">Choose a line…</option>
                {freeLines.map((l) => <option key={l} value={l}>{LINE_LABELS[l]}</option>)}
              </select>
            </label>
            <label className="adm-field"><span>Collection in that line <small>(its price collection)</small></span>
              <select value={fabricId} onChange={(e) => setFabricId(e.target.value)} disabled={!line}>
                <option value="">Choose a collection…</option>
                {lineFabrics.map((f) => <option key={f.id} value={f.id}>{f.collection_name}{f.family ? ` (${FAMILY_LABELS[f.family]})` : ''}{f.active ? '' : ' — hidden'}</option>)}
              </select>
            </label>
          </div>
          {line === 'cellular' && (
            <label className="adm-field"><span>Family</span>
              <select value={cellFamily} onChange={(e) => setCellFamily(e.target.value)}>{familyNeeded('cellular').map((f) => <option key={f} value={f}>{FAMILY_LABELS[f]}</option>)}</select>
            </label>
          )}
          <label className="adm-field"><span>Display name in that line <small>(names stay unique per line; no numbers)</small></span>
            <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!problem} autoComplete="off" />
            {problem ? <em className="adm-field-error">{problem}</em> : line && fabric && name.trim() && <em className="adm-field-ok">Looks good in {scopeLabel(line, family)}.</em>}
          </label>
          <div className="adm-bar"><button className="adm-btn adm-btn-primary" disabled={!canAdd} onClick={add}>{busy === 'add' ? 'Linking…' : 'Link this color'}</button></div>
        </fieldset>
      )}
    </div>
  );
}
