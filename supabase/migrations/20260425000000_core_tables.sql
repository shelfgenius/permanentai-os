-- ┌─────────────────────────────────────────────────────────────────┐
-- │  Core application tables: profiles, invite_codes, playlists,   │
-- │  history, global_settings                                      │
-- │                                                                 │
-- │  Run this in Supabase Dashboard → SQL Editor → New Query       │
-- └─────────────────────────────────────────────────────────────────┘

-- ══════════════════════════════════════════════════════════
--  PROFILES
-- ══════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null default 'operator',
  role        text not null default 'member',
  preferred_domain text default 'general',
  display_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Service role full profiles" on public.profiles;
create policy "Service role full profiles"
  on public.profiles for all to service_role
  using (true) with check (true);

-- ══════════════════════════════════════════════════════════
--  INVITE CODES
-- ══════════════════════════════════════════════════════════

create table if not exists public.invite_codes (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  created_by  uuid references auth.users(id) on delete set null,
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists invite_codes_code_idx on public.invite_codes (code);

alter table public.invite_codes enable row level security;

-- Anyone can validate (read) codes
drop policy if exists "Anyone can read invite codes" on public.invite_codes;
create policy "Anyone can read invite codes"
  on public.invite_codes for select to anon, authenticated
  using (true);

-- Authenticated users can generate (insert) codes
drop policy if exists "Auth users generate codes" on public.invite_codes;
create policy "Auth users generate codes"
  on public.invite_codes for insert to authenticated
  with check (auth.uid() = created_by);

-- Authenticated users can redeem (update) unused codes
drop policy if exists "Auth users redeem codes" on public.invite_codes;
create policy "Auth users redeem codes"
  on public.invite_codes for update to authenticated
  using (used_by is null)
  with check (auth.uid() = used_by);

drop policy if exists "Service role full invite_codes" on public.invite_codes;
create policy "Service role full invite_codes"
  on public.invite_codes for all to service_role
  using (true) with check (true);

-- ══════════════════════════════════════════════════════════
--  PLAYLISTS
-- ══════════════════════════════════════════════════════════

create table if not exists public.playlists (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Untitled',
  tracks      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.playlists enable row level security;

drop policy if exists "Users own playlists" on public.playlists;
create policy "Users own playlists"
  on public.playlists for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════
--  HISTORY
-- ══════════════════════════════════════════════════════════

create table if not exists public.history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  product     text,
  action      text,
  title       text,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists history_user_product_idx
  on public.history (user_id, product, created_at desc);

alter table public.history enable row level security;

drop policy if exists "Users own history" on public.history;
create policy "Users own history"
  on public.history for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════
--  GLOBAL SETTINGS  (everyone can read AND write)
-- ══════════════════════════════════════════════════════════

create table if not exists public.global_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

alter table public.global_settings enable row level security;

drop policy if exists "Anyone can read global settings" on public.global_settings;
create policy "Anyone can read global settings"
  on public.global_settings for select to anon, authenticated
  using (true);

drop policy if exists "Auth users write global settings" on public.global_settings;
create policy "Auth users write global settings"
  on public.global_settings for all to authenticated
  using (true) with check (true);

drop policy if exists "Service role full global_settings" on public.global_settings;
create policy "Service role full global_settings"
  on public.global_settings for all to service_role
  using (true) with check (true);

-- Realtime for global_settings (frontend subscribes for backend_url changes)
do $$
begin
  alter publication supabase_realtime add table public.global_settings;
exception
  when duplicate_object then null;
end $$;
