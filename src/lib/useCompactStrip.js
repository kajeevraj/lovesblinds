// The phone's sticky preview folds to a compact strip (about a third of its height) while the page is scrolled down past the gallery, and opens
// again when the person scrolls up a little, taps the strip, or comes back to the top. The shade in the strip is the live one.
// The strip is in the page flow, so changing its height moves everything under it by the difference. When it folds, the scroll position is moved by
// the same amount at the same moment, so what is on screen does not jump (nothing new is covered: the strip only got smaller). When it opens the page
// is left alone, so what was under it is pushed down below it and is never covered. Our own scroll correction is not mistaken for the person scrolling.
// `--pv-strip` (the strip's current height) lets the CSS keep focused and scrolled-to things clear of it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const OPEN_BELOW = 24;         // always open this close to the top of the page
const FOLD_AFTER = 260;        // fold only after scrolling down this far (past the gallery), and only while scrolling down
const UNFOLD_ON = 14;          // scrolling up this much opens it
const PIN = 220;               // after a tap it stays open until the page has been scrolled down this much further

export function useCompactStrip(ref, enabled) {
  const [compact, setCompact] = useState(false);
  const was = useRef({ compact: false, h: 0 });
  const last = useRef({ y: 0, up: 0, pin: -1, quiet: 0 });

  // the same height change, taken back out of the scroll position
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const h = el.offsetHeight, w = was.current;
    if (compact !== w.compact) last.current.quiet = performance.now() + 300;                      // the browser's own settling after the height change is not the person scrolling
    if (compact && !w.compact && w.h && h !== w.h) window.scrollBy(0, h - w.h);
    was.current = { compact, h };
  }, [compact, ref]);

  useEffect(() => {
    if (!enabled) { setCompact(false); return undefined; }
    const el = ref.current;
    last.current.y = window.scrollY;
    const onScroll = () => {
      const l = last.current, y = window.scrollY, dy = y - l.y; l.y = y;
      if (performance.now() < l.quiet) return;                                    // our own correction
      if (y < OPEN_BELOW) { l.up = 0; setCompact(false); return; }
      if (dy > 0) { l.up = 0; if (y > Math.max(FOLD_AFTER, l.pin >= 0 ? l.pin + PIN : 0)) { l.pin = -1; setCompact(true); } }
      else if (dy < 0) { l.up -= dy; if (l.up >= UNFOLD_ON) setCompact(false); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const root = document.documentElement;
    const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => root.style.setProperty('--pv-strip', `${el.offsetHeight}px`)) : null;
    if (el) { ro?.observe(el); root.style.setProperty('--pv-strip', `${el.offsetHeight}px`); }
    return () => { window.removeEventListener('scroll', onScroll); ro?.disconnect(); root.style.removeProperty('--pv-strip'); };
  }, [enabled, ref]);

  const open = useCallback(() => { last.current.pin = window.scrollY; last.current.up = 0; setCompact(false); }, []);
  return [enabled && compact, open];
}
