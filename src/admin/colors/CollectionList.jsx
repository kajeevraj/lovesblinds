import { useMemo } from 'react';
import { LINE_LABELS, FAMILY_LABELS } from '../lib/constants.js';

export default function CollectionList({ data, onEdit }) {
  const counts = useMemo(() => {
    const m = new Map();
    for (const s of data.swatches) { const c = m.get(s.fabric_id) || { all: 0, active: 0 }; c.all++; if (s.active) c.active++; m.set(s.fabric_id, c); }
    return m;
  }, [data.swatches]);
  return (
    <table className="adm-table">
      <thead><tr><th>Collection</th><th>Line</th><th>Family</th><th>Colors</th><th>Status</th><th><span className="adm-sr">Actions</span></th></tr></thead>
      <tbody>
        {data.fabrics.map((f) => {
          const c = counts.get(f.id) || { all: 0, active: 0 };
          return (
            <tr key={f.id} className={f.active ? '' : 'is-hidden'}>
              <td data-label="Collection" className="adm-name"><button className="adm-link" onClick={() => onEdit(f.id)}>{f.collection_name}</button></td>
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
