# Catalog to Supabase: handoff

Branch: `claude/modest-meitner-r3crhf`. `main` is untouched.

## Stage 1: supplier pricing and product options (branch `claude/supplier-pricing-stage1`, not merged)
Admin only. Customers see no change: the site still reads its options from code and shows no prices.
- **Migrations 6 and 7** (run in the SQL editor): admin-only tables for product lines, option groups and values, size rules, pricing lines, per-collection markups, price grids, the collections each grid covers, adders, flags and an import log, plus the `option-images` bucket. Functions: `estimate_price()` (anon-callable; returns only `{price, custom_size, price_on_request}`), `estimate_price_debug()` (admin; cost, grid cell, adders, markup), `price_import_apply()` (admin or service role; the same code path serves the one-time import and the admin re-import).
- **Data** (loaded with the service role): 138 grids and about 164,000 cost cells from the seven workbooks, 14 adders, 91 option values, 16 flags. The workbooks are supplier costs and live only in the git-ignored `private/supplier-sheets/`. The Dream Curtains `--` tab (customer data) is never read.
- **Price** = round((grid cost x multiplier + adders - deductions) x (1 + markup)), whole dollars; markup 50% per line, optional per-collection override. Sizes round UP to the next grid value; past the grid or a blank cell = "custom size". Double-stack = front + back. Cellular Day & Night is priced from the block of the second fabric. Zebra special sizes (x1.1) only when the standard grid has no price (Uranus and Venus, motor).
- **Axes.** Roller, Zebra, Roman, Shangri-La, Woven wood: rows = width, columns = drop. Cellular, Dream Curtains: rows = height, columns = width. Verify with one real quote; each grid has a swap in the admin.
- **Size limits from the grids (inches)**

| Line | System | Width | Height / drop |
|---|---|---|---|
| Roller | cord, motor | 23-118 | 24-120 |
| Roller | cordless | 23-98 | 24-96 |
| Zebra | cord, motor | 23-118 | 24-118.2 |
| Zebra | cordless | 23-98 | 24-96 |
| Zebra special sizes (Uranus, Venus) | motor | 23-118 | 24-154 |
| Shangri-La | cord | 23-112 | 24-118 (per collection "Max Length" is lower) |
| Cellular | all types | 24-99 | 21-107 |
| Roman | cord, motor | 23-94 | 24-104 |
| Roman | cordless | 23-94 | 24-96 |
| Dream Curtains | manual, motor | 24-352 | 12-228 |
| Woven wood (hidden) | all | 16-94.5 | 24-118 (size standards say 94.5) |

