// /room-lab: a photo of a room with 3D window treatments drawn into its windows. A test page (noindex, not linked from anywhere).
//
// Layers in the stage, bottom to top: the room photo, the three.js canvas (transparent), the furniture cutout (so shades and curtains pass
// behind the sofa), then the invisible hit areas, the subtle highlight and the drag handles. All of them are placed from the same
// `view` (which part of the 2000 x 1333 photo is on screen), so they cannot drift apart. The 3D scene is loaded after the photo is shown.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { PHOTO, WINDOWS, WINDOW_IDS, PRODUCTS, PRODUCT_BY_ID, COPY, CAM, ROOM, fabricOf, project } from './data.js';
import ROOM_TINY from './roomTiny.js';
import './room.css';

const WIDE = { x: 110, y: 20, w: 1890, h: 1136 };           // desktop: the windows, sofa, lamp and plant
const PHONE = { x: 300, y: 0, w: 1300, h: 1333 };           // phone: the row of windows, taller so the page is not a thin strip
const zoomOn = (id) => { const [x0, , x1] = WINDOWS[id].rect; const c = (x0 + x1) / 2; return { x: c - 380, y: 120, w: 760, h: 779 }; };
const CHIPS = [['left', 'Left'], ['middle', 'Middle'], ['right', 'Right'], ['all', 'All windows']];
const START = { p: 'roller-lf', c: 0, a: 0.62 };
const DEFAULT_AMOUNT = { lower: 0.62, close: 0.6 };
const ZEBRA_AMOUNT = 0.93;                     // near the bottom, where the stripes are partly lined up

const useMedia = (q) => {
  const [m, setM] = useState(() => (typeof matchMedia === 'function' ? matchMedia(q).matches : false));
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
};
const pct = (v) => `${(v * 100).toFixed(4)}%`;
const OPENING_H = (WINDOWS.left.rect[3] - WINDOWS.left.rect[1]) / CAM.scale;      // metres

