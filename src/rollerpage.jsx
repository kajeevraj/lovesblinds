import { useState } from 'react';
import { MOUNTS, getMechanism } from './data/lines.js';
import { fabricsFor } from './data/swatchData.js';
import { CatalogStatusContext, useLineCatalog } from './lib/useCatalog.js';
import { FAMILY_LABELS } from './lib/selection.js';
import { CONTROL_COPY, CONTROL_IMG, MOUNT_INFO, ROLLER_MODE_INFO, ROLLER_FAMILY_INFO, ROLLER_FAMILY_CARD, ROLLER_PRIVACY_NOTE } from './data/optionInfo.js';
import { priceRequest, usePriceState } from './lib/estimate.js';
import { buildSelection } from './lib/lineSelection.js';
import { formatInches } from './lib/inches.js';
import { summarize } from './lib/selection.js';
import { Step, Cards, MOUNT_PICTURES, ColorStep, SizeFields, EMPTY_SIZE, sizeNumbers, EstimateCard, PriceBar, priceView } from './components/s2.jsx';
import SitePhoto from './components/SitePhoto.jsx';
import { Footer } from './customer.jsx';

const FAMILY_ORDER = ["solar", "screen-view", "blackout"];

// Fabric type buttons, the explanation under them, and (for Solar and Screen View) the privacy note.
function FabricType({ value, onChange, label }) {
  const info = ROLLER_FAMILY_INFO[value];
  return (
    <div>
      <Cards label={label} min={160} value={value} onChange={onChange}
        options={FAMILY_ORDER.map((f) => ({ id: f, label: FAMILY_LABELS[f], desc: ROLLER_FAMILY_CARD[f].tag }))} />
      <div className="s2-note-box">
        <div className="s2-note-title">{FAMILY_LABELS[value]}</div>
        <p>{info}</p>
        {value !== "blackout" && <p className="s2-note-privacy">{ROLLER_PRIVACY_NOTE}</p>}
      </div>
    </div>
  );
}

