// Custom SVG icons for each product category - used in slat rows
// All sized to a 54x38 viewBox; rendered at the same size in the row

const WoodBlindsIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="3" y="4" width="48" height="4.5" rx="0.5" fill="currentColor" opacity="0.12" />
    <line x1="6" y1="6" x2="48" y2="6" strokeWidth="0.5" opacity="0.6" />
    <rect x="3" y="11" width="48" height="4.5" rx="0.5" fill="currentColor" opacity="0.12" />
    <line x1="6" y1="13" x2="48" y2="13" strokeWidth="0.5" opacity="0.6" />
    <rect x="3" y="18" width="48" height="4.5" rx="0.5" fill="currentColor" opacity="0.12" />
    <line x1="6" y1="20" x2="48" y2="20" strokeWidth="0.5" opacity="0.6" />
    <rect x="3" y="25" width="48" height="4.5" rx="0.5" fill="currentColor" opacity="0.12" />
    <line x1="6" y1="27" x2="48" y2="27" strokeWidth="0.5" opacity="0.6" />
    <rect x="3" y="32" width="48" height="3" rx="0.5" fill="currentColor" opacity="0.18" />
  </svg>
);

const CellularIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="1.1">
    <path d="M3 5 Q14 11, 27 5 T51 5" />
    <path d="M3 5 Q14 -1, 27 5 T51 5" opacity="0" />
    <path d="M3 13 Q14 19, 27 13 T51 13" />
    <path d="M3 13 Q14 7, 27 13 T51 13" />
    <path d="M3 21 Q14 27, 27 21 T51 21" />
    <path d="M3 21 Q14 15, 27 21 T51 21" />
    <path d="M3 29 Q14 35, 27 29 T51 29" />
    <path d="M3 29 Q14 23, 27 29 T51 29" />
  </svg>
);

const RollerIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="4" y="3" width="46" height="5" rx="2.5" fill="currentColor" opacity="0.85" stroke="none" />
    <circle cx="10" cy="5.5" r="0.6" fill="white" />
    <circle cx="44" cy="5.5" r="0.6" fill="white" />
    <rect x="7" y="8" width="40" height="25" fill="currentColor" opacity="0.1" />
    <line x1="7" y1="33" x2="47" y2="33" strokeWidth="1.5" />
  </svg>
);

const ZebraIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="0.6">
    <rect x="4" y="4" width="46" height="3.5" fill="currentColor" opacity="0.7" stroke="none" />
    <rect x="4" y="7.5" width="46" height="3.5" fill="currentColor" opacity="0.15" stroke="none" />
    <rect x="4" y="11" width="46" height="3.5" fill="currentColor" opacity="0.7" stroke="none" />
    <rect x="4" y="14.5" width="46" height="3.5" fill="currentColor" opacity="0.15" stroke="none" />
    <rect x="4" y="18" width="46" height="3.5" fill="currentColor" opacity="0.7" stroke="none" />
    <rect x="4" y="21.5" width="46" height="3.5" fill="currentColor" opacity="0.15" stroke="none" />
    <rect x="4" y="25" width="46" height="3.5" fill="currentColor" opacity="0.7" stroke="none" />
    <rect x="4" y="28.5" width="46" height="3.5" fill="currentColor" opacity="0.15" stroke="none" />
  </svg>
);

const ShangriLaIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="3.5" y="3" width="47" height="32" rx="0.5" />
    <ellipse cx="27" cy="9" rx="20" ry="1.5" fill="currentColor" opacity="0.5" stroke="none" />
    <ellipse cx="27" cy="15" rx="20" ry="1.5" fill="currentColor" opacity="0.5" stroke="none" />
    <ellipse cx="27" cy="21" rx="20" ry="1.5" fill="currentColor" opacity="0.5" stroke="none" />
    <ellipse cx="27" cy="27" rx="20" ry="1.5" fill="currentColor" opacity="0.5" stroke="none" />
  </svg>
);

const RomanIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="1.1">
    <path d="M4 9 Q27 4, 50 9 L50 11 Q27 16, 4 11 Z" fill="currentColor" opacity="0.15" />
    <path d="M4 9 Q27 4, 50 9" />
    <path d="M4 18 Q27 13, 50 18 L50 20 Q27 25, 4 20 Z" fill="currentColor" opacity="0.18" />
    <path d="M4 18 Q27 13, 50 18" />
    <path d="M4 27 Q27 22, 50 27 L50 29 Q27 34, 4 29 Z" fill="currentColor" opacity="0.22" />
    <path d="M4 27 Q27 22, 50 27" />
  </svg>
);

const ShuttersIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="4" y="3" width="22" height="32" />
    <rect x="28" y="3" width="22" height="32" />
    {[0,1,2,3,4,5,6].map(i => (
      <line key={`l-${i}`} x1="6" y1={6 + i*4} x2="24" y2={4.5 + i*4} strokeWidth="1.3" opacity="0.7" />
    ))}
    {[0,1,2,3,4,5,6].map(i => (
      <line key={`r-${i}`} x1="30" y1={4.5 + i*4} x2="48" y2={6 + i*4} strokeWidth="1.3" opacity="0.7" />
    ))}
  </svg>
);

const DrapesIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="1">
    <line x1="2" y1="4" x2="52" y2="4" strokeWidth="1.5" />
    <circle cx="4" cy="4" r="1.5" fill="currentColor" />
    <circle cx="50" cy="4" r="1.5" fill="currentColor" />
    <path d="M9 5 Q7 18, 11 35 Q14 33, 16 35 Q14 18, 16 5" fill="currentColor" opacity="0.15" />
    <path d="M9 5 Q7 18, 11 35 M16 5 Q14 18, 16 35" />
    <path d="M22 5 Q20 18, 24 35 Q27 33, 29 35 Q27 18, 29 5" fill="currentColor" opacity="0.15" />
    <path d="M22 5 Q20 18, 24 35 M29 5 Q27 18, 29 35" />
    <path d="M35 5 Q33 18, 37 35 Q40 33, 42 35 Q40 18, 42 5" fill="currentColor" opacity="0.15" />
    <path d="M35 5 Q33 18, 37 35 M42 5 Q40 18, 42 35" />
  </svg>
);

const ZipScreenIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="3" y="3" width="4" height="32" fill="currentColor" opacity="0.7" stroke="none" />
    <rect x="47" y="3" width="4" height="32" fill="currentColor" opacity="0.7" stroke="none" />
    <rect x="7" y="3" width="40" height="32" fill="currentColor" opacity="0.08" />
    <g fill="currentColor" opacity="0.45">
      {Array.from({length: 6}).map((_, row) =>
        Array.from({length: 9}).map((_, col) => (
          <circle key={`${row}-${col}`} cx={10 + col*4} cy={6 + row*5} r="0.6" />
        ))
      )}
    </g>
  </svg>
);

const OutdoorRollerIcon = () => (
  <svg viewBox="0 0 54 38" width="54" height="38" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="4" y="3" width="46" height="5" rx="2.5" fill="currentColor" opacity="0.85" stroke="none" />
    <rect x="7" y="8" width="40" height="25" fill="currentColor" opacity="0.06" />
    <g fill="currentColor" opacity="0.4">
      {Array.from({length: 6}).map((_, row) =>
        Array.from({length: 10}).map((_, col) => (
          <circle key={`${row}-${col}`} cx={9.5 + col*3.8} cy={11 + row*3.8} r="0.7" />
        ))
      )}
    </g>
    <line x1="7" y1="33" x2="47" y2="33" strokeWidth="1.5" />
  </svg>
);

const CATEGORY_ICONS = {
  wood: WoodBlindsIcon,
  cellular: CellularIcon,
  roller: RollerIcon,
  zebra: ZebraIcon,
  shangrila: ShangriLaIcon,
  roman: RomanIcon,
  shutters: ShuttersIcon,
  drapes: DrapesIcon,
  zipscreen: ZipScreenIcon,
  outdoor: OutdoorRollerIcon,
};

// small utility icons
const ChevDown = ({size=18}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);
const ArrowRight = ({size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);
const Plus = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
const XIcon = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="6" y1="6" x2="18" y2="18"></line>
    <line x1="18" y1="6" x2="6" y2="18"></line>
  </svg>
);

Object.assign(window, {
  CATEGORY_ICONS,
  ChevDown, ArrowRight, Plus, XIcon,
});
