-- Local tests for migration 13 (messages, rate limits, size limits, read-only sent orders).
-- Run in a throwaway database after the stubs, migrations 1 to 7, 9, 10, 11, a stub public.orders table with the migration 12
-- column (customer jsonb), and migration 13 (twice, to show it re-runs). Every check raises an error when it fails.
\set ON_ERROR_STOP on
\set VERBOSITY terse
\pset pager off
\pset tuples_only on

-- fixtures: an admin, a plain customer, a product line, a grid
insert into auth.users (id, email, email_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.com', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'cust@example.com', now());
insert into public.admins (email, user_id) values ('admin@example.com', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.product_lines (id, name, sort_order) values ('roller', 'Roller', 0) on conflict (id) do nothing;
insert into public.pricing_lines (id, name, markup, roll_rule) values ('roller', 'Roller', 0.5, 'either'), ('zebra', 'Zebra', 0.5, 'either')
  on conflict (id) do nothing;
insert into public.price_grids (grid_key, line_id, systems, variant, scope, label, rows_are, row_axis, col_axis, cost)
values ('t-roller-1', 'roller', '{cord}', 'all', 'fabric', 'g1', 'width', '{23,24,25}', '{24,32,40}', array[1,1,1,1,1,1,1,1,1]::numeric[]),
       ('t-roller-2', 'roller', '{motor}', 'all', 'fabric', 'g2', 'width', '{30,60,118}', '{24,120}', array[1,1,1,1,1,1]::numeric[]);

do $$ declare n int; ok boolean; begin
  -- ---------- messages ----------
  insert into public.messages (name, email, message) values ('Ada', 'ada@example.com', 'Hello');
  begin insert into public.messages (name, email, message) values ('', 'a@b.c', 'x'); raise exception 'empty name accepted'; exception when check_violation then null; end;
  begin insert into public.messages (name, email, message, status) values ('A', 'a@b.c', 'x', 'weird'); raise exception 'bad status accepted'; exception when check_violation then null; end;
  begin insert into public.messages (name, email, message) values ('A', 'a@b.c', repeat('x', 5001)); raise exception 'huge message accepted'; exception when check_violation then null; end;
  raise notice 'PASS messages: constraints';
end $$;

set role anon;
do $$ begin
  begin perform 1 from public.messages; raise exception 'anon can read messages'; exception when insufficient_privilege then null; end;
  begin insert into public.messages (name, email, message) values ('A', 'a@b.c', 'x'); raise exception 'anon can insert messages'; exception when insufficient_privilege then null; end;
  raise notice 'PASS messages: the public can neither read nor write';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
do $$ declare n int; begin
  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'a customer can read messages (%)', n; end if;
  begin insert into public.messages (name, email, message) values ('A', 'a@b.c', 'x'); raise exception 'a customer can insert messages'; exception when insufficient_privilege then null; end;
  update public.messages set status = 'read'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'a customer can update messages'; end if;
  raise notice 'PASS messages: a signed-in customer sees and changes nothing';
end $$;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ declare n int; begin
  select count(*) into n from public.messages;
  if n <> 1 then raise exception 'admin cannot read messages (%)', n; end if;
  update public.messages set status = 'replied'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'admin cannot update status'; end if;
  begin insert into public.messages (name, email, message) values ('A', 'a@b.c', 'x'); raise exception 'admin insert allowed from the browser'; exception when insufficient_privilege then null; end;
  raise notice 'PASS messages: an admin reads and updates (the site itself writes through the server)';
end $$;
reset role;

-- ---------- rate limits ----------
do $$ declare a boolean; b boolean; c boolean; d boolean; begin
  a := public.rate_limit_hit('t:ip1', 3, 3600); b := public.rate_limit_hit('t:ip1', 3, 3600); c := public.rate_limit_hit('t:ip1', 3, 3600); d := public.rate_limit_hit('t:ip1', 3, 3600);
  if not (a and b and c) or d then raise exception 'limit 3: got %,%,%,%', a, b, c, d; end if;
  if not public.rate_limit_hit('t:ip2', 3, 3600) then raise exception 'a different key shares the count'; end if;
  raise notice 'PASS rate limit: three allowed, the fourth refused, other keys unaffected';
end $$;
set role anon;
do $$ begin begin perform public.rate_limit_hit('x', 1, 60); raise exception 'anon can call rate_limit_hit'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.rate_limits; raise exception 'anon can read rate_limits'; exception when insufficient_privilege then null; end;
  raise notice 'PASS rate limit: not callable or readable by the public'; end $$;
reset role;

-- ---------- size limits ----------
do $$ declare r jsonb; begin
  r := public.size_limits('roller', '{}');
  if (r->>'min_width')::numeric <> 23 or (r->>'max_width')::numeric <> 118 or (r->>'min_height')::numeric <> 24 or (r->>'max_height')::numeric <> 120 or r->>'source' <> 'grid'
    then raise exception 'grid fallback wrong: %', r; end if;
  r := public.size_limits('curtains-nothing', '{}');
  if r->>'min_width' is not null or r->>'source' <> 'none' then raise exception 'a line with no rule or grid must have no limits: %', r; end if;
  -- an unverified rule is ignored
  insert into public.size_rules (line_id, subject, min_width, max_width, verified) values ('roller'::text, 'draft rule', 30, 100, false);
  r := public.size_limits('roller', '{}');
  if (r->>'min_width')::numeric <> 23 then raise exception 'unverified rule used: %', r; end if;
  raise notice 'PASS size limits: grid fallback, nothing for lines without sizes, unverified rules ignored';
end $$;
do $$ declare r jsonb; begin
  insert into public.size_rules (line_id, subject, min_width, max_width, verified) values ('roller', 'verified rule', 30, null, true);
  r := public.size_limits('roller', '{}');
  if (r->>'min_width')::numeric <> 30 or (r->>'max_width')::numeric <> 118 then raise exception 'rule + grid mix wrong: %', r; end if;
  insert into public.size_rules (line_id, subject, when_values, min_width, verified) values ('roller', 'motor rule', '{"control":["remote"]}', 40, true);
  r := public.size_limits('roller', '{"control":"remote"}');
  if (r->>'min_width')::numeric <> 40 then raise exception 'the more specific rule must win: %', r; end if;
  r := public.size_limits('roller', '{"control":"chain"}');
  if (r->>'min_width')::numeric <> 30 then raise exception 'a rule for another control must not apply: %', r; end if;
  raise notice 'PASS size limits: a verified rule wins over the grid, the most specific rule wins, rules for other options do not apply';
end $$;
set role anon;
do $$ declare r jsonb; begin r := public.size_limits('roller', '{}'); if jsonb_typeof(r) <> 'object' then raise exception 'anon cannot call size_limits'; end if;
  if (select string_agg(k, ',' order by k) from jsonb_object_keys(r) k) <> 'max_height,max_width,min_height,min_width,source' then raise exception 'size_limits leaks more than four numbers: %', r; end if;
  raise notice 'PASS size limits: the public gets four numbers and a source label'; end $$;
reset role;

-- ---------- sent orders are read-only ----------
insert into public.orders (id, user_id, name, items, status) values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Order 1', '[{"qty":1}]', 'draft');
do $$ begin
  update public.orders set items = '[{"qty":2}]' where id = 'cccccccc-0000-0000-0000-000000000001';
  update public.orders set status = 'sent', items = '[{"qty":3}]', customer = '{"name":"Ada"}' where id = 'cccccccc-0000-0000-0000-000000000001';
  raise notice 'PASS orders: a draft can be edited and then sent (items, customer and status in one update)';
  begin update public.orders set items = '[]' where id = 'cccccccc-0000-0000-0000-000000000001'; raise exception 'sent items changed'; exception when check_violation then null; end;
  begin update public.orders set customer = '{}' where id = 'cccccccc-0000-0000-0000-000000000001'; raise exception 'sent customer changed'; exception when check_violation then null; end;
  begin update public.orders set status = 'draft' where id = 'cccccccc-0000-0000-0000-000000000001'; raise exception 'sent order reopened'; exception when check_violation then null; end;
  begin update public.orders set user_id = 'aaaaaaaa-0000-0000-0000-000000000001' where id = 'cccccccc-0000-0000-0000-000000000001'; raise exception 'sent order moved'; exception when check_violation then null; end;
  update public.orders set name = 'Kitchen blinds' where id = 'cccccccc-0000-0000-0000-000000000001';
  raise notice 'PASS orders: a sent order refuses new items, details, reopening and a new owner, but can be renamed';
end $$;
\echo ALL LOCAL CHECKS DONE