- **Admin:** Products (lines, option groups and values with picture upload, size rules) and Pricing (price checker, markups, grid viewer, adders and flags, re-import with preview).
- **Preview fixes (after the first test):**
  - Price checker labels show the effect on the customer price at the current size ("No fabric wrap on the cassette (−$4 on the customer price at this size)"); the math is unchanged and supplier cost still appears only in the admin breakdown. The customer pages show no prices.
  - **One color, several lines (migrations 9 and 10).** A color is one record with ONE display name, code and photo in every line. `swatch_links` (migration 9) says "also in that line, priced by that price group"; migration 10 removes the per-line names (existing links keep the color's main name). Names and codes stay unique within each line, counting every color's own line and its links; adding a color to a line where another color has the name is refused and the message names that color. `set_swatch_lines()` ticks and unticks lines in one call (admin / service role; unticking the main line promotes another; at least one line stays; a new line starts on that line's standard price group, i.e. its first group by sort order, Roller by the color's family or Solar). Links and unlinks are audit-logged. Admin: Colors → a color → "Product lines" (same multi-select on Add color); Pricing details (collapsed) has one row per line the color is in: the group it currently uses (marked "standard" when it is the default, "new line" before saving), a dropdown of that line's groups (plain text when the line has only one), saved with Save, shown in the change history, and clearing that line's cache.
  - **Price groups are admin-only.** "Collection" is now "Price group" in the admin, mainly a filter on the Colors list. The customer site reads only `public_catalog()`: no price group names or ids (it uses an opaque `fabrics.public_key`), no supplier color names, no grade, no extra cost. The order email to us still carries the price group, looked up on the server by `api/quote.js` (the customer email and the stored order picks never do). **Migration 11** (`..._000011_close_public_table_reads.sql`) closes the public's direct reads of `fabrics`, `swatches` and `swatch_links`; **run it when this branch is merged**, because the live site on main still reads those tables (running it earlier breaks main's color pages). Tests take `REQUIRE_CLOSED=1` to assert it.
  - **Extra cost:** `swatches.extra_cost` (default $0, same in every line), added to the customer price after the markup and the rounding of the grid price, in whole dollars. A Roller double-stack adds both colors' extra costs; Cellular Day & Night adds both.
  - **Customer price:** the order summary shows one price once a color is picked and a size entered (no breakdown) and updates live; curtains say "send us your order and we'll reply with a price". It is `estimate_price_for_swatch()` (anon; returns only price / custom size / price on request). The old price-group route `estimate_price()` is admin-only now. The admin price checker uses `estimate_price_debug_for_swatch()` and shows the price group and the extra cost apart.
  - **Site:** each line page asks `public_catalog()` (one request); a pick keeps the swatch id and the line; the order email rebuilds name, price group and supplier color name server-side. **Cache:** `api/catalog.js` tags each line (`catalog-<line>`); `api/catalog-purge.js` (admin-only, checks `is_admin()` with the caller's token) clears those tags through `@vercel/functions` when /admin saves a color, its lines, hide/show, delete or a price group. If the clear fails the 60 s cache still applies. Needs checking on the Vercel preview.
  - **Tests:** `12_one_color_many_lines_tests.sql` (local throwaway Postgres: stubs, migrations 1 to 7, 9, 10, 11), `live_links_tests.mjs` (live; includes a price group change in a second line moving only that line's price), `e2e_price_groups_per_line.mjs` (Pricing details rows, save, history, cache clear), the privacy checks in `live_pricing_tests.mjs`, `e2e_customer_price.mjs` (customer side at 390 px).
  - **Price checker:** one search box (color name or code, linked placements included) fills in line, collection and color; the collection shows in the admin only.
  - **Roller page:** the Solar / Screen View text sits under the fabric-family buttons with the privacy note; "Good to know" is removed for Roller.
  - **Tests:** `11_swatch_links_tests.sql` (local throwaway Postgres, run after the stubs and migrations 1 to 5 and 9), `live_links_tests.mjs` (live, needs migration 9, stops with a message until then).
- **Flags resolved (owner and supplier answers; migration 8 records them with a note on each flag):** axis kept as the sheets label it; Dream Curtains motor is **+$90** (supplier, status `from_supplier`; was a $110 placeholder); Day & Night priced from the second fabric's block, blocks not added; Roller double-stack = front + back (supplier will add double-stack prices to their portal later); Zebra special sizes keep x1.1; Shangri-La **Remote wand** now gets the sheet's "Remote control +$100" (control code `remote_wand`; Matter stays +$140).
- **Migration 8** (`20261014000008_pricing_flag_resolutions.sql`, run in the SQL editor; idempotent): allows adder status `from_supplier`, adds `price_flags.resolution_note`, and records the six answers. The amount, wand rule and resolved ticks were already applied through the API in the live project; the status change and the notes need this migration.
- **Still unresolved:** none of the "confirm" flags. Left open on purpose (not questions): Dream 115 in price drop (as printed), Roller/Zebra cent-level anomalies (as printed), and the info notes.
- **Done on the way:** the blackout collection "Gare" is now "Gaea" (ids unchanged). Shangri-La is horizontal only: the Format option, its picture and its copy are removed; saved orders that recorded a format still display as saved.
- **Tests:** `live_pricing_tests.mjs` (cost privacy and admin actions, 35), `pricing_spotcheck.py` (20 prices against the workbooks), `e2e_admin_pricing_browser.mjs` (29, at 390 px), plus the earlier suites (23, 56, 48). `scripts/import-pricing.mjs`, `scripts/seed-options.mjs` and `scripts/rename-gaea.mjs` are the one-time loaders.

## Admin (phase 1, branch `claude/blissful-goldberg-y079ph`, not merged)
- **/admin** (no link from the site; `noindex` meta tag and `X-Robots-Tag` header): Google sign-in only. A signed-in non-admin sees "You don't have access" and a Sign out button. All security is in the database (RLS and `is_admin()`); the browser only has the anon key. Lazy-loaded with its own CSS (`src/admin/`), so customers never download it. Idle sign-out after 30 minutes (client side; Supabase's own inactivity timeout is a Pro-plan setting). It shares the customer Supabase session, so signing out of /admin also signs that browser out of My Orders.
- **Colors**: list with search and filters, add / edit / replace photo / Hide-Show / Delete, collections with specs and collection-level Hide, Roman style availability per swatch (drapery), Dream Curtains Style A/B codes and photos, color family suggested from the photo (`src/lib/colorFamily.js`, shared with Node; `scripts/check-color-family.mjs` compares it with the old script: 137 of 139 picture-decided swatches identical, the other 2 have manual overrides).
- **Photos**: resized in the browser to a 1000 px JPEG plus a 320 px WebP thumbnail, uploaded under a unique name (`full/<line>/<code>-<random>.jpg`), 24 h cache, old files removed after a replacement.
- **Migrations 4 and 5** (run in the SQL editor): `audit_log` (triggers on fabrics and swatches; admin-read only; append-only), `swatch_order_count()` (admin), a `BEFORE DELETE` trigger that refuses to delete a swatch used by a saved order, and `swatch_display_names()` (anon; names for picks in orders saved before display names existed).
- **Tests**: `supabase/tests/live_tests.mjs` (23), `live_admin_tests.mjs` (temporary admin and non-admin, 56), `e2e_admin_browser.mjs` (headless Chromium at 390 px with a temporary admin session, 48). The audit_log entries those tests cause (row ids starting `zz-test` / `ZZE2E`) stay, by design.
- The service role has **no privileges on `orders`** in this project (created in the SQL editor), so tests create their temporary saved order as the temporary customer.
- `scripts/seed-catalog.mjs --apply` now refuses to run without `--overwrite-admin-edits`: it would reset every row to `archive/data/`.
- Step 7 is done: `src/data/*.json` catalog files, the old generators and the validator are in `archive/`; `selection.js` no longer imports `displayNames.json`; `/measure` no longer overflows at 390 px. Still to do: the old mock-admin CSS (`.admin-*` in `src/styles.css`) is unused and can be deleted.

## Status (updated after step 6)
Steps 1 to 6 are done on this branch; step 5's approval was given and the site now reads the catalog from Supabase. **Not merged. Steps 7 and 8 and the merge wait for approval.**

- Project `njhlhjdbcesidgixycxj` (confirmed as the live site's project). Preflight was all 0. Migrations 1 and 2 were run in the SQL editor (the pooler connection is blocked from the cloud session). **Migration 3** (`..._000003_service_role_grants.sql`) is also required: this project does not give `service_role` privileges on tables created in the SQL editor.
- Seed applied: 89 fabrics, 437 swatches (roller 133, zebra 88, shangri-la 21, cellular 33, dream-curtains 39, drapery 123), 886 images. `--verify` matches, and an anonymous visitor reads all 437.
- `supabase/tests/live_tests.mjs`: 23 live checks over HTTPS (three constraint refusals; anonymous and signed-in non-admin can read, cannot insert, update, delete, read admins or upload). It creates and deletes a temporary user.
- Site: each line page makes **one** request (`src/data/catalogQuery.js` is the single definition; the Drapery page also gets Dream Curtains). `index.html` starts that request before the app loads (Vite plugin in `vite.config.js`) and opens the connection the swatch images then share. Skeleton while loading; "Colors are temporarily unavailable" with a Try again button if it fails. The rest of the page stays usable.
- Rendering check: the old JSON build and the Supabase build produce byte-identical pickers (tile names, codes, filter chips, counts, grouping) for all 10 states of the six lines.
- Order email (`api/quote.js`): looks up every picked swatch by id with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and rebuilds the supplier code, display name, collection and color text from the catalog. A failed lookup, a missing key, or an unknown swatch falls back to the order as sent, so orders always arrive. The shared text logic moved to `src/lib/selectionText.js` (no imports, so Node can load it); `src/lib/selection.js` is the browser entry point.
- 390 px walkthrough: one item per line (double-stack Roller, Zebra, Shangri-La, Day & Night Cellular, Roman, Drapery curtains, Dream Curtains with Style B, Dream Curtains without styles) through to the `/api/quote` payload: every code, display name, supplier color and collection matched the original supplier data, and the customer text shows no collection name.
- **Fixed on the way (it was already in `main`):** the filter-chip row made every line page wider than a 390 px screen (611 px on Roller, 847 px on Cellular). The row is meant to scroll sideways; its grid parent now lets it.

### Lighthouse (mobile, performance; accessibility is 100 everywhere, in every run)
| Page | Handoff baseline | `49a1fda` built and run here | New build, Supabase replayed locally | New build, live Supabase from this sandbox |
|---|---|---|---|---|
| Home | 98 | 98 | 99 | 99 |
| Roller | 96 | 94 | 97 | 99 |
| Zebra | 99 | 97 | 97 | 90 |
| Shangri-La | 98 | 96 | 98 | 99 |
| Cellular | 98 | 96 | 97 | 99 |
| Roman | 95, 94, 94 | 92 | 92 | 87 |
| Drapery | 93, 93, 94 | 92 | 93 | 88 |

How to read it: the sandbox scores the old build 1 to 3 points under the handoff numbers, so the handoff table cannot be reproduced here. The last column goes through a slow proxy (each tiny request takes about 0.5 s) and varies run to run (Zebra 89 to 97). On Zebra, Roman and Drapery the first swatch picture is the Largest Contentful Paint element, and it waited for the catalog request. PageSpeed Insights on the first preview showed Zebra at 84 against 88 for the live site, which is why the edge endpoint below was added. **Re-measure the new preview with PageSpeed Insights (mobile); the "within 1 point" condition is still unproven here.**

### Edge-cached catalog (added after the first preview)
- `api/catalog.js` returns a line's fabrics and swatches (`GET /api/catalog?line=zebra`), the same JSON Supabase returns. The edge keeps it 60 s and may serve it once more while it refreshes (`Vercel-CDN-Cache-Control: max-age=60, stale-while-revalidate=300`; `Cache-Control: public, max-age=0, s-maxage=60`, so browsers always ask again). An admin change shows to the next visitor after the minute, or the one after. Errors are never cached.
- It reads with the **anon** key, so Row Level Security still hides inactive rows. It needs `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `VITE_SUPABASE_ANON_KEY` in the Vercel environment for functions.
- The early fetch in `index.html` and the line pages use it. If it fails they ask Supabase directly; if that fails too they show "Colors are temporarily unavailable". The edge answer was checked byte for byte against Supabase for all six lines.
- Preconnects: line pages have two (the font files, and the Supabase image host); other pages one. `public/robots.txt` now allows everything (it was the app's HTML before), and the catch-all rewrite in `vercel.json` skips `/robots.txt`.

### Open items
- **LCP regression ~0.7 s from swatch images on Supabase storage; consider serving thumbnails through a same-origin cached route during the redesign.** (Accepted for the merge. PageSpeed, mobile, Zebra, second run, preview `96f39a7`: 84 with LCP 3.7 s, against 88 and 3.0 s on the live site. SEO 100.)
- Preview deployments need `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set for the **Preview** environment in Vercel, not only Production. Without the first two the line pages show "Colors are temporarily unavailable".
- `loveblindswindows@gmail.com` is the only admin; its row binds when that account first signs in (it has not yet).
- (done) `displayNames.json` is no longer imported; old picks get their names from `swatch_display_names()`.
- (done) `/measure` fits 390 px.
- Old saved orders still point at `/images/swatches/...` for their thumbnails; keep `public/images/swatches/` until those are migrated or expired.

## Decisions (approved)
- Claude runs the migrations from a session, using `SUPABASE_DB_URL`. Before migrating, run `supabase/preflight.sql` (read-only). **If any count is not 0, stop and report.**
- The seed runs in the cloud session (`node scripts/seed-catalog.mjs --apply`).
- `grade`, `roman_styles`, `composition` and `width` live on `swatches` (they are per swatch in the supplier data). Dream Curtains style codes and images sit in `swatches.styles`.
- Only the two migration files are applied by a person or session; the Supabase GitHub integration is not connected, so pushing this branch changes nothing in the database.
- The spreadsheet keeps the layout from commit 49a1fda: original columns A to I, Supplier code and Display name in J and K.
- Future admin page: **"Hide" (`active = false`) is the main action; delete sits behind a confirmation.** Saved orders refer to swatch ids, and the database already refuses to change an id.

## Lighthouse baseline (mobile, local build of main at 49a1fda). Hold every page within 1 point of these.
| Page | Performance (runs) | Accessibility |
|---|---|---|
| Home | 98 | 100 |
| Roller | 96 | 100 |
| Zebra | 99 | 100 |
| Shangri-La | 98 | 100 |
| Cellular | 98 | 100 |
| Roman | 95, 94, 94 | 100 |
| Drapery | 93, 93, 94 | 100 |

## Secrets and domains (add in the cloud environment, then start a new session)
Environment variables (the scripts read `process.env`; if the UI only offers "Network secrets", use the same names):
| Name | What | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | server side |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | server side only, never `VITE_` |
| `SUPABASE_DB_URL` | Postgres connection string | use the **Session pooler** string (host `aws-0-<region>.pooler.supabase.com`, port 5432, user `postgres.<project-ref>`); the direct `db.<project-ref>.supabase.co` host is IPv6 only |
| `VITE_SUPABASE_URL` | same value as `SUPABASE_URL` | public; the site build reads it |
| `VITE_SUPABASE_ANON_KEY` | anon (public) key | public; the site build and the security tests read it |

Allowed domains (Network access, keep "Allow package managers" ticked):
- `<project-ref>.supabase.co` (API, auth, storage)
- `<project-ref>.storage.supabase.co` (uploads; newer clients use this host)
- the pooler host from `SUPABASE_DB_URL`, for example `aws-0-<region>.pooler.supabase.com`
- `db.<project-ref>.supabase.co` only if you use the direct connection string

Vercel (Project Settings, Environment Variables), before the site switch: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, server side only. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` should already exist.

## Order of work for the next session
1. `psql "$SUPABASE_DB_URL" -f supabase/preflight.sql`. Stop if anything is not 0.
2. Apply `supabase/migrations/20261011000001_catalog_schema.sql`, then `..._000002_catalog_security.sql`, each with `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 -f <file>`.
3. `node scripts/seed-catalog.mjs` (dry run), then `--apply`, then `--verify`. Counts must be roller 133, zebra 88, shangri-la 21, cellular 33, dream-curtains 39, drapery 123 (fabrics 89, swatches 437).
4. Security tests against the live project, with real requests: the three constraint failures (duplicate name in scope, name with a digit, duplicate supplier code), and anonymous plus signed-in non-admin read (works) and insert/update/delete (refused). The non-admin is a temporary test user created with the service role key and deleted afterwards.
5. **Stop and show the counts and test results. Do not switch the site over until approved.**
6. Site changes: read catalog from Supabase (one fetch per line per page load, skeleton grid, "Colors are temporarily unavailable" fallback), line pages, filters, larger view, order summary, My Orders, and both emails (server side lookup in `api/quote.js` with a fallback to the order payload so orders always arrive). Early fetch and preconnect to the Supabase host for Lighthouse.
7. Archive the old JSON in `archive/`, remove the old generators, validators, review sheets and npm scripts, keep the color-family image analysis as a reusable function.
8. Lighthouse against the baseline (within 1 point on every page), walkthrough at 390 px with one item per line to the order email payload, then merge only after approval.

## Local test database (already proven)
`supabase/tests/00_local_supabase_stubs.sql` plus both migrations plus `10_catalog_tests.sql` run against a throwaway Postgres. Never run the stubs against a real project.

## Known data note
Dream Curtains Sunflower -17 and -42 have no separate Style B photo in the supplier package; Style B reuses the Style A image until a real one is uploaded.
