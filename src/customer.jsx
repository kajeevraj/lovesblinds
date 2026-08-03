import { useState } from 'react';
import {
  PRODUCTS, MOUNTS, SETTINGS,
  productsByLocation, getMechanism,
} from './data.js';
import { swatchImage, swatchColor, productPhoto, hasRealPhoto } from './lib/photos.js';
import { CATEGORY_ICONS, ArrowRight, ChevDown, XIcon } from './icons.jsx';

export function Nav({ route, navigate, onAdmin, quoteCount, supabaseEnabled, user, signInWithGoogle, signOut, orders, authLoading }) {
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
          <button className={`nav-link ${route === "quote" ? "active" : ""}`} onClick={() => navigate("quote")}>
            Your Order{quoteCount > 0 && <span className="nav-count">{quoteCount}</span>}
          </button>
          <button className={`nav-link ${route === "contact" ? "active" : ""}`} onClick={() => navigate("contact")}>Contact</button>
        </div>
        {supabaseEnabled && !authLoading && (
          user ? (
            <button className="nav-avatar-btn" onClick={() => navigate("orders")} title="My Orders">
              {user.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" className="nav-avatar" />
                : <div className="nav-avatar nav-avatar-fallback">{user.email?.[0]?.toUpperCase()}</div>
              }
              {orders.length > 0 && <span className="nav-orders-count">{orders.length}</span>}
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm nav-signin" onClick={signInWithGoogle}>Sign in</button>
          )
        )}
        {quoteCount === 0 && (
          <button className="btn btn-sage btn-sm" onClick={() => navigate("quote")} style={{ marginRight: 18 }}>Start Your Order</button>
        )}
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
          <button className="btn btn-outline-light" onClick={() => navigate("quote")}>Start Your Order <ArrowRight /></button>
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
              <li>512 Glenwyck Court</li>
              <li>Fuquay-Varina, NC 27526</li>
              <li>{SETTINGS.phone}</li>
              <li>{SETTINGS.email}</li>
            </ul>
          </div>
          <div>
            <h4>Hours</h4>
            <ul>
              <li>{SETTINGS.hours}</li>
            </ul>
          </div>
          <div>
            <h4>Browse</h4>
            <ul>
              <li><button className="nav-link" style={{ padding: 0, fontSize: 13, letterSpacing: 0 }} onClick={() => navigate("products")}>All Products</button></li>
              <li><button className="nav-link" style={{ padding: 0, fontSize: 13, letterSpacing: 0 }} onClick={() => navigate("measure")}>Measurement Guide</button></li>
              <li><button className="nav-link" style={{ padding: 0, fontSize: 13, letterSpacing: 0 }} onClick={() => navigate("quote")}>Your Order</button></li>
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

export function HomePage({ navigate, goToProduct, quoteCount }) {
  return (
    <div className="page-fade">
      <section className="hero">
        <div className="hero-inner">
          <div>
            <h1>Quiet rooms.<br /><em>Beautifully</em> dressed windows.</h1>
            <p className="hero-tag">Made-to-measure blinds, shades, shutters, and drapes — measured your way: in-home consult with us, or DIY with our step-by-step guide.</p>
            <div className="hero-ctas">
              <button className="btn btn-sand" onClick={() => navigate("products")} style={{ background: "var(--sand)", color: "var(--charcoal)" }}>Browse Products</button>
              <button className="btn btn-outline-light" onClick={() => navigate("quote")}>
                {quoteCount > 0 ? `Continue Your Order · ${quoteCount} item${quoteCount !== 1 ? 's' : ''}` : 'Start Your Order'} <ArrowRight />
              </button>
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
            <h4 className="serif">Start your order</h4>
            <p>Tell us your windows. We send a written quote within 48 hours — no email harvesting, no upsell.</p>
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
                onAddToQuote={addToQuote} />
            )}
          </div>
        </section>
      }

      <Footer navigate={navigate} />
    </div>
  );
}

