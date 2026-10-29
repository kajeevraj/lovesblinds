// The Drapery page: Curtains (style, fullness, return, liner, panels, and the optional "Add a track or rod") and Dream Curtains
// (install, inside or outside, stack, and the control). Layout, size, room, quantity and the estimate come from LineShell.
import { useEffect, useState } from 'react';
import { LINING_INFO } from './data/optionInfo.js';
import { Cards, ColorStep, ColorDots } from './components/s2.jsx';
import { startFor } from './lib/drafts.js';
import { useLineOptions } from './lib/lineOptions.js';
import { useHardwareState } from './lib/estimate.js';
import {
  CURTAIN_STYLES, RETURNS, LINERS, PANELS, TRACKS, MOUNTS_HW, LAYERS, OPENINGS, OVERLAPS, HW_POWER, FINIALS, MEASURE_HELP, motorizedWhy,
  DREAM_INSTALLS, DREAM_FITS, DREAM_STACKS, pullRodOk, colorsOf, isDecorative, styleById, styleIdFromSaved, tracksFor, trackById, cleanHardware, hardwareRequest, fullnessLabel,
} from './lib/hardware.js';
import { MOVEMENT_NAME } from './lib/drive.js';
import { CONTROL_COPY } from './data/optionInfo.js';
import LineShell, { PAGE, PHOTOS } from './lineshell.jsx';

const NOTE = 'Photo shows the style. Your color is shown in the swatch.';
// pictures that already exist for some styles (see public/explainers/drapery-pleats)
const STYLE_IMG = {
  'pinch-pleat': 'drapery-pleats/pinch-pleat-1', goblet: 'drapery-pleats/goblet', 'inverted-pleat': 'drapery-pleats/inverted-pleat',
  'euro-pleat-2': 'drapery-pleats/euro-pleat-2', 'french-pleat-2': 'drapery-pleats/french-pleat-2', 'euro-pleat-3': 'drapery-pleats/euro-pleat-3',
  'french-pleat-3': 'drapery-pleats/french-pleat-3', 'ripple-hook': 'drapery-pleats/ripple-fold', 'ripple-button': 'drapery-pleats/ripple-fold',
};
const STYLE_DESC = {
  grommet: 'Metal rings along the top, slid straight onto a rod.', 'pinch-pleat': 'A pinched pleat at the top of each fold.', goblet: 'Cup-shaped pleats at the top, like a goblet.',
  'inverted-pleat': 'Folds turned inward for a clean, flat front.', 'euro-pleat-2': 'A tailored pleat with two fingers, sewn in at the top.', 'french-pleat-2': 'A gathered pleat with two fingers at the top.',
  'korean-pleat-2': 'A softly folded pleat with two fingers.', 'out-invert-pleat': 'Folds turned outward for a rounded front.', 'euro-pleat-3': 'A tailored pleat with three fingers.',
  'french-pleat-3': 'A gathered pleat with three fingers.', 'korean-pleat-3': 'A softly folded pleat with three fingers.', 'ripple-hook': 'Continuous, even waves, hung on hooks.',
  'ripple-button': 'Continuous, even waves, fastened with buttons.', 'rod-pocket': 'A sewn pocket at the top that slides over a rod.',
};

