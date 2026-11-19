-- Member directory: run once in the Supabase dashboard (SQL Editor > New query).
-- See README.md, "Member directory".

-- A private bucket for the directory file (not publicly readable).
insert into storage.buckets (id, name, public)
values ('members', 'members', false)
on conflict (id) do nothing;

-- Only signed-in members can download from it. Sign-ups are turned off, so the
-- only people who can sign in are the ones added under Authentication > Users.
create policy "Members can download the directory"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'members');

-- A one-row table that .github/workflows/supabase-keepalive.yml reads twice a
-- week, because Supabase pauses free projects after a week without activity.
create table if not exists public.keepalive (id int primary key);
insert into public.keepalive (id) values (1) on conflict do nothing;
alter table public.keepalive enable row level security;
create policy "Anyone can read the keepalive row"
  on public.keepalive for select
  to anon
  using (true);
grant select on public.keepalive to anon;
