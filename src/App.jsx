import { useState, useEffect, useRef, useCallback } from 'react';
import { Nav, HomePage, ProductsPage, QuotePage, ContactPage, MeasureGuidePage, OrdersPage } from './customer.jsx';
import { useAuth } from './lib/useAuth.js';
import { reconstructItem, serializeItem } from './lib/orders.js';
import {
  AdminGate, AdminShell, AdminDashboard, AdminProducts,
  AdminPricing, AdminMechanisms, AdminSuppliers, AdminInbox, AdminSettings,
} from './admin.jsx';

export default function App() {
  const [mode, setMode]           = useState("customer");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [route, setRoute]         = useState("home");
  const [adminPage, setAdminPage] = useState("dashboard");
  const [openSlat, setOpenSlat]   = useState(null);
  const [productLocation, setProductLocation] = useState(null);
  const [quote, setQuote]         = useState([]);
  const [toast, setToast]         = useState(null);
  const quoteRef = useRef(quote);
  useEffect(() => { quoteRef.current = quote; });

  const {
    supabaseEnabled,
    user, orders, activeOrder, activeOrderId, setActiveOrderId,
    authLoading, signInWithGoogle, signOut, dbError,
    createOrder, saveItems, renameOrder, markOrderSent, deleteOrder,
  } = useAuth();

  // Show DB errors as toasts so we can see what's going wrong.
  useEffect(() => {
    if (dbError) showToast(`⚠ ${dbError}`);
  }, [dbError]);

  // When switching to an existing order, load its items from DB.
  // If the DB order is empty but we have local items (guest → login migration),
  // save the local items into this order instead of clearing them.
  useEffect(() => {
    if (!activeOrderId || !activeOrder) return;
    const dbItems = activeOrder.items.map(reconstructItem).filter(Boolean);
    if (dbItems.length > 0) {
      setQuote(dbItems);
    } else if (quoteRef.current.length > 0) {
      // New empty order, but we have guest items locally — push them up.
      saveItems(activeOrderId, quoteRef.current);
      // Leave quote as-is (already has the items).
    }
    // Both empty → leave quote alone.
  }, [activeOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncToSupabase = useCallback((items) => {
    if (user && activeOrderId) saveItems(activeOrderId, items);
  }, [user, activeOrderId, saveItems]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const addToQuote = (item) => {
    const newItem = { ...item, qty: item.qty || 1 };
    const next = [...quote, newItem];
    setQuote(next);
    syncToSupabase(next); // no-op if not logged in or no activeOrderId
    showToast(`${item.product.name} added to your order`);
  };

  const removeFromQuote = (idx) => {
    const next = quote.filter((_, i) => i !== idx);
    setQuote(next);
    syncToSupabase(next);
  };

  const updateQty = (idx, qty) => {
    const next = quote.map((it, i) => i === idx ? { ...it, qty } : it);
    setQuote(next);
    syncToSupabase(next);
  };

  const updateRoomLabel = (idx, label) => {
    const next = quote.map((it, i) => i === idx ? { ...it, roomLabel: label } : it);
    setQuote(next);
    syncToSupabase(next);
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
  const authProps = { supabaseEnabled, user, signInWithGoogle, signOut, orders, authLoading };

  return (
    <div>
      <Nav route={route} navigate={navigate} onAdmin={goAdmin} quoteCount={q} {...authProps} />
      {toast && <div className="toast">{toast}</div>}
      {route === "home"     && <HomePage navigate={navigate} goToProduct={goToProduct} quoteCount={q} />}
      {route === "products" && <ProductsPage navigate={navigate} openSlat={openSlat} setOpenSlat={setOpenSlat} addToQuote={addToQuote} location={productLocation} setLocation={setProductLocation} quoteCount={q} />}
      {route === "measure"  && <MeasureGuidePage navigate={navigate} quoteCount={q} />}
      {route === "quote"    && <QuotePage navigate={navigate} quoteItems={quote} removeFromQuote={removeFromQuote} updateQty={updateQty} updateRoomLabel={updateRoomLabel} activeOrder={activeOrder} activeOrderId={activeOrderId} user={user} onOrderSent={markOrderSent} />}
      {route === "orders"   && <OrdersPage navigate={navigate} orders={orders} activeOrderId={activeOrderId} openOrder={openOrder} createOrder={createOrder} renameOrder={renameOrder} deleteOrder={deleteOrder} user={user} signOut={signOut} signInWithGoogle={signInWithGoogle} supabaseEnabled={supabaseEnabled} quoteCount={q} ordersLength={orders.length} />}
      {route === "contact"  && <ContactPage navigate={navigate} quoteCount={q} />}
    </div>
  );
}
