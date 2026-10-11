# Catalog to Supabase: handoff

Branch: `claude/modest-meitner-r3crhf`. Nothing here has run against the live database. `main` is untouched.

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
