// Root app shell — routes between customer site and admin portal

const { useState: useStateApp, useEffect: useEffectApp } = React;

function App() {
  const [mode, setMode] = useStateApp("customer"); // 'customer' | 'admin'
  const [adminUnlocked, setAdminUnlocked] = useStateApp(false);
  const [route, setRoute] = useStateApp("home"); // home | products | quote | contact
  const [adminPage, setAdminPage] = useStateApp("dashboard");
  const [openSlat, setOpenSlat] = useStateApp(null);
  const [productLocation, setProductLocation] = useStateApp(null); // 'indoor' | 'outdoor' | null
  const [quote, setQuote] = useStateApp([]);

  const navigate = (r) => {
    setRoute(r);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // Jump straight from a featured card to its slat in the catalog
  const goToProduct = (product) => {
    setProductLocation(product.location);
    setOpenSlat(product.id);
    setRoute("products");
    window.scrollTo({ top: 0, behavior: "instant" });
    // After the products page mounts, scroll the open slat into view
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
  };
  const removeFromQuote = (idx) => setQuote(q => q.filter((_, i) => i !== idx));
  const updateQty = (idx, qty) => setQuote(q => q.map((it, i) => i === idx ? { ...it, qty } : it));

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
      <Nav route={route} navigate={navigate} onAdmin={goAdmin} />
      {route === "home"     && <HomePage navigate={navigate} goToProduct={goToProduct} />}
      {route === "products" && <ProductsPage navigate={navigate} openSlat={openSlat} setOpenSlat={setOpenSlat} addToQuote={addToQuote} location={productLocation} setLocation={setProductLocation} />}
      {route === "measure"  && <MeasureGuidePage navigate={navigate} />}
      {route === "quote"    && <QuotePage navigate={navigate} quoteItems={quote} addToQuote={addToQuote} removeFromQuote={removeFromQuote} updateQty={updateQty} />}
      {route === "contact"  && <ContactPage navigate={navigate} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
