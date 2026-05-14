import { useState } from 'react';
import {
  PRODUCTS, MOUNTS, SETTINGS, ADDON_UPCHARGES,
  productsByLocation, getMechanism, hasPhotoForCombo,
} from './data.js';
import { CATEGORY_ICONS, ArrowRight, ChevDown, XIcon } from './icons.jsx';

export function Nav({ route, navigate, onAdmin }) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <button className="wordmark" onClick={() => navigate("home")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <span className="w-loves">Love's</span><span className="w-blinds">Blinds</span>
        </button>
        <div className="nav-links">
          <button className={`nav-link ${route === "home" ? "active" : ""}`} onClick={() => navigate("home")}>Home</button>
          <button className={`nav-link ${route === "products" ? "active" : ""}`} onClick={() => navigate("products")}>Products</button>
          <button className={`nav-link ${route === "measure" ? "active" : ""}`} onClick={() => navigate("measure")}>Measure Guide</button>
          <button className={`nav-link ${route === "quote" ? "active" : ""}`} onClick={() => navigate("quote")}>Get a Quote</button>
          <button className={`nav-link ${route === "contact" ? "active" : ""}`} onClick={() => navigate("contact")}>Contact</button>
        </div>
        <button className="btn btn-sage btn-sm" onClick={() => navigate("quote")} style={{ marginRight: 18 }}>Start Quote</button>
        <button className="nav-admin" onClick={onAdmin}>Admin</button>
      </div>
    </nav>
  );
}

export function Footer({ navigate }) {
  return (
    <footer>
      <div className="footer-cta">
        <div className="footer-cta-inner">
          <h2 className="serif">Ready to dress your windows?</h2>
          <button className="btn btn-outline-light" onClick={() => navigate("quote")}>Get an Estimate <ArrowRight /></button>
        </div>
      </div>
      <div className="footer">
        <div className="footer-grid">
          <div>
            <div className="footer-wordmark"><em>Love's</em> Blinds</div>
            <p className="footer-tag">Custom window treatments, measured and installed by a small studio that takes the time to get it right.</p>
          </div>
          <div>
            <h4>Studio</h4>
            <ul>
              <li>2104 Cedar Ave</li>
              <li>Asheville, NC 28801</li>
              <li>{SETTINGS.phone}</li>
              <li>{SETTINGS.email}</li>
            </ul>
          </div>
          <div>
            <h4>Hours</h4>
            <ul>
              <li>Mon–Fri · 9–6</li>
              <li>Sat · 10–4</li>
              <li>Sun · By appointment</li>
            </ul>
          </div>
          <div>
            <h4>Browse</h4>
            <ul>
              <li><button className="nav-link" style={{ padding: 0, fontSize: 13, letterSpacing: 0 }} onClick={() => navigate("products")}>All Products</button></li>
              <li><button className="nav-link" style={{ padding: 0, fontSize: 13, letterSpacing: 0 }} onClick={() => navigate("measure")}>Measurement Guide</button></li>
              <li><button className="nav-link" style={{ padding: 0, fontSize: 13, letterSpacing: 0 }} onClick={() => navigate("quote")}>Estimator</button></li>
              <li><button className="nav-link" style={{ padding: 0, fontSize: 13, letterSpacing: 0 }} onClick={() => navigate("contact")}>Contact</button></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Love's Blinds Studio LLC</span>
          <span>Made-to-measure · Family run · Since 2014</span>
        </div>
      </div>
    </footer>
  );
}

export function PhotoPH({ label, sub, aspect, className = "", style = {} }) {
  return (
    <div className={`photo-ph ${className}`} style={{ aspectRatio: aspect, ...style }}>
      <div className="ph-label">{label}</div>
      {sub && <div className="ph-sub">{sub}</div>}
    </div>
  );
}

