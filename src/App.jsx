import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Nav, HomePage, ProductsPage, ContactPage, MeasureGuidePage, OrdersPage, ProfilePage } from './customer.jsx';
import { useAuth } from './lib/useAuth.js';
import { reconstructItem, serializeItem } from './lib/orders.js';
import { useMissingNames } from './lib/selection.js';
import { resolvePath, routeFor, pathFor } from './lib/router.js';

// Code-split: the line page pulls in the swatch data. The admin area is its own chunk (with its own CSS), fetched only
// when someone opens /admin, so customers never download it. What an admin may do is decided by the database, not here.
const LinePage = lazy(() => import('./linepage.jsx'));
const OrderPage = lazy(() => import('./orderpage.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

const GUEST_QUOTE_KEY = 'lb_guest_quote';

export default function App() {
  // Real paths: the URL is the source of truth, redirects are applied before first render.
  const [path, setPath] = useState(() => {
    const r = resolvePath(window.location.pathname);
    if (r.redirect) window.history.replaceState({}, '', r.redirect + window.location.search);
    return r.redirect || window.location.pathname;
  });
  useEffect(() => {
    const onPop = () => {
      const r = resolvePath(window.location.pathname);
      if (r.redirect) window.history.replaceState({}, '', r.redirect);
      setPath(r.redirect || window.location.pathname);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const { route, slug } = routeFor(path);
  const [productLocation, setProductLocation] = useState(null);
  const [quote, setQuote]         = useState(() => {
    // On page load (which happens after OAuth redirect), restore guest items from localStorage.
    try {
      const saved = localStorage.getItem(GUEST_QUOTE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const items = parsed.map(reconstructItem).filter(Boolean);
        if (items.length > 0) return items;
      }
    } catch { /* ignore */ }
    return [];
  });
  const [snackbar, setSnackbar]   = useState(null);
  useMissingNames(quote);                       // names for picks saved before display names existed
  const quoteRef = useRef(quote);
  useEffect(() => { quoteRef.current = quote; });

  const {
    supabaseEnabled,
    user, orders, activeOrder, activeOrderId, setActiveOrderId,
    authLoading, signInWithGoogle, signOut, dbError,
    createOrder, saveItems, renameOrder, markOrderSent, deleteOrder,
  } = useAuth();

  // Show DB errors as snackbars so we can see what's going wrong.
  useEffect(() => {
    if (dbError) showSnackbar(`⚠ ${dbError}`);
  }, [dbError]);

  // Once logged in and order is ready, clear the guest localStorage backup and
  // migrate any guest items into the active order if the order is currently empty.
  useEffect(() => {
    if (!activeOrderId || !activeOrder) return;
    const dbItems = activeOrder.items.map(reconstructItem).filter(Boolean);
    if (dbItems.length > 0) {
      setQuote(dbItems);
      localStorage.removeItem(GUEST_QUOTE_KEY);
    } else if (quoteRef.current.length > 0) {
      // New empty order, but we have guest items (from localStorage restore) — push them up.
      saveItems(activeOrderId, quoteRef.current);
      localStorage.removeItem(GUEST_QUOTE_KEY);
      // Leave quote as-is (already has the items).
    }
    // Both empty → leave quote alone.
  }, [activeOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // After an order is sent, the next window goes into a fresh order, so the sent one keeps exactly what was sent.
  const [justSent, setJustSent] = useState(false);
  const handleOrderSent = async (orderId, items) => { await markOrderSent(orderId, items); setJustSent(true); };
  useEffect(() => {
    if (!justSent || quote.length > 0) return;
    setJustSent(false);
    if (user) createOrder(`Order ${orders.length + 1}`);
  }, [justSent, quote.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncToSupabase = useCallback((items) => {
    if (user && activeOrderId) saveItems(activeOrderId, items);
  }, [user, activeOrderId, saveItems]);

  const showSnackbar = (msg, action) => {
    setSnackbar({ msg, action });
    setTimeout(() => setSnackbar(null), 4000);
  };

  // Keep localStorage in sync so guest items survive an OAuth redirect.
  const persistGuestQuote = (items) => {
    if (!user) localStorage.setItem(GUEST_QUOTE_KEY, JSON.stringify(items.map(serializeItem)));
  };

  const addToQuote = (item) => {
    const newItem = { ...item, qty: item.qty || 1 };
    const next = [...quote, newItem];
    setQuote(next);
    syncToSupabase(next); // no-op if not logged in or no activeOrderId
    persistGuestQuote(next);
    showSnackbar(`${item.product.name} added to your order`, { label: 'View Order', onClick: () => navigate('quote') });
  };

  const removeFromQuote = (idx) => {
    const next = quote.filter((_, i) => i !== idx);
    setQuote(next);
    syncToSupabase(next);
    persistGuestQuote(next);
  };

  const updateItem = (idx, patch) => {
    const next = quote.map((it, i) => i === idx ? { ...it, ...patch } : it);
    setQuote(next);
    syncToSupabase(next);
    persistGuestQuote(next);
  };

  // Clear the local cart after a successful order submission so the empty
  // Order Summary / Review pages don't let the same order be resubmitted.
  const clearQuote = () => {
    setQuote([]);
    localStorage.removeItem(GUEST_QUOTE_KEY);
  };

  // Wrap signInWithGoogle to save guest quote before the OAuth page redirect wipes state.
  const handleSignIn = () => {
    if (quoteRef.current.length > 0) {
      localStorage.setItem(GUEST_QUOTE_KEY, JSON.stringify(quoteRef.current.map(serializeItem)));
    }
    signInWithGoogle();
  };

  // Accepts a route name ("products"), or a path ("/products/roller").
  const navigate = (r) => {
    const target = r.startsWith('/') ? r : pathFor(r);
    if (target !== window.location.pathname) window.history.pushState({}, '', target);
    setPath(target);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const openOrder = (orderId) => {
    setActiveOrderId(orderId);
    navigate("quote");
  };

  if (route === "admin") {
    return (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    );
  }

  const q = quote.length;
  const authProps = { supabaseEnabled, user, signInWithGoogle: handleSignIn, signOut, orders, authLoading };

  return (
    <div>
      <Nav route={route === 'line' ? 'products' : route} navigate={navigate} quoteCount={q} {...authProps} />
      {snackbar && (
        <div className="snackbar">
          <span>{snackbar.msg}</span>
          {snackbar.action && (
            <button className="snackbar-action" onClick={() => { snackbar.action.onClick(); setSnackbar(null); }}>
              {snackbar.action.label}
            </button>
          )}
        </div>
      )}
      <main id="main">
      {route === "home"     && <HomePage navigate={navigate} quoteCount={q} />}
      {route === "products" && <ProductsPage navigate={navigate} location={productLocation} setLocation={setProductLocation} quoteCount={q} />}
      {route === "line"     && (
        <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
          <LinePage key={slug} slug={slug} navigate={navigate} addToQuote={addToQuote} />
        </Suspense>
      )}
      {route === "measure"  && <MeasureGuidePage navigate={navigate} quoteCount={q} />}
      {(route === "quote" || route === "review") && <Suspense fallback={<div className="page-loading" aria-busy="true" />}><OrderPage navigate={navigate} quoteItems={quote} removeFromQuote={removeFromQuote} updateItem={updateItem} activeOrderId={activeOrderId} onOrderSent={handleOrderSent} onSubmitted={clearQuote} user={user} /></Suspense>}
      {route === "orders"   && <OrdersPage navigate={navigate} orders={orders} activeOrderId={activeOrderId} openOrder={openOrder} createOrder={createOrder} renameOrder={renameOrder} deleteOrder={deleteOrder} user={user} signOut={signOut} signInWithGoogle={handleSignIn} supabaseEnabled={supabaseEnabled} quoteCount={q} ordersLength={orders.length} dbError={dbError} />}
      {route === "profile"  && <ProfilePage navigate={navigate} user={user} authLoading={authLoading} signInWithGoogle={handleSignIn} supabaseEnabled={supabaseEnabled} />}
      {route === "contact"  && <ContactPage navigate={navigate} quoteCount={q} />}
      </main>
    </div>
  );
}
