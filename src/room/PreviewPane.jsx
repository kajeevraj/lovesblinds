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
import { isSoft, lightTypeFor, opticsFor, moversFor, startAmounts, sampleSpec, DAY_NIGHT, HEAD_WORD } from './shadeKinds.js';
import { parseMech, SIDE_NAME, MOTOR_CONTROL_NAME } from '../lib/drive.js';
import { chainColorOf, barColorOf, headColorOf, CORD_LOOP_COLORS } from '../lib/choices.js';
import { SimpleRemote } from './remotes.jsx';
import { SHARE_NOTE, WORKS_NOTE } from '../lib/remote.js';
import { useHubPrice } from '../lib/hubPrice.js';
import { zigbeeNote } from '../lib/hub.js';
import RoomEmbed from './RoomEmbed.jsx';

const SAMPLE = { roller: 'rlf-soft-cream', zebra: 'zeb-cream' };
const ROLLER_BY_FAMILY = { solar: 'roller-solar', 'screen-view': 'roller-screen', blackout: 'roller-blackout' };
// what the drawing shows, in a sentence
// `rails`: a cellular shade with two rails that move (top-down/bottom-up, day & night); `head`: where the motor is ("roller", "headrail", "cassette")
function driveNote(d, extras, many, rails = false, head = 'roller') {
  const side = SIDE_NAME[d.side].toLowerCase();
  if (d.movement === 'chain' && extras?.cordType === 'cord-loop') return `Cord loop, on the ${side}, ${cordColorOf(extras.cordColor).label.toLowerCase()}`;
  if (d.movement === 'chain') return `Continuous chain, on the ${side}${extras?.chainColor ? `, ${chainColorOf(extras.chainColor).label.toLowerCase()}` : ''}`;
  if (d.movement === 'zero-gravity') return rails ? 'Zero gravity, nothing hangs down. Each rail has its own handle' : many ? 'Zero gravity, nothing hangs down. Each shade has its own handle on its bottom bar' : 'Zero gravity, nothing hangs down. Move the shade by its center handle';
  if (d.movement === 'two-in-one') return '2 in 1 motor, inside the roller on the right. Use the remote, or move the shade by its handle';
  const power = d.power === 'wired' ? `wired; the motor is inside the ${head} and the cord leaves the end cap on the ${side}`
    : `battery; the motor is inside the ${head} and charges through a small port on the end cap on the ${side}${d.solar ? ', and the solar panel goes on the window glass near the top' : ''}`;
  return `Motorized, ${power}. ${MOTOR_CONTROL_NAME[d.control]}`;
}
const cordColorOf = (id) => CORD_LOOP_COLORS.find((c) => c.id === id) || CORD_LOOP_COLORS[0];

// the product (optics, name) a pick belongs to
export const productIdFor = (kind, pick) => (kind === 'zebra' ? 'zebra' : ROLLER_BY_FAMILY[pick?.family] || 'roller-solar');

