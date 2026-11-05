// The phone's sticky preview shows as a compact strip (about a third of its height) while the page is scrolled down past the gallery. It opens
// again only on a tap on the strip, or when the page is back at the top; scrolling up does not open it.
// Folding never changes the page layout: the preview box keeps its full height in the flow, and the compact look is that same box clipped to its
// top part with the picture scaled down to fit (CSS, `.compact`). Nothing below it moves, so nothing jumps while scrolling or when it folds or opens.
// `--pv-strip` is the height the strip really covers right now, so the CSS can keep focused and scrolled-to things clear of it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const COMPACT_H = 108;  // the compact strip's height in px (a third of the open one)
const OPEN_BELOW = 24;         // back at the top (this close): always open
const FOLD_AFTER = 260;        // fold only after scrolling down this far (past the gallery), and only while scrolling down
const PIN = 220;               // after a tap it stays open until the page has been scrolled down this much further

export function useCompactStrip(ref, enabled) {
  const [compact, setCompact] = useState(false);
  const last = useRef({ y: 0, pin: -1 });

  // how the picture fits the strip: the scale, and where the picture starts inside the box
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const root = document.documentElement;
    if (!enabled || !compact) { el.style.removeProperty('--pv-k'); el.style.removeProperty('--pv-top'); root.style.removeProperty('--pv-strip'); return; }
    const gal = el.querySelector('.gal-stage') || el.querySelector('.pv-stage');
    const stage = el.querySelector('.pv-stage') || gal;
    if (gal && stage) {
      let top = 0; for (let n = gal; n && n !== el; n = n.offsetParent) top += n.offsetTop;       // layout offsets, not affected by the scaling
      el.style.setProperty('--pv-k', String(Math.min(1, (COMPACT_H - 12) / stage.offsetHeight)));
      el.style.setProperty('--pv-top', `${top}px`);
    }
    root.style.setProperty('--pv-strip', `${COMPACT_H}px`);
  }, [compact, enabled, ref]);

  useEffect(() => {
    if (!enabled) { setCompact(false); return undefined; }
    const root = document.documentElement, el = ref.current;
    last.current.y = window.scrollY;
    const onScroll = () => {
      const l = last.current, y = window.scrollY, dy = y - l.y; l.y = y;
      if (y < OPEN_BELOW) { setCompact(false); return; }
      if (dy > 0 && y > Math.max(FOLD_AFTER, l.pin >= 0 ? l.pin + PIN : 0)) { l.pin = -1; setCompact(true); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // while open, --pv-strip is the strip's own height
    const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (!el.classList.contains('compact')) root.style.setProperty('--pv-strip', `${el.offsetHeight}px`); }) : null;
    if (el) { ro?.observe(el); if (!el.classList.contains('compact')) root.style.setProperty('--pv-strip', `${el.offsetHeight}px`); }
    return () => { window.removeEventListener('scroll', onScroll); ro?.disconnect(); root.style.removeProperty('--pv-strip'); };
  }, [enabled, ref]);

  const open = useCallback(() => { last.current.pin = window.scrollY; setCompact(false); }, []);
  return [enabled && compact, open];
}
