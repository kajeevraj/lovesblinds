import { useEffect } from 'react';
import './admin.css';
import { useAdminSession } from './useAdminSession.js';
import Shell from './Shell.jsx';

// Loaded only at /admin (lazy), together with admin.css, so customers never download any of it.
// Who may do what is decided by the database; this file only picks which screen to show.
function useNoIndex() {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    const title = document.title;
    document.title = 'Admin | Love’s Blinds';
    return () => { m.remove(); document.title = title; };
  }, []);
}

export default function AdminApp() {
  useNoIndex();
  const s = useAdminSession();

  if (s.status === 'loading') return <div className="adm adm-center" aria-busy="true"><p className="adm-muted">Loading…</p></div>;
  if (s.status === 'unconfigured') return <div className="adm adm-center"><div className="adm-card"><h1>Admin is not configured</h1><p className="adm-muted">The site is missing its Supabase settings.</p></div></div>;

  if (s.status === 'signedOut') {
    return (
      <div className="adm adm-center">
        <div className="adm-card">
          <h1>Love’s Blinds admin</h1>
          {s.notice && <p className="adm-notice" role="status">{s.notice}</p>}
          <p className="adm-muted">Sign in with the Google account that has admin access.</p>
          <button className="adm-btn adm-btn-primary" onClick={s.signIn}>Sign in with Google</button>
        </div>
      </div>
    );
  }

  if (s.status === 'noAccess') {
    return (
      <div className="adm adm-center">
        <div className="adm-card">
          <h1>You don’t have access</h1>
          <button className="adm-btn" onClick={() => s.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  return <Shell user={s.user} signOut={s.signOut} />;
}
