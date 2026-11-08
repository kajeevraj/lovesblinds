# Which tests write to the database, and what they may touch

Rule: a test may only change **rows, files and users it created itself in that run**, and removes them again. It never edits, toggles or deletes an existing row.
`supabase/tests/lib/liveGuard.mjs` enforces it for every request (Node and browser); a breach stops the test with `LIVE GUARD: ...` and the request is not sent.
Which project each test runs against is in `supabase/tests/targets.json` (`node scripts/run-tests.mjs --list`); the setup of the staging project is in `docs/staging-setup.md`.

## Runs against live (reads only, 0 writes): measured with the guard
api_catalog_tests, e2e_cart, e2e_customer_price, e2e_fabric_look, e2e_google, e2e_hub, e2e_hub_account, e2e_item_photos, e2e_layout, e2e_line_pages, e2e_motor_options,
e2e_order_page, e2e_picker_color, e2e_pr1, e2e_preview, e2e_product_update, e2e_remotes, e2e_review.
(The runner fails a test listed here if it makes a single write.)

## Runs against staging (creates and removes its own rows)
| Test | What it creates (and removes) | Rewritten? |
|---|---|---|
| live_admin_tests | a test price group and colors, a test order, a temporary admin and customer, uploaded images | clean-up check now looks at its own rows only |
| live_links_tests | test colors, a temporary admin | no |
| live_migration13_tests | a test message, test user and orders, rate-limit counters | registers its tag and the hashes of its test address; counters removed |
| live_migration14_tests | a test sent order (made through the real order handler) | **rewritten**: a temporary admin now removes the order (it used to stay behind); counters removed |
| live_migration20_tests | a test customer and order | shared-row edits (Best value / Top of the line, curtain tiers, shipping rate, hub price) moved behind `guard.sharedRows` (staging only) |
| live_orders_admin_tests | test sent orders, temporary admin and customer | **rewritten**: removes its rows by id, no longer sweeps other `zz-` rows by name |
| live_pricing_tests | its own product line, pricing line, adder, flag, option group/value, price groups, collection markup, size rule, picture | **rewritten**: the refusal checks (a visitor changing a price, adder, option, flag, line, markup) now aim at rows it creates; edits of real prices (line markup, collection markup, Dream motor cost, a real color's extra cost / hiding, a second default) moved behind `guard.sharedRows` |
| live_tests | its own hidden price group and color, a test user | **rewritten**: the edit/delete attempts by visitors now aim at its own color and group, not a real one |
| e2e_admin_browser | test colors, a test price group (new name every run), their images, a temporary admin | **rewritten**: owns the names it types; removes only the files it uploaded; clicks "Show" on its own row (it used to click the first "Show" in the list, which un-hid SP26030004 on live) |
| e2e_admin_orders | test sent orders, temporary admin | owns its tag; quantity change undone as the admin |
| e2e_admin_pricing_browser | a test option (with picture), a test size rule, temporary admin | **rewritten**: the explanation edit now happens on the option the test just made (it edited a real Zebra option and put it back) |
| e2e_admin_preview_color | a temporary admin (the swatch update itself is intercepted) | moved from read-only to writers (it creates a user) |
| e2e_price_groups_per_line | a test color, price group, temporary admin | no |
| e2e_profile_menu, e2e_round3, e2e_signin_merge, e2e_pr2, e2e_pr3 | temporary customers and their orders | no |

## Measured write counts (guard summary of the last full run, all with 0 violations)
e2e_admin_browser 52, e2e_admin_orders 15, e2e_admin_preview_color 4, e2e_admin_pricing_browser 14, e2e_pr2 3, e2e_pr3 4, e2e_price_groups_per_line 8, e2e_profile_menu 12,
e2e_round3 5, e2e_signin_merge 7, live_admin_tests 45, live_links_tests 34, live_migration13_tests 26, live_migration14_tests 14, live_migration20_tests 7,
live_orders_admin_tests 19, live_pricing_tests 82, live_tests 19. Everything else: 0.

## Leftovers from before
Older versions of these tests (and the audit runs of today, which the guard cut off half-way) left test rows behind on live: `scripts/cleanup-test-leftovers.mjs` lists them
(names start with `zz-` / `zze2e`) and removes them only with `--delete --expect <the agreed counts>`.
