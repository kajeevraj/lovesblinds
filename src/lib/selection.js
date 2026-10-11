// Browser entry point for order text (see selectionText.js).
// Picks saved before display names existed carry no displayName. useMissingNames() asks the database for those names
// (one batched request, for picks in the order on screen) and the text helpers use them from then on; until the answer
// arrives, or if it fails, the pick shows its code, as it always did.
import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { setNameFallback } from "./selectionText.js";

const names = new Map();      // swatch id -> display name
const asked = new Set();      // ids already requested
setNameFallback((swatchId) => names.get(swatchId));

export function useMissingNames(items) {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!supabase) return undefined;
    const ids = [...new Set(items.flatMap((it) => it.selection?.picks || [])
      .filter((p) => !p.displayName && p.swatchId && !names.has(p.swatchId) && !asked.has(p.swatchId))
      .map((p) => p.swatchId))].slice(0, 200);
    if (!ids.length) return undefined;
    ids.forEach((id) => asked.add(id));
    let live = true;
    supabase.rpc("swatch_display_names", { ids }).then(({ data, error }) => {
      if (error) { ids.forEach((id) => asked.delete(id)); return; }       // try again next time
      for (const r of data || []) names.set(r.id, r.display_name);
      if (live) rerender((n) => n + 1);
    });
    return () => { live = false; };
  }, [items]);
}

export * from "./selectionText.js";
