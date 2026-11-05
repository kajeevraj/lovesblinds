// Our remotes, drawn as clean white-plastic SVG at their real proportions. One component per body, so each can be replaced by a photo:
// put the photo's URL in REMOTE_PHOTOS under the remote's type (see lib/remote.js) and that remote shows the photo instead, with the same
// buttons laid over it in the same places. Every button is a real <button> (keyboard and screen reader friendly) over the picture.
//
//   <Remote type="ch6" lit="up" onPress={(id) => ...} />
//
// Button ids: up, stop, down, chPrev, chNext (the 1, 6 and 16 channel remote)
//             up, stop, down, chDown, chUp (cellular, one motor)   topUp, topDown, railTop, railBottom, botUp, botDown (cellular, two motors)
import { useId } from 'react';

export const REMOTE_PHOTOS = {};          // { ch1: '/remotes/ch1.png', 'dual-multi': '/remotes/dual-multi.png', ... } later

const TIP = 44;                           // the smallest tap target (CSS pixels)

// ---- layouts: where everything sits, in CSS pixels at the size shown --------------------------------------------------------------------------
function shadeLayout(type) {
  const multi = type !== 'ch1';
  const items = [
    { id: 'up', kind: 'round-up', cx: 46, cy: 84, r: 17, label: 'Raise the shade' },
    { id: 'stop', kind: 'dash', cx: 46, cy: 132, w: 30, h: 26, label: 'Stop' },
    { id: 'down', kind: 'round-down', cx: 46, cy: 180, r: 17, label: 'Lower the shade' },
  ];
  if (multi) {
    items.push({ id: 'chPrev', kind: 'sq-left', cx: 30, cy: 223, w: 34, h: 24, label: 'Previous channel', quiet: true });
    items.push({ id: 'chNext', kind: 'sq-right', cx: 66, cy: 223, w: 34, h: 24, label: 'Next channel', quiet: true });
  }
  return { w: 92, h: 258, family: 'shade', items };
}

function wandLayout(type) {
  const dual = type.startsWith('dual'), multi = type.endsWith('multi');
  const rows = [88, 134, 180, 226], items = [];
  if (!dual) {
    items.push({ id: 'up', kind: 'pill-up', cx: 32, cy: rows[0], w: 44, h: 24, label: 'Raise the shade' });
    items.push({ id: 'stop', kind: 'pill-pause', cx: 32, cy: rows[1], w: 44, h: 24, label: 'Stop' });
    items.push({ id: 'down', kind: 'pill-down', cx: 32, cy: rows[2], w: 44, h: 24, label: 'Lower the shade' });
  } else {
    items.push({ id: 'topUp', kind: 'half-up', cx: 21, cy: rows[0], w: 22, h: 24, label: 'Raise the top rail', pill: 'left' });
    items.push({ id: 'topDown', kind: 'half-down', cx: 43, cy: rows[0], w: 22, h: 24, label: 'Lower the top rail', pill: 'right' });
    items.push({ id: 'railTop', kind: 'half-railtop', cx: 21, cy: rows[1], w: 22, h: 24, label: 'Top rail selected', pill: 'left', quiet: true });
    items.push({ id: 'railBottom', kind: 'half-railbottom', cx: 43, cy: rows[1], w: 22, h: 24, label: 'Bottom rail selected', pill: 'right', quiet: true });
    items.push({ id: 'botUp', kind: 'half-up', cx: 21, cy: rows[2], w: 22, h: 24, label: 'Raise the bottom rail', pill: 'left' });
    items.push({ id: 'botDown', kind: 'half-down', cx: 43, cy: rows[2], w: 22, h: 24, label: 'Lower the bottom rail', pill: 'right' });
  }
  if (multi) {
    items.push({ id: 'chDown', kind: 'half-minus', cx: 21, cy: rows[3], w: 22, h: 24, label: 'Channel down', pill: 'left', quiet: true });
    items.push({ id: 'chUp', kind: 'half-plus', cx: 43, cy: rows[3], w: 22, h: 24, label: 'Channel up', pill: 'right', quiet: true });
  }
  return { w: 64, h: multi ? 262 : 216, family: 'wand', multi, dual, items };
}