export default function RollerPage({ line, navigate, addToQuote }) {
  const catalog = useLineCatalog(line.id);
  const [mode, setMode] = useState("single");
  const [front, setFront] = useState({ family: "solar", pick: null });
  const [back, setBack] = useState({ family: "solar", pick: null });
  const [mech, setMech] = useState(line.mechanisms[0].id);
  const [mount, setMount] = useState(line.mounts[0]);
  const [size, setSize] = useState(EMPTY_SIZE);
  const [room, setRoom] = useState("");
  const [added, setAdded] = useState(false);

  const double = mode === "double-stack";
  const c = { mode, front: front.pick, back: back.pick };
  const { width, height } = sizeNumbers(size);
  const sized = parseFloat(width) > 0 && parseFloat(height) > 0;
  const req = priceRequest(line, c, mech, width, height);
  const view = priceView(req, usePriceState(req));
  const { selection, missing } = buildSelection(line, c);
  const colorsReady = missing.length === 0;
  const canAdd = colorsReady && sized && view.kind !== "loading" && view.kind !== "waiting";

  const photo = ROLLER_FAMILY_CARD[front.family];
  const mechObj = getMechanism(line, mech);
  const mountObj = MOUNTS.find((m) => m.id === mount);

  const checks = double
    ? [{ label: "Front shade color", done: !!front.pick }, { label: "Back shade color", done: !!back.pick }, { label: "Width and height", done: sized }]
    : [{ label: "Color", done: !!front.pick }, { label: "Width and height", done: sized }];
  const needs = !colorsReady ? (double ? "Pick a front and a back color" : "Pick a color") : !sized ? "Enter your size" : "Calculating…";

  const handleAdd = () => {
    if (!canAdd) return;
    const first = selection.picks[0];
    addToQuote({
      product: line, variant: line.name, mech, mount, selection,
      code: first?.code ?? null,
      colorName: first ? first.displayName : line.name,
      category: line.id, location: line.location,
      price: view.kind === "price" ? view.price : null,
      priceKind: view.kind === "price" ? "estimate" : "email",
      width: parseFloat(width) || null, length: parseFloat(height) || null, qty: 1,
      roomLabel: room.trim(), addons: { blackout: false, install: false },
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const sum = summarize({ product: line, selection });
  const estimateSummary = [
    sum.parts.filter((p) => p).join(" · ") || line.name,
    `${formatInches(width)}" wide × ${formatInches(height)}" high · ${mountObj?.name}`,
    mechObj?.name,
  ];

  const shadeBlock = (st, setSt, role) => (
    <>
      <FabricType label={role ? `${role} fabric type` : "Fabric type"} value={st.family} onChange={(f) => setSt({ family: f, pick: null })} />
      <ColorStep key={`${role}-${st.family}`} id={`c-${role || "single"}`} fabrics={fabricsFor("roller", st.family)} family={st.family} role={role}
        value={st.pick} onChange={(pick) => setSt({ ...st, pick })} />
    </>
  );

  let n = 0;
  return (
    <CatalogStatusContext.Provider value={catalog}>
      <div className="page-fade s2 s2-line">
        <div className="s2-wrap">
          <nav className="s2-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a> / <a href="/products" onClick={(e) => { e.preventDefault(); navigate("products"); }}>Products</a> / <span aria-current="page">{line.name}</span>
          </nav>
          <div className="s2-line-grid">
            <div className="s2-line-photo">
              <div className="s2-photo-frame">
                <SitePhoto key={photo.photo} name={photo.photo} alt={photo.alt} sizes="(min-width: 960px) 45vw, 92vw" eager />
                {front.pick && (
                  <span className="s2-photo-chip">
                    <img src={front.pick.thumb} alt="" width="36" height="36" />
                    {front.pick.displayName} ({front.pick.code})
                  </span>
                )}
              </div>
              <div className="s2-photo-note"><span aria-hidden="true">ⓘ</span> Photo shows {FAMILY_LABELS[front.family]} fabric. Your color is shown in the swatch.</div>
            </div>

            <div className="s2-line-steps">
              <div>
                <h1 className="s2-line-title">Roller Shades</h1>
                <p className="s2-line-intro">A single roll of fabric that rolls up neatly out of sight. Made to your exact size.</p>
              </div>

              <Step n={++n} title="One shade or two">
                <Cards label="Single or double-stack" value={mode} onChange={(m) => { setMode(m); setFront((s) => ({ ...s, pick: null })); setBack((s) => ({ ...s, pick: null })); }}
                  options={line.modes.map((m) => ({ id: m, label: m === "single" ? "Single" : "Double-stack", desc: ROLLER_MODE_INFO[m].desc, img: ROLLER_MODE_INFO[m].img }))} />
                {double && <p className="s2-step-hint s2-need">Double-stack needs two colors, one for the front shade and one for the back. Your price appears once both are chosen.</p>}
              </Step>

              {!double ? (
                <>
                  <Step n={++n} title="Fabric type and color" hint="Pick a fabric type, then your color.">{shadeBlock(front, setFront, null)}</Step>
                </>
              ) : (
                <>
                  <Step n={++n} title="Front shade: fabric type and color">{shadeBlock(front, setFront, "Front shade")}</Step>
                  <Step n={++n} title="Back shade: fabric type and color">{shadeBlock(back, setBack, "Back shade")}</Step>
                </>
              )}

              <Step n={++n} title="Size" hint={<>In inches. Not sure? <a href="/measure" onClick={(e) => { e.preventDefault(); navigate("measure"); }}>See how to measure</a>.</>}>
                <SizeFields size={size} onChange={setSize} />
              </Step>

              <Step n={++n} title="Mount">
                <Cards label="Mount type" min={220} value={mount} onChange={setMount}
                  options={line.mounts.map((id) => ({ id, label: MOUNTS.find((m) => m.id === id).name, desc: MOUNT_INFO[id].desc, picture: MOUNT_PICTURES[id] }))} />
              </Step>

              <Step n={++n} title="How you raise and lower it">
                <Cards label="Control" min={170} stack value={mech} onChange={setMech}
                  options={line.mechanisms.map((m) => ({ id: m.id, label: m.name, desc: CONTROL_COPY[m.id], img: CONTROL_IMG.roller?.[m.id] }))} />
              </Step>

              <Step n={++n} title="Which room is this for?">
                <label className="s2-sr" htmlFor="s2-room">Room name</label>
                <input id="s2-room" className="s2-input" type="text" placeholder="e.g. Primary bedroom, left window" value={room} onChange={(e) => setRoom(e.target.value)} />
                <p className="s2-step-hint">Helps you keep track when you order several windows.</p>
              </Step>

              <EstimateCard view={view} checks={checks} summary={estimateSummary} />
            </div>
          </div>
        </div>
        <PriceBar title="Roller Shades" view={view} needs={needs} canAdd={canAdd} added={added} onAdd={handleAdd} />
        <Footer navigate={navigate} />
      </div>
    </CatalogStatusContext.Provider>
  );
}
