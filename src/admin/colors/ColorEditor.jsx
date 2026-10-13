import { useEffect, useMemo, useState } from 'react';
import { LINE_LABELS, LINE_ORDER, FAMILY_LABELS, GRADES, ROMAN_STYLE_LIST, LINING_LIST, familyNeeded, scopeLabel } from '../lib/constants.js';
import { COLOR_FAMILY_LIST } from '../../data/colorFamilyList.js';
import { suggestColorFamily } from '../../lib/colorFamily.js';
import { prepareImage, uploadPrepared, removePaths } from '../lib/images.js';
import { checkName, checkCode } from '../lib/validate.js';
import { emptyCollection, newCollectionRow, diffPatch } from '../lib/collections.js';
import { imgUrl, insertRow, updateRow, deleteRow, swatchOrderCount, setSwatchLines } from '../lib/db.js';
import { explain } from '../lib/errors.js';
import CollectionFields from './CollectionFields.jsx';
import History from './History.jsx';
import { linesForSwatch, publishToSite } from '../lib/livecache.js';
import { catalogLinesOf } from '../../data/catalogQuery.js';

const NEW = '__new__';
const blankRoman = () => Object.fromEntries(ROMAN_STYLE_LIST.map((s) => [s.id, { available: false, linings: [] }]));
const normRoman = (r) => Object.fromEntries(ROMAN_STYLE_LIST.map((s) => [s.id, { available: !!r?.[s.id]?.available, linings: [...(r?.[s.id]?.linings || [])] }]));
const swatchId = (line, family, code) => {
  const c = code.trim().replace(/\s+/g, '-');
  return line === 'roller' || line === 'cellular' ? `${line}:${family}:${c}` : `${line}:${c}`;
};
const byOrder = (a, b) => a.sort_order - b.sort_order || a.collection_name.localeCompare(b.collection_name);

