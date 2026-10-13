import { useState } from 'react';
import { parseSupplierWorkbook, detectLine } from '../../lib/pricing/parseSupplier.js';
import { mapToFabrics } from '../../lib/pricing/collections.js';
import { diffGrids, diffAdders } from '../../lib/pricing/diff.js';
import { loadLineGridsWithCost, applyImport } from './api.js';
import { explain } from '../lib/errors.js';
import { money } from './util.js';

const sha256 = async (buf) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');

export default function ImportWizard({ data, catalog, reload }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState('');
  const [prev, setPrev] = useState(null); const [lineOverride, setLineOverride] = useState('');

  const readFile = async (file) => {
    setBusy(true); setErr(''); setDone(''); setPrev(null);
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('Choose the supplier .xlsx workbook.');
      const XLSX = (await import('xlsx')).default || (await import('xlsx'));
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheets = {};
      for (const name of wb.SheetNames) {
        if (name.trim() === '--') continue;                        // customer data in the Dream Curtains workbook: never read
        const ws = wb.Sheets[name]; const ref = XLSX.utils.decode_range(ws['!ref']); ref.s = { r: 0, c: 0 }; ref.e.c = Math.min(ref.e.c, 400);
        sheets[name] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: ref });
      }
      const line = lineOverride || detectLine(wb.SheetNames);
      if (!line) throw new Error('Could not tell which product line this workbook is for. Pick the line below and choose the file again.');
      const parsed = parseSupplierWorkbook(line, sheets, file.name);
      const { grids, unmapped, fabricsWithoutGrid } = mapToFabrics(parsed, catalog.fabrics);
      const existing = await loadLineGridsWithCost(line);
      const diff = diffGrids(existing, grids);
      const addDiff = diffAdders(data.adders.filter((a) => a.line_id === line), parsed.adders);
      setPrev({ line, file: file.name, sha: await sha256(buf), grids, parsed, unmapped, fabricsWithoutGrid, diff, addDiff, existingCount: existing.length });
    } catch (e) { setErr(e.message || explain(e)); }
    setBusy(false);
  };

  const apply = async () => {
    setBusy(true); setErr('');
    try {
      const { line, grids, parsed, diff } = prev;
      const toSend = [...diff.added, ...diff.changed.map((c) => c.grid)];
      let batch = [], size = 0; const totals = { grids_added: 0, grids_updated: 0, grids_removed: 0 };
      const flush = async (last) => {
        const r = await applyImport({ p_line: line, p_grids: batch, p_remove_keys: last ? diff.removed.map((g) => g.grid_key) : null, p_adders: last ? parsed.adders : null,
          p_meta: last ? { file_name: prev.file, sha256: prev.sha, summary: { added: diff.added.length, changed: diff.changed.length, removed: diff.removed.length, cells_changed: diff.cellsChanged } } : null });
        for (const k of Object.keys(totals)) totals[k] += r[k] || 0; batch = []; size = 0;
      };
      for (const g of toSend) { const s = JSON.stringify(g).length; if (size + s > 1_500_000 && batch.length) await flush(false); batch.push(g); size += s; }
      await flush(true);
      setDone(`Imported ${prev.file}: ${totals.grids_added} grids added, ${totals.grids_updated} updated, ${totals.grids_removed} removed. Customers are not affected in this stage.`);
      setPrev(null); reload();
    } catch (e) { setErr(explain(e)); }
    setBusy(false);
  };

  const nameOf = (id) => catalog.fabrics.find((f) => f.id === id)?.collection_name || id;
  const d = prev?.diff;
  const nothing = d && !d.added.length && !d.removed.length && !d.changed.length && !prev.addDiff.length;
  return (
    <div>
      <div className="adm-card">
        <h2>Re-import a supplier workbook</h2>
        <p className="adm-muted">Choose the new workbook for a line. You see what would change first; nothing is written until you apply. The "--" tab is never read.</p>
        <div className="adm-grid2">
          <label className="adm-field"><span>Workbook (.xlsx)</span><input type="file" accept=".xlsx" disabled={busy} onChange={(e) => e.target.files[0] && readFile(e.target.files[0])} /></label>
          <label className="adm-field"><span>Line <small>(only if it is not detected)</small></span><select value={lineOverride} onChange={(e) => setLineOverride(e.target.value)}><option value="">Detect from the sheets</option>{data.lines.filter((l) => !['drapery'].includes(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        </div>
        {busy && <p className="adm-muted" aria-busy="true">Working…</p>}
        {err && <p className="adm-error" role="alert">{err}</p>}
        {done && <p className="adm-notice" role="status">{done}</p>}
      </div>
      {prev && (
        <div className="adm-card">
          <h2>Preview: {prev.line}</h2>
          <p><strong>{prev.grids.length}</strong> grids in the file, <strong>{prev.existingCount}</strong> in the database.</p>
          <ul className="adm-diff">
            <li><strong>{d.added.length}</strong> new grids{d.added.length ? `: ${d.added.slice(0, 5).map((g) => g.label).join('; ')}${d.added.length > 5 ? '…' : ''}` : ''}</li>
            <li><strong>{d.removed.length}</strong> grids no longer in the file (will be removed){d.removed.length ? `: ${d.removed.slice(0, 5).map((g) => g.label).join('; ')}${d.removed.length > 5 ? '…' : ''}` : ''}</li>
            <li><strong>{d.changed.length}</strong> grids changed ({d.cellsChanged} cost cells), {d.unchanged.length} identical</li>
            <li><strong>{prev.addDiff.length}</strong> adder changes{prev.addDiff.map((a, i) => <div key={i} className="adm-small">{a.kind === 'new' ? 'new' : a.kind === 'removed' ? 'removed' : `changed from ${money(a.from)}`}: {a.adder.label} {a.adder.amount != null ? money(a.adder.amount) : ''}</div>)}</li>
          </ul>
          {d.changed.some((c) => c.fabAdded.length || c.fabRemoved.length) && (
            <div className="adm-small"><strong>Price groups added to or removed from grids:</strong>
              <ul>{d.changed.filter((c) => c.fabAdded.length || c.fabRemoved.length).map((c, i) => <li key={i}>{c.grid.label}: {c.fabAdded.length ? `+ ${c.fabAdded.map(nameOf).join(', ')} ` : ''}{c.fabRemoved.length ? `− ${c.fabRemoved.map(nameOf).join(', ')}` : ''}</li>)}</ul></div>
          )}
          {d.examples.length > 0 && (
            <table className="adm-table adm-compact"><thead><tr><th>Grid</th><th>Row</th><th>Column</th><th>Was</th><th>Now</th></tr></thead><tbody>
              {d.examples.map((x, i) => <tr key={i}><td data-label="Grid">{x.grid}</td><td data-label="Row">{x.row}</td><td data-label="Column">{x.col}</td><td data-label="Was">{x.from == null ? '—' : money(x.from)}</td><td data-label="Now">{x.to == null ? '—' : money(x.to)}</td></tr>)}
            </tbody></table>
          )}
          {prev.unmapped.length > 0 && <p className="adm-warn">Sheet price groups with no fabric on the site (ignored): {prev.unmapped.map((u) => u.name + (u.family ? ` (${u.family})` : '')).join(', ')}</p>}
          {prev.fabricsWithoutGrid.length > 0 && <p className="adm-warn">Our fabrics with no grid in this file: {prev.fabricsWithoutGrid.map((f) => f.collection_name).join(', ')}</p>}
          {nothing ? <p className="adm-notice">Nothing changed. Nothing to apply.</p> : (
            <div className="adm-bar"><button className="adm-btn adm-btn-primary" disabled={busy} onClick={apply}>Apply this import</button><button className="adm-btn adm-btn-quiet" onClick={() => setPrev(null)}>Cancel</button></div>
          )}
        </div>
      )}
    </div>
  );
}
