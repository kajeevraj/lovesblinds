import { useCallback, useEffect, useState } from 'react';
import { loadCatalog } from '../lib/db.js';
import { explain } from '../lib/errors.js';
import ColorList from './ColorList.jsx';
import CollectionList from './CollectionList.jsx';
import ColorEditor from './ColorEditor.jsx';
import CollectionEditor from './CollectionEditor.jsx';


export default function ColorsSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('colors');                // colors | collections
  const [view, setView] = useState({ type: 'list' });      // list | color {id|null} | collection {id|null, then}
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    try { setData(await loadCatalog()); setError(''); }
    catch (e) { setError(explain(e)); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // Reload first, so the list never flashes the old state after a save.
  const back = async (msg) => { if (msg) setNotice(msg); await reload(); setView({ type: 'list' }); window.scrollTo(0, 0); };

  if (error && !data) return <div className="adm-card"><h1>Colors</h1><p className="adm-error" role="alert">{error}</p><button className="adm-btn" onClick={reload}>Try again</button></div>;
  if (!data) return <p className="adm-muted" aria-busy="true">Loading colors…</p>;

  if (view.type === 'color') {
    return <ColorEditor key={view.id || 'new'} swatchId={view.id} data={data} reload={reload}
      onDone={back} onCancel={() => back()}
      onEditCollection={(fid) => setView({ type: 'collection', id: fid, then: view })} />;
  }
  if (view.type === 'collection') {
    return <CollectionEditor key={view.id || 'new'} fabricId={view.id} data={data}
      onDone={async (msg) => { if (view.then) { setNotice(msg || ''); await reload(); setView(view.then); } else back(msg); }}
      onCancel={() => (view.then ? setView(view.then) : back())} />;
  }

  return (
    <div>
      <div className="adm-head">
        <h1>Colors</h1>
        <div className="adm-head-actions">
          <button className="adm-btn" onClick={() => setView({ type: 'collection', id: null })}>Add collection</button>
          <button className="adm-btn adm-btn-primary" onClick={() => setView({ type: 'color', id: null })}>Add color</button>
        </div>
      </div>
      {notice && <p className="adm-notice" role="status">{notice} <button className="adm-link" onClick={() => setNotice('')}>Dismiss</button></p>}
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'colors'} className={tab === 'colors' ? 'is-current' : ''} onClick={() => setTab('colors')}>Colors ({data.swatches.length})</button>
        <button role="tab" aria-selected={tab === 'collections'} className={tab === 'collections' ? 'is-current' : ''} onClick={() => setTab('collections')}>Collections ({data.fabrics.length})</button>
      </div>
      {tab === 'colors'
        ? <ColorList data={data} reload={reload} setNotice={setNotice} setError={setError} onEdit={(id) => setView({ type: 'color', id })} />
        : <CollectionList data={data} onEdit={(id) => setView({ type: 'collection', id })} />}
    </div>
  );
}
