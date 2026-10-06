// Pure merge of swatch packages (no bundler APIs, so Node scripts can use it too).
// Records merge by `id`. An id that already exists is never overwritten.

export function mergeCatalogs(catalogs) {
  const fabrics = [];
  const swatches = [];
  const fabricIds = new Set();
  const swatchIds = new Set();
  const skipped = [];
  for (const { name, data } of catalogs) {
    for (const f of data.fabrics || []) {
      if (fabricIds.has(f.id)) { skipped.push({ kind: 'fabric', id: f.id, from: name }); continue; }
      fabricIds.add(f.id); fabrics.push(f);
    }
    for (const s of data.swatches || []) {
      if (swatchIds.has(s.id)) { skipped.push({ kind: 'swatch', id: s.id, from: name }); continue; }
      swatchIds.add(s.id); swatches.push(s);
    }
  }
  return { fabrics, swatches, skipped };
}

// swatches.json first, then swatches-*.json in name order.
export const orderCatalogs = (entries) =>
  [...entries].sort((a, b) => {
    if (a.name === 'swatches.json') return -1;
    if (b.name === 'swatches.json') return 1;
    return a.name.localeCompare(b.name);
  });
