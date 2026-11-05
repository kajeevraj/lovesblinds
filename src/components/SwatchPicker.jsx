import { useState, useRef, useEffect } from 'react';
import { specRows, tileSrc, tileFallbacks } from '../data/swatchData.js';
import { deriveHex, previewHex, familyHex, isHex } from '../lib/swatchColor.js';
import { retarget } from '../room/textureCore.js';

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

// A picker tile: the swatch's picture, shown in the color the 3D preview shows the fabric in (the admin's override, else its own picture placed
// inside its color family, src/lib/swatchColor.js) with the weave kept at a calm contrast. The supplier photo is not true to the cloth (Jet Black
// is white weft on black), so it is only used for the weave here; it is shown as is, under the grid, as "Close-up of the weave".
// Until the picture arrives the tile is the family's color; a picture that cannot be read is shown as it is.
export function SwatchTile({ swatch, size = 96 }) {
  const canvas = useRef(null);
  const [failed, setFailed] = useState(false);
  const family = swatch.colorFamily, override = isHex(swatch.previewColor) ? swatch.previewColor : null;
  useEffect(() => {
    const c = canvas.current; if (!c) return undefined;
    let dead = false, io = null;
    const draw = () => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (dead) return;
        try {
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const d = ctx.getImageData(0, 0, c.width, c.height), rgb = new Uint8ClampedArray((d.data.length / 4) * 3);
          for (let i = 0, j = 0; i < d.data.length; i += 4, j += 3) { rgb[j] = d.data[i]; rgb[j + 1] = d.data[i + 1]; rgb[j + 2] = d.data[i + 2]; }
          const hex = previewHex(override, override ? null : deriveHex(rgb, family), family), t = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)), out = retarget(rgb, t);
          for (let i = 0, j = 0; i < d.data.length; i += 4, j += 3) { d.data[i] = out[j]; d.data[i + 1] = out[j + 1]; d.data[i + 2] = out[j + 2]; d.data[i + 3] = 255; }
          ctx.putImageData(d, 0, 0); c.dataset.color = hex; c.dataset.ready = '1';
        } catch { setFailed(true); }
      };
      img.onerror = () => { if (!dead) setFailed(true); };
      img.src = tileSrc(swatch);
    };
    if (typeof IntersectionObserver === 'undefined') draw();
    else { io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); draw(); } }, { rootMargin: '300px' }); io.observe(c); }
    return () => { dead = true; io?.disconnect(); };
  }, [swatch.id, swatch.tile, swatch.thumb, family, override]);
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
