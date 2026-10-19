import { useState } from 'react';
import { FAMILY_LABELS } from './lib/selection.js';
import { ROLLER_MODE_INFO, ROLLER_FAMILY_INFO, ROLLER_FAMILY_CARD, ROLLER_PRIVACY_NOTE } from './data/optionInfo.js';
import { Cards, ColorStep, TopCoverStep } from './components/s2.jsx';
import LineShell, { PAGE } from './lineshell.jsx';

const FAMILY_ORDER = ['solar', 'screen-view', 'blackout'];

// Fabric type buttons, the explanation under them, and (for Solar and Screen View) the privacy note.
function FabricType({ value, onChange, label }) {
  return (
    <div>
      <Cards label={label} min={160} value={value} onChange={onChange}
        options={FAMILY_ORDER.map((f) => ({ id: f, label: FAMILY_LABELS[f], desc: ROLLER_FAMILY_CARD[f].tag }))} />
      <div className="s2-note-box">
        <div className="s2-note-title">{FAMILY_LABELS[value]}</div>
        <p>{ROLLER_FAMILY_INFO[value]}</p>
        {value !== 'blackout' && <p className="s2-note-privacy">{ROLLER_PRIVACY_NOTE}</p>}
      </div>
    </div>
  );
}

export default function RollerPage({ line, navigate, addToQuote }) {
  const [mode, setMode] = useState('single');
  const [front, setFront] = useState({ family: 'solar', pick: null });
  const [back, setBack] = useState({ family: 'solar', pick: null });
  const [wrap, setWrap] = useState('wrapped');
  const double = mode === 'double-stack';
  const c = { mode, front: front.pick, back: back.pick, wrap };

  const shadeBlock = (st, setSt, role) => (
    <>
      <FabricType label={role ? `${role} fabric type` : 'Fabric type'} value={st.family} onChange={(f) => setSt({ family: f, pick: null })} />
      <ColorStep key={`${role}-${st.family}`} id={`c-${role || 'single'}`} lineKey="roller" family={st.family} role={role}
        value={st.pick} onChange={(pick) => setSt({ ...st, pick })} />
    </>
  );

  const leadSteps = [
    {
      title: 'One shade or two',
      node: (
        <>
          <Cards label="Single or double-stack" value={mode} onChange={(m) => { setMode(m); setFront((s) => ({ ...s, pick: null })); setBack((s) => ({ ...s, pick: null })); }}
            options={line.modes.map((m) => ({ id: m, label: m === 'single' ? 'Single' : 'Double-stack', desc: ROLLER_MODE_INFO[m].desc, img: ROLLER_MODE_INFO[m].img }))} />
          {double && <p className="s2-step-hint s2-need">Double-stack needs two colors, one for the front shade and one for the back. Your price appears once both are chosen.</p>}
        </>
      ),
    },
    ...(double
      ? [
        { title: 'Front shade: fabric type and color', node: shadeBlock(front, setFront, 'Front shade') },
        { title: 'Back shade: fabric type and color', node: shadeBlock(back, setBack, 'Back shade') },
      ]
      : [{ title: 'Fabric type and color', hint: 'Pick a fabric type, then your color.', node: shadeBlock(front, setFront, null) }]),
  ];

  const tailSteps = [{
    title: 'Top cover',
    node: <TopCoverStep value={wrap} onChange={setWrap} />,
  }];

  return (
    <LineShell line={line} navigate={navigate} addToQuote={addToQuote} title={PAGE.roller.title} intro={PAGE.roller.intro}
      photo={{ name: ROLLER_FAMILY_CARD[front.family].photo, alt: ROLLER_FAMILY_CARD[front.family].alt }}
      photoNote={`Photo shows ${FAMILY_LABELS[front.family]} fabric. Your color is shown in the swatch.`}
      chip={front.pick}
      leadSteps={leadSteps} tailSteps={tailSteps} c={c}
      colorNeeds={double ? 'Pick a front and a back color' : 'Pick a color'}
      checks={double
        ? [{ label: 'Front shade color', done: !!front.pick }, { label: 'Back shade color', done: !!back.pick }]
        : [{ label: 'Color', done: !!front.pick }]} />
  );
}
