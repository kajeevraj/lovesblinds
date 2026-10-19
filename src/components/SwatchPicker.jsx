import { useState, useRef, useEffect } from 'react';
import { specRows } from '../data/swatchData.js';

// ---------------------------------------------------------------------------
// Swatch images: lazy, with a neutral tile showing the code when the file fails.
// crossOrigin="anonymous" (the bucket allows any origin) lets them reuse the connection the catalog request already opened.
// ---------------------------------------------------------------------------
export function SwatchImg({ src, fallback, srcSet, sizes, alt, code, size, className = "", eager = false }) {
  // `fallback` is one url or a list: each is tried in turn when the one before fails, then the code tile.
  const sources = [src, ...(Array.isArray(fallback) ? fallback : [fallback])].filter(Boolean);
  const [stage, setStage] = useState(0);
  const current = sources[stage] || null;
  if (!current) {
    return <span className={`swatch-fallback ${className}`} role="img" aria-label={alt}>{code}</span>;
  }
  const next = () => setStage(n => n + 1);
  return (
    <img className={className} crossOrigin="anonymous" src={current} srcSet={stage === 0 ? srcSet : undefined} sizes={stage === 0 ? sizes : undefined} alt={alt} width={size} height={size} loading={eager ? "eager" : "lazy"} fetchpriority={eager ? "high" : "low"} decoding="async" onError={next} />
  );
}

// Customers see the display name and the supplier code. The supplier's collection and color names are never shown.
export const labelOf = (e) => e.swatch.displayName;
export const altOf = (e, code = e.swatch.code) => `${labelOf(e)}, ${code}`;

export function makePick(swatch, role, styleObj) {
  const src = styleObj || swatch;
  return {
    role: role || null,
    swatchId: swatch.id,
    line: swatch.line,
    family: swatch.family || null,
    fabricId: swatch.fabricId,
    code: styleObj ? styleObj.code : swatch.code,
    displayName: swatch.displayName,
    style: styleObj ? styleObj.style : null,
    thumb: src.thumb,
  };
}

// ---------------------------------------------------------------------------
// Larger view
// ---------------------------------------------------------------------------
export function SwatchDialog({ entry, role, onChoose, onClose, chosen, hideCode = false }) {
  const ref = useRef(null);
  useEffect(() => { if (entry && ref.current && !ref.current.open) ref.current.showModal(); }, [entry]);
  if (!entry) return null;
  const s = entry.swatch;
  const rows = specRows(entry.fabric);
  return (
    <dialog ref={ref} className="swatch-dialog" onClose={onClose} onClick={(ev) => { if (ev.target === ref.current) ref.current.close(); }} aria-label={hideCode ? labelOf(entry) : `${labelOf(entry)} ${s.code}`}>
      <div className="swatch-dialog-body">
        <SwatchImg className="swatch-dialog-img" src={s.image} alt={altOf(entry)} code={s.code} size={600} />
        <div className="swatch-dialog-text">
          <div className="preview-eyebrow">{role || "Swatch"}</div>
          <h3 className="preview-name serif">{labelOf(entry)}</h3>
          {!hideCode && <div className="preview-code">Code {s.styles?.length ? s.styles.map(x => `${x.style}: ${x.code}`).join(" · ") : s.code}</div>}
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
