import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadLineCatalog, isLineLoaded } from '../data/catalogApi.js';

// status: 'loading' | 'ready' | 'error'. Pickers read it from context so each shows its own skeleton or message.
export const CatalogStatusContext = createContext({ status: 'ready', retry: () => {} });
export const useCatalogStatus = () => useContext(CatalogStatusContext);

export function useLineCatalog(lineKey) {
  const [status, setStatus] = useState(() => (isLineLoaded(lineKey) ? 'ready' : 'loading'));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isLineLoaded(lineKey)) { setStatus('ready'); return undefined; }
    let live = true;
    setStatus('loading');
    loadLineCatalog(lineKey, { retry: attempt > 0 })
      .then(() => { if (live) setStatus('ready'); })
      .catch((err) => { console.error('[catalog]', err); if (live) setStatus('error'); });
    return () => { live = false; };
  }, [lineKey, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { status, retry };
}
