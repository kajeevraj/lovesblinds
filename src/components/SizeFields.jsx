// The size step: one box for the width and one for the height, in inches. A box takes 35, 35.5, 35 1/2 or 35-1/2 and shows the
// size back as a fraction ("35 1/2 in", rounded to the nearest 1/8). A small button next to each box lists 1/8 to 7/8.
import { useEffect, useRef, useState } from 'react';
import { FRACTION_CHOICES, parseInches, formatInches, toInches } from '../lib/inches.js';

export const EMPTY_SIZE = { w: '', h: '' };
export const sizeNumbers = (size) => ({ width: toInches(size.w), height: toInches(size.h) });

// the whole inches already typed (35 for "35", "35.5", "35 1/2"), so a fraction can be added to them
const wholeOf = (text) => {
  const v = parseInches(text);
  if (v != null) return Math.floor(v);
  const n = parseInt(String(text).trim(), 10);
  return n > 0 ? n : 0;
};

function Fractions({ label, text, onPick }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const pick = (f) => { const w = wholeOf(text); onPick(w ? `${w} ${f}` : f); setOpen(false); root.current?.querySelector('button')?.focus(); };
  return (
    <span className="s2-fracpick" ref={root}>
      <button type="button" className="s2-frac-btn" aria-haspopup="true" aria-expanded={open} aria-label={`Add a fraction to the ${label}`} onClick={() => setOpen((o) => !o)}>
        <span className="s2-frac-glyph" aria-hidden="true">½</span><span className="s2-frac-btn-text">Fraction</span>
      </button>
      {open && (
        <span className="s2-frac-pop" role="group" aria-label={`Fraction of an inch for the ${label}`}>
          {FRACTION_CHOICES.map((f) => <button key={f} type="button" className="s2-frac-opt" onClick={() => pick(f)}>{f}</button>)}
        </span>
      )}
    </span>
  );
}

// `size` is { w, h } (what was typed); onChange gets the next one.
export default function SizeFields({ size, onChange, idp = 's2' }) {
  const field = (k, label, ph) => {
    const text = size[k];
    const v = parseInches(text);
    const bad = text.trim() !== '' && v == null;
    return (
      <div className="s2-field" key={k}>
        <label className="s2-label" htmlFor={`${idp}-${k}`}>{label}</label>
        <div className="s2-field-row">
          <input id={`${idp}-${k}`} className="s2-input" type="text" inputMode="decimal" autoComplete="off" autoCorrect="off" spellCheck={false}
            placeholder={ph} value={text} aria-invalid={bad} aria-describedby={`${idp}-${k}-echo`}
            onChange={(e) => onChange({ ...size, [k]: e.target.value })}
            onBlur={() => { if (v != null) onChange({ ...size, [k]: formatInches(v) }); }} />
          <Fractions label={label.toLowerCase()} text={text} onPick={(t) => onChange({ ...size, [k]: t })} />
        </div>
        <div id={`${idp}-${k}-echo`} className={`s2-size-echo${bad ? ' is-error' : ''}`} aria-live="polite">
          {bad ? 'Enter a size like 35, 35.5 or 35 1/2.' : v != null ? <><strong>{formatInches(v)} in</strong>{Math.abs(v - parseFloat(text)) > 1e-9 && /^[\d.]+$/.test(text.trim()) ? ' (nearest 1/8)' : ''}</> : ' '}
        </div>
      </div>
    );
  };
  return (
    <div className="s2-size-wrap">
      <p className="s2-size-help" id={`${idp}-size-help`}>One box for each side, in inches. Type 35, 35.5, 35 1/2 or 35-1/2. We use the nearest 1/8 inch, shown below each box.</p>
      <div className="s2-size" aria-describedby={`${idp}-size-help`}>
        {field('w', 'Width', 'e.g. 35 1/2')}
        {field('h', 'Height', 'e.g. 64')}
      </div>
    </div>
  );
}
export { SizeFields };