export function HomePage({ navigate, goToProduct }) {
  return (
    <div className="page-fade">
      <section className="hero">
        <div className="hero-inner">
          <div>
            <h1>Quiet rooms.<br /><em>Beautifully</em> dressed windows.</h1>
            <p className="hero-tag">Made-to-measure blinds, shades, shutters, and drapes — measured your way: in-home consult with us, or DIY with our step-by-step guide.</p>
            <div className="hero-ctas">
              <button className="btn btn-sand" onClick={() => navigate("products")} style={{ background: "var(--sand)", color: "var(--charcoal)" }}>Browse Products</button>
              <button className="btn btn-outline-light" onClick={() => navigate("quote")}>Get an Estimate <ArrowRight /></button>
            </div>
          </div>
          <div className="hero-aside" style={{ padding: "10px 0px 20px 40px" }}>
            <div className="hero-aside-eyebrow" style={{ fontSize: "10px" }}>Now booking</div>
            <div className="hero-aside-line"><span>Free in-home consult</span><span>48hr</span></div>
            <div className="hero-aside-line"><span>Self-measure guide</span><span>Online</span></div>
            <div className="hero-aside-line"><span>Custom roller shades</span><span>7–10d</span></div>
            <div className="hero-aside-line"><span>Plantation shutters</span><span>4–6w</span></div>
          </div>
        </div>
      </section>

      <section className="stats-strip">
        <div className="stats-inner">
          <div className="stat"><div className="stat-num">12+</div><div className="stat-label">Product Lines</div></div>
          <div className="stat"><div className="stat-num">48hr</div><div className="stat-label">Quote Turnaround</div></div>
          <div className="stat"><div className="stat-num">100%</div><div className="stat-label">Custom Fit</div></div>
          <div className="stat"><div className="stat-num">5 ★</div><div className="stat-label">Across 200+ Reviews</div></div>
        </div>
      </section>

      <section className="section container">
        <div className="section-eyebrow">How it works</div>
        <h2 className="section-title">Four unhurried steps from window to finished room.</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <h4 className="serif">Get an estimate</h4>
            <p>Tell us your windows. We send a written ballpark within 48 hours — no email harvesting, no upsell.</p>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <h4 className="serif">Measure your way</h4>
            <p>Book a free in-home consult and we'll measure, or <button className="link-inline" onClick={() => navigate("measure")}>follow our guide</button> and send the numbers yourself.</p>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <h4 className="serif">Made to measure</h4>
            <p>Your treatments are built by trusted mills and finishers. Most are ready within 2–3 weeks.</p>
          </div>
          <div className="step">
            <div className="step-num">04</div>
            <h4 className="serif">Install &amp; enjoy</h4>
            <p>We mount and tune the operation — or ship to your door if you'd rather DIY. Either way, we vacuum up after.</p>
          </div>
        </div>
      </section>

      <section className="section container" style={{ paddingTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 24 }}>
          <div>
            <div className="section-eyebrow">Featured</div>
            <h2 className="section-title">A few studio favourites.</h2>
          </div>
          <button className="btn btn-outline" onClick={() => navigate("products")}>See all products <ArrowRight /></button>
        </div>
        <div className="featured-grid">
          {PRODUCTS.filter(p => p.featured).slice(0, 3).map(p =>
            <article key={p.id}
                     className="feat-card feat-card-link"
                     role="link"
                     tabIndex={0}
                     onClick={() => goToProduct(p)}
                     onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToProduct(p); } }}
                     aria-label={`View ${p.name}`}>
              <PhotoPH label={`${p.name} · feature image`} sub="grey placeholder · drop hero photo" aspect="4 / 5" />
              <div className="feat-body">
                <div className="feat-cat">{p.location} · {p.lead}</div>
                <div className="feat-name">{p.name}</div>
                <div className="feat-desc">{p.description}</div>
                <div className="feat-cta">View product <ArrowRight size={14} /></div>
              </div>
            </article>
          )}
        </div>
      </section>

      <Footer navigate={navigate} />
    </div>
  );
}