// ---- The optional track or rod -----------------------------------------------------------------------------------------
function HardwareStep({ styleId, hw, setHw, add, setAdd, width, opts }) {
  const style = styleById(styleId);
  const tracks = tracksFor(styleId).filter((t) => opts.isOn('hw-track', t.id));
  const motorBlocked = !!style && !tracksFor(styleId).some((t) => t.motorized);
  const track = trackById(hw.track);
  const clean = cleanHardware(hw, styleId);
  const req = clean ? hardwareRequest(clean, styleId, width) : null;
  const priced = useHardwareState(req);
  const set = (patch) => setHw((h) => ({ ...h, ...patch }));
  // a track that no longer fits the style (the customer changed the style) is dropped
  useEffect(() => { if (hw.track && !tracksFor(styleId).some((t) => t.id === hw.track)) set({ track: null }); }, [styleId]); // eslint-disable-line react-hooks/exhaustive-deps
  const colors = track ? colorsOf(track.id) : [];
  return (
    <div className="s2-hw">
      <Cards label="Add a track or rod" min={220} value={add ? 'add' : 'own'} onChange={(id) => setAdd(id === 'add')}
        options={[
          { id: 'own', label: 'I have my own', desc: 'No track or rod from us.' },
          ...(opts.isOn('hardware', 'add') ? [{ id: 'add', label: 'Add a track or rod', desc: 'We send one made to your curtain width.' }] : []),
        ]} />
      {add && (
        <div className="s2-hw-body">
          {!style && <p className="s2-step-hint s2-need">Pick a curtain style first, so we show only the tracks that fit it.</p>}
          {style && (
            <>
              <h3 className="s2-sub">Layers</h3>
              <Cards label="Layers" min={200} value={hw.layers || 'single'} onChange={(id) => set({ layers: id })} options={LAYERS.filter((l) => opts.isOn('hw-layers', l.id))} />
              <h3 className="s2-sub">Track or rod</h3>
              <Cards label="Track or rod" min={200} value={hw.track || null} onChange={(id) => set({ track: id, color: undefined, finial: undefined })}
                options={tracks.map((t) => ({ id: t.id, label: t.label, desc: t.note }))} />
              {motorBlocked && <p className="s2-step-hint">{motorizedWhy} The motorized rail is not shown for this style.</p>}
              {track && (
                <>
                  <h3 className="s2-sub">{isDecorative(track.id) ? 'Metal finish' : 'Color'}</h3>
                  <ColorDots label="Track color" value={clean?.color} onChange={(id) => set({ color: id })}
                    options={colors.filter((c) => opts.isOn('hw-finish', c.id) || !isDecorative(track.id))} />
                  {isDecorative(track.id) && (
                    <>
                      <h3 className="s2-sub"><label htmlFor="s2-finial">Finial</label></h3>
                      <select id="s2-finial" className="s2-input s2-select" value={clean?.finial || 'classic'} onChange={(e) => set({ finial: e.target.value })}>
                        {FINIALS.filter((f) => opts.isOn('hw-finial', f.id)).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                    </>
                  )}
                  <h3 className="s2-sub">Mount</h3>
                  <Cards label="Track mount" min={200} value={clean?.mount} onChange={(id) => set({ mount: id })} options={MOUNTS_HW.filter((m) => opts.isOn('hw-mount', m.id))} />
                  <h3 className="s2-sub">Should the fabric cover the track?</h3>
                  <Cards label="Fabric covers the track" min={140} value={clean?.coversTrack ? 'yes' : 'no'} onChange={(id) => set({ coversTrack: id === 'yes' })}
                    options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
                  {track.motorized && (
                    <>
                      <h3 className="s2-sub">Motor power</h3>
                      <Cards label="Motor power" min={160} value={clean?.power} onChange={(id) => set({ power: id })} options={HW_POWER.filter((p) => opts.isOn('hw-power', p.id))} />
                      <h3 className="s2-sub">How it opens</h3>
                      <Cards label="Opening" min={200} value={clean?.opening} onChange={(id) => set({ opening: id })} options={OPENINGS.filter((o) => opts.isOn('hw-opening', o.id))} />
                      {clean?.opening === 'center' && (
                        <>
                          <h3 className="s2-sub">Overlap in the center</h3>
                          <Cards label="Center overlap" min={160} value={clean?.overlap} onChange={(id) => set({ overlap: id })} options={OVERLAPS.filter((o) => opts.isOn('hw-overlap', o.id))} />
                        </>
                      )}
                    </>
                  )}
                </>
              )}
              {clean && (
                <p className="s2-hw-price" role="status">
                  {!(parseFloat(width) > 0) ? 'Enter your width to see the track price.'
                    : priced.loading ? 'Working out the track price…'
                      : priced.result?.price != null ? <>Track or rod estimate: <strong>${priced.result.price.toLocaleString('en-US')}</strong> (shipping included). The curtain fabric is priced by email.</>
                        : 'We will email the price for the track or rod.'}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Dream Curtains steps -----------------------------------------------------------------------------------------------
function DreamControl({ api, dreamOpts, setDreamOpts, opts }) {
  const mv = api.drive.movement;
  const stack = dreamOpts.stack;
  const list = ['manual', 'motorized', 'pull-rod'].filter((id) => opts.isOn('control', id));
  return (
    <>
      <Cards label="Control" min={200} value={mv} onChange={(id) => api.setMech(id)}
        options={list.map((id) => ({ id, label: MOVEMENT_NAME[id] || (id === 'manual' ? 'Manual' : 'Pull rod'), desc: id === 'motorized' ? 'Open and close with a remote.' : CONTROL_COPY[id] || 'Slide the panels by hand along the track.', badge: [opts.best === id && 'Best value', opts.top === id && 'Top of the line'].filter(Boolean) }))}
        disabledIds={pullRodOk(stack) ? [] : ['pull-rod']} />
      {!pullRodOk(stack) && <p className="s2-step-hint">A pull rod works with a left or right stack only.</p>}
    </>
  );
}

export function DraperyPage({ line, navigate, edit = null }) {
  const [start] = useState(() => startFor(line.id, edit));
  const sel = start?.selection;
  const opts = useLineOptions(line.id);
  const [section, setSection] = useState(sel?.section || 'curtains');
  const [pick, setPick] = useState(sel?.section === 'curtains' ? sel.picks?.[0] || null : null);
  const [styleId, setStyleId] = useState(() => styleIdFromSaved(sel?.pleat));
  const [fullness, setFullness] = useState(sel?.fullness || null);
  const [returnTo, setReturnTo] = useState(sel?.returnTo || 'pleat');
  const [lining, setLining] = useState(sel?.lining || null);
  const [panels, setPanels] = useState(sel?.panels || null);
  const [add, setAdd] = useState(!!sel?.hardware);
  const [hw, setHw] = useState(() => sel?.hardware || { layers: 'single', mount: 'ceiling', coversTrack: false });
  const [dream, setDream] = useState(sel?.section === 'dream-curtains' ? sel.picks?.[0] || null : null);
  const [dreamOpts, setDreamOpts] = useState(() => sel?.dreamOpts || { install: null, fit: null, stack: null });
  const curtains = section === 'curtains';
  const style = styleById(styleId);

  const onStyle = (id) => {
    const st = styleById(id);
    setStyleId(id);
    if (!st.fullness.includes(fullness)) setFullness(st.fullness.length === 1 ? st.fullness[0] : null);
  };

  const leadSteps = curtains
    ? [
      { title: 'Color', node: <ColorStep id="c-curtains" lineKey="drapery" value={pick} onChange={setPick} /> },
      {
        title: 'Style', hint: 'The curtain fabric is priced by email.',
        node: <Cards label="Curtain style" min={200} value={styleId} onChange={onStyle}
          options={CURTAIN_STYLES.filter((st) => opts.isOn('curtain-style', st.id)).map((st) => ({ id: st.id, label: st.label, desc: STYLE_DESC[st.id], img: STYLE_IMG[st.id] }))} />,
      },
      {
        title: 'Fullness', hint: style ? 'How much fabric goes into each curtain.' : 'Pick a style first.',
        node: <Cards label="Fullness" min={140} value={fullness} onChange={setFullness}
          options={(style ? style.fullness : []).map((f) => ({ id: f, label: `${fullnessLabel(f)}` }))} />,
      },
      { title: 'Return', node: <Cards label="Return" min={200} value={returnTo} onChange={setReturnTo} options={RETURNS.filter((r) => opts.isOn('return', r.id))} /> },
      { title: 'Liner', node: <Cards label="Liner" min={200} value={lining} onChange={setLining} options={LINERS.map((l) => ({ id: l.id, label: l.label, desc: LINING_INFO[l.id] }))} /> },
      { title: 'Panels', node: <Cards label="Panels" min={200} value={panels} onChange={setPanels} options={PANELS.filter((p) => opts.isOn('panels', p.id))} /> },
    ]
    : [{ title: 'Color and style', node: <ColorStep id="c-dream" lineKey="dream-curtains" value={dream} onChange={setDream} /> }];

  const tailSteps = (api) => (curtains
    ? [{ title: 'Add a track or rod', hint: 'Optional. Choose "I have my own" if you already have one.', node: <HardwareStep styleId={styleId} hw={hw} setHw={setHw} add={add} setAdd={setAdd} width={api.width} opts={opts} /> }]
    : [
      {
        title: 'Mount', hint: 'Pick the install, then inside or outside.',
        node: (
          <>
            <Cards label="Install" min={200} value={dreamOpts.install} onChange={(id) => setDreamOpts((d) => ({ ...d, install: id }))} options={DREAM_INSTALLS.filter((x) => opts.isOn('dream-install', x.id))} />
            <Cards label="Inside or outside" min={160} value={dreamOpts.fit} onChange={(id) => { setDreamOpts((d) => ({ ...d, fit: id })); api.setMount(id); }} options={DREAM_FITS.filter((x) => opts.isOn('dream-fit', x.id))} />
          </>
        ),
      },
      {
        title: 'Stack', hint: 'Where the panels gather when the curtain is open.',
        node: <Cards label="Stack" min={200} value={dreamOpts.stack} onChange={(id) => { setDreamOpts((d) => ({ ...d, stack: id })); if (!pullRodOk(id) && api.drive.movement === 'pull-rod') api.setMech('manual'); }}
          options={DREAM_STACKS.filter((x) => opts.isOn('dream-stack', x.id))} />,
      },
      { title: 'How it opens and closes', node: <DreamControl api={api} dreamOpts={dreamOpts} setDreamOpts={setDreamOpts} opts={opts} /> },
    ]);

  const tabs = (
    <div className="s2-tabs" role="tablist" aria-label="Drapery type">
      {line.sections.map((s) => (
        <button key={s.id} type="button" role="tab" className="s2-tab" aria-selected={section === s.id} onClick={() => setSection(s.id)}>{s.name}</button>
      ))}
    </div>
  );
  const hardware = curtains && add ? hw : null;
  const hardwareIncomplete = curtains && add && !cleanHardware(hw, styleId);
  const missingText = curtains
    ? (!pick ? 'Pick a color' : !style ? 'Pick a style' : !fullness ? 'Pick a fullness' : !lining ? 'Pick a liner' : !panels ? 'Pick single or pair' : 'Pick a track or rod, or choose "I have my own"')
    : (!dream ? 'Pick a color and style' : !dreamOpts.install ? 'Pick an install' : !dreamOpts.fit ? 'Pick inside or outside' : 'Pick a stack');
  return (
    <LineShell line={line} navigate={navigate} edit={edit} start={start} title={PAGE.drapery.title}
      intro={curtains ? 'Custom curtains in pleat styles from French pleat to ripple fold. Made to your exact size.' : 'Every vane hangs on its own, so you can walk through anywhere, with no opening or closing needed. Great for patio and balcony doors.'}
      header={tabs}
      photos={PHOTOS[section]} photoNote={NOTE} chip={curtains ? pick : dream} hideMount hideControl sizeHint={curtains ? MEASURE_HELP : null}
      mechList={curtains ? line.mechanisms.filter((m) => m.id === 'manual') : line.mechanisms}
      c={{ section, pick, styleId, fullness, returnTo, lining, panels, hardware, hardwareIncomplete, dream, dreamOpts }}
      colorNeeds={missingText}
      checks={curtains
        ? [{ label: 'Color', done: !!pick }, { label: 'Style', done: !!style }, { label: 'Fullness', done: !!fullness }, { label: 'Liner', done: !!lining }, { label: 'Panels', done: !!panels }]
        : [{ label: 'Color and style', done: !!dream }, { label: 'Install', done: !!(dreamOpts.install && dreamOpts.fit) }, { label: 'Stack', done: !!dreamOpts.stack }]}
      leadSteps={leadSteps} tailSteps={tailSteps} />
  );
}
