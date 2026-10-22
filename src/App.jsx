import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Nav, HomePage, ProductsPage, ContactPage, MeasureGuidePage, OrdersPage, ProfilePage } from './customer.jsx';
import { useAuth } from './lib/useAuth.js';
import { reconstructItem, serializeItem, newItemId } from './lib/orders.js';
import { CartContext, sameItem } from './lib/cart.js';
import { useIncomplete, clearDraft, clearAllDrafts } from './lib/drafts.js';
import { setCredentialHandler, promptOneTap, cancelOneTap, forgetGoogle, googleEnabled } from './lib/google.js';
import { supabase } from './lib/supabase.js';
import { clampQty } from './lib/limits.js';
import { getActiveLine } from './data/lines.js';
import { useItemPrices, totalsOf } from './lib/itemPrice.js';
import { editPath } from './lib/itemView.js';
import { OrderPanel, OrderOnlyBar, AddedPopup, IncompleteNote } from './components/OrderBar.jsx';
import ExitPrompt from './components/ExitPrompt.jsx';
import { useMissingNames } from './lib/selection.js';
import { resolvePath, routeFor, pathFor } from './lib/router.js';
import { metaFor, applyMeta } from './lib/pageMeta.js';
import PHOTOS from './data/sitePhotos.json';

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
  const [search, setSearch] = useState(() => window.location.search);       // e.g. ?edit=<item id>
  useEffect(() => {
    const onPop = () => {
      const r = resolvePath(window.location.pathname);
      if (r.redirect) window.history.replaceState({}, '', r.redirect);
      setPath(r.redirect || window.location.pathname);
      setSearch(r.redirect ? '' : window.location.search);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const { route, slug } = routeFor(path);
  // each page has its own title, description, share picture and product data (the same ones the build puts in the HTML)
  useEffect(() => { applyMeta(metaFor(route, slug, PHOTOS)); }, [route, slug]);
  const [productLocation, setProductLocation] = useState(null);
  const [quote, setQuote]         = useState(() => {
    // On page load (which happens after OAuth redirect), restore guest items from localStorage.
    try {
      const saved = localStorage.getItem(GUEST_QUOTE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const items = parsed.map((st, i) => reconstructItem(st, i)).filter(Boolean);
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
    authLoading, signInWithGoogle, signInWithIdToken, signOut, dbError,
    createOrder, saveItems, renameOrder, markOrderSent, deleteOrder,
  } = useAuth();

  // Show DB errors as snackbars so we can see what's going wrong.
  useEffect(() => {
    if (dbError) showSnackbar(`⚠ ${dbError}`);
  }, [dbError]);

  // Once logged in and order is ready, clear the guest localStorage backup and
  // migrate any guest items into the active order if the order is currently empty.
  const [synced, setSynced] = useState(false);          // the saved order's items have been loaded into the cart
  useEffect(() => {
    if (!activeOrderId || !activeOrder) return;
    setSynced(true);
    const dbItems = activeOrder.items.map((st, i) => reconstructItem(st, i)).filter(Boolean);
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
  const handleOrderSent = async (orderId, items, customer) => { await markOrderSent(orderId, items, customer); setJustSent(true); };
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

  const [flash, setFlash] = useState(null);                      // { msg, n }: "Added to your order" for a moment
  const [panelOpen, setPanelOpen] = useState(false);
  const flashTimer = useRef(null);
  const showFlash = (msg) => {
    clearTimeout(flashTimer.current);
    setFlash({ msg, n: Date.now() });
    flashTimer.current = setTimeout(() => setFlash(null), 2400);
  };

  // the order in other tabs of this browser follows this one (same account, same order)
  const userIdRef = useRef(null); const orderIdRef = useRef(null);
  userIdRef.current = user?.id || null; orderIdRef.current = activeOrderId || null;
  const channel = useRef(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const c = new BroadcastChannel('lb-cart');
    channel.current = c;
    c.onmessage = (e) => {
      const m = e.data;
      if (m?.type !== 'cart' || (m.userId || null) !== userIdRef.current || (m.orderId || null) !== orderIdRef.current) return;
      setQuote(m.items.map((st, i) => reconstructItem(st, i)).filter(Boolean));     // shown only: the other tab already saved it
    };
    return () => { c.close(); channel.current = null; };
  }, []);
  const broadcast = (items) => { try { channel.current?.postMessage({ type: 'cart', userId: userIdRef.current, orderId: orderIdRef.current, items: items.map(serializeItem) }); } catch { /* ignore */ } };

  const commit = (next) => { setQuote(next); syncToSupabase(next); persistGuestQuote(next); broadcast(next); };   // no-op saves when not logged in / no order yet

  // The same product, options, size and room already in the cart: its quantity goes up. Anything different is a new line.
  const [added, setAdded] = useState(null);                  // the "Added to your cart" popup: { title, qty, merged, n }
  const addToQuote = (item) => {
    const same = quote.find((it) => sameItem(it, item));
    const add = item.qty || 1;
    let result;
    if (same) {
      const qty = Math.min(99, clampQty(same.qty) + add);
      commit(quote.map((it) => (it.id === same.id ? { ...it, qty } : it)));
      result = { merged: true, qty };
    } else {
      commit([...quote, { ...item, id: item.id || newItemId(), qty: add }]);
      result = { merged: false, qty: add };
    }
    setAdded({ title: item.variant || item.product.name, ...result, n: Date.now() });
    return result;
  };
  const setQty = (id, qty) => commit(quote.map((it) => (it.id === id ? { ...it, qty: clampQty(qty) } : it)));
  const saveItem = (id, item) => {
    commit(quote.map((it) => (it.id === id ? { ...it, ...item, id } : it)));
    showFlash('Changes saved');
  };
  const removeItem = (id) => commit(quote.filter((it) => it.id !== id));
  // a copy right after the original, opened for editing so only the size or room needs changing
  const duplicateItem = (it) => {
    const copy = { ...it, id: newItemId() };
    const at = quote.findIndex((x) => x.id === it.id);
    commit([...quote.slice(0, at + 1), copy, ...quote.slice(at + 1)]);
    showFlash('Item duplicated. Change what is different, then save.');
    navigate(editPath(copy));
  };
  const removeFromQuote = (idx) => commit(quote.filter((_, i) => i !== idx));
  const updateItem = (idx, patch) => commit(quote.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  // Clear the local cart after a successful order submission so the empty
  // Order Summary / Review pages don't let the same order be resubmitted.
  // Signing out ends the session: the order in progress belongs to the account that was signed in, so it leaves the screen
  // (it stays saved in that account). This also covers a session that ends on its own or in another tab.
  const prevUserId = useRef(null);
  useEffect(() => {
    const id = user?.id || null;
    if (prevUserId.current && !id) {
      setQuote([]);
      localStorage.removeItem(GUEST_QUOTE_KEY);
      setSynced(false);
      setPanelOpen(false);
      forgetGoogle();
    }
    prevUserId.current = id;
  }, [user]);   // eslint-disable-line react-hooks/exhaustive-deps

  const clearQuote = () => {
    setQuote([]);
    broadcast([]);
    localStorage.removeItem(GUEST_QUOTE_KEY);
    clearAllDrafts();                       // a sent order leaves nothing half finished behind
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
    const full = r.startsWith('/') ? r : pathFor(r);
    const [target, query = ''] = full.split('?');
    const nextSearch = query ? `?${query}` : '';
    if (target !== window.location.pathname || nextSearch !== window.location.search) window.history.pushState({}, '', target + nextSearch);
    setPath(target);
    setSearch(nextSearch);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // A draft opens for editing. A sent order opens to look at, never to change.
  const openOrder = (orderId) => {
    if (orders.find(o => o.id === orderId)?.status === 'sent') { navigate(`/orders?view=${orderId}`); return; }
    setActiveOrderId(orderId);
    navigate("quote");
  };

  // "Order again": the items of a sent order are copied into a new draft, which becomes the order in progress.
  const orderAgain = async (order) => {
    const copies = (order.items || []).map((it) => ({ ...it, id: newItemId() }));
    const draft = await createOrder(`Order ${orders.length + 1}`, copies);
    if (draft) navigate('quote');
  };

  // Product pages left part way stay in the cart as incomplete items (the page open right now is not one of them)
  const editIdNow = route === 'line' ? new URLSearchParams(search).get('edit') : null;
  const openLine = route === 'line' && !editIdNow ? getActiveLine(slug)?.id || null : null;
  const incomplete = useIncomplete(openLine);
  const removeIncomplete = (entry) => clearDraft(entry.lineId);
  const goIncomplete = (entry) => { setPanelOpen(false); navigate(`/products/${entry.product.slug}`); };
  const [note, setNote] = useState(null);                       // the small note that tells them about an incomplete item
  const notedRef = useRef(new Set((() => { try { return JSON.parse(sessionStorage.getItem('lb_noted') || '[]'); } catch { return []; } })()));
  useEffect(() => {
    const fresh = incomplete.filter((e) => !notedRef.current.has(e.key));
    if (!fresh.length || route === 'admin') return;
    fresh.forEach((e) => notedRef.current.add(e.key));
    try { sessionStorage.setItem('lb_noted', JSON.stringify([...notedRef.current])); } catch { /* ignore */ }
    setNote({ title: fresh[0].title, n: Date.now() });
  }, [incomplete]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (incomplete.length === 0) setNote(null); }, [incomplete.length]);

  // Google: One Tap for a signed-out visitor, and the credential Google hands back becomes the Supabase session
  useEffect(() => {
    setCredentialHandler(async (credential, nonce) => {
      if (quoteRef.current.length > 0) localStorage.setItem(GUEST_QUOTE_KEY, JSON.stringify(quoteRef.current.map(serializeItem)));
      const err = await signInWithIdToken(credential, nonce);
      if (err) { console.error('[google sign-in]', err); showSnackbar('Sign-in with Google did not work the quick way. Trying another way…'); handleSignIn(); }
    });
  });
  useEffect(() => {
    if (!supabaseEnabled || user || authLoading || !googleEnabled || route === 'admin') return undefined;
    promptOneTap();
    return () => cancelOneTap();
  }, [supabaseEnabled, user, authLoading, route]);

  // Checkout: straight to the details step, unless something is still incomplete (then the cart page explains)
  const goCheckout = () => { setPanelOpen(false); setAdded(null); navigate(incomplete.length ? '/order' : '/order?checkout=1'); };

  // the cart, shared with the cart bar, the cart panel, the product pages and the cart page
  const prices = useItemPrices(quote);
  const totals = totalsOf(quote, prices);
  const cart = {
    items: quote, prices, totals, ready: !authLoading && (!user || synced || !!dbError),
    addItem: addToQuote, saveItem, removeItem, setQty, duplicateItem, flash, showFlash, panelOpen, setPanelOpen,
    goEdit: (it) => navigate(editPath(it)),
    incomplete, removeIncomplete, goIncomplete, count: quote.length + incomplete.length, goCheckout,
    added, closeAdded: () => setAdded(null),
    auth: { user, supabaseEnabled, authLoading, signIn: handleSignIn },
  };

  if (route === "admin") {
    return (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    );
  }

  const q = quote.length + incomplete.length;
  const authProps = { supabaseEnabled, user, signInWithGoogle: handleSignIn, signOut, orders, authLoading };

  const onLinePage = route === "line";
  const onOrderPage = route === "quote" || route === "review";
  const editId = editIdNow;

  return (
    <CartContext.Provider value={cart}>
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
          <LinePage key={slug} slug={slug} navigate={navigate} editId={editId} />
        </Suspense>
      )}
      {route === "measure"  && <MeasureGuidePage navigate={navigate} quoteCount={q} />}
      {onOrderPage && <Suspense fallback={<div className="page-loading" aria-busy="true" />}><OrderPage search={search} navigate={navigate} activeOrderId={activeOrderId} onOrderSent={handleOrderSent} onSubmitted={clearQuote} user={user} /></Suspense>}
      {route === "orders"   && <OrdersPage viewId={new URLSearchParams(search).get('view')} orderAgain={orderAgain} navigate={navigate} orders={orders} activeOrderId={activeOrderId} openOrder={openOrder} createOrder={createOrder} renameOrder={renameOrder} deleteOrder={deleteOrder} user={user} signOut={signOut} signInWithGoogle={handleSignIn} supabaseEnabled={supabaseEnabled} quoteCount={q} ordersLength={orders.length} dbError={dbError} />}
      {route === "profile"  && <ProfilePage navigate={navigate} user={user} authLoading={authLoading} signInWithGoogle={handleSignIn} supabaseEnabled={supabaseEnabled} />}
      {route === "contact"  && <ContactPage navigate={navigate} quoteCount={q} />}
      </main>
      {/* product pages have their own bar (the item being built plus the order); the other customer pages get the order part alone, never on the order page */}
      {!onLinePage && !onOrderPage && <OrderOnlyBar />}
      <OrderPanel navigate={navigate} />
      {!onOrderPage && <AddedPopup navigate={navigate} />}
      {!onLinePage && !onOrderPage && <IncompleteNote note={note} onClose={() => setNote(null)} />}
      <ExitPrompt route={route} />
    </div>
    </CartContext.Provider>
  );
}
