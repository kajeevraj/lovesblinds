import { useMemo } from 'react';
import { LINE_LABELS, FAMILY_LABELS } from '../lib/constants.js';

export default function CollectionList({ data, onEdit }) {
  const counts = useMemo(() => {
    const m = new Map();
    const bump = (fid, active) => { const c = m.get(fid) || { all: 0, active: 0 }; c.all++; if (active) c.active++; m.set(fid, c); };
    for (const s of data.swatches) bump(s.fabric_id, s.active);
    const byId = new Map(data.swatches.map((s) => [s.id, s]));
    for (const l of data.links || []) bump(l.fabric_id, l.active && byId.get(l.swatch_id)?.active);   // colors linked into this group's line
    return m;
  }, [data.swatches, data.links]);
  return (
    <table className="adm-table">
      <thead><tr><th>Price group</th><th>Line</th><th>Family</th><th>Colors</th><th>Status</th><th><span className="adm-sr">Actions</span></th></tr></thead>
      <tbody>
        {data.fabrics.map((f) => {
          const c = counts.get(f.id) || { all: 0, active: 0 };
          return (
            <tr key={f.id} className={f.active ? '' : 'is-hidden'}>
              <td data-label="Price group" className="adm-name"><button className="adm-link" onClick={() => onEdit(f.id)}>{f.collection_name}</button></td>
              <td data-label="Line">{LINE_LABELS[f.product_line]}</td>
              <td data-label="Family">{f.family ? FAMILY_LABELS[f.family] : '—'}</td>
              <td data-label="Colors">{c.active} active{c.all !== c.active ? `, ${c.all - c.active} hidden` : ''}</td>
              <td data-label="Status"><span className={`adm-badge ${f.active ? 'is-active' : 'is-off'}`}>{f.active ? 'Active' : 'Hidden'}</span></td>
              <td className="adm-actions"><button className="adm-btn adm-btn-sm" onClick={() => onEdit(f.id)}>Edit</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
