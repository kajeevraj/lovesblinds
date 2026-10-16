import { useCallback, useEffect, useState } from 'react';
import { explain } from '../lib/errors.js';
import { loadPricing, patch } from '../pricing/api.js';
import { loadCatalog } from '../lib/db.js';
import LineEditor from './LineEditor.jsx';

export default function ProductsSection() {
  const [data, setData] = useState(null); const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(''); const [sel, setSel] = useState(''); const [msg, setMsg] = useState('');
  const reload = useCallback(async () => { try { const [d, c] = await Promise.all([loadPricing(), loadCatalog()]); setData(d); setCatalog(c); setError(''); } catch (e) { setError(explain(e)); } }, []);
  useEffect(() => { reload(); }, [reload]);
  if (error && !data) return <div className="adm-card"><h1>Products</h1><p className="adm-error" role="alert">{error}</p><button className="adm-btn" onClick={reload}>Try again</button></div>;
  if (!data) return <p className="adm-muted" aria-busy="true">Loading products…</p>;
  if (sel) return <LineEditor key={sel} lineId={sel} data={data} catalog={catalog} reload={reload} onBack={() => setSel('')} />;

  const move = async (l, dir) => {
    const list = data.productLines; const i = list.findIndex((x) => x.id === l.id); const other = list[i + dir]; if (!other) return;
    try { await Promise.all([patch('product_lines', { id: l.id }, { sort_order: other.sort_order }), patch('product_lines', { id: other.id }, { sort_order: l.sort_order })]); reload(); } catch (e) { setError(explain(e)); }
  };
  const toggle = async (l) => { try { await patch('product_lines', { id: l.id }, { active: !l.active }); setMsg(`${l.name} is now ${l.active ? 'hidden' : 'visible'}. Customers see no change yet: the site still reads these options from its code.`); reload(); } catch (e) { setError(explain(e)); } };
  return (
    <div>
      <div className="adm-head"><h1>Products</h1><span className="adm-muted">Product lines, their options and size rules. Edits are stored now; the live site does not read them yet.</span></div>
      {msg && <p className="adm-notice" role="status">{msg}</p>}{error && <p className="adm-error" role="alert">{error}</p>}
      <table className="adm-table"><thead><tr><th>Line</th><th>Short description</th><th>Status</th><th>Price</th><th>Options</th><th /></tr></thead><tbody>
        {data.productLines.map((l, i) => (
          <tr key={l.id} className={l.active ? '' : 'is-hidden'}>
            <td data-label="Line" className="adm-name"><button className="adm-link" onClick={() => setSel(l.id)}>{l.name}</button></td>
            <td data-label="Short description" className="adm-small">{l.blurb || <span className="adm-muted">—</span>}</td>
            <td data-label="Status"><span className={`adm-badge ${l.active ? 'is-active' : 'is-off'}`}>{l.active ? 'Active' : 'Hidden'}</span></td>
            <td data-label="Price">{l.price_on_request ? 'On request' : 'Priced'}</td>
            <td data-label="Options">{data.groups.filter((g) => g.line_id === l.id).length} groups, {data.values.filter((v) => data.groups.some((g) => g.id === v.group_id && g.line_id === l.id)).length} values</td>
            <td className="adm-actions">
              <button className="adm-btn adm-btn-sm" aria-label={`Move ${l.name} up`} disabled={i === 0} onClick={() => move(l, -1)}>↑</button>{' '}
              <button className="adm-btn adm-btn-sm" aria-label={`Move ${l.name} down`} disabled={i === data.productLines.length - 1} onClick={() => move(l, 1)}>↓</button>{' '}
              <button className="adm-btn adm-btn-sm" onClick={() => toggle(l)}>{l.active ? 'Hide' : 'Show'}</button>{' '}
              <button className="adm-btn adm-btn-sm" onClick={() => setSel(l.id)}>Edit</button></td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}
