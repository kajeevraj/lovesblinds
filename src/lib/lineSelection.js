// The selection a line page turns into an order item, plus what is still missing.

export function buildSelection(line, c) {
  const missing = [];
  const need = (v, what) => { if (!v) missing.push(what); return v; };
  let sel = { lineId: line.id, picks: [] };
  switch (line.id) {
    case "roller":
      sel.mode = c.mode;
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
      need(c.pick, "a swatch");
      need(c.romanStyle, "a style");
      need(c.lining, "a lining");
      sel.style = c.romanStyle || undefined;
      sel.lining = c.lining || undefined;
      if (c.pick) sel.picks = [c.pick];
      break;
    case "drapery":
      sel.section = c.section;
      if (c.section === "curtains") {
        need(c.pick, "a swatch");
        need(c.pleat, "a pleat style");
        need(c.lining, "a lining");
        sel.pleat = c.pleat || undefined;
        sel.lining = c.lining || undefined;
        if (c.pick) sel.picks = [c.pick];
      } else {
        need(c.dream, "a fabric and color");
        if (c.dream) sel.picks = [c.dream];
      }
      break;
    default:
      break;
  }
  return { selection: sel, missing };
}

