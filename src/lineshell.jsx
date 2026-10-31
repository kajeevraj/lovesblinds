// The shared layout of every redesigned product page: sticky photo on the left, numbered steps on the right,
// then size, mount, control, room, quantity, the estimate and the sticky price bar.
// A line page supplies its own steps (fabric, color, style ...) and its price configuration; everything else is here.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useCompactStrip } from './lib/useCompactStrip.js';
import SitePhoto from './components/SitePhoto.jsx';
import { MOUNTS, getMechanism } from './data/lines.js';
import { CONTROL_COPY, CONTROL_IMG, MOUNT_INFO, POWER_COPY, SOLAR_COPY, MOTOR_CONTROL_COPY, SIDE_NOTE_BATTERY, SIDE_NOTE_WIRED, SIDE_NOTE_TWO_IN_ONE } from './data/optionInfo.js';
import { usesDrive, mechName, parseMech, formatMech, pricingOptions, movementsFor, defaultMovement, motorControlsFor, powersFor, cellularMotorName, MOVEMENT_NAME, POWER_NAME, MOTOR_CONTROL_NAME, SIDE_NAME } from './lib/drive.js';
import { extrasFor, extrasText, CHAIN_COLORS, CORD_TYPES, CORD_LOOP_COLORS, BAR_COLORS, ROLL_DIRECTIONS } from './lib/choices.js';
import { useLineOptions } from './lib/lineOptions.js';
import { useHubPrice } from './lib/hubPrice.js';
import { zigbeeNote } from './lib/hub.js';
import { priceRequest, usePriceState } from './lib/estimate.js';
import { CORD_LOOP_LINES } from './lib/choices.js';
import { buildSelection } from './lib/lineSelection.js';
import { formatInches } from './lib/inches.js';
import { summarize } from './lib/selection.js';
import { CatalogStatusContext, useLineCatalog } from './lib/useCatalog.js';
import { SimpleRemote } from './room/remotes.jsx';
import { isMotorized, remoteFor, shadeCount, SHARE_NOTE, WORKS_NOTE } from './lib/remote.js';
import { Step, Cards, ColorDots, MoreOptions, RollDiagram, MOUNT_PICTURES, EstimateCard, QtyField, priceView } from './components/s2.jsx';
import Gallery from './components/Gallery.jsx';
import SizeFields, { EMPTY_SIZE, sizeNumbers } from './components/SizeFields.jsx';
import RoomFields, { splitRoom, roomLabelOf } from './components/RoomFields.jsx';
import { blinds } from './lib/itemView.js';
import { saveDraft, clearDraft, hasProgress } from './lib/drafts.js';
import { PriceBar } from './components/OrderBar.jsx';
import { useCart, BuildAnotherContext } from './lib/cart.js';
import { useContext } from 'react';
import { useSizeLimits, limitLineFor } from './lib/sizeLimits.js';
import { checkSize, clampQty, TYPO_TEXT } from './lib/limits.js';
import { Footer } from './customer.jsx';

