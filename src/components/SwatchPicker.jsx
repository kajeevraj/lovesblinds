import { useState, useRef, useEffect } from 'react';
import { specRows, tileSrc, tileFallbacks } from '../data/swatchData.js';
import { familyHex, isHex } from '../lib/swatchColor.js';
import { TEX } from '../room/textureCore.js';
import { resolveLook, lookOfSwatch } from '../room/textureBrowser.js';

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

// A picker tile (also the "This blind" chip): the fabric drawn exactly as the 3D preview draws it (src/room/textureBrowser.js resolveLook): the same texture
// (a flat crop of the supplier photo that tiles, or a generated pattern when the photo has folds or is a whole shade; Zebra is always a pattern, drawn as its
// solid and sheer bands) in the same color (the admin's override, else the photo's body color placed inside its color family, src/lib/swatchColor.js).
// The supplier photo itself is shown as is, under the grid, as "Close-up of the weave". Until the picture arrives the tile is the family's color; a
// picture that cannot be read is shown as it is.
export function SwatchTile({ swatch, size = 96 }) {
  const canvas = useRef(null);
  const [failed, setFailed] = useState(false);
  const family = swatch.colorFamily, override = isHex(swatch.previewColor) ? swatch.previewColor : null;
  useEffect(() => {
    const c = canvas.current; if (!c) return undefined;
    let dead = false, io = null;
    const draw = () => {
      resolveLook(lookOfSwatch(swatch), { small: true }).then((r) => {
        if (dead) return;
        const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);          // a sheer weave is see-through: the tile's color shows through its gaps
        if (swatch.line === 'zebra') {                 // two stripe periods, solid band on top of each: the tile reads as a zebra
          const rows = r.rows || Math.round(TEX * r.bands.split), half = c.height / 2;
          for (let k = 0; k < 2; k++) ctx.drawImage(r.canvas, 0, 0, TEX, TEX, 0, k * half, c.width, half);
          void rows;
        } else ctx.drawImage(r.canvas, 0, 0, TEX, TEX, 0, 0, c.width, c.height);
        c.dataset.color = r.hex; c.dataset.mode = r.mode; c.dataset.ready = '1';
      }).catch(() => { if (!dead) setFailed(true); });
    };
    if (typeof IntersectionObserver === 'undefined') draw();
    else { io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); draw(); } }, { rootMargin: '300px' }); io.observe(c); }
    return () => { dead = true; io?.disconnect(); };
  }, [swatch.id, swatch.tile, swatch.thumb, swatch.textureMode, swatch.textureType, swatch.textureSource, swatch.weave, swatch.zebraSolidIn, swatch.zebraSheerIn, family, override]);
  if (failed) return <SwatchImg src={tileSrc(swatch)} fallback={tileFallbacks(swatch)} alt="" code={swatch.code} size={size} />;
  return <canvas ref={canvas} className="s2-sw-canvas" width={160} height={160} aria-hidden="true" data-color={override || familyHex(family)} style={{ background: override || familyHex(family) }} />;
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
          <div className="preview-eyebrow">{role || "Color"}</div>
          <h3 className="preview-name serif">{labelOf(entry)}</h3>
          {!hideCode && <div className="preview-code">Code {s.styles?.length ? s.styles.map(x => `${x.style}: ${x.code}`).join(" · ") : s.code}</div>}
          <dl className="preview-specs">
            {entry.light && <div><dt>Light control</dt><dd>{entry.light.label}</dd></div>}
            {rows.filter(([k]) => k !== "Openness" && k !== "Opacity").map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
          </dl>
          <div className="swatch-dialog-actions">
            <button type="button" className="btn btn-sage" onClick={() => { onChoose(entry); ref.current?.close(); }}>
              {chosen ? "Keep this color" : "Choose this color"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => ref.current?.close()}>Close</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
