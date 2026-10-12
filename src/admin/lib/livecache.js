// After an admin save, clear the edge-cached catalog for every line the change touches, so it shows on the live site at
// once instead of after the 60-second cache (api/catalog-purge.js does the clearing; it checks that the caller is an admin).
// A failed clear is never an error for the save: the cache expires by itself within the minute.
import { supabase } from '../../lib/supabase.js';
import { catalogLinesOf } from '../../data/catalogQuery.js';

// Catalog lines (the `line` of /api/catalog) that show a swatch: its own collection's and every linked collection's.
export function linesForSwatch(data, swatchId) {
  const fabricById = new Map(data.fabrics.map((f) => [f.id, f]));
  const s = data.swatches.find((x) => x.id === swatchId);
  const ids = [s?.fabric_id, ...(data.links || []).filter((l) => l.swatch_id === swatchId).map((l) => l.fabric_id)];
  return [...new Set(ids.flatMap((id) => catalogLinesOf(fabricById.get(id)?.shown_in)))];
}
export const linesForFabric = (data, fabricId) => catalogLinesOf(data.fabrics.find((f) => f.id === fabricId)?.shown_in);

// Returns a sentence for the notice under the save.
export async function publishToSite(lines) {
  const wanted = [...new Set(lines)];
  const fallback = 'It will show on the live site within about a minute.';
  if (!wanted.length) return fallback;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/catalog-purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ lines: wanted }),
    });
    const body = r.ok ? await r.json() : null;
    return body?.edge ? 'The live site is updated now.' : fallback;
  } catch { return fallback; }
}
