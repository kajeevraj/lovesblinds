// A self-playing version of the room for the homepage hero (test page: /room-lab/hero). No controls: the three windows slowly cycle through
// different products and colors, each change a short raise-and-lower, with the headline and "Start shopping" above the room.
// The sharp photo is shown at once; the 3D loads after it and the first scene lowers in. It stands still for reduced motion, and stops
// while it is off-screen or the tab is hidden (the scene itself also stops drawing then, see RoomStage).
import { useEffect, useMemo, useRef, useState } from 'react';
import { PRODUCT_BY_ID, CURTAIN_LAYER, COPY } from './data.js';
import { presetSpec } from './fabricSpec.js';
import RoomStage, { prefersReducedMotion } from './RoomStage.jsx';

const WIDE = { x: 110, y: 20, w: 1890, h: 1136 };
const PHONE = { x: 300, y: 0, w: 1300, h: 1333 };
const SEC = 5600;                                   // how long each scene stays
const STAGGER = 380, SWAP = 760;                    // between windows, and how long the old blind takes to rise before the new one is put in

// each window: [product, color index, how far down]; curtains: [color index, how closed] or null
const SCENES = [
  { w: [['roller-solar', 0, 0.66], ['roller-solar', 0, 0.66], ['roller-solar', 0, 0.66]], c: null },
  { w: [['zebra', 2, 0.93], ['zebra', 1, 0.9], ['zebra', 0, 0.94]], c: null },
  { w: [['roller-screen', 3, 0.7], ['roller-screen', 3, 0.7], ['roller-screen', 3, 0.7]], c: [1, 0.35] },
  { w: [['roller-blackout', 2, 0.8], ['roller-blackout', 2, 0.8], ['roller-blackout', 2, 0.8]], c: null },
  { w: [['roller-solar', 1, 0.6], ['zebra', 4, 0.9], ['roller-screen', 1, 0.7]], c: null },
  { w: [['roller-solar', 3, 0.55], ['roller-solar', 3, 0.55], ['roller-solar', 3, 0.55]], c: [0, 0.78] },
  { w: [['zebra', 1, 0.92], ['zebra', 1, 0.92], ['zebra', 1, 0.92]], c: [3, 0.3] },
];
const fab = (p, i) => presetSpec(PRODUCT_BY_ID[p].fabrics[i]);
const curtFab = (i) => presetSpec(CURTAIN_LAYER.fabrics[i]);
const IDS = ['left', 'middle', 'right'];

export default function HeroRoom({ navigate }) {
  const [phone, setPhone] = useState(() => matchMedia('(max-width: 720px)').matches);
  useEffect(() => { const mq = matchMedia('(max-width: 720px)'); const f = () => setPhone(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const base = phone ? PHONE : WIDE;
  const [ctrl, setCtrl] = useState(null);
  const stageRef = useRef(null), scene = useRef(-1), timers = useRef([]), flags = useRef({ visible: true, hidden: false });

  const apply = (ctl, i, instant) => {
    const sc = SCENES[i];
    IDS.forEach((id, k) => {
      const [p, c, a] = sc.w[k];
      const go = () => ctl.setSlot(id, { product: p, fabric: fab(p, c), amount: a });
      if (instant) { go(); return; }
      timers.current.push(setTimeout(() => ctl.setSlot(id, { product: ctl.slot(id).product, fabric: ctl.slot(id).fabric, amount: 0 }), k * STAGGER));      // raise
      timers.current.push(setTimeout(go, k * STAGGER + SWAP));                                                                                           // swap and lower
    });
    const cs = sc.c;
    if (cs) ctl.setCurtains({ on: true, fabric: curtFab(cs[0]), amount: cs[1] }); else if (ctl.curtainModel()) ctl.setCurtains({ on: false });
  };

  useEffect(() => {
    if (!ctrl) return undefined;
    const still = prefersReducedMotion();
    const io = new IntersectionObserver(([e]) => { flags.current.visible = e.isIntersecting; }, { rootMargin: '0px' });
    io.observe(stageRef.current);
    const vis = () => { flags.current.hidden = document.hidden; };
    document.addEventListener('visibilitychange', vis);
    scene.current = 0; apply(ctrl, 0, true);
    // the first scene lowers in from raised, as the reveal
    if (!still) { IDS.forEach((id, k) => { ctrl.setSlot(id, { product: SCENES[0].w[k][0], fabric: fab(SCENES[0].w[k][0], SCENES[0].w[k][1]), amount: 0 }); timers.current.push(setTimeout(() => ctrl.setSlot(id, { product: SCENES[0].w[k][0], fabric: fab(SCENES[0].w[k][0], SCENES[0].w[k][1]), amount: SCENES[0].w[k][2] }), 500 + k * STAGGER)); }); }
    let tick = null;
    if (!still) tick = setInterval(() => {
      if (!flags.current.visible || flags.current.hidden) return;
      scene.current = (scene.current + 1) % SCENES.length; apply(ctrl, scene.current, false);
    }, SEC);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); clearInterval(tick); timers.current.forEach(clearTimeout); timers.current = []; };
  }, [ctrl]);                                                    // eslint-disable-line react-hooks/exhaustive-deps

  const goal = useMemo(() => base, [base]);
  return (
    <section className="rl rl-hero s2">
      <div className="rl-hero-copy">
        <p className="rl-eyebrow">{COPY.eyebrow}</p>
        <h1 className="rl-h1">{COPY.headline}</h1>
        <a className="rl-build" href="/products" onClick={(e) => { if (navigate) { e.preventDefault(); navigate('products'); } }}>Start shopping</a>
      </div>
      <div className="rl-hero-room" aria-label="A living room whose window shades and curtains change style and color">
        <RoomStage base={base} goal={goal} onCtrl={setCtrl} stageRef={stageRef} alt="A bright living room with three tall windows whose window treatments change every few seconds" />
      </div>
    </section>
  );
}
