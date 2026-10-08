import { useState, useMemo, useRef, useEffect } from 'react';
import { entriesFor, specRows, COLOR_FAMILY_ORDER, tileSrc } from '../data/swatchData.js';
import { OptionCards } from './ExplainerImg.jsx';
import { DREAM_STYLE_INFO } from '../data/optionInfo.js';

// ---------------------------------------------------------------------------
// Swatch images: lazy, with a neutral tile showing the code when the file fails.
// ---------------------------------------------------------------------------
export function SwatchImg({ src, fallback, srcSet, sizes, alt, code, size, className = "", eager = false }) {
  const [stage, setStage] = useState(0);            // 0 = src, 1 = fallback file, 2 = code tile
  const current = stage === 0 ? src : stage === 1 ? fallback : null;
  if (!current) {
    return <span className={`swatch-fallback ${className}`} role="img" aria-label={alt}>{code}</span>;
  }
  const next = () => setStage(s => (s === 0 && fallback ? 1 : 2));
  return (
    <img className={className} src={current} srcSet={stage === 0 ? srcSet : undefined} sizes={stage === 0 ? sizes : undefined} alt={alt} width={size} height={size} loading={eager ? "eager" : "lazy"} fetchpriority={eager ? "high" : "low"} decoding="async" onError={next} />
  );
}

// Same name and code as the order will carry; the label falls back to the color family when a
// fabric has no color name (Roman, Curtains).
const labelOf = (e) => e.swatch.colorName || e.color;
const altOf = (e, code = e.swatch.code) => [e.swatch.fabric, labelOf(e), code].join(", ");
const hideFabric = (e) => e.swatch.fabric === "Cellular Shades";

function makePick(swatch, role, styleObj) {
  const src = styleObj || swatch;
  return {
    role: role || null,
    swatchId: swatch.id,
    line: swatch.line,
    family: swatch.family || null,
    fabric: swatch.fabric,
    fabricId: swatch.fabricId,
    code: styleObj ? styleObj.code : swatch.code,
    colorName: swatch.colorName ?? null,
    style: styleObj ? styleObj.style : null,
    thumb: src.thumb,
  };
}

// ---------------------------------------------------------------------------
// Filter facets
// ---------------------------------------------------------------------------
export const NOT_LISTED = "Not listed";

const FACETS = [
  { key: "color", label: "Color", get: e => e.color, order: v => COLOR_FAMILY_ORDER.indexOf(v) },
  { key: "light", label: "Light control", get: e => e.light?.label ?? null, order: (v, ents) => ents.find(e => e.light?.label === v)?.light.order ?? 99 },
  { key: "material", label: "Material", get: e => e.material, order: () => 0 },
];

const matches = (e, sel, skip) =>
  FACETS.every(f => f.key === skip || sel[f.key] == null || (f.get(e) ?? NOT_LISTED) === sel[f.key]);

// Chip values for one facet, with the count each would give with the other facets applied.
// The counts of a facet always add up to the number of results with that facet cleared.
export function facetChips(entries, sel, facet) {
  const base = entries.filter(e => matches(e, sel, facet.key));
  const counts = new Map();
  for (const e of base) { const v = facet.get(e) ?? NOT_LISTED; counts.set(v, (counts.get(v) || 0) + 1); }
  const allValues = [...new Set(entries.map(e => facet.get(e) ?? NOT_LISTED))];
  const values = allValues
    .sort((a, b) => (a === NOT_LISTED) - (b === NOT_LISTED) || facet.order(a, entries) - facet.order(b, entries) || a.localeCompare(b))
    .map(v => ({ value: v, count: counts.get(v) || 0 }));
  return { chips: values, total: base.length };
}

// A facet is only useful when the swatches actually differ on it.
const facetUseful = (entries, facet) => new Set(entries.map(e => facet.get(e) ?? NOT_LISTED)).size >= 2;

