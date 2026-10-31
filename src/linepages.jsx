// The redesigned product pages for Zebra, Shangri-La, Roman, Cellular and Drapery (Roller is in rollerpage.jsx).
// Each one supplies its own steps and price settings; layout, size, mount, control, room, quantity and the
// estimate come from LineShell.
import { useState } from 'react';
import { getSwatch } from './data/swatchData.js';
import { CELLULAR_TYPES, ROMAN_STYLES, LINING_LABELS, FAMILY_LABELS, romanStyleOptions } from './lib/selection.js';
import { CELLULAR_TYPE_INFO, ROMAN_STYLE_INFO, LINING_INFO } from './data/optionInfo.js';
import { Cards, ColorStep, TopCoverStep } from './components/s2.jsx';
import { startFor } from './lib/drafts.js';
import { pickByRole } from './lib/lineSelection.js';
import LineShell, { PAGE, PHOTOS } from './lineshell.jsx';

const NOTE = 'Photo shows the style. Your color is shown in the swatch.';

export function ZebraPage({ line, navigate, edit = null }) {
  const [start] = useState(() => startFor(line.id, edit));
  const [pick, setPick] = useState(start?.selection?.picks?.[0] || null);
  const [wrap, setWrap] = useState(start?.selection?.cover || 'wrapped');
  return (
    <LineShell line={line} navigate={navigate} edit={edit} start={start} title={PAGE.zebra.title} intro={PAGE.zebra.intro}
      photos={PHOTOS.zebra} photoNote={NOTE} chip={pick}
      preview={{ kind: 'zebra', picks: [pick], cover: wrap }}
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
      photos={PHOTOS['shangri-la']} photoNote="Shangri-La shades are made as horizontal shades. Your color is shown in the swatch." chip={pick}
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
      photos={PHOTOS.roman} photoNote={NOTE} chip={pick}
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
  const photos = type === 'top-down-bottom-up' ? [PHOTOS.cellular[1], PHOTOS.cellular[0]] : PHOTOS.cellular;       // the photo that matches the style comes first

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
      photos={photos} photoNote={NOTE} chip={dn ? night || day : pick}
      c={{ type, pick, day, night }}
      colorNeeds={dn ? 'Pick a day and a night color' : 'Pick a color'}
      checks={dn ? [{ label: 'Day color', done: !!day }, { label: 'Night color', done: !!night }] : [{ label: 'Color', done: !!pick }]}
      leadSteps={leadSteps} />
  );
}

export { DraperyPage } from './drapery.jsx';
