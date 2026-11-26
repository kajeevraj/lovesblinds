# AI handoff log

Dated entries, newest last: what changed, what is on staging vs live, what waits for approval, test results.

## 2026-11-16 — PR 21 (`claude/texture-accuracy`): texture types, zebra colors, chain, Shangri-La vanes
**What changed**
- Texture type per swatch (9 types, measured from the photo; 20 corrected by eye in `scripts/texture-types/reviewed.mjs`), Generated or Photo per color (generated for slub, mesh, twill, linen, stripe, smooth; photo for tweed, motif, print), admin override for both next to Weave strength. Generated cloth is laid out patch by patch on the 3D shade so no repeat grid shows.
- Zebra: solid band generated in the color of the photo's solid band, sheer band = the photo's sheer band. Follow-up rules: black-family zebras are held to Lab L* 24 or less (Jet Black DZB3105 #7e7e89 → #39393d; Black White, Black Grey, Raven Black, Black Brown also capped); for Beige/Tan and Cream/Ivory the cool backdrop band is never the solid (Safari Khaki #c5c5c9 → #e2d7c2) and a beige whose solid band reads neutral grey gets the family's warm tint (Vanilla Latte, Straw Khaki, Sand Beige, Clay Khaki). All 88 zebras were checked; before/after in `docs/texture-types/zebra-colors.md`.
- Chain on every line that has one is the control (two strands with 46 px touch areas, beads move with the drag, arrow keys); no step buttons or center handle. Shangri-La vanes open on their own at the bottom and close first on the way up, with the same animation both ways.
- Screenshots (normal size, 1440 desktop and 390 phone): `docs/texture-types/shots/`. Review sheet: `docs/texture-types/review-sheet/`.

**Staging vs live**
- Staging: migration 27 applied (`swatches.texture_type`, `swatches.texture_source`, `public_catalog()` returns both). All writing tests ran there.
- Live: NOTHING changed. The branch is not merged.

**Waits for approval (nothing applied)**
1. Migration 27 on live (`supabase/migrations/20261111000027_texture_type_and_source.sql`).
2. `node scripts/classify-textures.mjs --apply` (stores types only where empty; manifest + `--undo`).
3. `node scripts/apply-color-fixes.mjs --fixes part4 --apply` (removes the stale preview_color on Dark Chocolate #4b3626 and Bittersweet Chocolate #523927; dry run verified). Until then the live catalog still shows those two overrides; the screenshots show them as they will look after.
4. Merging PR 21.

**Tests**: full `node scripts/run-tests.mjs` (fresh build, start to finish): 61/61 suites passed. Earlier runs on this branch each had one flaky failure that was fixed (a Cellular rail check read before the Stop was applied; the admin browser test timed out under the load of the full run) and the suite was run again. Thresholds loosened with reasons: zebra wave limit 16, dark weave on a phone 7.5 (desktop 9), Roman light-filtering plain-RGB face check 12 (the Lab check stays 4).

## 2026-11-18 — PR 21 follow-up: Shangri-La fabric, visible bead chain
**What changed**
- **Shangri-La fabric**: the color is now the vane fabric's own (`vaneHex` in `src/lib/textureType.js`): for families with a color of their own (Beige/Tan, Brown, Cream/Ivory, Blue, Green, Pink/Red, Purple) the pixels that carry that color are the cloth, so the pale table in the photo no longer greys it; a Brown whose photo reads olive is pulled toward red-brown (Chocolate YSLP1004 #726d5d → brown #65513c; Linen #d2c8bf → #d5c5b3; Honey Latte, Chai Latte and the cream colors move a little). White and grey colors keep the older reading. The cloth's grain is cut from the photo turned so its threads run horizontally (`alignedPatch`), drawn plain (slub, linen or smooth) and a little quieter, and the vane shading is stronger: closed = soft horizontal bands about one per 2 in, open = light between the vanes. All 21 Shangri-La colors checked (`e2e_texture_types`: tile within distance 4 of the vane fabric, brown stays brown, plain sheer cloth) and `e2e_shade_colors` for Shangri-La (7/7).
- **Chain**: a real bead chain: larger beads (about 14 mm drawn), a soft outline of the opposite lightness (a white chain has a dark outline, a dark chain a light one), hanging from the cassette on the motor side OUTSIDE the fabric edge, in front of the trim so it is never hidden. The 46 px touch areas are unchanged. Found and fixed on the way: a stray `}` in `src/styles.css` made the browser drop the `.pv-chain` positioning rule, so the touch areas had been sitting at the top-left corner of the preview; they now sit on the chain (`e2e_chain_drag` checks the chain stands out from its background at normal size, desktop and phone, every line).
- Screenshots retaken: all Shangri-La and all chain mid-drag, desktop 1440 and phone 390 (`docs/texture-types/shots/`). The Roller, Zebra, Cellular and Roman light/dark/white shots were NOT retaken (they were not affected), so they still show the old thin chain.

**Staging vs live**: unchanged. Migration 27 is on staging only; NOTHING was applied to live, nothing merged.

**Waits for approval**: migration 27 on live; `classify-textures --apply`; `apply-color-fixes --fixes part4 --apply`; merging PR 21.

**Tests**: full `node scripts/run-tests.mjs`, start to finish: 61/61 suites passed. Earlier full runs each had one timing flake that was fixed before the final run (the shade probe's page load under load, two soft-preview checks that used fixed waits for motors and glides, the admin browser idle check that raced between two tabs). The container restarted three times during these runs; the last run completed without a restart.

## 2026-11-26 — Phase 3 part 1: Dream Curtains 3D preview
**What changed**
- New strip model on a sliding glass door with a plank floor; strips A (41 cm) and B (33 cm) read as the brief asks (see `docs/project-handoff.md`, "Dream Curtains 3D preview"); mount, stack, install and color update it live; Manual drag, Pull rod drag, Motorized remote (Center splits), hover opens a joint, press parts the strips and they swing back.
- Fixed a frame-loop double scheduling bug in `previewScene.js` (the page froze on a press).
- Migration 28 (pull rod price row, $0, admin-editable) + paste copy `supabase/staging/part2/28.sql`. NOT applied anywhere: staging first, then the owner runs live.
- Tests: new `dream_layout_tests`, `e2e_dream_preview`; Dream added to `e2e_shade_colors`; screenshots in `docs/dream-preview/`.
**Differences from the brief**: the supplier brochure is not in the repo (A/B read from the handoff notes); the page has no battery / wired choice for Dream; the older option text said style B is a "lighter fabric" (the brief says one single sheer fabric): left as is, tell me if it should change.
**Waits for approval**: migration 28 on staging and live; any pull rod price; merging.
