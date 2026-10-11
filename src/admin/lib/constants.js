export const LINE_LABELS = {
  roller: 'Roller', zebra: 'Zebra', 'shangri-la': 'Shangri-La', cellular: 'Cellular',
  'dream-curtains': 'Dream Curtains', drapery: 'Drapery & Roman',
};
export const LINE_ORDER = ['roller', 'zebra', 'shangri-la', 'cellular', 'drapery', 'dream-curtains'];
// Where each line's records are listed on the site (Roman and Drapery share records).
export const SHOWN_IN = {
  roller: ['roller'], zebra: ['zebra'], 'shangri-la': ['shangri-la'], cellular: ['cellular'],
  drapery: ['roman', 'drapery'], 'dream-curtains': ['dream-curtains'],
};
export const FAMILY_LABELS = { 'screen-view': 'Screen View', solar: 'Solar', blackout: 'Blackout', 'light-filtering': 'Light Filtering' };
export const ROLLER_FAMILIES = ['screen-view', 'solar', 'blackout'];
export const CELLULAR_FAMILIES = ['light-filtering', 'blackout'];
export const GRADES = ['A', 'B', 'C', 'D', 'E'];
export const ROMAN_STYLE_LIST = [
  { id: 'relax', label: 'Relax' }, { id: 'flat', label: 'Flat' }, { id: 'plain-fold', label: 'Plain Fold' },
  { id: 'ribble', label: 'Ribble' }, { id: 'hobble', label: 'Hobble' },
];
export const LINING_LIST = [{ id: 'blackout', label: 'Blackout' }, { id: 'light-filtering', label: 'Light-filtering' }];
export const IDLE_MINUTES = 30;

export const familyNeeded = (line) => (line === 'roller' ? ROLLER_FAMILIES : line === 'cellular' ? CELLULAR_FAMILIES : null);
// "Roller · Solar", "Zebra"
export const scopeLabel = (line, family) =>
  LINE_LABELS[line] + ((line === 'roller' || line === 'cellular') && family ? ` · ${FAMILY_LABELS[family]}` : '');
export const LIVE_NOTE = 'It will show on the live site within about a minute.';
