import { useCallback, useEffect, useState } from 'react';
import { loadCatalog } from '../lib/db.js';
import { explain } from '../lib/errors.js';
import { loadPricing } from './api.js';
import PriceChecker from './PriceChecker.jsx';
import Markups from './Markups.jsx';
import GridViewer from './GridViewer.jsx';
import AddersFlags from './AddersFlags.jsx';
import ImportWizard from './ImportWizard.jsx';

const TABS = [['checker', 'Price checker'], ['markups', 'Markups'], ['grids', 'Grids'], ['adders', 'Adders & flags'], ['import', 'Re-import']];

export default function PricingSection() {
  const [data, setData] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('checker');
  const reload = useCallback(async () => {
    try { const [d, c] = await Promise.all([loadPricing(), loadCatalog()]); setData(d); setCatalog(c); setError(''); } catch (e) { setError(explain(e)); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  if (error && !data) return <div className="adm-card"><h1>Pricing</h1><p className="adm-error" role="alert">{error}</p><button className="adm-btn" onClick={reload}>Try again</button></div>;
  if (!data) return <p className="adm-muted" aria-busy="true">Loading pricing…</p>;
  const open = data.flags.filter((f) => !f.resolved && f.kind !== 'info').length;
  return (
    <div>
      <div className="adm-head"><h1>Pricing</h1><span className="adm-muted">Supplier costs, markups and customer prices. Admins only; customers never see costs.</span></div>
      <div className="adm-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-current' : ''} onClick={() => setTab(id)}>
            {label}{id === 'adders' && open > 0 ? ` (${open} to confirm)` : ''}
          </button>
        ))}
      </div>
      {error && <p className="adm-error" role="alert">{error}</p>}
      {tab === 'checker' && <PriceChecker data={data} catalog={catalog} />}
      {tab === 'markups' && <Markups data={data} catalog={catalog} reload={reload} />}
      {tab === 'grids' && <GridViewer data={data} catalog={catalog} reload={reload} />}
      {tab === 'adders' && <AddersFlags data={data} reload={reload} />}
      {tab === 'import' && <ImportWizard data={data} catalog={catalog} reload={reload} />}
    </div>
  );
}
