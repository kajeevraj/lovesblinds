// What a customer has chosen on a product page so far, saved in this browser as they go, so the back button, a refresh or a
// closed tab never loses it. One draft per product line (and one per cart item being changed). A draft that has real progress
// and is not the page currently open shows in the cart as an incomplete item.
import { useEffect, useState } from 'react';
import { getLine } from '../data/lines.js';
import { summarize } from './selectionText.js';
import { formatInches, parseInches } from './inches.js';

const PREFIX = 'lb_draft_v1:';
const EVENT = 'lb-drafts';
const keyOf = (lineId, editId = null) => `${PREFIX}${lineId}${editId ? `:edit:${editId}` : ''}`;

const read = (key) => { try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch { return null; } };
const notify = () => { try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ } };

export const getDraft = (lineId, editId = null) => read(keyOf(lineId, editId));
export function saveDraft(lineId, editId, data) {
  try { localStorage.setItem(keyOf(lineId, editId), JSON.stringify({ ...data, lineId, editId: editId || null, t: Date.now() })); } catch { /* storage full or blocked */ }
  notify();
}
export function clearDraft(lineId, editId = null) {
  try { if (localStorage.getItem(keyOf(lineId, editId)) == null) return; localStorage.removeItem(keyOf(lineId, editId)); } catch { /* ignore */ }
  notify();
}
export function clearAllDrafts() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  notify();
}

// A draft is worth keeping once the customer has picked a color or typed a size or a room.
export const hasProgress = (d) => !!d && ((d.selection?.picks?.length || 0) > 0 || !!(d.w || '').trim() || !!(d.h || '').trim() || !!(d.roomLabel || '').trim() || !!(d.windowLabel || '').trim());

// The draft as the item-like object the product pages start from (the same shape as an item being edited).
export function draftAsStart(d) {
  if (!d) return null;
  return { selection: d.selection || null, mech: d.mech, mount: d.mount, w: d.w || '', h: d.h || '', roomLabel: d.roomLabel || '', windowLabel: d.windowLabel || '', qty: d.qty || 1, ui: d.ui || {} };
}

// Every product page asks for its starting point once, when it opens: the saved draft when there is one, else the item being edited.
export function startFor(lineId, edit) {
  const d = getDraft(lineId, edit?.id || null);
  if (d) return draftAsStart(d);
  if (!edit) return null;
  return { selection: edit.selection || null, mech: edit.mech, mount: edit.mount, w: formatInches(edit.width), h: formatInches(edit.length), roomLabel: edit.roomLabel || '', windowLabel: edit.windowLabel || '', qty: edit.qty || 1, ui: {} };
}

// The incomplete items for the cart: every non-edit draft with progress, except the one for the page that is open right now.
export function listIncomplete(exceptLine = null) {
  const out = [];
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(PREFIX)) continue;
      const d = read(k);
      if (!d || d.editId || !hasProgress(d) || d.lineId === exceptLine) continue;
      const product = getLine(d.lineId);
      if (!product) continue;
      const sum = summarize({ product, selection: d.selection && d.selection.picks ? d.selection : null, colorName: '' });
      const w = parseInches(d.w), h = parseInches(d.h);
      out.push({
        key: k, lineId: d.lineId, product, t: d.t || 0,
        title: sum.title, colorText: d.selection?.picks?.length ? sum.colorText : '',
        sizeText: w && h ? `${formatInches(w)}" wide × ${formatInches(h)}" high` : '',
      });
    }
  } catch { /* ignore */ }
  return out.sort((a, b) => a.t - b.t);
}

// Re-reads the list whenever any draft changes (in this tab or another one).
export function useIncomplete(exceptLine = null) {
  const [list, setList] = useState(() => listIncomplete(exceptLine));
  useEffect(() => {
    // only a change in what the cart would show re-renders the app (not every keystroke on the page that is open)
    const refresh = () => setList((prev) => { const next = listIncomplete(exceptLine); return JSON.stringify(next.map(({ product, t, ...rest }) => rest)) === JSON.stringify(prev.map(({ product, t, ...rest }) => rest)) ? prev : next; });
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [exceptLine]);
  return list;
}
