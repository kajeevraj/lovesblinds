import { useState, useEffect, useRef } from 'react';
import { activeLines, activeLinesIn, activeLocations, needsLocationStep, LOCATION_LABELS, MOUNTS, getMechanism } from './data/lines.js';
import { SITE } from './data/site.js';
import { summarize, describeItem, describeInternal, displayNameOf } from './lib/selection.js';
import { BrandPanel } from './components/Showcase.jsx';
import SitePhoto from './components/SitePhoto.jsx';
import { CATEGORY_ICONS, ArrowRight, XIcon } from './icons.jsx';
import { ExplainerImg } from './components/ExplainerImg.jsx';
import ProfileMenu from './components/ProfileMenu.jsx';
import { profileOf, saveProfile } from './lib/profile.js';
import { sentEstimate } from './lib/orders.js';

const linkTo = (navigate, path) => (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // let the browser open new tabs
  e.preventDefault();
  navigate(path);
};

export function Nav({ route, navigate, quoteCount, supabaseEnabled, user, signInWithGoogle, signOut, authLoading }) {
  const goHow = (e) => {
    e.preventDefault();
    if (route === "home") document.getElementById("how")?.scrollIntoView({ behavior: "smooth" });
    else { navigate("home"); setTimeout(() => document.getElementById("how")?.scrollIntoView(), 50); }
  };
  const goContact = (e) => { e.preventDefault(); navigate("contact"); };
  return (
    <header className="s2-nav">
      <nav className="s2-nav-inner" aria-label="Main">
        <a className="s2-wordmark" href="/" onClick={linkTo(navigate, "/")}>Love's Blinds</a>
        <div className="s2-nav-links">
          <a className={route === "products" ? "active" : ""} href="/products" onClick={linkTo(navigate, "/products")}>Products</a>
          <a className={route === "measure" ? "active" : ""} href="/measure" onClick={linkTo(navigate, "/measure")}>How to measure</a>
          <a href="/#how" onClick={goHow}>How it works</a>
          <a className={route === "contact" ? "active" : ""} href="/contact" onClick={goContact}>Contact</a>
        </div>
        <div className="s2-nav-right">
          <a className="s2-order-pill" href="/order" onClick={linkTo(navigate, "/order")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>
            Your order{quoteCount > 0 ? ` (${quoteCount})` : ""}
          </a>
          {supabaseEnabled && <ProfileMenu user={user} authLoading={authLoading} signInWithGoogle={signInWithGoogle} signOut={signOut} navigate={navigate} />}
        </div>
      </nav>
    </header>
  );
}

export function Footer({ navigate }) {
  return (
    <footer id="contact" className="s2-footer">
      <div className="s2-wrap s2-footer-inner">
        <div className="s2-footer-brand">
          <div className="s2-footer-name">Love's Blinds</div>
          <div className="s2-footer-text">Custom made-to-measure window treatments, shipped worldwide.</div>
        </div>
        <div className="s2-footer-contact">
          <div className="s2-footer-head">Questions?</div>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          <a href={SITE.phoneHref}>{SITE.phone}</a>
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

// ---- Lineup tiles ----------------------------------------------------------

// Photo, name and one-line description for each line on the home page and the Products page (copy from the approved mockup).
const TILES = {
  roller: { photo: "blackout", alt: "Charcoal blackout roller shade in a bedroom", name: "Roller Shades", text: "Clean and simple. Choose solar, screen view or full blackout fabric." },
  zebra: { photo: "zebra-dining", alt: "Beige zebra shade in a dining room", name: "Zebra Shades", text: "Alternating sheer and solid stripes. Slide them to let light in or close for privacy." },
  "shangri-la": { photo: "shangri-la", alt: "Shangri-La shade with soft fabric vanes between two sheers", name: "Shangri-La Shades", text: "Soft fabric vanes floating between two sheers. Tilt for gentle, even light." },
  roman: { photo: "roman", alt: "Linen Roman shade half raised in a dining room", name: "Roman Shades", text: "Soft fabric folds that stack neatly when raised. Warm and tailored." },
  cellular: { photo: "cellular", alt: "Grey cellular shade in a bedroom", name: "Cellular Shades", text: "Honeycomb cells trap air to help keep rooms comfortable. Top-down options available." },
  drapery: { photo: "drapery", alt: "Floor-to-ceiling sheer curtains in a bedroom", name: "Drapery", text: "Custom curtains and Dream Curtains, the walk-through sheer for patio doors." },
};
const TILE_SIZES = "(min-width: 1100px) 400px, (min-width: 700px) 45vw, 92vw";

function LineTile({ line, navigate }) {
  const path = `/products/${line.slug}`;
  const t = TILES[line.slug];
  return (
    <a className="s2-tile" href={path} onClick={linkTo(navigate, path)}>
      <div className="s2-tile-media">
        {t
          ? <SitePhoto name={t.photo} alt={t.alt} sizes={TILE_SIZES} />
          : <BrandPanel title={line.name} aspect="4 / 3" />}
      </div>
      <div className="s2-tile-body">
        <h3 className="s2-tile-name">{t?.name || line.name}</h3>
        <p className="s2-tile-text">{t?.text || line.blurb}</p>
        <span className="s2-tile-cta">Build yours →</span>
      </div>
    </a>
  );
}

function LineupGrid({ lines, navigate }) {
  return (
    <div className="s2-tiles">
      {lines.map(l => <LineTile key={l.id} line={l} navigate={navigate} />)}
    </div>
  );
}

// ---- Home ------------------------------------------------------------------

const STEPS = [
  ["Pick a style", "Shades, sheers and curtains, made for your window."],
  ["See your price", "Choose a color and enter your size. Your estimate updates as you go."],
  ["Send your order", "We check every detail and confirm your final price within 48 hours."],
  ["Delivered", "Made to your measurements and shipped in two to three weeks."],
];
const LIGHT = [
  { photo: "shangri-la", slug: "shangri-la", title: "Soft, glowing light", text: "Shangri-La, Zebra and sheer curtains" },
  { photo: "screen-view", slug: "roller", title: "Less glare, keep the view", text: "Solar and screen view roller shades" },
  { photo: "blackout", slug: "roller", title: "Dark for sleeping", text: "Blackout rollers and blackout cellular shades" },
];
const MEASURE = [
  ["Choose inside or outside mount", "Inside sits within the window frame. Outside covers the frame from the wall."],
  ["Measure the width in three places", "Top, middle and bottom. For inside mount, use the smallest number."],
  ["Measure the height in three places", "Left, center and right. For inside mount, use the largest number."],
];

export function HomePage({ navigate }) {
  const scrollTo = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
  return (
    <div className="page-fade home s2">
      <section className="s2-hero">
        <SitePhoto name="hero-living" alt="Living room with three windows dressed in matching light-filtering roller shades" sizes="100vw" eager className="s2-hero-img" />
        <div className="s2-hero-over">
          <div className="s2-wrap">
            <div className="s2-hero-card">
              <p className="s2-eyebrow">Custom made to measure</p>
              <h1>Six ways to dress a window.</h1>
              <p className="s2-hero-text">Pick a style, choose your color and size, and see your price as you build. Send us your order and we confirm the details within 48 hours.</p>
              <div className="s2-btn-row">
                <a className="s2-btn s2-btn-brass" href="/products" onClick={linkTo(navigate, "/products")}>Start your order</a>
                <a className="s2-btn s2-btn-line" href="#measure" onClick={scrollTo("measure")}>How to measure</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="s2-how" aria-label="How it works">
        <ol className="s2-wrap s2-how-grid">
          {STEPS.map(([t, d], n) => (
            <li key={t} className="s2-how-step">
              <span className="s2-how-num" aria-hidden="true">{n + 1}</span>
              <div><div className="s2-how-title">{t}</div><div className="s2-how-text">{d}</div></div>
            </li>
          ))}
        </ol>
      </section>

      <section id="products" className="s2-wrap s2-products" aria-labelledby="lineup-title">
        <div className="s2-sec-head">
          <div>
            <p className="s2-eyebrow">Our lineup</p>
            <h2 id="lineup-title" className="s2-h2">Find your style</h2>
          </div>
          <p className="s2-sec-text">Every piece is cut to your exact size. Tap a style to choose colors and see your price.</p>
        </div>
        <LineupGrid lines={activeLines()} navigate={navigate} />
      </section>

      <section className="s2-wrap s2-light" aria-labelledby="light-title">
        <div className="s2-sec-head">
          <div>
            <p className="s2-eyebrow">Not sure where to start?</p>
            <h2 id="light-title" className="s2-h2">Shop by how much light you want</h2>
          </div>
        </div>
        <div className="s2-light-grid">
          {LIGHT.map((c) => (
            <a key={c.title} className="s2-light-card" href={`/products/${c.slug}`} onClick={linkTo(navigate, `/products/${c.slug}`)}>
              <SitePhoto name={c.photo} alt="" sizes={TILE_SIZES} />
              <div className="s2-light-label">
                <div className="s2-light-title">{c.title}</div>
                <div className="s2-light-text">{c.text}</div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section id="measure" className="s2-measure" aria-labelledby="measure-title">
        <div className="s2-wrap s2-measure-grid">
          <div className="s2-measure-intro">
            <p className="s2-eyebrow s2-eyebrow-light">Measure at home</p>
            <h2 id="measure-title" className="s2-h2">Measuring takes about five minutes.</h2>
            <p className="s2-measure-text">All you need is a steel tape measure. Measure to the nearest 1/8 inch, and we double-check every size before anything is made.</p>
            <a className="s2-btn s2-btn-sand" href="/measure" onClick={linkTo(navigate, "/measure")}>Read the full guide</a>
          </div>
          <ol className="s2-measure-steps">
            {MEASURE.map(([t, d], n) => (
              <li key={t} className="s2-measure-step">
                <span className="s2-measure-num" aria-hidden="true">{n + 1}</span>
                <div><div className="s2-measure-title">{t}</div><div className="s2-measure-body">{d}</div></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Footer navigate={navigate} />
    </div>
  );
}

// ---- Products ----------------------------------------------------------------

export function ProductsPage({ navigate, location, setLocation }) {
  // The Indoor/Outdoor step only exists while more than one location has active lines.
  const locationStep = needsLocationStep();
  const locations = activeLocations();
  const lines = locationStep ? (location ? activeLinesIn(location) : []) : activeLines();

  return (
    <div className="page-fade">
      <section className="products-hero2">
        <div className="container">
          <div className="eyebrow">Our lineup</div>
          <h1 className="serif">Choose your style</h1>
          <p className="section-sub">Pick a line to see every fabric as a real swatch and build your order.</p>
          {locationStep && (
            <div className="location-cards">
              {locations.map(loc => (
                <button key={loc} className={`loc-card ${location === loc ? "selected" : ""}`} onClick={() => setLocation(loc)}>
                  <div className="loc-card-eyebrow">Location</div>
                  <h3 className="serif">{LOCATION_LABELS[loc]}</h3>
                  <div className="loc-card-meta"><span><strong>{activeLinesIn(loc).length}</strong> product lines</span></div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="container products-grid-wrap">
        <LineupGrid lines={lines} navigate={navigate} />
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}

export function OrdersPage({ navigate, orders, activeOrderId, openOrder, createOrder, renameOrder, deleteOrder, user, signOut, signInWithGoogle, supabaseEnabled, quoteCount, ordersLength, dbError }) {
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
    createOrder(name).then(o => { if (o) navigate('products'); });
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

        {dbError && (
          <div className="db-error-banner">
            <strong>Could not connect to your orders.</strong> {dbError}
            <br /><small>Try refreshing the page. If this keeps happening, contact us.</small>
          </div>
        )}

        {orders.length === 0 && !dbError ? (
          <div className="empty-state">
            <h3 className="serif">No orders yet.</h3>
            <p>Browse products and use "Add to Order" to get started.</p>
            <button className="btn btn-sage" onClick={() => navigate('products')} style={{ marginTop: 20 }}>
              Browse Products <ArrowRight />
            </button>
          </div>
        ) : orders.length === 0 ? null : (
          <div className="orders-grid">
            {orders.map(order => {
              const isActive = order.id === activeOrderId;
              const blinds = (order.items || []).reduce((n, it) => n + Math.max(1, it.qty || 1), 0);
              const itemCount = blinds;
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
                    {itemCount} blind{itemCount !== 1 ? 's' : ''}
                    {' · '}
                    {new Date(order.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  {sentEstimate(order) && <div className="order-card-meta order-card-est">{sentEstimate(order)}</div>}
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

export function MeasureGuidePage({ navigate, quoteCount }) {
  const [mountType, setMountType] = useState("inside");
  return (
    <div className="page-fade">
      <section className="measure-hero">
        <div className="container">
          <div className="section-eyebrow">Measure guide · 10 minutes</div>
          <h1 className="serif">Measure with <em>confidence.</em></h1>
          <p className="section-sub" style={{ maxWidth: 640 }}>You only need a steel tape, a pencil, and ten minutes. Measure every window even if they look identical, older houses rarely come square.</p>

          <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
            <button className="btn btn-sage btn-sm" onClick={() => navigate("quote")}>Skip guide · Start your order <ArrowRight size={14} /></button>
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
              <p>Unsure about a window, such as a bay, an arch, a French door or anything out of plumb? Send us a note or call and we will talk it through before you order.</p>
              <button className="btn btn-outline btn-sm" onClick={() => navigate("contact")}>Contact us <ArrowRight size={14} /></button>
            </div>
          </aside>

          <div className="measure-main">
            <div id="tools" className="measure-block">
              <h2 className="serif">1 · What you'll need</h2>
              <div className="measure-tools">
                {[
                  ["Steel tape", "At least 16 ft. Avoid cloth tapes, they stretch."],
                  ["Pencil & paper", "Or your phone's notes app. One line per window."],
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

            <figure className="measure-figure" style={{ margin: "0 0 28px" }}>
              <ExplainerImg name="measure/window-types" alt="Three window types: a sliding window, a French door and a casement window." />
              <figcaption>Measure every window, whatever its type.</figcaption>
            </figure>

            <div id="choose" className="measure-block">
              <h2 className="serif">2 · Choose inside or outside mount</h2>
              <p>Most windows accept either. <strong>Inside mount</strong> sits inside the window frame for a clean, recessed look, but needs at least 2 inches of depth. <strong>Outside mount</strong> covers the frame and trim, better for light control and for shallow frames.</p>

              <div className="measure-figures">
                <figure className="measure-figure">
                  <ExplainerImg name="measure/roman-measure-diagram" alt="Window diagram for shades. OM(W) and OM(H) are the outside mount width and height, IM(W) and IM(H) the inside mount width and height." eager />
                  <figcaption>Shades. OM = outside mount, IM = inside mount, W = width, H = height.</figcaption>
                </figure>
                <figure className="measure-figure">
                  <ExplainerImg name="measure/drapery-measure-diagram" alt="Window diagram for drapery showing the outside mount width and height and the drop to the floor." />
                  <figcaption>Drapery. OM = outside mount, W = width, H = height, with the drop to the floor.</figcaption>
                </figure>
              </div>

              <div className="mount-toggle">
                <button className={`mount-tab ${mountType === "inside" ? "active" : ""}`} onClick={() => setMountType("inside")}>
                  <div className="mount-tab-name">Inside mount</div>
                  <div className="mount-tab-desc">Recessed in the frame. Needs ≥ 2" depth.</div>
                </button>
                <button className={`mount-tab ${mountType === "outside" ? "active" : ""}`} onClick={() => setMountType("outside")}>
                  <div className="mount-tab-name">Outside mount</div>
                  <div className="mount-tab-desc">Covers the trim. Best for light control.</div>
                </button>
              </div>
            </div>

            <div id="steps" className="measure-block">
              <h2 className="serif">3 · {mountType === "inside" ? "Inside mount, step by step" : "Outside mount, step by step"}</h2>
              <div className="measure-steps">
                {(mountType === "inside" ? [
                  ["Measure width at 3 points", "Top, middle, and bottom of the frame opening. Record the smallest measurement. That's the one we'll cut to. Don't round up.", "Window opening · width × 3"],
                  ["Measure height at 3 points", "Left, center, and right of the opening, from the top of the frame to the sill. Use the longest measurement.", "Window opening · height × 3"],
                  ["Measure depth", "From the front face of the frame to the glass. We need at least 2 inches for most blinds; some products need 2.5–3 inches.", "Frame depth"],
                  ["Note any obstructions", "Window cranks, locks, alarm sensors, tile sills, anything that sticks into the frame.", "Obstructions"],
                ] : [
                  ["Decide overlap", "We recommend at least 2 inches of overlap on each side and 3 inches above the frame. More overlap = better light blocking.", "Wall area to cover"],
                  ["Measure final width", "From the outer edge of one trim to the outer edge of the other, plus your overlap. Measure once. Outside-mount widths don't vary.", "Total width incl. overlap"],
                  ["Measure final height", "From your chosen top point down to where you want the shade to end, either the sill, just past it, or all the way to the floor.", "Total height"],
                  ["Check for clearance", "Make sure there's wall space above and to the sides for mounting brackets, usually 1.5\" each direction.", "Bracket clearance"],
                ]).map(([t, d], i) => (
                  <div key={i} className="meas-step">
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
                <li><strong>Always record in inches, to the nearest 1/8 inch.</strong> Decimals are fine, just be consistent.</li>
                <li><strong>Don't make any deductions.</strong> Send us the raw window numbers.</li>
                <li><strong>Measure every window.</strong> Even if they look identical. Older houses rarely come square.</li>
                <li><strong>Write every window down as you go.</strong> You'll enter each width and height with your order.</li>
                <li><strong>Out of plumb?</strong> If a window's left and right heights differ by more than 1/4 inch, flag it in notes, we'll discuss options.</li>
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

export function ContactPage({ navigate, quoteCount }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="page-fade">
      <section className="contact-page container-narrow">
        <div className="section-eyebrow">Contact</div>
        <h1 className="serif section-title">Drop us a line.</h1>
        <p className="section-sub">Have a project in mind or a question about a fabric? Send us a note.</p>

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
            <div className="contact-detail-row"><div className="label">Phone</div><div className="val">{SITE.phone}</div></div>
            <div className="contact-detail-row"><div className="label">Email</div><div className="val">{SITE.email}</div></div>
          </aside>
        </div>
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}


// ---------------------------------------------------------------------------
// Edit profile (opened from the profile menu)
// ---------------------------------------------------------------------------
export function ProfilePage({ navigate, user, authLoading, signInWithGoogle, supabaseEnabled }) {
  const p = profileOf(user);
  const [name, setName] = useState(p?.name || "");
  const [phone, setPhone] = useState(p?.phone || "");
  const [shipTo, setShipTo] = useState(p?.shipTo || "");
  const [status, setStatus] = useState(null);     // null | "saving" | "saved" | error text
  const seeded = useRef(false);
  useEffect(() => {
    if (p && !seeded.current) { seeded.current = true; setName(p.name); setPhone(p.phone); setShipTo(p.shipTo); }
  }, [p]);

  const save = async (e) => {
    e.preventDefault();
    setStatus("saving");
    try { await saveProfile({ name, phone, shipTo }); setStatus("saved"); }
    catch (err) { setStatus(err?.message || "Could not save your profile. Please try again."); }
  };

  return (
    <div className="page-fade">
      <header className="line-head"><div className="container line-head-inner"><h1 className="serif">Your profile</h1></div></header>
      <div className="container-narrow" style={{ paddingBottom: 60 }}>
        {!supabaseEnabled && <p>Profiles are not available right now.</p>}
        {supabaseEnabled && !user && (
          <div className="config-group">
            <p style={{ color: "var(--ink-60)", marginBottom: 20 }}>{authLoading ? "One moment…" : "Sign in with Google to edit your profile."}</p>
            {!authLoading && <button className="btn btn-sage" onClick={signInWithGoogle}>Sign in with Google</button>}
          </div>
        )}
        {user && (
          <form onSubmit={save} className="profile-form">
            <div className="profile-form-head">
              {p.avatar ? <img src={p.avatar} alt="" width="56" height="56" referrerPolicy="no-referrer" className="profile-form-avatar" /> : <span className="profile-form-avatar profile-initials" aria-hidden="true">{p.initials}</span>}
              <div><strong>{p.email}</strong><div style={{ color: "var(--ink-60)", fontSize: 14 }}>Your Google account. Your picture and email come from Google.</div></div>
            </div>
            <div className="config-group">
              <label className="label" htmlFor="pf-name">Name</label>
              <input id="pf-name" className="input" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="config-group">
              <label className="label" htmlFor="pf-phone">Phone</label>
              <input id="pf-phone" className="input" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>
            <div className="config-group">
              <label className="label" htmlFor="pf-ship">Shipping address</label>
              <input id="pf-ship" className="input" type="text" autoComplete="street-address" value={shipTo} onChange={e => setShipTo(e.target.value)} placeholder="123 Main St, City, State" />
              <div className="choice-note">These fill in your order details automatically. You can still change them on each order.</div>
            </div>
            <div className="config-actions">
              <button className="btn btn-sage" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save profile"}</button>
              <button className="btn btn-outline" type="button" onClick={() => navigate("orders")}>Order history</button>
            </div>
            <div aria-live="polite" style={{ marginTop: 12, minHeight: 22 }}>
              {status === "saved" && <span style={{ color: "var(--sage)" }}>Saved.</span>}
              {status && status !== "saving" && status !== "saved" && <span role="alert" style={{ color: "#a33" }}>{status}</span>}
            </div>
          </form>
        )}
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}