export function fabricFromPick(kind, pick, lightType = null) {
  const sw = pick ? getSwatch(pick.swatchId, pick.fabricId) : null;
  return sw ? specFromEntry({ swatch: sw, color: colorFamilyOf(sw) }, kind, lightType) : null;
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const KEY_STEP = 0.03;

// `style`: the cellular type (standard, top-down-bottom-up, day-night) or the roman style; `lining`: the roman lining; `family`: the cellular family shown before a color is picked
export default function PreviewPane({ kind, picks, double, width, height, mount, mech, cover, fallback, phone, onReady, remoteType = 'ch1', shareNote = false, extras = {}, style = null, lining = null, family = null }) {
  const hubPrice = useHubPrice();
  const [status, setStatus] = useState(() => (webglAvailable() ? 'loading' : 'nowebgl'));      // loading | ready | nowebgl
  // where each shade is (0 raised, 1 fully lowered): a single shade a little over halfway; a double-stack's front shade halfway down and its back shade raised
  // (a top-down cellular: the top rail dropped a little; day & night: both cloths showing): see shadeKinds.js
  const soft = isSoft(kind), dayNight = kind === 'cellular' && style === 'day-night';
  const moverList = moversFor(kind, { double, style }), moverKey = moverList.map((m) => m.id).join('|');
  const [amounts, setAmounts] = useState(() => startAmounts(kind, { double, style }));
  useEffect(() => { setAmounts(startAmounts(kind, { double, style })); }, [double, moverKey]);       // eslint-disable-line react-hooks/exhaustive-deps
  // Shangri-La: the vanes (closed = privacy). They open only with the shade all the way down, so opening them lowers it and raising it closes them.
  const [vanes, setVanes] = useState(false);
  const [layout, setLayout] = useState(null);
  // The room view is not offered on the product page any more (the code stays in place, unused).
  const room = false;
  // the hint (a small pill on the bottom bar) is only for shades with no handle, and fades after the first drag, remote press or key press for the rest of the visit
  const [touched, setTouched] = useState(() => { try { return sessionStorage.getItem('lb_pv_touched') === '1'; } catch { return false; } });
  const touch = () => { setTouched(true); try { sessionStorage.setItem('lb_pv_touched', '1'); } catch { /* private mode */ } };
  const [grab, setGrab] = useState(0);                                           // the chain strand being pulled (1 raises, 2 lowers)
  const [lit, setLit] = useState(null);                                           // the remote button that was just pressed
  const litTimer = useRef(0);
  const canvasRef = useRef(null), ctrlRef = useRef(null), stageRef = useRef(null), dragRef = useRef(null), shadeRef = useRef(null), chainRef = useRef(null), partsRef = useRef(null);

  const w = Number(width) > 0 ? Number(width) : null, h = Number(height) > 0 ? Number(height) : null;
  const drv = parseMech(kind, mech, { double });
  const layers = useMemo(() => {
    if (soft) {                                                                 // one shade; day & night wears two cloths (day above the middle rail, night below it)
      const fams = dayNight ? ['light-filtering', 'blackout'] : [null];
      return fams.map((fam, i) => {
        const pick = picks[i] || null, lt = lightTypeFor(kind, { family: fam || pick?.family || family, lining });
        return { pick, fabric: fabricFromPick(kind, pick, lt) || sampleSpec(kind, lt), optics: opticsFor(lt), sample: !pick, product: kind };
      });
    }
    return picks.slice(0, double ? 2 : 1).map((pick) => {
      const pid = productIdFor(kind, pick);
      return { pick, fabric: fabricFromPick(kind, pick) || presetSpec(SAMPLE[kind]), optics: PRODUCT_BY_ID[pid].optics, sample: !pick, product: pid };
    });
  }, [kind, double, picks, style, lining, family]);                             // eslint-disable-line react-hooks/exhaustive-deps
  const key = layers.map((l) => l.fabric.key).join('|');
  // the thin true-color chain and the bottom bar color; a double-stack bar wrapped in fabric keeps the fabric
  const cordLoop = extras.cordType === 'cord-loop', chain = cordLoop ? cordColorOf(extras.cordColor) : chainColorOf(extras.chainColor);
  const sceneExtras = useMemo(() => ({
    chainHex: chain.hex, chainMetal: chain.id === 'stainless-steel', cordLoop,
    railHex: double && extras.bottomWrap !== 'none' ? null : barColorOf(extras.barColor).hex,
    headHex: soft ? headColorOf(extras.headColor).hex : null,                    // cellular rails, roman headrail, shangri-la cassette
  }), [chain.hex, chain.id, cordLoop, double, extras.bottomWrap, extras.barColor, soft, extras.headColor]);

  useEffect(() => {
    if (status === 'nowebgl' || room) return undefined;
    let dead = false, ctrl = null, io = null, ro = null;
    const t = setTimeout(async () => {
      let mod; try { mod = await import('./previewScene.js'); } catch { if (!dead) setStatus('nowebgl'); return; }
      if (dead) return;
      try { ctrl = mod.createPreviewScene(canvasRef.current, { onLayout: setLayout, onVanes: setVanes, onAmount: (a) => setAmounts((prev) => (prev.length === a.length && prev.every((x, i) => x === a[i]) ? prev : a)), onDrive: () => {} }); } catch { if (!dead) setStatus('nowebgl'); return; }
      ctrlRef.current = ctrl; try { window.__lbPreview = ctrl; } catch { /* no window */ }          // window.__lbPreview: the scene, for the tests
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
    // new parts to move (a double-stack, another cellular type): they start where that kind starts; otherwise everything stays where the customer left it
    const start = startAmounts(kind, { double, style }), fresh = partsRef.current !== moverKey || amounts.length !== start.length; partsRef.current = moverKey;
    ctrl.configure({ tight: !!phone || !(w && h), kind, style: soft ? (style || 'none') : 'none', width: w || 36, height: h || 60, mount, drive: drv, cover: cover || 'wrapped', layers: layers.map((l) => ({ fabric: l.fabric, optics: l.optics })), amounts: fresh ? start : amounts.slice(), extras: sceneExtras });
  }, [status, kind, w, h, mount, mech, cover, key, phone, double, sceneExtras, style, moverKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  // `many`: a double-stack (two shades, front and back); `rails`: one shade with two rails that move
  const many = !soft && layers.length > 1, rails = soft && moverList.length > 1;
  const press = (k) => {
    touch();
    const ctrl = ctrlRef.current;
    const two = /^(top|bot)(Up|Down|Stop)$/.exec(String(k));                     // a two-rail cellular: one row of up, stop, down for the upper rail, one for the bottom rail
    if (two) ctrl?.drive(two[2] === 'Up' ? -1 : two[2] === 'Down' ? 1 : 0, two[1] === 'top' ? 1 : 0);
    else {
      const [who, what] = String(k).includes(':') ? String(k).split(':') : ['front', k];
      const i = who === 'back' ? 1 : 0;
      if (what === 'up' || what === 'down' || what === 'stop') ctrl?.drive(what === 'up' ? -1 : what === 'down' ? 1 : 0, i);
    }
    setLit(k); clearTimeout(litTimer.current); litTimer.current = setTimeout(() => setLit(null), 320);
  };
  useEffect(() => () => clearTimeout(litTimer.current), []);
  // each handle (or bar) moves only its own shade or rail (a rail that meets the other one pushes it: the scene answers with every position)
  const setAmountAt = (i, a) => {
    touch();
    const all = ctrlRef.current?.snapAmount(a, i);
    setAmounts((prev) => (all && all.length === prev.length ? all : prev.map((x, k) => (k === i ? a : x))));
  };
  // glide there (the buttons under the picture)
  const glide = (targets) => { touch(); const ctrl = ctrlRef.current; if (!ctrl) return; [...targets.keys()].reverse().forEach((i) => ctrl.moveTo(targets[i], i)); };
  const toggleVanes = () => { ctrlRef.current?.setVanes(!vanes); };
  // the chain: one strand pulled down raises the shade, the other lowers it; the beads follow the finger (the scene moves them with the shade)
  const chainDown = (k) => (e) => {
    const c = layout?.chain; if (!c) return;
    chainRef.current = { k, y0: e.clientY, a0: amounts[0] ?? 0, per: Math.max(40, c.pxPerM * c.travelM) };
    setGrab(k + 1); e.currentTarget.setPointerCapture?.(e.pointerId); e.preventDefault();
  };
  const chainMove = (e) => {
    const d = chainRef.current; if (!d) return;
    const dy = e.clientY - d.y0; setAmountAt(0, Math.min(1, Math.max(0, d.a0 + (d.k ? 1 : -1) * dy / d.per)));
  };
  const chainUp = (e) => { chainRef.current = null; setGrab(0); e.currentTarget.releasePointerCapture?.(e.pointerId); };
  const down = (i) => (e) => {
    const r = shadeRef.current?.getBoundingClientRect(); if (!r) return;
    dragRef.current = { i, rect: r, y0: e.clientY, moved: false, grab: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const d = dragRef.current, ctrl = ctrlRef.current; if (!d || !ctrl) return;
    if (!d.moved) { if (Math.abs(e.clientY - d.y0) < 3) return; d.moved = true; d.grab = (d.y0 - d.rect.top) / d.rect.height - ctrl.handleFraction(d.i); }
    setAmountAt(d.i, ctrl.amountAt(d.i, (e.clientY - d.rect.top) / d.rect.height - d.grab));
  };
  const up = (e) => { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId); };
  const key_ = (i) => (e) => {
    const cur = (i === 0 ? ctrlRef.current?.pendingAmount?.() : null) ?? amounts[i] ?? 0;          // (the shade waiting for the vanes to close: keep counting from where it is going)
    const step = e.shiftKey ? KEY_STEP * 3 : KEY_STEP;
    let a = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') a = cur - step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') a = cur + step;
    else if (e.key === 'PageUp') a = cur - 0.1;
    else if (e.key === 'PageDown') a = cur + 0.1;
    else if (e.key === 'Home') a = 0;
    else if (e.key === 'End') a = 1;
    if (a == null) return;
    e.preventDefault();
    setAmountAt(i, Math.min(1, Math.max(0, a)));
  };

  if (status === 'nowebgl') return <div className="pv pv-photo">{fallback}</div>;
  const chained = drv.movement === 'chain';
  const hasHandle = drv.movement === 'zero-gravity' || drv.movement === 'two-in-one';
  const withRemote = drv.movement === 'motorized' || drv.movement === 'two-in-one';
  const tile = status === 'ready' && withRemote && (
            <div className="pv-incl pv-incl-under">
              <SimpleRemote type={remoteType} lit={lit} onPress={press} shades={many ? ['Front shade', 'Back shade'] : null} upperLabel={rails ? moverList[1].label : null} />
              <span className="pv-incl-title">Included: remote</span>
              {drv.movement === 'motorized' && drv.control === 'app-remote' && <div className="pv-works-row"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><circle cx="12" cy="18.6" r="0.9" /></svg><span>{WORKS_NOTE['app-remote']}</span></div>}
              {drv.movement === 'motorized' && drv.control === 'zigbee' && <div className="pv-works-row"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2" /></svg><span>{zigbeeNote(hubPrice)}</span></div>}
              {drv.movement === 'motorized' && drv.control === 'matter' && <div className="pv-works-row"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="3.5" width="11" height="17" rx="5" /><circle cx="12" cy="9" r="1.2" /></svg><span>{WORKS_NOTE.matter}</span></div>}
              {shareNote && <div className="pv-share">{SHARE_NOTE}</div>}
            </div>
  );
  const roomBlind = { product: layers[0].product, fabric: layers[0].fabric };
  const sample = layers.some((l) => l.sample);
  const clamped = (w && (w < 12 || w > 300)) || (h && (h < 12 || h > 300));
  const ariaFor = (i) => ({ role: 'slider', 'aria-orientation': 'vertical', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round((amounts[i] ?? 0) * 100), 'aria-valuetext': `${Math.round((amounts[i] ?? 0) * 100)}% lowered` });
  const who = (i) => (many || rails ? moverList[i]?.label : null);
  const part = (i) => (many || rails ? moverList[i]?.id : undefined);
  const dayOn = dayNight && (amounts[1] ?? 0) > 0.5;
  // a handle matches its bottom bar: the bar color, or the shade's fabric when a double-stack's bar is wrapped
  const barHex = (i) => (soft ? headColorOf(extras.headColor).hex : double && extras.bottomWrap !== 'none' ? (layers[i]?.fabric?.color || '#efece5') : barColorOf(extras.barColor).hex);
  const lum = (hex) => { const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
  const gripStyle = (i, h) => { const bg = barHex(i); return { left: h.x, top: h.y, '--grip-bg': bg, '--grip-ink': lum(bg) > 0.55 ? '#7A5C2E' : '#f4efe4' }; };

  return (
    <div className="pv">
      {room ? (
        <div className="pv-stage pv-room">
          <RoomEmbed blind={roomBlind} amount={amounts[0]} onAmount={(a) => setAmounts([a])} phone={phone} />
        </div>
      ) : (
        <div className={`pv-stage${status === 'ready' ? ' ready' : ''}`} ref={stageRef}>
          <div className="pv-photo-under" aria-hidden={status === 'ready'}>{fallback}</div>
          <canvas className="pv-canvas" ref={canvasRef} aria-label={`3D preview of your ${kind} shade`} role="img" />
          {status === 'ready' && layout && (
            <>
              {!many && <div className="pv-drag" ref={shadeRef} style={{ left: layout.x0, top: layout.y0, width: layout.x1 - layout.x0, height: layout.y1 - layout.y0, pointerEvents: chained && layout.chain ? 'none' : undefined }} onPointerDown={down(0)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { dragRef.current = null; }} aria-hidden="true" />}
              {many && <div ref={shadeRef} style={{ position: 'absolute', left: layout.x0, top: layout.y0, width: layout.x1 - layout.x0, height: layout.y1 - layout.y0, pointerEvents: 'none' }} aria-hidden="true" />}
              {hasHandle ? (layout.handles || [layout.handle]).slice(0, moverList.length).map((h, i) => (
                <button key={i} type="button" className={`pv-grip${many ? ' two' : ''}${layout.hidden?.[i] ? ' behind' : ''}`} {...ariaFor(i)} data-shade={many ? part(i) : undefined} data-rail={rails ? part(i) : undefined}
                  aria-label={who(i) || 'Handle. Drag it, or use the arrow keys, to move the shade'} style={gripStyle(i, h)}
                  onPointerDown={down(i)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { dragRef.current = null; }} onKeyDown={key_(i)}><i aria-hidden="true" /></button>
              )) : (
                <>
                  {(layout.handles || [layout.handle]).slice(0, moverList.length).map((h, i) => (chained && !many && !rails && layout.chain) ? null : (
                    <button key={i} type="button" className="pv-bar" {...ariaFor(i)} data-shade={many ? part(i) : undefined} data-rail={rails ? part(i) : undefined}
                      aria-label={who(i) || 'Bottom bar. Drag it, or use the arrow keys, to move the shade'}
                      style={many || (rails && layout.near > 0.5) ? { left: layout.x0 + ((many ? i === 0 : i === 1) ? 0 : 0.5) * (layout.x1 - layout.x0), width: 0.5 * (layout.x1 - layout.x0), top: h.y } : { left: layout.x0, width: layout.x1 - layout.x0, top: h.y }}
                      onPointerDown={down(i)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { dragRef.current = null; }} onKeyDown={key_(i)} />
                  ))}
                  {!many && !chained && <span className={`rl-handle v pv-handle${touched ? ' gone' : ''}`} style={{ left: layout.handle.x, top: layout.handle.y }} aria-hidden="true"><i /></span>}
                </>
              )}
              {chained && layout.chain && (() => { const c = layout.chain, wd = 46, hgt = Math.max(60, c.bottom - c.top + 24); return (
                <div className={`pv-chain${grab ? ' grabbing' : ''}`} role="slider" tabIndex={0} aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((amounts[0] ?? 0) * 100)} aria-valuetext={`${Math.round((amounts[0] ?? 0) * 100)}% lowered`}
                  aria-label={extras.cordType === 'cord-loop' ? 'Cord loop. Drag a cord, or use the arrow keys, to raise or lower the shade' : 'Chain. Drag a strand, or use the arrow keys, to raise or lower the shade'}
                  style={{ left: c.x - wd, top: c.top - 6, width: wd * 2, height: hgt }} onKeyDown={key_(0)}>
                  <div className="pv-chain-hit" data-strand="raise" style={{ left: 0, width: wd }} onPointerDown={chainDown(0)} onPointerMove={chainMove} onPointerUp={chainUp} onPointerCancel={chainUp} />
                  <div className="pv-chain-hit" data-strand="lower" style={{ left: wd, width: wd }} onPointerDown={chainDown(1)} onPointerMove={chainMove} onPointerUp={chainUp} onPointerCancel={chainUp} />
                </div>); })()}
              {w && h && <span className="pv-size" style={{ left: (layout.x0 + layout.x1) / 2, top: layout.labelY }}>{formatInches(w)} × {formatInches(h)} in</span>}
            </>
          )}
          {status === 'loading' && <span className="rl-loading" role="status">Loading the 3D preview…</span>}
        </div>
      )}
      {!room && status === 'ready' && kind === 'shangri-la' && (amounts[0] ?? 0) >= 0.985 && (
        <div className="pv-ctl" role="group" aria-label="Vanes" data-vanes={vanes ? 'open' : 'closed'}>
          <button type="button" className={`pv-ctl-btn${vanes ? ' on' : ''}`} aria-pressed={vanes} onClick={toggleVanes}>{vanes ? 'Close vanes' : 'Open vanes'}</button>
          <span className="pv-ctl-note">{vanes ? 'Open: soft light between the vanes.' : 'Closed: privacy.'}</span>
        </div>
      )}
      {!room && status === 'ready' && dayNight && (
        <div className="pv-ctl" role="group" aria-label="Which fabric covers the window" data-cover={dayOn ? 'day' : 'night'}>
          <button type="button" className={`pv-ctl-btn${dayOn ? ' on' : ''}`} aria-pressed={dayOn} onClick={() => glide(DAY_NIGHT.day)}>Day fabric</button>
          <button type="button" className={`pv-ctl-btn${!dayOn ? ' on' : ''}`} aria-pressed={!dayOn} onClick={() => glide(DAY_NIGHT.night)}>Night fabric</button>
          <span className="pv-ctl-note">Or slide the middle rail.</span>
        </div>
      )}
      {!room && tile}
      <p className="pv-note">
        {sample ? 'Showing a sample color. Pick yours to see it here. ' : ''}{!w || !h ? 'Showing a typical window. Enter your size to see yours to scale. ' : ''}{driveNote(drv, extras, many, rails, HEAD_WORD[kind])}.{chained ? (extras.cordType === 'cord-loop' ? ' Pull the cord to raise or lower.' : ' Pull the chain to raise or lower.') : ''}{kind === 'shangri-la' ? ' The vanes open by themselves when the shade reaches the bottom, and close before it rises.' : ''}{clamped ? ' Shown at the nearest size we can draw.' : ''}
      </p>
    </div>
  );
}
