-- =============================================================================
--  gt_009_messaging.sql · broadcast messages and reusable templates
-- =============================================================================
--  An operator writes a message to a trip's travellers, optionally saving it as
--  a reusable template (the thing WeTravel's own users complain it lacks), and a
--  row records each send. Both operator-scoped. RLS on, no policies.
-- =============================================================================

create table if not exists public.gt_message_templates (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.gt_operators(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gt_message_templates_op on public.gt_message_templates (operator_id, created_at desc);
alter table public.gt_message_templates enable row level security;

create table if not exists public.gt_messages (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.gt_operators(id) on delete cascade,
  trip_id uuid not null references public.gt_trips(id) on delete cascade,
  subject text not null,
  body text not null,
  segment jsonb not null default '{}'::jsonb,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gt_messages_trip on public.gt_messages (trip_id, created_at desc);
alter table public.gt_messages enable row level security;
-- Service-role only on both, no policies.
