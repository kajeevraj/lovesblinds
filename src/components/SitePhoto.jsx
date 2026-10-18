import PHOTOS from '../data/sitePhotos.json';

// One of the approved site photos as a responsive WebP. `eager` is only for the picture at the top of the page.
export default function SitePhoto({ name, alt = '', sizes = '100vw', eager = false, className = '', style }) {
  const p = PHOTOS[name];
  if (!p) return null;
  const srcSet = p.widths.map((w) => `/images/site/${name}-${w}.webp ${w}w`).join(', ');
  const largest = p.widths[p.widths.length - 1];
  return (
    <img
      className={className}
      style={style}
      src={`/images/site/${name}-${largest}.webp`}
      srcSet={srcSet}
      sizes={sizes}
      width={p.width}
      height={p.height}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchpriority={eager ? 'high' : undefined}
      decoding="async"
    />
  );
}
