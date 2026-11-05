// The product picture area: a small gallery. Picture 1 is the live configurator (when the line has one); the next pictures are the line's
// style photos. A quiet indicator (small dots), arrows on desktop and a swipe on phones move between them. The configurator stays
// mounted while a style photo shows, so switching away and back keeps everything the customer chose.
import { useRef, useState } from 'react';
import SitePhoto from './SitePhoto.jsx';

export default function Gallery({ config = null, photos, photoNote, chip = null, label = 'Pictures' }) {
  const slides = [...(config ? [{ key: 'config', config: true, label: 'Your window, the live preview' }] : []), ...photos.map((p, i) => ({ key: p.name, photo: p, label: `Style photo ${i + 1} of ${photos.length}: ${p.alt}` }))];
  const [i, setI] = useState(0);
  const at = Math.min(i, slides.length - 1);
  const go = (n) => setI(((n % slides.length) + slides.length) % slides.length);
  const touch = useRef(null);
  const onTouchStart = (e) => {
    if (e.target.closest?.('.pv-grip, .pv-bar, .pv-drag, .rm, button, a')) { touch.current = null; return; }          // a drag on the shade is not a swipe
    const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const s = touch.current; touch.current = null; if (!s || slides.length < 2) return;
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.6) go(at + (dx < 0 ? 1 : -1));
  };
  const cur = slides[at];
  const many = slides.length > 1;
  return (
    <div className="gal" role="group" aria-roledescription="carousel" aria-label={label}>
      <div className="gal-stage" onTouchStart={many ? onTouchStart : undefined} onTouchEnd={many ? onTouchEnd : undefined}>
        {config && <div className="gal-slide gal-config" hidden={!cur.config}>{config}</div>}
        {!cur.config && (
          <div className="gal-slide gal-photo">
            <div className="s2-photo-frame">
              <SitePhoto key={cur.photo.name} name={cur.photo.name} alt={cur.photo.alt} sizes="(min-width: 960px) 45vw, 92vw" eager />
              {chip && (
                <span className="s2-photo-chip">
                  <img src={chip.thumb} alt="" width="36" height="36" />
                  {chip.displayName} ({chip.code})
                </span>
              )}
            </div>
          </div>
        )}
        {many && (
          <>
            <button type="button" className="gal-arrow gal-prev" aria-label="Previous picture" onClick={() => go(at - 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
            <button type="button" className="gal-arrow gal-next" aria-label="Next picture" onClick={() => go(at + 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
          </>
        )}
      </div>
      {many && (
        <div className="gal-dots" role="tablist" aria-label="Choose a picture">
          {slides.map((s, n) => (
            <button key={s.key} type="button" role="tab" aria-selected={n === at} aria-label={s.label} className={n === at ? 'on' : ''} onClick={() => go(n)}><span /></button>
          ))}
        </div>
      )}
      {!cur.config && <div className="s2-photo-note"><span aria-hidden="true">ⓘ</span> {photoNote || 'Photo shows the style. Your color is shown in the swatch.'}</div>}
    </div>
  );
}
