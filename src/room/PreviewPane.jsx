// The product page's preview: your blind, at the size you typed, in a window; or "See it in a room". Driven only by the page's choices.
// Lazy-loaded (three.js is in this chunk), shown after the page's photo, which stays in place until the 3D is ready. No WebGL: the photo stays.
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSwatch, colorFamilyOf } from '../data/swatchData.js';
import { formatInches } from '../lib/inches.js';
import { PRODUCT_BY_ID } from './data.js';
import { presetSpec, specFromEntry } from './fabricSpec.js';
import { amountFromHandle } from './models/shade.js';
import { parseMech, SIDE_NAME, MOTOR_CONTROL_NAME } from '../lib/drive.js';
import RoomEmbed from './RoomEmbed.jsx';

const SAMPLE = { roller: 'rlf-soft-cream', zebra: 'zeb-cream' };
const ROLLER_BY_FAMILY = { solar: 'roller-solar', 'screen-view': 'roller-screen', blackout: 'roller-blackout' };
// what the drawing shows, in a sentence
function driveNote(d) {
  const side = SIDE_NAME[d.side].toLowerCase();
  if (d.movement === 'chain') return `Continuous chain, on the ${side}`;
  if (d.movement === 'zero-gravity') return 'Zero gravity, nothing hangs down. The center handle is included and optional';
  if (d.movement === 'cordless') return 'Cordless, nothing hangs down. The center handle is included and optional';
  const power = d.power === 'wired' ? `wired, with a cord down the wall to an outlet on the ${side}`
    : `battery, charging port on the ${side}${d.solar ? ', solar panel on the window glass' : ''}`;
  return `Motorized, ${power}. ${MOTOR_CONTROL_NAME[d.control]}`;
}

// the product (optics, name) a pick belongs to
export const productIdFor = (kind, pick) => (kind === 'zebra' ? 'zebra' : ROLLER_BY_FAMILY[pick?.family] || 'roller-solar');