export const remoteLayout = (type) => (type.startsWith('ch') ? shadeLayout(type) : wandLayout(type));

// ---- drawing --------------------------------------------------------------------------------------------------------------------------------------
const ICON = '#55535a';
const stroke = { fill: 'none', stroke: ICON, strokeWidth: 2.3, strokeLinecap: 'round', strokeLinejoin: 'round' };

function Icon({ kind, x, y }) {
  const t = `translate(${x} ${y})`;
  if (kind.endsWith('up') && !kind.includes('railtop')) return <path d="M-5.5 2.5 0 -3 5.5 2.5" transform={t} {...stroke} />;
  if (kind.endsWith('down') && !kind.includes('railbottom')) return <path d="M-5.5 -2.5 0 3 5.5 -2.5" transform={t} {...stroke} />;
  if (kind === 'dash') return <path d="M-6 0H6" transform={t} {...stroke} />;
  if (kind === 'pill-pause') return <g transform={t} {...stroke}><path d="M-3 -5V5M3 -5V5" /></g>;
  if (kind === 'sq-left') return <path d="M2 -4.5-3 0 2 4.5" transform={t} {...stroke} strokeWidth={2} />;
  if (kind === 'sq-right') return <path d="M-2 -4.5 3 0-2 4.5" transform={t} {...stroke} strokeWidth={2} />;
  if (kind === 'half-minus') return <path d="M-4 0H4" transform={t} {...stroke} />;
  if (kind === 'half-plus') return <path d="M-4 0H4M0 -4V4" transform={t} {...stroke} />;
  if (kind === 'half-railtop' || kind === 'half-railbottom') {                          // a little rail: the top or the bottom bar is the one selected
    const top = kind === 'half-railtop';
    return <g transform={t}><rect x="-5" y="-5" width="10" height="10" rx="1.5" fill="none" stroke="#a9a6a0" strokeWidth="1.3" /><rect x="-5" y={top ? -5 : 2} width="10" height="3" rx="1" fill={ICON} /></g>;
  }
  return null;
}

function Body({ layout, id, type, active }) {
  const { w, h, family } = layout;
  const rx = family === 'shade' ? 16 : w / 2 - 3;
  return (
    <>
      <ellipse cx={w / 2} cy={h - 2} rx={w / 2 - 14} ry="4" fill="rgba(60,45,25,.28)" filter={`url(#${id}-blur)`} />
      <rect x="3" y="3" width={w - 6} height={h - 12} rx={rx} fill="#e9e7e1" stroke="#d9d6ce" />                           {/* the thicker rim */}
      <rect x="6.5" y="6.5" width={w - 13} height={h - 19} rx={Math.max(8, rx - 3.5)} fill={`url(#${id}-body)`} stroke="rgba(255,255,255,.9)" />
      <Indicators layout={layout} id={id} type={type} active={active} />
    </>
  );
}

function Indicators({ layout, id, type, active }) {
  const { w, family } = layout;
  const cx = w / 2;
  if (family === 'shade') {
    if (type === 'ch1') return <circle cx={cx} cy="30" r="2.6" fill="#b9b7b1" />;
    if (type === 'ch6') return <>{[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={cx + (i - 2.5) * 9.5} cy="30" r="2.3" fill={i === active - 1 ? '#4a90ff' : '#c4c2bc'} />)}</>;
    return <><rect x={cx - 17} y="17" width="34" height="25" rx="5" fill="#f3f6fb" stroke="#d3d9e3" /><text x={cx} y="36" textAnchor="middle" fontFamily="'Courier New', monospace" fontWeight="700" fontSize="19" fill="#3b82f6">{active}</text></>;
  }
  if (!layout.multi) return <><circle cx={cx} cy="24" r="2.2" fill="#b9b7b1" /><circle cx={cx} cy="33" r="2.2" fill="#b9b7b1" /></>;
  return <><circle cx={cx} cy="42" r="15" fill="#0d0d0f" /><ellipse cx={cx - 4} cy="36" rx="7" ry="4" fill="rgba(255,255,255,.14)" /></>;
}

