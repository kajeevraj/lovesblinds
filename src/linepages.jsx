// The redesigned product pages for Zebra, Shangri-La, Roman, Cellular and Drapery (Roller is in rollerpage.jsx).
// Each one supplies its own steps and price settings; layout, size, mount, control, room, quantity and the
// estimate come from LineShell.
import { useState } from 'react';
import { getSwatch } from './data/swatchData.js';
import { CELLULAR_TYPES, ROMAN_STYLES, LINING_LABELS, PLEATS, FAMILY_LABELS, romanStyleOptions, sentence } from './lib/selection.js';
import { CELLULAR_TYPE_INFO, ROMAN_STYLE_INFO, LINING_INFO, PLEAT_INFO } from './data/optionInfo.js';
import { Cards, ColorStep, TopCoverStep } from './components/s2.jsx';
import { startFor } from './lib/drafts.js';
import { pickByRole } from './lib/lineSelection.js';
import LineShell, { PAGE, PHOTOS } from './lineshell.jsx';

const NOTE = 'Photo shows the style. Your color is shown in the swatch.';

export function ZebraPage({ line, navigate, edit = null }) {
  const [start] = useState(() => startFor(line.id, edit));
  const [pick, setPick] = useState(start?.selection?.picks?.[0] || null);
  const [wrap, setWrap] = useState(start?.selection?.cover || 'wrapped');
  const [photo, setPhoto] = useState(PHOTOS.zebra[0].name);
  const cur = PHOTOS.zebra.find((p) => p.name === photo);
  return (
    <LineShell line={line} navigate={navigate} edit={edit} start={start} title={PAGE.zebra.title} intro={PAGE.zebra.intro}
      photo={cur} gallery={PHOTOS.zebra} onGallery={setPhoto} photoNote={NOTE} chip={pick}
      c={{ pick, wrap }} colorNeeds="Pick a color" checks={[{ label: 'Color', done: !!pick }]}
      tailSteps={[{ title: 'Top cover', hint: 'The cassette is the cover over the top of the shade.', node: <TopCoverStep value={wrap} onChange={setWrap} /> }]}
      leadSteps={[{ title: 'Color', node: <ColorStep id="c-zebra" lineKey="zebra" value={pick} onChange={setPick} /> }]} />
  );
}

export function ShangriLaPage({ line, navigate, edit = null }) {
  const [start] = useState(() => startFor(line.id, edit));
  const [pick, setPick] = useState(start?.selection?.picks?.[0] || null);
  return (
    <LineShell line={line} navigate={navigate} edit={edit} start={start} title={PAGE['shangri-la'].title} intro={PAGE['shangri-la'].intro}
      photo={PHOTOS['shangri-la'][0]} photoNote="Shangri-La shades are made as horizontal shades. Your color is shown in the swatch." chip={pick}
      c={{ pick }} colorNeeds="Pick a color" checks={[{ label: 'Color', done: !!pick }]}
      leadSteps={[{ title: 'Color', node: <ColorStep id="c-shangrila" lineKey="shangri-la" value={pick} onChange={setPick} /> }]} />
  );
}