export function ProductsPage({ navigate, openSlat, setOpenSlat, addToQuote, location, setLocation }) {
  const products = location ? productsByLocation(location) : [];

  return (
    <div className="page-fade">
      <section className="products-hero">
        <div className="container">
          <div className="section-eyebrow">Catalog</div>
          <h1 className="serif">Find the treatment that <em>fits</em> the room.</h1>
          <p className="section-sub">Start by choosing where the window lives. Then expand any category to configure variant, mechanism, and mount type — the preview updates as you go.</p>

          <div className="location-cards">
            <button className={`loc-card ${location === "indoor" ? "selected" : ""}`} onClick={() => { setLocation("indoor"); setOpenSlat(null); }}>
              <div className="loc-card-eyebrow">Step 1 — Location</div>
              <h3 className="serif">Indoor</h3>
              <div className="loc-card-desc">Blinds, shades, shutters, and drapery for inside the home — bedroom, living, kitchen, study.</div>
              <div className="loc-card-meta"><span><strong>8</strong> product lines</span><span>From 7-day lead</span></div>
              <div className="loc-browse">Browse indoor <ArrowRight size={14} /></div>
            </button>
            <button className={`loc-card ${location === "outdoor" ? "selected" : ""}`} onClick={() => { setLocation("outdoor"); setOpenSlat(null); }}>
              <div className="loc-card-eyebrow">Step 1 — Location</div>
              <h3 className="serif">Outdoor</h3>
              <div className="loc-card-desc">Weatherproof shades and screens for porches, patios, decks, and pergolas.</div>
              <div className="loc-card-meta"><span><strong>2</strong> product lines</span><span>From 5-day lead</span></div>
              <div className="loc-browse">Browse outdoor <ArrowRight size={14} /></div>
            </button>
          </div>
        </div>
      </section>

      {location &&
        <section className="container" style={{ paddingTop: 32, paddingBottom: 80 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
            <div className="section-eyebrow" style={{ marginBottom: 0 }}>Step 2 — Browse {location} catalog</div>
            <button className="nav-link" onClick={() => { setLocation(null); setOpenSlat(null); }} style={{ fontSize: 12 }}>← Change location</button>
          </div>
          <div className="slats">
            {products.map(p =>
              <SlatRow key={p.id} product={p}
                open={openSlat === p.id}
                onToggle={() => setOpenSlat(openSlat === p.id ? null : p.id)}
                onAddToQuote={addToQuote}
                onEstimate={() => navigate("quote")} />
            )}
          </div>
        </section>
      }

      <Footer navigate={navigate} />
    </div>
  );
}

function SlatRow({ product, open, onToggle, onAddToQuote, onEstimate }) {
  const Icon = CATEGORY_ICONS[product.category];
  const [variant, setVariant] = useState(product.variants[0]);
  const [mech, setMech] = useState(product.mechanisms[0].id);
  const [mount, setMount] = useState(product.mounts[0]);

  const mechObj = getMechanism(product, mech);
  const mountObj = MOUNTS.find(m => m.id === mount);
  const photoLabel = `${variant} · ${mechObj?.name} · ${mountObj?.name}`;
  const hasPhoto = hasPhotoForCombo(product.id, variant, mech, mount);

  const showPrice = product.baseCost > 0;
  const sqftPrice = product.baseCost / (1 - product.margin);
  const samplePrice = Math.round(sqftPrice * 18 + (mechObj?.upcharge || 0));

  return (
    <div className={`slat ${open ? "open" : ""}`} data-product-id={product.id}>
      <button className="slat-row" onClick={onToggle}>
        <div className="slat-icon"><Icon /></div>
        <div className="slat-name">{product.name}</div>
        <div className="slat-meta">
          {product.badge && <span className="badge badge-sage">{product.badge}</span>}
          <span>{product.variants.length} variants</span>
        </div>
        <div className="slat-chev"><ChevDown /></div>
      </button>
      <div className="slat-body">
        <div className="slat-body-inner">
          <div className="slat-body-content">
            <div className="slat-photo-wrap">
              <PhotoPH
                label={photoLabel}
                sub={hasPhoto ? "configuration photo" : "no photo for this combination yet"}
                className={hasPhoto ? "" : "empty"}
                aspect="4 / 5" />
            </div>
            <div className="slat-config">
              <div className="config-group">
                <div className="label">Variant</div>
                <div className="config-options">
                  {product.variants.map(v =>
                    <button key={v} className={`opt-btn ${variant === v ? "selected" : ""}`} onClick={() => setVariant(v)}>{v}</button>
                  )}
                </div>
              </div>
              <div className="config-group">
                <div className="label">Mechanism</div>
                <div className="config-options">
                  {product.mechanisms.map(m => (
                    <button key={m.id} className={`opt-btn ${mech === m.id ? "selected" : ""}`} onClick={() => setMech(m.id)}>
                      {m.name}{m.upcharge > 0 && <span style={{ opacity: 0.55, marginLeft: 6 }}>+${m.upcharge}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="config-group">
                <div className="label">Mount Type</div>
                <div className="config-options">
                  {product.mounts.map(mid => {
                    const m = MOUNTS.find(x => x.id === mid);
                    return (
                      <button key={mid} className={`opt-btn ${mount === mid ? "selected" : ""}`} onClick={() => setMount(mid)}>{m.name}</button>
                    );
                  })}
                </div>
              </div>
              <div className="slat-desc">{product.description}</div>
              <div className="feature-chips">
                {product.features.map(f => <span key={f} className="chip">{f}</span>)}
              </div>
              <div className="config-meta">
                <div>
                  <div className="lead">Lead time · {product.lead}</div>
                  {showPrice
                    ? <div className="price">${samplePrice}<small> / 3×6ft window</small></div>
                    : <div className="nopricing">Contact us for pricing</div>
                  }
                </div>
                <div className="config-actions">
                  <button className="btn btn-outline btn-sm" onClick={onEstimate}>Get Estimate</button>
                  <button className="btn btn-sage btn-sm" onClick={() => onAddToQuote({ product, variant, mech, mount, price: showPrice ? samplePrice : null })}>Add to Quote</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuotePage({ navigate, quoteItems, addToQuote, removeFromQuote, updateQty }) {
  const [tab, setTab] = useState("estimator");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="page-fade">
      <section className="quote-page container-narrow">
        <div className="section-eyebrow">Estimator</div>
        <h1 className="serif section-title">Build your quote.</h1>
        <p className="section-sub">Estimate any single window, then add it to your quote. Submit the list and we'll send a written proposal within 48 hours.</p>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, padding: "14px 18px", background: "var(--pale-sand)", borderLeft: "3px solid var(--sand)" }}>
          <div style={{ fontSize: 13, color: "var(--charcoal)", flex: 1 }}>
            <strong>Not sure how to measure?</strong> Our step-by-step guide covers inside &amp; outside mount, with tolerance tips and printable worksheet.
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate("measure")}>Open Guide <ArrowRight size={14} /></button>
        </div>

        <div className="tabs" style={{ marginTop: 30 }}>
          <button className={`tab ${tab === "estimator" ? "active" : ""}`} onClick={() => setTab("estimator")}>Estimator</button>
          <button className={`tab ${tab === "quote" ? "active" : ""}`} onClick={() => setTab("quote")}>
            Your Quote{quoteItems.length > 0 && <span className="count">{quoteItems.length}</span>}
          </button>
        </div>

        {tab === "estimator" && <Estimator addToQuote={addToQuote} switchToQuote={() => setTab("quote")} />}
        {tab === "quote" &&
          <QuoteList
            items={quoteItems}
            removeFromQuote={removeFromQuote}
            updateQty={updateQty}
            submitted={submitted}
            onSubmit={() => setSubmitted(true)}
            goEstimator={() => setTab("estimator")} />
        }
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}

function Estimator({ addToQuote, switchToQuote }) {
  const [productId, setProductId] = useState(PRODUCTS[0].id);
  const product = PRODUCTS.find(p => p.id === productId);
  const [variant, setVariant] = useState(product.variants[0]);
  const [mech, setMech] = useState(product.mechanisms[0].id);
  const [mount, setMount] = useState(product.mounts[0]);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [windows, setWindows] = useState("1");
  const [addons, setAddons] = useState({ blackout: false, install: false });

  const handleProductChange = (id) => {
    const p = PRODUCTS.find(x => x.id === id);
    setProductId(id);
    setVariant(p.variants[0]);
    setMech(p.mechanisms[0].id);
    setMount(p.mounts[0]);
  };

  const mechObj = getMechanism(product, mech);
  const mountObj = MOUNTS.find(m => m.id === mount);
  const hasPhoto = hasPhotoForCombo(product.id, variant, mech, mount);
  const photoLabel = `${variant} · ${mechObj?.name} · ${mountObj?.name}`;

  const w = parseFloat(width), h = parseFloat(height), n = parseInt(windows || "0", 10);
  const allFilled = w > 0 && h > 0 && n > 0;
  const sqftPerWindow = allFilled ? w * h / 144 : 0;
  const sellPerSqft = product.baseCost / (1 - product.margin);
  const baseTotal = sqftPerWindow * sellPerSqft;
  const upcharges = (mechObj?.upcharge || 0) + (addons.blackout ? ADDON_UPCHARGES.blackout_lining : 0) + (addons.install ? ADDON_UPCHARGES.installation : 0);
  const perWindow = baseTotal + upcharges;
  const grand = perWindow * n;
  const showPrice = product.baseCost > 0 && allFilled;

  const handleAdd = () => {
    addToQuote({ product, variant, mech, mount, width: w, height: h, qty: n, price: showPrice ? Math.round(perWindow) : null, addons });
    switchToQuote();
  };

  return (
    <div className="estimator-grid">
      <div className="est-form">
        <div>
          <div className="label">Product</div>
          <select className="select" value={productId} onChange={e => handleProductChange(e.target.value)}>
            {PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name}{p.location === "outdoor" ? " · outdoor" : ""}</option>)}
          </select>
        </div>
        <div>
          <div className="label">Variant</div>
          <div className="config-options">
            {product.variants.map(v => <button key={v} className={`opt-btn ${variant === v ? "selected" : ""}`} onClick={() => setVariant(v)}>{v}</button>)}
          </div>
        </div>
        <div>
          <div className="label">Mechanism</div>
          <div className="config-options">
            {product.mechanisms.map(m => (
              <button key={m.id} className={`opt-btn ${mech === m.id ? "selected" : ""}`} onClick={() => setMech(m.id)}>
                {m.name}{m.upcharge > 0 && <span style={{ opacity: 0.55, marginLeft: 6 }}>+${m.upcharge}</span>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">Mount Type</div>
          <div className="config-options">
            {product.mounts.map(mid => {
              const m = MOUNTS.find(x => x.id === mid);
              return <button key={mid} className={`opt-btn ${mount === mid ? "selected" : ""}`} onClick={() => setMount(mid)}>{m.name}</button>;
            })}
          </div>
        </div>
        <div className="est-row">
          <div>
            <div className="label">Width (in)</div>
            <input className="input" type="number" value={width} onChange={e => setWidth(e.target.value)} placeholder="e.g. 36" />
          </div>
          <div>
            <div className="label">Height (in)</div>
            <input className="input" type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 60" />
          </div>
          <div>
            <div className="label"># Windows</div>
            <input className="input" type="number" value={windows} onChange={e => setWindows(e.target.value)} min="1" />
          </div>
        </div>
        <div>
          <div className="label">Optional add-ons</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="checkbox-row">
              <input type="checkbox" id="ck-bl" checked={addons.blackout} onChange={e => setAddons({ ...addons, blackout: e.target.checked })} />
              <label htmlFor="ck-bl">Blackout lining</label>
              <span className="upcharge">+${ADDON_UPCHARGES.blackout_lining}/window</span>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="ck-in" checked={addons.install} onChange={e => setAddons({ ...addons, install: e.target.checked })} />
              <label htmlFor="ck-in">Professional installation</label>
              <span className="upcharge">+${ADDON_UPCHARGES.installation}/window</span>
            </div>
          </div>
        </div>
      </div>
      <div className="est-aside">
        <PhotoPH
          label={photoLabel}
          sub={hasPhoto ? "configuration photo" : "no photo for this combination yet"}
          className={hasPhoto ? "" : "empty"}
          aspect="4 / 5" />
        <div className="est-summary">
          <div className="label">Estimated total</div>
          {showPrice
            ? <>
                <div className="est-price">${Math.round(grand).toLocaleString()}</div>
                <div style={{ fontSize: 13, color: "var(--ink-60)", marginTop: 6 }}>
                  {n} window{n > 1 ? "s" : ""} · ${Math.round(perWindow).toLocaleString()} each
                </div>
              </>
            : <div className="est-price-empty">
                {product.baseCost > 0
                  ? "Enter size and quantity to see your estimate."
                  : "Contact us for pricing on this product."}
              </div>
          }
          <button className="btn btn-sage" style={{ marginTop: 18, width: "100%" }}
            disabled={!allFilled}
            onClick={handleAdd}>
            Add to Quote
          </button>
        </div>
      </div>
    </div>
  );
}

function QuoteList({ items, removeFromQuote, updateQty, submitted, onSubmit, goEstimator }) {
  const total = items.reduce((s, it) => s + (it.price ? it.price * it.qty : 0), 0);
  const hasPricing = items.some(it => it.price);

  if (submitted) {
    return (
      <div className="success-banner">
        <h3 className="serif">Thanks — your quote is in.</h3>
        <p>We'll send a written proposal to your inbox within 48 hours. If you don't see it, check your junk folder or call {SETTINGS.phone}.</p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h3 className="serif">No items in your quote yet.</h3>
        <p>Use the Estimator tab to configure a window and add it here.</p>
        <button className="btn btn-outline" onClick={goEstimator} style={{ marginTop: 20 }}>Open Estimator <ArrowRight /></button>
      </div>
    );
  }

  return (
    <div>
      <div className="quote-list">
        {items.map((it, idx) => {
          const itemMech = getMechanism(it.product, it.mech);
          return (
            <div key={idx} className="quote-line">
              <PhotoPH
                label={`${it.variant}`}
                sub={`${itemMech?.code} · ${it.mount}`}
                className={hasPhotoForCombo(it.product.id, it.variant, it.mech, it.mount) ? "" : "empty"} />
              <div>
                <div className="quote-line-title">{it.product.name} · {it.variant}</div>
                <div className="quote-line-meta">
                  {itemMech?.name} · {MOUNTS.find(m => m.id === it.mount)?.name}
                  {it.width && ` · ${it.width}"W × ${it.height}"H`}
                </div>
              </div>
              <div className="qty-stepper">
                <button onClick={() => updateQty(idx, Math.max(1, it.qty - 1))}>−</button>
                <span>{it.qty}</span>
                <button onClick={() => updateQty(idx, it.qty + 1)}>+</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="quote-line-total">
                  {it.price
                    ? `$${(it.price * it.qty).toLocaleString()}`
                    : <span style={{ fontStyle: "italic", fontSize: 14, color: "var(--ink-60)" }}>Quote on request</span>}
                </div>
                <button className="quote-line-rm" onClick={() => removeFromQuote(idx)} title="Remove"><XIcon /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="grand-total">
        <div>
          <div className="lbl">Estimated total</div>
          {!hasPricing && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Final pricing sent within 48 hours</div>}
        </div>
        <div className="amt">{hasPricing ? `$${total.toLocaleString()}` : "—"}</div>
      </div>

      <h3 className="serif" style={{ fontSize: 28, marginTop: 48, marginBottom: 8 }}>Where should we send your proposal?</h3>
      <p style={{ color: "var(--ink-60)", margin: 0 }}>We'll never share your contact information.</p>

      <div className="quote-form">
        <div><div className="label">Name</div><input className="input" placeholder="Full name" /></div>
        <div><div className="label">Email</div><input className="input" type="email" placeholder="you@example.com" /></div>
        <div><div className="label">Phone</div><input className="input" placeholder="(555) 555-5555" /></div>
        <div><div className="label">Best time to call</div>
          <select className="select"><option>Anytime</option><option>Mornings</option><option>Afternoons</option><option>Evenings</option></select>
        </div>
        <div className="full">
          <div className="label">Measurement method</div>
          <div className="config-options">
            <button className="opt-btn selected">I'll measure myself</button>
            <button className="opt-btn">Send someone to measure</button>
            <button className="opt-btn">Not sure yet</button>
          </div>
        </div>
        <div className="full"><div className="label">Notes — rooms, timing, anything we should know</div><textarea className="textarea" placeholder="e.g. Bay window in the living room, master bedroom needs full blackout." /></div>
        <div className="full">
          <button className="btn btn-sage" onClick={onSubmit} style={{ padding: "14px 28px" }}>Submit Quote Request <ArrowRight /></button>
        </div>
      </div>
    </div>
  );
}

export function MeasureGuidePage({ navigate }) {
  const [mountType, setMountType] = useState("inside");
  return (
    <div className="page-fade">
      <section className="measure-hero">
        <div className="container">
          <div className="section-eyebrow">DIY guide · 10 minutes</div>
          <h1 className="serif">Measure with <em>confidence.</em></h1>
          <p className="section-sub" style={{ maxWidth: 640 }}>You only need a steel tape, a pencil, and ten minutes. Measure every window even if they look identical — older houses rarely come square.</p>

          <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
            <button className="btn btn-sage btn-sm" onClick={() => navigate("quote")}>Skip guide · Get a quote <ArrowRight size={14} /></button>
            <button className="btn btn-outline btn-sm">Download printable worksheet</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("contact")}>Or book an in-home consult →</button>
          </div>
        </div>
      </section>

      <section className="container measure-content">
        <div className="measure-cols">
          <aside className="measure-toc">
            <div className="label">On this page</div>
            <ol className="measure-toc-list">
              <li><a href="#tools">What you'll need</a></li>
              <li><a href="#choose">Inside or outside mount</a></li>
              <li><a href="#steps">Step-by-step</a></li>
              <li><a href="#tips">Tips &amp; tolerances</a></li>
              <li><a href="#submit">Submit your numbers</a></li>
            </ol>
            <div className="measure-toc-callout">
              <div className="label" style={{ color: "var(--sage-dark)" }}>Need help?</div>
              <p>If you're unsure about any window — bay, arch, French door, or anything out of plumb — book a free in-home consult and we'll measure for you.</p>
              <button className="btn btn-outline btn-sm" onClick={() => navigate("contact")}>Book consult <ArrowRight size={14} /></button>
            </div>
          </aside>

          <div className="measure-main">
            <div id="tools" className="measure-block">
              <h2 className="serif">1 · What you'll need</h2>
              <div className="measure-tools">
                {[
                  ["Steel tape", "At least 16 ft. Avoid cloth tapes — they stretch."],
                  ["Pencil & paper", "Or download our worksheet (one row per window)."],
                  ["Step stool", "For tall windows. Don't measure on tiptoe."],
                  ["A second pair of eyes", "Optional but helpful for double-checking."],
                ].map(([t, d]) => (
                  <div key={t} className="tool-card">
                    <div className="tool-card-name">{t}</div>
                    <div className="tool-card-desc">{d}</div>
                  </div>
                ))}
              </div>
            </div>

            <div id="choose" className="measure-block">
              <h2 className="serif">2 · Choose inside or outside mount</h2>
              <p>Most windows accept either. <strong>Inside mount</strong> sits inside the window frame for a clean, recessed look — but needs at least 2 inches of depth. <strong>Outside mount</strong> covers the frame and trim — better for light control and for shallow frames.</p>

              <div className="mount-toggle">
                <button className={`mount-tab ${mountType === "inside" ? "active" : ""}`} onClick={() => setMountType("inside")}>
                  <div className="mount-tab-name">Inside Mount</div>
                  <div className="mount-tab-desc">Recessed in the frame. Needs ≥ 2" depth.</div>
                </button>
                <button className={`mount-tab ${mountType === "outside" ? "active" : ""}`} onClick={() => setMountType("outside")}>
                  <div className="mount-tab-name">Outside Mount</div>
                  <div className="mount-tab-desc">Covers the trim. Best for light control.</div>
                </button>
              </div>
            </div>

            <div id="steps" className="measure-block">
              <h2 className="serif">3 · {mountType === "inside" ? "Inside mount, step by step" : "Outside mount, step by step"}</h2>
              <div className="measure-steps">
                {(mountType === "inside" ? [
                  ["Measure width at 3 points", "Top, middle, and bottom of the frame opening. Record the smallest measurement — that's the one we'll cut to. Don't round up.", "Window opening · width × 3"],
                  ["Measure height at 3 points", "Left, center, and right of the opening, from the top of the frame to the sill. Use the longest measurement.", "Window opening · height × 3"],
                  ["Measure depth", "From the front face of the frame to the glass. We need at least 2 inches for most blinds; some products need 2.5–3 inches.", "Frame depth"],
                  ["Note any obstructions", "Window cranks, locks, alarm sensors, tile sills — anything that sticks into the frame.", "Obstructions"],
                ] : [
                  ["Decide overlap", "We recommend at least 2 inches of overlap on each side and 3 inches above the frame. More overlap = better light blocking.", "Wall area to cover"],
                  ["Measure final width", "From the outer edge of one trim to the outer edge of the other, plus your overlap. Measure once — outside-mount widths don't vary.", "Total width incl. overlap"],
                  ["Measure final height", "From your chosen top point down to where you want the shade to end — either the sill, just past it, or all the way to the floor.", "Total height"],
                  ["Check for clearance", "Make sure there's wall space above and to the sides for mounting brackets — usually 1.5\" each direction.", "Bracket clearance"],
                ]).map(([t, d, ph], i) => (
                  <div key={i} className="meas-step">
                    <div className="meas-step-photo">
                      <PhotoPH label={ph} sub="diagram placeholder" aspect="4 / 3" />
                    </div>
                    <div>
                      <div className="meas-step-num">Step {i + 1}</div>
                      <h3 className="serif" style={{ fontSize: 22, marginBottom: 6 }}>{t}</h3>
                      <p style={{ color: "var(--ink-60)", margin: 0, fontSize: 14, lineHeight: 1.6 }}>{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div id="tips" className="measure-block">
              <h2 className="serif">4 · Tips &amp; tolerances</h2>
              <ul className="measure-tips">
                <li><strong>Always record in inches, to the nearest 1/8 inch.</strong> Decimals are fine — just be consistent.</li>
                <li><strong>Don't make any deductions.</strong> Send us the raw window numbers. We apply manufacturer deductions in the workshop.</li>
                <li><strong>Measure every window.</strong> Even if they look identical. Older houses rarely come square.</li>
                <li><strong>Photo your worksheet.</strong> Attach it when you submit your quote and we'll cross-check before we cut.</li>
                <li><strong>Out of plumb?</strong> If a window's left and right heights differ by more than 1/4 inch, flag it in notes — we'll discuss options.</li>
              </ul>
            </div>

            <div id="submit" className="measure-block measure-cta">
              <div>
                <h2 className="serif" style={{ fontSize: 32 }}>Got your numbers?</h2>
                <p style={{ color: "var(--ink-60)", fontSize: 15, margin: "8px 0 0" }}>Send them along with your product picks and we'll have a written quote back to you within 48 hours.</p>
              </div>
              <button className="btn btn-sage" onClick={() => navigate("quote")}>Build Your Quote <ArrowRight /></button>
            </div>
          </div>
        </div>
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}

export function ContactPage({ navigate }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="page-fade">
      <section className="contact-page container-narrow">
        <div className="section-eyebrow">Visit us</div>
        <h1 className="serif section-title">Drop us a line.</h1>
        <p className="section-sub">Have a project in mind, or just want to feel some swatches? Come by the studio or send a note.</p>

        <div className="contact-grid">
          <div>
            {sent
              ? <div className="success-banner">
                  <h3 className="serif">Message received.</h3>
                  <p>One of us will reply within 1 business day.</p>
                </div>
              : <div className="quote-form" style={{ marginTop: 0 }}>
                  <div><div className="label">Name</div><input className="input" placeholder="Full name" /></div>
                  <div><div className="label">Email</div><input className="input" type="email" placeholder="you@example.com" /></div>
                  <div className="full"><div className="label">What's this about?</div>
                    <div className="config-options">
                      <button className="opt-btn selected">General question</button>
                      <button className="opt-btn">Book in-home consult</button>
                      <button className="opt-btn">Question about a quote</button>
                      <button className="opt-btn">Trade / wholesale</button>
                    </div>
                  </div>
                  <div className="full"><div className="label">Subject</div><input className="input" placeholder="Quick question about cellular shades…" /></div>
                  <div className="full"><div className="label">Message</div><textarea className="textarea" rows="5" placeholder="Tell us a bit about your project." /></div>
                  <div className="full"><button className="btn btn-sage" onClick={() => setSent(true)}>Send Message <ArrowRight /></button></div>
                </div>
            }
          </div>
          <aside className="contact-details">
            <div className="contact-detail-row"><div className="label">Studio</div><div className="val">2104 Cedar Ave<br />Asheville, NC 28801</div></div>
            <div className="contact-detail-row"><div className="label">Phone</div><div className="val">{SETTINGS.phone}</div></div>
            <div className="contact-detail-row"><div className="label">Email</div><div className="val">{SETTINGS.email}</div></div>
            <div className="contact-detail-row"><div className="label">Hours</div><div className="val">Mon–Fri · 9–6<br />Sat · 10–4</div></div>
            <div className="contact-detail-row"><div className="label">In-home consults</div><div className="val">Free within 30 miles<br /><span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-60)" }}>Beyond 30mi · $80 flat fee, refunded with order</span></div></div>
          </aside>
        </div>
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}
