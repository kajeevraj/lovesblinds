# Tests and scripts must not load pictures from the live Supabase project

The live project's free plan has a limited cached egress (5 GB). Tests and screenshot scripts used to load the swatch photos from LIVE storage: every browser test page loads dozens of tiles, `catalog_textures_tests` downloaded every photo of the catalog, the review / report scripts did the same.

## What is in place
- **A local copy** of every picture the site asks for (`.image-cache/<bucket>/<path>`, git-ignored). Fill it once (no live traffic): `node scripts/image-cache.mjs fill --seed <folder>` uses photos you already have (a folder with `catalog.json` + `full/` + `thumb/`), the repository's own source photos (`public/images/swatches/`), and makes the 200 px tiles and the textures locally with the backfill scripts' own code. `--from-staging` also tries the staging project; `--allow-live [--live-budget N]` is an explicit, bounded one-time fill from live (it prints how many files and bytes it took). `node scripts/image-cache.mjs status` tells what is missing.
- **A local image server** (`scripts/image-server.mjs`, port 4177): serves the copy (and, for pictures a staging test uploaded itself, the STAGING project's storage). It never asks live.
- **`scripts/run-tests.mjs`** starts it and builds the test sites with `VITE_IMAGE_BASE_URL=http://localhost:4177` (`src/data/catalogQuery.js` `storageUrl`, `src/admin/lib/images.js`). A production build leaves it empty, so the real site is unchanged. `--live-images` restores the old behaviour (do not use it routinely).
- **The guard** (`supabase/tests/lib/liveGuard.mjs`): any GET/HEAD of a live `/storage/v1/object/public/...` URL, from Node or from a browser page, fails the test (`LIVE GUARD: ...`). A read-only live check may fetch ONE picture (`LB_MAX_LIVE_IMAGES`, default 1; a writing test or a staging run gets none). Pages that ask anyway (a stale site build) are answered from the local copy, so a failure never costs the live project any egress. `LB_IMAGE_MODE=measure` only counts (and answers locally).
- **Scripts**: `texture-report`, `color-family-*`, `room-lab/build-fabrics` read photos through `swatchBytes()` (local copy); the screenshot scripts (`calibrate-shade-light`, `shade-before-after`, `shade-compare`, `soft-preview-shots`) and `supabase/tests/lib/shadeProbe.mjs` answer live picture requests from the copy (`withLocalImages(browser)`).
- `supabase/tests/image_guard_tests.mjs` tests the guard, the copy's path safety and the image server (offline).

## Still on live on purpose
The one-off maintenance scripts that operate ON live storage (`backfill-thumbs`, `backfill-textures`, `seed-catalog`, `cleanup-test-leftovers`) read and write live by design; they are not tests and are run by hand.