export function RomanPage({ line, navigate, edit = null }) {
  const [start] = useState(() => startFor(line.id, edit));
  const [pick, setPick] = useState(start?.selection?.picks?.[0] || null);
  const [style, setStyle] = useState(start?.selection?.style || null);
  const [lining, setLining] = useState(start?.selection?.lining || null);
  const swatch = pick ? getSwatch(pick.swatchId, pick.fabricId) : null;
  const opts = romanStyleOptions(swatch);
  const linings = style ? opts.find((o) => o.id === style)?.linings || [] : [];

  // a new color keeps the style and lining only when that fabric still offers them
  const onPick = (p) => {
    if (!p) { setPick(null); setStyle(null); setLining(null); return; }
    const o = romanStyleOptions(getSwatch(p.swatchId, p.fabricId));
    const ok = o.find((x) => x.id === style)?.available;
    const lins = o.find((x) => x.id === style)?.linings || [];
    setPick(p); if (!ok) { setStyle(null); setLining(null); } else if (!lins.includes(lining)) setLining(null);
  };
  const onStyle = (id) => {
    const lins = opts.find((o) => o.id === id)?.linings || [];
    setStyle(id); setLining(lins.includes(lining) ? lining : (lins.length === 1 ? lins[0] : null));
  };

  const leadSteps = [
    { title: 'Color', node: <ColorStep id="c-roman" lineKey="roman" value={pick} onChange={onPick} /> },
    {
      title: 'Style', hint: pick ? null : 'Pick a color first. Some styles are not available in every fabric.',
      node: <Cards label="Style" min={200} value={style} onChange={onStyle}
        options={ROMAN_STYLES.map((s) => ({ ...s, desc: ROMAN_STYLE_INFO[s.id].desc, img: ROMAN_STYLE_INFO[s.id].img }))}
        disabledIds={pick ? opts.filter((o) => !o.available).map((o) => o.id) : ROMAN_STYLES.map((s) => s.id)} />,
    },
    {
      title: 'Lining', hint: style ? null : 'Pick a style first.',
      node: <Cards label="Lining" min={200} value={lining} onChange={setLining}
        options={(style ? linings : ['blackout', 'light-filtering']).map((l) => ({ id: l, label: LINING_LABELS[l], desc: LINING_INFO[l] }))}
        disabledIds={style ? [] : ['blackout', 'light-filtering']} />,
    },
  ];
  return (
    <LineShell line={line} navigate={navigate} edit={edit} start={start} title={PAGE.roman.title} intro={PAGE.roman.intro}
      photo={PHOTOS.roman[0]} photoNote={NOTE} chip={pick}
      c={{ pick, romanStyle: style, lining }}
      colorNeeds={!pick ? 'Pick a color' : !style ? 'Pick a style' : 'Pick a lining'}
      checks={[{ label: 'Color', done: !!pick }, { label: 'Style', done: !!style }, { label: 'Lining', done: !!lining }]}
      leadSteps={leadSteps} />
  );
}

export function CellularPage({ line, navigate, edit = null }) {
  const [start] = useState(() => startFor(line.id, edit));
  const sel = start?.selection;
  const [type, setType] = useState(sel?.type || 'standard');
  const [family, setFamily] = useState((sel?.type !== 'day-night' && sel?.picks?.[0]?.family) || start?.ui?.family || 'light-filtering');
  const [pick, setPick] = useState(sel && sel.type !== 'day-night' ? sel.picks?.[0] || null : null);
  const [day, setDay] = useState(sel?.type === 'day-night' ? pickByRole(sel, 'Day') : null);
  const [night, setNight] = useState(sel?.type === 'day-night' ? pickByRole(sel, 'Night') : null);
  const dn = type === 'day-night';
  const photo = PHOTOS.cellular[type === 'top-down-bottom-up' ? 1 : 0];

  const leadSteps = [
    {
      title: 'Product type',
      node: (
        <>
          <Cards label="Product type" min={200} value={type} onChange={(t) => { setType(t); setPick(null); setDay(null); setNight(null); }}
            options={CELLULAR_TYPES.map((t) => ({ ...t, desc: CELLULAR_TYPE_INFO[t.id].desc, img: CELLULAR_TYPE_INFO[t.id].img }))} />
          {dn && <p className="s2-step-hint s2-need">Day &amp; Night needs two colors: a light-filtering color for day and a blackout color for night. Your price appears once both are chosen.</p>}
        </>
      ),
    },
    ...(dn
      ? [
        { title: 'Day color (light-filtering)', node: <ColorStep key="day" id="c-day" lineKey="cellular" family="light-filtering" role="Day (light-filtering)" value={day} onChange={setDay} /> },
        { title: 'Night color (blackout)', node: <ColorStep key="night" id="c-night" lineKey="cellular" family="blackout" role="Night (blackout)" value={night} onChange={setNight} /> },
      ]
      : [{
        title: 'Light filtering or blackout, and color',
        node: (
          <>
            <Cards label="Light filtering or blackout" min={200} value={family} onChange={(f) => { setFamily(f); setPick(null); }}
              options={line.families.map((f) => ({ id: f, label: FAMILY_LABELS[f] }))} />
            <ColorStep key={family} id="c-cellular" lineKey="cellular" family={family} value={pick} onChange={setPick} />
          </>
        ),
      }]),
  ];
  return (
    <LineShell line={line} navigate={navigate} edit={edit} start={start} ui={{ family }} title={PAGE.cellular.title} intro={PAGE.cellular.intro}
      photo={photo} photoNote={NOTE} chip={dn ? night || day : pick}
      c={{ type, pick, day, night }}
      colorNeeds={dn ? 'Pick a day and a night color' : 'Pick a color'}
      checks={dn ? [{ label: 'Day color', done: !!day }, { label: 'Night color', done: !!night }] : [{ label: 'Color', done: !!pick }]}
      leadSteps={leadSteps} />
  );
}

