// The shared layout of every redesigned product page: sticky photo on the left, numbered steps on the right,
// then size, mount, control, room, quantity, the estimate and the sticky price bar.
// A line page supplies its own steps (fabric, color, style ...) and its price configuration; everything else is here.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MOUNTS, getMechanism } from './data/lines.js';
import { CONTROL_COPY, CONTROL_IMG, MOUNT_INFO } from './data/optionInfo.js';
import { priceRequest, usePriceState } from './lib/estimate.js';
import { buildSelection } from './lib/lineSelection.js';
import { formatInches } from './lib/inches.js';
import { summarize } from './lib/selection.js';
import { CatalogStatusContext, useLineCatalog } from './lib/useCatalog.js';
import { Step, Cards, MOUNT_PICTURES, EstimateCard, QtyField, priceView } from './components/s2.jsx';
import SizeFields, { EMPTY_SIZE, sizeNumbers } from './components/SizeFields.jsx';
import RoomFields, { splitRoom, roomLabelOf } from './components/RoomFields.jsx';
import { blinds } from './lib/itemView.js';
import { saveDraft, clearDraft, hasProgress } from './lib/drafts.js';
import { PriceBar } from './components/OrderBar.jsx';
import { useCart, BuildAnotherContext } from './lib/cart.js';
import { useContext } from 'react';
import { useSizeLimits, limitLineFor } from './lib/sizeLimits.js';
import { checkSize, clampQty, TYPO_TEXT } from './lib/limits.js';
import SitePhoto from './components/SitePhoto.jsx';
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
  line, navigate, edit = null, start = null, ui = null, title, intro, photo, photoNote, gallery, onGallery, chip,
  leadSteps, c, colorNeeds, checks, tailSteps = [], tail, controlTitle = 'How you raise and lower it', hideMount = false, header = null, preview = null,
}) {
  const catalog = useLineCatalog(line.id);
  const cart = useCart();
  // every choice starts as it was saved: the draft from earlier on this page, else the item being edited
  const [mech, setMech] = useState(start?.mech || edit?.mech || line.mechanisms[0].id);
  const [mount, setMount] = useState(start?.mount || edit?.mount || line.mounts[0]);
  const [size, setSize] = useState(start ? { w: start.w, h: start.h } : EMPTY_SIZE);
  const [roomF, setRoomF] = useState(() => ({ ...splitRoom(start?.roomLabel), windowLabel: start?.windowLabel || '' }));
  const room = roomLabelOf(roomF.choice, roomF.custom);
  const [qty, setQty] = useState(String(start?.qty || edit?.qty || 1));
  const [addedAt, setAddedAt] = useState(null);       // { key, merged, qty } for the choices that were just added
  const buildAnother = useContext(BuildAnotherContext);
  // the left column: the live 3D preview (for lines that have a model) or the style photo; on a phone it docks under the top as you scroll
  const [leftView, setLeftView] = useState('3d');
  const phone = usePhoneMedia('(max-width: 959px)');
  const [dock, setDock] = useState({ collapsed: false });
  const leftRef = useRef(null);
  // (the strip keeps one size and never moves by itself, so nothing on the page jumps under a finger; it has a button to fold it away)

  const n = clampQty(qty);
  const { width, height } = sizeNumbers(size);
  const sized = parseFloat(width) > 0 && parseFloat(height) > 0;
  // the smallest we can make (from the database): below it nothing is priced and nothing can be added; above the largest the
  // price function itself answers "larger than our standard range"; a size that looks like a typo only gets a warning
  const limits = useSizeLimits(limitLineFor(line.id, c.section), mech);
  const chk = checkSize(limits, width, height);
  const tooSmall = chk.tooSmall.length > 0;
  const req = tooSmall ? null : priceRequest(line, c, mech, width, height);
  const priced = priceView(req, usePriceState(req));
  const view = tooSmall ? { kind: 'toosmall', text: chk.tooSmall.map((t) => t.text).join(' ') } : priced;
  const { selection, missing } = buildSelection(line, c);
  const optionsReady = missing.length === 0;
  const canAdd = optionsReady && sized && !tooSmall && view.kind !== 'loading' && view.kind !== 'waiting';
  const needs = !optionsReady ? colorNeeds : tooSmall ? chk.tooSmall.map((t) => t.text).join(' ') : !sized ? 'Enter your size' : 'Calculating…';

  const mechObj = getMechanism(line, mech);
  const mountObj = MOUNTS.find((m) => m.id === mount);

  // What is chosen is saved in this browser as it changes, so the back button or a refresh never loses it. Right after the item
  // is added the same choices are not a draft any more (no "incomplete" copy of what is already in the cart).
  const addedSig = useRef(null);
  const draftSig = JSON.stringify([selection, mech, mount, size.w, size.h, room, roomF.windowLabel]);
  const uiSig = JSON.stringify(ui || {});
  const origSig = edit ? JSON.stringify([edit.selection ?? null, edit.mech, edit.mount, formatInches(edit.width), formatInches(edit.length), edit.roomLabel || '', edit.windowLabel || '']) : null;
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
    mechObj?.name,
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
            <div className={`s2-line-photo${preview ? ' has-preview' : ''}${preview && dock.collapsed ? ' collapsed' : ''}`} ref={leftRef}>
              {preview && (
                <div className="pv-tabs" role="tablist" aria-label="Preview">
                  <button type="button" role="tab" aria-selected={leftView === '3d'} className={leftView === '3d' ? 'on' : ''} onClick={() => setLeftView('3d')}>Your blind</button>
                  <button type="button" role="tab" aria-selected={leftView === 'photo'} className={leftView === 'photo' ? 'on' : ''} onClick={() => setLeftView('photo')}>Style photo</button>
                  {phone && (
                    <button type="button" className="pv-collapse" aria-expanded={!dock.collapsed} onClick={() => setDock((d) => ({ ...d, collapsed: !d.collapsed }))}>{dock.collapsed ? 'Show preview' : 'Hide preview'}</button>
                  )}
                </div>
              )}
              {(() => {
                const photoNode = (
                  <>
                    <div className="s2-photo-frame">
                      <SitePhoto key={photo.name} name={photo.name} alt={photo.alt} sizes="(min-width: 960px) 45vw, 92vw" eager />
                      {chip && (
                        <span className="s2-photo-chip">
                          <img src={chip.thumb} alt="" width="36" height="36" />
                          {chip.displayName} ({chip.code})
                        </span>
                      )}
                    </div>
                  </>
                );
                return preview && leftView === '3d' ? (
                  <div className="pv-wrap">
                    <Suspense fallback={<div className="pv"><div className="pv-stage">{photoNode}</div></div>}>
                      <PreviewPane kind={preview.kind} picks={preview.picks} double={!!preview.double} width={parseFloat(width) || null} height={parseFloat(height) || null}
                        mount={mount} mech={mech} cover={preview.cover} phone={phone} fallback={photoNode} />
                    </Suspense>
                  </div>
                ) : photoNode;
              })()}
              {gallery && gallery.length > 1 && (
                <div className="s2-gallery" role="group" aria-label="More photos">
                  {gallery.map((g) => (
                    <button key={g.name} type="button" className={g.name === photo.name ? 'on' : ''} aria-pressed={g.name === photo.name} aria-label={g.alt} onClick={() => { onGallery(g.name); setLeftView('photo'); }}>
                      <SitePhoto name={g.name} alt="" sizes="88px" />
                    </button>
                  ))}
                </div>
              )}
              {(!preview || leftView === 'photo') && <div className="s2-photo-note"><span aria-hidden="true">ⓘ</span> {photoNote || 'Photo shows the style. Your color is shown in the swatch.'}</div>}
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

              <Step n={++k} title="Size" hint={<>Not sure? <a href="/measure" onClick={(e) => { e.preventDefault(); navigate('measure'); }}>See how to measure</a>.</>}>
                <SizeFields size={size} onChange={setSize} />
                {tooSmall && <p className="s2-size-msg is-error" role="alert">{chk.tooSmall.map((t) => <span key={t.dim}>{t.text} </span>)}Please enter a larger size.</p>}
                {chk.typo && <p className="s2-size-msg is-warn" role="status">{TYPO_TEXT}</p>}
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
