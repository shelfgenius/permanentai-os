-- ┌─────────────────────────────────────────────────────────────────┐
-- │  tunnel_registry                                                │
-- │                                                                 │
-- │  Single-row table tracking the current Cloudflare Tunnel URL    │
-- │  for the local FastAPI backend. auto_tunnel.py upserts row id=1 │
-- │  on every tunnel start; the frontend subscribes via realtime.   │
-- └─────────────────────────────────────────────────────────────────┘

create table if not exists public.tunnel_registry (
  id         int primary key default 1,
  url        text not null,
  updated_at timestamptz not null default now(),
  -- enforce the single-row invariant (only one id=1 allowed)
  constraint tunnel_registry_singleton check (id = 1)
);

-- Index for ordering (trivial on 1 row but explicit for clarity)
create index if not exists tunnel_registry_updated_at_idx
  on public.tunnel_registry (updated_at desc);

-- Automatically bump updated_at on any modification
create or replace function public.tunnel_registry_touch()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tunnel_registry_touch on public.tunnel_registry;
create trigger trg_tunnel_registry_touch
  before update on public.tunnel_registry
  for each row execute function public.tunnel_registry_touch();

-- ┌─────────────────────────────────────────────────────────────────┐
-- │  Row-Level Security                                             │
-- │                                                                 │
-- │  - anon role: read-only access (frontend polling / realtime)    │
-- │  - authenticated / service_role: full write access              │
-- │                                                                 │
-- │  auto_tunnel.py must use the SERVICE ROLE KEY (kept on the      │
-- │  local machine only) to upsert the URL. The anon key is safe    │
-- │  to ship in the frontend bundle.                                │
-- └─────────────────────────────────────────────────────────────────┘

alter table public.tunnel_registry enable row level security;

drop policy if exists "anon can read tunnel" on public.tunnel_registry;
create policy "anon can read tunnel"
  on public.tunnel_registry
  for select
  to anon
  using (true);

drop policy if exists "service role can write tunnel" on public.tunnel_registry;
create policy "service role can write tunnel"
  on public.tunnel_registry
  for all
  to service_role
  using (true)
  with check (true);

-- Enable realtime so the frontend receives push updates the instant
-- auto_tunnel.py upserts a new URL. Wrapped in DO block to be idempotent.
do $$
begin
  alter publication supabase_realtime add table public.tunnel_registry;
exception
  when duplicate_object then null;
end $$;
