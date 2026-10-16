import { useMemo, useState } from 'react';
import { LINE_LABELS, LINE_ORDER, ROLLER_FAMILIES, FAMILY_LABELS } from '../lib/constants.js';
import { collectionToForm, emptyCollection, formToCollection, newCollectionRow, diffPatch } from '../lib/collections.js';
import { insertRow, updateRow } from '../lib/db.js';
import { linesForFabric, publishToSite } from '../lib/livecache.js';
import { explain } from '../lib/errors.js';
import CollectionFields from './CollectionFields.jsx';
import History from './History.jsx';

export default function CollectionEditor({ fabricId, data, onDone, onCancel }) {
  const fabric = useMemo(() => data.fabrics.find((f) => f.id === fabricId) || null, [data.fabrics, fabricId]);
  const isNew = !fabric;
  const [line, setLine] = useState(fabric?.product_line || 'roller');
  const [family, setFamily] = useState(fabric?.family || 'screen-view');
  const [form, setForm] = useState(() => (fabric ? collectionToForm(fabric) : emptyCollection()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [histKey, setHistKey] = useState(0);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const colors = fabric ? data.swatches.filter((s) => s.fabric_id === fabric.id) : [];

  const nameClash = form.name.trim() && data.fabrics.some((f) => f.id !== fabric?.id && f.product_line === line
    && (f.family || null) === (line === 'roller' ? family : null) && f.collection_name.toLowerCase() === form.name.trim().toLowerCase());
  const nameProblem = nameClash ? `A price group called “${form.name.trim()}” already exists in ${LINE_LABELS[line]}.` : '';
  const ok = form.name.trim() && !nameProblem;

  const save = async () => {
    setBusy(true); setError('');
    try {
      if (isNew) {
        await insertRow('fabrics', newCollectionRow(form, line, family, data.fabrics));
        onDone(`Price group “${form.name.trim()}” added. You can add colors to it now.`);
      } else {
        const patch = diffPatch(fabric, formToCollection(form, fabric.extra_specs));
        if (!Object.keys(patch).length) { onDone('Nothing to save: no changes.'); return; }
        await updateRow('fabrics', fabric.id, patch);
        onDone(`Price group “${form.name.trim()}” saved. ${await publishToSite(linesForFabric(data, fabric.id))}`);
      }
    } catch (e) { setError(explain(e, { line, family })); setBusy(false); }
  };

  const toggle = async () => {
    const hide = fabric.active;
    if (hide && !window.confirm(`Hide the price group “${fabric.collection_name}”? All ${colors.filter((c) => c.active).length} of its active colors disappear from the live site until you show it again.`)) return;
    setBusy(true); setError('');
    try {
      await updateRow('fabrics', fabric.id, { active: !fabric.active });
      onDone(`Price group “${fabric.collection_name}” is now ${hide ? 'hidden' : 'visible'}. ${await publishToSite(linesForFabric(data, fabric.id))}`);
    } catch (e) { setError(explain(e)); setBusy(false); }
  };

  return (
    <div className="adm-editor">
      <div className="adm-head">
        <h1>{isNew ? 'Add price group' : fabric.collection_name}</h1>
        <button className="adm-btn" onClick={onCancel}>Back</button>
      </div>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-card">
        {isNew ? (
          <div className="adm-grid2">
            <label className="adm-field"><span>Product line</span>
              <select value={line} onChange={(e) => setLine(e.target.value)}>{LINE_ORDER.map((l) => <option key={l} value={l}>{LINE_LABELS[l]}</option>)}</select>
            </label>
            {line === 'roller' && <label className="adm-field"><span>Family</span>
              <select value={family} onChange={(e) => setFamily(e.target.value)}>{ROLLER_FAMILIES.map((f) => <option key={f} value={f}>{FAMILY_LABELS[f]}</option>)}</select>
            </label>}
          </div>
        ) : (
          <p className="adm-muted">{LINE_LABELS[line]}{fabric.family ? ` · ${FAMILY_LABELS[fabric.family]}` : ''} · {colors.length} colors</p>
        )}
        <label className="adm-field"><span>Price group name <small>(supplier’s name, never shown to customers)</small></span>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!nameProblem} />
          {nameProblem && <em className="adm-field-error">{nameProblem}</em>}
        </label>
        <h2>Specs <small className="adm-muted">Leave blank to not show a spec.</small></h2>
        <CollectionFields value={form} onChange={set} line={line} family={family} />
        <div className="adm-bar">
          <button className="adm-btn adm-btn-primary" disabled={busy || !ok} onClick={save}>{busy ? 'Saving…' : isNew ? 'Add price group' : 'Save changes'}</button>
          {!isNew && <button className="adm-btn" disabled={busy} onClick={toggle}>{fabric.active ? 'Hide price group' : 'Show price group'}</button>}
          <button className="adm-btn adm-btn-quiet" onClick={onCancel}>Cancel</button>
        </div>
        {!isNew && !fabric.active && <p className="adm-muted">This price group is hidden, so none of its colors show on the site.</p>}
      </div>
      {!isNew && <History table="fabrics" rowId={fabric.id} reloadKey={histKey} />}
    </div>
  );
}
