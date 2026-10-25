// /hero-lab: the scrolling 3D hero, as a test page. Not linked from anywhere and not indexed; the live homepage is untouched.
//
// Three ways to see it, all with the same words and links:
//   scroll  - a pinned 3D scene (three.js) driven by scroll, eased so it never jumps (the default)
//   still   - a plain page of pictures, one per product (reduced motion turned on, no WebGL, or ?mode=still to preview it)
//   shot    - ?shot=<name> draws one frame of the scene on its own; scripts/render-hero-stills.mjs uses it to make the pictures
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './hero.css';
import { PRODUCTS, COPY } from './products.js';
import { stateAt, stopFor, totalScreens } from './timeline.js';
import SitePhoto from '../components/SitePhoto.jsx';
import { Footer } from '../customer.jsx';

const N = PRODUCTS.length;
const TOTAL = totalScreens(N);
const SHOTS = ['intro', ...PRODUCTS.map((p) => p.id), 'wall'];
const shotU = (name) => (name === 'intro' ? 0 : name === 'wall' ? TOTAL : stopFor(N, PRODUCTS.findIndex((p) => p.id === name)));

const href = (p) => `/products/${p.slug}`;
const go = (navigate, to) => (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  navigate(to);
};

function useMedia(query) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

function webglOk() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
}

// A still of the scene made by scripts/render-hero-stills.mjs: one for wide screens, one for phones.
function Still({ name, alt = '', eager = false, className = '' }) {
  return (
    <picture>
      <source media="(max-width: 759px)" srcSet={`/hero-lab/stills/${name}-tall.webp`} />
      <img className={className} src={`/hero-lab/stills/${name}-wide.webp`} width="1600" height="900" alt={alt}
        loading={eager ? 'eager' : 'lazy'} fetchpriority={eager ? 'high' : undefined} decoding={eager ? 'sync' : 'async'} />
    </picture>
  );
}

function ProductWords({ p, i, navigate, headingLevel = 2, innerRef, className = '' }) {
  const H = `h${headingLevel}`;
  return (
    <div className={`hl-copy hl-words ${className}`} ref={innerRef}>
      <p className="s2-eyebrow">{i + 1} of {N}</p>
      <H className="hl-name">{p.name}</H>
      <p className="hl-line">{p.line}</p>
      <a className="s2-btn s2-btn-brass hl-build" href={href(p)} onClick={go(navigate, href(p))}>
        {COPY.build}<span aria-hidden="true" className="hl-arrow">→</span><span className="hl-sr"> {p.name}</span>
      </a>
    </div>
  );
}

