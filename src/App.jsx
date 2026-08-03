import { useState, useEffect, useCallback } from 'react';
import { Nav, HomePage, ProductsPage, QuotePage, ContactPage, MeasureGuidePage, OrdersPage } from './customer.jsx';
import { useAuth } from './lib/useAuth.js';
import { reconstructItem, serializeItem } from './lib/orders.js';
import {
  AdminGate, AdminShell, AdminDashboard, AdminProducts,
  AdminPricing, AdminMechanisms, AdminSuppliers, AdminInbox, AdminSettings,
} from './admin.jsx';

export default function App() {
  const [mode, setMode]               = useState("customer");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [route, setRoute]             = useState("home");
  const [adminPage, setAdminPage]     = useState("dashboard");
  const [openSlat, setOpenSlat]       = useState(null);
  const [productLocation, setProductLocation] = useState(null);
  const [quote, setQuote]             = useState([]);
  const [toast, setToast]             = useState(null);
  const [guestSaved, setGuestSaved]   = useState(false);

  const {
    supabaseEnabled,
    user, orders, activeOrder, activeOrderId, setActiveOrderId,
    authLoading, signInWithGoogle, signOut,
    createOrder, saveItems, renameOrder, markOrderSent, deleteOrder,
  } = useAuth();

  // Load items when switching to a different order. Intentionally does NOT
  // depend on `user` — logging in must not clear the local quote state.
  useEffect(() => {
    if (!activeOrderId || !activeOrder) return;
    setQuote(activeOrder.items.map(reconstructItem).filter(Boolean));
  }, [activeOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // On first login: if there are guest items and no existing orders, save them.
  useEffect(() => {
    if (!user || authLoading || guestSaved) return;
    setGuestSaved(true);
    if (!activeOrderId && quote.length > 0) {
      createOrder('My First Order', quote.map(serializeItem));
    }
  }, [user?.id, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncToSupabase = useCallback((items) => {
    if (user && activeOrderId) saveItems(activeOrderId, items);
  }, [user, activeOrderId, saveItems]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const addToQuote = (item) => {
    const newItem = { ...item, qty: item.qty || 1 };
    const next = [...quote, newItem];
    setQuote(next); // always update local state immediately

    if (user) {
      if (activeOrderId) {
        syncToSupabase(next);
      } else {
        // No order yet — create one with everything accumulated so far
        const name = `Order ${orders.length + 1}`;
        createOrder(name, next.map(serializeItem));
      }
    }
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

  const authProps = { supabaseEnabled, user, signInWithGoogle, signOut, orders, authLoading };

  return (
    <div>
      <Nav route={route} navigate={navigate} onAdmin={goAdmin} quoteCount={quote.length} {...authProps} />
      {toast && <div className="toast">✓ {toast}</div>}
      {route === "home"     && <HomePage navigate={navigate} goToProduct={goToProduct} />}
      {route === "products" && <ProductsPage navigate={navigate} openSlat={openSlat} setOpenSlat={setOpenSlat} addToQuote={addToQuote} location={productLocation} setLocation={setProductLocation} />}
      {route === "measure"  && <MeasureGuidePage navigate={navigate} />}
      {route === "quote"    && <QuotePage navigate={navigate} quoteItems={quote} removeFromQuote={removeFromQuote} updateQty={updateQty} updateRoomLabel={updateRoomLabel} activeOrder={activeOrder} activeOrderId={activeOrderId} user={user} onOrderSent={markOrderSent} />}
      {route === "orders"   && <OrdersPage navigate={navigate} orders={orders} activeOrderId={activeOrderId} openOrder={openOrder} createOrder={createOrder} renameOrder={renameOrder} deleteOrder={deleteOrder} user={user} signOut={signOut} signInWithGoogle={signInWithGoogle} supabaseEnabled={supabaseEnabled} quoteCount={quote.length} ordersLength={orders.length} />}
      {route === "contact"  && <ContactPage navigate={navigate} />}
    </div>
  );
}
