# A separate test project (staging)

**Why.** Some of our tests create things (a test color, a test order, a test price group) and remove them again. They must never do that on the real
store. So they run on a second, empty copy of the store called *staging*: the same tables and rules, a copy of the prices and colors, and no customers.
The real store only gets read-only checks.

You make the second project once (about 15 minutes). After that you do nothing: I rebuild it when a new migration goes live.

---

## Part 1: make the project (you, in your browser)

1. Open **https://supabase.com/dashboard** and sign in (the same account as the real store).
2. Click **New project**.
3. Fill in:
   - **Organization:** the same one the real store is in.
   - **Name:** `lovesblinds-staging`
   - **Database password:** click **Generate a password**, then **copy it somewhere safe** (a password manager or a note on your computer). You cannot see it again.
   - **Region:** **Canada (Central)**, the same as the real store. *(This matters: the place where I work can only reach that region's database server.)*
   - **Plan:** Free is fine.
4. Click **Create new project** and wait about 2 minutes until the page says the project is ready.

## Part 2: collect four values (you)

All four are labels with a value. You will paste them in Part 3, **not into the chat**.

1. **Project URL.** In the new project open **Project Settings** (the gear at the bottom left), then **API** (or **Data API**). Copy **Project URL**. It looks like
   `https://abcdefghijklmnop.supabase.co`.
2. **anon key.** Same page, **Project API keys**: copy the key labelled **anon** / **public**.
3. **service_role key.** Same place: click **Reveal** next to **service_role** and copy it. *(This one is powerful: treat it like a password.)*
4. **Database connection string.** Click the green **Connect** button at the top of the page, open the **Session pooler** tab (not "Direct connection"), and copy the
   **URI**. It looks like `postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-ca-central-1.pooler.supabase.com:5432/postgres`.
   Replace `[YOUR-PASSWORD]` (including the square brackets) with the database password from Part 1.

## Part 3: give the values to me (you, once)

The values go into the settings of the environment I run in, not into the chat:

1. In Claude Code, open the **cloud environment menu in the title bar** of the session and choose **Edit** (the environment is called *Love's Blinds Cloud Env*).
2. Under **Environment variables** add these four, one by one (the name on the left, your value on the right):

   | Name | Value |
   |---|---|
   | `STAGING_SUPABASE_URL` | the Project URL (item 1) |
   | `STAGING_SUPABASE_ANON_KEY` | the anon key (item 2) |
   | `STAGING_SUPABASE_SERVICE_ROLE_KEY` | the service_role key (item 3) |
   | `STAGING_DB_URL` | the connection string with the password filled in (item 4) |

3. Save, then **start a new session** (a running session does not see new variables) and write: *"staging is ready"*.

You do not need to change the network settings: `*.supabase.co` and the Canada (Central) database server are already allowed. If you chose another region in Part 1, tell me and
I will say exactly which server name to add.

## Part 4: what I do next

1. `node scripts/staging-setup.mjs` builds staging: the migrations in order, then a copy of the catalog and price tables read from the real store (nothing is written
   there). It refuses to run if the staging settings point at the real store.
2. `node scripts/run-tests.mjs` runs everything: the read-only checks against the real store, the writing tests against staging.
3. I report the results.

## Day to day

| What | Command |
|---|---|
| Everything (read-only checks on the real store, writing tests on staging) | `node scripts/run-tests.mjs` |
| Only what needs no staging | `node scripts/run-tests.mjs --skip-writes` |
| One or two tests | `node scripts/run-tests.mjs --only live_tests,e2e_cart` |
| Rebuild staging after a new migration or after prices changed on the real store | `node scripts/staging-setup.mjs` |
| Which test runs where | `node scripts/run-tests.mjs --list` (the lists live in `supabase/tests/targets.json`) |

- A test file run directly (`node supabase/tests/live_tests.mjs`) behaves the same way: a writing test goes to staging by itself when the settings exist, and **stops with a message**
  if they do not. It never writes to the real store by accident.
- **Free projects pause after a week without use.** If a staging run says it cannot connect, open the project in the dashboard and click **Restore project**, then run again.
- Staging holds no customer data: no orders, no messages, no real accounts. The prices and colors in it are a copy; changing them there changes nothing on the real store.

## The write guard (what protects the real store)

Every test that talks to Supabase loads `supabase/tests/lib/liveGuard.mjs` first. It checks every request:

- A test may only change **rows, files and users it created itself in that run**, and has to remove them again. A change to anything else stops the test with
  `LIVE GUARD: ...` (the request is not sent) and the run fails.
- Tests that need to edit a *real* price, option or color are split: that part runs on staging only and is skipped against the real store.
- It also stops a page from writing to a different Supabase project than the test aims at (a site built for the real store while the test aims at staging, or the other way round).
- `node supabase/tests/guard_tests.mjs` proves all of this without any network.
