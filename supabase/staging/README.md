# Rebuilding the staging project without a direct Postgres connection

`node scripts/staging-setup.mjs` is the normal way to build staging, but it needs a direct Postgres connection (`STAGING_DB_URL`, port 5432). Where that port
is closed (for example the cloud sandbox), build staging with the SQL editor plus an HTTPS data copy instead. Staging must be a **separate** project from live.
Needs these environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (live, only read), `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`.

Starting from a new, empty project:

1. **Schema, part 1.** Paste `build-staging-1-of-2.sql` into staging's SQL editor and run it once. It creates the hand-made `orders` table and applies migrations 1 to 11.
2. **Data, pass 1.** `node scripts/staging-copy-data.mjs pass1` copies the 13 catalog and price tables that exist so far. Migration 17 onward inserts rows that need their
   parent option and line rows, so this must happen before part 2.
3. **Schema, part 2.** Paste and run `part2/12.sql`, `13.sql`, ... up to the last file, one at a time, in order (`build-staging-2-of-2.sql` is the same text in one file, for
   a single paste). Every file is safe to run more than once.
4. **Data, pass 2.** `node scripts/staging-copy-data.mjs pass2` copies all 16 tables again, exactly as live, now including the columns and tables that part 2 added.
5. **Check.** `node scripts/staging-diff-data.mjs` should print `all 16 tables identical to live`.
6. **Tests.** `node scripts/run-tests.mjs`: writing tests on staging, read-only checks on live.

After a test run, step 5 shows whether staging still matches live; step 4 puts it right again if not.

## Notes

- **No customer data** is copied: no orders, sent orders, messages, rate limits, users, admins or audit history. Live is only read (GET requests).
- **The SQL files are generated** from `supabase/staging/prelude.sql` and `supabase/migrations/`. A new migration needs its own `part2/NN.sql` here.
  They differ from the migrations in two ways, both because the Supabase SQL editor reads the SQL itself: full-line `--` comments are removed, and phrases like
  `into the` / `from the` inside text values are split as `'...into' || ' the ...'` (same value). Unsplit, the editor reads `into the` as a table name
  (`relation "the" does not exist`).
- **The audit log** on staging gains rows during the copy, because REST cannot switch off the audit triggers. It does not matter on staging.
- **Grants:** `grants-report.sql` is a read-only query listing every public table's privileges for `anon`, `authenticated` and `service_role`. Run it on live and on
  staging and compare, to catch differences that no migration records (migration 22 records one of them).
