// The shared layout of every redesigned product page: sticky photo on the left, numbered steps on the right,
// then size, mount, control, room, quantity, the estimate and the sticky price bar.
// A line page supplies its own steps (fabric, color, style ...) and its price configuration; everything else is here.
import { useState } from 'react';
import { MOUNTS, getMechanism } from './data/lines.js';
import { CONTROL_COPY, CONTROL_IMG, MOUNT_INFO } from './data/optionInfo.js';
import { priceRequest, usePriceState } from './lib/estimate.js';
import { buildSelection } from './lib/lineSelection.js';
import { formatInches } from './lib/inches.js';
import { summarize } from './lib/selection.js';
import { CatalogStatusContext, useLineCatalog } from './lib/useCatalog.js';
import { Step, Cards, MOUNT_PICTURES, SizeFields, EMPTY_SIZE, sizeNumbers, EstimateCard, PriceBar, QtyField, priceView } from './components/s2.jsx';
import SitePhoto from './components/SitePhoto.jsx';
import { Footer } from './customer.jsx';

// Title, intro and photos of each line (names and photos from the approved mockup).
export const PAGE = {
  roller: { title: 'Roller Shades', intro: 'A single roll of fabric that rolls up neatly out of sight. Made to your exact size.' },
  zebra: { title: 'Zebra Shades', intro: 'Alternating sheer and solid stripes. Slide them to let light in or close for privacy. Made to your exact size.' },
  'shangri-la': { title: 'Shangri-La Shades', intro: 'Soft fabric vanes floating between two sheers. Tilt for gentle, even light. Made to your exact size.' },
  roman: { title: 'Roman Shades', intro: 'Soft fabric folds that stack neatly when raised. Warm and tailored. Made to your exact size.' },
  cellular: { title: 'Cellular Shades', intro: 'Honeycomb cells trap air to help keep rooms comfortable. Top-down options available. Made to your exact size.' },
  drapery: { title: 'Drapery', intro: 'Custom curtains and Dream Curtains, the walk-through sheer for patio doors.' },
};

export const PHOTOS = {
  zebra: [
    { name: 'zebra-dining', alt: 'Beige zebra shade in a dining room' },
    { name: 'zebra-kitchen', alt: 'Zebra shade over a kitchen window' },
    { name: 'zebra-grey', alt: 'Grey zebra shades above a bed' },
  ],
  'shangri-la': [{ name: 'shangri-la', alt: 'Shangri-La shade with soft fabric vanes between two sheers' }],
  roman: [{ name: 'roman', alt: 'Linen Roman shade half raised in a dining room' }],
  cellular: [
    { name: 'cellular', alt: 'Grey cellular shade in a bedroom' },
    { name: 'cellular-tdbu', alt: 'Top-down bottom-up cellular shade lowered from the top' },
  ],
  curtains: [{ name: 'drapery', alt: 'Floor-to-ceiling sheer curtains in a bedroom' }],
  'dream-curtains': [{ name: 'dream-curtains', alt: 'Dream Curtains, soft vertical panels beside a patio door' }],
};

