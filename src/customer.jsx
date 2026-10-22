import { useState, useEffect, useRef } from 'react';
import { activeLines, activeLinesIn, activeLocations, needsLocationStep, LOCATION_LABELS, MOUNTS, getMechanism } from './data/lines.js';
import { SITE } from './data/site.js';
import { summarize, describeItem, describeInternal, displayNameOf } from './lib/selection.js';
import { BrandPanel } from './components/Showcase.jsx';
import SitePhoto from './components/SitePhoto.jsx';
import { CATEGORY_ICONS, ArrowRight, XIcon } from './icons.jsx';
import { ExplainerImg } from './components/ExplainerImg.jsx';
import ProfileMenu from './components/ProfileMenu.jsx';
import GoogleSignIn from './components/GoogleSignIn.jsx';
import { CartIcon } from './icons.jsx';
import { profileOf, saveProfile, EMPTY_ADDRESS } from './lib/profile.js';
import { COUNTRIES } from './data/countries.js';
import { sentEstimate } from './lib/orders.js';
import SentOrderView from './orderview.jsx';

const linkTo = (navigate, path) => (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // let the browser open new tabs
  e.preventDefault();
  navigate(path);
};

// true while the window is at least this wide (re-checked when it changes)
function useWide(query) {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const f = () => setOn(m.matches);
    f(); m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [query]);
  return on;
}

export function Nav({ route, navigate, quoteCount, supabaseEnabled, user, signInWithGoogle, signOut, authLoading }) {
  const goContact = (e) => { e.preventDefault(); navigate("contact"); };
  // Google's own (personalized) button fits on desktop; on a phone the compact "Sign in" button keeps the bar on one line
  const roomy = useWide('(min-width: 760px)');
  return (
    <header className="s2-nav">
      <nav className="s2-nav-inner" aria-label="Main">
        <a className="s2-wordmark" href="/" onClick={linkTo(navigate, "/")}>Love's Blinds</a>
        <div className="s2-nav-links">
          <a className={route === "products" ? "active" : ""} href="/products" onClick={linkTo(navigate, "/products")}>Products</a>
          <a className={route === "measure" ? "active" : ""} href="/measure" onClick={linkTo(navigate, "/measure")}>How to measure</a>
          <a className={route === "contact" ? "active" : ""} href="/contact" onClick={goContact}>Contact</a>
        </div>
        <div className="s2-nav-right">
          <a className="s2-order-pill" href="/order" onClick={linkTo(navigate, "/order")} aria-label={quoteCount > 0 ? `Cart, ${quoteCount} item${quoteCount === 1 ? '' : 's'}` : 'Cart'}>
            <CartIcon size={18} />
            Cart{quoteCount > 0 ? ` (${quoteCount})` : ""}
          </a>
          {supabaseEnabled && (user
            ? <ProfileMenu user={user} authLoading={authLoading} signInWithGoogle={signInWithGoogle} signOut={signOut} navigate={navigate} />
            : <GoogleSignIn gis={roomy} text="signin" label="Sign in" disabled={authLoading} onFallback={signInWithGoogle} />)}
        </div>
      </nav>
    </header>
  );
}

