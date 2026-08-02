import React, { useState } from 'react';
import {
  PRODUCTS, SUPPLIERS, RECENT_QUOTES, MOUNTS, SETTINGS,
  MECHANISM_TEMPLATES, SHIPPING_LABELS,
  photoCountForProduct, totalCombosForProduct,
} from './data.js';
import { hasRealPhoto } from './lib/photos.js';
import { CATEGORY_ICONS, ChevDown, Plus, XIcon, ArrowRight } from './icons.jsx';
import { PhotoPH } from './customer.jsx';

export function AdminGate({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const submit = (e) => {
    if (e) e.preventDefault();
    if (pw.length >= 1) onUnlock();
    else setErr(true);
  };
  return (
    <div className="gate-bg">
      <form className="gate-modal" onSubmit={submit}>
        <span className="wordmark"><span className="w-loves" style={{ fontStyle: "italic", fontWeight: 500 }}>Love's</span><span className="w-blinds"> Blinds</span></span>
        <h3>Admin Portal</h3>
        <div className="label">Password</div>
        <input className="input" type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false); }} placeholder="••••••••" autoFocus />
        {err && <div style={{ color: "#a8513f", fontSize: 12, marginTop: 8 }}>Incorrect password.</div>}
        <button className="btn btn-primary" type="submit" style={{ marginTop: 20, width: "100%" }}>Unlock</button>
        <div className="gate-hint">Mockup — any password works</div>
      </form>
    </div>
  );
}

