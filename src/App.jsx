import { useState, useEffect, useRef, useCallback } from 'react';
import { Nav, HomePage, ProductsPage, OrderSummaryPage, ReviewOrderPage, ContactPage, MeasureGuidePage, OrdersPage } from './customer.jsx';
import { useAuth } from './lib/useAuth.js';
import { reconstructItem, serializeItem } from './lib/orders.js';
import {
  AdminGate, AdminShell, AdminDashboard, AdminProducts,
  AdminPricing, AdminMechanisms, AdminSuppliers, AdminInbox, AdminSettings,
} from './admin.jsx';

const GUEST_QUOTE_KEY = 'lb_guest_quote';

export default function App() {
  const [mode, setMode]           = useState("customer");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [route, setRoute]         = useState("home");
  const [adminPage, setAdminPage] = useState("dashboard");
  const [openSlat, setOpenSlat]   = useState(null);
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

  const navigate = (r) => {
    setRoute(r);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const goToProduct = (product) => {
    setProductLocation(product.location);
    setOpenSlat(product.id);
    setRoute("products");
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.querySelector(`[data-product-id="${product.id}"]`);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 96;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }, 60);
    });
  };

  const openOrder = (orderId) => {
    setActiveOrderId(orderId);
    navigate("quote");
  };

  const goAdmin = () => { setMode("admin"); window.scrollTo({ top: 0, behavior: "instant" }); };
  const exitAdmin = () => { setMode("customer"); navigate("home"); };

  if (mode === "admin") {
    if (!adminUnlocked) return <AdminGate onUnlock={() => setAdminUnlocked(true)} />;
    return (
      <AdminShell page={adminPage} setPage={setAdminPage} onExit={exitAdmin}>
        {adminPage === "dashboard"  && <AdminDashboard />}
        {adminPage === "products"   && <AdminProducts />}
        {adminPage === "pricing"    && <AdminPricing />}
        {adminPage === "mechanisms" && <AdminMechanisms />}
        {adminPage === "suppliers"  && <AdminSuppliers />}
        {adminPage === "inbox"      && <AdminInbox />}
        {adminPage === "settings"   && <AdminSettings />}
      </AdminShell>
    );
  }

  const q = quote.length;
  const authProps = { supabaseEnabled, user, signInWithGoogle: handleSignIn, signOut, orders, authLoading };

  return (
    <div>
      <Nav route={route} navigate={navigate} onAdmin={goAdmin} quoteCount={q} {...authProps} />
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
      {route === "home"     && <HomePage navigate={navigate} goToProduct={goToProduct} quoteCount={q} />}
      {route === "products" && <ProductsPage navigate={navigate} openSlat={openSlat} setOpenSlat={setOpenSlat} addToQuote={addToQuote} location={productLocation} setLocation={setProductLocation} quoteCount={q} />}
      {route === "measure"  && <MeasureGuidePage navigate={navigate} quoteCount={q} />}
      {route === "quote"    && <OrderSummaryPage navigate={navigate} quoteItems={quote} removeFromQuote={removeFromQuote} updateItem={updateItem} activeOrder={activeOrder} user={user} />}
      {route === "review"   && <ReviewOrderPage navigate={navigate} quoteItems={quote} activeOrderId={activeOrderId} onOrderSent={markOrderSent} onSubmitted={clearQuote} />}
      {route === "orders"   && <OrdersPage navigate={navigate} orders={orders} activeOrderId={activeOrderId} openOrder={openOrder} createOrder={createOrder} renameOrder={renameOrder} deleteOrder={deleteOrder} user={user} signOut={signOut} signInWithGoogle={handleSignIn} supabaseEnabled={supabaseEnabled} quoteCount={q} ordersLength={orders.length} dbError={dbError} />}
      {route === "contact"  && <ContactPage navigate={navigate} quoteCount={q} />}
    </div>
  );
}
