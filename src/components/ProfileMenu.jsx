import { useEffect, useRef, useState } from 'react';
import { profileOf } from '../lib/profile.js';

// The round profile button at the top right of the site once someone is signed in: their Google picture (or initials) with Edit
// profile, Order history and Sign out. Signed out, the top bar shows the Google "Sign in" button instead (GoogleSignIn.jsx).
export default function ProfileMenu({ user, authLoading, signInWithGoogle, signOut, navigate }) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const root = useRef(null);
  const btn = useRef(null);
  const p = profileOf(user) || { name: '', email: '', avatar: '', initials: '?' };

  const close = (refocus = false) => { setOpen(false); if (refocus) btn.current?.focus(); };
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown); document.addEventListener('keydown', onKey);
    root.current?.querySelector('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const arrows = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...root.current.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };
  const go = (route) => { close(); navigate(route); };

  return (
    <div className="profile-menu" ref={root}>
      <button ref={btn} type="button" className="profile-btn is-signed-in" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Your profile (${p.name || p.email})`} onClick={() => setOpen(o => !o)}>
        {p.avatar && !imgFailed
          ? <img src={p.avatar} alt="" width="36" height="36" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
          : <span className="profile-initials" aria-hidden="true">{p.initials}</span>}
      </button>
      {open && (
        <div className="profile-dropdown" role="menu" aria-label="Profile" onKeyDown={arrows}>
          <div className="profile-who">
            <strong>{p.name || 'Your account'}</strong>
            <span>{p.email}</span>
          </div>
          <button type="button" role="menuitem" onClick={() => go('profile')}>Edit profile</button>
          <button type="button" role="menuitem" onClick={() => go('orders')}>Order history</button>
          <button type="button" role="menuitem" className="profile-signout" onClick={() => { close(); signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
