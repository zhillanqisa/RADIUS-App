-- RADIUS - skema Supabase awal.
-- Jalankan di Supabase SQL Editor (atau `supabase db push`).
--
-- Berisi:
--   analysis_cache   : cache hasil analisis (ditulis backend via service key).
--   profiles         : profil per user (1:1 auth.users).
--   saved_locations  : lokasi tersimpan milik user.
--   analysis_history : riwayat analisis milik user.
-- RLS aktif: user hanya bisa baca/tulis datanya sendiri. analysis_cache
-- publik untuk dibaca (hasil bukan data pribadi), tapi hanya service key
-- (backend) yang boleh menulis.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- analysis_cache: hasil analisis, dibagi semua user.
-- ---------------------------------------------------------------------------
create table if not exists public.analysis_cache (
  id         uuid primary key default gen_random_uuid(),
  cache_key  text unique not null,          -- "<lat>_<lon>_<minutes>"
  lat        double precision not null,
  lon        double precision not null,
  minutes    integer not null,
  payload    jsonb not null,                -- skor, breakdown, isochrone, pois
  pinned     boolean not null default false,-- pinned = tidak pernah kadaluarsa
  stored_at  timestamptz not null default now()
);
create index if not exists analysis_cache_key_idx on public.analysis_cache (cache_key);

alter table public.analysis_cache enable row level security;

-- Siapa pun (termasuk anon) boleh MEMBACA hasil cache.
drop policy if exists "analysis_cache read" on public.analysis_cache;
create policy "analysis_cache read"
  on public.analysis_cache for select
  using (true);
-- Tidak ada policy insert/update untuk anon/authenticated => hanya service
-- key (yang mem-bypass RLS) yang boleh menulis. Ini yang kita mau.

-- ---------------------------------------------------------------------------
-- profiles: 1:1 dengan auth.users.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles owner" on public.profiles;
create policy "profiles owner"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-buat profil saat user daftar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- saved_locations: lokasi favorit milik user.
-- ---------------------------------------------------------------------------
create table if not exists public.saved_locations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null,
  lat        double precision not null,
  lon        double precision not null,
  minutes    integer not null default 15,
  rent       integer,                       -- sewa bulanan (opsional, buat kalkulator biaya)
  score      numeric,                       -- snapshot skor terakhir
  created_at timestamptz not null default now()
);
create index if not exists saved_locations_user_idx on public.saved_locations (user_id);
alter table public.saved_locations enable row level security;

drop policy if exists "saved_locations owner" on public.saved_locations;
create policy "saved_locations owner"
  on public.saved_locations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- analysis_history: jejak analisis yang dijalankan user.
-- ---------------------------------------------------------------------------
create table if not exists public.analysis_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text,
  lat        double precision not null,
  lon        double precision not null,
  minutes    integer not null,
  score      numeric,
  created_at timestamptz not null default now()
);
create index if not exists analysis_history_user_idx
  on public.analysis_history (user_id, created_at desc);
alter table public.analysis_history enable row level security;

drop policy if exists "analysis_history owner" on public.analysis_history;
create policy "analysis_history owner"
  on public.analysis_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
