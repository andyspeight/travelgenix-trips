-- =============================================================================
--  gt_017_documents_reshape.sql · gt_documents to the shipped shape
-- =============================================================================
--  gt_002 created gt_documents as a placeholder (kind / file_url) that never
--  matched the shipped document-upload feature, which needs operator_id, trip_id,
--  field_key and file_path. gt_015's `create table if not exists` was therefore a
--  no-op against the existing placeholder, so the live table kept the wrong shape
--  (caught when a recordDocument-shaped insert was tried). The table was empty
--  and referenced by nothing, so it is dropped and recreated to the intended
--  shape. Replay-safe: after gt_002 and gt_015 this drops the placeholder and
--  builds the real table. Live-verified with a real insert.
-- =============================================================================

drop table if exists public.gt_documents cascade;

create table public.gt_documents (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references public.gt_operators(id)  on delete cascade,
  booking_id    uuid not null references public.gt_bookings(id)   on delete cascade,
  trip_id       uuid not null references public.gt_trips(id)      on delete cascade,
  traveller_id  uuid references public.gt_travellers(id) on delete set null,
  field_key     text not null,
  file_path     text not null,
  file_name     text not null,
  content_type  text,
  size_bytes    integer check (size_bytes >= 0),
  uploaded_at   timestamptz not null default now()
);

comment on table public.gt_documents is
  'Traveller documents (passport, ID, insurance) in the private traveller-docs bucket. Operator-gated; served only via short-lived signed URLs.';

create index if not exists gt_documents_booking_idx on public.gt_documents (booking_id);
create index if not exists gt_documents_operator_idx on public.gt_documents (operator_id);

alter table public.gt_documents enable row level security;
