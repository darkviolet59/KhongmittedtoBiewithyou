-- =====================================================================
--  US couple app — FULL Supabase setup
--  Paste this whole thing into Supabase - SQL Editor - New query - Run.
--  Safe to run again anytime: it only creates what's missing.
-- =====================================================================

-- ---------- Tables ----------
create table if not exists photos (
  id text primary key,
  caption text default '',
  album_id text,
  created_at bigint,
  taken_at bigint,
  path text,
  owner_email text,
  lat double precision,
  lon double precision,
  place text
);
create table if not exists albums (
  id text primary key,
  name text,
  created_at bigint
);
create table if not exists events (
  id text primary key,
  title text,
  date text,
  emoji text,
  repeat text,
  created_at bigint
);
create table if not exists notes (
  id text primary key,
  title text,
  text text,
  note_date text,
  pinned boolean default false,
  created_at bigint,
  owner_email text
);
create table if not exists messages (
  id text primary key,
  text text,
  image text,
  created_at bigint,
  sender_email text
);
create table if not exists todos (
  id text primary key,
  text text,
  done boolean default false,
  created_at bigint,
  owner_email text
);
create table if not exists kv (
  key text primary key,
  value jsonb
);

-- Make sure the newer photo columns exist (in case the table was already there)
alter table photos add column if not exists taken_at bigint;
alter table photos add column if not exists owner_email text;
alter table photos add column if not exists lat double precision;
alter table photos add column if not exists lon double precision;
alter table photos add column if not exists place text;
alter table notes add column if not exists title text;
alter table notes add column if not exists note_date text;
alter table messages add column if not exists image text;
alter table albums add column if not exists cover_id text;
alter table photos add column if not exists fp text;

-- ---------- Security: only signed-in users can read/write ----------
alter table photos   enable row level security;
alter table albums   enable row level security;
alter table events   enable row level security;
alter table notes    enable row level security;
alter table messages enable row level security;
alter table todos    enable row level security;
alter table kv       enable row level security;

drop policy if exists "auth photos"   on photos;
drop policy if exists "auth albums"   on albums;
drop policy if exists "auth events"   on events;
drop policy if exists "auth notes"    on notes;
drop policy if exists "auth messages" on messages;
drop policy if exists "auth todos"    on todos;
drop policy if exists "auth kv"       on kv;

create policy "auth photos"   on photos   for all to authenticated using (true) with check (true);
create policy "auth albums"   on albums   for all to authenticated using (true) with check (true);
create policy "auth events"   on events   for all to authenticated using (true) with check (true);
create policy "auth notes"    on notes    for all to authenticated using (true) with check (true);
create policy "auth messages" on messages for all to authenticated using (true) with check (true);
create policy "auth todos"    on todos    for all to authenticated using (true) with check (true);
create policy "auth kv"       on kv       for all to authenticated using (true) with check (true);

-- ---------- Photo storage (private bucket) ----------
insert into storage.buckets (id, name, public)
values ('photos','photos', false)
on conflict (id) do nothing;

drop policy if exists "auth read"          on storage.objects;
drop policy if exists "auth write"         on storage.objects;
drop policy if exists "auth delete"        on storage.objects;
drop policy if exists "auth storage read"  on storage.objects;
drop policy if exists "auth storage write" on storage.objects;
drop policy if exists "auth storage delete" on storage.objects;

create policy "auth storage read"   on storage.objects for select to authenticated using (bucket_id = 'photos');
create policy "auth storage write"  on storage.objects for insert to authenticated with check (bucket_id = 'photos');
create policy "auth storage delete" on storage.objects for delete to authenticated using (bucket_id = 'photos');

-- ---------- Live sync (both phones update automatically) ----------
do $$
declare t text;
begin
  foreach t in array array['photos','albums','events','notes','messages','todos','kv'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when others then null;
    end;
  end loop;
end $$;

-- Done! You should see "Success. No rows returned".