function Tiles({ navigate }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { el?.classList.add('in'); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section id="hl-products" className="s2-wrap hl-tiles" ref={ref} aria-labelledby="hl-tiles-title">
      <p className="s2-eyebrow">Our lineup</p>
      <h2 id="hl-tiles-title" className="s2-h2">{COPY.tilesTitle}</h2>
      <p className="s2-sec-text hl-tiles-lead">{COPY.tilesLead}</p>
      <div className="s2-tiles">
        {PRODUCTS.map((p, i) => (
          <a key={p.id} className="s2-tile hl-tile" style={{ '--i': i }} href={href(p)} onClick={go(navigate, href(p))}>
            <div className="s2-tile-media"><SitePhoto name={p.photo} alt="" sizes="(max-width: 760px) 100vw, 380px" /></div>
            <div className="s2-tile-body">
              <h3 className="s2-tile-name">{p.name}</h3>
              <p className="s2-tile-text">{p.tile}</p>
              <span className="s2-tile-cta">{COPY.build} <span aria-hidden="true">→</span></span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ---- the page of stills (reduced motion, no WebGL) ------------------------------------------------------------------
function StillPage({ navigate }) {
  return (
    <div className="hl hl-still-page">
      <header className="s2-wrap hl-still-head">
        <p className="s2-eyebrow">{COPY.eyebrow}</p>
        <h1 className="hl-headline">{COPY.headline}</h1>
        <a className="hl-skip" href="#hl-products">{COPY.skip}<span aria-hidden="true"> ↓</span></a>
      </header>
      <nav className="s2-wrap hl-still-list" aria-label="Products">
        {PRODUCTS.map((p) => <a key={p.id} href={`#hl-${p.id}`}>{p.name}</a>)}
      </nav>
      {PRODUCTS.map((p, i) => (
        <section key={p.id} id={`hl-${p.id}`} className="hl-slide" aria-label={p.name}>
          <div className="hl-slide-art"><Still name={p.id} alt={`${p.name} in a window`} /></div>
          <ProductWords p={p} i={i} navigate={navigate} className="hl-slide-words" />
        </section>
      ))}
      <Tiles navigate={navigate} />
      <Footer navigate={navigate} />
    </div>
  );
}

// ---- the pinned 3D scene --------------------------------------------------------------------------------------------
function ScrollHero({ navigate, params, onFail }) {
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const introRef = useRef(null);
  const wallRef = useRef(null);
  const wordRefs = useRef([]);
  const dotRefs = useRef([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState('Loading the 3D view');
  const ctl = useRef({ jump: () => {}, skip: () => {} });
  const frozen = params.get('u') !== null ? Number(params.get('u')) : null;

  // the page starts under the top bar, so the stage can be a full screen tall and nothing moves when the bar scrolls away
  useLayoutEffect(() => {
    const header = document.querySelector('.s2-nav');
    const set = () => { if (header && trackRef.current) trackRef.current.style.setProperty('--hl-nav', `${header.offsetHeight}px`); };
    set();
    if (!header || !('ResizeObserver' in window)) return undefined;
    const ro = new ResizeObserver(set); ro.observe(header);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let dead = false;
    let cleanup = () => {};
    (async () => {
      let mods;
      try {
        mods = await Promise.all([import('./scene.js'), import('gsap'), import('gsap/ScrollTrigger'), import('gsap/ScrollToPlugin')]);
      } catch (e) { console.error('[hero-lab] could not load the 3D view', e); if (!dead) onFail(); return; }
      if (dead) return;
      const [{ createHeroScene }, { gsap }, { ScrollTrigger }, { ScrollToPlugin }] = mods;
      gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

      const canvas = canvasRef.current, stage = stageRef.current;
      let hero;
      try {
        hero = createHeroScene({ canvas, products: PRODUCTS, antialias: true, onChange: () => wake() });
      } catch (e) { console.error('[hero-lab] WebGL failed', e); if (!dead) onFail(); return; }

      let u = frozen ?? 0, target = frozen ?? 0, last = performance.now(), raf = 0, visible = true, running = false;
      let ratio = Math.min(window.devicePixelRatio || 1, window.matchMedia('(max-width: 759px)').matches ? 1.5 : 2);
      if ((navigator.hardwareConcurrency || 8) <= 4) ratio = Math.min(ratio, 1.25);
      const minRatio = 0.75;
      let slow = 0, frames = 0, applied = { active: -2 };

      const setEl = (el, a, dy = 12) => {
        if (!el) return;
        el.style.opacity = a.toFixed(3);
        el.style.transform = `translate3d(0, ${((1 - a) * dy).toFixed(1)}px, 0)`;
        el.style.visibility = a < 0.015 ? 'hidden' : 'visible';
        el.style.pointerEvents = a > 0.6 ? 'auto' : 'none';
      };
      const applyDom = (s) => {
        setEl(introRef.current, s.intro, -8);
        wordRefs.current.forEach((el, i) => setEl(el, s.alphas[i]));
        setEl(wallRef.current, s.wall, 10);
        stage.style.setProperty('--fade', (1 - s.wide).toFixed(3));
        dotRefs.current.forEach((el, i) => { if (el) el.style.setProperty('--fill', s.drops[i].toFixed(3)); });
        if (applied.active !== s.active || applied.wall !== s.wall > 0.5) {
          applied = { active: s.active, wall: s.wall > 0.5 };
          dotRefs.current.forEach((el, i) => { if (!el) return; el.classList.toggle('is-active', i === s.active); if (i === s.active) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
          stage.dataset.active = String(s.active);
        }
      };
      const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const k = 1 - Math.exp(-dt * 7.5);                       // eases toward where the scroll bar is: smooth, never a jump
        const du = target - u;
        u = Math.abs(du) < 0.0003 ? target : u + du * k;
        const s = stateAt(u, N);
        hero.setState(s); applyDom(s); hero.render();
        // keep it fast on weaker phones: if frames are slow while it is moving, draw fewer pixels
        if (u !== target) {
          frames++; if (dt > 0.034) slow++;
          if (frames >= 30) { if (slow > 12 && ratio > minRatio) { ratio = Math.max(minRatio, ratio - 0.25); hero.setPixelRatio(ratio); } frames = 0; slow = 0; }
        }
        if (u !== target && visible) raf = requestAnimationFrame(frame); else running = false;
      };
      function wake() {
        if (running || !visible || dead) return;
        running = true; last = performance.now(); raf = requestAnimationFrame(frame);
      }

      const size = () => {
        const w = stage.clientWidth, h = stage.clientHeight;
        hero.setPixelRatio(ratio);
        hero.resize(w, h, w < 760 ? 'tall' : 'wide');
        wake();
      };
      size();
      const ro = new ResizeObserver(size); ro.observe(stage);
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); else cancelAnimationFrame(raf), running = false; }, { threshold: 0 });
      io.observe(stage);
      const onVis = () => { visible = !document.hidden; if (visible) wake(); else { cancelAnimationFrame(raf); running = false; } };
      document.addEventListener('visibilitychange', onVis);

      // scroll position -> target (the scene eases toward it)
      let st = null;
      if (frozen === null) {
        st = ScrollTrigger.create({
          trigger: trackRef.current, start: 'top top', end: 'bottom bottom',
          onUpdate: (self) => { target = self.progress * TOTAL; wake(); },
          onRefresh: (self) => { target = self.progress * TOTAL; wake(); },
        });
        target = st.progress * TOTAL; u = target;
      }
      const scrollTo = (y, dur) => gsap.to(window, { scrollTo: { y, autoKill: true }, duration: dur, ease: 'power2.inOut', overwrite: true });
      ctl.current.jump = (i) => {
        if (!st) return;
        const y = st.start + (stopFor(N, i) / TOTAL) * (st.end - st.start);
        const far = Math.abs(window.scrollY - y) / window.innerHeight;
        scrollTo(y, Math.min(2.4, 0.9 + far * 0.22));
      };
      ctl.current.skip = () => {
        const el = document.getElementById('hl-products');
        if (!el) return;
        const y = el.getBoundingClientRect().top + window.scrollY - 8;
        const far = Math.abs(window.scrollY - y) / window.innerHeight;
        scrollTo(y, Math.min(2.4, 0.9 + far * 0.18));
      };

      // first picture: wait a beat for the fabric textures, then fade the scene in over the still
      const s0 = stateAt(u, N);
      hero.setState(s0); applyDom(s0); hero.render();
      const done = () => {
        if (dead) return;
        wake();
        setReady(true); setLoading('');
        stage.dataset.ready = 'true';
        window.__heroLab = { ready: true, setU: (v) => { target = v; u = v; wake(); }, total: TOTAL, state: () => stateAt(u, N), settled: () => u === target, stops: PRODUCTS.map((_, i) => stopFor(N, i)) };
      };
      const textures = Promise.all(hero.blinds.map((b) => new Promise((res) => { const t = b.map; if (!t) return res(); if (t.image) return res(); const iv = setInterval(() => { if (t.image) { clearInterval(iv); res(); } }, 40); setTimeout(() => { clearInterval(iv); res(); }, 4000); })));
      textures.then(() => { hero.render(); requestAnimationFrame(() => requestAnimationFrame(done)); });

      cleanup = () => {
        cancelAnimationFrame(raf); running = false;
        ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis);
        st?.kill(); gsap.killTweensOf(window);
        hero.dispose();
        delete window.__heroLab;
      };
    })();
    return () => { dead = true; cleanup(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDot = (i) => (e) => { e.preventDefault(); ctl.current.jump(i); };
  return (
    <div className="hl">
      <div className="hl-track" ref={trackRef} style={{ '--hl-screens': TOTAL + 1 }}>
        <div className={`hl-stage${ready ? ' is-ready' : ''}`} ref={stageRef} data-active="-1">
          <div className="hl-still" aria-hidden={ready ? 'true' : undefined}><Still name="intro" alt="A window with a roller shade raised" eager /></div>
          <canvas className="hl-canvas" ref={canvasRef} aria-hidden="true" />
          <div className="hl-fade" aria-hidden="true" />

          <div className="hl-copy hl-intro" ref={introRef}>
            <p className="s2-eyebrow">{COPY.eyebrow}</p>
            <h1 className="hl-headline">{COPY.headline}</h1>
            <p className="hl-hint"><span className="hl-hint-line" aria-hidden="true" />{COPY.hint}</p>
          </div>
          {PRODUCTS.map((p, i) => <ProductWords key={p.id} p={p} i={i} navigate={navigate} innerRef={(el) => { wordRefs.current[i] = el; }} />)}
          <p className="hl-wall" ref={wallRef}>{COPY.wallCaption.replace('Seven', ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][N] || String(N))}</p>

          <nav className="hl-progress" aria-label="Products">
            <ol>
              {PRODUCTS.map((p, i) => (
                <li key={p.id}>
                  <button type="button" ref={(el) => { dotRefs.current[i] = el; }} onClick={onDot(i)} aria-label={p.name}>
                    <span className="hl-dot-bar" aria-hidden="true"><span /></span>
                    <span className="hl-dot-name">{p.name.replace(' Shades', '')}</span>
                  </button>
                </li>
              ))}
            </ol>
            <a className="hl-skip" href="#hl-products" onClick={(e) => { e.preventDefault(); ctl.current.skip(); }}>{COPY.skip}<span aria-hidden="true"> ↓</span></a>
          </nav>
          <p className="hl-status" role="status" aria-live="polite">{loading}</p>
        </div>
      </div>
      <Tiles navigate={navigate} />
      <Footer navigate={navigate} />
    </div>
  );
}

// ---- one frame of the scene on its own, for making the pictures -------------------------------------------------------
function ShotPage({ shot }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    let dead = false, hero;
    (async () => {
      const { createHeroScene } = await import('./scene.js');
      if (dead) return;
      const canvas = canvasRef.current;
      hero = createHeroScene({ canvas, products: PRODUCTS, antialias: true });
      const w = window.innerWidth, h = window.innerHeight;
      hero.setPixelRatio(1);
      hero.resize(w, h, w < 760 ? 'tall' : 'wide');
      hero.setState(stateAt(shotU(shot), N));
      const waits = hero.blinds.map((b) => new Promise((res) => { const t = b.map; const iv = setInterval(() => { if (!t || t.image) { clearInterval(iv); res(); } }, 30); }));
      await Promise.all(waits);
      for (let i = 0; i < 3; i++) { hero.render(); await new Promise((r) => requestAnimationFrame(r)); }
      window.__heroShotReady = true;
    })();
    return () => { dead = true; hero?.dispose(); };
  }, [shot]);
  return <canvas ref={canvasRef} className="hl-shot" />;
}

export default function HeroLab({ navigate }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const [failed, setFailed] = useState(false);
  const gl = useMemo(() => (params.get('mode') === 'still' ? false : webglOk()), [params]);
  const shot = params.get('shot');
  const onFail = useCallback(() => setFailed(true), []);
  if (shot && SHOTS.includes(shot)) return <ShotPage shot={shot} />;
  if (reduced || !gl || failed || params.get('mode') === 'still') return <StillPage navigate={navigate} />;
  return <ScrollHero navigate={navigate} params={params} onFail={onFail} />;
}
