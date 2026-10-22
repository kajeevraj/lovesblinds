// Google Identity Services: the personalized "Sign in" button and One Tap. A returning visitor sees their own name, email and photo
// on Google's button, with no password. The credential Google hands back is exchanged for a Supabase session in App.jsx
// (supabase.auth.signInWithIdToken). When no client id is set, or Google's script cannot load (offline, blocked), every
// button falls back to the ordinary Google redirect sign-in, so nothing here is ever required.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const googleEnabled = !!GOOGLE_CLIENT_ID;

let loading = null;
let handler = null;           // (credential, rawNonce) => void, set by App
let rawNonce = '';
let initialised = false;

export const setCredentialHandler = (fn) => { handler = fn; };

const randomNonce = () => {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const sha256Hex = async (text) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

// Resolves google.accounts.id once the script is loaded and initialised, or null when it cannot be (no client id, offline, blocked).
export function loadGoogle() {
  if (!googleEnabled || typeof window === 'undefined' || !window.crypto?.subtle) return Promise.resolve(null);
  if (!loading) {
    loading = new Promise((resolve) => {
      const done = async () => {
        try {
          const gid = window.google?.accounts?.id;
          if (!gid) { resolve(null); return; }
          if (!initialised) {
            rawNonce = randomNonce();
            const nonce = await sha256Hex(rawNonce);
            gid.initialize({
              client_id: GOOGLE_CLIENT_ID, nonce, auto_select: false, cancel_on_tap_outside: true, itp_support: true, use_fedcm_for_prompt: true,
              callback: (res) => { if (res?.credential && handler) handler(res.credential, rawNonce); },
            });
            initialised = true;
          }
          resolve(gid);
        } catch { resolve(null); }
      };
      if (window.google?.accounts?.id) { done(); return; }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
      s.onload = done; s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }
  return loading;
}

export const promptOneTap = () => loadGoogle().then((gid) => { try { gid?.prompt(); } catch { /* ignore */ } });
export const cancelOneTap = () => { try { window.google?.accounts?.id?.cancel(); } catch { /* ignore */ } };
export const forgetGoogle = () => { try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* ignore */ } };
