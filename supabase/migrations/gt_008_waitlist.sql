-- =============================================================================
--  gt_008_waitlist.sql · a waitlist for full departures
-- =============================================================================
--  When every departure of a trip is sold out, a would-be traveller leaves
--  their details here instead of hitting a dead end. Public insert (through the
--  service role, like a booking), operator-gated read. RLS on, no policies.
-- =============================================================================

create table if not exists public.gt_waitlist (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.gt_trips(id) on delete cascade,
  departure_id uuid references public.gt_departures(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  party_size integer not null default 1 check (party_size between 1 and 20),
  note text,
  status text not null default 'waiting' check (status in ('waiting','invited','converted','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gt_waitlist_trip on public.gt_waitlist (trip_id, created_at desc);

alter table public.gt_waitlist enable row level security;
-- Service-role only, no policies, exactly like every other gt_ table.