export function DraperyPage({ line, navigate, edit = null }) {
  const [start] = useState(() => startFor(line.id, edit));
  const sel = start?.selection;
  const [section, setSection] = useState(sel?.section || 'curtains');
  const [pick, setPick] = useState(sel?.section === 'curtains' ? sel.picks?.[0] || null : null);
  const [pleat, setPleat] = useState(sel?.pleat || null);
  const [lining, setLining] = useState(sel?.lining || null);
  const [dream, setDream] = useState(sel?.section === 'dream-curtains' ? sel.picks?.[0] || null : null);
  const curtains = section === 'curtains';

  const leadSteps = curtains
    ? [
      { title: 'Color', node: <ColorStep id="c-curtains" lineKey="drapery" value={pick} onChange={setPick} /> },
      {
        title: 'Pleat style', hint: 'Availability is confirmed with your price.',
        node: <Cards label="Pleat style" min={200} value={pleat} onChange={setPleat}
          options={PLEATS.map((p) => ({ id: p, label: sentence(p), desc: PLEAT_INFO[p].desc, img: PLEAT_INFO[p].img }))} />,
      },
      {
        title: 'Lining',
        node: <Cards label="Lining" min={200} value={lining} onChange={setLining}
          options={['blackout', 'light-filtering', 'none'].map((l) => ({ id: l, label: LINING_LABELS[l], desc: LINING_INFO[l] }))} />,
      },
    ]
    : [{ title: 'Color and style', node: <ColorStep id="c-dream" lineKey="dream-curtains" value={dream} onChange={setDream} /> }];

  const tabs = (
    <div className="s2-tabs" role="tablist" aria-label="Drapery type">
      {line.sections.map((s) => (
        <button key={s.id} type="button" role="tab" className="s2-tab" aria-selected={section === s.id} onClick={() => setSection(s.id)}>{s.name}</button>
      ))}
    </div>
  );
  return (
    <LineShell line={line} navigate={navigate} edit={edit} start={start} title={PAGE.drapery.title}
      intro={curtains ? 'Custom curtains in pleat styles from French pleat to ripple fold. Made to your exact size.' : 'Every vane hangs on its own, so you can walk through anywhere, with no opening or closing needed. Great for patio and balcony doors.'}
      header={tabs}
      photo={PHOTOS[section][0]} photoNote={NOTE} chip={curtains ? pick : dream} hideMount controlTitle="How it opens and closes"
      c={{ section, pick, pleat, lining, dream }}
      colorNeeds={curtains ? (!pick ? 'Pick a color' : !pleat ? 'Pick a pleat style' : 'Pick a lining') : 'Pick a color and style'}
      checks={curtains ? [{ label: 'Color', done: !!pick }, { label: 'Pleat style', done: !!pleat }, { label: 'Lining', done: !!lining }] : [{ label: 'Color and style', done: !!dream }]}
      leadSteps={leadSteps} />
  );
}
