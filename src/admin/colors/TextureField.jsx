// Products > Colors > a color: "Texture: Photo crop / Pattern", a small live preview, and (Zebra) the band widths.
// The preview is drawn by the very same function as the picker tile, the "This blind" chip and the 3D shade (src/room/textureBrowser.js resolveLook), so
// what it shows is what customers see. The setting is auto-picked from the photo (src/lib/textureAnalysis.js); the person can override it.
import { useEffect, useRef, useState } from 'react';
import { resolveLook } from '../../room/textureBrowser.js';
import { TEX } from '../../room/textureCore.js';
import { analyzePhoto } from '../../lib/textureAnalysis.js';
import { pixelsAt, loadImage } from '../../room/textureBrowser.js';
import { ZEBRA_DEFAULTS, ZEBRA_LIMITS, cleanBand } from '../../room/zebraBands.js';
import { isHex } from '../../lib/swatchColor.js';

// The look of the color as it would be saved: `src` = { id, thumb, tile, image, tex } urls (the new photo's blob url, or the stored files).
function lookFor({ src, line, family, composition, colorFamily, previewColor, mode, solid, sheer }) {
  return { id: src.id, line, family, composition, colorFamily, previewColor: isHex(previewColor) ? previewColor : null, textureMode: mode, solidIn: solid, sheerIn: sheer, tile: src.tile, thumb: src.thumb, image: src.image, tex: src.tex };
}

export const TEXTURE_LABEL = { photo: 'Photo crop', pattern: 'Pattern' };

export default function TextureField({ src, line, family, composition, colorFamily, previewColor, zebra, lineBands, mode, onMode, auto, setAuto, solid, sheer, onSolid, onSheer, analysis }) {
  const canvas = useRef(null);
  const [err, setErr] = useState('');
  // the auto-picked setting: from a new photo (already analysed when it was chosen), or for a color that has none stored, from its stored photo
  useEffect(() => {
    if (analysis) { setAuto({ mode: analysis.mode, reason: analysis.reason }); return undefined; }
    if (mode || !src?.image) return undefined;
    let dead = false;
    loadImage(src.image).then((img) => { const px = pixelsAt(img, 1000), a = analyzePhoto(px.rgb, px.w, px.h); if (!dead) setAuto({ mode: a.mode, reason: a.reason }); }, () => { if (!dead) setAuto(null); });
    return () => { dead = true; };
  }, [analysis, src?.id, src?.image]);                                  // eslint-disable-line react-hooks/exhaustive-deps

  const effective = zebra ? 'pattern' : (mode || auto?.mode || 'photo');
  // the line's default widths (Products > Zebra), else 3 in / 2 in; this color's own boxes override them
  const defSolid = cleanBand(lineBands?.band_solid_in, ZEBRA_DEFAULTS.solidIn), defSheer = cleanBand(lineBands?.band_sheer_in, ZEBRA_DEFAULTS.sheerIn);
  const solidN = cleanBand(solid, defSolid), sheerN = cleanBand(sheer, defSheer);
  useEffect(() => {
    const c = canvas.current; if (!c || !src) return undefined;
    let dead = false; setErr('');
    resolveLook(lookFor({ src, line, family, composition, colorFamily, previewColor, mode: effective, solid: solidN, sheer: sheerN }), { small: true }).then((r) => {
      if (dead) return;
      const ctx = c.getContext('2d');
      if (zebra) { const half = c.height / 2; for (let k = 0; k < 2; k++) ctx.drawImage(r.canvas, 0, 0, TEX, TEX, 0, k * half, c.width, half); }
      else ctx.drawImage(r.canvas, 0, 0, TEX, TEX, 0, 0, c.width, c.height);
      c.dataset.color = r.hex; c.dataset.mode = r.mode; c.dataset.ready = '1';
    }).catch(() => { if (!dead) setErr('The preview could not be drawn.'); });
    return () => { dead = true; };
  }, [src, line, family, composition, colorFamily, previewColor, effective, solidN, sheerN, zebra]);

  const bandProblem = zebra && ((solid !== '' && cleanBand(solid, null) === null) || (sheer !== '' && cleanBand(sheer, null) === null))
    ? `Each band must be between ${ZEBRA_LIMITS.min} and ${ZEBRA_LIMITS.max} inches (or empty for the default).` : '';
  return (
    <div className="adm-field adm-texture" data-testid="texture-field">
      <span>Texture <small>(picker tile, “This blind” chip and 3D preview)</small></span>
      <div className="adm-texture-row">
        <canvas ref={canvas} className="adm-texture-prev" width={160} height={160} aria-label="Texture preview" style={{ background: '#eee' }} />
        <div className="adm-texture-pick">
          {zebra ? (
            <p className="adm-muted adm-small" style={{ margin: 0 }}>Zebra always uses the pattern: solid and sheer bands, the sheer bands see-through.</p>
          ) : (
            <div role="radiogroup" aria-label="Texture" className="adm-linepick">
              {['photo', 'pattern'].map((m) => (
                <label key={m} className="adm-check"><input type="radio" name="texture-mode" value={m} checked={effective === m} onChange={() => onMode(m)} /> {TEXTURE_LABEL[m]}</label>
              ))}
            </div>
          )}
          {!zebra && <em className="adm-field-ok">{mode ? (auto && auto.mode !== mode ? `Set by hand. Auto-pick would be ${TEXTURE_LABEL[auto.mode]} (${auto.reason}).` : 'Set by hand.') : auto ? `Auto-picked: ${TEXTURE_LABEL[auto.mode]} (${auto.reason}).` : 'Auto-picking from the photo…'}
            {mode && auto && auto.mode !== mode && <> <button type="button" className="adm-link" onClick={() => onMode('')}>Use auto-pick</button></>}</em>}
          {err && <em className="adm-field-error" role="alert">{err}</em>}
        </div>
      </div>
      {zebra && (
        <div className="adm-grid2" style={{ marginTop: 10 }}>
          <label className="adm-field"><span>Solid band <small>(inches; empty = the line's {defSolid})</small></span>
            <input type="number" aria-label="Solid band width in inches" min={ZEBRA_LIMITS.min} max={ZEBRA_LIMITS.max} step="0.25" inputMode="decimal" placeholder={String(defSolid)} value={solid} onChange={(e) => onSolid(e.target.value)} />
          </label>
          <label className="adm-field"><span>Sheer band <small>(inches; empty = the line's {defSheer})</small></span>
            <input type="number" aria-label="Sheer band width in inches" min={ZEBRA_LIMITS.min} max={ZEBRA_LIMITS.max} step="0.25" inputMode="decimal" placeholder={String(defSheer)} value={sheer} onChange={(e) => onSheer(e.target.value)} />
          </label>
          {bandProblem && <em className="adm-field-error" role="alert">{bandProblem}</em>}
        </div>
      )}
    </div>
  );
}
export const textureBandProblem = (solid, sheer) => ((solid !== '' && cleanBand(solid, null) === null) || (sheer !== '' && cleanBand(sheer, null) === null)
  ? `Each zebra band must be between ${ZEBRA_LIMITS.min} and ${ZEBRA_LIMITS.max} inches (or empty for the default).` : '');
