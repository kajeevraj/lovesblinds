import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { IDLE_MINUTES } from './lib/constants.js';

const ACTIVE_KEY = 'lb_admin_last_active';
const EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'];
const readActive = () => { try { return Number(localStorage.getItem(ACTIVE_KEY)) || 0; } catch { return 0; } };
const writeActive = () => { try { localStorage.setItem(ACTIVE_KEY, String(Date.now())); } catch { /* private mode */ } };

// status: loading | unconfigured | signedOut | noAccess | admin
// The page only decides what to show. What a signed-in person may actually do is decided by the database (RLS, is_admin()).
export function useAdminSession() {
  const [state, setState] = useState({ status: 'loading', user: null });
  const [notice, setNotice] = useState('');
  const lastUser = useRef(undefined);

  const apply = useCallback(async (session) => {
    const user = session?.user ?? null;
    if (!user) { lastUser.current = null; setState({ status: 'signedOut', user: null }); return; }
    if (lastUser.current === user.id) return;           // token refreshes don't need another check
    lastUser.current = user.id;
    const { data, error } = await supabase.rpc('is_admin');
    setState({ status: !error && data === true ? 'admin' : 'noAccess', user });
  }, []);

  useEffect(() => {
    if (!supabase) { setState({ status: 'unconfigured', user: null }); return; }
    let live = true;
    supabase.auth.getSession().then(({ data }) => { if (live) apply(data.session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      setTimeout(() => { if (live) apply(session); }, 0);       // never await Supabase calls inside this callback
    });
    return () => { live = false; subscription.unsubscribe(); };
  }, [apply]);

  const signOut = useCallback(async (why = '') => {
    if (why) setNotice(why);
    try { localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
    await supabase?.auth.signOut();
  }, []);

  // Sign out after IDLE_MINUTES without a click, key press, touch or scroll (also across tabs, through localStorage).
  const signedIn = state.status === 'admin' || state.status === 'noAccess';
  useEffect(() => {
    if (!signedIn) return;
    const limit = IDLE_MINUTES * 60 * 1000;
    if (readActive() && Date.now() - readActive() > limit) { signOut(`You were signed out after ${IDLE_MINUTES} minutes of inactivity.`); return; }
    writeActive();
    let last = 0;
    const touch = () => { const now = Date.now(); if (now - last > 5000) { last = now; writeActive(); } };
    const check = () => { if (Date.now() - readActive() > limit) signOut(`You were signed out after ${IDLE_MINUTES} minutes of inactivity.`); };
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(check, 30000);
    return () => { EVENTS.forEach((e) => window.removeEventListener(e, touch)); clearInterval(timer); };
  }, [signedIn, signOut]);

  const signIn = useCallback(() => {
    setNotice('');
    supabase?.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin`, queryParams: { prompt: 'select_account' } },
    });
  }, []);

  return { ...state, notice, signIn, signOut };
}
