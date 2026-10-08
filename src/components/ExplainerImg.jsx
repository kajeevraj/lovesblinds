import { useState } from 'react';
import EXPLAINERS from '../data/explainers.json';

// A picture from public/explainers/ by key (for example "control/roller-chain"). Raster files get a WebP
// copy from the build; svg files are used as-is. Renders nothing when the key has no file.
export function ExplainerImg({ name, alt = "", className = "", eager = false }) {
  const [failed, setFailed] = useState(false);
  const e = EXPLAINERS[name];
  if (!e || failed) return null;
  const dims = e.width && e.height ? { width: e.width, height: e.height } : {};
  const img = <img className={`explainer-img ${className}`} src={e.src} alt={alt} {...dims} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />;
  return e.webp ? <picture><source type="image/webp" srcSet={e.webp} />{img}</picture> : img;
}

export const hasExplainer = (name) => !!EXPLAINERS[name];

// A group of option cards: a picture (when one exists), the name, and a one-line plain explanation.
export function OptionCards({ label, options, value, onChange, disabledIds = [], note, step }) {
  const heading = `${step ? `${step} · ` : ""}${label}`;
  return (
    <div className="config-group">
      <div className="label" id={`oc-${label.replace(/\W+/g, "-")}`}>{heading}</div>
      <div className="option-cards" role="group" aria-labelledby={`oc-${label.replace(/\W+/g, "-")}`}>
        {options.map(o => {
          const selected = value === o.id;
          return (
            <button key={o.id} type="button" className={`option-card${selected ? " selected" : ""}${o.img && hasExplainer(o.img) ? " has-img" : ""}`}
              aria-pressed={selected} disabled={disabledIds.includes(o.id)} onClick={() => onChange(o.id)}>
              {o.img && hasExplainer(o.img) && (
                <span className="option-card-media"><ExplainerImg name={o.img} alt="" /></span>
              )}
              <span className="option-card-name">{o.label}</span>
              {o.desc && <span className="option-card-desc">{o.desc}</span>}
            </button>
          );
        })}
      </div>
      {note && <div className="choice-note">{note}</div>}
    </div>
  );
}
