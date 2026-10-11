// Specs shown on the site's larger view. Blank = not shown. Used by the collection page and the "new collection" box.
const Field = ({ label, k, v, set, hint }) => (
  <label className="adm-field"><span>{label}</span>
    <input value={v[k]} onChange={(e) => set({ [k]: e.target.value })} placeholder={hint} />
  </label>
);

export default function CollectionFields({ value: v, onChange: set, line, family }) {
  const roller = line === 'roller';
  return (
    <div className="adm-grid2">
      <Field label="Width" k="width" v={v} set={set} hint="e.g. 118 in" />
      <Field label="Composition" k="composition" v={v} set={set} hint="e.g. 100% Polyester" />
      <Field label="Weight" k="weight" v={v} set={set} hint="e.g. 198 g/m² ±5%" />
      <Field label="Thickness" k="thickness" v={v} set={set} hint="e.g. 0.45 mm (±5%)" />
      {(roller && family === 'screen-view') && <Field label="Openness" k="openness" v={v} set={set} hint="e.g. 3%" />}
      {(line === 'zebra' || line === 'shangri-la' || (roller && family !== 'screen-view')) && <Field label="Opacity" k="opacity" v={v} set={set} hint="e.g. Blackout" />}
      <Field label="Use area" k="use_area" v={v} set={set} hint="Indoor, or Indoor & outdoor" />
      {line === 'shangri-la' && <Field label="Vane size" k="vaneSize" v={v} set={set} hint="e.g. 3 in" />}
      {line === 'dream-curtains' && <>
        <Field label="Care" k="care" v={v} set={set} hint="e.g. Machine washable" />
        <Field label="Weight, Style A" k="weightStyleA" v={v} set={set} />
        <Field label="Weight, Style B" k="weightStyleB" v={v} set={set} />
      </>}
    </div>
  );
}
