import { useState } from 'react';
import PHOTOS from '../data/sitePhotos.json';

// One of the approved site photos as a responsive WebP. `eager` is only for the picture at the top of the page.
// `eager` is for the one big picture at the top of a page (loaded first, high priority). `loading="eager"` is for small pictures that
// are on screen straight away, such as the order's thumbnails: no lazy loading, so they are never blank.
export default function SitePhoto({ name, alt = '', sizes = '100vw', eager = false, loading, className = '', style }) {
  const [failed, setFailed] = useState(false);
  const p = PHOTOS[name];
  if (!p) return null;
  if (failed) return <span className={`s2-photo-missing ${className}`} style={style} role="img" aria-label={alt || 'Photo not available'} />;
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
      loading={loading || (eager ? 'eager' : 'lazy')}
      fetchpriority={eager ? 'high' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
