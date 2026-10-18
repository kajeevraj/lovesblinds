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
  { photo: "screen-view", slug: "roller", title: "Less glare, keep the view", text: "Solar and Screen View roller shades" },
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

export function OrderSummaryPage({ navigate, quoteItems, removeFromQuote, updateItem, activeOrder, user }) {
  return (
    <div className="page-fade">
      <section className="quote-page container-narrow">
        <div className="order-breadcrumb">
          <button className="nav-link" style={{ padding: 0, fontSize: 13 }} onClick={() => navigate("orders")}>← My Orders</button>
          {user && activeOrder && (
            <>
              <span className="order-breadcrumb-sep">·</span>
              <span className="order-breadcrumb-name">{activeOrder.name}</span>
            </>
          )}
        </div>

        <div className="section-eyebrow" style={{ marginTop: 12 }}>Order Summary</div>
        <h1 className="serif section-title">Your order.</h1>
        <p className="section-sub">Adjust controls, dimensions, and rooms right here, then continue to send us your contact details.</p>

        {quoteItems.length === 0 ? (
          <div className="empty-state">
            <h3 className="serif">Nothing in your order yet.</h3>
            <p>Browse our products and use "Add to Order" to build your list.</p>
            <button className="btn btn-outline" onClick={() => navigate("products")} style={{ marginTop: 20 }}>Browse Products <ArrowRight /></button>
          </div>
        ) : (
          <>
            <div className="quote-list">
              {quoteItems.map((it, idx) => (
                <QuoteRow key={idx} item={it} idx={idx} updateItem={updateItem} removeFromQuote={removeFromQuote} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
              <button className="btn btn-sage" onClick={() => navigate("review")} style={{ padding: "14px 28px" }}>
                Continue to Review <ArrowRight />
              </button>
            </div>
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 32, padding: "14px 18px", background: "var(--pale-sand)", borderLeft: "3px solid var(--sand)" }}>
          <div style={{ fontSize: 13, color: "var(--charcoal)", flex: 1 }}>
            <strong>Not sure how to measure?</strong> Our step-by-step guide covers inside &amp; outside mount, with tolerance tips.
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate("measure")}>Open Guide <ArrowRight size={14} /></button>
        </div>
      </section>
      <Footer navigate={navigate} />
    </div>
  );
}

function ItemThumb({ item }) {
  const [failed, setFailed] = useState(false);
  const pick = item.selection?.picks?.[0];
  if (pick?.thumb && !failed) {
    return <img className="quote-thumb" src={pick.thumb} alt={`${displayNameOf(pick)}, ${pick.code}`} width="72" height="72" loading="lazy" onError={() => setFailed(true)} />;
  }
  const Icon = CATEGORY_ICONS[item.product.icon];
  return <div className="quote-thumb quote-thumb-fallback" role="img" aria-label={item.product.name}>{pick?.code || (Icon ? <Icon /> : item.product.name)}</div>;
}

function QuoteRow({ item: it, idx, updateItem, removeFromQuote }) {
  const sum = summarize(it);
  const mechs = it.product.mechanisms;
  const mechKnown = mechs.some(m => m.id === it.mech);
  const mounts = it.product.mounts;

  const handleWidthChange = (v) => updateItem(idx, { width: v === "" ? null : parseFloat(v) });
  const handleLengthChange = (v) => updateItem(idx, { length: v === "" ? null : parseFloat(v) });

  return (
    <div className="quote-line">
      <ItemThumb item={it} />
      <div>
        <div className="quote-line-title">{sum.title}</div>
        <ul className="quote-line-parts">
          {sum.parts.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        <div className="quote-line-controls">
          <select className="select" aria-label="Control" value={it.mech} onChange={e => updateItem(idx, { mech: e.target.value })}>
            {!mechKnown && <option value={it.mech}>{it.mech}</option>}
            {mechs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="select" aria-label="Mount type" value={it.mount} onChange={e => updateItem(idx, { mount: e.target.value })}>
            {!mounts.includes(it.mount) && <option value={it.mount}>{it.mount}</option>}
            {mounts.map(mid => {
              const m = MOUNTS.find(x => x.id === mid);
              return <option key={mid} value={mid}>{m.name}</option>;
            })}
          </select>
          <input className="input" type="number" aria-label="Width (in)" placeholder="Width (in)" value={it.width ?? ""} onChange={e => handleWidthChange(e.target.value)} />
          <input className="input" type="number" aria-label="Length (in)" placeholder="Length (in)" value={it.length ?? ""} onChange={e => handleLengthChange(e.target.value)} />
          <input
            className="input"
            type="text"
            aria-label="Room"
            value={it.roomLabel || ""}
            onChange={e => updateItem(idx, { roomLabel: e.target.value })}
            placeholder="Room (optional)" />
        </div>
      </div>
      <div className="qty-stepper">
        <button aria-label="Decrease quantity" onClick={() => updateItem(idx, { qty: Math.max(1, it.qty - 1) })}>−</button>
        <span>{it.qty}</span>
        <button aria-label="Increase quantity" onClick={() => updateItem(idx, { qty: it.qty + 1 })}>+</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="quote-line-rm" onClick={() => removeFromQuote(idx)} title="Remove" aria-label="Remove item"><XIcon /></button>
      </div>
    </div>
  );
}

function ReviewLine({ it, showCode }) {
  const sum = summarize(it);
  const itemMech = getMechanism(it.product, it.mech);
  return (
    <div className="quote-line">
      <ItemThumb item={it} />
      <div>
        <div className="quote-line-title">{sum.title}</div>
        <ul className="quote-line-parts">
          {sum.parts.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        <div className="quote-line-meta">
          {itemMech?.name || it.mech} · {MOUNTS.find(m => m.id === it.mount)?.name || it.mount}
          {it.width && ` · ${it.width}"W × ${it.length || it.height}"H`}
          {it.roomLabel && <span style={{ marginLeft: 8, color: "var(--sage-dark)", fontSize: 12 }}>{it.roomLabel}</span>}
        </div>
      </div>
      <div className="qty-stepper" style={{ pointerEvents: "none" }}>
        <button tabIndex={-1}>−</button><span>{it.qty}</span><button tabIndex={-1}>+</button>
      </div>
    </div>
  );
}

export function ReviewOrderPage({ navigate, quoteItems, activeOrderId, onOrderSent, onSubmitted, user }) {
  const items = quoteItems;
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

  // start from the customer's saved profile (only fills fields they have not typed into)
  useEffect(() => {
    const p = profileOf(user);
    if (!p) return;
    setName(v => v || p.name); setEmail(v => v || p.email); setPhone(v => v || p.phone); setShipTo(v => v || p.shipTo);
  }, [user]);

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
        lines: items.map(it => {
          const sum = summarize(it);
          return {
            code: sum.codes.length ? sum.codes.join(", ") : (it.code || null),
            codes: sum.codes,
            colorName: sum.colorText || it.colorName || it.variant,     // customer wording: display name and code
            category: it.category || it.product.id,
            productName: it.product.name,                                 // lets the server rebuild the text from catalog data
            section: it.selection?.section || null,
            description: describeItem(it),                                // customer wording, used in the customer email
            internalDescription: describeInternal(it),                    // supplier collection, color name and code, for us only
            internalPicks: (it.selection?.picks || []).map(p => ({ line: p.line, role: p.role, code: p.code, displayName: displayNameOf(p), supplierColor: p.colorName ?? null, collection: p.fabric, style: p.style })),
            details: sum.parts,
            selection: it.selection || null,
            mechId: it.mech,
            mechName: getMechanism(it.product, it.mech)?.name || it.mech,
            mountId: it.mount,
            width: it.width || null,
            length: it.length || it.height || null,
            qty: it.qty,
            location: it.location || it.product.location,
            roomLabel: it.roomLabel || '',
          };
        }),
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
      onSubmitted?.();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-fade">
        <section className="quote-page container-narrow">
          <div className="success-banner">
            <h3 className="serif">Order request sent.</h3>
            <p>We'll reply to <strong>{review.email}</strong> with your quote within 48 hours. If you don't see it, check your junk folder or call {SITE.phone}.</p>
          </div>
          <button className="btn btn-outline" style={{ marginTop: 24 }} onClick={() => navigate("home")}>Back to Home</button>
        </section>
        <Footer navigate={navigate} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page-fade">
        <section className="quote-page container-narrow">
          <div className="empty-state">
            <h3 className="serif">Nothing to review yet.</h3>
            <p>Add items to your order first.</p>
            <button className="btn btn-outline" onClick={() => navigate("products")} style={{ marginTop: 20 }}>Browse Products <ArrowRight /></button>
          </div>
        </section>
        <Footer navigate={navigate} />
      </div>
    );
  }

  if (review) {
    const customer = review;
    return (
      <div className="page-fade">
        <section className="quote-page container-narrow">
          <div className="order-breadcrumb">
            <button className="nav-link" style={{ padding: 0, fontSize: 13 }} onClick={() => { setReview(null); setSubmitError(null); }}>← Edit details</button>
          </div>

          <div className="success-banner" style={{ marginTop: 20, marginBottom: 32 }}>
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
            {items.map((it, idx) => <ReviewLine key={idx} it={it} showCode />)}
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
        </section>
        <Footer navigate={navigate} />
      </div>
    );
  }

  const handleSubmit = () => {
    const errs = {};
    if (!name.trim()) errs.name = "Required";
    if (!email.trim()) errs.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Enter a valid email";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setReview({ name: name.trim(), email: email.trim(), phone: phone.trim(), shipTo: shipTo.trim(), callTime, measureMethod, notes: notes.trim() });
  };

  return (
    <div className="page-fade">
      <section className="quote-page container-narrow">
        <div className="order-breadcrumb">
          <button className="nav-link" style={{ padding: 0, fontSize: 13 }} onClick={() => navigate("quote")}>← Back to Order Summary</button>
        </div>

        <div className="section-eyebrow" style={{ marginTop: 12 }}>Review Your Order</div>
        <h1 className="serif section-title">Where should we send your quote?</h1>
        <p className="section-sub">We'll never share your contact information.</p>

        <h4 className="serif" style={{ fontSize: 20, margin: "24px 0 14px" }}>Items ({items.length})</h4>
        <div className="quote-list">
          {items.map((it, idx) => <ReviewLine key={idx} it={it} />)}
        </div>

        <div className="quote-form" style={{ marginTop: 32 }}>
          <div>
            <div className="label">Name{errors.name && <span className="field-error">: {errors.name}</span>}</div>
            <input className={`input${errors.name ? " input-error" : ""}`} placeholder="Full name" value={name} onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: "" })); }} />
          </div>
          <div>
            <div className="label">Email{errors.email && <span className="field-error">: {errors.email}</span>}</div>
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
              {["I'll measure myself", "Not sure yet"].map(opt => (
                <button key={opt} className={`opt-btn${measureMethod === opt ? " selected" : ""}`} onClick={() => setMeasureMethod(opt)}>{opt}</button>
              ))}
            </div>
          </div>
          <div className="full">
            <div className="label">Notes: rooms, timing, anything we should know</div>
            <textarea className="textarea" placeholder="e.g. Bay window in the living room, master bedroom needs full blackout." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="full">
            <button className="btn btn-sage" onClick={handleSubmit} style={{ padding: "14px 28px" }}>Review & Send <ArrowRight /></button>
          </div>
        </div>
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
