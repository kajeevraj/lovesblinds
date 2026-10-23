// Window sizes are typed in one box per side ("35", "35.5", "35 1/2" or "35-1/2"), rounded to the nearest 1/8 inch, shown back as
// a fraction ("35 1/2") and travel as one decimal number. Pure code with no imports (the order spreadsheet uses it too).
export const EIGHTHS = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
export const FRACTION_CHOICES = EIGHTHS.slice(1);

// The number a typed size means, rounded to the nearest 1/8, or null when it is empty or not a size.
// Accepts 35, 35.5, 35 1/2, 35-1/2, 1/2, and the same with an inch mark (35 1/2", 35 1/2 in).
export function parseInches(text) {
  const t = String(text ?? '').trim().toLowerCase().replace(/\s*(inches|inch|in|")\s*$/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  let v = null;
  let m;
  if (/^(\d+(\.\d*)?|\.\d+)$/.test(t)) v = parseFloat(t);
  else if ((m = t.match(/^(\d+)(?: |-)(\d+)\/(\d+)$/))) v = Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : NaN;
  else if ((m = t.match(/^(\d+)\/(\d+)$/))) v = Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  const r = Math.round(v * 8) / 8;
  return r > 0 ? r : null;          // under 1/16 inch is nothing
}

// 35.5 -> "35 1/2", 0.5 -> "1/2", 36 -> "36" ('' when not a positive number)
export function formatInches(n) {
  const v = Math.round(parseFloat(n) * 8) / 8;
  if (!(v > 0)) return '';
  const whole = Math.floor(v);
  const f = EIGHTHS[Math.round((v - whole) * 8)];
  return f ? (whole ? `${whole} ${f}` : f) : String(whole);
}

// The size boxes for a saved width and height, so a window can be edited.
export const sizeFromNumbers = (width, height) => ({ w: formatInches(width), h: formatInches(height) });

// "" when the box is empty or not a size, so nothing is priced from half an entry.
export const toInches = (text) => { const v = parseInches(text); return v == null ? '' : String(v); };
