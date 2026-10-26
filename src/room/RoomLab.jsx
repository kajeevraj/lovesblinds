// /room-lab: a photo of a room with 3D window treatments drawn into its windows. A test page (noindex, not linked from anywhere).
//
// Layers in the stage, bottom to top: the room photo, the three.js canvas (transparent), the furniture cutout (so shades and curtains pass
// behind the sofa), then the invisible drag areas, the product pills and the drag handles. All of them are placed from the same `view`
// (which part of the 2000 x 1333 photo is on screen), so they cannot drift apart. The 3D scene is loaded after the photo is shown.
// Nothing is drawn over the furniture: pills sit on the wall above the windows and handles are kept above the sofa's top edge.
//
// State: three windows, each { p: product, fab: fabric, a: how far down }; the side-wall window copies the last "All windows" choice;
// and one curtain layer { on, fab, a } across all the windows.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WINDOWS, WINDOW_IDS, PRODUCTS, PRODUCT_BY_ID, CURTAIN_LAYER, CATALOG, COPY, CAM, ROOM, project } from './data.js';
import { presetSpec, specFromEntry } from './fabricSpec.js';
import SwatchPanel from './SwatchPanel.jsx';
import { entriesFor, fabricsFor } from '../data/swatchData.js';
import { loadLineCatalog, isLineLoaded } from '../data/catalogApi.js';
import RoomStage from './RoomStage.jsx';
import './room.css';

const WIDE = { x: 110, y: 20, w: 1890, h: 1136 };           // desktop: the windows, sofa, lamp, plant and the side window
const PHONE = { x: 300, y: 0, w: 1300, h: 1333 };           // phone: the row of windows, taller so the page is not a thin strip
const zoomOn = (id) => { const [x0, , x1] = WINDOWS[id].rect; const c = (x0 + x1) / 2; return { x: c - 380, y: 50, w: 760, h: 779 }; };
const PILL_Y = 112;                                          // photo pixel row of the product pills: on the wall between ceiling and window casing
const SOFA_TOP = 690;                                        // handles never go below this row, so nothing sits over the sofa
const DEFAULT_A = 0.62, ZEBRA_A = 0.93, CURTAIN_A = 0.6;
const CURTAIN_PAD = 0.23 * CAM.scale;
const TRACK = (() => { const l = WINDOWS.left.rect, r = WINDOWS.right.rect; return [l[0] - CURTAIN_PAD, 74, r[2] + CURTAIN_PAD, 1010]; })();
const OPENING_H = (WINDOWS.left.rect[3] - WINDOWS.left.rect[1]) / CAM.scale;
const PRESETS = Object.fromEntries([...PRODUCTS, CURTAIN_LAYER].filter((p) => p.fabrics).map((p) => [p.id, p.fabrics.map(presetSpec)]));
const mk = (p, a = DEFAULT_A) => ({ p, fab: PRESETS[p]?.[0] || null, a });
const START = mk('roller-solar');