// The 3D preview (three.js) is its own chunk, fetched after the page is up; the style photo shows until it is ready (or for good without WebGL).
const PreviewPane = lazy(() => import('./room/PreviewPane.jsx'));
const usePhoneMedia = (q) => { const [m, setM] = useState(() => matchMedia(q).matches); useEffect(() => { const mq = matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]); return m; };

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
  roller: [
    { name: 'solar', alt: 'Light grey solar roller shades in a home office' },
    { name: 'screen-view', alt: 'Grey screen view roller shade with the garden visible through it' },
    { name: 'blackout', alt: 'Charcoal blackout roller shade in a bedroom' },
  ],
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
  line, navigate, edit = null, start = null, ui = null, title, intro, photos, photoNote, chip,
  leadSteps, c, colorNeeds, checks, tailSteps = [], tail, controlTitle = 'How you raise and lower it', hideMount = false, hideControl = false, sizeHint = null, header = null, preview = null, mechList = null,
}) {
  const catalog = useLineCatalog(line.id);
  const cart = useCart();
  // every choice starts as it was saved: the draft from earlier on this page, else the item being edited
  const double = c.mode === 'double-stack';
  const [mech, setMech] = useState(() => {
    const m = start?.mech || edit?.mech || (usesDrive(line.id) ? defaultMovement(line.id, { double }) : line.mechanisms[0].id);
    return usesDrive(line.id) ? formatMech(line.id, parseMech(line.id, m, { double })) : (line.id === 'drapery' ? parseMech('drapery', m).movement : m);      // (older Dream Curtains orders say remote or matter: both are Motorized now)
  });
  const opts = useLineOptions(line.id);
  const hubPrice = useHubPrice();
  // the small $0 choices (chain color, cord loop, bottom bar, roll direction): what was saved, else the defaults
  const [extras, setExtras] = useState(() => start?.selection?.extras || edit?.selection?.extras || {});
  const [mount, setMount] = useState(start?.mount || edit?.mount || line.mounts[0]);
  const [size, setSize] = useState(start ? { w: start.w, h: start.h } : EMPTY_SIZE);
  const [roomF, setRoomF] = useState(() => ({ ...splitRoom(start?.roomLabel), windowLabel: start?.windowLabel || '' }));
  const room = roomLabelOf(roomF.choice, roomF.custom);
  const [qty, setQty] = useState(String(start?.qty || edit?.qty || 1));
  const [addedAt, setAddedAt] = useState(null);       // { key, merged, qty } for the choices that were just added
  const buildAnother = useContext(BuildAnotherContext);
  // the left column: a gallery whose first picture is the live 3D preview (for lines that have a model), then the line's style photos;
  // on a phone it docks under the top as you scroll
  const phone = usePhoneMedia('(max-width: 959px)');
  const [dock, setDock] = useState({ collapsed: false });
  const leftRef = useRef(null);
  // the strip folds to a compact one while the page is scrolled down past the gallery (src/lib/useCompactStrip.js); it has a button to hide it altogether
  const [compact, openStrip] = useCompactStrip(leftRef, !!preview && phone && !dock.collapsed);

  const n = clampQty(qty);
  const { width, height } = sizeNumbers(size);
  const sized = parseFloat(width) > 0 && parseFloat(height) > 0;
  // the smallest we can make (from the database): below it nothing is priced and nothing can be added; above the largest the
  // price function itself answers "larger than our standard range"; a size that looks like a typo only gets a warning
  const limits = useSizeLimits(limitLineFor(line.id, c.section), pricingOptions(line.id, mech, { double }).control);
  const chk = checkSize(limits, width, height);
  const tooSmall = chk.tooSmall.length > 0;
  const req = tooSmall ? null : priceRequest(line, { ...c, extras }, mech, width, height);
  const priced = priceView(req, usePriceState(req));
  const view = tooSmall ? { kind: 'toosmall', text: chk.tooSmall.map((t) => t.text).join(' ') } : priced;
  const { selection, missing } = buildSelection(line, { ...c, mech, extras });
  const optionsReady = missing.length === 0;
  const canAdd = optionsReady && sized && !tooSmall && view.kind !== 'loading' && view.kind !== 'waiting';
  const needs = !optionsReady ? colorNeeds : tooSmall ? chk.tooSmall.map((t) => t.text).join(' ') : !sized ? 'Enter your size' : 'Calculating…';

  const chosen = usesDrive(line.id) ? extrasFor(line.id, parseMech(line.id, mech, { double }).movement, extras, { double }) : {};
  const mechObj = getMechanism(line, mech);
  const drive = parseMech(line.id, mech, { double });
  // the remote that comes with a motorized shade: its channels come from the motorized shades in the cart that share this room (never a customer choice)
  const probe = { category: line.id, mech, selection: { ...selection, section: c.section, type: c.type, mode: c.mode, hardware: selection.hardware }, qty: n, roomLabel: room };
  const motorized = isMotorized(probe);
  const remote = remoteFor(line.id, probe.selection, room, cart.items.filter((i) => i.id !== edit?.id), shadeCount(probe));
  // movements the owner has not turned off; a choice that is no longer offered (a double-stack has no Chain) falls back to the line's first
  const movements = usesDrive(line.id) ? movementsFor(line.id, { double }).filter((m) => opts.isOn('control', m)) : [];
  useEffect(() => {
    if (!usesDrive(line.id)) return;
    const d = parseMech(line.id, mech, { double });
    const next = movements.includes(d.movement) ? formatMech(line.id, d) : formatMech(line.id, parseMech(line.id, movements[0] || defaultMovement(line.id, { double }), { double }));
    if (next !== mech) setMech(next);
  }, [double, mech, movements.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const [remoteLit, setRemoteLit] = useState(null);
  const flashRemote = (id) => { setRemoteLit(id); setTimeout(() => setRemoteLit((l) => (l === id ? null : l)), 320); };
  // a section that offers fewer choices (regular Curtains: manual only, no motor yet) resets a choice it does not have
  useEffect(() => { if (mechList && !mechList.some((m) => m.id === mech)) setMech(mechList[0].id); }, [mechList, mech]);
  const mountObj = MOUNTS.find((m) => m.id === mount);

  // What is chosen is saved in this browser as it changes, so the back button or a refresh never loses it. Right after the item
  // is added the same choices are not a draft any more (no "incomplete" copy of what is already in the cart).
  const addedSig = useRef(null);
  const draftSig = JSON.stringify([selection, mech, mount, size.w, size.h, room, roomF.windowLabel]);          // (the extras are inside the selection)
  const uiSig = JSON.stringify(ui || {});
  const origSig = edit ? JSON.stringify([edit.selection ?? null, usesDrive(line.id) ? formatMech(line.id, parseMech(line.id, edit.mech, { double: edit.selection?.mode === 'double-stack' })) : edit.mech, edit.mount, formatInches(edit.width), formatInches(edit.length), edit.roomLabel || '', edit.windowLabel || '']) : null;
  useEffect(() => {
    const data = { selection, mech, mount, w: size.w, h: size.h, roomLabel: room, windowLabel: roomF.windowLabel, qty, ui: ui || {} };
    if (draftSig === addedSig.current || (edit && draftSig === origSig) || (!edit && !hasProgress(data))) clearDraft(line.id, edit?.id || null);
    else saveDraft(line.id, edit?.id || null, data);
  }, [draftSig, qty, uiSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Editing from the cart: put the "You're changing an item in your cart" message at the top of the screen (the photo comes first on a phone)
  const editingRef = useRef(null);
  useEffect(() => {
    if (!edit || !window.matchMedia('(max-width: 959px)').matches) return undefined;
    const go = () => { const el = editingRef.current; if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 8), behavior: 'instant' }); };
    go();
    const t = setTimeout(go, 250);               // once pictures and colors have taken their space
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = () => {
    if (!canAdd) return;
    const first = selection.picks[0];
    const item = {
      id: edit?.id,
      product: line, variant: line.name, mech, mount, selection,
      code: first?.code ?? null,
      colorName: first ? first.displayName : line.name,
      category: line.id, location: line.location,
      price: view.kind === 'price' ? view.price : null,          // the price for one window; the order multiplies by qty
      priceKind: view.kind === 'price' ? 'estimate' : 'email',
      width: parseFloat(width) || null, length: parseFloat(height) || null, qty: n,
      roomLabel: room, windowLabel: roomF.windowLabel.trim(), addons: edit?.addons || { blackout: false, install: false },
    };
    if (edit) { clearDraft(line.id, edit.id); cart.saveItem(edit.id, item); navigate('quote'); return; }
    addedSig.current = draftSig;
    clearDraft(line.id, null);
    const r = cart.addItem(item);
    setAddedAt({ key: `${draftSig}|${n}`, merged: r.merged, qty: r.qty });
  };
  // the confirmation stays until something about the blind (or how many) changes
  const justAdded = !edit && addedAt && addedAt.key === `${draftSig}|${n}` ? addedAt : null;

  // "Add another like this": the same product, color, options and room, with the size and window label cleared
  const addAnother = () => {
    saveDraft(line.id, null, { selection, mech, mount, w: '', h: '', roomLabel: room, windowLabel: '', qty: '1', ui: ui || {} });
    try { sessionStorage.setItem('lb_scroll', 'size'); } catch { /* ignore */ }
    buildAnother();
  };

  // tell the cart which blind is on this page, so Checkout can ask "Add this blind to your cart first?"
  useEffect(() => { cart.registerPage({ ready: !edit && canAdd && !justAdded, add: handleAdd, discard: () => clearDraft(line.id, null) }); });
  useEffect(() => () => cart.registerPage(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Arriving from "Finish choosing" or "Add another like this": scroll to the first missing step (or the Size step)
  const missingRef = useRef({ missing, sized });
  missingRef.current = { missing, sized };
  useEffect(() => {
    let mode = null;
    try { mode = sessionStorage.getItem('lb_scroll'); sessionStorage.removeItem('lb_scroll'); } catch { /* ignore */ }
    if (!mode || edit) return undefined;
    const go = () => {
      const steps = [...document.querySelectorAll('.s2-step')];
      const byTitle = (re) => steps.find((e) => re.test(e.querySelector('.s2-step-title')?.innerText.replace(/^\d+\s*/, '') || ''));
      const { missing: miss, sized: ok } = missingRef.current;
      let el = null;
      if (mode === 'size') el = byTitle(/^Size$/);
      else if (miss.length) {
        const m = miss[0];
        const re = /front/i.test(m) ? /front/i : /back/i.test(m) ? /back/i : /day/i.test(m) ? /day/i : /night/i.test(m) ? /night/i : /pleat/i.test(m) ? /pleat/i : /lining/i.test(m) ? /lining/i : /style/i.test(m) ? /^style$/i : /color|fabric/i;
        el = byTitle(re) || steps[0];
      } else if (!ok) el = byTitle(/^Size$/);
      else el = document.querySelector('.s2-estimate');
      if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 12), behavior: 'instant' });
    };
    go();
    const t = setTimeout(go, 350);              // once the colors have loaded and taken their space
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const footer = justAdded ? (
    <div className="s2-added-card" role="status">
      <div className="s2-added-card-head"><span className="s2-added-check" aria-hidden="true">✓</span><strong>Added to your cart</strong></div>
      {justAdded.merged && <p className="s2-added-card-text">Same as one already in your cart, so it now has {blinds(justAdded.qty)} of this size.</p>}
      <div className="s2-added-card-actions">
        <button type="button" className="s2-btn s2-btn-brass" onClick={cart.goCheckout}>Checkout</button>
        <button type="button" className="s2-btn s2-btn-line" onClick={() => navigate('products')}>Keep shopping</button>
      </div>
      <button type="button" className="s2-link s2-build-another" onClick={addAnother}>Add another like this</button>
    </div>
  ) : (
    <>
      <button type="button" className="s2-btn s2-btn-brass s2-add-btn" disabled={!canAdd} onClick={handleAdd}>{edit ? 'Save changes' : 'Add to cart'}</button>
      {!canAdd && <p className="s2-add-hint">{needs}</p>}
    </>
  );

  const sum = summarize({ product: line, selection });
  // one short line per color ("Day: Light filtering · Name (code)"), then the other options, then size and control
  const nPicks = selection.picks.length;
  const shortRole = (r) => String(r || '').replace(/\s*\(.*\)\s*$/, '').replace(/ shade$/i, '');
  const pickLines = nPicks > 1 ? selection.picks.map((pk, i) => `${shortRole(pk.role) || `Color ${i + 1}`}: ${sum.parts[i].replace(/^[^:]*: /, '')}`) : sum.parts.slice(0, nPicks);
  const optionLine = sum.parts.slice(nPicks).filter(Boolean).join(' · ');
  const summary = [
    ...pickLines,
    optionLine,
    `${formatInches(width)}" wide × ${formatInches(height)}" high${hideMount ? '' : ` · ${mountObj?.name}`}`,
    mechName(line.id, mech, mechObj?.name, selection),
  ].filter(Boolean);
  if (!summary.length) summary.push(line.name);

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
            <div className={`s2-line-photo${preview ? ' has-preview' : ''}${preview && dock.collapsed ? ' collapsed' : ''}${compact ? ' compact' : ''}`} ref={leftRef}>
              {compact && <button type="button" className="pv-expand" aria-label="Show the full preview" onClick={openStrip} />}
              {preview && phone && (
                <div className="pv-tabs">
                  <button type="button" className="pv-collapse" aria-expanded={!dock.collapsed} onClick={() => setDock((d) => ({ ...d, collapsed: !d.collapsed }))}>{dock.collapsed ? 'Show preview' : 'Hide preview'}</button>
                </div>
              )}
              <Gallery photos={photos} photoNote={photoNote} chip={chip}
                config={preview ? (
                  <div className="pv-wrap">
                    <Suspense fallback={<div className="pv"><div className="pv-stage"><div className="s2-photo-frame"><SitePhoto name={photos[0].name} alt={photos[0].alt} sizes="(min-width: 960px) 45vw, 92vw" eager /></div></div></div>}>
                      <PreviewPane kind={preview.kind} picks={preview.picks} double={!!preview.double} width={parseFloat(width) || null} height={parseFloat(height) || null}
                        mount={mount} mech={mech} cover={preview.cover} phone={phone} remoteType={remote.type} shareNote={motorized && remote.count >= 2}
                        extras={{ ...extrasFor(line.id, drive.movement, extras, { double }), bottomWrap: preview.bottomWrap }}
                        fallback={<div className="s2-photo-frame"><SitePhoto name={photos[0].name} alt={photos[0].alt} sizes="(min-width: 960px) 45vw, 92vw" eager /></div>} />
                    </Suspense>
                  </div>
                ) : null} />
            </div>

            <div className="s2-line-steps">
              {edit && (
                <div className="s2-editing" role="status" ref={editingRef}>
                  <span>You’re changing: <strong>{[edit.product.name, edit.roomLabel ? `${edit.roomLabel}${edit.windowLabel ? ` · ${edit.windowLabel}` : ''}` : edit.colorName].filter(Boolean).join(', ')}</strong></span>
                  <a className="s2-link" href="/order" onClick={(e) => { e.preventDefault(); clearDraft(line.id, edit.id); navigate('quote'); }}>Cancel</a>
                </div>
              )}
              <div>
                <h1 className="s2-line-title">{title}</h1>
                <p className="s2-line-intro">{intro}</p>
              </div>
              {header}

              {leadSteps.map((st) => (
                <Step key={st.title} n={++k} title={st.title} hint={st.hint}>{st.node}</Step>
              ))}

              <Step n={++k} title="Size" hint={<>{sizeHint ? `${sizeHint} ` : ''}Not sure? <a href="/measure" onClick={(e) => { e.preventDefault(); navigate('measure'); }}>See how to measure</a>.</>}>
                <SizeFields size={size} onChange={setSize} />
                {tooSmall && <p className="s2-size-msg is-error" role="alert">{chk.tooSmall.map((t) => <span key={t.dim}>{t.text} </span>)}Please enter a larger size.</p>}
                {chk.typo && <p className="s2-size-msg is-warn" role="status">{TYPO_TEXT}</p>}
              </Step>

              {!hideMount && (
                <Step n={++k} title="Mount">
                  <Cards label="Mount type" min={220} value={mount} onChange={setMount} options={mountOptions} />
                </Step>
              )}

              {!hideControl && (
                <Step n={++k} title={controlTitle}>
                  <Cards label="Control" min={170} stack value={usesDrive(line.id) ? drive.movement : mech} onChange={(id) => setMech(usesDrive(line.id) ? formatMech(line.id, { ...drive, movement: id }) : id)}
                    options={(usesDrive(line.id) ? movements.map((m) => ({ id: m, name: MOVEMENT_NAME[m] })) : (mechList || line.mechanisms)).map((m) => ({
                      id: m.id || m, label: m.name, desc: CONTROL_COPY[m.id || m], img: CONTROL_IMG[line.id]?.[m.id || m], plain: (m.id || m) === 'chain',
                      badge: [opts.best === (m.id || m) && 'Best value', opts.top === (m.id || m) && 'Top of the line'].filter(Boolean),
                    }))} />
                  {usesDrive(line.id) && drive.movement === 'chain' && CORD_LOOP_LINES.includes(line.id) && opts.isOn('control', 'chain') && (
                    <Cards label="Chain or cord loop" min={200} value={chosen.cordType || 'chain'} onChange={(id) => setExtras((e) => ({ ...e, cordType: id }))}
                      options={CORD_TYPES.filter((t) => opts.isOn('cord-type', t.id)).map((t) => ({ id: t.id, label: t.label, desc: t.desc }))} />
                  )}
                </Step>
              )}
              {usesDrive(line.id) && drive.movement === 'motorized' && (
                <>
                  <Step n={++k} title={line.id === 'cellular' ? 'Motor' : 'Power'}>
                    {line.id === 'cellular' && (
                      <div className="s2-note-box"><div className="s2-note-title">{cellularMotorName(c.type)}</div><p>The motor matches the style you picked. It runs on a rechargeable battery, and the remote is included.</p></div>
                    )}
                    {powersFor(line.id).length > 1 && (
                      <Cards label="Power" min={200} value={drive.power} onChange={(id) => setMech(formatMech(line.id, { ...drive, power: id }))}
                        options={powersFor(line.id).filter((id) => opts.isOn('power', id)).map((id) => ({ id, label: POWER_NAME[id], desc: POWER_COPY[id] }))} />
                    )}
                    {drive.power === 'battery' && (
                      <Cards label="Solar panel" min={200} value={drive.solar ? 'solar' : 'none'} onChange={(id) => setMech(formatMech(line.id, { ...drive, solar: id === 'solar' }))}
                        options={[{ id: 'none', label: 'No solar panel', desc: 'Recharge the battery about every 6 months.' }, { id: 'solar', label: 'Add a solar panel', desc: SOLAR_COPY }]} />
                    )}
                  </Step>
                  {motorControlsFor(line.id, { double }).length > 1 && (
                    <Step n={++k} title="How you control it">
                      <Cards label="Motor control" min={220} stack value={drive.control} onChange={(id) => setMech(formatMech(line.id, { ...drive, control: id }))}
                        options={motorControlsFor(line.id, { double }).filter((id) => opts.isOn('motor-control', id)).map((id) => ({ id, label: MOTOR_CONTROL_NAME[id], desc: MOTOR_CONTROL_COPY[id].replace('{hub}', `$${hubPrice}`) }))} />
                    </Step>
                  )}
                </>
              )}
              {usesDrive(line.id) && (drive.movement === 'chain' || drive.movement === 'motorized' || drive.movement === 'two-in-one') && (
                <Step n={++k} title={drive.movement === 'chain' ? 'Chain side' : 'Motor side'}
                  hint={drive.movement === 'two-in-one' ? SIDE_NOTE_TWO_IN_ONE : drive.movement === 'motorized' ? (drive.power === 'wired' ? SIDE_NOTE_WIRED : SIDE_NOTE_BATTERY) : null}>
                  <Cards label="Side" min={140} value={drive.side} onChange={(id) => setMech(formatMech(line.id, { ...drive, side: id }))}
                    options={(drive.movement === 'two-in-one' ? ['right'] : Object.keys(SIDE_NAME)).map((id) => ({ id, label: SIDE_NAME[id] }))} />
                </Step>
              )}

              {!preview && motorized && (
                <div className="rm-card">
                  <SimpleRemote type={remote.type} lit={remoteLit} onPress={flashRemote} />
                  <div className="rm-card-text">
                    <strong>Included: remote</strong>
                    {usesDrive(line.id) && WORKS_NOTE[drive.control] && <p>{drive.control === 'zigbee' ? zigbeeNote(hubPrice) : WORKS_NOTE[drive.control]}</p>}
                    {remote.count >= 2 && <p className="rm-share">{SHARE_NOTE}</p>}
                  </div>
                </div>
              )}

              {(typeof tailSteps === 'function' ? tailSteps({ mech, setMech, drive, width, height, setMount }) : tailSteps).map((st) => (
                <Step key={st.title} n={++k} title={st.title} hint={st.hint}>{st.node}</Step>
              ))}

              {Object.keys(chosen).some((key) => key !== 'bottomWrap') && (
                <MoreOptions summary={extrasText({ ...chosen, bottomWrap: undefined }).join(' · ')}>
                  {chosen.chainColor && opts.isOn('chain-color', chosen.chainColor) && (
                    <div className="s2-more-group"><h3>Chain color</h3>
                      <ColorDots label="Chain color" value={chosen.chainColor} onChange={(id) => setExtras((e) => ({ ...e, chainColor: id }))} options={CHAIN_COLORS.filter((x) => opts.isOn('chain-color', x.id))} /></div>
                  )}
                  {chosen.cordColor && (
                    <div className="s2-more-group"><h3>Cord loop color</h3>
                      <ColorDots label="Cord loop color" value={chosen.cordColor} onChange={(id) => setExtras((e) => ({ ...e, cordColor: id }))} options={CORD_LOOP_COLORS.filter((x) => opts.isOn('cord-loop-color', x.id))} /></div>
                  )}
                  {chosen.barColor && (
                    <div className="s2-more-group"><h3>Bottom bar color</h3>
                      <ColorDots label="Bottom bar color" value={chosen.barColor} onChange={(id) => setExtras((e) => ({ ...e, barColor: id }))} options={BAR_COLORS.filter((x) => opts.isOn('bar-color', x.id))} /></div>
                  )}
                  {chosen.rollDir && (
                    <div className="s2-more-group"><h3>Roll direction</h3>
                      <div className="s2-cards" role="group" aria-label="Roll direction" style={{ '--min': '200px' }}>
                        {ROLL_DIRECTIONS.filter((x) => opts.isOn('roll-direction', x.id)).map((r) => (
                          <button key={r.id} type="button" className={`s2-card with-pic${chosen.rollDir === r.id ? ' on' : ''}`} aria-pressed={chosen.rollDir === r.id} onClick={() => setExtras((e) => ({ ...e, rollDir: r.id }))}>
                            <span className="s2-card-pic"><RollDiagram dir={r.id} /></span>
                            <span className="s2-card-text"><span className="s2-card-name">{r.label}</span><span className="s2-card-desc">{r.desc}</span></span>
                          </button>
                        ))}
                      </div></div>
                  )}
                </MoreOptions>
              )}

              <Step n={++k} title="Which room is this for?">
                <RoomFields choice={roomF.choice} custom={roomF.custom} windowLabel={roomF.windowLabel} onChange={setRoomF} />
              </Step>

              <EstimateCard view={view} qty={n} summary={summary} footer={footer}
                checks={[...checks, { label: 'Width and height', done: sized }]}
                qtyField={<QtyField qty={qty} onChange={setQty} />} />
              {edit && <a className="s2-link s2-cancel" href="/order" onClick={(e) => { e.preventDefault(); clearDraft(line.id, edit.id); navigate('quote'); }}>Cancel</a>}
              {tail}
            </div>
          </div>
        </div>
        <PriceBar view={view} qty={n} pick={chip || null} mode={edit ? 'save' : (canAdd && !justAdded ? 'add' : 'checkout')} onAction={handleAdd} canAct={canAdd} />
        <Footer navigate={navigate} />
      </div>
    </CatalogStatusContext.Provider>
  );
}
