import { useState } from 'react';
import { Nav, HomePage, ProductsPage, QuotePage, ContactPage, MeasureGuidePage } from './customer.jsx';
import {
  AdminGate, AdminShell, AdminDashboard, AdminProducts,
  AdminPricing, AdminMechanisms, AdminSuppliers, AdminInbox, AdminSettings,
} from './admin.jsx';

export default function App() {
  const [mode, setMode] = useState("customer");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [route, setRoute] = useState("home");
  const [adminPage, setAdminPage] = useState("dashboard");
  const [openSlat, setOpenSlat] = useState(null);
  const [productLocation, setProductLocation] = useState(null);
  const [quote, setQuote] = useState([]);
  const [toast, setToast] = useState(null);

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

  const addToQuote = (item) => {
    setQuote(q => [...q, { ...item, qty: item.qty || 1 }]);
    setToast(item.product.name);
    setTimeout(() => setToast(null), 2500);
  };
  const removeFromQuote = (idx) => setQuote(q => q.filter((_, i) => i !== idx));
  const updateQty = (idx, qty) => setQuote(q => q.map((it, i) => i === idx ? { ...it, qty } : it));
  const updateRoomLabel = (idx, label) => setQuote(q => q.map((it, i) => i === idx ? { ...it, roomLabel: label } : it));

  const goAdmin = () => {
    setMode("admin");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const exitAdmin = () => {
    setMode("customer");
    navigate("home");
  };

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

  return (
    <div>
      <Nav route={route} navigate={navigate} onAdmin={goAdmin} quoteCount={quote.length} />
      {toast && <div className="toast">✓ {toast} added to your order</div>}
      {route === "home"     && <HomePage navigate={navigate} goToProduct={goToProduct} />}
      {route === "products" && <ProductsPage navigate={navigate} openSlat={openSlat} setOpenSlat={setOpenSlat} addToQuote={addToQuote} location={productLocation} setLocation={setProductLocation} />}
      {route === "measure"  && <MeasureGuidePage navigate={navigate} />}
      {route === "quote"    && <QuotePage navigate={navigate} quoteItems={quote} removeFromQuote={removeFromQuote} updateQty={updateQty} updateRoomLabel={updateRoomLabel} />}
      {route === "contact"  && <ContactPage navigate={navigate} />}
    </div>
  );
}
