-- =============================================================================
--  gt_015_documents.sql · traveller documents in a PRIVATE store
-- =============================================================================
--  P1: passport / ID / insurance upload. Documents are sensitive PII, so unlike
--  trip photos (public Vercel Blob) they live in a PRIVATE Supabase Storage
--  bucket that has no public URL. The app reaches them only with the service
--  role, and the operator views one through a short-lived signed URL minted
--  behind an ownership check. The traveller never gets a durable link.
--
--  A document is requested as a registration field of type 'document' (see
--  lib/registration.ts). The file itself is not a form answer; it uploads out of
--  band and is recorded here, keyed to the booking, the traveller (null for a
--  booking-wide document) and the field. Registration completeness then reads
--  these rows exactly as it reads answered questions.
-- =============================================================================

create table if not exists public.gt_documents (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references public.gt_operators(id)  on delete cascade,
  booking_id    uuid not null references public.gt_bookings(id)   on delete cascade,
  trip_id       uuid not null references public.gt_trips(id)      on delete cascade,
  -- Null means the document belongs to the whole booking, not one traveller.
  traveller_id  uuid references public.gt_travellers(id) on delete set null,
  -- The registration field this satisfies, so completeness can match it.
  field_key     text not null,

  -- The object path inside the private bucket. Never a public URL.
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

-- RLS on, no policies: the service role is the only way in, exactly like every
-- other table. Ownership is enforced in the app, never by the client.
alter table public.gt_documents enable row level security;

-- The private bucket. public=false means no anonymous read; size and mime are
-- capped so a signed upload can never smuggle in something oversized or
-- executable. 5 MB covers a passport scan or a PDF comfortably.
--
-- Created in two steps on purpose: on this project a single INSERT that also
-- sets file_size_limit / allowed_mime_types is rejected, so the core row is
-- inserted first and the limits set with an UPDATE, which both succeed.
insert into storage.buckets (id, name, public)
values ('traveller-docs', 'traveller-docs', false)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
where id = 'traveller-docs';
