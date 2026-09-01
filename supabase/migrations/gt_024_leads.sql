-- =============================================================================
--  gt_024_leads.sql · demo requests from the marketing site
-- =============================================================================
--  The public marketing site (trips.travelify.io) sits in front of the console
--  and its primary call to action is "book a demo". Each request lands here so
--  nothing is lost even when the email seam is off. Reachable only by the
--  service role; the marketing form writes through the server action, never the
--  browser. RLS on, no policies, like every table in this schema.
-- =============================================================================

create table if not exists public.gt_leads (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  company      text,
  email        text not null,
  phone        text,
  volume_band  text,
  message      text,
  source       text not null default 'website',
  handled      boolean not null default false,
  created_at   timestamptz not null default now()
);

comment on table public.gt_leads is
  'Demo / access requests from the public marketing site. Handled flips true once someone has followed up.';

create index if not exists gt_leads_created_idx on public.gt_leads (created_at desc);

alter table public.gt_leads enable row level security;