function SlatRow({ product, open, onToggle, onAddToQuote }) {
  const Icon = CATEGORY_ICONS[product.category];
  const [variant, setVariant] = useState(product.variants[0]);
  const [mech, setMech] = useState(product.mechanisms[0].id);
  const [mount, setMount] = useState(product.mounts[0]);
  const [color, setColor] = useState(product.colors?.[0] || null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [windows, setWindows] = useState("1");
  const [roomLabel, setRoomLabel] = useState("");
  const [addons, setAddons] = useState({ blackout: false, install: false });

  const mechObj = getMechanism(product, mech);
  const mountObj = MOUNTS.find(m => m.id === mount);
  const photoLabel = color ? `${color.name} · ${mechObj?.name} · ${mountObj?.name}` : `${variant} · ${mechObj?.name} · ${mountObj?.name}`;
  const hasPhoto = hasRealPhoto(product.category, color?.code, mech, mount);

  const handleAdd = () => {
    const w = parseFloat(width) || null;
    const h = parseFloat(height) || null;
    const n = parseInt(windows, 10) || 1;
    onAddToQuote({ product, variant, mech, mount, color, code: color?.code || null, colorName: color?.name || variant, category: product.category, location: product.location, price: null, width: w, length: h, qty: n, roomLabel: roomLabel.trim(), addons });
  };

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
              {hasPhoto
                ? <img src={productPhoto(product.category, color?.code, mech, mount)} alt={photoLabel} style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", borderRadius: 4 }} />
                : <PhotoPH label={photoLabel} sub="no photo for this combination yet" className="empty" aspect="4 / 5" />
              }
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
                      {m.name}
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
              {product.colors?.length > 0 && (
                <div className="config-group">
                  <div className="label">Color{color ? ` · ${color.name}${color.collection ? ` (${color.collection})` : ""}` : ""}</div>
                  <div className="swatch-grid">
                    {product.colors.map(c => {
                      const img = swatchImage(c);
                      return (
                        <button key={c.code} className={`swatch-btn${color?.code === c.code ? " selected" : ""}`} title={`${c.name}${c.collection ? ` – ${c.collection}` : ""} (${c.code})`} onClick={() => setColor(c)}>
                          {img ? <img src={img} alt={c.name} /> : <span style={{ background: swatchColor(c) }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="config-group">
                <div className="label">Dimensions <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional — enter now or tell us in the notes)</span></div>
                <div className="slat-dims">
                  <div>
                    <div style={{ fontSize: 11, color: "var(--ink-60)", marginBottom: 3 }}>Width (in)</div>
                    <input className="input" type="number" value={width} onChange={e => setWidth(e.target.value)} placeholder="36" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--ink-60)", marginBottom: 3 }}>Height (in)</div>
                    <input className="input" type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="60" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--ink-60)", marginBottom: 3 }}># Windows</div>
                    <input className="input" type="number" value={windows} onChange={e => setWindows(e.target.value)} min="1" placeholder="1" />
                  </div>
                </div>
              </div>
              <div className="config-group">
                <div className="label">Room <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></div>
                <input className="input" type="text" value={roomLabel} onChange={e => setRoomLabel(e.target.value)} placeholder="e.g. Master bedroom" />
              </div>
              <div className="config-group">
                <div className="label">Add-ons</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="checkbox-row">
                    <input type="checkbox" id={`ck-bl-${product.id}`} checked={addons.blackout} onChange={e => setAddons(a => ({ ...a, blackout: e.target.checked }))} />
                    <label htmlFor={`ck-bl-${product.id}`}>Blackout lining</label>
                  </div>
                  <div className="checkbox-row">
                    <input type="checkbox" id={`ck-in-${product.id}`} checked={addons.install} onChange={e => setAddons(a => ({ ...a, install: e.target.checked }))} />
                    <label htmlFor={`ck-in-${product.id}`}>Professional installation</label>
                  </div>
                </div>
              </div>
              <div className="slat-desc">{product.description}</div>
              <div className="feature-chips">
                {product.features.map(f => <span key={f} className="chip">{f}</span>)}
              </div>
              <div className="config-meta">
                <div>
                  <div className="lead">Lead time · {product.lead}</div>
                </div>
                <div className="config-actions">
                  <button className="btn btn-sage btn-sm" onClick={handleAdd}>Add to Order</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuotePage({ navigate, quoteItems, removeFromQuote, updateQty, updateRoomLabel, activeOrder, activeOrderId, user, onOrderSent }) {
  return (
    <div className="page-fade">
      <section className="quote-page container-narrow">
        {user && activeOrder ? (
          <div className="order-breadcrumb">
            <button className="nav-link" style={{ padding: 0, fontSize: 13 }} onClick={() => navigate("orders")}>← My Orders</button>
            <span className="order-breadcrumb-sep">·</span>
            <span className="order-breadcrumb-name">{activeOrder.name}</span>
          </div>
        ) : user ? (
          <div className="order-breadcrumb">
            <button className="nav-link" style={{ padding: 0, fontSize: 13 }} onClick={() => navigate("orders")}>← My Orders</button>
          </div>
        ) : null}

        <div className="section-eyebrow" style={{ marginTop: user ? 12 : 0 }}>Your Order</div>
        <h1 className="serif section-title">Place your order.</h1>
        <p className="section-sub">Review your selections, add your contact details, and send — we'll reply with your written quote within 48 hours.</p>

        <QuoteList
          items={quoteItems}
          removeFromQuote={removeFromQuote}
          updateQty={updateQty}
          updateRoomLabel={updateRoomLabel}
          navigate={navigate}
          goToProducts={() => navigate("products")}
          activeOrderId={activeOrderId}
          onOrderSent={onOrderSent} />
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}

function QuoteList({ items, removeFromQuote, updateQty, updateRoomLabel, goToProducts, navigate, activeOrderId, onOrderSent }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [callTime, setCallTime] = useState("Anytime");
  const [measureMethod, setMeasureMethod] = useState("I'll measure myself");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState({});
  const [review, setReview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  if (submitted) {
    return (
      <div className="success-banner">
        <h3 className="serif">Order request sent.</h3>
        <p>We'll reply to <strong>{review.email}</strong> with your quote within 48 hours. If you don't see it, check your junk folder or call {SETTINGS.phone}.</p>
      </div>
    );
  }

  const handleConfirmSend = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        customer: {
          name: review.name,
          email: review.email,
          phone: review.phone,
          shipTo: review.shipTo,
          callTime: review.callTime,
          measureMethod: review.measureMethod,
        },
        lines: items.map(it => ({
          code: it.code || null,
          colorName: it.colorName || it.variant,
          category: it.category || it.product.category,
          description: `${it.product.name} · ${it.colorName || it.variant}`,
          mechId: it.mech,
          mechName: getMechanism(it.product, it.mech)?.name || it.mech,
          mountId: it.mount,
          width: it.width || null,
          length: it.length || it.height || null,
          qty: it.qty,
          location: it.location || it.product.location,
          roomLabel: it.roomLabel || '',
        })),
        notes: review.notes,
      };

      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      setSubmitted(true);
      if (onOrderSent && activeOrderId) onOrderSent(activeOrderId);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (review) {
    const customer = review;
    return (
      <div>
        <div className="success-banner" style={{ marginBottom: 32 }}>
          <h3 className="serif">Review your order.</h3>
          <p style={{ margin: 0 }}>Check everything below, then confirm to send.</p>
        </div>

        <h4 className="serif" style={{ fontSize: 20, marginBottom: 14 }}>Your details</h4>
        <div className="review-grid">
          <div><span className="label">Name</span><div>{customer.name}</div></div>
          <div><span className="label">Email</span><div>{customer.email}</div></div>
          {customer.phone && <div><span className="label">Phone</span><div>{customer.phone}</div></div>}
          {customer.shipTo && <div><span className="label">Ship to</span><div>{customer.shipTo}</div></div>}
          <div><span className="label">Best time to call</span><div>{customer.callTime}</div></div>
          <div><span className="label">Measurement</span><div>{customer.measureMethod}</div></div>
          {customer.notes && <div className="full"><span className="label">Notes</span><div>{customer.notes}</div></div>}
        </div>

        <h4 className="serif" style={{ fontSize: 20, margin: "32px 0 14px" }}>Items ({items.length})</h4>
        <div className="quote-list">
          {items.map((it, idx) => {
            const itemMech = getMechanism(it.product, it.mech);
            return (
              <div key={idx} className="quote-line">
                <PhotoPH label={it.colorName || it.variant} sub={itemMech?.code} className="empty" />
                <div>
                  <div className="quote-line-title">{it.product.name} · {it.colorName || it.variant}</div>
                  <div className="quote-line-meta">
                    {itemMech?.name} · {MOUNTS.find(m => m.id === it.mount)?.name}
                    {it.width && ` · ${it.width}"W × ${it.length || it.height}"H`}
                    {it.roomLabel && <span style={{ marginLeft: 8, color: "var(--sage-dark)", fontSize: 12 }}>{it.roomLabel}</span>}
                    {it.code && <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 12 }}>#{it.code}</span>}
                  </div>
                </div>
                <div className="qty-stepper" style={{ pointerEvents: "none" }}>
                  <button>−</button><span>{it.qty}</span><button>+</button>
                </div>
              </div>
            );
          })}
        </div>

        {submitError && (
          <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(168,81,63,0.08)", border: "1px solid rgba(168,81,63,0.3)", borderRadius: 4, color: "#a8513f", fontSize: 14 }}>
            {submitError}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <button className="btn btn-outline" onClick={() => { setReview(null); setSubmitError(null); }} disabled={submitting}>
            ← Edit
          </button>
          <button className="btn btn-sage" onClick={handleConfirmSend} disabled={submitting} style={{ padding: "14px 28px" }}>
            {submitting ? "Sending…" : "Send Order"} {!submitting && <ArrowRight />}
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h3 className="serif">Nothing in your order yet.</h3>
        <p>Browse our products and use "Add to Order" to build your list.</p>
        <button className="btn btn-outline" onClick={goToProducts} style={{ marginTop: 20 }}>Browse Products <ArrowRight /></button>
      </div>
    );
  }

  const handleSubmit = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Required";
    if (!email.trim()) errs.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Enter a valid email";
    if (items.length === 0) errs._items = "Add at least one item before submitting";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setReview({ name: name.trim(), email: email.trim(), phone: phone.trim(), shipTo: shipTo.trim(), callTime, measureMethod, notes: notes.trim() });
  };

  return (
    <div>
      <div className="quote-list">
        {items.map((it, idx) => {
          const itemMech = getMechanism(it.product, it.mech);
          return (
            <div key={idx} className="quote-line">
              <PhotoPH
                label={it.colorName || it.variant}
                sub={`${itemMech?.code} · ${it.mount}`}
                className={hasRealPhoto(it.product.category, it.color?.code, it.mech, it.mount) ? "" : "empty"} />
              <div>
                <div className="quote-line-title">{it.product.name} · {it.colorName || it.variant}</div>
                <div className="quote-line-meta">
                  {itemMech?.name} · {MOUNTS.find(m => m.id === it.mount)?.name}
                  {it.width && ` · ${it.width}"W × ${it.length || it.height}"H`}
                </div>
                <input
                  className="input room-label-input"
                  type="text"
                  value={it.roomLabel || ""}
                  onChange={e => updateRoomLabel(idx, e.target.value)}
                  placeholder="Room (optional)" />
              </div>
              <div className="qty-stepper">
                <button onClick={() => updateQty(idx, Math.max(1, it.qty - 1))}>−</button>
                <span>{it.qty}</span>
                <button onClick={() => updateQty(idx, it.qty + 1)}>+</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="quote-line-rm" onClick={() => removeFromQuote(idx)} title="Remove"><XIcon /></button>
              </div>
            </div>
          );
        })}
      </div>
      <h3 className="serif" style={{ fontSize: 28, marginTop: 48, marginBottom: 8 }}>Where should we send your quote?</h3>
      <p style={{ color: "var(--ink-60)", margin: 0 }}>We'll never share your contact information.</p>

      <div className="quote-form">
        <div>
          <div className="label">Name{errors.name && <span className="field-error"> — {errors.name}</span>}</div>
          <input className={`input${errors.name ? " input-error" : ""}`} placeholder="Full name" value={name} onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: "" })); }} />
        </div>
        <div>
          <div className="label">Email{errors.email && <span className="field-error"> — {errors.email}</span>}</div>
          <input className={`input${errors.email ? " input-error" : ""}`} type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setErrors(v => ({ ...v, email: "" })); }} />
        </div>
        <div>
          <div className="label">Phone</div>
          <input className="input" placeholder="(555) 555-5555" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div>
          <div className="label">Ship to address</div>
          <input className="input" placeholder="123 Main St, City, State" value={shipTo} onChange={e => setShipTo(e.target.value)} />
        </div>
        <div>
          <div className="label">Best time to call</div>
          <select className="select" value={callTime} onChange={e => setCallTime(e.target.value)}>
            <option>Anytime</option><option>Mornings</option><option>Afternoons</option><option>Evenings</option>
          </select>
        </div>
        <div className="full">
          <div className="label">Measurement method</div>
          <div className="config-options">
            {["I'll measure myself", "Send someone to measure", "Not sure yet"].map(opt => (
              <button key={opt} className={`opt-btn${measureMethod === opt ? " selected" : ""}`} onClick={() => setMeasureMethod(opt)}>{opt}</button>
            ))}
          </div>
        </div>
        <div className="full">
          <div className="label">Notes — rooms, timing, anything we should know</div>
          <textarea className="textarea" placeholder="e.g. Bay window in the living room, master bedroom needs full blackout." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="full">
          {errors._items && <div style={{ marginBottom: 10, color: "#a8513f", fontSize: 13 }}>{errors._items}</div>}
          <button className="btn btn-sage" onClick={handleSubmit} style={{ padding: "14px 28px" }}>Review Your Order <ArrowRight /></button>
        </div>
      </div>

      {navigate && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 32, padding: "14px 18px", background: "var(--pale-sand)", borderLeft: "3px solid var(--sand)" }}>
          <div style={{ fontSize: 13, color: "var(--charcoal)", flex: 1 }}>
            <strong>Not sure how to measure?</strong> Our step-by-step guide covers inside &amp; outside mount, with tolerance tips and a printable worksheet.
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate("measure")}>Open Guide <ArrowRight size={14} /></button>
        </div>
      )}
    </div>
  );
}

