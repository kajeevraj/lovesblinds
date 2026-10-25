// The full color list for a product or the curtains: a bottom sheet on phones, a side panel on desktop. It is the product pages' color
// picker (search, color-family filters, magnifier, name and code on every swatch), shown in a modal <dialog> (focus trap and Esc come with it).
import { useEffect, useRef } from 'react';
import { SwatchBrowser } from '../components/s2.jsx';

export default function SwatchPanel({ open, title, hint, status, entries, activeId, onChoose, onClose, onRetry, sheet }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`rl-dlg ${sheet ? 'sheet' : 'side'}`} aria-label={title} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      {open && (
        <div className="rl-dlg-body">
          <div className="rl-dlg-head">
            <div><h2 className="rl-dlg-title">{title}</h2>{hint && <p className="rl-dlg-hint">{hint}</p>}</div>
            <button type="button" className="rl-dlg-close" onClick={() => ref.current?.close()} aria-label="Close colors">×</button>
          </div>
          {status === 'ready' ? (
            <SwatchBrowser id="rl-pick" entries={entries} activeId={activeId} onChoose={(e) => { onChoose(e); ref.current?.close(); }} />
          ) : status === 'error' ? (
            <div className="s2-empty" role="alert">Colors are temporarily unavailable. <button type="button" className="s2-link" onClick={onRetry}>Try again</button></div>
          ) : (
            <div className="s2-swatches s2-skeleton" role="status" aria-label="Loading colors">{Array.from({ length: 12 }, (_, i) => <span key={i} className="s2-skel" aria-hidden="true" />)}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