export default function ColorEditor({ swatchId: editId, data, reload, onDone, onCancel, onEditCollection }) {
  const existing = useMemo(() => data.swatches.find((s) => s.id === editId) || null, [data.swatches, editId]);
  const isNew = !existing;
  const exLinks = useMemo(() => (existing ? (data.links || []).filter((l) => l.swatch_id === existing.id) : []), [data.links, existing]);
  const exStyleB = existing?.styles?.find((s) => s.style === 'B') || null;

  // The lines this color is in, and the price group each one uses (null = that line's standard group).
  const exPlacements = useMemo(() => (existing ? [{ line: existing.product_line, fabricId: existing.fabric_id, family: existing.family }, ...exLinks.map((l) => ({ line: l.product_line, fabricId: l.fabric_id, family: l.family }))] : []), [existing, exLinks]);
  const [lines, setLines] = useState(() => exPlacements.map((p) => p.line));
  const [groupSel, setGroupSel] = useState(() => Object.fromEntries(exPlacements.map((p) => [p.line, p.fabricId])));
  const [cellFamily, setCellFamily] = useState(exPlacements.find((p) => p.line === 'cellular')?.family || 'light-filtering');
  const [newColl, setNewColl] = useState(emptyCollection());
  const [newCollFamily, setNewCollFamily] = useState('screen-view');
  const [name, setName] = useState(existing?.display_name || '');
  const [code, setCode] = useState(existing?.supplier_code || '');
  const [suppName, setSuppName] = useState(existing?.supplier_color_name || '');
  const [extra, setExtra] = useState(String(existing?.extra_cost ?? 0));
  const [colorFamily, setColorFamily] = useState(existing?.color_family || '');
  const [cfManual, setCfManual] = useState(!!existing);
  const [grade, setGrade] = useState(existing?.grade || '');
  const [width, setWidth] = useState(existing?.width || '');
  const [composition, setComposition] = useState(existing?.composition || '');
  const [roman, setRoman] = useState(() => (existing?.roman_styles ? normRoman(existing.roman_styles) : blankRoman()));
  const [bCode, setBCode] = useState(exStyleB?.code || '');
  const [photo, setPhoto] = useState(null);          // prepared main photo
  const [photoB, setPhotoB] = useState(null);        // prepared Style B photo
  const [photoErr, setPhotoErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [histKey] = useState(0);
  const [del, setDel] = useState(null);              // null | { checking } | { count } | { confirm }

  useEffect(() => () => { photo && URL.revokeObjectURL(photo.previewUrl); }, [photo]);
  useEffect(() => () => { photoB && URL.revokeObjectURL(photoB.previewUrl); }, [photoB]);

  const fabricById = useMemo(() => new Map(data.fabrics.map((f) => [f.id, f])), [data.fabrics]);
  // the line's standard price group: its first group by sort order (Roller: of the color's family, else Solar)
  const defaultGroup = (l) => {
    const fam = l === 'roller' ? (['screen-view', 'solar', 'blackout'].includes(existing?.family) ? existing.family : 'solar') : null;
    return data.fabrics.filter((f) => f.product_line === l && f.active && (!fam || f.family === fam)).sort(byOrder)[0]?.id || '';
  };
  const groupOf = (l) => groupSel[l] || defaultGroup(l);
  const lineOrdered = LINE_ORDER.filter((l) => lines.includes(l));
  const mainLine = isNew ? (lineOrdered[0] || '') : existing.product_line;       // the color's own line: photos live under it
  const line = mainLine || 'roller';
  const creatingColl = isNew && groupSel[mainLine] === NEW;
  const famOf = (l) => (l === 'roller' ? fabricById.get(groupOf(l))?.family || null : l === 'cellular' ? cellFamily : null);
  const dream = lines.includes('dream-curtains');
  const showRoman = lines.includes('drapery');
  const trimmedName = name.trim();
  const mainFabric = !creatingColl && mainLine ? fabricById.get(groupOf(mainLine)) || null : null;

  const toggleLine = (l) => setLines((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  // Color family: suggested from the photo (and the supplier color name) until the person picks one.
  const suggestion = useMemo(() => (photo ? suggestColorFamily({ ...photo.pixels, line, colorName: suppName }) : null), [photo, line, suppName]);
  useEffect(() => { if (suggestion && !cfManual) setColorFamily(suggestion.family); }, [suggestion, cfManual]);

  // the name and code must be free in EVERY line ticked (a clash names the other color)
  const nameProblem = lineOrdered.map((l) => checkName(name, { line: l, family: famOf(l), selfId: existing?.id, swatches: data.swatches, fabrics: data.fabrics, links: data.links })).find(Boolean) || '';
  const codeProblem = lineOrdered.map((l) => checkCode(code, { line: l, selfId: existing?.id, swatches: data.swatches, links: data.links })).find(Boolean) || '';
  const bProblem = bCode.trim() && dream ? checkCode(bCode, { line: 'dream-curtains', selfId: existing?.id, swatches: data.swatches, links: data.links }) || (bCode.trim().toLowerCase() === code.trim().toLowerCase() ? 'Style B needs its own code.' : '') : '';
  const romanProblem = showRoman && ROMAN_STYLE_LIST.some((s) => roman[s.id].available && roman[s.id].linings.length === 0) ? 'Pick at least one lining for each available Roman style.' : '';
  const collNameClash = creatingColl && newColl.name.trim() && data.fabrics.some((f) => f.product_line === mainLine && (f.family || null) === (mainLine === 'roller' ? newCollFamily : null) && f.collection_name.toLowerCase() === newColl.name.trim().toLowerCase());
  const extraNum = Number(extra);
  const extraProblem = extra.trim() === '' || !Number.isFinite(extraNum) || extraNum < 0 ? 'Enter 0 or more.' : '';

  const noGroup = lineOrdered.filter((l) => !(creatingColl && l === mainLine) && !groupOf(l));
  const missing = [];
  if (!lines.length) missing.push('at least one product line');
  noGroup.forEach((l) => missing.push(`a price group for ${LINE_LABELS[l]}`));
  if (creatingColl && !newColl.name.trim()) missing.push('the new price group’s name');
  if (!trimmedName) missing.push('a display name');
  if (!code.trim()) missing.push('a supplier code');
  if (isNew && !photo) missing.push('a photo');
  if (!colorFamily) missing.push('a color family');
  const problems = [nameProblem, codeProblem, bProblem, romanProblem, extraProblem, collNameClash && 'That price group name is already used in this line.'].filter(Boolean);
  const canSave = !busy && missing.length === 0 && problems.length === 0;

  const choosePhoto = (which) => async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setPhotoErr('');
    try {
      const p = await prepareImage(file);
      which === 'B' ? setPhotoB(p) : setPhoto(p);
      if (which !== 'B' && isNew) setCfManual(false);   // an existing color keeps its family; the suggestion is offered, not applied
    } catch (err) { setPhotoErr(err.message); }
  };

  const buildStyles = async (mainPaths) => {
    // Dream Curtains: Style A is the main photo; Style B optional (reuses A's photo until a real one is uploaded).
    if (!dream || !bCode.trim()) return { styles: null, uploaded: [] };
    const uploaded = [];
    let b;
    if (photoB) { b = await uploadPrepared(line, bCode, photoB); uploaded.push(b.image_path, b.thumb_path); }
    else if (exStyleB) b = { image_path: exStyleB.image_path, thumb_path: exStyleB.thumb_path };
    else b = { image_path: mainPaths.image_path, thumb_path: mainPaths.thumb_path };
    return {
      styles: [{ style: 'A', code: code.trim(), image_path: mainPaths.image_path, thumb_path: mainPaths.thumb_path },
        { style: 'B', code: bCode.trim(), image_path: b.image_path, thumb_path: b.thumb_path }],
      uploaded,
    };
  };

  // the lines (with their price groups) as the database call wants them
  const wantedLines = (mainGroupId) => lineOrdered.map((l) => ({ product_line: l, fabric_id: l === mainLine && mainGroupId ? mainGroupId : groupOf(l), family: l === 'cellular' ? cellFamily : null }));
  const linesChanged = () => {
    const now = wantedLines();
    if (now.length !== exPlacements.length) return true;
    return now.some((w) => { const p = exPlacements.find((x) => x.line === w.product_line); return !p || p.fabricId !== w.fabric_id || (w.product_line === 'cellular' && (p.family || null) !== w.family); });
  };

  const save = async () => {
    setBusy(true); setError('');
    const uploaded = [];
    let createdFabricId = null, createdSwatchId = null;
    try {
      let mainGroup = null;
      if (isNew) {
        // 1. the main line's price group (new or existing)
        mainGroup = mainFabric;
        if (creatingColl) {
          mainGroup = await insertRow('fabrics', newCollectionRow(newColl, mainLine, newCollFamily, data.fabrics));
          createdFabricId = mainGroup.id;
        }
      }
      // 2. photos
      let main = existing ? { image_path: existing.image_path, thumb_path: existing.thumb_path } : null;
      if (photo) { main = await uploadPrepared(line, code, photo); uploaded.push(main.image_path, main.thumb_path); }
      const { styles, uploaded: upB } = await buildStyles(main); uploaded.push(...upB);
      const fields = {
        display_name: trimmedName, supplier_code: code.trim(), supplier_color_name: suppName.trim() || null,
        color_family: colorFamily, image_path: main.image_path, thumb_path: main.thumb_path,
        grade: showRoman || existing?.grade ? (grade || null) : null,
        width: width.trim() || null, composition: composition.trim() || null,
        roman_styles: showRoman ? roman : (existing?.roman_styles ?? null),
        styles: dream ? styles : (existing?.styles ?? null),
        extra_cost: extraNum,
      };
      if (isNew) {
        const sort = Math.max(-1, ...data.swatches.filter((s) => s.product_line === mainLine).map((s) => s.sort_order)) + 1;
        const fam = mainLine === 'roller' ? mainGroup.family : mainLine === 'cellular' ? cellFamily : null;
        const id = swatchId(mainLine, fam, code);
        if (data.swatches.some((s) => s.id === id)) throw new Error('A color with that id already exists. Change the supplier code.');
        await insertRow('swatches', { id, ...fields, fabric_id: mainGroup.id, product_line: mainGroup.product_line, shown_in: mainGroup.shown_in, family: fam,
          image_kind: dream && mainLine === 'dream-curtains' ? 'hero' : 'swatch', active: true, sort_order: sort });
        createdSwatchId = id;
        if (lineOrdered.length > 1) await setSwatchLines(id, wantedLines(mainGroup.id));
        const all = lineOrdered.flatMap((l) => catalogLinesOf(fabricById.get(l === mainLine ? mainGroup.id : groupOf(l))?.shown_in || mainGroup.shown_in));
        onDone(`Added “${trimmedName}”${lineOrdered.length > 1 ? ` to ${lineOrdered.map((l) => LINE_LABELS[l]).join(', ')}` : ''}. ${await publishToSite(all)}`);
      } else {
        const patch = diffPatch(existing, fields);
        const changedLines = linesChanged();
        if (!Object.keys(patch).length && !changedLines) { onDone('Nothing to save: no changes.'); return; }
        const before = linesForSwatch(data, existing.id);
        if (Object.keys(patch).length) await updateRow('swatches', existing.id, patch);
        if (changedLines) await setSwatchLines(existing.id, wantedLines());
        // the replaced photos are no longer used by this color
        const old = [];
        if (photo) old.push(existing.image_path, existing.thumb_path);
        if (photoB && exStyleB) old.push(exStyleB.image_path, exStyleB.thumb_path);
        if (dream && existing.styles && !styles) old.push(...existing.styles.flatMap((s) => [s.image_path, s.thumb_path]));
        const keep = new Set([fields.image_path, fields.thumb_path, ...(styles || []).flatMap((s) => [s.image_path, s.thumb_path])]);
        await removePaths(old.filter((p) => !keep.has(p)));
        const after = lineOrdered.flatMap((l) => catalogLinesOf(fabricById.get(groupOf(l))?.shown_in));
        onDone(`Saved “${trimmedName}”. ${await publishToSite([...before, ...after])}`);
      }
    } catch (e) {
      // nothing half-saved: take back what this attempt uploaded or created
      await removePaths(uploaded);
      if (createdSwatchId) { try { await deleteRow('swatches', createdSwatchId); } catch { /* leave it; visible in the list */ } }
      if (createdFabricId) { try { await deleteRow('fabrics', createdFabricId); } catch { /* leave it; harmless and visible under Price groups */ } }
      setError(explain(e, { line, family: famOf(line) }));
      setBusy(false);
    }
  };

  const linkedHere = exLinks;
  const toggleActive = async () => {
    setBusy(true); setError('');
    try {
      await updateRow('swatches', existing.id, { active: !existing.active });
      onDone(`“${existing.display_name}” is now ${existing.active ? 'hidden' : 'visible'}${linkedHere.length ? ' in every line it is in' : ''}. ${await publishToSite(linesForSwatch(data, existing.id))}`);
    } catch (e) { setError(explain(e)); setBusy(false); }
  };

  const startDelete = async () => {
    setDel({ checking: true }); setError('');
    try { const n = await swatchOrderCount(existing.id); setDel(n > 0 ? { count: n } : { confirm: true }); }
    catch (e) { setDel(null); setError(explain(e)); }
  };
  const doDelete = async () => {
    setBusy(true); setError('');
    try {
      const touched = linesForSwatch(data, existing.id);      // read before the delete: its links go with it
      await deleteRow('swatches', existing.id);
      await removePaths([existing.image_path, existing.thumb_path, ...(existing.styles || []).flatMap((s) => [s.image_path, s.thumb_path])]);
      onDone(`Deleted “${existing.display_name}”${linkedHere.length ? ' from every line' : ''}. ${await publishToSite(touched)}`);
    } catch (e) { setDel(null); setError(explain(e)); setBusy(false); }
  };

  const copyRomanFrom = (id) => { const s = data.swatches.find((x) => x.id === id); if (s?.roman_styles) setRoman(normRoman(s.roman_styles)); };
  const sameGroup = mainFabric ? data.swatches.filter((s) => s.fabric_id === mainFabric.id && s.roman_styles && s.id !== existing?.id) : [];
  const setRomanStyle = (id, patch) => setRoman((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const toggleLining = (id, lining) => setRoman((r) => {
    const cur = r[id].linings;
    return { ...r, [id]: { ...r[id], linings: cur.includes(lining) ? cur.filter((l) => l !== lining) : [...cur, lining] } };
  });

  const shownThumb = photo?.previewUrl || (existing ? imgUrl(existing.thumb_path) : '');
  const shownThumbB = photoB?.previewUrl || (exStyleB ? imgUrl(exStyleB.thumb_path) : '');
  const groupLabel = (f) => `${f.collection_name}${f.family ? ` (${FAMILY_LABELS[f.family]})` : ''}${f.active ? '' : ' — hidden'}`;

  return (
    <div className="adm-editor">
      <div className="adm-head">
        <h1>{isNew ? 'Add color' : existing.display_name}</h1>
        <button className="adm-btn" onClick={onCancel}>Back to list</button>
      </div>
      {error && <p className="adm-error" role="alert">{error}</p>}

      {!isNew && (
        <div className="adm-card adm-statusbar">
          <span className={`adm-badge ${existing.active ? 'is-active' : 'is-off'}`}>{existing.active ? 'Active' : 'Hidden'}</span>
          <span className="adm-muted">{existing.active ? 'Customers can see and pick this color.' : 'Customers can’t see this color.'}</span>
          <button className="adm-btn adm-btn-primary" disabled={busy} onClick={toggleActive}>{existing.active ? 'Hide this color' : 'Show this color'}</button>
        </div>
      )}

      <div className="adm-card">
        <h2>Product lines</h2>
        <p className="adm-muted">Tick every line this color is sold in. It is one color: the same name, code and photo everywhere, and an edit shows in every line. Unticking removes it from that line.</p>
        <div className="adm-linepick" role="group" aria-label="Product lines">
          {LINE_ORDER.map((l) => (
            <label key={l} className="adm-check"><input type="checkbox" checked={lines.includes(l)} onChange={() => toggleLine(l)} /> {LINE_LABELS[l]}</label>
          ))}
        </div>
        {lines.length === 0 && <em className="adm-field-error">Tick at least one line.</em>}
      </div>

      <div className="adm-card">
        <h2>Color</h2>
        <label className="adm-field"><span>Display name <small>(what customers see, in every line; no numbers)</small></span>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameProblem} autoComplete="off" />
          {nameProblem ? <em className="adm-field-error">{nameProblem}</em>
            : trimmedName && lineOrdered.length > 0 && <em className="adm-field-ok">Free in {lineOrdered.map((l) => scopeLabel(l, famOf(l))).join(', ')}.</em>}
        </label>
        <div className="adm-grid2">
          <label className="adm-field"><span>{dream ? 'Supplier code (Style A)' : 'Supplier code'}</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={!!codeProblem} autoComplete="off" />
            {codeProblem && <em className="adm-field-error">{codeProblem}</em>}
          </label>
          <label className="adm-field"><span>Supplier color name <small>(internal)</small></span>
            <input value={suppName} onChange={(e) => setSuppName(e.target.value)} autoComplete="off" />
          </label>
        </div>

        <div className="adm-photo">
          {shownThumb ? <img src={shownThumb} alt={photo ? 'New photo preview' : `Current photo of ${existing?.display_name}`} width="120" height="120" /> : <div className="adm-photo-empty">No photo yet</div>}
          <div>
            <label className="adm-field"><span>{dream ? 'Photo (Style A)' : 'Photo'}{isNew ? '' : ' — choose a file to replace it'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto('A')} />
            </label>
            <p className="adm-muted adm-small">Resized here to a full image plus a 320 px thumbnail, then uploaded with a new file name.</p>
            {photoErr && <p className="adm-error" role="alert">{photoErr}</p>}
          </div>
        </div>

        <div className="adm-grid2">
          <label className="adm-field"><span>Color family</span>
            <select value={colorFamily} onChange={(e) => { setColorFamily(e.target.value); setCfManual(true); }}>
              <option value="">Choose…</option>
              {COLOR_FAMILY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {suggestion && <em className="adm-field-ok">Suggested from the {suggestion.source === 'name' ? 'supplier color name' : 'photo'}: {suggestion.family}.
              {cfManual && colorFamily !== suggestion.family && <> <button type="button" className="adm-link" onClick={() => { setColorFamily(suggestion.family); setCfManual(false); }}>Use suggestion</button></>}</em>}
          </label>
          {showRoman && (
            <label className="adm-field"><span>Grade <small>(internal)</small></span>
              <select value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">None</option>{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
            </label>
          )}
        </div>
        <div className="adm-grid2">
          <label className="adm-field"><span>Width <small>(only if it differs from the price group)</small></span><input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="e.g. 118 in" /></label>
          <label className="adm-field"><span>Composition <small>(only if it differs)</small></span><input value={composition} onChange={(e) => setComposition(e.target.value)} /></label>
        </div>
        <label className="adm-field"><span>Extra cost <small>(dollars added to the customer price after the markup, in every line; customers never see it)</small></span>
          <div className="adm-inline">$<input type="number" step="0.01" min="0" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} aria-invalid={!!extraProblem} /></div>
          {extraProblem && <em className="adm-field-error">{extraProblem}</em>}
        </label>
      </div>

      <details className="adm-card adm-details">
        <summary><strong>Pricing details</strong> <span className="adm-muted adm-small">prices are automatic; open only to change a price group</span></summary>
        <p className="adm-muted">Each line prices this color from a price group (a supplier price table). New lines start on that line’s standard group. Price groups are admin-only: customers never see their names.</p>
        {lineOrdered.length === 0 && <p className="adm-muted">Tick a product line first.</p>}
        {lineOrdered.map((l) => {
          const groups = data.fabrics.filter((f) => f.product_line === l).sort(byOrder);
          const std = defaultGroup(l);
          return (
            <div key={l} className="adm-subcard">
              <strong>{LINE_LABELS[l]}</strong>
              <label className="adm-field"><span>Price group</span>
                <select value={groupSel[l] === NEW ? NEW : groupOf(l)} onChange={(e) => setGroupSel((g) => ({ ...g, [l]: e.target.value }))}>
                  {!groupOf(l) && groupSel[l] !== NEW && <option value="">Choose a price group…</option>}
                  {groups.map((f) => <option key={f.id} value={f.id}>{groupLabel(f)}{f.id === std && !existing ? ' — standard' : ''}</option>)}
                  {isNew && l === mainLine && <option value={NEW}>＋ New price group…</option>}
                </select>
              </label>
              {l === 'cellular' && (
                <label className="adm-field"><span>Family</span>
                  <select value={cellFamily} onChange={(e) => setCellFamily(e.target.value)}>{familyNeeded('cellular').map((f) => <option key={f} value={f}>{FAMILY_LABELS[f]}</option>)}</select>
                </label>
              )}
              {l === mainLine && !creatingColl && mainFabric && <p><button type="button" className="adm-link" onClick={() => onEditCollection(mainFabric.id)}>Edit this price group’s specs</button></p>}
            </div>
          );
        })}
        {creatingColl && (
          <fieldset className="adm-subcard">
            <legend>New price group ({LINE_LABELS[mainLine]})</legend>
            {mainLine === 'roller' && <label className="adm-field"><span>Family</span>
              <select value={newCollFamily} onChange={(e) => setNewCollFamily(e.target.value)}>{familyNeeded('roller').map((f) => <option key={f} value={f}>{FAMILY_LABELS[f]}</option>)}</select>
            </label>}
            <label className="adm-field"><span>Price group name <small>(supplier’s name, never shown to customers)</small></span>
              <input value={newColl.name} onChange={(e) => setNewColl({ ...newColl, name: e.target.value })} />
              {collNameClash && <em className="adm-field-error">That price group name is already used in this line.</em>}
            </label>
            <CollectionFields value={newColl} onChange={(p) => setNewColl({ ...newColl, ...p })} line={mainLine} family={newCollFamily} />
          </fieldset>
        )}
      </details>

      {dream && (
        <div className="adm-card">
          <h2>Style B <small className="adm-muted">optional</small></h2>
          <p className="adm-muted">Dream Curtains come in Style A (the code and photo above) and Style B. Leave the code empty if this color has no Style B.</p>
          <label className="adm-field"><span>Style B supplier code</span>
            <input value={bCode} onChange={(e) => setBCode(e.target.value)} autoComplete="off" />
            {bProblem && <em className="adm-field-error">{bProblem}</em>}
          </label>
          {bCode.trim() && (
            <div className="adm-photo">
              {shownThumbB ? <img src={shownThumbB} alt="Style B photo" width="120" height="120" /> : <div className="adm-photo-empty">Uses the Style A photo</div>}
              <div>
                <label className="adm-field"><span>Style B photo</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto('B')} /></label>
                <p className="adm-muted adm-small">Without one, Style B shows the Style A photo until you upload a real one.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {showRoman && (
        <div className="adm-card">
          <h2>Roman shade styles</h2>
          <p className="adm-muted">Which Roman styles this fabric can be made in, and with which linings.</p>
          {sameGroup.length > 0 && (
            <label className="adm-field"><span>Copy from another color in this price group</span>
              <select value="" onChange={(e) => e.target.value && copyRomanFrom(e.target.value)}>
                <option value="">Choose a color…</option>
                {sameGroup.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
              </select>
            </label>
          )}
          <div className="adm-roman">
            {ROMAN_STYLE_LIST.map((s) => (
              <div key={s.id} className="adm-roman-row">
                <label className="adm-check"><input type="checkbox" checked={roman[s.id].available} onChange={(e) => setRomanStyle(s.id, { available: e.target.checked })} /> <strong>{s.label}</strong> available</label>
                <div className={`adm-linings${roman[s.id].available ? '' : ' is-off'}`}>
                  {LINING_LIST.map((l) => (
                    <label key={l.id} className="adm-check"><input type="checkbox" disabled={!roman[s.id].available} checked={roman[s.id].linings.includes(l.id)} onChange={() => toggleLining(s.id, l.id)} /> {l.label}</label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {romanProblem && <em className="adm-field-error">{romanProblem}</em>}
        </div>
      )}

      <div className="adm-card adm-savebar">
        {missing.length > 0 && <p className="adm-muted">Still needed: {missing.join(', ')}.</p>}
        <div className="adm-bar">
          <button className="adm-btn adm-btn-primary" disabled={!canSave} onClick={save}>{busy ? 'Saving…' : isNew ? 'Add color' : 'Save changes'}</button>
          <button className="adm-btn adm-btn-quiet" onClick={onCancel}>Cancel</button>
        </div>
        <p className="adm-muted adm-small">After saving, the live site is refreshed right away in every line this color is in.</p>
      </div>

      {!isNew && (
        <div className="adm-card adm-danger">
          <h2>Delete</h2>
          {!del && <>
            <p className="adm-muted">Deleting is permanent and removes the color from every line. If you only want customers to stop seeing it, hide it instead.</p>
            <button className="adm-btn adm-btn-danger" disabled={busy} onClick={startDelete}>Delete this color…</button>
          </>}
          {del?.checking && <p className="adm-muted">Checking saved orders…</p>}
          {del?.count > 0 && <>
            <p role="alert">This color is part of {del.count} saved customer order{del.count > 1 ? 's' : ''}, so it can’t be deleted.</p>
            <div className="adm-bar">
              {existing.active && <button className="adm-btn adm-btn-primary" disabled={busy} onClick={toggleActive}>Hide it instead</button>}
              <button className="adm-btn" onClick={() => setDel(null)}>Close</button>
            </div>
          </>}
          {del?.confirm && <>
            <p role="alert"><strong>Delete “{existing.display_name}” ({existing.supplier_code}) for good?</strong> No saved order uses it.</p>
            <div className="adm-bar">
              <button className="adm-btn adm-btn-danger" disabled={busy} onClick={doDelete}>{busy ? 'Deleting…' : 'Yes, delete it'}</button>
              {existing.active && <button className="adm-btn" disabled={busy} onClick={toggleActive}>Hide instead</button>}
              <button className="adm-btn adm-btn-quiet" onClick={() => setDel(null)}>Cancel</button>
            </div>
          </>}
        </div>
      )}

      {!isNew && <History table="swatches" rowId={existing.id} reloadKey={histKey} withLinks />}
    </div>
  );
}
