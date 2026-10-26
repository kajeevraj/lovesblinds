// "See it in a room": the same blind in all three windows of the room photo (and the side window). Dragging any window moves them together.
// A small, controlled version of the room lab: the product page owns what the blind is; this only shows it and lets the customer raise and lower it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { WINDOWS, WINDOW_IDS, CAM } from './data.js';
import RoomStage from './RoomStage.jsx';
import { amountFromHandle, handleFraction } from './models/shade.js';

const WIDE = { x: 110, y: 20, w: 1890, h: 1136 };
const PHONE = { x: 300, y: 0, w: 1300, h: 1333 };
const SOFA_TOP = 690;
const OPENING_H = (WINDOWS.left.rect[3] - WINDOWS.left.rect[1]) / CAM.scale;

// blind = { product (a PRODUCTS id), fabric (a fabric spec) }, amount 0..1, phone: use the phone crop
export default function RoomEmbed({ blind, amount, onAmount, phone }) {
  const base = phone ? PHONE : WIDE;
  const [ctrl, setCtrl] = useState(null);
  const [st, setSt] = useState({ status: 'loading', view: base, amounts: {} });
  const drag = useRef(null);
  useEffect(() => {
    if (!ctrl) return;
    for (const id of ['left', 'middle', 'right', 'far']) ctrl.setSlot(id, { product: blind.product, fabric: blind.fabric, amount });
    ctrl.setCurtains({ on: false });
  }, [ctrl, blind.product, blind.fabric?.key, amount]);         // eslint-disable-line react-hooks/exhaustive-deps
  const { view, status } = st;
  const at = (u, v) => ({ left: `${(((u - view.x) / view.w) * 100).toFixed(3)}%`, top: `${(((v - view.y) / view.h) * 100).toFixed(3)}%` });
  const box = ([x0, y0, x1, y1]) => ({ left: `${(((x0 - view.x) / view.w) * 100).toFixed(3)}%`, top: `${(((y0 - view.y) / view.h) * 100).toFixed(3)}%`, width: `${(((x1 - x0) / view.w) * 100).toFixed(3)}%`, height: `${(((y1 - y0) / view.h) * 100).toFixed(3)}%` });
  const set = (a) => { for (const id of ['left', 'middle', 'right', 'far']) ctrl?.snapAmount(id, a); onAmount(a); };
  const down = (e) => { const r = e.currentTarget.getBoundingClientRect(); drag.current = { rect: r, y0: e.clientY, moved: false, grab: 0 }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    if (!d.moved) { if (Math.abs(e.clientY - d.y0) < 5) return; d.moved = true; d.grab = (d.y0 - d.rect.top) / d.rect.height - handleFraction(amount, OPENING_H); }
    set(amountFromHandle((e.clientY - d.rect.top) / d.rect.height - d.grab, OPENING_H));
  };
  const up = (e) => { drag.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId); };
  const handles = WINDOW_IDS.map((id) => {
    const r = WINDOWS[id].rect, f = handleFraction(st.amounts[id] ?? amount, OPENING_H);
    return { id, u: (r[0] + r[2]) / 2, v: Math.min(SOFA_TOP, r[1] + f * (r[3] - r[1])) };
  });
  return (
    <RoomStage base={base} goal={base} onCtrl={setCtrl} onState={setSt} alt="The same blind in all three windows of a living room">
      {status !== 'nowebgl' && WINDOW_IDS.map((id) => (
        <div key={id} className="rl-hit on" style={{ ...box(WINDOWS[id].rect), touchAction: 'pan-x' }} aria-hidden="true" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }} />
      ))}
      {status === 'ready' && handles.map((h) => <span key={h.id} className="rl-handle v" style={at(h.u, h.v)} aria-hidden="true"><i /></span>)}
    </RoomStage>
  );
}
