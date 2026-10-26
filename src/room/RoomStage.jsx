// The room photo with the 3D canvas and the furniture cutout laid over it, plus whatever the page puts on top (drag areas, pills, handles).
// Shared by the room lab, the product page's "See it in a room" and the homepage hero test. It owns: the photo (one right-sized file, the same
// one index.html preloads), loading the three.js scene after the photo is shown, resizing, pausing when off-screen or hidden, and the animated view.
//
//   <RoomStage base={view} goal={view} onCtrl={(ctrl) => ...}>{(api) => overlays}</RoomStage>
// api = { view, bright, amounts, status, ctrl, box(rect), at(u, v), stageRef }; rects and points are in photo pixels (2000 x 1333).
import { useEffect, useRef, useState } from 'react';
import { PHOTO } from './data.js';
import { pickWidth, roomSrc } from './photoSize.js';
import ROOM_TINY from './roomTiny.js';
import './room.css';

const pct = (v) => `${(v * 100).toFixed(4)}%`;
export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function RoomStage({ base, goal, onCtrl, onState, stageRef: outerRef, children, alt, className = '' }) {
  const ownRef = useRef(null), stageRef = outerRef || ownRef, canvasRef = useRef(null), ctrlRef = useRef(null);
  const [status, setStatus] = useState('loading');                        // loading | ready | nowebgl
  const [view, setView] = useState(base);
  const [bright, setBright] = useState(1);
  const [amounts, setAmounts] = useState({});
  const [photoIn, setPhotoIn] = useState(false);
  const [photoW, setPhotoW] = useState(() => pickWidth(typeof window === 'undefined' ? 1280 : document.documentElement.clientWidth, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  const onCtrlRef = useRef(onCtrl); onCtrlRef.current = onCtrl;
  useEffect(() => { onState?.({ status, view, bright, amounts }); }, [status, view, bright, amounts]);       // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let dead = false, ctrl = null, io = null, ro = null, mq = null;
    const start = async () => {
      let mod;
      try { mod = await import('./scene.js'); } catch { if (!dead) setStatus('nowebgl'); return; }
      if (dead) return;
      try {
        ctrl = mod.createRoomScene(canvasRef.current, { onVisualChange: (v) => {
          if (v.brightness != null) setBright(v.brightness);
          if (v.view) setView(v.view);
          if (v.amounts) setAmounts(v.amounts);
        } });
      } catch { if (!dead) setStatus('nowebgl'); return; }
      ctrlRef.current = ctrl;
      const stage = stageRef.current;
      ro = new ResizeObserver(() => {
        const r = stage.getBoundingClientRect();
        setPhotoW((w) => Math.max(w, pickWidth(document.documentElement.clientWidth, window.devicePixelRatio || 1)));
        ctrl.resize(Math.max(2, Math.round(r.width)), Math.max(2, Math.round(r.height)), window.devicePixelRatio || 1);
      });
      ro.observe(stage);
      let visible = true;
      const sync = () => ctrl.setActive(visible && !document.hidden);
      io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '80px' });
      io.observe(stage);
      document.addEventListener('visibilitychange', sync);
      ctrl.cleanupVisibility = () => document.removeEventListener('visibilitychange', sync);
      mq = matchMedia('(prefers-reduced-motion: reduce)');
      const rm = () => ctrl.setReducedMotion(mq.matches); rm(); mq.addEventListener('change', rm); ctrl.cleanupMotion = () => mq.removeEventListener('change', rm);
      setStatus('ready');
      onCtrlRef.current?.(ctrl);
    };
    const t = setTimeout(start, 30);                                       // let the photo paint first
    return () => {
      dead = true; clearTimeout(t); ro?.disconnect(); io?.disconnect();
      ctrl?.cleanupVisibility?.(); ctrl?.cleanupMotion?.(); onCtrlRef.current?.(null); ctrl?.dispose(); ctrlRef.current = null;
    };
  }, []);

  // the view follows the goal (the layout, a zoom)
  useEffect(() => {
    const ctrl = ctrlRef.current;
    if (ctrl && status === 'ready') ctrl.setView(goal, !prefersReducedMotion()); else setView(goal);
    if (ctrl && status === 'ready' && prefersReducedMotion()) setView(goal);
  }, [goal, status]);

  const layer = { left: pct(-view.x / view.w), top: pct(-view.y / view.h), width: pct(PHOTO.w / view.w), height: pct(PHOTO.h / view.h) };
  const box = ([x0, y0, x1, y1]) => ({ left: pct((x0 - view.x) / view.w), top: pct((y0 - view.y) / view.h), width: pct((x1 - x0) / view.w), height: pct((y1 - y0) / view.h) });
  const at = (u, v) => ({ left: pct((u - view.x) / view.w), top: pct((v - view.y) / view.h) });
  const api = { view, bright, amounts, status, ctrl: status === 'ready' ? ctrlRef.current : null, box, at, stageRef };
  return (
    <div className={`rl-stage ${className}`} ref={stageRef} style={{ aspectRatio: `${base.w} / ${base.h}`, backgroundImage: photoIn ? 'none' : `url(${ROOM_TINY})` }} data-status={status}>
      <img className="rl-layer rl-room" style={layer} src={roomSrc(photoW)} width={PHOTO.w} height={PHOTO.h} onLoad={() => setPhotoIn(true)} alt={alt || 'A bright living room with a cream sofa, a wooden coffee table, a brass floor lamp, a tall plant and three tall windows.'}
        fetchPriority="high" decoding="async" draggable="false" />
      <canvas className="rl-layer rl-canvas" ref={canvasRef} aria-hidden="true" />
      {status === 'ready' && (
        <img className="rl-layer rl-cutout" style={{ ...layer, filter: bright < 0.999 ? `brightness(${bright.toFixed(3)})` : undefined }} src={PHOTO.cutout(photoW)}
          width={PHOTO.w} height={PHOTO.h} alt="" aria-hidden="true" decoding="async" draggable="false" />
      )}
      {typeof children === 'function' ? children(api) : children}
      {status === 'loading' && <span className="rl-loading" role="status">Loading the 3D preview…</span>}
      {status === 'nowebgl' && <span className="rl-loading" role="status">Your browser could not start the 3D preview. The room is shown without it.</span>}
    </div>
  );
}
