import { useEffect, useRef, useState } from 'react';
import { profileOf } from '../lib/profile.js';

// The round profile button at the top right of the site, always there. Signed out: a plain person icon and a "Sign in with
// Google" item. Signed in: their Google picture (or initials) and Edit profile, Order history and Sign out.
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8.5" r="3.6" /><path d="M4.5 20c.6-3.7 3.6-5.9 7.5-5.9s6.9 2.2 7.5 5.9" />
  </svg>
);

export default function ProfileMenu({ user, authLoading, signInWithGoogle, signOut, navigate }) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const root = useRef(null);
  const btn = useRef(null);
  const p = profileOf(user);

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
      <button ref={btn} type="button" className={`profile-btn${user ? ' is-signed-in' : ''}`} aria-haspopup="menu" aria-expanded={open}
        aria-label={user ? `Your profile (${p.name || p.email})` : 'Profile and sign in'} onClick={() => setOpen(o => !o)}>
        {user
          ? (p.avatar && !imgFailed
              ? <img src={p.avatar} alt="" width="36" height="36" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
              : <span className="profile-initials" aria-hidden="true">{p.initials}</span>)
          : <PersonIcon />}
      </button>
      {open && (
        <div className="profile-dropdown" role="menu" aria-label="Profile" onKeyDown={arrows}>
          {user ? (
            <>
              <div className="profile-who">
                <strong>{p.name || 'Your account'}</strong>
                <span>{p.email}</span>
              </div>
              <button type="button" role="menuitem" onClick={() => go('profile')}>Edit profile</button>
              <button type="button" role="menuitem" onClick={() => go('orders')}>Order history</button>
              <button type="button" role="menuitem" className="profile-signout" onClick={() => { close(); signOut(); }}>Sign out</button>
            </>
          ) : (
            <>
              <div className="profile-who"><strong>{authLoading ? 'One moment…' : 'You’re not signed in'}</strong><span>Sign in to save your orders and your details.</span></div>
              <button type="button" role="menuitem" disabled={authLoading} onClick={() => { close(); signInWithGoogle(); }}>Sign in with Google</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