function Button({ it, lit, id }) {
  const on = lit === it.id;
  const fill = on ? '#ffe5a8' : `url(#${id}-btn)`, line = on ? '#e3b45e' : '#d4d1c9';
  const glow = on ? { filter: `url(#${id}-glow)` } : null;
  if (it.kind.startsWith('round')) return <g {...glow}><circle cx={it.cx} cy={it.cy} r={it.r} fill={fill} stroke={line} strokeWidth="1.5" /><Icon kind={it.kind} x={it.cx} y={it.cy} /></g>;
  if (it.kind === 'dash') return <g {...glow}><rect x={it.cx - it.w / 2} y={it.cy - it.h / 2} width={it.w} height={it.h} rx="9" fill={fill} stroke={line} strokeWidth="1.5" /><Icon kind="dash" x={it.cx} y={it.cy} /></g>;
  if (it.kind.startsWith('sq-')) return <g {...glow}><rect x={it.cx - it.w / 2} y={it.cy - it.h / 2} width={it.w} height={it.h} rx="5" fill={fill} stroke={line} strokeWidth="1.3" /><Icon kind={it.kind} x={it.cx} y={it.cy} /></g>;
  if (it.kind.startsWith('pill')) return <g {...glow}><rect x={it.cx - it.w / 2} y={it.cy - it.h / 2} width={it.w} height={it.h} rx={it.h / 2} fill={fill} stroke={line} strokeWidth="1.4" /><Icon kind={it.kind} x={it.cx} y={it.cy} /></g>;
  return null;                                                                                                          // halves are drawn with their pill
}

// a split pill: one outline, two halves; the half that was pressed lights up
function SplitPills({ layout, lit, id }) {
  const rows = {};
  for (const it of layout.items) if (it.pill) (rows[it.cy] ||= []).push(it);
  return Object.entries(rows).map(([cy, pair]) => {
    const [a, b] = pair, left = a.pill === 'left' ? a : b, right = a.pill === 'left' ? b : a, x0 = left.cx - left.w / 2, y0 = Number(cy) - 12, W = left.w + right.w;
    const half = (it, d) => (lit === it.id ? <path d={d} fill="#ffe5a8" /> : null);
    const clipId = `${id}-pill-${cy}`;
    return (
      <g key={cy}>
        <clipPath id={clipId}><rect x={x0} y={y0} width={W} height="24" rx="12" /></clipPath>
        <rect x={x0} y={y0} width={W} height="24" rx="12" fill={`url(#${id}-btn)`} stroke="#d4d1c9" strokeWidth="1.4" />
        <g clipPath={`url(#${clipId})`}>{half(left, `M${x0} ${y0}h${left.w}v24h-${left.w}z`)}{half(right, `M${x0 + left.w} ${y0}h${right.w}v24h-${right.w}z`)}</g>
        <path d={`M${x0 + left.w} ${y0 + 4}v16`} stroke="#d4d1c9" strokeWidth="1.2" />
        <rect x={x0} y={y0} width={W} height="24" rx="12" fill="none" stroke={pair.some((p) => lit === p.id) ? '#e3b45e' : '#d4d1c9'} strokeWidth="1.4" />
        <Icon kind={left.kind} x={left.cx} y={Number(cy)} /><Icon kind={right.kind} x={right.cx} y={Number(cy)} />
      </g>
    );
  });
}

