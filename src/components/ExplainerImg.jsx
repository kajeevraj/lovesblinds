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
