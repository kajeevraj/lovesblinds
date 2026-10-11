# Catalog to Supabase: handoff

Branch: `claude/modest-meitner-r3crhf`. `main` is untouched.

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

How to read it: the sandbox scores the old build 1 to 3 points under the handoff numbers, so the handoff table cannot be reproduced here. The last column goes through a slow proxy (each tiny request takes about 0.5 s), which inflates anything that has to wait for a remote request; the replay column removes that but is optimistic (plain HTTP, no handshake). On Zebra, Roman and Drapery the first swatch picture is the Largest Contentful Paint element, and it now waits for the catalog request. **The condition "within 1 point of the baseline" is not proven for Zebra, Roman and Drapery.** Measure the Vercel preview (for example PageSpeed Insights, mobile) before merging. If those three come up short, the fix to consider is a small Vercel function that returns the line's catalog from the edge cache (same origin, so no extra connection), at the price of a short delay before admin changes show.

### Open items
- Preview deployments need `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set for the **Preview** environment in Vercel, not only Production. Without the first two the line pages show "Colors are temporarily unavailable".
- `loveblindswindows@gmail.com` is the only admin; its row binds when that account first signs in (it has not yet).
- `src/data/displayNames.json` is still imported by `src/lib/selection.js` (names for orders saved before display names existed). Step 7 must replace that before the file moves to `archive/`.
- `/measure` is wider than 390 px (a button, 435 px). Not touched; it is outside this change.
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
