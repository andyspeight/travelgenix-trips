-- =============================================================================
--  gt_021_webhooks.sql · outbound webhooks (integrations)
-- =============================================================================
--  WeTravel-parity gap 10 (integrations). An operator registers one or more
--  HTTPS endpoints; when a booking is created or its status changes, Trips POSTs
--  a signed JSON payload so the operator can sync into their own CRM, accounting
--  or Slack in real time. This is the same primitive a future Zapier app would
--  consume, so it is the foundation of the integrations story, not a side road.
--
--  Each endpoint carries its own signing secret. We include an HMAC-SHA256
--  signature header on every delivery; the receiver recomputes it from the
--  secret to prove the payload came from us and was not tampered with. The
--  secret is shown to the operator once at creation and stored here so we can
--  sign; same trust level as every other row in this DB (service-role only).
--
--  events is the subscription filter: an endpoint only receives the event types
--  it lists. last_status / last_at record the most recent delivery attempt so
--  the operator can see at a glance whether their endpoint is healthy.
--
--  RLS on, no policies, service-role only — like every table in this schema.
-- =============================================================================

create table if not exists public.gt_webhooks (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.gt_operators(id) on delete cascade,
  url         text not null,
  secret      text not null,
  events      text[] not null default '{}',
  active      boolean not null default true,
  last_status integer,
  last_at     timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.gt_webhooks is
  'Operator-registered outbound webhook endpoints. Trips POSTs signed booking events to each active endpoint subscribed to the event type.';

create index if not exists gt_webhooks_operator_idx on public.gt_webhooks (operator_id);

alter table public.gt_webhooks enable row level security;
