// Window sizes are typed as whole inches plus an eighth-inch fraction, and travel as one decimal number.
export const FRACTIONS = [
  ['0', '0'], ['0.125', '1/8'], ['0.25', '1/4'], ['0.375', '3/8'], ['0.5', '1/2'], ['0.625', '5/8'], ['0.75', '3/4'], ['0.875', '7/8'],
];

// "" when the whole inches are empty or not a positive number, so nothing is priced from half an entry.
export function toInches(whole, frac) {
  const w = parseFloat(whole);
  if (!(w >= 0) || whole === '') return '';
  const total = w + (parseFloat(frac) || 0);
  return total > 0 ? String(total) : '';
}

// 40.125 -> 40 1/8
export function formatInches(n) {
  const v = parseFloat(n);
  if (!(v > 0)) return '';
  const whole = Math.floor(v);
  const f = FRACTIONS.find(([d]) => Math.abs(parseFloat(d) - (v - whole)) < 0.001);
  return f && f[1] !== '0' ? `${whole} ${f[1]}` : String(whole === v ? whole : v);
}

// The size fields (whole inches + 1/8 fraction) for a saved width and height, so a window can be edited.
export function sizeFromNumbers(width, height) {
  const split = (v) => {
    const n = parseFloat(v) || 0;
    const whole = Math.floor(n);
    const f = FRACTIONS.find(([d]) => Math.abs(parseFloat(d) - (n - whole)) < 0.001);
    return [n ? String(whole) : '', f ? f[0] : '0'];
  };
  const [w, wf] = split(width); const [h, hf] = split(height);
  return { w, wf, h, hf };
}
