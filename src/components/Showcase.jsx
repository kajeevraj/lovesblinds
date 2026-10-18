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
