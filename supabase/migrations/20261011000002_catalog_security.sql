-- Security for the catalog: Row Level Security on every table, public read of active rows only,
-- writes only by listed admins, and a public-read / admin-write storage bucket.
-- The service role key bypasses RLS by design; it is used only by the one-time seed script and server-side code,
-- and must never be given a VITE_ prefix or reach the browser.

-- ---------------------------------------------------------------------------------------------
-- Table privileges: start from nothing, then grant only what is needed. RLS decides which rows.
-- ---------------------------------------------------------------------------------------------
revoke all on public.fabrics, public.swatches, public.admins from anon, authenticated;
grant select on public.fabrics, public.swatches to anon, authenticated;
grant insert, update, delete on public.fabrics, public.swatches to authenticated;   -- still gated by the policies below
grant select on public.admins to authenticated;                                      -- own row only (policy below)

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.fabrics  enable row level security;
alter table public.swatches enable row level security;
alter table public.admins   enable row level security;

-- fabrics ------------------------------------------------------------------------------------
create policy "anyone reads active fabrics" on public.fabrics
  for select to anon, authenticated using (active);
create policy "admins read all fabrics" on public.fabrics
  for select to authenticated using (public.is_admin());
create policy "admins insert fabrics" on public.fabrics
  for insert to authenticated with check (public.is_admin());
create policy "admins update fabrics" on public.fabrics
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete fabrics" on public.fabrics
  for delete to authenticated using (public.is_admin());

-- swatches (a swatch is public only while it and its fabric are active) --------------------------
create policy "anyone reads active swatches" on public.swatches
  for select to anon, authenticated
  using (active and exists (select 1 from public.fabrics f where f.id = fabric_id and f.active));
create policy "admins read all swatches" on public.swatches
  for select to authenticated using (public.is_admin());
create policy "admins insert swatches" on public.swatches
  for insert to authenticated with check (public.is_admin());
create policy "admins update swatches" on public.swatches
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete swatches" on public.swatches
  for delete to authenticated using (public.is_admin());

-- admins: a signed-in user may see only their own row (so the site can tell whether to show the admin page).
-- No insert, update or delete policy exists, so only the service role or the SQL editor can change the list.
create policy "a user reads their own admin row" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Admin list: seed the owner and bind accounts to rows.
-- A row binds to an auth user only when that user's email is confirmed (Google sign-in confirms it),
-- so someone who merely signs up with an admin's address cannot become an admin.
-- ---------------------------------------------------------------------------------------------
insert into public.admins (email) values ('loveblindswindows@gmail.com')
on conflict (email) do nothing;

-- bind an account that already exists
update public.admins a
   set user_id = u.id
  from auth.users u
 where a.user_id is null
   and lower(u.email) = a.email
   and u.email_confirmed_at is not null;

create or replace function public.bind_admin_to_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and new.email_confirmed_at is not null then
    update public.admins set user_id = new.id
     where user_id is null and email = lower(new.email);
  end if;
  return new;
end $$;

drop trigger if exists bind_admin_on_signup on auth.users;
create trigger bind_admin_on_signup
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.bind_admin_to_user();

-- ---------------------------------------------------------------------------------------------
-- Storage: bucket "swatches", public read, writes only by admins
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('swatches', 'swatches', true, 5242880, array['image/jpeg','image/webp','image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "swatch images are public" on storage.objects
  for select to anon, authenticated using (bucket_id = 'swatches');
create policy "admins upload swatch images" on storage.objects
  for insert to authenticated with check (bucket_id = 'swatches' and public.is_admin());
create policy "admins replace swatch images" on storage.objects
  for update to authenticated
  using (bucket_id = 'swatches' and public.is_admin())
  with check (bucket_id = 'swatches' and public.is_admin());
create policy "admins delete swatch images" on storage.objects
  for delete to authenticated using (bucket_id = 'swatches' and public.is_admin());
