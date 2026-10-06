import { useState, useMemo } from 'react';
import { getActiveLine, getMechanism } from './data/lines.js';
import { MOUNTS } from './data/lines.js';
import {
  fabricsFor, swatchesForFabric, getSwatch, badgeFor, specRows,
} from './data/swatchData.js';
import {
  FAMILY_LABELS, CELLULAR_TYPES, SHANGRI_FORMATS, ROMAN_STYLES, LINING_LABELS, PLEATS,
  SECTION_LABELS, romanStyleOptions, summarize,
} from './lib/selection.js';
import { showcaseFor, ShowcasePhoto } from './components/Showcase.jsx';
import { Footer } from './customer.jsx';
import { ArrowRight } from './icons.jsx';

// ---------------------------------------------------------------------------
// Swatch images: lazy, with a neutral tile showing the code when the file fails.
// ---------------------------------------------------------------------------
function SwatchImg({ src, alt, code, size, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className={`swatch-fallback ${className}`} role="img" aria-label={alt}>{code}</span>;
  }
  return (
    <img className={className} src={src} alt={alt} width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(true)} />
  );
}

const altOf = (s, code = s.code) => [s.fabric, s.colorName, code].filter(Boolean).join(", ");

function makePick(swatch, role, styleObj) {
  const src = styleObj || swatch;
  return {
    role: role || null,
    swatchId: swatch.id,
    line: swatch.line,
    family: swatch.family || null,
    fabric: swatch.fabric,
    fabricId: swatch.fabricId,
    code: styleObj ? styleObj.code : swatch.code,
    colorName: swatch.colorName ?? null,
    style: styleObj ? styleObj.style : null,
    thumb: src.thumb,
  };
}

const keySpecs = (f) => {
  const out = [];
  const b = badgeFor(f);
  if (b) out.push(b);
  if (f.specs?.vaneSize) out.push(`${f.specs.vaneSize} vanes`);
  if (f.specs?.care) out.push(f.specs.care);
  const n = swatchesForFabric(f.id).length;
  out.push(`${n} ${n === 1 ? "swatch" : "swatches"}`);
  return out;
};