export default function LineShell({
  line, navigate, addToQuote, title, intro, photo, photoNote, gallery, onGallery, chip,
  leadSteps, c, colorNeeds, checks, tailSteps = [], tail, controlTitle = 'How you raise and lower it', hideMount = false, header = null,
}) {
  const catalog = useLineCatalog(line.id);
  const [mech, setMech] = useState(line.mechanisms[0].id);
  const [mount, setMount] = useState(line.mounts[0]);
  const [size, setSize] = useState(EMPTY_SIZE);
  const [room, setRoom] = useState('');
  const [qty, setQty] = useState('1');
  const [added, setAdded] = useState(false);

  const n = Math.max(1, parseInt(qty, 10) || 1);
  const { width, height } = sizeNumbers(size);
  const sized = parseFloat(width) > 0 && parseFloat(height) > 0;
  const req = priceRequest(line, c, mech, width, height);
  const view = priceView(req, usePriceState(req));
  const { selection, missing } = buildSelection(line, c);
  const optionsReady = missing.length === 0;
  const canAdd = optionsReady && sized && view.kind !== 'loading' && view.kind !== 'waiting';
  const needs = !optionsReady ? colorNeeds : !sized ? 'Enter your size' : 'Calculating…';

  const mechObj = getMechanism(line, mech);
  const mountObj = MOUNTS.find((m) => m.id === mount);

  const handleAdd = () => {
    if (!canAdd) return;
    const first = selection.picks[0];
    addToQuote({
      product: line, variant: line.name, mech, mount, selection,
      code: first?.code ?? null,
      colorName: first ? first.displayName : line.name,
      category: line.id, location: line.location,
      price: view.kind === 'price' ? view.price : null,          // the price for one window; the order multiplies by qty
      priceKind: view.kind === 'price' ? 'estimate' : 'email',
      width: parseFloat(width) || null, length: parseFloat(height) || null, qty: n,
      roomLabel: room.trim(), addons: { blackout: false, install: false },
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const sum = summarize({ product: line, selection });
  const summary = [
    sum.parts.filter(Boolean).join(' · ') || line.name,
    `${formatInches(width)}" wide × ${formatInches(height)}" high${hideMount ? '' : ` · ${mountObj?.name}`}`,
    mechObj?.name,
  ];

  let k = 0;
  const mountOptions = line.mounts.map((id) => ({ id, label: MOUNTS.find((m) => m.id === id).name, desc: MOUNT_INFO[id].desc, picture: MOUNT_PICTURES[id] }));
  return (
    <CatalogStatusContext.Provider value={catalog}>
      <div className="page-fade s2 s2-line">
        <div className="s2-wrap">
          <nav className="s2-crumbs" aria-label="Breadcrumb">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate('home'); }}>Home</a> / <a href="/products" onClick={(e) => { e.preventDefault(); navigate('products'); }}>Products</a> / <span aria-current="page">{title}</span>
          </nav>
          <div className="s2-line-grid">
            <div className="s2-line-photo">
              <div className="s2-photo-frame">
                <SitePhoto key={photo.name} name={photo.name} alt={photo.alt} sizes="(min-width: 960px) 45vw, 92vw" eager />
                {chip && (
                  <span className="s2-photo-chip">
                    <img src={chip.thumb} alt="" width="36" height="36" />
                    {chip.displayName}{chip.line === 'dream-curtains' ? '' : ` (${chip.code})`}
                  </span>
                )}
              </div>
              {gallery && gallery.length > 1 && (
                <div className="s2-gallery" role="group" aria-label="More photos">
                  {gallery.map((g) => (
                    <button key={g.name} type="button" className={g.name === photo.name ? 'on' : ''} aria-pressed={g.name === photo.name} aria-label={g.alt} onClick={() => onGallery(g.name)}>
                      <SitePhoto name={g.name} alt="" sizes="88px" />
                    </button>
                  ))}
                </div>
              )}
              <div className="s2-photo-note"><span aria-hidden="true">ⓘ</span> {photoNote || 'Photo shows the style. Your color is shown in the swatch.'}</div>
            </div>

            <div className="s2-line-steps">
              <div>
                <h1 className="s2-line-title">{title}</h1>
                <p className="s2-line-intro">{intro}</p>
              </div>
              {header}

              {leadSteps.map((st) => (
                <Step key={st.title} n={++k} title={st.title} hint={st.hint}>{st.node}</Step>
              ))}

              <Step n={++k} title="Size" hint={<>In inches. Not sure? <a href="/measure" onClick={(e) => { e.preventDefault(); navigate('measure'); }}>See how to measure</a>.</>}>
                <SizeFields size={size} onChange={setSize} />
              </Step>

              {!hideMount && (
                <Step n={++k} title="Mount">
                  <Cards label="Mount type" min={220} value={mount} onChange={setMount} options={mountOptions} />
                </Step>
              )}

              <Step n={++k} title={controlTitle}>
                <Cards label="Control" min={170} stack value={mech} onChange={setMech}
                  options={line.mechanisms.map((m) => ({ id: m.id, label: m.name, desc: CONTROL_COPY[m.id], img: CONTROL_IMG[line.id]?.[m.id] }))} />
              </Step>

              {tailSteps.map((st) => (
                <Step key={st.title} n={++k} title={st.title} hint={st.hint}>{st.node}</Step>
              ))}

              <Step n={++k} title="Which room is this for?">
                <label className="s2-sr" htmlFor="s2-room">Room name</label>
                <input id="s2-room" className="s2-input" type="text" placeholder="e.g. Primary bedroom, left window" value={room} onChange={(e) => setRoom(e.target.value)} />
                <p className="s2-step-hint">Helps you keep track when you order several windows.</p>
              </Step>

              <EstimateCard view={view} qty={n} summary={summary}
                checks={[...checks, { label: 'Width and height', done: sized }]}
                qtyField={<QtyField qty={qty} onChange={setQty} />} />
              {tail}
            </div>
          </div>
        </div>
        <PriceBar title={title} view={view} needs={needs} qty={n} canAdd={canAdd} added={added} onAdd={handleAdd} />
        <Footer navigate={navigate} />
      </div>
    </CatalogStatusContext.Provider>
  );
}
