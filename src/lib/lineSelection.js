// The selection a line page turns into an order item, plus what is still missing.
import { parseMech, usesDrive, cellularMotorName } from './drive.js';
import { extrasFor } from './choices.js';
import { styleById, cleanHardware, RETURNS } from './hardware.js';

export function buildSelection(line, c) {
  const missing = [];
  const need = (v, what) => { if (!v) missing.push(what); return v; };
  let sel = { lineId: line.id, picks: [] };
  // the small $0 choices (chain color, bottom bar, roll direction ...) that apply to this line and movement
  const drive = usesDrive(line.id) ? parseMech(line.id, c.mech, { double: c.mode === 'double-stack' }) : null;
  const extras = drive ? extrasFor(line.id, drive.movement, { ...c.extras, bottomWrap: c.bottomWrap }, { double: c.mode === 'double-stack' }) : {};
  if (Object.keys(extras).length) sel.extras = extras;
  if (line.id === 'cellular' && drive?.movement === 'motorized') sel.motorType = cellularMotorName(c.type);   // the motor follows the style
  switch (line.id) {
    case "roller":
      sel.mode = c.mode;
      if (c.wrap) sel.cover = c.wrap === "none" ? "none" : "wrapped";
      if (c.mode === "single") {
        need(c.front, "a fabric and color");
        if (c.front) sel.picks = [{ ...c.front, role: null }];
      } else {
        need(c.front, "the front shade");
        need(c.back, "the back shade");
        if (c.front) sel.picks.push({ ...c.front, role: "Front shade" });
        if (c.back) sel.picks.push({ ...c.back, role: "Back shade" });
      }
      break;
    case "zebra":
      if (c.wrap) sel.cover = c.wrap === "none" ? "none" : "wrapped";
      need(c.pick, "a fabric and color");
      if (c.pick) sel.picks = [c.pick];
      break;
    case "shangri-la":
      need(c.pick, "a fabric and color");
      if (c.pick) sel.picks = [c.pick];
      break;
    case "cellular":
      sel.type = c.type;
      if (c.type === "day-night") {
        need(c.day, "the day color");
        need(c.night, "the night color");
        if (c.day) sel.picks.push({ ...c.day, role: "Day (light-filtering)" });
        if (c.night) sel.picks.push({ ...c.night, role: "Night (blackout)" });
      } else {
        need(c.pick, "a color");
        if (c.pick) sel.picks = [c.pick];
      }
      break;
    case "roman":
      need(c.pick, "a color");
      need(c.romanStyle, "a style");
      need(c.lining, "a lining");
      sel.style = c.romanStyle || undefined;
      sel.lining = c.lining || undefined;
      if (c.pick) sel.picks = [c.pick];
      break;
    case "drapery":
      sel.section = c.section;
      if (c.section === "curtains") {
        const st = styleById(c.styleId);
        need(c.pick, "a color");
        need(st, "a style");
        need(st && c.fullness, "a fullness");
        need(c.lining, "a liner");
        need(c.panels, "single or pair");
        sel.pleat = st ? st.label : undefined;
        sel.fullness = c.fullness || undefined;
        sel.returnTo = RETURNS.some((r) => r.id === c.returnTo) ? c.returnTo : undefined;
        sel.panels = c.panels || undefined;
        sel.lining = c.lining || undefined;
        need(!c.hardwareIncomplete, "a track or rod");
        const hw = cleanHardware(c.hardware, c.styleId);
        if (hw) sel.hardware = hw;
        if (c.pick) sel.picks = [c.pick];
      } else {
        need(c.dream, "a fabric and color");
        need(c.dreamOpts?.install, "an install type");
        need(c.dreamOpts?.fit, "inside or outside");
        need(c.dreamOpts?.stack, "a stack");
        if (c.dreamOpts) sel.dreamOpts = { install: c.dreamOpts.install, fit: c.dreamOpts.fit, stack: c.dreamOpts.stack };
        if (c.dream) sel.picks = [c.dream];
      }
      break;
    default:
      break;
  }
  return { selection: sel, missing };
}


// The pick for a role ("Front shade", "Day ...") in a saved or draft selection; null when it is not picked yet.
export const pickByRole = (sel, rolePrefix) => sel?.picks?.find((p) => (p.role || '').startsWith(rolePrefix)) || null;
