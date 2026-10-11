import { useMemo, useState } from 'react';
import { LINE_LABELS, LINE_ORDER, FAMILY_LABELS } from '../lib/constants.js';
import { COLOR_FAMILY_LIST } from '../../data/colorFamilyList.js';
import { imgUrl, updateRow } from '../lib/db.js';
import { explain } from '../lib/errors.js';
import { LIVE_NOTE } from '../lib/constants.js';

const PAGE = 50;

export default function ColorList({ data, reload, setNotice, setError, onEdit }) {
  const [q, setQ] = useState('');
  const [line, setLine] = useState('');
  const [collection, setCollection] = useState('');
  const [colorFamily, setColorFamily] = useState('');
  const [status, setStatus] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState('');

  const fabricById = useMemo(() => new Map(data.fabrics.map((f) => [f.id, f])), [data.fabrics]);
  const collections = useMemo(() => data.fabrics.filter((f) => !line || f.product_line === line), [data.fabrics, line]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.swatches.filter((s) => {
      if (line && s.product_line !== line) return false;
      if (collection && s.fabric_id !== collection) return false;
      if (colorFamily && s.color_family !== colorFamily) return false;
      if (status === 'active' && !s.active) return false;
      if (status === 'hidden' && s.active) return false;
      if (needle && !(s.display_name.toLowerCase().includes(needle) || s.supplier_code.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [data.swatches, q, line, collection, colorFamily, status]);

  const reset = () => { setQ(''); setLine(''); setCollection(''); setColorFamily(''); setStatus(''); setShown(PAGE); };
  const onFilter = (set) => (e) => { set(e.target.value); setShown(PAGE); };

  const toggle = async (s) => {
    setBusy(s.id);
    try {
      await updateRow('swatches', s.id, { active: !s.active });
      setNotice(`“${s.display_name}” is now ${s.active ? 'hidden' : 'visible'}. ${LIVE_NOTE}`);
      await reload();
    } catch (e) { setError(explain(e)); }
    setBusy('');
  };

  return (
    <div>
      <div className="adm-filters">
        <label className="adm-field adm-search"><span>Search name or code</span>
          <input type="search" value={q} onChange={onFilter(setQ)} placeholder="e.g. Purity or XSS000105" />
        </label>
        <label className="adm-field"><span>Product line</span>
          <select value={line} onChange={(e) => { setLine(e.target.value); setCollection(''); setShown(PAGE); }}>
            <option value="">All lines</option>
            {LINE_ORDER.map((l) => <option key={l} value={l}>{LINE_LABELS[l]}</option>)}
          </select>
        </label>
        <label className="adm-field"><span>Collection</span>
          <select value={collection} onChange={onFilter(setCollection)}>
            <option value="">All collections</option>
            {collections.map((f) => <option key={f.id} value={f.id}>{f.collection_name}{f.family ? ` (${FAMILY_LABELS[f.family]})` : ''}{line ? '' : ` · ${LINE_LABELS[f.product_line]}`}</option>)}
          </select>
        </label>
        <label className="adm-field"><span>Color family</span>
          <select value={colorFamily} onChange={onFilter(setColorFamily)}>
            <option value="">All families</option>
            {COLOR_FAMILY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="adm-field"><span>Status</span>
          <select value={status} onChange={onFilter(setStatus)}>
            <option value="">All statuses</option><option value="active">Active</option><option value="hidden">Hidden</option>
          </select>
        </label>
      </div>
      <p className="adm-muted adm-count" aria-live="polite">
        {rows.length} of {data.swatches.length} colors
        {(q || line || collection || colorFamily || status) && <> · <button className="adm-link" onClick={reset}>Clear filters</button></>}
      </p>

      <table className="adm-table">
        <thead><tr><th>Photo</th><th>Name</th><th>Supplier code</th><th>Collection</th><th>Line</th><th>Family</th><th>Color family</th><th>Status</th><th><span className="adm-sr">Actions</span></th></tr></thead>
        <tbody>
          {rows.slice(0, shown).map((s) => {
            const f = fabricById.get(s.fabric_id);
            const hiddenByCollection = s.active && f && !f.active;
            return (
              <tr key={s.id} className={s.active && !hiddenByCollection ? '' : 'is-hidden'}>
                <td data-label="Photo"><img className="adm-thumb" src={imgUrl(s.thumb_path)} alt="" loading="lazy" width="48" height="48" /></td>
                <td data-label="Name" className="adm-name"><button className="adm-link" onClick={() => onEdit(s.id)}>{s.display_name}</button></td>
                <td data-label="Supplier code"><code>{s.supplier_code}</code></td>
                <td data-label="Collection">{f?.collection_name}</td>
                <td data-label="Line">{LINE_LABELS[s.product_line]}</td>
                <td data-label="Family">{s.family ? FAMILY_LABELS[s.family] : '—'}</td>
                <td data-label="Color family">{s.color_family}</td>
                <td data-label="Status"><span className={`adm-badge ${s.active && !hiddenByCollection ? 'is-active' : 'is-off'}`}>{!s.active ? 'Hidden' : hiddenByCollection ? 'Hidden (collection)' : 'Active'}</span></td>
                <td className="adm-actions">
                  <button className="adm-btn adm-btn-sm" disabled={busy === s.id} onClick={() => toggle(s)}>{s.active ? 'Hide' : 'Show'}</button>
                  <button className="adm-btn adm-btn-sm" onClick={() => onEdit(s.id)}>Edit</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="adm-muted">No colors match.</p>}
      {rows.length > shown && <p><button className="adm-btn" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more</button></p>}
    </div>
  );
}
