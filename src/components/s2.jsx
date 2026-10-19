// Shared building blocks of the redesigned product pages (Stage 2): numbered steps, choice cards, the color step,
// the size step, mount pictures, the estimate card and the sticky price bar.
import { useMemo, useState } from 'react';
import { entriesFor, COLOR_FAMILY_ORDER, tileSrc, tileFallbacks } from '../data/swatchData.js';
import { ExplainerImg, hasExplainer } from './ExplainerImg.jsx';
import { SwatchImg, SwatchDialog, makePick, labelOf, altOf } from './SwatchPicker.jsx';
import { useCatalogStatus } from '../lib/useCatalog.js';
import { FRACTIONS, toInches } from '../lib/inches.js';

// ---- Steps -------------------------------------------------------------------------------------------------------

export function Step({ n, title, hint, children }) {
  const id = `s2-step-${n}`;
  return (
    <section className="s2-step" aria-labelledby={id}>
      <h2 id={id} className="s2-step-title"><span className="s2-step-num">{n}</span>{title}</h2>
      {hint && <p className="s2-step-hint">{hint}</p>}
      {children}
    </section>
  );
}

// Cards for a simple choice: name, one-line explanation, and a picture when one exists.
export function Cards({ label, options, value, onChange, min = 200, disabledIds = [], stack = false }) {
  return (
    <div className="s2-cards" role="group" aria-label={label} style={{ "--min": `${min}px` }}>
      {options.map((o) => {
        const on = value === o.id;
        const pic = o.picture || (o.img && hasExplainer(o.img) ? <ExplainerImg name={o.img} alt="" /> : null);
        return (
          <button key={o.id} type="button" className={`s2-card${on ? " on" : ""}${pic ? " with-pic" : ""}${stack && pic ? " stack" : ""}`} aria-pressed={on}
            disabled={disabledIds.includes(o.id)} onClick={() => onChange(o.id)}>
            {pic && <span className="s2-card-pic">{pic}</span>}
            <span className="s2-card-text">
              <span className="s2-card-name">{o.label}</span>
              {o.desc && <span className="s2-card-desc">{o.desc}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Inside and outside mount drawings from the approved mockup.
export const MOUNT_PICTURES = {
  inside: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="8" y="6" width="48" height="52" stroke="#5E554B" strokeWidth="3" /><rect x="13" y="11" width="38" height="26" fill="#CDBFA6" /><rect x="13" y="11" width="38" height="4" fill="#7A5C2E" /></svg>
  ),
  outside: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="12" y="12" width="40" height="46" stroke="#5E554B" strokeWidth="3" /><rect x="4" y="4" width="56" height="34" fill="#CDBFA6" /><rect x="4" y="4" width="56" height="4" fill="#7A5C2E" /></svg>
  ),
};

// ---- Color step ----------------------------------------------------------------------------------------------------

const FIRST_SHOWN = 48;
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

// One search box (name or code), color-family filters, and swatches showing name and code only.
// `fabrics` are the price groups to list (the customer never sees them); `family` limits Roller/Cellular fabric types.
export function ColorStep({ id, fabrics, family = null, role = null, value, onChange }) {
  const catalog = useCatalogStatus();
  const entries = useMemo(() => entriesFor(fabrics, family), [fabrics, family]);
  const [query, setQuery] = useState("");
  const [color, setColor] = useState(null);
  const [all, setAll] = useState(false);
  const [view, setView] = useState(null);

  const families = COLOR_FAMILY_ORDER.filter((f) => entries.some((e) => e.color === f));
  const q = norm(query);
  const results = entries.filter((e) => (!color || e.color === color) && (!q || norm(e.swatch.displayName).includes(q) || norm(e.swatch.code).includes(q)));
  const shown = all || q || color ? results : results.slice(0, FIRST_SHOWN);
  const picked = value ? entries.find((e) => e.swatch.id === value.swatchId) : null;

  if (catalog.status !== "ready") {
    return catalog.status === "loading" ? (
      <div className="s2-swatches s2-skeleton" role="status" aria-label="Loading colors">
        {Array.from({ length: 12 }, (_, i) => <span key={i} className="s2-skel" aria-hidden="true" />)}
      </div>
    ) : (
      <div className="s2-empty" role="alert">Colors are temporarily unavailable. <button type="button" className="s2-link" onClick={catalog.retry}>Try again</button></div>
    );
  }

  const choose = (e) => onChange(makePick(e.swatch, role, null));
  return (
    <div className="s2-color">
      <div className="s2-color-tools">
        <label className="s2-sr" htmlFor={`${id}-search`}>Search colors by name or code</label>
        <input id={`${id}-search`} className="s2-input s2-search" type="search" placeholder="Search name or code" value={query} onChange={(e) => setQuery(e.target.value)} />
        {families.length > 1 && (
          <div className="s2-chips" role="group" aria-label="Filter by color">
            <button type="button" className={`s2-chip${color == null ? " on" : ""}`} aria-pressed={color == null} onClick={() => setColor(null)}>All</button>
            {families.map((f) => (
              <button key={f} type="button" className={`s2-chip${color === f ? " on" : ""}`} aria-pressed={color === f} onClick={() => setColor(color === f ? null : f)}>{f}</button>
            ))}
          </div>
        )}
      </div>

      {results.length === 0 ? (
        <div className="s2-empty">No colors match. Try another name or code.</div>
      ) : (
        <div className="s2-swatches" role="group" aria-label="Colors">
          {shown.map((e) => {
            const s = e.swatch;
            const on = value?.swatchId === s.id;
            return (
              <button key={s.id} type="button" className={`s2-sw${on ? " on" : ""}`} aria-pressed={on} aria-label={altOf(e)} onClick={() => choose(e)}>
                <span className="s2-sw-img"><SwatchImg src={tileSrc(s)} fallback={tileFallbacks(s)} alt="" code={s.code} size={200} /></span>
                <span className="s2-sw-name">{labelOf(e)}</span>
                <span className="s2-sw-code">{s.code}</span>
              </button>
            );
          })}
        </div>
      )}
      {!all && !q && !color && results.length > FIRST_SHOWN && (
        <button type="button" className="s2-btn-more" onClick={() => setAll(true)}>Show all {results.length} colors</button>
      )}

      {picked && (
        <div className="s2-picked" aria-live="polite">
          <span>{role ? `${role}: ` : "Selected: "}<strong>{labelOf(picked)}</strong> ({picked.swatch.code})</span>
          <button type="button" className="s2-link" onClick={() => setView(picked)}>View larger</button>
        </div>
      )}
      <SwatchDialog entry={view} role={role} chosen={!!view} onChoose={(e) => { choose(e); setView(null); }} onClose={() => setView(null)} />
    </div>
  );
}

// ---- Size step -----------------------------------------------------------------------------------------------------

// Whole inches plus a 1/8 fraction for each side. `size` is { w, wf, h, hf } strings; onChange gets the next one.
export function SizeFields({ size, onChange }) {
  const set = (k) => (e) => onChange({ ...size, [k]: e.target.value });
  const Field = ({ label, k, f, ph }) => (
    <div className="s2-field">
      <label className="s2-label" htmlFor={`s2-${k}`}>{label}</label>
      <div className="s2-field-row">
        <input id={`s2-${k}`} className="s2-input" type="number" inputMode="numeric" min="0" step="1" placeholder={ph} value={size[k]} onChange={set(k)} />
        <label className="s2-sr" htmlFor={`s2-${f}`}>{label} fraction</label>
        <select id={`s2-${f}`} className="s2-input s2-frac" value={size[f]} onChange={set(f)}>
          {FRACTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
    </div>
  );
  return (
    <div className="s2-size">
      <Field label="Width" k="w" f="wf" ph="e.g. 40" />
      <Field label="Height" k="h" f="hf" ph="e.g. 64" />
    </div>
  );
}
export const EMPTY_SIZE = { w: "", wf: "0", h: "", hf: "0" };
export const sizeNumbers = (size) => ({ width: toInches(size.w, size.wf), height: toInches(size.h, size.hf) });

// ---- Estimate -------------------------------------------------------------------------------------------------------

const money = (n) => `$${Number(n).toLocaleString("en-US")}`;

// What the page says about the price, from the database answer. kind: waiting | loading | price | custom | request | error
export function priceView(req, state) {
  if (!req) return { kind: "waiting" };
  if (state.loading) return { kind: "loading" };
  const r = state.result;
  if (!r || r.error) return { kind: "error" };
  if (r.price_on_request) return { kind: "request" };
  if (r.price != null) return { kind: "price", price: r.price };
  if (r.custom_size) return { kind: "custom" };
  return { kind: "error" };
}

export const CUSTOM_TEXT = "This size is larger than our standard range. Add it to your order and we'll reply with a price.";
export const REQUEST_TEXT = "Send us your order and we'll reply with a price.";
export const ESTIMATE_TEXT = "Here's your estimate. Send it and we'll confirm details and final price.";

export function EstimateCard({ view, checks, summary }) {
  return (
    <section className="s2-estimate" aria-live="polite">
      {view.kind === "price" && (
        <>
          <div className="s2-eyebrow">Your estimate</div>
          <div className="s2-estimate-price">{money(view.price)}</div>
          <p className="s2-estimate-text">{ESTIMATE_TEXT}</p>
          {summary && <div className="s2-estimate-summary">{summary.map((l, i) => <div key={i}>{l}</div>)}</div>}
        </>
      )}
      {view.kind === "custom" && (<><div className="s2-estimate-title">Custom size</div><p className="s2-estimate-text">{CUSTOM_TEXT}</p></>)}
      {view.kind === "request" && (<><div className="s2-estimate-title">Price on request</div><p className="s2-estimate-text">{REQUEST_TEXT}</p></>)}
      {view.kind === "loading" && (<><div className="s2-estimate-title">Your price</div><p className="s2-estimate-text">Calculating your estimate…</p></>)}
      {view.kind === "error" && (<><div className="s2-estimate-title">Your price</div><p className="s2-estimate-text">We couldn't work out an estimate just now. You can still add this to your order and we'll reply with a price.</p></>)}
      {view.kind === "waiting" && (
        <>
          <div className="s2-estimate-title">Your price</div>
          <p className="s2-estimate-text">{checks.every((c) => c.done) ? "Calculating your estimate…" : "Pick your color and enter your size to see your price."}</p>
          <ul className="s2-checks">
            {checks.map((c) => <li key={c.label} className={c.done ? "done" : ""}><span aria-hidden="true">{c.done ? "✓" : "○"}</span> {c.label}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}

// Sticky bottom bar: the price (or what is still needed) and the Add to order button.
export function PriceBar({ title, view, needs, canAdd, added, onAdd }) {
  let label = title, value = needs;
  if (view.kind === "price") { label = "Your estimate"; value = money(view.price); }
  else if (view.kind === "custom") { label = "Custom size"; value = "Price sent by email"; }
  else if (view.kind === "request") { label = "Price on request"; value = "Price sent by email"; }
  else if (view.kind === "loading") { label = "Your estimate"; value = "Calculating…"; }
  else if (view.kind === "error") { label = "Your estimate"; value = "Price sent by email"; }
  return (
    <div className="s2-bar">
      <div className="s2-wrap s2-bar-inner">
        <div className="s2-bar-text"><span className="s2-bar-label">{label}</span><span className="s2-bar-value">{value}</span></div>
        <button type="button" className="s2-bar-btn" disabled={!canAdd} onClick={onAdd}>{added ? "Added to your order" : "Add to order"}</button>
      </div>
    </div>
  );
}
