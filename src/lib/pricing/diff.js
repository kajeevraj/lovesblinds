// Compares freshly parsed grids with what is in the database, for the re-import preview. Pure.
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// existing: [{ grid_key, label, row_axis, col_axis, cost, fabrics:[fabric_id] }]
// incoming: [{ grid_key, label, row_axis, col_axis, cost, fabrics:[{fabric_id}] }]
export function diffGrids(existing, incoming, { maxExamples = 40 } = {}) {
  const byKey = new Map(existing.map((g) => [g.grid_key, g]));
  const inKeys = new Set(incoming.map((g) => g.grid_key));
  const added = [], changed = [], unchanged = [], removed = existing.filter((g) => !inKeys.has(g.grid_key));
  const examples = []; let cellsChanged = 0;
  for (const g of incoming) {
    const old = byKey.get(g.grid_key);
    if (!old) { added.push(g); continue; }
    const axesChanged = !same(old.row_axis, g.row_axis) || !same(old.col_axis, g.col_axis);
    let n = 0;
    if (!axesChanged) {
      const nc = g.col_axis.length;
      for (let i = 0; i < g.cost.length; i++) {
        const a = old.cost[i], b = g.cost[i];
        if ((a == null) !== (b == null) || (a != null && Math.abs(a - b) > 0.0005)) {
          n++;
          if (examples.length < maxExamples) examples.push({ grid: g.label, row: g.row_axis[Math.floor(i / nc)], col: g.col_axis[i % nc], from: a, to: b });
        }
      }
    }
    const oldFabs = new Set(old.fabrics || []); const newFabs = new Set(g.fabrics.map((f) => f.fabric_id));
    const fabAdded = [...newFabs].filter((f) => !oldFabs.has(f)); const fabRemoved = [...oldFabs].filter((f) => !newFabs.has(f));
    if (axesChanged || n || fabAdded.length || fabRemoved.length) { cellsChanged += n; changed.push({ grid: g, axesChanged, cells: n, fabAdded, fabRemoved }); } else unchanged.push(g);
  }
  return { added, removed, changed, unchanged, cellsChanged, examples };
}

export function diffAdders(existing, incoming) {
  const byKey = new Map(existing.filter((a) => a.origin === 'sheet').map((a) => [a.adder_key, a]));
  const out = [];
  for (const a of incoming) {
    const old = byKey.get(a.adder_key);
    if (!old) out.push({ kind: 'new', adder: a });
    else if (Number(old.amount) !== Number(a.amount) || old.kind !== a.kind) out.push({ kind: 'changed', adder: a, from: Number(old.amount) });
    byKey.delete(a.adder_key);
  }
  for (const a of byKey.values()) out.push({ kind: 'removed', adder: a });
  return out;
}
