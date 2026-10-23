// Desktop only: a signed-out visitor with something in the cart who moves the mouse up and out of the top of the window sees this
// once per visit. No back-button or history tricks: it only listens to the mouse leaving the page through the top edge.
import { useEffect, useRef, useState } from 'react';
import { useCart } from '../lib/cart.js';
import GoogleSignIn from './GoogleSignIn.jsx';

const SHOWN_KEY = 'lb_exit_prompt';
const wasShown = () => { try { return sessionStorage.getItem(SHOWN_KEY) === '1'; } catch { return false; } };

export default function ExitPrompt({ route }) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const eligible = cart.auth.supabaseEnabled && !cart.auth.user && !cart.auth.authLoading && cart.count > 0 && route !== 'admin';

  useEffect(() => {
    if (!eligible || wasShown()) return undefined;
    // a real mouse and a wide window only (phones and tablets have no "toward the top" to move to)
    if (!window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches) return undefined;
    const show = () => {
      if (wasShown()) return;
      try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch { /* ignore */ }
      setOpen(true);
    };
    const onOut = (e) => { if (!e.relatedTarget && e.clientY <= 8) show(); };       // the pointer left through the top edge
    document.addEventListener('mouseout', onOut);
    return () => document.removeEventListener('mouseout', onOut);
  }, [eligible]);

  useEffect(() => {
    if (!open) return undefined;
    ref.current?.querySelector('.s2-exit-close')?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => { if (!eligible) setOpen(false); }, [eligible]);   // signed in, or the cart emptied: nothing to ask

  if (!open) return null;
  return (
    <div className="s2-exit-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="s2-exit" role="dialog" aria-modal="true" aria-labelledby="s2-exit-title" ref={ref}>
        <button type="button" className="s2-exit-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
        <h2 id="s2-exit-title" className="s2-exit-title">Save your cart?</h2>
        <p className="s2-exit-text">Sign in with Google and it'll be here next time.</p>
        <GoogleSignIn wide text="signin_with" label="Sign in with Google" gis onFallback={cart.auth.signIn} />
      </div>
    </div>
  );
}