export function AdminShell({ page, setPage, onExit, children }) {
  const items = [
    ["dashboard", "Dashboard"],
    ["products", "Products"],
    ["pricing", "Pricing"],
    ["mechanisms", "Mechanisms"],
    ["suppliers", "Suppliers"],
    ["inbox", "Quote Inbox", 4],
    ["settings", "Settings"],
  ];
  return (
    <div className="admin-body">
      <header className="admin-header">
        <span className="wordmark"><span style={{ fontStyle: "italic", fontWeight: 500 }}>Love's</span><span> Blinds</span></span>
        <span className="admin-tag">Admin</span>
        <div className="admin-header-right">
          <span>Logged in as <strong style={{ color: "var(--warm-white)" }}>Jamie L.</strong></span>
          <button onClick={onExit} style={{ background: "none", border: "1px solid rgba(247,244,239,0.2)", color: "rgba(247,244,239,0.7)", padding: "6px 12px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", borderRadius: 2 }}>View Site →</button>
        </div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-side-eyebrow">Menu</div>
          <div className="admin-side-section">
            {items.map(([id, label, count]) => (
              <button key={id} className={`admin-side-link ${page === id ? "active" : ""}`} onClick={() => setPage(id)}>
                {label}
                {count > 0 && <span className="dot" />}
              </button>
            ))}
          </div>
        </aside>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  return (
    <div className="page-fade">
      <div className="admin-page-header">
        <div>
          <h1 className="serif admin-page-title">Studio dashboard</h1>
          <div className="admin-page-sub">Quick look at how the shop is doing this month.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline btn-sm">Export Report</button>
          <button className="btn btn-sage btn-sm">+ New Quote</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-lbl">Quotes this month</div><div className="kpi-num">38</div><div className="kpi-trend">+12% vs. April</div></div>
        <div className="kpi"><div className="kpi-lbl">Booked revenue</div><div className="kpi-num">$48.2k</div><div className="kpi-trend">+8% vs. April</div></div>
        <div className="kpi"><div className="kpi-lbl">Avg. margin</div><div className="kpi-num">41%</div><div className="kpi-trend">+1pt vs. April</div></div>
      </div>

      <div className="admin-card">
        <h3 className="serif">Recent activity</h3>
        <div className="activity-list">
          {[
            ["09:42", "Quote Q-2034 submitted by Sarah Whitfield · DIY measured", "$1,840"],
            ["yest.", "Quote Q-2033 marked In Review", "$2,210"],
            ["yest.", "Quote Q-2032 confirmed → ordered with Hunter Mill", "$8,640"],
            ["May 6", "Pricing updated · Roller Shades base $9.50/sqft", "—"],
            ["May 6", "New configuration photos uploaded · Cellular Blackout", "+4 photos"],
            ["May 5", "Quote Q-2030 confirmed → ordered with Pacific Shade · Express shipping", "$3,120"],
          ].map((row, i) => (
            <div className="activity-row" key={i}>
              <span className="activity-time">{row[0]}</span>
              <span>{row[1]}</span>
              <span className="activity-amt">{row[2]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminProducts() {
  const [editingId, setEditingId] = useState(null);

  if (editingId) {
    const p = PRODUCTS.find(x => x.id === editingId);
    return <AdminProductEditor product={p} onBack={() => setEditingId(null)} />;
  }
  return (
    <div className="page-fade">
      <div className="admin-page-header">
        <div>
          <h1 className="serif admin-page-title">Products</h1>
          <div className="admin-page-sub">Manage product lines, mechanisms, variants, and configuration photos.</div>
        </div>
        <button className="btn btn-sage btn-sm">+ Add Product</button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Location</th>
            <th>Mechanisms</th>
            <th>Photos</th>
            <th>Variants</th>
            <th>Visible</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {PRODUCTS.map(p => {
            const photos = photoCountForProduct(p);
            const total = totalCombosForProduct(p);
            const photoClass = photos === 0 ? "warn" : photos < total / 3 ? "" : "ok";
            return (
              <tr key={p.id}>
                <td><div className="pname">{p.name}</div>{p.badge && <span className="chip" style={{ marginTop: 4 }}>{p.badge}</span>}</td>
                <td style={{ textTransform: "capitalize", fontSize: 13 }}>{p.location}</td>
                <td><span style={{ fontSize: 13 }}>{p.mechanisms.length} configured</span><div style={{ fontSize: 11, color: "var(--ink-60)", marginTop: 2 }}>{p.mechanisms.slice(0, 2).map(m => m.code).join(" · ")}{p.mechanisms.length > 2 && " · …"}</div></td>
                <td><span className={`photo-count ${photoClass}`}>{photos === 0 ? "No photos" : `${photos} of ${total}`}</span></td>
                <td>{p.variants.length}</td>
                <td><button className={`toggle ${p.visible ? "on" : ""}`} onClick={e => e.preventDefault()} /></td>
                <td><button className="edit-btn" onClick={() => setEditingId(p.id)}>Edit →</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdminProductEditor({ product, onBack }) {
  const [tab, setTab] = useState("details");
  const [variants, setVariants] = useState(product.variants);
  const [features, setFeatures] = useState(product.features);
  const [mechanisms, setMechanisms] = useState(product.mechanisms);
  const [mounts, setMounts] = useState(product.mounts);
  const [visible, setVisible] = useState(product.visible);
  const [featured, setFeatured] = useState(product.featured);

  const Icon = CATEGORY_ICONS[product.category];

  return (
    <div className="page-fade">
      <div style={{ marginBottom: 14 }}>
        <button className="nav-link" style={{ fontSize: 12 }} onClick={onBack}>← All products</button>
      </div>
      <div className="admin-page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 48, background: "var(--pale-sage)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--charcoal)" }}><Icon /></div>
          <div>
            <h1 className="serif admin-page-title" style={{ marginBottom: 2 }}>{product.name}</h1>
            <div className="admin-page-sub" style={{ marginBottom: 0 }}>Editing product · {variants.length} variants · {mechanisms.length} mechanisms · {photoCountForProduct(product)} of {totalCombosForProduct(product)} configuration photos</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-sm">Discard</button>
          <button className="btn btn-sage btn-sm">Save Changes</button>
        </div>
      </div>

      <div className="editor-tabs">
        <button className={`editor-tab ${tab === "details" ? "active" : ""}`} onClick={() => setTab("details")}>1 · Product details</button>
        <button className={`editor-tab ${tab === "mechs" ? "active" : ""}`} onClick={() => setTab("mechs")}>2 · Mechanisms</button>
        <button className={`editor-tab ${tab === "photos" ? "active" : ""}`} onClick={() => setTab("photos")}>3 · Configuration photos</button>
      </div>

      {tab === "details" && (
        <div className="admin-card">
          <div className="fieldset">
            <h4 className="serif">Identity</h4>
            <div className="fld-grid-2">
              <div><div className="label">Name</div><input className="input" defaultValue={product.name} /></div>
              <div><div className="label">Location</div>
                <select className="select" defaultValue={product.location}><option value="indoor">Indoor</option><option value="outdoor">Outdoor</option></select>
              </div>
              <div><div className="label">Badge (optional)</div><input className="input" defaultValue={product.badge || ""} placeholder="e.g. Bestseller" /></div>
              <div style={{ display: "flex", alignItems: "end", gap: 24 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <button className={`toggle ${featured ? "on" : ""}`} onClick={e => { e.preventDefault(); setFeatured(!featured); }} />
                  <span style={{ fontSize: 13 }}>Featured on home</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <button className={`toggle ${visible ? "on" : ""}`} onClick={e => { e.preventDefault(); setVisible(!visible); }} />
                  <span style={{ fontSize: 13 }}>Visible on site</span>
                </label>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="label">Description</div>
              <textarea className="textarea" defaultValue={product.description} />
            </div>
          </div>

          <div className="fieldset">
            <h4 className="serif">Variants & features</h4>
            <div className="fld-grid-2">
              <div>
                <div className="label">Variants</div>
                <TagInput tags={variants} setTags={setVariants} placeholder="Add a variant…" />
              </div>
              <div>
                <div className="label">Feature bullets</div>
                <TagInput tags={features} setTags={setFeatures} placeholder="Add a feature…" />
              </div>
            </div>
          </div>

          <div className="fieldset">
            <h4 className="serif">Mechanisms <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-60)", fontWeight: 400 }}>· {mechanisms.length} configured</span></h4>
            <p style={{ fontSize: 13, color: "var(--ink-60)", margin: "0 0 14px" }}>Edit the mechanisms shown for this product on the customer site. Tap a row to edit name and upcharge — these override the template defaults.</p>
            <MechanismEditor mechanisms={mechanisms} setMechanisms={setMechanisms} />
          </div>

          <div className="fieldset">
            <h4 className="serif">Mount types supported</h4>
            <div className="fld-grid-2">
              {MOUNTS.map(m => {
                const on = mounts.includes(m.id);
                return (
                  <label key={m.id} className={`check-card ${on ? "checked" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => {
                      setMounts(on ? mounts.filter(x => x !== m.id) : [...mounts, m.id]);
                    }} />
                    <div>
                      <div>{m.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-60)" }}>{m.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="fieldset" style={{ marginBottom: 0 }}>
            <h4 className="serif">Supply & cost</h4>
            <div className="fld-grid-3">
              <div><div className="label">Supplier</div>
                <select className="select" defaultValue={product.supplier}>
                  {SUPPLIERS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><div className="label">Lead time</div><input className="input" defaultValue={product.lead} /></div>
              <div><div className="label">Base cost per sq ft</div><input className="input" type="number" defaultValue={product.baseCost} step="0.5" /></div>
            </div>
          </div>
        </div>
      )}

      {tab === "mechs" && (
        <div className="admin-card">
          <h3 className="serif" style={{ fontSize: 24, marginBottom: 6 }}>Mechanisms for {product.name}</h3>
          <p style={{ color: "var(--ink-60)", fontSize: 13, marginTop: 0, marginBottom: 22, maxWidth: 720 }}>
            Each product has its own list of mechanisms — for example, Shangri-La offers remote wand and Matter motor, while Roller offers freestop, chain, and motors. Customers see only the mechanisms listed here. Override the name or upcharge to differ from the template.
          </p>
          <MechanismEditor mechanisms={mechanisms} setMechanisms={setMechanisms} />
        </div>
      )}

      {tab === "photos" && <ConfigPhotoMatrix product={product} colors={product.colors || []} mechanisms={mechanisms} mounts={mounts} />}
    </div>
  );
}

function MechanismEditor({ mechanisms, setMechanisms }) {
  const [picking, setPicking] = useState("");

  const updateMech = (id, patch) => {
    setMechanisms(mechanisms.map(m => m.id === id ? { ...m, ...patch } : m));
  };
  const removeMech = (id) => setMechanisms(mechanisms.filter(m => m.id !== id));
  const addMech = () => {
    if (!picking) return;
    const t = MECHANISM_TEMPLATES.find(x => x.id === picking);
    if (!t || mechanisms.some(m => m.id === t.id)) { setPicking(""); return; }
    setMechanisms([...mechanisms, { id: t.id, code: t.code, name: t.name, upcharge: t.defaultUpcharge, desc: t.desc }]);
    setPicking("");
  };

  const available = MECHANISM_TEMPLATES.filter(t => !mechanisms.some(m => m.id === t.id));

  return (
    <div className="mech-editor">
      <div className="mech-editor-row header">
        <div>Display name</div>
        <div>Code</div>
        <div>Description</div>
        <div>Upcharge</div>
        <div></div>
      </div>
      {mechanisms.map(m => (
        <div key={m.id} className="mech-editor-row">
          <input className="input" value={m.name} onChange={e => updateMech(m.id, { name: e.target.value })} />
          <input className="input" value={m.code} onChange={e => updateMech(m.id, { code: e.target.value.toUpperCase() })} maxLength={4} style={{ fontFamily: "ui-monospace,monospace" }} />
          <input className="input" value={m.desc || ""} onChange={e => updateMech(m.id, { desc: e.target.value })} placeholder="Customer-facing description" />
          <div className="upcharge-input">
            <span>+$</span>
            <input className="input" type="number" value={m.upcharge} onChange={e => updateMech(m.id, { upcharge: parseFloat(e.target.value) || 0 })} />
          </div>
          <button className="mech-rm-btn" onClick={() => removeMech(m.id)} title="Remove from this product"><XIcon size={16} /></button>
        </div>
      ))}
      {mechanisms.length === 0 && (
        <div className="mech-editor-row" style={{ gridTemplateColumns: "1fr", color: "var(--ink-60)", fontStyle: "italic", padding: "24px 14px" }}>
          No mechanisms configured. Add one below — customers can't select this product without at least one mechanism.
        </div>
      )}
      <div className="mech-add-bar">
        <span style={{ fontSize: 12, color: "var(--ink-60)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Add from catalog:</span>
        <select className="select" value={picking} onChange={e => setPicking(e.target.value)}>
          <option value="">Pick a mechanism template…</option>
          {available.map(t => <option key={t.id} value={t.id}>{t.name} · +${t.defaultUpcharge}</option>)}
        </select>
        <button className="btn btn-sage btn-sm" onClick={addMech} disabled={!picking}><Plus size={12} /> Add</button>
        <span style={{ fontSize: 12, color: "var(--ink-40)" }}>or</span>
        <button className="btn btn-outline btn-sm" onClick={() => {
          const id = "custom_" + Date.now();
          setMechanisms([...mechanisms, { id, code: "NEW", name: "New mechanism", upcharge: 0, desc: "" }]);
        }}>+ Add custom</button>
      </div>
    </div>
  );
}

function TagInput({ tags, setTags, placeholder }) {
  const [v, setV] = useState("");
  const submit = () => {
    const t = v.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setV("");
  };
  return (
    <div className="tag-input">
      {tags.map(t => (
        <span key={t} className="tag-pill">{t}<button onClick={() => setTags(tags.filter(x => x !== t))}>×</button></span>
      ))}
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} placeholder={placeholder} />
    </div>
  );
}

function ConfigPhotoMatrix({ product, colors, mechanisms, mounts }) {
  const [collapsed, setCollapsed] = useState({});
  const photos = photoCountForProduct(product);
  const total = colors.length * mechanisms.length * mounts.length;

  if (colors.length === 0) {
    return (
      <div className="admin-card">
        <p style={{ color: "var(--ink-60)", margin: 0 }}>No supplier colors loaded for this product yet. Photos are indexed by color code — add colors in <strong>catalog.js</strong> to start tracking coverage.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-card" style={{ marginBottom: 16, background: "var(--pale-sage)", border: "1px solid rgba(74,94,78,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div>
            <h4 className="serif" style={{ marginBottom: 6, fontSize: 20 }}>Configuration photo matrix</h4>
            <p style={{ fontSize: 13, color: "var(--charcoal)", margin: 0, maxWidth: 640 }}>
              Each photo is tied to one specific <em>color + mechanism + mount</em> combination — when a customer picks a color on the site, the photo updates live to match. Missing combos fall back to the closest available photo.
            </p>
          </div>
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 32, color: "var(--sage-dark)", lineHeight: 1 }}>{photos} <span style={{ color: "var(--ink-60)", fontSize: 18 }}>/ {total}</span></div>
            <div style={{ fontSize: 11, color: "var(--sage-dark)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>combinations photographed</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button className="btn btn-outline btn-sm" onClick={() => {
            const all = {}; colors.forEach(c => { all[c.code] = true; }); setCollapsed(all);
          }}>Collapse all</button>
          <button className="btn btn-outline btn-sm" onClick={() => setCollapsed({})}>Expand all</button>
          <button className="btn btn-sage btn-sm" style={{ marginLeft: "auto" }}>+ Bulk upload</button>
        </div>
      </div>

      <div className="config-matrix">
        {colors.map(color => {
          const isCollapsed = !!collapsed[color.code];
          const colorPhotos = mechanisms.reduce((sum, m) => sum + mounts.reduce((s, mt) => s + (hasRealPhoto(product.category, color.code, m.id, mt) ? 1 : 0), 0), 0);
          const colorTotal = mechanisms.length * mounts.length;
          return (
            <div key={color.code} className={`variant-group ${isCollapsed ? "collapsed" : ""}`}>
              <button className="variant-header" onClick={() => setCollapsed({ ...collapsed, [color.code]: !isCollapsed })}>
                <div className="variant-chev"><ChevDown size={16} /></div>
                <div className="variant-name">{color.name || color.code}{color.collection ? ` · ${color.collection}` : ""}</div>
                <div className="variant-meta">{colorPhotos} of {colorTotal} photographed</div>
                <span className="badge" style={{ background: colorPhotos === colorTotal ? "var(--sage)" : colorPhotos === 0 ? "rgba(168,81,63,0.15)" : "var(--sand)", color: colorPhotos === 0 ? "#a8513f" : colorPhotos === colorTotal ? "var(--warm-white)" : "var(--charcoal)" }}>
                  {colorPhotos === colorTotal ? "Complete" : colorPhotos === 0 ? "Missing" : "Partial"}
                </span>
              </button>
              <div className="variant-rows">
                {mechanisms.flatMap(m => mounts.map(mountId => {
                  const mount = MOUNTS.find(x => x.id === mountId);
                  const has = hasRealPhoto(product.category, color.code, m.id, mountId);
                  return (
                    <div key={`${m.id}-${mountId}`} className="combo-row">
                      <PhotoPH
                        label={has ? "Uploaded" : "No photo"}
                        sub={has ? "tap to replace" : "click to upload"}
                        className={has ? "" : "empty"}
                      />
                      <div className="combo-label">
                        <div className="combo-mech">{color.name || color.code} · {m.name}</div>
                        <div className="combo-mount">{mount.name}</div>
                      </div>
                      <div className="combo-price-input">
                        <span>$</span>
                        <input className="input" placeholder="override" type="number" />
                      </div>
                      <div className="combo-notes">
                        <input className="input" placeholder="Internal notes (e.g. swatch ref, photographer)" />
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminPricing() {
  return (
    <div className="page-fade">
      <div className="admin-page-header">
        <div>
          <h1 className="serif admin-page-title">Pricing</h1>
          <div className="admin-page-sub">Set base cost per sq ft and margin per product. Live sell price = cost ÷ (1 − margin).</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
          <div>
            <div className="label">Global default margin</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input className="input" type="number" defaultValue={SETTINGS.globalMargin} style={{ width: 80 }} /><span>%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pricing-table">
        <div className="pricing-row header">
          <div>Product</div>
          <div>Cost / sq ft</div>
          <div>Margin %</div>
          <div>Sell / sq ft</div>
          <div>Status on site</div>
        </div>
        {PRODUCTS.map(p => {
          const sell = p.baseCost > 0 ? (p.baseCost / (1 - p.margin)).toFixed(2) : null;
          return (
            <div key={p.id} className="pricing-row">
              <div className="pname">{p.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span>$</span><input className="input" type="number" defaultValue={p.baseCost} step="0.5" /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><input className="input" type="number" defaultValue={Math.round(p.margin * 100)} /><span>%</span></div>
              <div>{sell ? <span className="sell-price">${sell}</span> : <span className="no-price">—</span>}</div>
              <div>
                {sell
                  ? <span className="chip">Live · price shown</span>
                  : <span className="chip-outline chip">Contact us for pricing</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-card" style={{ marginTop: 24 }}>
        <h3 className="serif">Option upcharges</h3>
        <p style={{ color: "var(--ink-60)", fontSize: 13, marginTop: 0 }}>Applied across products. Per-product mechanism upcharges live in the product editor.</p>
        <div className="fld-grid-3">
          <div><div className="label">Outside mount</div><div style={{ display: "flex", alignItems: "center", gap: 6 }}>$<input className="input" type="number" defaultValue={0} /></div></div>
          <div><div className="label">Blackout lining</div><div style={{ display: "flex", alignItems: "center", gap: 6 }}>$<input className="input" type="number" defaultValue={35} /></div></div>
          <div><div className="label">Professional install</div><div style={{ display: "flex", alignItems: "center", gap: 6 }}>$<input className="input" type="number" defaultValue={45} /></div></div>
        </div>
      </div>
    </div>
  );
}

export function AdminMechanisms() {
  const [expanded, setExpanded] = useState(() => Object.fromEntries(PRODUCTS.slice(0, 3).map(p => [p.id, true])));
  return (
    <div className="page-fade">
      <div className="admin-page-header">
        <div>
          <h1 className="serif admin-page-title">Mechanisms</h1>
          <div className="admin-page-sub">Each product has its own operating mechanisms. Add, edit, and price them per product — changes show on the customer site immediately.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setExpanded(Object.fromEntries(PRODUCTS.map(p => [p.id, true])))}>Expand all</button>
          <button className="btn btn-outline btn-sm" onClick={() => setExpanded({})}>Collapse all</button>
        </div>
      </div>

      <div className="admin-card" style={{ background: "var(--pale-sand)", border: "1px solid rgba(201,185,154,0.5)", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h4 className="serif" style={{ fontSize: 18, marginBottom: 6 }}>Mechanism template catalog</h4>
            <p style={{ fontSize: 13, color: "var(--charcoal)", margin: 0 }}>
              Templates are starting points you can drop into any product. The catalog has {MECHANISM_TEMPLATES.length} mechanisms — manage shared defaults below. Per-product overrides (custom name, custom upcharge) live in each product's row.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap" }}>Manage catalog →</button>
        </div>
      </div>

      {PRODUCTS.map(p => {
        const isExpanded = !!expanded[p.id];
        const Icon = CATEGORY_ICONS[p.category];
        return (
          <div key={p.id} className="admin-card" style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}>
            <button onClick={() => setExpanded({ ...expanded, [p.id]: !isExpanded })}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 24px", width: "100%", background: isExpanded ? "var(--pale-sage)" : "var(--warm-white)", border: "none", cursor: "pointer", textAlign: "left", borderBottom: isExpanded ? "1px solid var(--hairline)" : "none" }}>
              <div style={{ width: 44, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--charcoal)" }}><Icon /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 22, lineHeight: 1.15 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-60)", marginTop: 2, textTransform: "capitalize" }}>{p.location} · {p.mechanisms.length} mechanisms</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {p.mechanisms.slice(0, 4).map(m => <span key={m.id} className="chip" style={{ fontSize: 11 }}>{m.code}</span>)}
                {p.mechanisms.length > 4 && <span className="chip-outline chip" style={{ fontSize: 11 }}>+{p.mechanisms.length - 4}</span>}
              </div>
              <div style={{ marginLeft: 14, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <ChevDown size={18} />
              </div>
            </button>
            {isExpanded && (
              <div style={{ padding: "18px 24px 24px" }}>
                <MechanismEditorForProduct productId={p.id} initial={p.mechanisms} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MechanismEditorForProduct({ productId, initial }) {
  const [mechs, setMechs] = useState(initial);
  return <MechanismEditor mechanisms={mechs} setMechanisms={setMechs} />;
}

export function AdminSuppliers() {
  return (
    <div className="page-fade">
      <div className="admin-page-header">
        <div>
          <h1 className="serif admin-page-title">Suppliers</h1>
          <div className="admin-page-sub">Mills, finishers, and fabric houses you source from — including which products each one supplies and the shipping options customers can choose.</div>
        </div>
        <button className="btn btn-sage btn-sm">+ Add Supplier</button>
      </div>

      {SUPPLIERS.map(s => (
        <SupplierCard key={s.id} supplier={s} />
      ))}
    </div>
  );
}

function SupplierCard({ supplier }) {
  const [products, setProducts] = useState(supplier.products);
  const [shipping, setShipping] = useState(supplier.shipping);

  const toggleProduct = (pid) => {
    setProducts(products.includes(pid) ? products.filter(x => x !== pid) : [...products, pid]);
  };
  const updateShip = (id, patch) => setShipping(shipping.map(s => s.id === id ? { ...s, ...patch } : s));
  const removeShip = (id) => setShipping(shipping.filter(s => s.id !== id));
  const setDefault = (id) => setShipping(shipping.map(s => ({ ...s, isDefault: s.id === id })));
  const addShip = () => setShipping([
    ...shipping,
    { id: "new_" + Date.now(), internal: "", customerLabel: "Standard", days: "", cost: 0, visible: true, isDefault: false }
  ]);

  const totalProducts = products.length;
  const visibleShipping = shipping.filter(s => s.visible).length;

  return (
    <div className="supplier-card">
      <div className="supplier-card-head">
        <div>
          <div className="sup-name">{supplier.name}</div>
          <div className="sup-meta">{supplier.origin} · {supplier.terms}</div>
        </div>
        <div className="sup-stat">Products<strong>{totalProducts}</strong></div>
        <div className="sup-stat">Shipping options<strong>{visibleShipping} / {shipping.length}</strong></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm">Edit Info</button>
          <button className="btn btn-ghost btn-sm" style={{ color: "#a8513f" }}>Remove</button>
        </div>
      </div>

      <div className="supplier-section">
        <h5>
          <span>Products supplied</span>
          <span style={{ color: "var(--ink-40)" }}>tap to toggle</span>
        </h5>
        <div className="sup-products">
          {PRODUCTS.map(p => (
            <button key={p.id} className={`sup-prod-chip ${products.includes(p.id) ? "active" : ""}`}
                    onClick={() => toggleProduct(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
        {products.length === 0 && (
          <div style={{ fontSize: 12, color: "#a8513f", marginTop: 10 }}>No products assigned to this supplier yet.</div>
        )}
      </div>

      <div className="supplier-section">
        <h5>
          <span>Shipping options</span>
          <button className="edit-btn" onClick={addShip} style={{ color: "var(--sage-dark)" }}>+ Add option</button>
        </h5>
        <div className="shipping-table">
          <div className="ship-row header">
            <div>Internal name</div>
            <div>Customer label</div>
            <div>Delivery estimate</div>
            <div>Surcharge</div>
            <div>Visible</div>
            <div>Default</div>
            <div></div>
          </div>
          {shipping.map(opt => (
            <div key={opt.id} className="ship-row">
              <input className="input" value={opt.internal} onChange={e => updateShip(opt.id, { internal: e.target.value })} placeholder="e.g. Ground" />
              <input className="input" value={opt.customerLabel} onChange={e => updateShip(opt.id, { customerLabel: e.target.value })} placeholder="e.g. Standard" list={`labels-${opt.id}`} />
              <datalist id={`labels-${opt.id}`}>
                {SHIPPING_LABELS.map(l => <option key={l} value={l} />)}
              </datalist>
              <input className="input" value={opt.days} onChange={e => updateShip(opt.id, { days: e.target.value })} placeholder="e.g. 5–7 business days" />
              <div className="cost-input"><span>$</span><input className="input" type="number" value={opt.cost} onChange={e => updateShip(opt.id, { cost: parseFloat(e.target.value) || 0 })} /></div>
              <button className={`toggle ${opt.visible ? "on" : ""}`} onClick={() => updateShip(opt.id, { visible: !opt.visible })} />
              <label className="default-radio">
                <input type="radio" name={`default-${supplier.id}`} checked={opt.isDefault} onChange={() => setDefault(opt.id)} />
                <span>Default</span>
              </label>
              <button className="mech-rm-btn" onClick={() => removeShip(opt.id)} title="Delete shipping option"><XIcon size={16} /></button>
            </div>
          ))}
          {shipping.length === 0 && (
            <div className="ship-row" style={{ gridTemplateColumns: "1fr", color: "var(--ink-60)", fontStyle: "italic", padding: "20px 14px" }}>
              No shipping options. Add at least one — customers can't order without it.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 18, fontSize: 12, color: "var(--ink-60)", marginTop: 12 }}>
          <span><strong style={{ color: "var(--charcoal)" }}>Visible</strong> — customer sees this option at checkout</span>
          <span><strong style={{ color: "var(--charcoal)" }}>Default</strong> — preselected on the cart</span>
        </div>
      </div>
    </div>
  );
}

export function AdminInbox() {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="page-fade">
      <div className="admin-page-header">
        <div>
          <h1 className="serif admin-page-title">Quote Inbox</h1>
          <div className="admin-page-sub">Customer quote requests · {RECENT_QUOTES.filter(q => q.status === "new").length} new this week</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline btn-sm">Filter</button>
          <button className="btn btn-outline btn-sm">Export Excel</button>
        </div>
      </div>

      <table className="admin-table">
        <thead><tr><th>Quote</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {RECENT_QUOTES.map(q => (
            <React.Fragment key={q.id}>
              <tr>
                <td style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, color: "var(--ink-60)" }}>{q.id}</td>
                <td style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{q.name}</td>
                <td>{q.date}</td>
                <td style={{ color: "var(--ink-60)" }}>{q.items}</td>
                <td style={{ fontFamily: "var(--serif)", fontSize: 18 }}>${q.total.toLocaleString()}</td>
                <td>
                  <span className={`pill ${q.status === "new" ? "pill-new" : q.status === "review" ? "pill-review" : "pill-ordered"}`}>
                    {q.status === "new" ? "New" : q.status === "review" ? "In Review" : "Ordered"}
                  </span>
                </td>
                <td><button className="edit-btn" onClick={() => setExpanded(expanded === q.id ? null : q.id)}>{expanded === q.id ? "Hide" : "View"} →</button></td>
              </tr>
              {expanded === q.id && (
                <tr>
                  <td colSpan="7" style={{ background: "var(--pale-sage)", padding: "20px 22px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                      <div>
                        <div className="label">Line items</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                          {[
                            { v: "Faux Wood", m: "Cordless spring", mt: "Inside Mount", qty: 2, total: 760 },
                            { v: "Natural Basswood", m: "Remote control motor", mt: "Inside Mount", qty: 1, total: 580 },
                            { v: "Light Filtering", m: "Cordless spring", mt: "Outside Mount", qty: 1, total: 500 },
                          ].map((li, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 14, alignItems: "center", padding: 10, background: "var(--warm-white)", border: "1px solid var(--hairline)" }}>
                              <PhotoPH label={li.v.split(" ")[0]} sub={li.m.split(" ")[0]} className={(i % 2 === 0) ? "" : "empty"} style={{ width: 60, height: 70, padding: 4, fontSize: 8 }} />
                              <div>
                                <div style={{ fontFamily: "var(--serif)", fontSize: 16 }}>{li.v}</div>
                                <div style={{ fontSize: 12, color: "var(--ink-60)" }}>{li.m} · {li.mt} · qty {li.qty}</div>
                              </div>
                              <div style={{ fontFamily: "var(--serif)", fontSize: 16 }}>${li.total}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="label">Contact, measurement & shipping</div>
                        <div style={{ fontFamily: "var(--serif)", fontSize: 18, marginTop: 8 }}>{q.name}</div>
                        <div style={{ fontSize: 13, color: "var(--ink-60)" }}>customer@example.com · (555) 555-0192</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                          <span className="chip">Self-measured</span>
                          <span className="chip chip-sand">Express shipping</span>
                        </div>
                        <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
                          "Just bought the house — three bedrooms and the living room need new treatments. Want everything done before the in-laws visit in July."
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                          <button className="btn btn-sage btn-sm">Mark In Review</button>
                          <button className="btn btn-outline btn-sm">Reply</button>
                          <button className="btn btn-outline btn-sm">Export Excel</button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminSettings() {
  return (
    <div className="page-fade">
      <div className="admin-page-header">
        <div>
          <h1 className="serif admin-page-title">Settings</h1>
          <div className="admin-page-sub">Business details and site preferences.</div>
        </div>
        <button className="btn btn-sage btn-sm">Save Changes</button>
      </div>

      <div className="admin-card" style={{ marginBottom: 18 }}>
        <h3 className="serif">Business</h3>
        <div className="fld-grid-2">
          <div><div className="label">Business name</div><input className="input" defaultValue={SETTINGS.businessName} /></div>
          <div><div className="label">Phone</div><input className="input" defaultValue={SETTINGS.phone} /></div>
          <div><div className="label">Email</div><input className="input" defaultValue={SETTINGS.email} /></div>
          <div><div className="label">Hours</div><input className="input" defaultValue={SETTINGS.hours} /></div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 18 }}>
        <h3 className="serif">Pricing & quotes</h3>
        <div className="fld-grid-3">
          <div><div className="label">Default margin %</div><input className="input" type="number" defaultValue={SETTINGS.globalMargin} /></div>
          <div><div className="label">Quote expiry (days)</div><input className="input" type="number" defaultValue={SETTINGS.quoteExpiry} /></div>
          <div><div className="label">Default mount</div><select className="select"><option>Inside</option><option>Outside</option></select></div>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-60)", marginTop: 14 }}>The default 40% margin is applied to new products. Existing per-product margins are unaffected unless you override them in Pricing.</div>
      </div>

      <div className="admin-card" style={{ marginBottom: 18 }}>
        <h3 className="serif">Measurement & install</h3>
        <div className="fld-grid-2">
          <div><div className="label">Self-measure guide</div>
            <label style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4, padding: "10px 0" }}>
              <button className="toggle on" />
              <div><div style={{ fontSize: 14 }}>Show on customer site</div><div style={{ fontSize: 12, color: "var(--ink-60)" }}>Adds nav link and quote-flow callout</div></div>
            </label>
          </div>
          <div><div className="label">In-home consult radius</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}><input className="input" type="number" defaultValue={30} style={{ width: 90 }} /><span>miles · free within radius</span></div>
            <div style={{ fontSize: 12, color: "var(--ink-60)", marginTop: 6 }}>Beyond radius: $80 flat fee, refunded with order.</div>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 18 }}>
        <h3 className="serif">Security</h3>
        <div className="fld-grid-2">
          <div><div className="label">Admin password</div><input className="input" type="password" defaultValue="loves2014" /></div>
          <div><div className="label">Confirm password</div><input className="input" type="password" defaultValue="loves2014" /></div>
        </div>
      </div>

      <div className="admin-card">
        <h3 className="serif">Customer site</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
            <button className={`toggle ${SETTINGS.showSuppliers ? "on" : ""}`} />
            <div>
              <div style={{ fontSize: 14 }}>Show supplier information on customer site</div>
              <div style={{ fontSize: 12, color: "var(--ink-60)" }}>Display origin and mill names on product pages</div>
            </div>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
            <button className="toggle on" />
            <div>
              <div style={{ fontSize: 14 }}>Show stats strip on home page</div>
              <div style={{ fontSize: 12, color: "var(--ink-60)" }}>12+ products, 48hr turnaround, etc.</div>
            </div>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
            <button className="toggle on" />
            <div>
              <div style={{ fontSize: 14 }}>Allow live estimates</div>
              <div style={{ fontSize: 12, color: "var(--ink-60)" }}>Show prices on the estimator when base cost is set</div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