const useMedia = (q) => {
  const [m, setM] = useState(() => (typeof matchMedia === 'function' ? matchMedia(q).matches : false));
  useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
};
// one color line's catalog: loaded when asked for ('idle' until then)
function useLine(line) {
  const [status, setStatus] = useState(line ? (isLineLoaded(line) ? 'ready' : 'loading') : 'idle');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!line) return undefined;
    if (isLineLoaded(line)) { setStatus('ready'); return undefined; }
    let live = true; setStatus('loading');
    loadLineCatalog(line, { retry: attempt > 0 }).then(() => live && setStatus('ready')).catch(() => live && setStatus('error'));
    return () => { live = false; };
  }, [line, attempt]);
  return [status, () => setAttempt((n) => n + 1)];
}
const pct = (v) => `${(v * 100).toFixed(4)}%`;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export default function RoomLab({ navigate }) {
  const phone = useMedia('(max-width: 720px)');
  const base = phone ? PHONE : WIDE;
  const [sel, setSel] = useState('middle');
  const [wins, setWins] = useState({ left: START, middle: START, right: START });
  const [far, setFar] = useState(START);                              // the side-wall window: the last "All windows" choice
  const [all, setAll] = useState(true);                               // All windows on: a choice applies to every window
  const [curt, setCurt] = useState({ on: false, fab: PRESETS.curtains[0], a: CURTAIN_A });
  const [panel, setPanel] = useState(null);                           // null | 'shade' | 'curtains'
  const [zoom, setZoom] = useState(false);
  const [ctrl, setCtrl] = useState(null);
  const [st, setSt] = useState({ status: 'loading', view: base, bright: 1, amounts: {} });
  const { status, view, bright, amounts } = st;
  const stageRef = useRef(null), dragRef = useRef(null), swipeRef = useRef(null);
  const ctrlRef = useRef(null); ctrlRef.current = ctrl;

  const cur = wins[sel];
  const product = PRODUCT_BY_ID[cur.p];
  const ids = (id) => (all ? WINDOW_IDS : [id]);

  // ---- choices -------------------------------------------------------------------------------------------------------------------------
  const setWindows = useCallback((id, fn) => {
    setWins((w) => { const n = { ...w }; for (const k of ids(id)) n[k] = fn(w[k]); return n; });
    if (all) setFar((f) => fn(f));
  }, [all]);                                                          // eslint-disable-line react-hooks/exhaustive-deps
  const withProduct = (p) => (s) => (s.p === p ? s : { p, fab: PRESETS[p]?.[0] || null, a: p === 'zebra' ? ZEBRA_A : s.p === 'none' ? DEFAULT_A : s.a });
  const pickProduct = (id, p) => setWindows(id, withProduct(p));
  const cycle = (id, dir) => {
    const list = PRODUCTS.map((x) => x.id), i = list.indexOf(wins[id].p);
    setSel(id); pickProduct(id, list[(i + dir + list.length) % list.length]);
  };
  const toggleAll = () => {
    if (!all) {                                                       // switching on: every window takes the selected window's product and color
      const c = wins[sel];
      setWins((w) => ({ left: { ...w.left, p: c.p, fab: c.fab }, middle: { ...w.middle, p: c.p, fab: c.fab }, right: { ...w.right, p: c.p, fab: c.fab } }));
      setFar((f) => ({ ...f, p: c.p, fab: c.fab }));
    }
    setAll((v) => !v);
  };
  const pickFab = (spec) => setWindows(sel, (s) => ({ ...s, fab: spec }));

  // ---- catalog colors ------------------------------------------------------------------------------------------------------------------
  const shadeCat = CATALOG[cur.p];
  const [shadeStatus, retryShade] = useLine(product.kind ? shadeCat?.line : null);
  const [curtStatus, retryCurt] = useLine(curt.on || panel === 'curtains' ? CATALOG.curtains.line : null);
  const shadeEntries = useMemo(() => (shadeStatus === 'ready' && shadeCat ? entriesFor(fabricsFor(shadeCat.line, shadeCat.family || null)) : []), [shadeStatus, shadeCat]);
  const curtEntries = useMemo(() => (curtStatus === 'ready' ? entriesFor(fabricsFor(CATALOG.curtains.line)) : []), [curtStatus]);
  const codeId = (entries, fab) => entries.find((e) => e.swatch.code === fab?.code)?.swatch.id ?? null;

  // ---- keep the 3D scene in step with the state ----------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!ctrl) return;
    const shown = { ...wins, far };
    for (const id of ['left', 'middle', 'right', 'far']) ctrl.setSlot(id, { product: shown[id].p, fabric: shown[id].fab, amount: shown[id].a });
    ctrl.setCurtains({ on: curt.on, fabric: curt.fab, amount: curt.a });
  }, [wins, far, curt, ctrl]);
  const goal = useMemo(() => (phone && zoom ? zoomOn(sel) : base), [phone, zoom, sel, base]);

  // ---- dragging: a vertical drag moves the shade, a sideways drag moves the curtains (always all together) -----------------------------------
  const setShadeAmount = (id, a) => {
    const ctrl = ctrlRef.current;
    for (const k of all ? [...WINDOW_IDS, 'far'] : [id]) ctrl?.snapAmount(k, a);
    setWindows(id, (s) => ({ ...s, a }));
  };
  const setCurtainAmount = (a) => { ctrlRef.current?.snapCurtains(a); setCurt((c) => ({ ...c, a })); };
  const curtainLocalX = (clientX) => {
    const r = stageRef.current.getBoundingClientRect(), v = ctrlRef.current?.view || view;
    const px = v.x + ((clientX - r.left) / r.width) * v.w;
    const m = ctrlRef.current?.curtainModel();
    return ((px - CAM.cx) * (CAM.dist - 0.1)) / CAM.focal - (m ? m.group.position.x : 0);
  };
  const onDown = (e, id) => {
    const p = PRODUCT_BY_ID[wins[id === 'curtain' ? sel : id].p];
    const touch = e.pointerType !== 'mouse';
    const selected = id === 'curtain' ? true : sel === id;
    dragRef.current = { id, x0: e.clientX, y0: e.clientY, moved: false, axis: null, rect: e.currentTarget.getBoundingClientRect(), p,
      allowed: !touch || selected, grab: 0, model: ctrlRef.current?.slot(id)?.model };
    if (dragRef.current.allowed) e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = dragRef.current; if (!d || !d.allowed) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      d.moved = true;
      d.axis = d.id === 'curtain' ? 'x' : curt.on && Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (d.axis === 'x' && !curt.on) { dragRef.current = null; return; }
      if (d.axis === 'y' && (!d.p.kind || d.id === 'curtain')) { dragRef.current = null; return; }
      if (d.id !== 'curtain' && sel !== d.id) setSel(d.id);
      if (d.axis === 'y') d.grab = (d.y0 - d.rect.top) / d.rect.height - (d.model ? d.model.handle : 0.5);
      else { const m = ctrlRef.current?.curtainModel(); d.grab = (m ? m.leadX(m.amount) : 0) - curtainLocalX(d.x0); }
    }
    if (d.axis === 'y') {
      const h = d.model?.height || OPENING_H, f = (e.clientY - d.rect.top) / d.rect.height - d.grab;
      setShadeAmount(d.id, clamp01((f * h - 0.064 - 0.015) / (h - 0.064 - 0.03)));
    } else {
      const m = ctrlRef.current?.curtainModel(); if (m) setCurtainAmount(m.amountFromLead(curtainLocalX(e.clientX) + d.grab));
    }
  };
  const onUp = (e, id) => {
    const d = dragRef.current; dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (d && !d.moved && id !== 'curtain') setSel(id);                // a tap selects the window
  };
  // ---- pills: tap a name to select, ‹ › or a swipe (phones) to change product ---------------------------------------------------------------------
  const pillDown = (e) => { swipeRef.current = { x: e.clientX, done: false }; };
  const pillMove = (e, id) => {
    const s = swipeRef.current; if (!s || s.done) return;
    if (Math.abs(e.clientX - s.x) > 36) { s.done = true; cycle(id, e.clientX < s.x ? 1 : -1); }
  };
  const pillKey = (e, id) => { if (e.key === 'ArrowRight') { e.preventDefault(); cycle(id, 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); cycle(id, -1); } };

  // ---- layout helpers: photo pixels -> percentages of the stage ------------------------------------------------------------------------------
  const box = ([x0, y0, x1, y1]) => ({ left: pct((x0 - view.x) / view.w), top: pct((y0 - view.y) / view.h), width: pct((x1 - x0) / view.w), height: pct((y1 - y0) / view.h) });
  const at = (u, v) => ({ left: pct((u - view.x) / view.w), top: pct((v - view.y) / view.h) });

  const shadeHandle = (id) => {
    const p = PRODUCT_BY_ID[wins[id].p], slot = ctrlRef.current?.slot(id);
    if (!p.kind || !slot?.model || slot.product !== wins[id].p) return null;
    const a = amounts[id] ?? wins[id].a, r = WINDOWS[id].rect, h = (r[3] - r[1]) / CAM.scale;
    const f = (0.064 + a * (h - 0.094) + 0.015) / h;
    return { u: (r[0] + r[2]) / 2, v: Math.min(SOFA_TOP, r[1] + f * (r[3] - r[1])), dir: 'v' };
  };
  const curtainHandle = () => {
    const m = ctrlRef.current?.curtainModel(); if (!curt.on || !m) return null;
    const [u, v] = project(m.group.position.x + m.leadX(amounts.curtains ?? curt.a), ROOM.floorY + 1.0, 0.1);
    return { u, v: Math.min(SOFA_TOP, v), dir: 'h' };
  };
  // a shade's handle is hidden while the curtains cover more than half of its window, and comes back when they open
  const curtainCovers = (id) => {
    const m = ctrlRef.current?.curtainModel(); if (!curt.on || !m) return false;
    const e = m.leadX(amounts.curtains ?? curt.a) + m.width / 2, half = m.width / 2;      // how far each panel reaches in from its end
    const local = (px) => ((px - CAM.cx) * (CAM.dist - 0.1)) / CAM.focal - m.group.position.x;
    const l = local(WINDOWS[id].rect[0]), r = local(WINDOWS[id].rect[2]);
    const over = Math.max(0, Math.min(r, -half + e) - Math.max(l, -half)) + Math.max(0, Math.min(r, half) - Math.max(l, half - e));
    return over / (r - l) > 0.5;
  };
  const handles = [...(all ? WINDOW_IDS : [sel]).filter((id) => !curtainCovers(id)).map(shadeHandle), curtainHandle()].filter(Boolean);

  // ---- toolbar numbers ---------------------------------------------------------------------------------------------------------------------------------
  const presets = PRESETS[cur.p] || [];
  const shadeChips = cur.fab && !presets.some((s) => s.key === cur.fab.key) ? [cur.fab, ...presets.slice(0, 4)] : presets;
  const curtPresets = PRESETS.curtains;
  const curtChips = !curtPresets.some((s) => s.key === curt.fab.key) ? [curt.fab, ...curtPresets.slice(0, 4)] : curtPresets;
  const more = (entries, n) => (entries.length ? Math.max(0, entries.length - n) : null);
  const winName = `${WINDOWS[sel].label} window`;
  const buildTo = product.slug ? `/products/${product.slug}` : '/products';
  const shadeSlider = Math.round((amounts[sel] ?? cur.a) * 100), curtSlider = Math.round((amounts.curtains ?? curt.a) * 100);

  const Chip = ({ spec, on, onClick }) => (
    <button type="button" role="radio" aria-checked={on} aria-label={spec.name} title={spec.name} className={`rl-sw${on ? ' on' : ''}`} onClick={onClick}
      style={{ backgroundColor: spec.color || '#cfc6b6', backgroundImage: spec.kind === 'zebra' ? undefined : `url(${spec.thumbUrl})` }}>
      {spec.kind === 'zebra' && <span style={{ backgroundImage: `url(${spec.thumbUrl})` }} />}
    </button>
  );

  return (
    <div className="rl s2 s2-inner">
      <header className="rl-head">
        <p className="rl-eyebrow">{COPY.eyebrow}</p>
        <h1 className="rl-h1">{COPY.headline}</h1>
        <p className="rl-lead">{COPY.lead}</p>
      </header>

      <div className="rl-stage-wrap">
        <div className="rl-toolbar" role="region" aria-label="Choices for the selected window">
          <div className="rl-tb-row">
            <div className="rl-tb-name"><span className="rl-tb-eyebrow">{all ? 'All windows' : winName}</span><strong>{product.label}</strong></div>
            {product.kind ? (
              <div className="rl-tb-colors" role="radiogroup" aria-label={`Colors for ${product.label}`}>
                {shadeChips.map((s) => <Chip key={s.key} spec={s} on={cur.fab?.key === s.key} onClick={() => pickFab(s)} />)}
                <button type="button" className="rl-more" onClick={() => setPanel('shade')}>{more(shadeEntries, shadeChips.length) != null ? `+ ${more(shadeEntries, shadeChips.length)} more` : '+ more'}</button>
              </div>
            ) : <p className="rl-muted rl-tb-none">A bare window. Use ‹ › on the window to try a style.</p>}
            <div className="rl-tb-toggles">
              <button type="button" role="switch" aria-checked={all} className={`rl-switch${all ? ' on' : ''}`} onClick={toggleAll}><i aria-hidden="true" />All windows</button>
              <button type="button" role="switch" aria-checked={curt.on} className={`rl-switch${curt.on ? ' on' : ''}`} onClick={() => setCurt((c) => ({ ...c, on: !c.on }))}><i aria-hidden="true" />Curtains</button>
            </div>
            <a className="rl-build" href={buildTo} onClick={(e) => { if (navigate && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate(buildTo); } }}>Build yours</a>
          </div>
          {curt.on && (
            <div className="rl-tb-row rl-tb-curt">
              <span className="rl-tb-eyebrow">Curtains</span>
              <div className="rl-tb-colors" role="radiogroup" aria-label="Curtain colors">
                {curtChips.map((s) => <Chip key={s.key} spec={s} on={curt.fab.key === s.key} onClick={() => setCurt((c) => ({ ...c, fab: s }))} />)}
                <button type="button" className="rl-more" onClick={() => setPanel('curtains')}>{more(curtEntries, curtChips.length) != null ? `+ ${more(curtEntries, curtChips.length)} more` : '+ more'}</button>
              </div>
            </div>
          )}
        </div>

        <RoomStage base={base} goal={goal} onCtrl={setCtrl} onState={setSt} stageRef={stageRef}>
          {status !== 'nowebgl' && curt.on && (
            <div className="rl-hit rl-hit-curtain" style={{ ...box(TRACK), touchAction: 'pan-y' }} aria-hidden="true"
              onPointerDown={(e) => onDown(e, 'curtain')} onPointerMove={onMove} onPointerUp={(e) => onUp(e, 'curtain')} onPointerCancel={() => { dragRef.current = null; }} />
          )}
          {status !== 'nowebgl' && WINDOW_IDS.map((id) => {
            const on = sel === id, p = PRODUCT_BY_ID[wins[id].p];
            return (
              <div key={id} className={`rl-hit${on ? ' on' : ''}`} style={{ ...box(WINDOWS[id].rect), touchAction: on ? (curt.on ? 'none' : p.kind ? 'pan-x' : 'manipulation') : 'manipulation' }} aria-hidden="true"
                onPointerDown={(e) => onDown(e, id)} onPointerMove={onMove} onPointerUp={(e) => onUp(e, id)} onPointerCancel={() => { dragRef.current = null; }} />
            );
          })}
          {status === 'ready' && handles.map((h, i) => <span key={i} className={`rl-handle ${h.dir}`} style={at(h.u, h.v)} aria-hidden="true"><i /></span>)}
          {status !== 'nowebgl' && WINDOW_IDS.map((id) => {
            const r = WINDOWS[id].rect, p = PRODUCT_BY_ID[wins[id].p], on = sel === id;
            return (
              <div key={id} className={`rl-pill${on ? ' on' : ''}${phone && !on ? ' hidden' : ''}`} style={{ ...at((r[0] + r[2]) / 2, PILL_Y), left: `clamp(98px, ${at((r[0] + r[2]) / 2, PILL_Y).left}, calc(100% - 98px))` }} role="group" aria-label={`${WINDOWS[id].label} window`} onKeyDown={(e) => pillKey(e, id)}>
                <button type="button" className="rl-pill-arrow" aria-label={`Previous style for the ${WINDOWS[id].label.toLowerCase()} window`} onClick={() => cycle(id, -1)}>‹</button>
                <button type="button" className="rl-pill-name" aria-pressed={on} onClick={() => setSel(id)} onPointerDown={pillDown} onPointerMove={(e) => pillMove(e, id)}
                  aria-label={`${WINDOWS[id].label} window: ${p.label}. ${on ? 'Selected.' : 'Select it.'}`}>{p.short}</button>
                <button type="button" className="rl-pill-arrow" aria-label={`Next style for the ${WINDOWS[id].label.toLowerCase()} window`} onClick={() => cycle(id, 1)}>›</button>
              </div>
            );
          })}
        </RoomStage>

        <div className="rl-sliders">
          <div className="rl-slide">
            <label htmlFor="rl-shade">{all ? 'All windows' : winName}: raise and lower <span>{product.kind ? `${shadeSlider}% lowered` : ''}</span></label>
            <input id="rl-shade" className="rl-slider" type="range" min="0" max="100" step="1" disabled={!product.kind} value={shadeSlider}
              onChange={(e) => setShadeAmount(sel, Number(e.target.value) / 100)} aria-valuetext={`${shadeSlider}% lowered`} />
          </div>
          {curt.on && (
            <div className="rl-slide">
              <label htmlFor="rl-curt">Curtains: open and close <span>{100 - curtSlider}% open</span></label>
              <input id="rl-curt" className="rl-slider" type="range" min="0" max="100" step="1" value={curtSlider}
                onChange={(e) => setCurtainAmount(Number(e.target.value) / 100)} aria-valuetext={`${100 - curtSlider}% open`} />
            </div>
          )}
          {phone && <button type="button" className="rl-zoom" aria-pressed={zoom} onClick={() => setZoom((z) => !z)}>{zoom ? 'Show all windows' : 'Zoom to window'}</button>}
        </div>
      </div>

      <SwatchPanel sheet={phone} open={panel === 'shade'} title={`${product.label} colors`} hint="Pick a color to try it in the room." status={shadeStatus} entries={shadeEntries}
        activeId={codeId(shadeEntries, cur.fab)} onRetry={retryShade} onChoose={(e) => pickFab(specFromEntry(e, product.kind))} onClose={() => setPanel(null)} />
      <SwatchPanel sheet={phone} open={panel === 'curtains'} title="Curtain colors" hint="One color for all the curtains." status={curtStatus} entries={curtEntries}
        activeId={codeId(curtEntries, curt.fab)} onRetry={retryCurt} onChoose={(e) => setCurt((c) => ({ ...c, fab: specFromEntry(e, 'curtains') }))} onClose={() => setPanel(null)} />
    </div>
  );
}