export function Remote({ type = 'ch1', lit = null, onPress, active = 1, className = '' }) {
  const id = useId().replace(/:/g, '');
  const layout = remoteLayout(type), { w, h } = layout;
  const photo = REMOTE_PHOTOS[type];
  return (
    <div className={`rm rm-${layout.family} ${className}`} style={{ width: w, height: h }} role="group" aria-label={`Remote control, ${type}`} data-remote={type}>
      {photo ? <img className="rm-photo" src={photo} alt="" width={w} height={h} /> : (
        <svg className="rm-art" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f1efea" /></linearGradient>
            <linearGradient id={`${id}-btn`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fdfcfa" /><stop offset="1" stopColor="#ecebe6" /></linearGradient>
            <filter id={`${id}-blur`} x="-30%" y="-300%" width="160%" height="700%"><feGaussianBlur stdDeviation="3" /></filter>
            <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="3.2" floodColor="#ffc857" floodOpacity="0.95" /></filter>
          </defs>
          <Body layout={layout} id={id} type={type} active={active} />
          {layout.family === 'wand' && <SplitPills layout={layout} lit={lit} id={id} />}
          {layout.items.filter((it) => !it.pill).map((it) => <Button key={it.id} it={it} lit={lit} id={id} />)}
        </svg>
      )}
      {layout.items.map((it) => {
        const bw = it.r ? Math.max(TIP, it.r * 2) : it.pill || it.quiet ? it.w : Math.max(TIP, it.w);
        const bh = it.pill ? 46 : it.quiet ? it.h : Math.max(TIP, it.h || 0, (it.r || 0) * 2);
        return (
          <button key={it.id} type="button" className={`rm-btn${lit === it.id ? ' lit' : ''}`} aria-label={it.label} data-btn={it.id}
            style={{ left: it.cx - bw / 2, top: it.cy - bh / 2, width: bw, height: bh }} onClick={() => onPress?.(it.id)} />
        );
      })}
    </div>
  );
}

// ---- the simple remote: just the buttons ----------------------------------------------------------------------------------------------------------
// What the product pages use now: a row of plain 44 px buttons (up, stop, down); two small rows for a two-motor cellular shade (top rail, bottom rail).
// Same wrapper and ids as <Remote>, so the picture version above can come back for a photo any time.
const GLYPH = {
  up: <path d="M6 15l6-6 6 6" />, down: <path d="M6 9l6 6 6-6" />, stop: <path d="M6 12h12" />,
};
const glyphOf = (id) => (/up$/i.test(id) ? GLYPH.up : /down$/i.test(id) ? GLYPH.down : GLYPH.stop);
const NAMES = {
  up: 'Raise the shade', stop: 'Stop', down: 'Lower the shade',
  topUp: 'Raise the top rail', topDown: 'Lower the top rail', botUp: 'Raise the bottom rail', botDown: 'Lower the bottom rail',
};

// `shades` (a roller double-stack): one small row of up, stop, down for each shade, named "Front shade" and "Back shade". A press is reported as "front:up", "back:stop" ...
export function SimpleRemote({ type = 'ch1', lit = null, onPress, className = '', shades = null }) {
  if (shades) {
    return (
      <div className={`rm rm-simple rm-two ${className}`} role="group" aria-label="Remote control" data-remote={type}>
        {shades.map((label, i) => {
          const who = i === 0 ? 'front' : 'back';
          return (
            <div className="rm-row" key={who} role="group" aria-label={label}>
              <span className="rm-row-label">{label}</span>
              {['up', 'stop', 'down'].map((id) => (
                <button key={id} type="button" className={`rm-key${lit === `${who}:${id}` ? ' lit' : ''}`} aria-label={`${NAMES[id]} (${label.toLowerCase()})`} data-btn={`${who}-${id}`} onClick={() => onPress?.(`${who}:${id}`)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{glyphOf(id)}</svg>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    );
  }
  const dual = type.startsWith('dual');
  const rows = dual ? [['Top rail', ['topUp', 'topDown']], ['Bottom rail', ['botUp', 'botDown']]] : [[null, ['up', 'stop', 'down']]];
  return (
    <div className={`rm rm-simple ${className}`} role="group" aria-label="Remote control" data-remote={type}>
      {rows.map(([label, ids]) => (
        <div className="rm-row" key={label || 'main'}>
          {label && <span className="rm-row-label">{label}</span>}
          {ids.map((id) => (
            <button key={id} type="button" className={`rm-key${lit === id ? ' lit' : ''}`} aria-label={NAMES[id]} data-btn={id} onClick={() => onPress?.(id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{glyphOf(id)}</svg>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
