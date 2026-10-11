-- Change history: who changed which row, when, with before and after values.
-- Written only by triggers (security definer), so no client role can add, edit or erase entries.
-- Readable by admins only. Phase 2 attaches the same trigger function to the product-option tables.

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,                 -- auth user; null when the change came from the service role or the SQL editor
  actor_email text,
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_row     jsonb,
  new_row     jsonb
);
create index audit_log_row_idx on public.audit_log (table_name, row_id, at desc);
create index audit_log_at_idx  on public.audit_log (at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;       -- still gated by the policy below
grant select on public.audit_log to service_role;        -- read only, for tests; it cannot write either
create policy "admins read the audit log" on public.audit_log
  for select to authenticated using (public.is_admin());

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb;
  n jsonb;
begin
  if tg_op in ('UPDATE','DELETE') then o := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then n := to_jsonb(new); end if;
  -- a save that changed nothing but updated_at is not a change
  if tg_op = 'UPDATE' and (o - 'updated_at') = (n - 'updated_at') then return null; end if;
  insert into public.audit_log (actor_id, actor_email, table_name, row_id, action, old_row, new_row)
  values (
    auth.uid(),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    tg_table_name,
    coalesce(n ->> 'id', o ->> 'id'),
    tg_op, o, n
  );
  return null;
end $$;
revoke all on function public.audit_row_change() from public, anon, authenticated;

create trigger fabrics_audit  after insert or update or delete on public.fabrics
  for each row execute function public.audit_row_change();
create trigger swatches_audit after insert or update or delete on public.swatches
  for each row execute function public.audit_row_change();
