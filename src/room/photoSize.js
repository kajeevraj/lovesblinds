// Which size of the room photo to ask for first. Pure (no bundler APIs): vite.config.js uses it to put a preload for the photo in index.html, and the
// page uses it for the <img>, so both ask for the very same file and the browser fetches it once, before any script has run.
export const ROOM_WIDTHS = [800, 1200, 1600, 2000];
export const roomSrc = (w) => `/room-lab/room-${w}.webp`;
export const PHONE_QUERY_PX = 720;                       // up to this viewport width the phone crop of the photo is used (1300 of its 2000 px)
// stage width in CSS px for a viewport width (the page keeps 16 px gutters and caps the stage at 1180)
export const stageWidth = (viewport) => Math.min(Math.max(viewport - 32, 280), 1180);
// the photo pixels needed to look sharp: the stage shows `viewPx` of the photo's 2000 px across `stageCss` CSS px at `dpr`
export function pickWidth(viewport, dpr = 1) {
  const viewPx = viewport <= PHONE_QUERY_PX ? 1300 : 1890;
  const need = (stageWidth(viewport) * dpr * 2000) / viewPx;
  return ROOM_WIDTHS.find((w) => w >= need * 0.92) || ROOM_WIDTHS[ROOM_WIDTHS.length - 1];     // 8% slack: 1190 px needed is fine from the 1200 file
}