export function Footer({ navigate, hideMessage = false }) {
  return (
    <footer id="contact" className="s2-footer">
      <div className="s2-wrap s2-footer-inner">
        <div className="s2-footer-brand">
          <div className="s2-footer-name">Love's Blinds</div>
          <div className="s2-footer-text">Custom made-to-measure window treatments, <strong>shipped worldwide</strong>.</div>
        </div>
        <div className="s2-footer-contact">
          <div className="s2-footer-head">Questions?</div>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          <a href={SITE.phoneHref}>{SITE.phone}</a>
          {!hideMessage && <a className="s2-footer-msg" href="/contact" onClick={linkTo(navigate, "/contact")}>Send us a message</a>}
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

function LineTile({ line, navigate, level = 3 }) {
  const H = `h${level}`;
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
        <H className="s2-tile-name">{t?.name || line.name}</H>
        <p className="s2-tile-text">{t?.text || line.blurb}</p>
        <span className="s2-tile-cta">Build yours →</span>
      </div>
    </a>
  );
}

function LineupGrid({ lines, navigate, level = 3 }) {
  return (
    <div className="s2-tiles">
      {lines.map(l => <LineTile key={l.id} line={l} navigate={navigate} level={level} />)}
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
  { photo: "blackout", slug: "roller", title: "Room darkening", text: "Good for bedrooms, nurseries and home theaters." },
];
const MEASURE = [
  ["Choose inside or outside mount", "Inside sits within the window frame. Outside covers the frame from the wall."],
  ["Measure the width in three places", "Top, middle and bottom. For inside mount, use the smallest number."],
  ["Measure the height in three places", "Left, center and right. For inside mount, use the largest number."],
];

export function HomePage({ navigate }) {
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
                <a className="s2-btn s2-btn-brass" href="/products" onClick={linkTo(navigate, "/products")}>Start shopping</a>
                <a className="s2-btn s2-btn-line" href="/measure" onClick={linkTo(navigate, "/measure")}>How to measure</a>
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
            <p className="s2-measure-text">All you need is a tape measure. Measure to the nearest 1/8 inch, and we double-check every size before anything is made.</p>
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
    <div className="page-fade s2 s2-inner">
      <section className="s2-wrap s2-page-head">
        <div>
          <p className="s2-eyebrow">Our lineup</p>
          <h1 className="s2-page-title">Choose your style</h1>
          <p className="s2-page-lede">Pick a line to see every fabric as a real swatch and build your cart.</p>
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
      <section className="s2-wrap s2-page-body">
        <LineupGrid lines={lines} navigate={navigate} level={2} />
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}

export function OrdersPage({ viewId, orderAgain, navigate, orders, activeOrderId, openOrder, createOrder, renameOrder, deleteOrder, user, signOut, signInWithGoogle, supabaseEnabled, quoteCount, ordersLength, dbError }) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  if (!supabaseEnabled) {
    return (
      <div className="page-fade s2 s2-inner">
        <section className="s2-wrap s2-page-head">
          <div>
            <p className="s2-eyebrow">Your account</p>
            <h1 className="s2-page-title">My orders</h1>
            <p className="s2-page-lede">Account features are not yet configured for this site.</p>
          </div>
        </section>
        <Footer navigate={navigate} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-fade s2 s2-inner">
        <section className="s2-wrap s2-page-head">
          <div>
            <p className="s2-eyebrow">Your account</p>
            <h1 className="s2-page-title">My orders</h1>
            <p className="s2-page-lede">Sign in with Google to save your orders and come back to them any time.</p>
            <button type="button" className="s2-btn s2-btn-brass s2-page-action" onClick={signInWithGoogle}>Sign in with Google</button>
          </div>
        </section>
        <Footer navigate={navigate} />
      </div>
    );
  }

  const viewing = viewId ? orders.find(o => o.id === viewId && o.status === 'sent') : null;
  if (viewing) return <SentOrderView order={viewing} navigate={navigate} orderAgain={orderAgain} />;

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
    <div className="page-fade s2 s2-inner">
      <section className="s2-wrap s2-page-body s2-orders">
        <div className="orders-page-header">
          <div>
            <p className="s2-eyebrow">{user.email}</p>
            <h1 className="s2-page-title">My orders</h1>
          </div>
          <div className="orders-page-actions">
            <button type="button" className="s2-btn s2-btn-brass" onClick={handleNewOrder}>+ New order</button>
            <button type="button" className="s2-btn s2-btn-line" onClick={signOut}>Sign out</button>
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
            <h2 className="s2-empty-title">No orders yet.</h2>
            <p>Browse products and use "Add to cart" to get started.</p>
            <button type="button" className="s2-btn s2-btn-brass" onClick={() => navigate('products')}>Browse products</button>
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

// Customers only measure. They never add or subtract anything: the overlap, the floor gap and any deductions are worked out on our side.
const INSIDE_STEPS = [
  ["Measure width at 3 points", "Top, middle, and bottom of the frame opening. Record the smallest measurement. That's the one we'll cut to. Don't round up.", "Window opening · measure in 3 places"],
  ["Measure height at 3 points", "Left, center, and right of the opening, from the top of the frame to the sill. Use the longest measurement.", "Window opening · measure in 3 places"],
  ["Measure depth", "From the front face of the frame to the glass. We need at least 2 inches for most blinds; some products need 2.5–3 inches.", "Frame depth"],
  ["Note any obstructions", "Window cranks, locks, alarm sensors, tile sills, anything that sticks into the frame.", "Obstructions"],
];
const OUTSIDE_STEPS = [
  ["Measure the width of the window frame", "From the outside edge of the frame on one side to the outside edge on the other. Measure at the top, middle and bottom, and use the widest number.", "Frame · outside edge to outside edge"],
  ["Measure the height of the frame", "From the top of the frame down to the bottom of the sill or frame. Measure at the left, middle and right, and use the longest number.", "Top of frame to bottom of sill or frame"],
  ["Note any obstructions", "Window cranks, handles, vents, or anything on the wall around the window, so we can talk through the options.", "Obstructions"],
];
const CURTAIN_STEPS = [
  ["Measure the width of the window or door", "From the outside edge of the frame on one side to the outside edge on the other. Measure at the top, middle and bottom, and use the widest number.", "Window or door · outside edge to outside edge"],
  ["Measure the height to the floor", "From the spot where the track or rod will go, straight down to the floor. Measure at the left, middle and right, and use the shortest number. Floors are rarely level.", "Track or rod to floor · measure in 3 places"],
  ["Note any obstructions", "Wall switches, vents, radiators, a baseboard heater or a door that swings into the space, so we can talk through the options.", "Obstructions"],
];
function MeasureStep({ n, title, text, tag }) {
  return (
    <div className="meas-step">
      <div>
        <div className="meas-step-num">Step {n}</div>
        <h3 className="serif">{title}</h3>
        <p>{text}</p>
        {tag && <span className="meas-step-tag">{tag}</span>}
      </div>
    </div>
  );
}

export function MeasureGuidePage({ navigate, quoteCount }) {
  return (
    <div className="page-fade s2 s2-inner">
      <section className="s2-wrap s2-page-head">
        <div>
          <p className="s2-eyebrow">Measuring guide · about 10 minutes</p>
          <h1 className="s2-page-title">Measure with confidence.</h1>
          <p className="s2-page-lede">You only need a tape measure, a pencil, and ten minutes. Measure every window even if they look identical, older houses rarely come square.</p>
          <a className="s2-btn s2-btn-brass s2-page-action" href="/products" onClick={linkTo(navigate, "/products")}>Skip the guide and start shopping</a>
        </div>
      </section>

      <section className="s2-wrap measure-content">
        <div className="measure-cols">
          <aside className="measure-toc">
            <div className="label">On this page</div>
            <ol className="measure-toc-list">
              <li><a href="#tools">What you'll need</a></li>
              <li><a href="#choose">Inside or outside mount</a></li>
              <li><a href="#inside">Inside mount steps</a></li>
              <li><a href="#outside">Outside mount steps</a></li>
              <li><a href="#curtains">Curtains and Dream Curtains</a></li>
              <li><a href="#tips">Tips &amp; tolerances</a></li>
              <li><a href="#submit">Submit your numbers</a></li>
            </ol>
            <div className="measure-toc-callout">
              <div className="label" style={{ color: "var(--sage-dark)" }}>Need help?</div>
              <p>Send us a note or call and we'd be happy to help!</p>
              <a className="s2-btn s2-btn-line" href="/contact" onClick={linkTo(navigate, "/contact")}>Contact us</a>
            </div>
          </aside>

          <div className="measure-main">
            <div id="tools" className="measure-block">
              <h2 className="serif">1 · What you'll need</h2>
              <div className="measure-tools">
                {[
                  ["Tape measure", "At least 16 ft. Avoid cloth tapes, they stretch."],
                  ["Pencil & paper", "Or your phone's notes app. One line per window."],
                  ["Step stool or ladder", "For tall windows. Don't measure on tiptoe."],
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
                  <ExplainerImg name="measure/drapery-measure-diagram" alt="Window diagram for drapery showing the outside mount width and height and the drop to the floor." eager />
                  <figcaption>Drapery. OM = outside mount, W = width, H = height, with the drop to the floor.</figcaption>
                </figure>
              </div>
            </div>

            <div id="inside" className="measure-block">
              <h2 className="serif">3 · Inside mount, step by step</h2>
              <div className="measure-steps">
                {INSIDE_STEPS.map(([t, d, tag], i) => <MeasureStep key={t} n={i + 1} title={t} text={d} tag={tag} />)}
              </div>
            </div>

            <div id="outside" className="measure-block">
              <h2 className="serif">4 · Outside mount, step by step</h2>
              <p className="measure-lead">Outside mount shades hang on the wall or trim and cover the window. <strong>Don't add anything for overlap, we'll add it for you.</strong></p>
              <div className="measure-steps">
                {OUTSIDE_STEPS.map(([t, d, tag], i) => <MeasureStep key={t} n={i + 1} title={t} text={d} tag={tag} />)}
              </div>
            </div>

            <div id="curtains" className="measure-block">
              <h2 className="serif">5 · Curtains and Dream Curtains, step by step</h2>
              <p className="measure-lead">Curtains and Dream Curtains hang from a track or rod, so you measure the width of the window or door and the drop to the floor. <strong>Don't add or subtract anything, we'll work out the overlap and floor gap.</strong></p>
              <div className="measure-steps">
                {CURTAIN_STEPS.map(([t, d, tag], i) => <MeasureStep key={t} n={i + 1} title={t} text={d} tag={tag} />)}
              </div>
            </div>

            <div id="tips" className="measure-block">
              <h2 className="serif">6 · Tips &amp; tolerances</h2>
              <ul className="measure-tips">
                <li><strong>Always record in inches, to the nearest 1/8 inch.</strong> Decimals are fine, just be consistent.</li>
                <li><strong>Don't make any deductions.</strong> Send us the raw window numbers.</li>
                <li><strong>Measure every window.</strong> Even if they look identical. Older houses rarely come square.</li>
                <li><strong>Write every window down as you go.</strong> You'll enter each width and height as you add blinds to your cart.</li>
                <li><strong>Out of plumb?</strong> If a window's left and right heights differ by more than 1/4 inch, flag it in notes, we'll discuss options.</li>
              </ul>
            </div>

            <div id="submit" className="measure-block measure-cta">
              <div>
                <h2 className="serif">Got your numbers?</h2>
                <p>Send them along with your product picks and we'll email your final price within 48 hours.</p>
              </div>
              <a className="s2-btn s2-btn-sand" href="/products" onClick={linkTo(navigate, "/products")}>Start shopping</a>
            </div>
          </div>
        </div>
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}

const CONTACT_TOPICS = ["General question", "Question about an order or estimate", "Trade / wholesale"];

export function ContactPage({ navigate }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", topic: CONTACT_TOPICS[0], subject: "", message: "", zx_kv_q7: "" });
  const [status, setStatus] = useState("idle");        // idle | sending | sent | failed
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => { setF((v) => ({ ...v, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: "" })); };

  const send = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.name.trim()) errs.name = "Please enter your name so we know who to reply to.";
    if (!f.email.trim()) errs.email = "Please enter your email so we can reply.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errs.email = "Please enter a valid email address, like name@example.com.";
    if (!f.message.trim()) errs.message = "Please write your message.";
    setErrors(errs);
    if (Object.keys(errs).length) { setStatus("idle"); setError(""); return; }
    setStatus("sending"); setError("");
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
      if (!res) throw new Error(`We could not reach our server. Please check your connection, or email us at ${SITE.email} or call ${SITE.phone}.`);
      const data = await res.json().catch(() => ({}));
      // "received" is only shown when the server says the message really went through
      if (!res.ok || data.ok !== true || data.emailed !== true) {
        if (data.fields && typeof data.fields === "object") { setErrors(data.fields); setStatus("idle"); return; }     // the server found a missing field: show it under the field
        throw new Error(data.error || `We could not send your message just now. Please email us at ${SITE.email} or call ${SITE.phone}.`);
      }
      setStatus("sent");
    } catch (err) {
      setError(err.message || `We could not send your message just now. Please email us at ${SITE.email} or call ${SITE.phone}.`);
      setStatus("failed");
    }
  };

  return (
    <div className="page-fade s2 s2-inner">
      <section className="s2-wrap s2-page-head">
        <div>
          <p className="s2-eyebrow">Contact</p>
          <h1 className="s2-page-title">Drop us a line.</h1>
          <p className="s2-page-lede">Have a project in mind or a question about a fabric? Send us a note.</p>
        </div>
      </section>
      <section className="contact-page s2-wrap s2-page-body">

        <div className="contact-grid">
          <div>
            {status === "sent"
              ? <div className="success-banner" role="status">
                  <h3 className="serif">Message received.</h3>
                  <p>One of us will reply within 1 business day.</p>
                </div>
              : <form className="quote-form" style={{ marginTop: 0 }} onSubmit={send} noValidate>
                  <div><label className="label" htmlFor="c-name">Name</label><input id="c-name" className={`input${errors.name ? " input-error" : ""}`} autoComplete="name" placeholder="Full name" value={f.name} onChange={set("name")} aria-invalid={!!errors.name} />{errors.name && <span className="field-error" role="alert">{errors.name}</span>}</div>
                  <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" className={`input${errors.email ? " input-error" : ""}`} type="email" autoComplete="email" placeholder="you@example.com" value={f.email} onChange={set("email")} aria-invalid={!!errors.email} />{errors.email && <span className="field-error" role="alert">{errors.email}</span>}</div>
                  <div><label className="label" htmlFor="c-phone">Phone (optional)</label><input id="c-phone" className="input" type="tel" autoComplete="tel" placeholder="(555) 555-5555" value={f.phone} onChange={set("phone")} /></div>
                  <fieldset className="full contact-topics">
                    <legend className="label">What's this about?</legend>
                    <div className="config-options">
                      {CONTACT_TOPICS.map((t) => (
                        <label key={t} className={`opt-btn${f.topic === t ? " selected" : ""}`}>
                          <input type="radio" name="topic" value={t} checked={f.topic === t} onChange={set("topic")} className="sr-only" />{t}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="full"><label className="label" htmlFor="c-subject">Subject (optional)</label><input id="c-subject" className="input" placeholder="Quick question about cellular shades…" value={f.subject} onChange={set("subject")} /></div>
                  <div className="full"><label className="label" htmlFor="c-message">Message</label><textarea id="c-message" className={`textarea${errors.message ? " input-error" : ""}`} rows="5" placeholder="Tell us a bit about your project." value={f.message} onChange={set("message")} aria-invalid={!!errors.message} />{errors.message && <span className="field-error" role="alert">{errors.message}</span>}</div>
                  {/* a field people never see; a bot that fills it in is ignored */}
                  <div className="spam-trap" aria-hidden="true"><label>Leave this empty<input type="text" name="zx_kv_q7" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.zx_kv_q7} onChange={set("zx_kv_q7")} /></label></div>
                  {status === "failed" && <div className="full send-error" role="alert">{error}</div>}
                  <div className="full"><button type="submit" className="s2-btn s2-btn-brass" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send message"}</button></div>
                </form>
            }
          </div>
          <aside className="contact-details">
            <h2 className="contact-details-title">Prefer to talk?</h2>
            <div className="contact-detail-row"><div className="label">Phone</div><div className="val"><a href={SITE.phoneHref}>{SITE.phone}</a></div></div>
            <div className="contact-detail-row"><div className="label">Email</div><div className="val"><a href={`mailto:${SITE.email}`}>{SITE.email}</a></div></div>
          </aside>
        </div>
      </section>
      <Footer navigate={navigate} hideMessage />
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
  const [addr, setAddr] = useState(p?.address || EMPTY_ADDRESS);
  const [status, setStatus] = useState(null);     // null | "saving" | "saved" | error text
  const setA = (k) => (e) => { setAddr((a) => ({ ...a, [k]: e.target.value })); setStatus(null); };
  const seeded = useRef(false);
  useEffect(() => {
    if (p && !seeded.current) { seeded.current = true; setName(p.name); setPhone(p.phone); setAddr(p.address); }
  }, [p]);

  const save = async (e) => {
    e.preventDefault();
    setStatus("saving");
    try { await saveProfile({ name, phone, address: addr }); setStatus("saved"); }
    catch (err) { setStatus(err?.message || "Could not save your profile. Please try again."); }
  };

  return (
    <div className="page-fade s2 s2-inner">
      <header className="s2-wrap s2-page-head">
        <div>
          <p className="s2-eyebrow">Your account</p>
          <h1 className="s2-page-title">Your profile</h1>
        </div>
      </header>
      <div className="s2-wrap s2-page-body s2-profile">
        {!supabaseEnabled && <p>Profiles are not available right now.</p>}
        {supabaseEnabled && !user && (
          <div className="s2-panel-box">
            <p className="s2-page-lede">{authLoading ? "One moment…" : "Sign in with Google to edit your profile."}</p>
            {!authLoading && <button type="button" className="s2-btn s2-btn-brass" onClick={signInWithGoogle}>Sign in with Google</button>}
          </div>
        )}
        {user && (
          <form onSubmit={save} className="profile-form">
            <div className="profile-form-head">
              {p.avatar ? <img src={p.avatar} alt="" width="56" height="56" referrerPolicy="no-referrer" className="profile-form-avatar" /> : <span className="profile-form-avatar profile-initials" aria-hidden="true">{p.initials}</span>}
              <div><strong>{p.email}</strong><div className="profile-form-note">Your Google account. Your picture and email come from Google.</div></div>
            </div>
            <div className="config-group">
              <label className="label" htmlFor="pf-name">Name</label>
              <input id="pf-name" className="input" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="config-group">
              <label className="label" htmlFor="pf-phone">Phone</label>
              <input id="pf-phone" className="input" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>
            <fieldset className="profile-address">
              <legend className="label">Shipping address</legend>
              <div className="profile-grid">
                <div className="profile-wide"><label className="label" htmlFor="pf-street">Street address</label>
                  <input id="pf-street" className="input" type="text" autoComplete="address-line1" value={addr.street} onChange={setA("street")} /></div>
                <div className="profile-wide"><label className="label" htmlFor="pf-apt">Apartment, suite, etc. (optional)</label>
                  <input id="pf-apt" className="input" type="text" autoComplete="address-line2" value={addr.apt} onChange={setA("apt")} /></div>
                <div><label className="label" htmlFor="pf-city">City</label>
                  <input id="pf-city" className="input" type="text" autoComplete="address-level2" value={addr.city} onChange={setA("city")} /></div>
                <div><label className="label" htmlFor="pf-state">State / province</label>
                  <input id="pf-state" className="input" type="text" autoComplete="address-level1" value={addr.state} onChange={setA("state")} /></div>
                <div><label className="label" htmlFor="pf-zip">ZIP / postal code</label>
                  <input id="pf-zip" className="input" type="text" autoComplete="postal-code" value={addr.zip} onChange={setA("zip")} /></div>
                <div><label className="label" htmlFor="pf-country">Country</label>
                  <select id="pf-country" className="input" autoComplete="country-name" value={addr.country} onChange={setA("country")}>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select></div>
              </div>
              <div className="choice-note">These fill in your order details automatically. You can still change them on each order.</div>
            </fieldset>
            <div className="config-actions">
              <button className="s2-btn s2-btn-brass" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save profile"}</button>
              <button className="s2-btn s2-btn-line" type="button" onClick={() => navigate("orders")}>Order history</button>
            </div>
            <div aria-live="polite" className="profile-status">
              {status === "saved" && <span className="profile-saved">Saved.</span>}
              {status && status !== "saving" && status !== "saved" && <span role="alert" className="profile-error">{status}</span>}
            </div>
          </form>
        )}
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}
