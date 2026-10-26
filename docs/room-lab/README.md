# Room visualizer test page (`/room-lab`)

A test page (noindex, not linked from anywhere) that draws 3D window treatments into the windows of a room photo. The live homepage is untouched.
This replaces the `/hero-lab` experiment (that code lives only on the unmerged branch `claude/peaceful-planck-nzo2np` and is not part of this branch).

## How it is built
- **Photo:** `assets/room-lab/room-bare.webp` (source), responsive copies in `public/room-lab/room-{800,1200,1600,2000}.webp`.
- **Camera match:** `src/room/data.js`. A straight-on pinhole camera, 5.9 m from the back wall, principal point at the picture centre (the ceiling and skirting lines of the side wall meet there). 358 px per metre at the wall (2.6 m ceiling).
- **Window openings (photo pixels, jamb to jamb, where an inside-mount shade fits):** left 427-712 x 177.5-817, middle 821-1118, right 1224-1504. The far-right window is on the side wall and is placed in 3D (`FAR_WINDOW`). It copies the last "All windows" choice.
- **Furniture cutout:** `scripts/room-lab/make-cutout.py` (rembg + closed-form matting) makes `assets/room-lab/room-cutout.png`; `scripts/room-lab/build-room-images.mjs` writes `public/room-lab/cutout-*.webp`. It is laid over the 3D canvas so shades and curtains pass behind the sofa, table, lamp and plant.
- **Fabrics:** `scripts/room-lab/build-fabrics.mjs` pulls real swatches from the public catalog (display names only), flattens the lighting and writes `public/room-lab/fabrics/*.webp` and `src/room/fabrics.json`.
- **Models (reusable, width/height/fabric/amount inputs):** `src/room/models/shade.js` (Roller, Zebra), `curtains.js`, factory `createModel()` in `models/index.js`. Round 2 products plug in the same way.
- **Zebra:** one loop of cloth. Front and back layers slide past each other as the shade moves (`SLIDE` in `shade.js`), so it can be stopped where only cloth shows or where the sheer bands let the view through.
- **Room dimming:** a dark veil over the photo with holes at the glass, plus the furniture cutout's brightness, scaled by how much light the lowered products block.

Roller names (the site's own): *Solar* = catalog family "solar" (XS... / YS... codes), *Screen view* = family "screen-view" (XSS... codes), *Blackout* = family "blackout".

## Round 1.1 changes
- **Controls on the windows:** each window has a pill above it (on the wall) with the product name and ‹ › to cycle (Bare, Light filtering, Solar, Blackout, Zebra); phones show the pill only on the selected window and a swipe on it cycles too. A compact toolbar above the room shows the selected window's product, 5 real-swatch color presets, "+ N more", "Build yours", and the "All windows" and "Curtains" toggles. "All windows" copies product and color to every window; off, each window is independent. The side-wall window follows the last "All windows" choice.
- **Colors:** "+ N more" opens a bottom sheet (phones) or side panel (desktop) with every catalog swatch for that product, using the product pages' picker (`SwatchBrowser` in `src/components/s2.jsx`: search, color-family filters, magnifier, name and code). Swatches that are not presets are cut and flattened in the browser (`whenFabric` in `src/room/models/common.js`).
- **Curtains are one layer:** a single track across all three windows (and a separate track on the side wall), panels that always move together, over shades or bare glass. Dragging sideways opens/closes; dragging vertically still moves the shade. Their own presets and swatch panel.
- **No selection box;** nothing is drawn over the sofa (pills sit on the wall, handles are held above the sofa's top edge).
- Keyboard: pills are buttons (←/→ cycle), sliders under the room move the shade and curtains.

## Round 1.2: product-page preview, hero test, textures
- **Product-page preview** (`src/room/PreviewPane.jsx`, `previewScene.js`; wired in `src/lineshell.jsx` via the `preview` prop, Roller and Zebra only for now): the left photo becomes a live 3D view of the blind in a window at the typed size: inside or outside mount, chain or motor, wrapped cassette or none, double-stack (two shades), color from the page's pick. Size labels outside the frame ("Hide sizes" toggle), drag or slider to raise and lower, "See it in a room" (the same blind in all three windows, `RoomEmbed.jsx`), and a "Style photo" tab. A line without a model keeps its photo. No WebGL: the photo stays. The three.js chunk loads after the page is up; the photo is shown first.
- **Phone:** the preview is a sticky strip (one size, so nothing jumps), with a "Hide preview" button; it folds away while a size box has the keyboard.
- **Hero test page** `/room-lab/hero` (`HeroRoom.jsx`): the room plays by itself (7 scenes, a new one about every 5.6 s, shades rise, swap and lower in a stagger). Sharp photo first. Still for reduced motion; paused when off-screen or the tab is hidden. The homepage is unchanged: to use it, render `<HeroRoom navigate={navigate} />` in `HomePage` instead of the hero photo.
- **3D fabric textures for every swatch:** `tex256/<line>/<name>.webp` in the `swatches` bucket (naming rule, no database column), made by `scripts/backfill-textures.mjs` (one-time, already run: 443 textures) and by the admin on upload or replace (`src/admin/lib/images.js`). The maths is shared (`src/room/textureCore.js`); the browser makes a texture on the spot only as a fallback (`whenFabric` in `models/common.js`).
- **Shared swatch picker:** `SwatchBrowser` in `src/components/s2.jsx` (search, color-family filters, magnifier) is used by the product pages and the room lab's color panel.
- **Room photo loading:** `index.html` preloads one right-sized file (`src/room/photoSize.js`, kept in step with the page by `supabase/tests/room_photo_size_tests.mjs`); the blurred placeholder goes as soon as it is in.
- Tests: `supabase/tests/e2e_preview.mjs`.