export function fabricFromPick(kind, pick) {
  const sw = pick ? getSwatch(pick.swatchId, pick.fabricId) : null;
  return sw ? specFromEntry({ swatch: sw, color: colorFamilyOf(sw) }, kind) : null;
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export default function PreviewPane({ kind, picks, double, width, height, mount, mech, cover, fallback, phone, onReady }) {
  const [status, setStatus] = useState(() => (webglAvailable() ? 'loading' : 'nowebgl'));      // loading | ready | nowebgl
  const [amount, setAmount] = useState(0.55);
  const [layout, setLayout] = useState(null);
  const [sizes, setSizes] = useState(true);
  const [room, setRoom] = useState(false);
  const canvasRef = useRef(null), ctrlRef = useRef(null), stageRef = useRef(null), dragRef = useRef(null);

  const w = Number(width) > 0 ? Number(width) : null, h = Number(height) > 0 ? Number(height) : null;
  const layers = useMemo(() => picks.slice(0, double ? 2 : 1).map((pick) => {
    const pid = productIdFor(kind, pick);
    return { pick, fabric: fabricFromPick(kind, pick) || presetSpec(SAMPLE[kind]), optics: PRODUCT_BY_ID[pid].optics, sample: !pick, product: pid };
  }), [kind, double, picks]);                                                   // eslint-disable-line react-hooks/exhaustive-deps
  const key = layers.map((l) => l.fabric.key).join('|');

  useEffect(() => {
    if (status === 'nowebgl' || room) return undefined;
    let dead = false, ctrl = null, io = null, ro = null;
    const t = setTimeout(async () => {
      let mod; try { mod = await import('./previewScene.js'); } catch { if (!dead) setStatus('nowebgl'); return; }
      if (dead) return;
      try { ctrl = mod.createPreviewScene(canvasRef.current, { onLayout: setLayout, onAmount: setAmount }); } catch { if (!dead) setStatus('nowebgl'); return; }
      ctrlRef.current = ctrl;
      const stage = stageRef.current;
      ro = new ResizeObserver(() => { const r = stage.getBoundingClientRect(); ctrl.resize(Math.max(2, Math.round(r.width)), Math.max(2, Math.round(r.height)), window.devicePixelRatio || 1); });
      ro.observe(stage);
      let visible = true; const sync = () => ctrl.setActive(visible && !document.hidden);
      io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '120px' });
      io.observe(stage); document.addEventListener('visibilitychange', sync); ctrl.cleanup = () => document.removeEventListener('visibilitychange', sync);
      const mq = matchMedia('(prefers-reduced-motion: reduce)'); ctrl.setReducedMotion(mq.matches);
      setStatus('ready'); onReady?.(true);
    }, 30);
    return () => { dead = true; clearTimeout(t); ro?.disconnect(); io?.disconnect(); ctrl?.cleanup?.(); ctrl?.dispose(); ctrlRef.current = null; setStatus((s) => (s === 'nowebgl' ? s : 'loading')); };
  }, [room, status === 'nowebgl']);                                             // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctrl = ctrlRef.current; if (!ctrl || status !== 'ready') return;
    ctrl.configure({ tight: !!phone || !(w && h), kind, width: w || 36, height: h || 60, mount, drive: parseMech(kind, mech), cover: cover || 'wrapped', layers: layers.map((l) => ({ fabric: l.fabric, optics: l.optics })), amount });
  }, [status, kind, w, h, mount, mech, cover, key, phone]);                            // eslint-disable-line react-hooks/exhaustive-deps

  const setAmountNow = (a) => { ctrlRef.current?.snapAmount(a); setAmount(a); };
  const down = (e) => { const r = e.currentTarget.getBoundingClientRect(); dragRef.current = { rect: r, y0: e.clientY, moved: false, grab: 0 }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    const d = dragRef.current; if (!d) return;
    const hh = ctrlRef.current?.shadeHeight || 1;
    if (!d.moved) { if (Math.abs(e.clientY - d.y0) < 4) return; d.moved = true; d.grab = (d.y0 - d.rect.top) / d.rect.height - (0.064 + amount * (hh - 0.094) + 0.015) / hh; }
    setAmountNow(amountFromHandle((e.clientY - d.rect.top) / d.rect.height - d.grab, hh));
  };
  const up = (e) => { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId); };

  if (status === 'nowebgl') return <div className="pv pv-photo">{fallback}</div>;
  const roomBlind = { product: layers[0].product, fabric: layers[0].fabric };
  const pct = Math.round(amount * 100);
  const sample = layers.some((l) => l.sample);
  const wTxt = w ? `${formatInches(w)} in wide` : null, hTxt = h ? `${formatInches(h)} in high` : null;
  const clamped = (w && (w < 12 || w > 300)) || (h && (h < 12 || h > 300));

  return (
    <div className="pv">
      {room ? (
        <div className="pv-stage pv-room">
          <RoomEmbed blind={roomBlind} amount={amount} onAmount={setAmount} phone={phone} />
        </div>
      ) : (
        <div className={`pv-stage${status === 'ready' ? ' ready' : ''}`} ref={stageRef}>
          <div className="pv-photo-under" aria-hidden={status === 'ready'}>{fallback}</div>
          <canvas className="pv-canvas" ref={canvasRef} aria-label={`3D preview of your ${kind} shade`} role="img" />
          {status === 'ready' && layout && (
            <>
              <div className="pv-drag" style={{ left: layout.x0, top: layout.y0, width: layout.x1 - layout.x0, height: layout.y1 - layout.y0 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { dragRef.current = null; }} aria-hidden="true" />
              <span className="rl-handle v" style={{ left: layout.handle.x, top: layout.handle.y }} aria-hidden="true"><i /></span>
              {sizes && wTxt && hTxt && (
                <>
                  <span className="pv-dim pv-dim-w" style={{ left: layout.x0, width: layout.x1 - layout.x0, top: Math.max(8, layout.y0 - 30) }}><b>{wTxt}</b></span>
                  <span className="pv-dim pv-dim-h" style={{ top: layout.y0, height: layout.y1 - layout.y0, left: Math.max(8, layout.x0 - 30) }}><b>{hTxt || ''}</b></span>
                </>
              )}
            </>
          )}
          {status === 'loading' && <span className="rl-loading" role="status">Loading the 3D preview…</span>}
        </div>
      )}

      <div className="pv-tools">
        <button type="button" className="pv-btn" onClick={() => setRoom((r) => !r)} aria-pressed={room}>{room ? 'Back to my window' : 'See it in a room'}</button>
        {!room && <button type="button" className="pv-btn pv-btn-quiet" aria-pressed={!sizes} onClick={() => setSizes((s) => !s)}>{sizes ? 'Hide sizes' : 'Show sizes'}</button>}
      </div>
      <div className="pv-slide">
        <label htmlFor="pv-amount">Raise and lower <span>{pct}% lowered</span></label>
        <input id="pv-amount" className="rl-slider" type="range" min="0" max="100" step="1" value={pct} onChange={(e) => setAmountNow(Number(e.target.value) / 100)} aria-valuetext={`${pct}% lowered`} />
      </div>
      <p className="pv-note">
        {room ? 'Your blind in all three windows. Colors, control and cover are true to your choices; the size is fitted to the room’s windows.'
          : <>{sample ? 'Showing a sample color. Pick yours to see it here. ' : ''}{!w || !h ? 'Showing a typical window. Enter your size to see yours to scale. ' : ''}{driveNote(parseMech(kind, mech))}.{clamped ? ' Shown at the nearest size we can draw.' : ''}</>}
      </p>
    </div>
  );
}