// ---------------------------------------------------------------------------
// Larger view
// ---------------------------------------------------------------------------
function SwatchDialog({ entry, role, onChoose, onClose, chosen }) {
  const ref = useRef(null);
  useEffect(() => { if (entry && ref.current && !ref.current.open) ref.current.showModal(); }, [entry]);
  if (!entry) return null;
  const s = entry.swatch;
  const rows = specRows(entry.fabric);
  return (
    <dialog ref={ref} className="swatch-dialog" onClose={onClose} onClick={(ev) => { if (ev.target === ref.current) ref.current.close(); }} aria-label={`${s.fabric} ${labelOf(entry)} ${s.code}`}>
      <div className="swatch-dialog-body">
        <SwatchImg className="swatch-dialog-img" src={s.image} alt={altOf(entry)} code={s.code} size={600} />
        <div className="swatch-dialog-text">
          <div className="preview-eyebrow">{role || "Swatch"}</div>
          <h3 className="preview-name serif">{labelOf(entry)}</h3>
          <div className="preview-code">Code {s.styles?.length ? s.styles.map(x => `${x.style}: ${x.code}`).join(" · ") : s.code}</div>
          {!hideFabric(entry) && <div className="preview-coll">Collection: {s.fabric}</div>}
          <dl className="preview-specs">
            {entry.light && <div><dt>Light control</dt><dd>{entry.light.label}</dd></div>}
            {rows.filter(([k]) => k !== "Openness" && k !== "Opacity").map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
          </dl>
          <div className="swatch-dialog-actions">
            <button type="button" className="btn btn-sage" onClick={() => { onChoose(entry); ref.current?.close(); }}>
              {chosen ? "Keep this swatch" : "Choose this swatch"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => ref.current?.close()}>Close</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Picker: filter chips, grouped swatch grid, larger view, optional Dream Curtains style.
// ---------------------------------------------------------------------------
export default function SwatchPicker({ heading, step, fabrics, role, family = null, onChange, eagerFirst = true }) {
  const entries = useMemo(() => entriesFor(fabrics, family), [fabrics, family]);
  const [sel, setSel] = useState({ color: null, light: null, material: null });
  const [grouped, setGrouped] = useState(true);
  const [pickedId, setPickedId] = useState(null);
  const [styleKey, setStyleKey] = useState(null);
  const [view, setView] = useState(null);

  const visibleFacets = FACETS.filter(f => facetUseful(entries, f));
  const results = entries.filter(e => matches(e, sel));
  const anyFilter = FACETS.some(f => sel[f.key] != null);
  const picked = entries.find(e => e.swatch.id === pickedId) || null;
  const styles = picked?.swatch.styles || [];

  const emit = (e, st) => {
    if (!e) return onChange(null);
    if (e.swatch.styles?.length && !st) return onChange(null);       // style still to be chosen
    onChange(makePick(e.swatch, role, st));
  };
  const choose = (e) => { setPickedId(e.swatch.id); setStyleKey(null); emit(e, null); };
  const chooseStyle = (st) => { setStyleKey(st); emit(picked, picked.swatch.styles.find(x => x.style === st)); };
  const toggle = (key, value) => setSel(prev => ({ ...prev, [key]: prev[key] === value ? null : value }));

  // Group by color family (default), or one flat list.
  const groups = useMemo(() => {
    if (!grouped || sel.color) return [{ name: null, items: results }];
    return COLOR_FAMILY_ORDER.map(name => ({ name, items: results.filter(e => e.color === name) })).filter(g => g.items.length);
  }, [grouped, sel.color, results]);

  const tileCount = { n: 0 };                    // the first few tiles load eagerly (they are the first thing people see)
  const prefix = step ? `${step} · ` : "";
  return (
    <div className="picker">
      {heading && <h3 className="picker-heading serif">{heading}</h3>}
      <div className="label">{prefix}Choose a fabric</div>

      {picked && (
        <div className="picked-bar">
          <SwatchImg src={styleKey ? styles.find(x => x.style === styleKey)?.thumb : picked.swatch.thumb} alt={altOf(picked)} code={picked.swatch.code} size={56} />
          <div className="picked-text">
            <strong>{labelOf(picked)}</strong>
            <span>{styleKey ? styles.find(x => x.style === styleKey).code : (styles.length ? styles.map(x => x.code).join(" / ") : picked.swatch.code)}{!hideFabric(picked) ? ` · ${picked.swatch.fabric}` : ""}</span>
          </div>
          <button type="button" className="link-btn" onClick={() => setView(picked)}>View larger</button>
        </div>
      )}

      {visibleFacets.length > 0 && (
        <div className="facets">
          {visibleFacets.map(f => {
            const { chips } = facetChips(entries, sel, f);
            return (
              <div key={f.key} className="facet">
                <span className="facet-label" id={`f-${f.key}-${heading || "x"}`}>{f.label}</span>
                <div className="chips" role="group" aria-label={`Filter by ${f.label.toLowerCase()}`}>
                  {chips.map(c => (
                    <button key={c.value} type="button" className={`chip-btn${sel[f.key] === c.value ? " on" : ""}`} aria-pressed={sel[f.key] === c.value}
                      disabled={c.count === 0 && sel[f.key] !== c.value} onClick={() => toggle(f.key, c.value)}>
                      {c.value} <span className="chip-count">{c.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="results-bar">
        <span aria-live="polite">Showing {results.length} of {entries.length}</span>
        <span className="results-actions">
          {visibleFacets.some(f => f.key === "color") && (
            <button type="button" className="link-btn" aria-pressed={grouped} onClick={() => setGrouped(g => !g)}>{grouped ? "Grouping by color" : "Show as one list"}</button>
          )}
          <button type="button" className="link-btn" disabled={!anyFilter} onClick={() => setSel({ color: null, light: null, material: null })}>Clear filters</button>
        </span>
      </div>

      {results.length === 0 ? (
        <div className="no-results">No swatches match these filters. <button type="button" className="link-btn" onClick={() => setSel({ color: null, light: null, material: null })}>Clear filters</button></div>
      ) : groups.map(g => (
        <div key={g.name || "all"} className="sw-group">
          {g.name && (heading ? <h4 className="sw-group-title">{g.name} <span>{g.items.length}</span></h4> : <h3 className="sw-group-title">{g.name} <span>{g.items.length}</span></h3>)}
          <div className="sw-grid" role="group" aria-label={g.name ? `${g.name} swatches` : "Swatches"}>
            {g.items.map(e => {
              const s = e.swatch;
              const selected = pickedId === s.id;
              const eager = eagerFirst && tileCount.n++ < 4;
              return (
                <button key={s.id} type="button" className={`sw-tile${selected ? " selected" : ""}`} aria-pressed={selected} onClick={() => setView(e)}>
                  <SwatchImg src={tileSrc(s)} fallback={s.image} srcSet={`${s.thumb} 160w, ${tileSrc(s)} 320w`} sizes="(max-width: 639px) 45vw, 190px" alt={altOf(e)} code={s.code} size={160} eager={eager} />
                  <span className="sw-label">{labelOf(e)}</span>
                  <span className="sw-code">{s.styles?.length ? s.styles.map(x => x.code).join(" / ") : s.code}</span>
                  {(!hideFabric(e) || e.light) && (
                    <span className="sw-sub">{[!hideFabric(e) ? s.fabric : null, e.light?.label].filter(Boolean).join(" · ")}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {picked && styles.length > 0 && (
        <OptionCards label="Style" value={styleKey} onChange={chooseStyle}
          options={styles.map(st => ({ id: st.style, label: `Style ${st.style}`, desc: `${DREAM_STYLE_INFO[st.style]?.desc || ""} Code ${st.code}`.trim(), img: DREAM_STYLE_INFO[st.style]?.img }))} />
      )}

      <SwatchDialog entry={view} role={role} chosen={view && pickedId === view.swatch.id} onChoose={choose} onClose={() => setView(null)} />
    </div>
  );
}
