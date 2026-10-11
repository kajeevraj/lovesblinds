# Archive

Kept for reference and for `scripts/seed-catalog.mjs`, which can rebuild the catalog in Supabase from `archive/data/`.
**Nothing here is used by the site or its build.** The live catalog is in Supabase and is edited at `/admin`.

- `data/`: the old catalog JSON (swatches, color families and overrides, display names).
- `scripts/`: the old generators, validator, color review sheet and one-off migrations that worked on that JSON. They expect the
  JSON in `src/data/` and will not run from here without moving it back.

`public/images/swatches/` stays in place: saved orders from before the move still point at those thumbnails.

**Warning:** `node scripts/seed-catalog.mjs --apply` writes every row back to this archived data, which undoes changes made
in `/admin`. It refuses to run without `--overwrite-admin-edits`. Use it only to rebuild an empty or damaged catalog.