export function OrdersPage({ navigate, orders, activeOrderId, openOrder, createOrder, renameOrder, deleteOrder, user, signOut, signInWithGoogle, supabaseEnabled, quoteCount, ordersLength }) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  if (!supabaseEnabled) {
    return (
      <div className="page-fade">
        <section className="container-narrow" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <h1 className="serif section-title">My Orders</h1>
          <p style={{ color: "var(--ink-60)" }}>Account features are not yet configured for this site.</p>
        </section>
        <Footer navigate={navigate} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-fade">
        <section className="container-narrow" style={{ paddingTop: 80, paddingBottom: 80, textAlign: "center" }}>
          <h1 className="serif section-title">My Orders</h1>
          <p style={{ color: "var(--ink-60)", marginBottom: 28 }}>Sign in with Google to save your orders and come back to them any time.</p>
          <button className="btn btn-sage" onClick={signInWithGoogle}>Sign in with Google</button>
        </section>
        <Footer navigate={navigate} />
      </div>
    );
  }

  const startEdit = (e, order) => {
    e.stopPropagation();
    setEditingId(order.id);
    setEditingName(order.name);
    setPendingDelete(null);
  };

  const commitEdit = () => {
    if (editingId && editingName.trim()) renameOrder(editingId, editingName.trim());
    setEditingId(null);
  };

  const handleDelete = (e, orderId) => {
    e.stopPropagation();
    if (pendingDelete === orderId) {
      deleteOrder(orderId);
      setPendingDelete(null);
    } else {
      setPendingDelete(orderId);
    }
  };

  const handleNewOrder = () => {
    const name = `Order ${(ordersLength ?? orders.length) + 1}`;
    createOrder(name).then(o => { if (o) navigate('quote'); });
  };

  return (
    <div className="page-fade">
      <section className="container" style={{ paddingTop: 56, paddingBottom: 80 }}>
        <div className="orders-page-header">
          <div>
            <div className="section-eyebrow">{user.email}</div>
            <h1 className="serif section-title" style={{ marginBottom: 0 }}>My Orders</h1>
          </div>
          <div className="orders-page-actions">
            <button className="btn btn-sage" onClick={handleNewOrder}>+ New Order</button>
            <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="empty-state">
            <h3 className="serif">No orders yet.</h3>
            <p>Browse products and use "Add to Order" to get started.</p>
            <button className="btn btn-sage" onClick={() => navigate('products')} style={{ marginTop: 20 }}>
              Browse Products <ArrowRight />
            </button>
          </div>
        ) : (
          <div className="orders-grid">
            {orders.map(order => {
              const isActive = order.id === activeOrderId;
              const itemCount = isActive ? quoteCount : (order.items?.length ?? 0);
              return (
                <div
                  key={order.id}
                  className={`order-card${isActive ? ' active' : ''}`}
                  onClick={() => openOrder(order.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOrder(order.id); }}}
                >
                  <div className="order-card-header">
                    {editingId === order.id ? (
                      <input
                        className="input order-card-name-input"
                        value={editingName}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      />
                    ) : (
                      <div className="order-card-name">{order.name}</div>
                    )}
                    <div className="order-card-btns" onClick={e => e.stopPropagation()}>
                      <button className="order-card-btn" title="Rename" onClick={e => startEdit(e, order)}>✎</button>
                      <button
                        className={`order-card-btn${pendingDelete === order.id ? ' danger' : ''}`}
                        title={pendingDelete === order.id ? 'Click again to confirm delete' : 'Delete'}
                        onClick={e => handleDelete(e, order.id)}
                      >
                        {pendingDelete === order.id ? 'Delete?' : <XIcon size={13} />}
                      </button>
                    </div>
                  </div>
                  <div className="order-card-meta">
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                    {' · '}
                    {new Date(order.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="order-card-pills">
                    {order.status === 'sent'
                      ? <span className="order-pill order-pill-sent">Sent</span>
                      : <span className="order-pill order-pill-draft">In progress</span>
                    }
                    {isActive && <span className="order-pill order-pill-active">Active</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <Footer navigate={navigate} />
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
            <button className="btn btn-sage btn-sm" onClick={() => navigate("quote")}>Skip guide · Start your order <ArrowRight size={14} /></button>
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
              <button className="btn btn-sage" onClick={() => navigate("quote")}>Start Your Order <ArrowRight /></button>
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
            <div className="contact-detail-row"><div className="label">Studio</div><div className="val">512 Glenwyck Court<br />Fuquay-Varina, NC 27526</div></div>
            <div className="contact-detail-row"><div className="label">Phone</div><div className="val">{SETTINGS.phone}</div></div>
            <div className="contact-detail-row"><div className="label">Email</div><div className="val">{SETTINGS.email}</div></div>
            <div className="contact-detail-row"><div className="label">Hours</div><div className="val">{SETTINGS.hours}</div></div>
            <div className="contact-detail-row"><div className="label">In-home consults</div><div className="val">Free within 30 miles<br /><span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-60)" }}>Beyond 30mi · $80 flat fee, refunded with order</span></div></div>
          </aside>
        </div>
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}
