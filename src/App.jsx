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
    createOrder, saveItems, renameOrder, deleteOrder,
  } = useAuth();

  // When the active order changes, load its items into local quote state.
  useEffect(() => {
    if (!user) return;
    if (activeOrder) {
      setQuote(activeOrder.items.map(reconstructItem).filter(Boolean));
    } else {
      setQuote([]);
    }
  }, [activeOrderId, user]);

  // When a guest logs in with items in their cart, save them as a new order.
  useEffect(() => {
    if (!user || authLoading || guestSaved) return;
    if (orders.length === 0 && quote.length > 0) {
      setGuestSaved(true);
      createOrder('My First Order', quote.map(serializeItem));
    }
  }, [user?.id, authLoading]);

  const syncToSupabase = useCallback((items) => {
    if (user && activeOrderId) saveItems(activeOrderId, items);
  }, [user, activeOrderId, saveItems]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const addToQuote = (item) => {
    const newItem = { ...item, qty: item.qty || 1 };
    if (user && !activeOrderId) {
      // First item while logged in — create an order on the fly.
      createOrder('New Order', [serializeItem(newItem)]);
    } else {
      setQuote(q => {
        const next = [...q, newItem];
        syncToSupabase(next);
        return next;
      });
    }
    showToast(`${item.product.name} added to your order`);
  };

  const removeFromQuote = (idx) => setQuote(q => {
    const next = q.filter((_, i) => i !== idx);
    syncToSupabase(next);
    return next;
  });

  const updateQty = (idx, qty) => setQuote(q => {
    const next = q.map((it, i) => i === idx ? { ...it, qty } : it);
    syncToSupabase(next);
    return next;
  });

  const updateRoomLabel = (idx, label) => setQuote(q => {
    const next = q.map((it, i) => i === idx ? { ...it, roomLabel: label } : it);
    syncToSupabase(next);
    return next;
  });

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
      {route === "quote"    && <QuotePage navigate={navigate} quoteItems={quote} removeFromQuote={removeFromQuote} updateQty={updateQty} updateRoomLabel={updateRoomLabel} activeOrder={activeOrder} user={user} />}
      {route === "orders"   && <OrdersPage navigate={navigate} orders={orders} activeOrderId={activeOrderId} openOrder={openOrder} createOrder={createOrder} renameOrder={renameOrder} deleteOrder={deleteOrder} user={user} signOut={signOut} signInWithGoogle={signInWithGoogle} supabaseEnabled={supabaseEnabled} />}
      {route === "contact"  && <ContactPage navigate={navigate} />}
    </div>
  );
}
