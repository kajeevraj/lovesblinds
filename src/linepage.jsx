import { useState } from 'react';
import { getActiveLine, getMechanism, MOUNTS } from './data/lines.js';
import { fabricsFor, getSwatch } from './data/swatchData.js';
import {
  FAMILY_LABELS, CELLULAR_TYPES, SHANGRI_FORMATS, ROMAN_STYLES, LINING_LABELS, PLEATS,
  romanStyleOptions, summarize,
} from './lib/selection.js';
import {
  CONTROL_COPY, CONTROL_IMG, MOUNT_INFO, ROLLER_MODE_INFO, SHANGRI_FORMAT_INFO, CELLULAR_TYPE_INFO,
  ROMAN_STYLE_INFO, LINING_INFO, PLEAT_INFO,
} from './data/optionInfo.js';
import { showcaseFor, ShowcasePhoto } from './components/Showcase.jsx';
import { OptionCards } from './components/ExplainerImg.jsx';
import SwatchPicker from './components/SwatchPicker.jsx';
import { Footer } from './customer.jsx';
import { ArrowRight } from './icons.jsx';

// A compact row of buttons for simple choices that need no picture (fabric family).
function Choice({ label, options, value, onChange }) {
  return (
    <div className="config-group">
      <div className="label">{label}</div>
      <div className="config-options" role="group" aria-label={label}>
        {options.map(o => (
          <button key={o.id} type="button" className={`opt-btn${value === o.id ? " selected" : ""}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
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

const controlOptions = (line) => line.mechanisms.map(m => ({
  id: m.id, label: m.name, desc: CONTROL_COPY[m.id], img: CONTROL_IMG[line.id]?.[m.id],
}));

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
  const [dreamOpened, setDreamOpened] = useState(false);   // the Dream Curtains grid is not built until that section is opened

  const { selection, missing } = buildSelection(line, c);
  const ready = missing.length === 0;

  // Roman: the style/lining a swatch allows, straight from its romanStyles data
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
      <h2 id="configure-title" className="sr-only">Configure your {line.name.toLowerCase()} order</h2>

      {line.id === "drapery" && (
        <div className="section-switch" role="tablist" aria-label="Drapery type">
          {line.sections.map(s => (
            <button key={s.id} role="tab" aria-selected={c.section === s.id} className={`section-tab${c.section === s.id ? " active" : ""}`} onClick={() => { set({ section: s.id }); if (s.id === "dream-curtains") setDreamOpened(true); }}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* ---- Roller ---- */}
      {line.id === "roller" && (
        <>
          <OptionCards label="Single or double-stack" value={c.mode} onChange={(mode) => set({ mode, front: null, back: null })}
            options={line.modes.map(m => ({ id: m, label: m === "single" ? "Single" : "Double-stack", desc: ROLLER_MODE_INFO[m].desc, img: ROLLER_MODE_INFO[m].img }))}
            note="At night with lights on, people outside can see through Screen View and see-through Solar fabrics, so choose Blackout or a double-stack for night privacy." />
          {(c.mode === "single" ? [["front", "frontFamily", null]] : [["front", "frontFamily", "Front shade"], ["back", "backFamily", "Back shade"]]).map(([k, fk, role]) => (
            <div key={k + c.mode} className="picker-wrap">
              <Choice label={role ? `${role}: fabric family` : "Fabric family"} value={c[fk]}
                options={line.families.map(f => ({ id: f, label: FAMILY_LABELS[f] }))}
                onChange={(f) => set({ [fk]: f, [k]: null })} />
              <SwatchPicker key={`${k}-${c[fk]}`} heading={role} role={role} family={c[fk]} fabrics={fabricsFor("roller", c[fk])} onChange={(p) => set({ [k]: p })} />
            </div>
          ))}
        </>
      )}

      {/* ---- Zebra ---- */}
      {line.id === "zebra" && <SwatchPicker fabrics={fabricsFor("zebra")} onChange={(p) => set({ pick: p })} />}

      {/* ---- Shangri-La ---- */}
      {line.id === "shangri-la" && (
        <>
          <OptionCards label="Format" value={c.format} onChange={(format) => set({ format })}
            options={SHANGRI_FORMATS.map(f => ({ ...f, desc: SHANGRI_FORMAT_INFO[f.id].desc, img: SHANGRI_FORMAT_INFO[f.id].img }))} />
          <SwatchPicker fabrics={fabricsFor("shangri-la")} onChange={(p) => set({ pick: p })} />
        </>
      )}

      {/* ---- Cellular ---- */}
      {line.id === "cellular" && (
        <>
          <OptionCards label="Product type" value={c.type} onChange={(type) => set({ type, pick: null, day: null, night: null })}
            options={CELLULAR_TYPES.map(t => ({ ...t, desc: CELLULAR_TYPE_INFO[t.id].desc, img: CELLULAR_TYPE_INFO[t.id].img }))}
            note={c.type === "day-night" ? "Day & Night needs two colors: light-filtering for day and blackout for night." : null} />
          {c.type !== "day-night" ? (
            <>
              <Choice label="Light filtering or blackout" value={c.cellFamily}
                options={line.families.map(f => ({ id: f, label: FAMILY_LABELS[f] }))}
                onChange={(f) => set({ cellFamily: f, pick: null })} />
              <SwatchPicker key={c.cellFamily} family={c.cellFamily} fabrics={fabricsFor("cellular")} onChange={(p) => set({ pick: p })} />
            </>
          ) : (
            <>
              <SwatchPicker key="day" heading="Day color (light-filtering)" role="Day (light-filtering)" family="light-filtering" fabrics={fabricsFor("cellular")} onChange={(p) => set({ day: p })} />
              <SwatchPicker key="night" heading="Night color (blackout)" role="Night (blackout)" family="blackout" fabrics={fabricsFor("cellular")} onChange={(p) => set({ night: p })} />
            </>
          )}
        </>
      )}

      {/* ---- Roman ---- */}
      {line.id === "roman" && (
        <>
          <SwatchPicker fabrics={fabricsFor("roman")} onChange={onRomanPick} />
          {c.pick && (
            <>
              <OptionCards label="Style" value={c.romanStyle} onChange={onRomanStyle}
                options={ROMAN_STYLES.map(s => ({ ...s, desc: ROMAN_STYLE_INFO[s.id].desc, img: ROMAN_STYLE_INFO[s.id].img }))}
                disabledIds={romanOpts.filter(o => !o.available).map(o => o.id)}
                note={romanOpts.some(o => !o.available) ? "Greyed styles are not available in this fabric." : null} />
              {c.romanStyle && (
                <OptionCards label="Lining" value={c.lining} onChange={(lining) => set({ lining })}
                  options={liningsForStyle.map(l => ({ id: l, label: LINING_LABELS[l], desc: LINING_INFO[l] }))} />
              )}
            </>
          )}
        </>
      )}

      {/* ---- Drapery: once opened, Dream Curtains stays mounted so a pick survives switching tabs ---- */}
      {line.id === "drapery" && (
        <>
          <div hidden={c.section !== "curtains"}>
            <SwatchPicker key="curtains" fabrics={fabricsFor("drapery")} onChange={(p) => set({ pick: p })} />
            <OptionCards label="Pleat style" value={c.pleat} onChange={(pleat) => set({ pleat })}
              options={PLEATS.map(p => ({ id: p, label: p, desc: PLEAT_INFO[p].desc, img: PLEAT_INFO[p].img }))}
              note="Availability confirmed with your quote" />
            <OptionCards label="Lining" value={c.lining} onChange={(lining) => set({ lining })}
              options={["blackout", "light-filtering", "none"].map(l => ({ id: l, label: LINING_LABELS[l], desc: LINING_INFO[l] }))} />
          </div>
          {dreamOpened && (
            <div hidden={c.section !== "dream-curtains"}>
              <SwatchPicker key="dream" eagerFirst={false} fabrics={fabricsFor("dream-curtains")} onChange={(p) => set({ dream: p })} />
            </div>
          )}
        </>
      )}

      {/* ---- Shared order options ---- */}
      <OptionCards label={line.id === "drapery" ? "Control (track)" : "Control"} value={mech} onChange={setMech} options={controlOptions(line)} />
      <OptionCards label="Mount type" value={mount} onChange={setMount}
        options={line.mounts.map(mid => ({ id: mid, label: MOUNTS.find(m => m.id === mid).name, desc: MOUNT_INFO[mid].desc, img: MOUNT_INFO[mid].img }))} />
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

  return (
    <div className="page-fade">
      <header className="line-head">
        <div className="container line-head-inner">
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="/products" onClick={(e) => { e.preventDefault(); navigate("products"); }}>Products</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{line.name}</span>
          </nav>
          <h1 className="serif">{line.name}</h1>
          <p className="line-desc">{line.blurb}</p>
        </div>
      </header>

      <div className="container line-body">
        <Configurator key={line.id} line={line} addToQuote={addToQuote} />

        <section className="line-good" aria-labelledby="good-title">
          <h2 id="good-title" className="eyebrow">Good to know</h2>
          <ul className="good-list">
            {line.goodToKnow.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </section>

        {photos.length > 0 && (
          <section className="line-gallery" aria-label={`${line.name} in a home`}>
            {photos.slice(0, 6).map(p => (
              <ShowcasePhoto key={p.file} entry={p} lineName={line.name} sizes="(min-width: 900px) 33vw, 100vw" />
            ))}
          </section>
        )}

        <div className="line-measure-link">
          <strong>Not sure how to measure?</strong> Our guide walks you through it.
          <button className="btn btn-outline btn-sm" onClick={() => navigate("measure")}>Open Guide <ArrowRight size={14} /></button>
        </div>
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}
