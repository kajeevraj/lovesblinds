import { useState } from 'react';
import SHOWCASE from '../data/showcase.json';

export const showcaseFor = (slug, section = null) =>
  SHOWCASE.filter(s => s.slug === slug && (section == null || s.section === section));

// Branded stand-in used wherever there is no photo yet: charcoal, a thin gold rule, the name.
export function BrandPanel({ title, subtitle, aspect = "16 / 9", className = "", tag = "div", titleLevel }) {
  const T = titleLevel || "div";
  return (
    <div className={`brand-panel ${className}`} style={{ aspectRatio: aspect }} data-tag={tag}>
      <div className="brand-panel-inner">
        <span className="brand-panel-rule" aria-hidden="true" />
        <T className="brand-panel-title">{title}</T>
        {subtitle && <div className="brand-panel-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

const roomOf = (file) => {
  // <slug>-<room>-<nn>.jpg, with an optional section word for drapery
  const parts = file.replace(/\.[^.]+$/, "").split("-");
  const nn = parts.pop();
  const rest = parts.join("-").replace(/^(drapery-(curtains|dream)|shangri-la|[a-z]+)-?/i, "");
  return /^\d+$/.test(nn) && rest ? rest.replace(/-/g, " ") : "";
};

export function altFor(entry, lineName) {
  const room = roomOf(entry.file);
  return room ? `${lineName} in a ${room}` : `${lineName} showcase photo`;
}

// A photo from the manifest, or the brand panel when there is none (or it fails to load).
export function ShowcasePhoto({ entry, lineName, eager = false, sizes, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!entry || failed) return <BrandPanel title={lineName} className={className} />;
  const dims = entry.width && entry.height ? { width: entry.width, height: entry.height } : {};
  return (
    <picture>
      {entry.webp && <source type="image/webp" srcSet={entry.webp} sizes={sizes} />}
      <img
        className={`showcase-img ${className}`}
        src={entry.src}
        alt={altFor(entry, lineName)}
        {...dims}
        loading={eager ? "eager" : "lazy"}
        fetchpriority={eager ? "high" : undefined}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </picture>
  );
}
