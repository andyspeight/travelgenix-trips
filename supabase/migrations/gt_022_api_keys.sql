-- =============================================================================
--  gt_022_api_keys.sql · operator API keys (integrations)
-- =============================================================================
--  WeTravel-parity gap 10 (integrations) — the authenticated data API. An
--  operator mints a key on the Integrations screen and uses it as a bearer token
--  to read their bookings and create draft trips programmatically. The webhooks
--  push events out; these keys let a partner system pull and write in.
--
--  We store only the SHA-256 HASH of a key, never the key itself, exactly like a
--  password: the full key is shown to the operator once at creation and cannot
--  be recovered. key_prefix (the first few visible characters) is kept in clear
--  so the operator can tell their keys apart in a list. last_used_at is touched
--  on each authenticated request; revoked_at turns a key off without deleting
--  its audit row.
--
--  RLS on, no policies, service-role only — like every table in this schema.
-- =============================================================================

create table if not exists public.gt_api_keys (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references public.gt_operators(id) on delete cascade,
  key_hash     text not null,
  key_prefix   text not null,
  name         text,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.gt_api_keys is
  'Operator API keys for the authenticated v1 data API. Only the SHA-256 hash is stored; the key is shown once at creation.';

-- Authentication looks a key up by its hash, so that lookup must be indexed and
-- a hash can only belong to one key.
create unique index if not exists gt_api_keys_hash_idx on public.gt_api_keys (key_hash);
create index if not exists gt_api_keys_operator_idx on public.gt_api_keys (operator_id);

alter table public.gt_api_keys enable row level security;
