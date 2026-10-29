// The product page's preview: your blind, at the size you typed, in a window. Driven only by the page's choices.
// Lazy-loaded (three.js is in this chunk), shown after the page's photo, which stays in place until the 3D is ready. No WebGL: the photo stays.
//
// Moving the shade: drag the center handle (Zero gravity and 2 in 1 shades always show it), or the bottom bar (every other option), or use the remote
// buttons (motorized). The handle and the bottom bar are focusable and move with the arrow keys. There is no slider bar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSwatch, colorFamilyOf } from '../data/swatchData.js';
import { formatInches } from '../lib/inches.js';
import { PRODUCT_BY_ID } from './data.js';
import { presetSpec, specFromEntry } from './fabricSpec.js';
import { amountFromHandle } from './models/shade.js';
import { parseMech, SIDE_NAME, MOTOR_CONTROL_NAME } from '../lib/drive.js';
import { chainColorOf, barColorOf } from '../lib/choices.js';
import { SimpleRemote } from './remotes.jsx';
import { SHARE_NOTE, WORKS_NOTE } from '../lib/remote.js';
import RoomEmbed from './RoomEmbed.jsx';

const SAMPLE = { roller: 'rlf-soft-cream', zebra: 'zeb-cream' };
const ROLLER_BY_FAMILY = { solar: 'roller-solar', 'screen-view': 'roller-screen', blackout: 'roller-blackout' };
// what the drawing shows, in a sentence
function driveNote(d, extras) {
  const side = SIDE_NAME[d.side].toLowerCase();
  if (d.movement === 'chain') return `Continuous chain, on the ${side}${extras?.chainColor ? `, ${chainColorOf(extras.chainColor).label.toLowerCase()}` : ''}`;
  if (d.movement === 'zero-gravity') return 'Zero gravity, nothing hangs down. Move the shade by its center handle';
  if (d.movement === 'two-in-one') return '2 in 1 motor, inside the roller on the right. Use the remote, or move the shade by its handle';
  const power = d.power === 'wired' ? `wired; the motor is inside the roller and the cord leaves the end cap on the ${side}`
    : `battery; the motor is inside the roller and charges through a small port on the end cap on the ${side}${d.solar ? ', and the solar panel goes on the window glass near the top' : ''}`;
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

const KEY_STEP = 0.03;

export default function PreviewPane({ kind, picks, double, width, height, mount, mech, cover, fallback, phone, onReady, remoteType = 'ch1', shareNote = false, extras = {} }) {
  const [status, setStatus] = useState(() => (webglAvailable() ? 'loading' : 'nowebgl'));      // loading | ready | nowebgl
  const [amount, setAmount] = useState(0.55);
  const [layout, setLayout] = useState(null);
  // The room view is not offered on the product page any more (the code stays in place, unused).
  const room = false;
  // the hint (a small pill on the bottom bar) is only for shades with no handle, and fades after the first drag, remote press or key press for the rest of the visit
  const [touched, setTouched] = useState(() => { try { return sessionStorage.getItem('lb_pv_touched') === '1'; } catch { return false; } });
  const touch = () => { setTouched(true); try { sessionStorage.setItem('lb_pv_touched', '1'); } catch { /* private mode */ } };
  const [lit, setLit] = useState(null);                                           // the remote button that was just pressed
  const litTimer = useRef(0);
  const canvasRef = useRef(null), ctrlRef = useRef(null), stageRef = useRef(null), dragRef = useRef(null), shadeRef = useRef(null);

  const w = Number(width) > 0 ? Number(width) : null, h = Number(height) > 0 ? Number(height) : null;
  const drv = parseMech(kind, mech, { double });
  const layers = useMemo(() => picks.slice(0, double ? 2 : 1).map((pick) => {
    const pid = productIdFor(kind, pick);
    return { pick, fabric: fabricFromPick(kind, pick) || presetSpec(SAMPLE[kind]), optics: PRODUCT_BY_ID[pid].optics, sample: !pick, product: pid };
  }), [kind, double, picks]);                                                   // eslint-disable-line react-hooks/exhaustive-deps
  const key = layers.map((l) => l.fabric.key).join('|');
  // the thin true-color chain and the bottom bar color; a double-stack bar wrapped in fabric keeps the fabric
  const chain = chainColorOf(extras.chainColor);
  const sceneExtras = useMemo(() => ({
    chainHex: chain.hex, chainMetal: chain.id === 'stainless-steel',
    railHex: double && extras.bottomWrap !== 'none' ? null : barColorOf(extras.barColor).hex,
  }), [chain.hex, chain.id, double, extras.bottomWrap, extras.barColor]);

  useEffect(() => {
    if (status === 'nowebgl' || room) return undefined;
    let dead = false, ctrl = null, io = null, ro = null;
    const t = setTimeout(async () => {
      let mod; try { mod = await import('./previewScene.js'); } catch { if (!dead) setStatus('nowebgl'); return; }
      if (dead) return;
      try { ctrl = mod.createPreviewScene(canvasRef.current, { onLayout: setLayout, onAmount: setAmount, onDrive: () => {} }); } catch { if (!dead) setStatus('nowebgl'); return; }
      ctrlRef.current = ctrl;
      const stage = stageRef.current;
      ro = new ResizeObserver(() => { const r = stage.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; ctrl.resize(Math.max(2, Math.round(r.width)), Math.max(2, Math.round(r.height)), window.devicePixelRatio || 1); });
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
    ctrl.configure({ tight: !!phone || !(w && h), kind, width: w || 36, height: h || 60, mount, drive: drv, cover: cover || 'wrapped', layers: layers.map((l) => ({ fabric: l.fabric, optics: l.optics })), amount, extras: sceneExtras });
  }, [status, kind, w, h, mount, mech, cover, key, phone, double, sceneExtras]);   // eslint-disable-line react-hooks/exhaustive-deps

  const press = (k) => {
    touch();
    if (k === 'up' || k === 'down' || k === 'stop') ctrlRef.current?.drive(k === 'up' ? -1 : k === 'down' ? 1 : 0);
    setLit(k); clearTimeout(litTimer.current); litTimer.current = setTimeout(() => setLit(null), 320);
  };
  useEffect(() => () => clearTimeout(litTimer.current), []);
  const setAmountNow = (a) => { touch(); ctrlRef.current?.snapAmount(a); setAmount(a); };
  // dragging: the handle, the bottom bar and the shade itself all use the same maths, measured against the shade's box
  const down = (e) => {
    const r = shadeRef.current?.getBoundingClientRect(); if (!r) return;
    dragRef.current = { rect: r, y0: e.clientY, moved: false, grab: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const d = dragRef.current; if (!d) return;
    const hh = ctrlRef.current?.shadeHeight || 1;
    if (!d.moved) { if (Math.abs(e.clientY - d.y0) < 3) return; d.moved = true; d.grab = (d.y0 - d.rect.top) / d.rect.height - (0.064 + amount * (hh - 0.094) + 0.015) / hh; }
    setAmountNow(amountFromHandle((e.clientY - d.rect.top) / d.rect.height - d.grab, hh));
  };
  const up = (e) => { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId); };
  const key_ = (e) => {
    const step = e.shiftKey ? KEY_STEP * 3 : KEY_STEP;
    let a = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') a = amount - step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') a = amount + step;
    else if (e.key === 'PageUp') a = amount - 0.1;
    else if (e.key === 'PageDown') a = amount + 0.1;
    else if (e.key === 'Home') a = 0;
    else if (e.key === 'End') a = 1;
    if (a == null) return;
    e.preventDefault();
    setAmountNow(Math.min(1, Math.max(0, a)));
  };

  if (status === 'nowebgl') return <div className="pv pv-photo">{fallback}</div>;
  const hasHandle = drv.movement === 'zero-gravity' || drv.movement === 'two-in-one';
  const withRemote = drv.movement === 'motorized' || drv.movement === 'two-in-one';
  const tile = status === 'ready' && withRemote && (
            <div className="pv-incl pv-incl-under">
              <SimpleRemote type={remoteType} lit={lit} onPress={press} />
              <span className="pv-incl-title">Included: remote</span>
              {drv.movement === 'motorized' && drv.control === 'app-remote' && <div className="pv-works-row"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><circle cx="12" cy="18.6" r="0.9" /></svg><span>{WORKS_NOTE['app-remote']}</span></div>}
              {drv.movement === 'motorized' && drv.control === 'zigbee' && <div className="pv-works-row"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2" /></svg><span>{WORKS_NOTE.zigbee}</span></div>}
              {drv.movement === 'motorized' && drv.control === 'matter' && <div className="pv-works-row"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="3.5" width="11" height="17" rx="5" /><circle cx="12" cy="9" r="1.2" /></svg><span>{WORKS_NOTE.matter}</span></div>}
              {shareNote && <div className="pv-share">{SHARE_NOTE}</div>}
            </div>
  );
  const roomBlind = { product: layers[0].product, fabric: layers[0].fabric };
  const pct = Math.round(amount * 100);
  const sample = layers.some((l) => l.sample);
  const clamped = (w && (w < 12 || w > 300)) || (h && (h < 12 || h > 300));
  const aria = { role: 'slider', 'aria-orientation': 'vertical', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-valuetext': `${pct}% lowered` };

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
              <div className="pv-drag" ref={shadeRef} style={{ left: layout.x0, top: layout.y0, width: layout.x1 - layout.x0, height: layout.y1 - layout.y0 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { dragRef.current = null; }} aria-hidden="true" />
              {hasHandle ? (
                <button type="button" className="pv-grip" {...aria} aria-label="Handle. Drag it, or use the arrow keys, to move the shade" style={{ left: layout.handle.x, top: layout.handle.y }}
                  onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { dragRef.current = null; }} onKeyDown={key_}><i aria-hidden="true" /></button>
              ) : (
                <>
                  <button type="button" className="pv-bar" {...aria} aria-label="Bottom bar. Drag it, or use the arrow keys, to move the shade" style={{ left: layout.x0, width: layout.x1 - layout.x0, top: layout.handle.y }}
                    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { dragRef.current = null; }} onKeyDown={key_} />
                  <span className={`rl-handle v pv-handle${touched ? ' gone' : ''}`} style={{ left: layout.handle.x, top: layout.handle.y }} aria-hidden="true"><i /></span>
                </>
              )}
              {w && h && <span className="pv-size" style={{ left: (layout.x0 + layout.x1) / 2, top: layout.labelY }}>{formatInches(w)} × {formatInches(h)} in</span>}
            </>
          )}
          {status === 'loading' && <span className="rl-loading" role="status">Loading the 3D preview…</span>}
        </div>
      )}
      {!room && tile}
      <p className="pv-note">
        {sample ? 'Showing a sample color. Pick yours to see it here. ' : ''}{!w || !h ? 'Showing a typical window. Enter your size to see yours to scale. ' : ''}{driveNote(drv, extras)}.{clamped ? ' Shown at the nearest size we can draw.' : ''}
      </p>
    </div>
  );
}