export default function RoomLab({ navigate }) {
  const phone = useMedia('(max-width: 720px)');
  const base = phone ? PHONE : WIDE;
  const [sel, setSel] = useState('all');
  const [wins, setWins] = useState({ left: START, middle: START, right: START });
  const [allState, setAllState] = useState(START);                     // what "All windows" last set; the far window on the side wall copies it
  const [zoom, setZoom] = useState(false);
  const [view, setView] = useState(base);
  const [bright, setBright] = useState(1);
  const [amounts, setAmounts] = useState({});
  const [status, setStatus] = useState('loading');                      // loading | ready | nowebgl
  const stageRef = useRef(null), canvasRef = useRef(null), ctrlRef = useRef(null), dragRef = useRef(null);

  // ---- what is shown, per window -----------------------------------------------------------------------------------------------------
  const shown = useMemo(() => ({ ...wins, far: allState }), [wins, allState]);
  const cur = sel === 'all' ? allState : wins[sel];
  const product = PRODUCT_BY_ID[cur.p];
  const fabricKey = product.fabrics?.[cur.c] || null;

  const apply = useCallback((patch) => {
    const upd = (s) => {
      const next = { ...s, ...patch };
      if (patch.p && patch.p !== s.p) {                                   // a new product starts at a sensible position and its first colour
        const np = PRODUCT_BY_ID[patch.p];
        next.c = 0;
        next.a = np.id === 'zebra' ? ZEBRA_AMOUNT : DEFAULT_AMOUNT[np.control] ?? s.a;
      }
      return next;
    };
    if (sel === 'all') {
      setAllState(upd); setWins((w) => ({ left: upd(w.left), middle: upd(w.middle), right: upd(w.right) }));
    } else setWins((w) => ({ ...w, [sel]: upd(w[sel]) }));
  }, [sel]);
  // "All windows" with a product picked: every window gets the same state (colour index, product); amounts are kept per kind
  const pickAll = (patch) => apply(patch);

  // ---- the 3D scene: load after first paint, keep it in step with the state ------------------------------------------------------------------
  useEffect(() => {
    let dead = false, ctrl = null, io = null, ro = null;
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
      ro = new ResizeObserver(() => { const r = stage.getBoundingClientRect(); ctrl.resize(Math.max(2, Math.round(r.width)), Math.max(2, Math.round(r.height)), window.devicePixelRatio || 1); });
      ro.observe(stage);
      let visible = true;
      const sync = () => ctrl.setActive(visible && !document.hidden);
      io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '80px' });
      io.observe(stage);
      document.addEventListener('visibilitychange', sync);
      ctrl.cleanupVisibility = () => document.removeEventListener('visibilitychange', sync);
      setStatus('ready');
    };
    // let the photo paint first
    const t = setTimeout(start, 30);
    return () => {
      dead = true; clearTimeout(t);
      ro?.disconnect(); io?.disconnect();
      ctrl?.cleanupVisibility?.(); ctrl?.dispose(); ctrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ctrl = ctrlRef.current; if (!ctrl || status !== 'ready') return;
    for (const id of ['left', 'middle', 'right', 'far']) {
      const s = shown[id], p = PRODUCT_BY_ID[s.p];
      ctrl.setSlot(id, { product: s.p, fabricKey: p.fabrics?.[s.c], amount: s.a });
    }
  }, [shown, status]);

  // the view follows the layout (phone / desktop) and the zoom button
  const goal = useMemo(() => (phone && zoom && sel !== 'all' ? zoomOn(sel) : base), [phone, zoom, sel, base]);
  useEffect(() => {
    const ctrl = ctrlRef.current;
    if (ctrl && status === 'ready') ctrl.setView(goal, true); else setView(goal);
  }, [goal, status]);
  useEffect(() => { if (sel === 'all') setZoom(false); }, [sel]);

  // ---- dragging --------------------------------------------------------------------------------------------------------------------------
  const kindOf = (id) => PRODUCT_BY_ID[(id === 'far' ? allState : wins[id]).p];
  const setAmountFor = (ids, a) => {
    const ctrl = ctrlRef.current;
    ids.forEach((id) => ctrl?.snapAmount(id, a));
    if (sel === 'all') { setAllState((s) => ({ ...s, a })); setWins((w) => ({ left: { ...w.left, a }, middle: { ...w.middle, a }, right: { ...w.right, a } })); }
    else setWins((w) => ({ ...w, [ids[0]]: { ...w[ids[0]], a } }));
  };
  const onDown = (e, id) => {
    const p = kindOf(id);
    const isSel = sel === id || sel === 'all';
    const rect = e.currentTarget.getBoundingClientRect();
    const model = ctrlRef.current?.slot(id)?.model;
    dragRef.current = { id, x0: e.clientX, y0: e.clientY, moved: false, rect, p, model, allowed: !!p.kind && (e.pointerType === 'mouse' || isSel), grab: 0, started: false };
    if (!dragRef.current.allowed) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const posFor = (d, e) => {
    const r = d.rect;
    if (d.p.control === 'lower') {
      const f = (e.clientY - r.top) / r.height;
      return f;
    }
    const wTrack = d.model?.width || 1.2;
    return ((e.clientX - r.left) / r.width) * wTrack - wTrack / 2;           // metres from the track centre
  };
  const onMove = (e) => {
    const d = dragRef.current; if (!d || !d.allowed) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    if (!d.moved) {
      d.moved = true;
      if (sel !== d.id && sel !== 'all') setSel(d.id);
      // remember where on the handle the finger grabbed it
      const m = d.model, a = m ? m.amount : 0.5, start = { clientX: d.x0, clientY: d.y0 };
      const pos = posFor(d, start);
      d.grab = d.p.control === 'lower' ? pos - (m ? m.handle : 0.5) : pos - (m ? m.leadX(a) : 0);
    }
    const pos = posFor(d, e);
    let a;
    if (d.p.control === 'lower') {
      const h = d.model?.height || OPENING_H;
      const f = pos - d.grab;
      a = (f * h - 0.064 - 0.015) / (h - 0.064 - 0.03);
    } else a = d.model.amountFromLead(pos - d.grab);
    a = Math.min(1, Math.max(0, a));
    setAmountFor(sel === 'all' ? ['left', 'middle', 'right', 'far'] : [d.id], a);
  };
  const onUp = (e, id) => {
    const d = dragRef.current; dragRef.current = null;
    if (!d) return;
    if (!d.moved) setSel(id);                                              // a tap selects the window
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const nudge = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(id); return; }
    const p = kindOf(id); if (!p.kind) return;
    const step = e.shiftKey ? 0.1 : 0.04;
    const dir = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const a = Math.min(1, Math.max(0, (wins[id].a) + dir * step));
    if (sel !== id && sel !== 'all') setSel(id);
    setAmountFor(sel === 'all' ? ['left', 'middle', 'right', 'far'] : [id], a);
  };

  // ---- layout helpers: photo pixels -> percentages of the stage ------------------------------------------------------------------------------
  const layer = { left: pct(-view.x / view.w), top: pct(-view.y / view.h), width: pct(PHOTO.w / view.w), height: pct(PHOTO.h / view.h) };
  const box = ([x0, y0, x1, y1]) => ({ left: pct((x0 - view.x) / view.w), top: pct((y0 - view.y) / view.h), width: pct((x1 - x0) / view.w), height: pct((y1 - y0) / view.h) });
  const at = (u, v) => ({ left: pct((u - view.x) / view.w), top: pct((v - view.y) / view.h) });
  const srcSet = (fn) => PHOTO.widths.map((w) => `${fn(w)} ${w}w`).join(', ');
  const sizes = `(min-width: 1240px) ${Math.round((PHOTO.w / WIDE.w) * 1180)}px, ${((PHOTO.w / base.w) * 100).toFixed(0)}vw`;

  // where each window's drag area is: the opening, or for curtains the whole track
  const hitRect = (id) => {
    const r = WINDOWS[id].rect, p = PRODUCT_BY_ID[wins[id].p];
    if (p.kind === 'curtains') { const pad = 0.23 * CAM.scale; return [r[0] - pad, r[1] - 20, r[2] + pad, ROOM_FLOOR_PX]; }
    return r;
  };
  // the highlight sits on the window opening, inside the (possibly wider) drag area
  const ringBox = (id) => {
    const [h0, h1, h2, h3] = hitRect(id), [r0, r1, r2, r3] = WINDOWS[id].rect;
    return { left: pct((r0 - h0) / (h2 - h0)), top: pct((r1 - h1) / (h3 - h1)), width: pct((r2 - r0) / (h2 - h0)), height: pct((r3 - r1) / (h3 - h1)), right: 'auto', bottom: 'auto' };
  };
  const handleFor = (id) => {
    const p = PRODUCT_BY_ID[wins[id].p]; const slot = ctrlRef.current?.slot(id);
    if (!p.kind || !slot?.model || slot.product !== wins[id].p) return null;      // the scene has not caught up with the choice yet
    const a = amounts[id] ?? wins[id].a, r = WINDOWS[id].rect;
    if (p.control === 'lower') {
      const h = (r[3] - r[1]) / CAM.scale, f = (0.064 + a * (h - 0.094) + 0.015) / h;
      return { u: (r[0] + r[2]) / 2, v: r[1] + f * (r[3] - r[1]), dir: 'v' };
    }
    const m = slot.model, x = (m.group.position.x) + m.leadX(a);
    const [u, v] = project(x, ROOM.floorY + 1.0, 0.1);
    return { u, v, dir: 'h' };
  };

  const handleIds = sel === 'all' ? WINDOW_IDS : sel === 'left' || sel === 'middle' || sel === 'right' ? [sel] : [];
  const sliderOwner = sel === 'all' ? 'all' : sel;
  const sliderValue = Math.round((amounts[sel === 'all' ? 'middle' : sel] ?? cur.a) * 100);
  const control = product.control;
  const sliderLabel = !product.kind ? 'Position' : control === 'close' ? 'Curtains' : 'Shade';
  const sliderText = !product.kind ? '' : control === 'close' ? `${100 - sliderValue}% open` : `${sliderValue}% lowered`;
  const buildTo = product.slug ? `/products/${product.slug}` : '/products';
  const selName = sel === 'all' ? 'All windows' : `${WINDOWS[sel].label} window`;

  return (
    <div className="rl s2 s2-inner">
      <header className="rl-head">
        <p className="rl-eyebrow">{COPY.eyebrow}</p>
        <h1 className="rl-h1">{COPY.headline}</h1>
        <p className="rl-lead">{COPY.lead}</p>
      </header>

      <div className="rl-stage-wrap">
        <div className="rl-stage" ref={stageRef} style={{ aspectRatio: `${base.w} / ${base.h}`, backgroundImage: `url(${ROOM_TINY})` }} data-status={status}>
          <img className="rl-layer rl-room" style={layer} src={PHOTO.src(1200)} srcSet={srcSet(PHOTO.src)} sizes={sizes} width={PHOTO.w} height={PHOTO.h}
            alt="A bright living room with a cream sofa, a wooden coffee table, a brass floor lamp, a tall plant and three tall windows." fetchPriority="high" decoding="async" draggable="false" />
          <canvas className="rl-layer rl-canvas" ref={canvasRef} aria-hidden="true" />
          <img className="rl-layer rl-cutout" style={{ ...layer, filter: bright < 0.999 ? `brightness(${bright.toFixed(3)})` : undefined }} src={PHOTO.cutout(1200)}
            srcSet={srcSet(PHOTO.cutout)} sizes={sizes} width={PHOTO.w} height={PHOTO.h} alt="" aria-hidden="true" decoding="async" draggable="false" />

          {status !== 'nowebgl' && WINDOW_IDS.map((id) => {
            const on = sel === id || sel === 'all';
            const p = PRODUCT_BY_ID[wins[id].p];
            return (
              <div key={id} className={`rl-hit${on ? ' on' : ''}${sel === 'all' ? ' all' : ''}`} style={{ ...box(hitRect(id)), touchAction: on && p.kind ? (p.control === 'lower' ? 'pan-x' : 'pan-y') : 'manipulation' }}
                role="button" tabIndex={0} aria-pressed={sel === id} aria-label={`${WINDOWS[id].label} window, ${p.label}. Press Enter to select it, arrow keys to move it.`}
                onPointerDown={(e) => onDown(e, id)} onPointerMove={onMove} onPointerUp={(e) => onUp(e, id)} onPointerCancel={() => { dragRef.current = null; }} onKeyDown={(e) => nudge(e, id)}>
                <span className="rl-ring" style={{ ...ringBox(id), ...(on ? {} : { display: 'none' }) }} />
              </div>
            );
          })}
          {status === 'ready' && handleIds.map((id) => {
            const h = handleFor(id); if (!h) return null;
            return <span key={id} className={`rl-handle ${h.dir}`} style={at(h.u, h.v)} aria-hidden="true"><i /></span>;
          })}
          {status === 'loading' && <span className="rl-loading" role="status">Loading the 3D preview…</span>}
          {status === 'nowebgl' && <span className="rl-loading" role="status">Your browser could not start the 3D preview. The room is shown without it.</span>}
        </div>

        <div className="rl-bar">
          <div className="rl-chips" role="radiogroup" aria-label="Choose a window">
            {CHIPS.map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={sel === id} className={`rl-chip${sel === id ? ' on' : ''}`} onClick={() => setSel(id)}>{label}</button>
            ))}
          </div>
          {phone && (
            <button type="button" className="rl-zoom" disabled={sel === 'all'} aria-pressed={zoom} onClick={() => setZoom((z) => !z)}>
              {zoom ? 'Show all windows' : sel === 'all' ? 'Pick a window to zoom' : 'Zoom to window'}
            </button>
          )}
        </div>
      </div>

      <section className="rl-panel" aria-label={`Style and color for ${selName}`}>
        <div className="rl-block">
          <h2 className="rl-h2">Style <span className="rl-for">{selName}</span></h2>
          <div className="rl-products" role="radiogroup" aria-label="Choose a product">
            {PRODUCTS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={cur.p === p.id} className={`rl-prod${cur.p === p.id ? ' on' : ''}`} onClick={() => pickAll({ p: p.id })}>
                <span className="rl-thumb">{p.photo ? <img src={`/images/site/${p.photo}-480.webp`} alt="" width="96" height="64" loading="lazy" decoding="async" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M12 3v18M5 12h14" stroke="currentColor" strokeWidth="1.2" /></svg>}</span>
                <span className="rl-prod-name">{p.short}</span>
                {p.family && p.family !== p.short && <span className="rl-prod-fam">{p.family}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="rl-block">
          <h2 className="rl-h2">Color {product.kind && fabricKey && <span className="rl-for">{fabricOf(fabricKey).name}</span>}</h2>
          {product.kind ? (
            <div className="rl-swatches" role="radiogroup" aria-label="Choose a color">
              {product.fabrics.map((k, i) => {
                const f = fabricOf(k);
                return (
                  <button key={k} type="button" role="radio" aria-checked={cur.c === i} aria-label={f.name} title={f.name} className={`rl-sw${cur.c === i ? ' on' : ''}`} onClick={() => pickAll({ c: i })}
                    style={{ backgroundColor: f.color, backgroundImage: f.kind === 'zebra' ? undefined : `url(${f.url})` }}>
                    {f.kind === 'zebra' && <span style={{ backgroundImage: `url(${f.url})` }} />}
                  </button>
                );
              })}
            </div>
          ) : <p className="rl-muted">Choose a style to see colors.</p>}
        </div>

        <div className="rl-block rl-move">
          <label className="rl-h2" htmlFor="rl-slider">{control === 'close' ? 'Open and close' : 'Raise and lower'} <span className="rl-for">{sliderText}</span></label>
          <input id="rl-slider" className="rl-slider" type="range" min="0" max="100" step="1" disabled={!product.kind}
            value={sliderValue} onChange={(e) => { const a = Number(e.target.value) / 100; const ids = sel === 'all' ? ['left', 'middle', 'right', 'far'] : [sel]; setAmountFor(ids, a); }}
            aria-label={`${sliderLabel} position, ${selName}`} aria-valuetext={sliderText} />
          <p className="rl-hint">{!product.kind ? 'Pick a style first.' : control === 'close' ? 'Drag the curtains sideways, or use the slider.' : 'Drag the shade up or down, or use the slider.'}</p>
        </div>

        <div className="rl-cta">
          <a className="rl-build" href={buildTo} onClick={(e) => { if (navigate && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate(buildTo); } }}>
            Build yours{product.kind ? `: ${product.label.toLowerCase().replace(/^./, (c) => c.toUpperCase())}` : ''}
          </a>
          <p className="rl-fine">Opens the {product.family ? product.family.toLowerCase() : 'products'} page, where you pick your size and see your price.</p>
        </div>
      </section>
    </div>
  );
}

const ROOM_FLOOR_PX = 1010;
