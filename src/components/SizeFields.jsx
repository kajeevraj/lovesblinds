// The size step: for width and for height, a box for the whole inches and a small "+ fraction" dropdown (0, 1/8 ... 7/8), on one line:
//   Width [ 40 ] in [ + 3/8 v ]
// The page keeps the size as one text per side ("40 3/8", "3/8", "40", ""), exactly as before, so drafts, the cart and the price code
// are unchanged. Whole inches and fraction are split out of that text and put back together when either changes.
import { useState } from 'react';
import { EIGHTHS, parseInches, formatInches, toInches } from '../lib/inches.js';

export const EMPTY_SIZE = { w: '', h: '' };
export const sizeNumbers = (size) => ({ width: toInches(size.w), height: toInches(size.h) });

// "40 3/8" -> { whole: "40", frac: "3/8" }. A typed decimal (35.5, from an older draft) becomes 35 and 1/2.
export function splitSize(text) {
  const v = parseInches(text);
  if (v != null) { const whole = Math.floor(v); return { whole: whole ? String(whole) : '', frac: EIGHTHS[Math.round((v - whole) * 8)] || '' }; }
  const n = parseInt(String(text ?? '').trim(), 10);
  return { whole: n > 0 ? String(n) : '', frac: '' };
}
export const joinSize = (whole, frac) => {
  const w = String(whole ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (w && frac) return `${w} ${frac}`;
  return w || frac || '';
};

const FRAC_OPTIONS = ['', ...EIGHTHS.slice(1)];     // '' is "0"

// One side. The whole-inches box takes digits; a pasted or typed "35 1/2", "35.5" or "35-1/2" is understood too (the fraction goes to the dropdown).
function SizeLine({ k, label, size, onChange, idp }) {
  const { whole, frac } = splitSize(size[k]);
  const v = parseInches(size[k]);
  const [draft, setDraft] = useState(null);                 // what is being typed in the box (null when it is not being edited)
  const set = (nextWhole, nextFrac) => onChange({ ...size, [k]: joinSize(nextWhole, nextFrac) });
  const typed = (text) => {
    setDraft(text);
    if (/^\d*$/.test(text)) { set(text, frac); return; }
    const p = splitSize(text);                               // "35 1/2", "35.5", "35-1/2"
    if (parseInches(text) != null) set(p.whole, p.frac); else set(text.replace(/\D/g, ''), frac);
  };
  return (
    <div className="s2-field s2-size-line">
      <label className="s2-label" htmlFor={`${idp}-${k}`}>{label}</label>
      <div className="s2-field-row s2-size-row">
        <input id={`${idp}-${k}`} className="s2-input s2-size-whole" type="text" inputMode="decimal" autoComplete="off" autoCorrect="off" spellCheck={false}
          placeholder="0" value={draft ?? whole} aria-describedby={`${idp}-${k}-echo`}
          onChange={(e) => typed(e.target.value)} onBlur={() => setDraft(null)} />
        <span className="s2-size-unit" aria-hidden="true">in</span>
        <label className="s2-size-fraclabel" htmlFor={`${idp}-${k}-frac`}><span className="s2-sr">{label}, </span>+ fraction</label>
        <select id={`${idp}-${k}-frac`} className="s2-input s2-size-frac" value={frac} onChange={(e) => { setDraft(null); set(whole, e.target.value); }}>
          {FRAC_OPTIONS.map((f) => <option key={f || '0'} value={f}>{f || '0'}</option>)}
        </select>
      </div>
      <div id={`${idp}-${k}-echo`} className="s2-size-echo" aria-live="polite">{v != null ? <strong>{formatInches(v)} in</strong> : ' '}</div>
    </div>
  );
}

// `size` is { w, h } (the text per side); onChange gets the next one.
export default function SizeFields({ size, onChange, idp = 's2' }) {
  return (
    <div className="s2-size-wrap">
      <p className="s2-size-help" id={`${idp}-size-help`}>Whole inches in the box, then add a fraction if you need one. We use the nearest 1/8 inch.</p>
      <div className="s2-size" aria-describedby={`${idp}-size-help`}>
        <SizeLine k="w" label="Width" size={size} onChange={onChange} idp={idp} />
        <SizeLine k="h" label="Height" size={size} onChange={onChange} idp={idp} />
      </div>
    </div>
  );
}
export { SizeFields };