// ---------------------------------------------------------------------------
// Step 1 fabric, step 2 swatch grid, step 3 large preview.
// `showColorName` is false for collections (Roman, Drapery curtains): name + code only.
// ---------------------------------------------------------------------------
function PickerBlock({ heading, fabrics, role, family = null, showColorName = true, onChange, initial = null }) {
  const [fabricId, setFabricId] = useState(initial?.fabricId || (fabrics.length === 1 ? fabrics[0].id : null));
  const [swatchId, setSwatchId] = useState(initial?.swatchId || null);
  const [styleKey, setStyleKey] = useState(initial?.style || null);

  const fabric = fabrics.find(f => f.id === fabricId) || null;
  // Cellular keeps one fabric for both families; each swatch carries its own family.
  const swatches = fabric ? swatchesForFabric(fabric.id).filter(sw => !family || sw.family === family) : [];
  const swatch = swatchId ? getSwatch(swatchId) : null;
  const styles = swatch?.styles || [];
  const styleObj = styles.find(s => s.style === styleKey) || null;
  const idBase = useMemo(() => `pk-${Math.random().toString(36).slice(2, 8)}`, []);

  const emit = (sw, st) => {
    if (!sw) return onChange(null);
    if (sw.styles?.length && !st) return onChange(null);          // style still to be chosen
    onChange(makePick(sw, role, st));
  };
  const chooseFabric = (id) => { setFabricId(id); setSwatchId(null); setStyleKey(null); onChange(null); };
  const chooseSwatch = (sw) => { setSwatchId(sw.id); setStyleKey(null); emit(sw, null); };
  const chooseStyle = (st) => { setStyleKey(st.style); emit(swatch, st); };

  const preview = styleObj || swatch;
  const nameLine = swatch && [swatch.fabric, showColorName ? swatch.colorName : null].filter(Boolean).join(" · ");

  return (
    <div className="picker">
      {heading && <h3 className="picker-heading serif">{heading}</h3>}

      {fabrics.length > 1 && (
        <div className="config-group">
          <div className="label" id={`${idBase}-f`}>1 · Choose a fabric</div>
          <div className="fabric-cards" role="group" aria-labelledby={`${idBase}-f`}>
            {fabrics.map(f => (
              <button key={f.id} type="button" className={`fabric-card${fabricId === f.id ? " selected" : ""}`} aria-pressed={fabricId === f.id} onClick={() => chooseFabric(f.id)}>
                <span className="fabric-card-name">{f.fabric}</span>
                <span className="fabric-card-specs">{keySpecs(f).join(" · ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {fabric && (
        <div className="config-group">
          <div className="label" id={`${idBase}-s`}>
            {fabrics.length > 1 ? "2 · " : ""}Choose {showColorName ? "a color" : "a swatch"}
            <span className="label-note"> {fabric.fabric}</span>
          </div>
          <div className="swatch-grid2" role="group" aria-labelledby={`${idBase}-s`}>
            {swatches.map(s => (
              <button key={s.id} type="button" className={`sw${swatchId === s.id ? " selected" : ""}`} aria-pressed={swatchId === s.id} onClick={() => chooseSwatch(s)}>
                <SwatchImg src={s.thumb} alt={altOf(s)} code={s.code} size={160} />
                {showColorName && s.colorName && <span className="sw-name">{s.colorName}</span>}
                <span className="sw-code">{s.styles?.length ? s.styles.map(x => x.code).join(" / ") : s.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {swatch && styles.length > 0 && (
        <div className="config-group">
          <div className="label">Choose a style</div>
          <div className="style-options" role="group" aria-label="Style">
            {styles.map(st => (
              <button key={st.style} type="button" className={`style-opt${styleKey === st.style ? " selected" : ""}`} aria-pressed={styleKey === st.style} onClick={() => chooseStyle(st)}>
                <SwatchImg src={st.thumb} alt={`${swatch.fabric}, ${swatch.colorName}, Style ${st.style}, ${st.code}`} code={st.code} size={64} />
                <span>
                  <strong>Style {st.style}</strong>
                  <span className="style-opt-sub">{st.style === "A" ? "41 cm panel" : "33 cm panel"}{fabric.specs?.[`weightStyle${st.style}`] ? ` · ${fabric.specs[`weightStyle${st.style}`]}` : ""}</span>
                  <span className="sw-code">{st.code}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {swatch && (
        <div className="preview" aria-live="polite">
          <SwatchImg className="preview-img" src={preview.image} alt={altOf(swatch, preview.code)} code={preview.code} size={600} />
          <div className="preview-body">
            <div className="preview-eyebrow">{role || "Your selection"}</div>
            <div className="preview-name serif">{nameLine}</div>
            <div className="preview-code">Code {preview.code}{styleObj ? ` · Style ${styleObj.style}` : ""}</div>
            <dl className="preview-specs">
              {specRows(fabric).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function Choice({ label, options, value, onChange, disabledIds = [], note }) {
  return (
    <div className="config-group">
      <div className="label">{label}</div>
      <div className="config-options" role="group" aria-label={label}>
        {options.map(o => (
          <button key={o.id} type="button" className={`opt-btn${value === o.id ? " selected" : ""}`} aria-pressed={value === o.id} disabled={disabledIds.includes(o.id)} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      {note && <div className="choice-note">{note}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configurator
// ---------------------------------------------------------------------------
const INITIAL = {
  mode: "single", frontFamily: "screen-view", backFamily: "screen-view", front: null, back: null,
  pick: null, format: "horizontal-shade", cellFamily: "light-filtering", type: "standard", day: null, night: null,
  romanStyle: null, lining: null, pleat: null, section: "curtains", dream: null,
};

// The selection as the order will carry it, plus what is still missing.
function buildSelection(line, c) {
  const missing = [];
  const need = (v, what) => { if (!v) missing.push(what); return v; };
  let sel = { lineId: line.id, picks: [] };
  switch (line.id) {
    case "roller":
      sel.mode = c.mode;
      if (c.mode === "single") {
        need(c.front, "a fabric and color");
        if (c.front) sel.picks = [{ ...c.front, role: null }];
      } else {
        need(c.front, "the front shade");
        need(c.back, "the back shade");
        if (c.front) sel.picks.push({ ...c.front, role: "Front shade" });
        if (c.back) sel.picks.push({ ...c.back, role: "Back shade" });
      }
      break;
    case "zebra":
      need(c.pick, "a fabric and color");
      if (c.pick) sel.picks = [c.pick];
      break;
    case "shangri-la":
      sel.format = c.format;
      need(c.pick, "a fabric and color");
      if (c.pick) sel.picks = [c.pick];
      break;
    case "cellular":
      sel.type = c.type;
      if (c.type === "day-night") {
        need(c.day, "the day color");
        need(c.night, "the night color");
        if (c.day) sel.picks.push({ ...c.day, role: "Day (light-filtering)" });
        if (c.night) sel.picks.push({ ...c.night, role: "Night (blackout)" });
      } else {
        need(c.pick, "a color");
        if (c.pick) sel.picks = [c.pick];
      }
      break;
    case "roman":
      need(c.pick, "a swatch");
      need(c.romanStyle, "a style");
      need(c.lining, "a lining");
      sel.style = c.romanStyle || undefined;
      sel.lining = c.lining || undefined;
      if (c.pick) sel.picks = [c.pick];
      break;
    case "drapery":
      sel.section = c.section;
      if (c.section === "curtains") {
        need(c.pick, "a swatch");
        need(c.pleat, "a pleat style");
        need(c.lining, "a lining");
        sel.pleat = c.pleat || undefined;
        sel.lining = c.lining || undefined;
        if (c.pick) sel.picks = [c.pick];
      } else {
        need(c.dream, "a fabric and color");
        if (c.dream) sel.picks = [c.dream];
      }
      break;
    default:
      break;
  }
  return { selection: sel, missing };
}

function Configurator({ line, addToQuote }) {
  const [c, setC] = useState(INITIAL);
  const set = (patch) => setC(prev => ({ ...prev, ...patch }));
  const [mech, setMech] = useState(line.mechanisms[0].id);
  const [mount, setMount] = useState(line.mounts[0]);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [windows, setWindows] = useState("1");
  const [roomLabel, setRoomLabel] = useState("");
  const [added, setAdded] = useState(false);

  const { selection, missing } = buildSelection(line, c);
  const ready = missing.length === 0;

  // Roman: the style/lining a swatch allows
  const romanSwatch = c.pick ? getSwatch(c.pick.swatchId) : null;
  const romanOpts = romanStyleOptions(romanSwatch);
  const liningsForStyle = c.romanStyle ? romanOpts.find(o => o.id === c.romanStyle)?.linings || [] : [];

  const onRomanPick = (pick) => {
    if (!pick) return set({ pick: null, romanStyle: null, lining: null });
    const opts = romanStyleOptions(getSwatch(pick.swatchId));
    const stillOk = opts.find(o => o.id === c.romanStyle)?.available;
    const lins = opts.find(o => o.id === c.romanStyle)?.linings || [];
    set({
      pick,
      romanStyle: stillOk ? c.romanStyle : null,
      lining: stillOk && lins.includes(c.lining) ? c.lining : null,
    });
  };
  const onRomanStyle = (id) => {
    const lins = romanOpts.find(o => o.id === id)?.linings || [];
    set({ romanStyle: id, lining: lins.includes(c.lining) ? c.lining : (lins.length === 1 ? lins[0] : null) });
  };

  const handleAdd = () => {
    if (!ready) return;
    const first = selection.picks[0];
    const item = {
      product: line,
      variant: line.name,
      mech, mount,
      selection,
      code: first?.code ?? null,
      colorName: first ? (first.colorName || first.fabric) : line.name,
      category: line.id,
      location: line.location,
      price: null,
      width: parseFloat(width) || null,
      length: parseFloat(height) || null,
      qty: parseInt(windows, 10) || 1,
      roomLabel: roomLabel.trim(),
      addons: { blackout: false, install: false },
    };
    addToQuote(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const summary = summarize({ product: line, selection });
  const mechObj = getMechanism(line, mech);
  const mountObj = MOUNTS.find(m => m.id === mount);

  return (
    <section className="configurator" id="configure" aria-labelledby="configure-title">
      <div className="section-eyebrow">Configure</div>
      <h2 id="configure-title" className="serif section-title gold-rule">Build your {line.name.toLowerCase()} order</h2>

      {line.id === "drapery" && (
        <div className="section-switch" role="tablist" aria-label="Drapery type">
          {line.sections.map(s => (
            <button key={s.id} role="tab" aria-selected={c.section === s.id} className={`section-tab${c.section === s.id ? " active" : ""}`} onClick={() => set({ section: s.id })}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* ---- Roller ---- */}
      {line.id === "roller" && (
        <>
          <Choice label="Single or double-stack" value={c.mode} onChange={(mode) => set({ mode, front: null, back: null })}
            options={[{ id: "single", label: "Single" }, { id: "double-stack", label: "Double-stack" }]}
            note="Double-stack pairs two fabrics on one window and lets you pull each one down on its own. At night with lights on, people outside can see through Screen View and see-through Solar fabrics, so choose Blackout or a double-stack for night privacy." />
          {(c.mode === "single" ? [["front", "frontFamily", null]] : [["front", "frontFamily", "Front shade"], ["back", "backFamily", "Back shade"]]).map(([k, fk, role]) => (
            <div key={k + c.mode} className="picker-wrap">
              <Choice label={role ? `${role}: fabric family` : "Fabric family"} value={c[fk]}
                options={line.families.map(f => ({ id: f, label: FAMILY_LABELS[f] }))}
                onChange={(f) => set({ [fk]: f, [k]: null })} />
              <PickerBlock key={`${k}-${c[fk]}`} heading={role} role={role} fabrics={fabricsFor("roller", c[fk])} onChange={(p) => set({ [k]: p })} />
            </div>
          ))}
        </>
      )}

      {/* ---- Zebra ---- */}
      {line.id === "zebra" && <PickerBlock fabrics={fabricsFor("zebra")} onChange={(p) => set({ pick: p })} />}

      {/* ---- Shangri-La ---- */}
      {line.id === "shangri-la" && (
        <>
          <Choice label="Format" value={c.format} options={SHANGRI_FORMATS} onChange={(format) => set({ format })}
            note="The same fabrics can be made as a horizontal shade or as a sheer vertical blind for wide windows and sliding doors." />
          <PickerBlock fabrics={fabricsFor("shangri-la")} onChange={(p) => set({ pick: p })} />
        </>
      )}

      {/* ---- Cellular ---- */}
      {line.id === "cellular" && (
        <>
          <Choice label="Product type" value={c.type} options={CELLULAR_TYPES} onChange={(type) => set({ type, pick: null, day: null, night: null })}
            note={c.type === "day-night" ? "Day & Night needs two colors: light-filtering for day and blackout for night." : null} />
          {c.type !== "day-night" ? (
            <>
              <Choice label="Light filtering or blackout" value={c.cellFamily}
                options={line.families.map(f => ({ id: f, label: FAMILY_LABELS[f] }))}
                onChange={(f) => set({ cellFamily: f, pick: null })} />
              <PickerBlock key={c.cellFamily} family={c.cellFamily} fabrics={fabricsFor("cellular")} onChange={(p) => set({ pick: p })} />
            </>
          ) : (
            <>
              <PickerBlock key="day" heading="Day color (light-filtering)" role="Day (light-filtering)" family="light-filtering" fabrics={fabricsFor("cellular")} onChange={(p) => set({ day: p })} />
              <PickerBlock key="night" heading="Night color (blackout)" role="Night (blackout)" family="blackout" fabrics={fabricsFor("cellular")} onChange={(p) => set({ night: p })} />
            </>
          )}
        </>
      )}

      {/* ---- Roman ---- */}
      {line.id === "roman" && (
        <>
          <PickerBlock fabrics={fabricsFor("roman")} showColorName={false} onChange={onRomanPick} />
          {c.pick && (
            <>
              <Choice label="Style" value={c.romanStyle} onChange={onRomanStyle}
                options={ROMAN_STYLES} disabledIds={romanOpts.filter(o => !o.available).map(o => o.id)}
                note={romanOpts.some(o => !o.available) ? "Greyed styles are not available in this fabric." : null} />
              {c.romanStyle && (
                <Choice label="Lining" value={c.lining} onChange={(lining) => set({ lining })}
                  options={liningsForStyle.map(l => ({ id: l, label: LINING_LABELS[l] }))} />
              )}
            </>
          )}
        </>
      )}

      {/* ---- Drapery ---- */}
      {line.id === "drapery" && (
        <>
          <div hidden={c.section !== "curtains"}>
            <PickerBlock key="curtains" fabrics={fabricsFor("drapery")} showColorName={false} onChange={(p) => set({ pick: p })} />
            <Choice label="Pleat style" value={c.pleat} onChange={(pleat) => set({ pleat })}
              options={PLEATS.map(p => ({ id: p, label: p }))} note="Availability confirmed with your quote" />
            <Choice label="Lining" value={c.lining} onChange={(lining) => set({ lining })}
              options={["blackout", "light-filtering", "none"].map(l => ({ id: l, label: LINING_LABELS[l] }))} />
          </div>
          <div hidden={c.section !== "dream-curtains"}>
            <PickerBlock key="dream" fabrics={fabricsFor("dream-curtains")} onChange={(p) => set({ dream: p })} />
          </div>
        </>
      )}

      {/* ---- Shared order options ---- */}
      <div className="config-group">
        <div className="label">{line.id === "drapery" ? "Control (track)" : "Control"}</div>
        <div className="config-options" role="group" aria-label="Control">
          {line.mechanisms.map(m => (
            <button key={m.id} type="button" className={`opt-btn${mech === m.id ? " selected" : ""}`} aria-pressed={mech === m.id} onClick={() => setMech(m.id)}>{m.name}</button>
          ))}
        </div>
      </div>
      <div className="config-group">
        <div className="label">Mount type</div>
        <div className="config-options" role="group" aria-label="Mount type">
          {line.mounts.map(mid => {
            const m = MOUNTS.find(x => x.id === mid);
            return <button key={mid} type="button" className={`opt-btn${mount === mid ? " selected" : ""}`} aria-pressed={mount === mid} onClick={() => setMount(mid)}>{m.name}</button>;
          })}
        </div>
      </div>
      <div className="config-group">
        <div className="label">Window size <span className="label-note">(optional here, you can add it to your notes later)</span></div>
        <div className="slat-dims">
          <div>
            <label className="field-label" htmlFor="dim-w">Width (in)</label>
            <input id="dim-w" className="input" type="number" inputMode="decimal" value={width} onChange={e => setWidth(e.target.value)} placeholder="36" />
          </div>
          <div>
            <label className="field-label" htmlFor="dim-h">Height (in)</label>
            <input id="dim-h" className="input" type="number" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} placeholder="60" />
          </div>
          <div>
            <label className="field-label" htmlFor="dim-n"># Windows</label>
            <input id="dim-n" className="input" type="number" value={windows} onChange={e => setWindows(e.target.value)} min="1" placeholder="1" />
          </div>
        </div>
      </div>
      <div className="config-group">
        <label className="label" htmlFor="room">Room <span className="label-note">(optional)</span></label>
        <input id="room" className="input" type="text" value={roomLabel} onChange={e => setRoomLabel(e.target.value)} placeholder="e.g. Master bedroom" />
      </div>

      {/* ---- Order summary ---- */}
      <div className="order-summary-box" aria-live="polite">
        <div className="preview-eyebrow">Order summary</div>
        <div className="order-summary-title serif">{summary.title}</div>
        {summary.parts.length > 0 && (
          <ul className="order-summary-list">
            {summary.parts.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        )}
        <div className="order-summary-meta">
          {mechObj?.name} · {mountObj?.name}
          {width && height ? ` · ${width}"W × ${height}"H` : ""} · Qty {parseInt(windows, 10) || 1}
        </div>
        {!ready && <div className="order-summary-missing">Still to choose: {missing.join(", ")}.</div>}
        <div className="config-actions">
          <button className="btn btn-sage" onClick={handleAdd} disabled={!ready}>
            {added ? "Added to your order" : "Add to Order"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function LinePage({ slug, navigate, addToQuote }) {
  const line = getActiveLine(slug);
  if (!line) return null;
  const photos = showcaseFor(line.slug);
  const hero = photos[0] || null;

  return (
    <div className="page-fade">
      <section className="line-hero">
        <div className="line-hero-media">
          <ShowcasePhoto entry={hero} lineName={line.name} eager sizes="100vw" />
        </div>
        <div className="container line-hero-text">
          <button className="crumb" onClick={() => navigate("products")}>← All products</button>
          <h1 className="serif">{line.name}</h1>
          <p className="line-desc">{line.description}</p>
        </div>
      </section>

      <section className="container line-good">
        <div className="section-eyebrow">Good to know</div>
        <ul className="good-list">
          {line.goodToKnow.map((g, i) => <li key={i}>{g}</li>)}
        </ul>
      </section>

      <div className="container line-body">
        <Configurator key={line.id} line={line} addToQuote={addToQuote} />
        <div className="line-measure-link">
          <strong>Not sure how to measure?</strong> Our guide walks you through it.
          <button className="btn btn-outline btn-sm" onClick={() => navigate("measure")}>Open Guide <ArrowRight size={14} /></button>
        </div>
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}
